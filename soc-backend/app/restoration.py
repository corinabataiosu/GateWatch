"""Admin remediation: retain evidence, close device alerts, start a new detection period."""
import json

from fastapi import HTTPException

from .models import now_iso


class RestorationService:
    def __init__(self, db, pipeline, ingestion, video):
        self.db, self.pipeline, self.ingestion, self.video = db, pipeline, ingestion, video

    def restore(self, device_id: str, request_id: str) -> dict:
        # Shared with ingestion and video: no old alert can race the closure.
        with self.pipeline.lock:
            previous = self.db.one("SELECT * FROM device_restorations WHERE request_id = ?", (request_id,))
            if previous:
                if previous["device_id"] != device_id:
                    raise HTTPException(409, "Identificatorul cererii aparține altui dispozitiv.")
                return json.loads(previous["result"])
            devices = self.ingestion.client.get("/sim/devices")
            device = next((d for d in devices if d["device_id"] == device_id), None)
            if device is None:
                raise HTTPException(404, "Dispozitiv inexistent.")
            if device.get("status") == "offline":
                raise HTTPException(409, "Dispozitiv offline; restabilește conexiunea înainte de remediere.")
            # Snapshot the source head, not the ingestion cursor: backlog remains historical.
            runs = self.ingestion.client.get("/sim/runs")
            if device.get("status") == "isolated":
                self.ingestion.isolate(device_id, False)
                device["status"] = "online"
            at = now_iso()
            alerts = self.db.query("SELECT * FROM alerts WHERE device_id = ? AND status = 'open'", (device_id,))
            incident_ids = sorted({a["incident_id"] for a in alerts if a["incident_id"]})
            resolved = []
            with self.db.lock, self.db.conn:
                conn = self.db.conn
                for run in runs:
                    conn.execute("INSERT INTO device_watermarks VALUES (?, ?, ?) "
                                 "ON CONFLICT(device_id, run_id) DO UPDATE SET seq = MAX(seq, excluded.seq)",
                                 (device_id, run["run_id"], run["last_seq"]))
                conn.execute("UPDATE alerts SET status = 'closed', updated_at = ? WHERE device_id = ? AND status = 'open'",
                             (at, device_id))
                for incident_id in incident_ids:
                    remaining = conn.execute("SELECT COUNT(*) FROM alerts WHERE incident_id = ? AND status = 'open'",
                                             (incident_id,)).fetchone()[0]
                    if not remaining:
                        conn.execute("UPDATE incidents SET status = 'resolved', updated_at = ? WHERE incident_id = ?",
                                     (at, incident_id))
                        resolved.append(incident_id)
                    conn.execute("INSERT INTO actions(incident_id, created_at, action, device_id, result, detail) "
                                 "VALUES (?, ?, 'restore_device', ?, 'ok', 'Remediere confirmată de administrator')",
                                 (incident_id, at, device_id))
                result = {"device_id": device_id, "closed_alerts": len(alerts), "resolved_incidents": resolved,
                          "restored_at": at, "result": "ok"}
                conn.execute("INSERT INTO device_restorations VALUES (?, ?, ?, ?)",
                             (request_id, device_id, at, json.dumps(result)))
            self.pipeline.rules.reset_device(device_id)
            self.pipeline.detector.extractor.buffers.pop(device_id, None)
            self.pipeline.detector.latest.pop(device_id, None)
            self.video.reset_device(device_id)
            self.ingestion.devices = devices
            return result
