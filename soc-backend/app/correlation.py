"""Alert storage (with de-duplication) and incident correlation.

An alert joins an open incident when they share an entity (device, IP, user, badge) within the
correlation window. High-severity rule alerts with no shared entity are linked by time to a
recent multi-alert incident, because a physical-access step (cloned badge) carries no network
identifiers. ML alerts are only ever linked by entity so baseline noise cannot inflate incidents.
"""
import json
from datetime import datetime, timedelta
from typing import Any, Optional

from .db import Database
from .mitre import TACTIC_ORDER, mitre
from .models import now_iso
from .rules import SEVERITY_RANK, AlertDraft

DEDUP_WINDOW = timedelta(minutes=10)
CORRELATION_WINDOW = timedelta(minutes=30)
TEMPORAL_WINDOW = timedelta(minutes=10)
ACTIVE_STATUSES = ("new", "investigating", "contained")
ML_STEP_LABELS = {"GW-ML01": "Anomalie comportamentală (ML)", "GW-V01": "Anomalie video (ML)"}


def parse(ts: str) -> datetime:
    return datetime.fromisoformat(ts.replace("Z", "+00:00"))


def merge_entities(a: dict[str, list[str]], b: dict[str, list[str]]) -> dict[str, list[str]]:
    keys = set(a) | set(b)
    return {k: sorted(set(a.get(k, [])) | set(b.get(k, []))) for k in keys}


def shares_entity(a: dict[str, list[str]], b: dict[str, list[str]]) -> bool:
    return any(set(a.get(k, [])) & set(b.get(k, [])) for k in ("devices", "ips", "users", "badges"))


class Correlator:
    def __init__(self, db: Database):
        self.db = db

    # -- alerts ------------------------------------------------------------
    def record(self, draft: AlertDraft, occurred_at: str, run_id: str) -> Optional[dict[str, Any]]:
        """Store a detection. Returns the new alert, or None when it was merged into an existing one."""
        existing = self.db.one(
            "SELECT * FROM alerts WHERE dedup_key = ? AND status = 'open' ORDER BY id DESC LIMIT 1",
            (draft.dedup_key,),
        )
        if existing and parse(occurred_at) - parse(existing["updated_at"]) <= DEDUP_WINDOW:
            event_ids = list(dict.fromkeys(existing["event_ids"] + draft.event_ids))
            severity = max(existing["severity"], draft.severity, key=SEVERITY_RANK.get)
            score = max(filter(None, [existing["score"], draft.score]), default=None)
            self.db.execute(
                "UPDATE alerts SET event_ids = ?, updated_at = ?, description = ?, severity = ?, score = ?, "
                "entities = ? WHERE alert_id = ?",
                (json.dumps(event_ids), occurred_at, draft.description, severity, score,
                 json.dumps(merge_entities(existing["entities"], draft.entities)), existing["alert_id"]),
            )
            if existing["incident_id"]:
                self._refresh_incident(existing["incident_id"], occurred_at)
            return None

        technique = mitre(draft.technique_id) or {}
        with self.db.lock:
            cur = self.db.execute(
                "INSERT INTO alerts(created_at, updated_at, rule_id, source, severity, device_id, title, "
                "description, technique_id, technique, tactic, event_ids, entities, dedup_key, score) "
                "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
                (occurred_at, occurred_at, draft.rule_id, draft.source, draft.severity, draft.device_id,
                 draft.title, draft.description, technique.get("technique_id"), technique.get("technique"),
                 technique.get("tactic"), json.dumps(draft.event_ids), json.dumps(draft.entities),
                 draft.dedup_key, draft.score),
            )
            alert_id = f"ALR-{cur.lastrowid:05d}"
            self.db.execute("UPDATE alerts SET alert_id = ? WHERE id = ?", (alert_id, cur.lastrowid))
        alert = self.db.one("SELECT * FROM alerts WHERE alert_id = ?", (alert_id,))
        self._correlate(alert, run_id)
        return self.db.one("SELECT * FROM alerts WHERE alert_id = ?", (alert_id,))

    # -- incidents ---------------------------------------------------------
    def _correlate(self, alert: dict[str, Any], run_id: str) -> None:
        at = parse(alert["created_at"])
        candidates = [
            inc for inc in self.db.query(
                f"SELECT * FROM incidents WHERE status IN ({','.join('?' * len(ACTIVE_STATUSES))}) "
                "ORDER BY last_alert_at DESC", ACTIVE_STATUSES)
            if at - parse(inc["last_alert_at"]) <= CORRELATION_WINDOW
        ]
        target = next((inc for inc in candidates if shares_entity(inc["entities"], alert["entities"])), None)
        if target is None and alert["source"] == "rule" and SEVERITY_RANK[alert["severity"]] >= 3:
            target = next((
                inc for inc in candidates
                if at - parse(inc["last_alert_at"]) <= TEMPORAL_WINDOW and self._alert_count(inc) >= 2
            ), None)
        if target is None and alert["source"] == "ml":
            return
        if target is None:
            target = self._open_incident(alert, run_id)
        self.db.execute("UPDATE alerts SET incident_id = ? WHERE alert_id = ?",
                        (target["incident_id"], alert["alert_id"]))
        self._refresh_incident(target["incident_id"], alert["created_at"])

    def _alert_count(self, incident: dict[str, Any]) -> int:
        return int(self.db.scalar("SELECT COUNT(*) FROM alerts WHERE incident_id = ?", (incident["incident_id"],)))

    def _open_incident(self, alert: dict[str, Any], run_id: str) -> dict[str, Any]:
        with self.db.lock:
            cur = self.db.execute(
                "INSERT INTO incidents(title, status, severity, created_at, updated_at, last_alert_at, summary, "
                "devices, entities, tactics, run_id) VALUES (?, 'new', ?, ?, ?, ?, '', '[]', ?, '[]', ?)",
                (alert["title"], alert["severity"], alert["created_at"], now_iso(), alert["created_at"],
                 json.dumps(alert["entities"]), run_id),
            )
            incident_id = f"INC-{cur.lastrowid:04d}"
            self.db.execute("UPDATE incidents SET incident_id = ? WHERE id = ?", (incident_id, cur.lastrowid))
        return self.db.one("SELECT * FROM incidents WHERE incident_id = ?", (incident_id,))

    def _refresh_incident(self, incident_id: str, last_alert_at: str) -> None:
        alerts = self.db.query("SELECT * FROM alerts WHERE incident_id = ? ORDER BY created_at", (incident_id,))
        if not alerts:
            return
        entities: dict[str, list[str]] = {}
        for alert in alerts:
            entities = merge_entities(entities, alert["entities"])
        severity = max((a["severity"] for a in alerts), key=SEVERITY_RANK.get)
        devices = list(dict.fromkeys(a["device_id"] for a in alerts))
        tactics = [t for t in TACTIC_ORDER if any(a["tactic"] == t for a in alerts)]
        steps = list(dict.fromkeys(a["technique"] or ML_STEP_LABELS.get(a["rule_id"], "Anomalie comportamentală (ML)")
                                   for a in alerts))
        if len(tactics) >= 3:
            title = f"Intruziune în mai multe etape ({tactics[0]} → {tactics[-1]})"
        else:
            title = alerts[0]["title"]
        summary = (f"{len(alerts)} alerte corelate pe {len(devices)} dispozitive "
                   f"({', '.join(devices)}). Etape observate: {' → '.join(steps)}.")
        self.db.execute(
            "UPDATE incidents SET title = ?, severity = ?, updated_at = ?, last_alert_at = MAX(last_alert_at, ?), "
            "summary = ?, devices = ?, entities = ?, tactics = ? WHERE incident_id = ?",
            (title, severity, now_iso(), last_alert_at, summary, json.dumps(devices), json.dumps(entities),
             json.dumps(tactics), incident_id),
        )

    def set_status(self, incident_id: str, status: str) -> None:
        self.db.execute("UPDATE incidents SET status = ?, updated_at = ? WHERE incident_id = ?",
                        (status, now_iso(), incident_id))
        if status == "resolved":
            self.db.execute("UPDATE alerts SET status = 'closed' WHERE incident_id = ?", (incident_id,))
