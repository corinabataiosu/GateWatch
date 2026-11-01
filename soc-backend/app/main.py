"""GateWatch SOC API (docs/contracts.md §5).

Run from soc-backend/:  python -m uvicorn app.main:app --port 8000
"""
import logging
import urllib.error
import hmac
from functools import wraps
from uuid import UUID
from datetime import datetime
from contextlib import asynccontextmanager
from typing import Any, Literal, Optional

from fastapi import Depends, FastAPI, Header, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse
from pydantic import BaseModel

from .config import Settings, settings as default_settings
from .correlation import Correlator
from .db import Database
from .ingestion import IngestionEngine, SimulatorClient
from .mitre import mitre
from .ml.detector import AnomalyDetector
from .models import now_iso
from .pipeline import Pipeline
from .report import build_report, render_html
from .rules import SEVERITY_RANK
from .video import VideoMonitor, VideoTelemetry
from .restoration import RestorationService

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(name)s %(levelname)s %(message)s")


class StatusChange(BaseModel):
    status: Literal["new", "investigating", "contained", "resolved"]


class ResponseAction(BaseModel):
    action: Literal["isolate_device", "release_device"]
    device_id: str


class RestoreDevice(BaseModel):
    request_id: UUID


def alert_view(alert: dict[str, Any]) -> dict[str, Any]:
    return {
        "alert_id": alert["alert_id"], "created_at": alert["created_at"], "updated_at": alert["updated_at"],
        "rule_id": alert["rule_id"], "source": alert["source"], "severity": alert["severity"],
        "device_id": alert["device_id"], "title": alert["title"], "description": alert["description"],
        "mitre": mitre(alert["technique_id"]), "event_ids": alert["event_ids"],
        "incident_id": alert["incident_id"], "status": alert["status"], "score": alert["score"],
    }


def incident_view(db: Database, incident: dict[str, Any]) -> dict[str, Any]:
    count = db.scalar("SELECT COUNT(*) FROM alerts WHERE incident_id = ?", (incident["incident_id"],))
    open_count = db.scalar("SELECT COUNT(*) FROM alerts WHERE incident_id = ? AND status = 'open'",
                           (incident["incident_id"],))
    return {
        "incident_id": incident["incident_id"], "title": incident["title"], "status": incident["status"],
        "severity": incident["severity"], "created_at": incident["created_at"],
        "updated_at": incident["updated_at"], "devices": incident["devices"], "alert_count": int(count or 0),
        "open_alert_count": int(open_count or 0),
        "tactics": incident["tactics"], "summary": incident["summary"], "entities": incident["entities"],
        "run_id": incident["run_id"],
    }


def create_app(config: Settings = default_settings, client: Optional[SimulatorClient] = None) -> FastAPI:
    db = Database(config.db_path)
    detector = AnomalyDetector(config.model_path)
    pipeline = Pipeline(db, detector)
    ingestion = IngestionEngine(config, db, pipeline, client)
    correlator = Correlator(db)
    video = VideoMonitor()
    restoration = RestorationService(db, pipeline, ingestion, video)

    def require_admin(x_admin_token: Optional[str] = Header(default=None)):
        if not hmac.compare_digest(x_admin_token or "", config.admin_token):
            raise HTTPException(401, "Token admin lipsă sau invalid.")

    def synchronized(function):
        @wraps(function)
        def locked(*args, **kwargs):
            with pipeline.lock:
                return function(*args, **kwargs)
        return locked

    @asynccontextmanager
    async def lifespan(_: FastAPI):
        if config.ingestion_enabled:
            ingestion.start()
        yield
        ingestion.stop()

    app = FastAPI(title="GateWatch SOC", version="1.0.0", lifespan=lifespan)
    app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])
    app.state.db, app.state.pipeline, app.state.ingestion = db, pipeline, ingestion

    def get_incident(incident_id: str) -> dict[str, Any]:
        incident = db.one("SELECT * FROM incidents WHERE incident_id = ?", (incident_id,))
        if not incident:
            raise HTTPException(404, f"incident {incident_id} not found")
        return incident

    def device_rows() -> list[dict[str, Any]]:
        open_alerts = db.query(
            "SELECT a.device_id, a.severity, i.tactics FROM alerts a "
            "LEFT JOIN incidents i ON i.incident_id = a.incident_id WHERE a.status = 'open'")
        rows = []
        for device in ingestion.devices:
            mine = [a for a in open_alerts if a["device_id"] == device["device_id"]]
            operational = device.get("status", "online")
            worst = max((SEVERITY_RANK[a["severity"]] for a in mine), default=0)
            if worst >= 4 or (worst >= 3 and any(len(a["tactics"] or []) >= 3 for a in mine)):
                security = "compromised"
            elif mine:
                security = "warning"
            elif operational == "offline":
                # A dead device is an availability problem; without evidence we do not call it an attack.
                security = "unknown"
            else:
                security = "normal"
            score = detector.latest.get(device["device_id"])
            rows.append({
                "device_id": device["device_id"], "type": device.get("type"), "zone": device.get("zone"),
                "ip": device.get("ip"), "name": device.get("name"), "operational_status": operational,
                "security_state": security, "open_alerts": len(mine), "last_seen": device.get("last_seen"),
                "ml": score.__dict__ if score else None,
                "video": video.view(device["device_id"]),
            })
        return rows

    @app.get("/api/health")
    def health():
        return {"status": "ok", "ingestion": {**ingestion.status, **pipeline.stats.__dict__},
                "model": detector.info(), "rules": pipeline.rules.catalog()}

    @app.get("/api/overview")
    def overview():
        devices = device_rows()
        counts = {s: 0 for s in SEVERITY_RANK}
        for row in db.query("SELECT severity, COUNT(*) AS n FROM alerts WHERE status = 'open' GROUP BY severity"):
            counts[row["severity"]] = row["n"]
        return {
            "events_total": db.scalar("SELECT COUNT(*) FROM events"),
            "alerts_open": db.scalar("SELECT COUNT(*) FROM alerts WHERE status = 'open'"),
            "incidents_open": db.scalar("SELECT COUNT(*) FROM incidents WHERE status != 'resolved'"),
            "devices": {"total": len(devices),
                        "at_risk": sum(1 for d in devices if d["security_state"] in ("warning", "compromised"))},
            "severity_counts": counts,
            "simulator_connected": ingestion.status["connected"],
        }

    @app.get("/api/devices")
    def devices():
        return device_rows()

    @app.get("/api/events")
    def events(device_id: Optional[str] = None, limit: int = Query(100, ge=1, le=1000)):
        if device_id:
            return db.query("SELECT raw FROM events WHERE device_id = ? ORDER BY occurred_at DESC LIMIT ?",
                            (device_id, limit))
        return db.query("SELECT raw FROM events ORDER BY occurred_at DESC LIMIT ?", (limit,))

    @app.get("/api/alerts")
    def alerts(status: Optional[Literal["open", "closed"]] = None, device_id: Optional[str] = None,
               limit: int = Query(200, ge=1, le=1000)):
        sql, params = "SELECT * FROM alerts WHERE 1 = 1", []
        if status:
            sql += " AND status = ?"
            params.append(status)
        if device_id:
            sql += " AND device_id = ?"
            params.append(device_id)
        return [alert_view(a) for a in db.query(sql + " ORDER BY updated_at DESC LIMIT ?", params + [limit])]

    @app.get("/api/report")
    def report(format: Literal["json", "html"] = "json"):
        rule_names = {r["rule_id"]: r["name"] for r in pipeline.rules.catalog()}
        data = build_report(db, device_rows(), rule_names)
        if format == "json":
            return data
        stamp = data["generated_at"][:19].replace(":", "-").replace("T", "-")
        return HTMLResponse(render_html(data), headers={
            "Content-Disposition": f'attachment; filename="gatewatch-raport-{stamp}.html"'})

    @app.get("/api/incidents")
    def incidents():
        return [incident_view(db, i) for i in db.query("SELECT * FROM incidents ORDER BY last_alert_at DESC")]

    @app.get("/api/incidents/{incident_id}")
    def incident_detail(incident_id: str):
        incident = get_incident(incident_id)
        alerts_ = db.query("SELECT * FROM alerts WHERE incident_id = ? ORDER BY created_at", (incident_id,))
        event_ids = list(dict.fromkeys(e for a in alerts_ for e in a["event_ids"]))
        timeline = []
        if event_ids:
            marks = ",".join("?" * len(event_ids))
            timeline = db.query(f"SELECT raw FROM events WHERE event_id IN ({marks}) ORDER BY occurred_at",
                                event_ids)
        actions = db.query("SELECT * FROM actions WHERE incident_id = ? ORDER BY created_at", (incident_id,))
        return {**incident_view(db, incident), "alerts": [alert_view(a) for a in alerts_],
                "timeline": timeline, "actions": actions}

    @app.patch("/api/incidents/{incident_id}", dependencies=[Depends(require_admin)])
    @synchronized
    def change_status(incident_id: str, body: StatusChange):
        get_incident(incident_id)
        correlator.set_status(incident_id, body.status)
        db.execute("INSERT INTO actions(incident_id, created_at, action, device_id, result, detail) "
                   "VALUES (?, ?, 'status_change', NULL, 'ok', ?)", (incident_id, now_iso(), body.status))
        return incident_view(db, get_incident(incident_id))

    @app.post("/api/incidents/{incident_id}/actions", dependencies=[Depends(require_admin)])
    @synchronized
    def respond(incident_id: str, body: ResponseAction):
        incident = get_incident(incident_id)
        if body.device_id not in incident["devices"]:
            raise HTTPException(400, f"{body.device_id} is not part of {incident_id}")
        isolated = body.action == "isolate_device"
        try:
            ingestion.isolate(body.device_id, isolated)
            result, detail = "ok", ("dispozitiv izolat" if isolated else "izolare anulată")
        except (urllib.error.URLError, OSError) as exc:
            result, detail = "failed", f"simulator indisponibil: {getattr(exc, 'reason', exc)}"
        db.execute("INSERT INTO actions(incident_id, created_at, action, device_id, result, detail) "
                   "VALUES (?, ?, ?, ?, ?, ?)", (incident_id, now_iso(), body.action, body.device_id, result, detail))
        if result == "ok" and isolated and incident["status"] in ("new", "investigating"):
            correlator.set_status(incident_id, "contained")
        if result != "ok":
            raise HTTPException(502, detail)
        return {"result": result, "detail": detail, "incident": incident_view(db, get_incident(incident_id))}

    @app.post("/api/devices/{device_id}/restore", dependencies=[Depends(require_admin)])
    def restore_device(device_id: str, body: RestoreDevice):
        try:
            return restoration.restore(device_id, str(body.request_id))
        except (urllib.error.URLError, OSError, ValueError, KeyError) as exc:
            raise HTTPException(502, f"Restabilirea nu a fost finalizată; verifică simulatorul: {exc}") from exc

    @app.post("/api/video/telemetry")
    @synchronized
    def video_telemetry(body: VideoTelemetry, x_admin_token: Optional[str] = Header(default=None)):
        if x_admin_token != config.admin_token:
            raise HTTPException(401, "invalid or missing X-Admin-Token")
        if body.device_id not in {d["device_id"] for d in ingestion.devices} and ingestion.devices:
            raise HTTPException(404, f"unknown device {body.device_id}")
        cutoff = db.scalar("SELECT MAX(restored_at) FROM device_restorations WHERE device_id = ?", (body.device_id,))
        if cutoff and body.captured_at.timestamp() <= datetime.fromisoformat(cutoff.replace('Z', '+00:00')).timestamp():
            return {"accepted": False, "reason": "pre_restoration_sample", "alert_id": None, "streak": 0}
        previous = video.latest.get(body.device_id)
        if previous and body.captured_at <= datetime.fromisoformat(previous['captured_at'].replace('Z', '+00:00')):
            return {"accepted": False, "reason": "out_of_order_sample", "alert_id": None,
                    "streak": video.anomaly_streak.get(body.device_id, 0)}
        draft, cleared = video.ingest(body)
        alert = None
        if draft:
            alert = correlator.record(draft, video.latest[body.device_id]["captured_at"],
                                      ingestion.status["run_id"] or "video")
        if cleared:
            # The image is usable again: close the video alert unless an analyst owns it via an incident.
            db.execute("UPDATE alerts SET status = 'closed', updated_at = ? WHERE rule_id = 'GW-V01' "
                       "AND device_id = ? AND status = 'open' AND incident_id IS NULL",
                       (now_iso(), body.device_id))
        return {"accepted": True, "alert_id": alert["alert_id"] if alert else None,
                "streak": video.anomaly_streak.get(body.device_id, 0)}

    @app.post("/api/reset", dependencies=[Depends(require_admin)])
    @synchronized
    def reset():
        pipeline.reset()
        video.reset()
        return {"status": "reset"}

    return app


app = create_app()
