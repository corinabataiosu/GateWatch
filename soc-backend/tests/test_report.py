"""Generated report: summarizes the detected alerts and incidents."""


def test_report_date_window_filters_events_alerts_and_devices(client, sim, factory):
    sim.events = factory.compromised_vendor()
    client.app_state.ingestion.poll_once()
    params = {"start": "2026-10-31T00:00:00Z", "end": "2026-11-01T00:00:00Z"}
    report = client.get('/api/report', params=params).json()
    assert report['totals']['events'] == len(sim.events)
    assert report['incidents'] and report['devices']
    empty = client.get('/api/report', params={"start": "2026-11-01T00:00:00Z", "end": "2026-11-02T00:00:00Z"}).json()
    assert empty['totals']['events'] == empty['totals']['alerts'] == 0
    assert empty['incidents'] == empty['devices'] == empty['devices_at_risk'] == []
    boundary = sim.events[0]['occurred_at']
    before = client.get('/api/report', params={"end": boundary}).json()
    assert before['totals']['events'] == 0  # upper bound is exclusive
    inclusive = client.get('/api/report', params={"start": boundary}).json()
    assert inclusive['totals']['events'] == len(sim.events)


def test_report_rejects_invalid_interval(client):
    for params in [
        {'start': 'invalid'},
        {'start': '2026-11-02T00:00:00Z', 'end': '2026-11-01T00:00:00Z'},
        {'start': '2026-11-01T00:00:00'},
    ]:
        assert client.get('/api/report', params=params).status_code == 422


def test_empty_report_says_nothing_detected(client):
    report = client.get("/api/report").json()
    assert report["totals"]["alerts"] == 0 and report["incidents"] == []
    assert "Nu a fost detectată nicio activitate suspectă" in report["summary"]


def test_report_summarizes_scenario_alerts_and_incidents(client, sim, factory):
    sim.events = factory.compromised_vendor()
    client.app_state.ingestion.poll_once()
    alerts = client.get("/api/alerts").json()
    incidents = client.get("/api/incidents").json()

    report = client.get("/api/report").json()
    assert report["totals"]["alerts"] == len(alerts)
    assert report["totals"]["incidents"] == len(incidents) == 1
    assert sum(report["severity_counts"].values()) == len(alerts)
    assert {r["rule_id"] for r in report["alerts_by_rule"]} == {a["rule_id"] for a in alerts}
    incident = report["incidents"][0]
    assert incident["incident_id"] == incidents[0]["incident_id"]
    assert {a["alert_id"] for a in incident["alerts"]} == {a["alert_id"] for a in alerts if a["incident_id"]}
    assert {"T1110", "T1133", "T1070"} <= {t["technique_id"] for t in report["techniques"]}
    assert incident["incident_id"] in report["summary"] and "CAM-01" in report["summary"]
    assert "CAM-01" in {d["device_id"] for d in report["devices_at_risk"]}


def test_report_includes_response_actions(client, sim, factory):
    sim.events = factory.compromised_vendor()
    client.app_state.ingestion.poll_once()
    incident_id = client.get("/api/incidents").json()[0]["incident_id"]
    client.post(f"/api/incidents/{incident_id}/actions", json={"action": "isolate_device", "device_id": "CAM-01"})
    actions = client.get("/api/report").json()["incidents"][0]["actions"]
    assert any(a["action"] == "isolate_device" and a["device_id"] == "CAM-01" for a in actions)


def test_html_report_is_downloadable_and_escapes_event_data(client, factory):
    hostile = '<script>alert(1)</script>'
    events = [factory.make("CAM-02", "auth_login", "failure", user=hostile, advance=2) for _ in range(5)]
    client.app_state.pipeline.process(events)
    resp = client.get("/api/report?format=html")
    assert resp.status_code == 200 and resp.headers["content-type"].startswith("text/html")
    assert "attachment" in resp.headers["content-disposition"]
    body = resp.text
    assert "raport de activitate SOC" in body and "CAM-02" in body
    assert hostile not in body and "&lt;script&gt;" in body
