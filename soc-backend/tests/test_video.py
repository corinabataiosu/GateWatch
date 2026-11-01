"""Video telemetry from ml/src/agent_video.py: second source for the same logical camera."""
from datetime import datetime, timedelta, timezone

ADMIN = {"X-Admin-Token": "gatewatch-admin"}


def sample(anomaly: bool, **overrides):
    body = {
        "device_id": "CAM-01", "captured_at": datetime.now(timezone.utc).isoformat(),
        "brightness": 7.5 if anomaly else 148.0, "sharpness": 11.0 if anomaly else 520.0,
        "frame_diff": 0.8 if anomaly else 2.5, "score": 0.70 if anomaly else 0.49, "threshold": 0.63,
        "is_anomaly": anomaly, "out_of_range": ["luminozitate_medie"] if anomaly else [],
        "model_version": "video-iforest-test", "source": "synthetic",
    }
    return {**body, **overrides}


def post(client, body, headers=ADMIN):
    return client.post("/api/video/telemetry", json=body, headers=headers)


def cam01(client):
    client.app_state.ingestion.poll_once()
    return next(d for d in client.get("/api/devices").json() if d["device_id"] == "CAM-01")


def test_requires_admin_token(client):
    assert post(client, sample(False), headers={}).status_code == 401
    assert post(client, {**sample(False), "brightness": 999}).status_code == 422


def test_normal_video_fills_device_without_alerts(client):
    assert post(client, sample(False)).json()["alert_id"] is None
    device = cam01(client)
    assert device["video"]["brightness"] == 148.0 and device["video"]["stale"] is False
    assert device["security_state"] == "normal"


def test_three_consecutive_anomalies_raise_one_warning_without_incident(client):
    responses = [post(client, sample(True)).json() for _ in range(6)]
    assert [r["alert_id"] is not None for r in responses] == [False, False, True, False, False, False]
    alerts = [a for a in client.get("/api/alerts").json() if a["rule_id"] == "GW-V01"]
    assert len(alerts) == 1 and "obturare" in alerts[0]["description"] and alerts[0]["incident_id"] is None
    assert client.get("/api/incidents").json() == []
    device = cam01(client)
    # Unusable image is a warning, never "compromised" on video evidence alone.
    assert device["security_state"] == "warning" and device["video"]["diagnosis"].startswith("imagine aproape neagră")


def test_single_odd_frame_does_not_alert(client):
    for anomaly in (True, False, True, False, True, False):
        assert post(client, sample(anomaly)).json()["alert_id"] is None


def test_resolve_standalone_warning_preserves_history_and_allows_new_detection(client):
    cam01(client)
    for _ in range(3):
        post(client, sample(True))
    assert cam01(client)["standalone_alerts"] == 1
    response = client.post("/api/devices/CAM-01/resolve-warning")
    assert response.status_code == 200 and response.json()["closed_alerts"] == 1
    assert cam01(client)["security_state"] == "normal"
    assert client.get("/api/alerts").json()[0]["status"] == "closed"
    assert client.post("/api/devices/CAM-01/resolve-warning").json()["closed_alerts"] == 0
    assert post(client, sample(True)).json()["alert_id"] is not None
    assert cam01(client)["security_state"] == "warning"


def test_resolve_warning_keeps_incident_alerts(client, sim, factory):
    sim.events = [factory.make("CAM-01", "auth_login", "failure", user="admin", advance=2) for _ in range(6)]
    client.app_state.ingestion.poll_once()
    for _ in range(3):
        post(client, sample(True))
    before = client.get("/api/alerts").json()
    assert any(a["incident_id"] for a in before)
    standalone = sum(a["incident_id"] is None and a["status"] == "open" for a in before)
    assert client.post("/api/devices/CAM-01/resolve-warning").json()["closed_alerts"] == standalone
    after = client.get("/api/alerts").json()
    assert {a["alert_id"]: a for a in after if a["incident_id"]} == {
        a["alert_id"]: a for a in before if a["incident_id"]}
    assert cam01(client)["security_state"] != "normal"


def test_resolve_warning_unknown_device(client):
    assert client.post("/api/devices/UNKNOWN/resolve-warning").status_code == 404


def test_alert_closes_when_image_recovers(client):
    for _ in range(3):
        post(client, sample(True))
    for _ in range(5):
        post(client, sample(False))
    assert [a["status"] for a in client.get("/api/alerts").json() if a["rule_id"] == "GW-V01"] == ["closed"]
    assert cam01(client)["security_state"] == "normal"


def test_video_alert_joins_existing_cam01_incident(client, sim, factory):
    sim.events = [factory.make("CAM-01", "auth_login", "failure", user="admin", advance=2) for _ in range(6)]
    client.app_state.ingestion.poll_once()
    incident_id = client.get("/api/incidents").json()[0]["incident_id"]
    seen_at = (factory.clock + timedelta(seconds=10)).isoformat()  # same clock as the CAM-01 events
    for _ in range(3):
        post(client, sample(True, captured_at=seen_at))
    video_alert = next(a for a in client.get("/api/alerts").json() if a["rule_id"] == "GW-V01")
    assert video_alert["incident_id"] == incident_id
    detail = client.get(f"/api/incidents/{incident_id}").json()
    assert "Anomalie video (ML)" in detail["summary"]
