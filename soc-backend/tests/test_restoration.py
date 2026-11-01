import uuid
from app.config import Settings
from app.main import create_app
from fastapi.testclient import TestClient
from test_video import sample

ADMIN = {"X-Admin-Token": "gatewatch-admin"}


def restore(client, device="CAM-01", request_id=None, headers=ADMIN):
    return client.post(f"/api/devices/{device}/restore", headers=headers,
                       json={"request_id": request_id or str(uuid.uuid4())})


def failures(factory, device):
    return [factory.make(device, "auth_login", "failure", user="admin") for _ in range(6)]


def test_requires_admin_and_preserves_data(client, sim, factory):
    sim.events = failures(factory, "CAM-01")
    client.app_state.ingestion.poll_once()
    assert restore(client, headers={}).status_code == 401
    assert restore(client, headers={"X-Admin-Token": "wrong"}).status_code == 401
    assert client.get('/api/alerts?status=open').json()
    for path in ('/api/reset', '/api/incidents/nope/actions'):
        assert client.post(path, json={"action": "isolate_device", "device_id": "CAM-01"}).status_code == 401
    assert client.patch('/api/incidents/nope', json={"status": "resolved"}).status_code == 401


def test_restore_one_device_keeps_other_alerts_history_and_new_detection(client, sim, factory):
    sim.events = failures(factory, "CAM-01") + failures(factory, "CAM-02")
    client.app_state.ingestion.poll_once()
    before = client.get('/api/alerts?status=open&device_id=CAM-02').json()
    request_id = str(uuid.uuid4())
    response = restore(client, request_id=request_id)
    assert response.status_code == 200, response.text
    assert response.json()['closed_alerts'] >= 1
    assert restore(client, request_id=request_id).json() == response.json()
    assert restore(client, device='CAM-02', request_id=request_id).status_code == 409
    assert not client.get('/api/alerts?status=open&device_id=CAM-01').json()
    assert client.get('/api/alerts?status=open&device_id=CAM-02').json() == before
    for alert in before:
        if alert['incident_id']:
            incident = client.get(f"/api/incidents/{alert['incident_id']}").json()
            assert incident['status'] != 'resolved'
            assert incident['open_alert_count'] > 0
    assert client.get('/api/alerts?device_id=CAM-01').json()
    assert len(client.get('/api/events').json()) == 12
    # Old failed logins cannot turn this new successful login into a compromise.
    sim.events.append(factory.make('CAM-01', 'auth_login', 'success', user='admin'))
    client.app_state.ingestion.poll_once()
    assert not [a for a in client.get('/api/alerts?status=open&device_id=CAM-01').json() if a['source'] == 'rule']
    sim.events += failures(factory, 'CAM-01')
    client.app_state.ingestion.poll_once()
    assert any(a['rule_id'] == 'GW-R01' for a in client.get('/api/alerts?status=open&device_id=CAM-01').json())


def test_backlog_watermark_survives_restart(client, sim, factory):
    sim.events = failures(factory, 'CAM-01') + failures(factory, 'CAM-02')
    assert restore(client).status_code == 200  # before either device's backlog is ingested
    db_path = client.app_state.ingestion.settings.db_path
    with TestClient(create_app(Settings(db_path=db_path, ingestion_enabled=False), client=sim)) as restarted:
        restarted.app.state.ingestion.poll_once()
        assert not restarted.get('/api/alerts?status=open&device_id=CAM-01').json()
        assert restarted.get('/api/alerts?status=open&device_id=CAM-02').json()
        assert len(restarted.get('/api/events').json()) == 12


def test_video_needs_fresh_evidence_after_restore(client, sim):
    old = sample(True)
    for _ in range(3):
        client.post('/api/video/telemetry', json=sample(True), headers=ADMIN)
    assert restore(client).json()['closed_alerts'] == 1
    assert client.post('/api/video/telemetry', json=old, headers=ADMIN).json()['accepted'] is False
    for _ in range(2):
        client.post('/api/video/telemetry', json=sample(True), headers=ADMIN)
    assert not client.get('/api/alerts?status=open').json()
    client.post('/api/video/telemetry', json=sample(True), headers=ADMIN)
    assert len(client.get('/api/alerts?status=open').json()) == 1


def test_simulator_failure_does_not_close_alerts(client, sim, factory):
    sim.events = failures(factory, 'CAM-01')
    client.app_state.ingestion.poll_once()
    sim.up = False
    assert restore(client).status_code == 502
    assert client.get('/api/alerts?status=open').json()


def test_release_and_resolve_only_empty_incident(client, sim, factory):
    sim.events = failures(factory, 'CAM-01')
    client.app_state.ingestion.poll_once()
    sim.isolated = ['CAM-01']
    result = restore(client).json()
    assert result['resolved_incidents']
    assert sim.isolated == []
    device = next(d for d in client.get('/api/devices').json() if d['device_id'] == 'CAM-01')
    assert device['security_state'] == 'normal' and device['open_alerts'] == 0
    incident = result['resolved_incidents'][0]
    detail = client.get(f'/api/incidents/{incident}').json()
    assert detail['open_alert_count'] == 0 and detail['alert_count'] > 0
    assert any(a['action'] == 'restore_device' for a in detail['actions'])
    client.patch(f'/api/incidents/{incident}', json={"status": "investigating"}, headers=ADMIN)
    assert not client.get('/api/alerts?status=open&device_id=CAM-01').json()
