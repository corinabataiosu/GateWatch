"""SOC activity report: a summary of detected alerts and correlated incidents.

``build_report`` assembles the report from the SOC store; ``render_html`` turns it into a standalone,
printable HTML document. Report text is Romanian, like the dashboard. Every value taken from events
is escaped: usernames and IPs in alert descriptions can be attacker-controlled.
"""
from collections import Counter
from html import escape
from typing import Any

from .db import Database
from .mitre import mitre
from .models import now_iso
from .rules import SEVERITY_RANK

ML_RULE_NAMES = {"GW-ML01": "Comportament anormal (Isolation Forest, evenimente)",
                 "GW-V01": "Imagine video anormală (Isolation Forest, video)"}
SEVERITY_LABELS = {"critical": "critică", "high": "ridicată", "medium": "medie", "low": "scăzută"}
STATUS_LABELS = {"new": "nou", "investigating": "în investigare", "contained": "izolat", "resolved": "rezolvat"}
SECURITY_LABELS = {"compromised": "compromis", "warning": "avertizare", "unknown": "necunoscută", "normal": "normală"}
ACTION_LABELS = {"isolate_device": "izolare dispozitiv", "release_device": "anulare izolare",
                 "status_change": "schimbare stare"}


def build_report(db: Database, devices: list[dict[str, Any]], rule_names: dict[str, str],
                 start: str | None = None, end: str | None = None) -> dict[str, Any]:
    names = {**rule_names, **ML_RULE_NAMES}
    def bounds(column):
        clauses, params = [], []
        if start:
            clauses.append(f"{column} >= ?")
            params.append(start)
        if end:
            clauses.append(f"{column} < ?")
            params.append(end)
        return (" WHERE " + " AND ".join(clauses) if clauses else ""), tuple(params)
    where, params = bounds("created_at")
    alerts = db.query("SELECT * FROM alerts" + where + " ORDER BY created_at", params)
    incidents = db.query("SELECT * FROM incidents ORDER BY created_at")
    if start or end:
        incident_ids = {a["incident_id"] for a in alerts}
        incidents = [i for i in incidents if i["incident_id"] in incident_ids]
    event_where, event_params = bounds("occurred_at")
    window = db.one("SELECT MIN(occurred_at) AS first, MAX(occurred_at) AS last, COUNT(*) AS n FROM events" + event_where, event_params)

    severity = Counter(a["severity"] for a in alerts)
    by_rule = Counter(a["rule_id"] for a in alerts)
    techniques = Counter(a["technique_id"] for a in alerts if a["technique_id"])

    incident_rows = []
    for inc in sorted(incidents, key=lambda i: (-SEVERITY_RANK[i["severity"]], i["created_at"])):
        own = [a for a in alerts if a["incident_id"] == inc["incident_id"]]
        actions = db.query("SELECT * FROM actions WHERE incident_id = ? ORDER BY created_at", (inc["incident_id"],))
        actions = [a for a in actions if (not start or a["created_at"] >= start) and (not end or a["created_at"] < end)]
        incident_rows.append({
            "incident_id": inc["incident_id"], "title": inc["title"], "status": inc["status"],
            "severity": inc["severity"], "created_at": inc["created_at"], "last_alert_at": inc["last_alert_at"],
            "devices": inc["devices"], "tactics": inc["tactics"], "summary": inc["summary"],
            "alerts": [{"alert_id": a["alert_id"], "created_at": a["created_at"], "rule_id": a["rule_id"],
                        "severity": a["severity"], "device_id": a["device_id"], "title": a["title"],
                        "description": a["description"], "technique_id": a["technique_id"]} for a in own],
            "actions": [{"created_at": x["created_at"], "action": x["action"], "device_id": x["device_id"],
                         "result": x["result"], "detail": x["detail"]} for x in actions],
        })

    at_risk = [d for d in devices if d["security_state"] in ("compromised", "warning")]
    if start or end:
        relevant_devices = {a["device_id"] for a in alerts}
        at_risk = [d for d in at_risk if d["device_id"] in relevant_devices]
    open_incidents = [i for i in incidents if i["status"] != "resolved"]
    active_ids = {row["device_id"] for row in db.query("SELECT DISTINCT device_id FROM events" + event_where, event_params)}
    active_ids.update(a["device_id"] for a in alerts)
    selected_devices = [d for d in devices if not (start or end) or d["device_id"] in active_ids]
    return {
        "generated_at": now_iso(),
        "filters": {"start": start, "end": end},
        "devices": [{"device_id": d["device_id"], "name": d["name"], "zone": d["zone"],
                     "security_state": d["security_state"], "operational_status": d["operational_status"],
                     "open_alerts": d["open_alerts"]} for d in selected_devices],
        "period": {"first_event": window["first"] if window else None,
                   "last_event": window["last"] if window else None},
        "summary": executive_summary(alerts, incidents, open_incidents, at_risk, window["n"] if window else 0),
        "totals": {
            "events": window["n"] if window else 0,
            "alerts": len(alerts),
            "alerts_open": sum(1 for a in alerts if a["status"] == "open"),
            "alerts_rule": sum(1 for a in alerts if a["source"] == "rule"),
            "alerts_ml": sum(1 for a in alerts if a["source"] == "ml"),
            "incidents": len(incidents),
            "incidents_open": len(open_incidents),
            "devices_at_risk": len(at_risk),
        },
        "severity_counts": {s: severity.get(s, 0) for s in ("critical", "high", "medium", "low")},
        "incidents_by_status": {s: sum(1 for i in incidents if i["status"] == s) for s in STATUS_LABELS},
        "alerts_by_rule": [{"rule_id": r, "name": names.get(r, r), "count": n} for r, n in by_rule.most_common()],
        "techniques": [{**(mitre(t) or {"technique_id": t}), "count": n} for t, n in techniques.most_common()],
        "incidents": incident_rows,
        "devices_at_risk": [{"device_id": d["device_id"], "name": d["name"], "zone": d["zone"],
                             "security_state": d["security_state"], "operational_status": d["operational_status"],
                             "open_alerts": d["open_alerts"]} for d in at_risk],
    }


def executive_summary(alerts, incidents, open_incidents, at_risk, events: int) -> str:
    if not alerts:
        return (f"În perioada analizată au fost procesate {events} evenimente. "
                "Nu a fost detectată nicio activitate suspectă.")
    worst = max(incidents, key=lambda i: SEVERITY_RANK[i["severity"]], default=None)
    parts = [f"Au fost procesate {events} evenimente și generate {len(alerts)} alerte, "
             f"corelate în {len(incidents)} incidente ({len(open_incidents)} deschise)."]
    if worst:
        parts.append(f"Cel mai grav incident este {worst['incident_id']} "
                     f"(severitate {SEVERITY_LABELS[worst['severity']]}, {STATUS_LABELS[worst['status']]}): "
                     f"{worst['title']}.")
    if at_risk:
        parts.append("Dispozitive la risc: " + ", ".join(
            f"{d['device_id']} ({SECURITY_LABELS[d['security_state']]})" for d in at_risk) + ".")
    else:
        parts.append("În prezent niciun dispozitiv nu este la risc.")
    return " ".join(parts)


def _fmt(ts: str | None) -> str:
    return escape(ts.replace("T", " ").replace("Z", " UTC")[:23] if ts else "—")


def render_html(report: dict[str, Any]) -> str:
    t = report["totals"]
    rows = lambda cells: "".join(f"<td>{c}</td>" for c in cells)  # noqa: E731

    incidents_html = []
    for inc in report["incidents"]:
        alert_rows = []
        for a in inc["alerts"]:
            title = f"{escape(a['title'])}<br><span class=\"meta\">{escape(a['description'])}</span>"
            alert_rows.append(
                f"<tr>{rows([_fmt(a['created_at']), escape(a['alert_id']), escape(a['rule_id']), escape(SEVERITY_LABELS[a['severity']]), escape(a['device_id']), title, escape(a['technique_id'] or '—')])}</tr>"
            )
        alerts = "".join(alert_rows)
        actions = "".join(
            f"<li>{_fmt(x['created_at'])} · {escape(ACTION_LABELS.get(x['action'], x['action']))}"
            f"{' · ' + escape(x['device_id']) if x['device_id'] else ''} · {escape(x['detail'] or x['result'])}</li>"
            for x in inc["actions"]) or "<li>Nicio acțiune de răspuns înregistrată.</li>"
        incidents_html.append(f"""
<section class="incident sev-{escape(inc['severity'])}">
  <h3>{escape(inc['incident_id'])} — {escape(inc['title'])}</h3>
  <p class="meta">Severitate {escape(SEVERITY_LABELS[inc['severity']])} · stare {escape(STATUS_LABELS[inc['status']])} ·
  creat {_fmt(inc['created_at'])} · ultima alertă {_fmt(inc['last_alert_at'])}</p>
  <p>{escape(inc['summary'])}</p>
  <p class="meta">Dispozitive: {escape(', '.join(inc['devices']))} · Tactici: {escape(', '.join(inc['tactics']) or '—')}</p>
  <table><thead><tr><th>Ora</th><th>Alertă</th><th>Regulă</th><th>Severitate</th><th>Dispozitiv</th><th>Titlu</th><th>MITRE</th></tr></thead>
  <tbody>{alerts}</tbody></table>
  <h4>Acțiuni de răspuns</h4><ul>{actions}</ul>
</section>""")

    devices = "".join(
        f"<tr>{rows([escape(d['device_id']), escape(d['name'] or ''), escape(d['zone'] or ''), escape(SECURITY_LABELS[d['security_state']]), escape(d['operational_status']), d['open_alerts']])}</tr>"
        for d in report["devices_at_risk"]) or '<tr><td colspan="6">Niciun dispozitiv la risc.</td></tr>'
    severity = " · ".join(f"{SEVERITY_LABELS[s]}: {n}" for s, n in report["severity_counts"].items())

    return f"""<!doctype html>
<html lang="ro"><head><meta charset="utf-8">
<title>GateWatch — raport SOC {_fmt(report['generated_at'])}</title>
<style>
body {{ font: 14px/1.5 system-ui, sans-serif; color: #1c2733; max-width: 1000px; margin: 32px auto; padding: 0 24px; }}
h1 {{ font-size: 22px; margin-bottom: 4px; }} h2 {{ font-size: 17px; margin-top: 28px; border-bottom: 1px solid #d7dee6; padding-bottom: 4px; }}
h3 {{ font-size: 15px; margin: 0 0 4px; }} h4 {{ font-size: 13px; margin: 12px 0 4px; }}
.meta {{ color: #5b6878; font-size: 12px; margin: 2px 0; }}
.kpi {{ display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; }}
.kpi div {{ border: 1px solid #d7dee6; border-radius: 6px; padding: 8px 10px; }} .kpi b {{ display: block; font-size: 20px; }}
table {{ width: 100%; border-collapse: collapse; font-size: 12px; margin-top: 6px; }}
th, td {{ text-align: left; padding: 4px 6px; border-bottom: 1px solid #e6ebf0; vertical-align: top; }}
th {{ background: #f4f7fa; }}
.incident {{ border: 1px solid #d7dee6; border-left: 4px solid #8a99aa; border-radius: 6px; padding: 12px 14px; margin: 12px 0; break-inside: avoid; }}
.sev-critical {{ border-left-color: #b03a2e; }} .sev-high {{ border-left-color: #c8642a; }} .sev-medium {{ border-left-color: #c79a1e; }}
@media print {{ body {{ margin: 0; }} }}
</style></head><body>
<h1>GateWatch — raport de activitate SOC</h1>
<p class="meta">Generat {_fmt(report['generated_at'])} · evenimente între {_fmt(report['period']['first_event'])} și {_fmt(report['period']['last_event'])}</p>
<h2>Rezumat</h2>
<p>{escape(report['summary'])}</p>
<div class="kpi">
  <div>Evenimente<b>{t['events']}</b></div>
  <div>Alerte (deschise)<b>{t['alerts']} ({t['alerts_open']})</b></div>
  <div>Incidente (deschise)<b>{t['incidents']} ({t['incidents_open']})</b></div>
  <div>Dispozitive la risc<b>{t['devices_at_risk']}</b></div>
</div>
<p class="meta">Alerte după severitate — {escape(severity)} · surse: {t['alerts_rule']} reguli, {t['alerts_ml']} ML</p>
<h2>Incidente</h2>
{''.join(incidents_html) or '<p>Niciun incident.</p>'}
<h2>Dispozitive la risc</h2>
<table><thead><tr><th>Dispozitiv</th><th>Nume</th><th>Zonă</th><th>Stare securitate</th><th>Stare operațională</th><th>Alerte deschise</th></tr></thead><tbody>{devices}</tbody></table>
<p class="meta">Raport generat automat de SOC-ul GateWatch din datele simulatorului de infrastructură și ale modulului video.</p>
</body></html>
"""
