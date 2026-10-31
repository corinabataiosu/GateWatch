from datetime import datetime
from uuid import uuid4

import pytest

from conftest import ADMIN, all_events


def execute(client, **kwargs):
    return client.post('/sim/attacks/execute', headers=ADMIN, json={
        'execution_id': str(uuid4()), 'device_id': 'CAM-06', 'attack': 'dos', **kwargs})


@pytest.mark.parametrize('direction', ['inbound', 'outbound'])
def test_cam06_flood_reset_and_persistence(client, direction):
    old = client.get('/sim/health').json()['run_id']
    client.post('/sim/runs', headers=ADMIN)
    assert all_events(client) == []
    response = execute(client, direction=direction, packets_per_second=6000, duration_s=4)
    assert response.status_code == 200
    result = response.json()
    assert result['run_id'] != old and result['status'] == 'completed'
    assert result['packet_count'] == 24000 and result['total_bytes'] == 24000 * 1024
    events = all_events(client)
    assert len(events) == result['event_count'] == 4
    for e in events:
        assert e['source']['ip'] == ('10.20.1.16' if direction == 'outbound' else '198.51.100.24')
        assert e['target']['ip'] == ('198.51.100.24' if direction == 'outbound' else '10.20.1.16')
        d = e['details']
        assert (datetime.fromisoformat(d['interval_end']) - datetime.fromisoformat(d['interval_start'])).total_seconds() == 1
        assert d['packet_count'] == d['packets_per_second'] * d['duration_s']
        assert d['total_bytes'] == d['bytes_per_second'] * d['duration_s']
        assert d['execution_id'] == result['execution_id']
    assert client.get('/sim/executions').json()[0] == result


@pytest.mark.parametrize('attack,extra,kind,count', [
    ('brute_force', {}, 'auth_login', 12), ('port_scan', {}, 'connection_attempt', 12),
    ('unauthorized_access', {}, 'access_denied', 12),
    ('lateral_movement', {'destination_device_id': 'ACS-03'}, 'connection_attempt', 12),
    ('exfiltration', {'device_id': 'NVR-01'}, 'network_flow', 10),
])
def test_profiles(client, attack, extra, kind, count):
    result = execute(client, attack=attack, **extra).json()
    assert result['status'] == 'completed'
    events = all_events(client)
    assert len(events) == count and {e['event_type'] for e in events} == {kind}
    assert all('attack_type' not in e['details'] and 'password' not in e['details'] for e in events)
    if attack == 'port_scan':
        assert len({e['target']['port'] for e in events}) == count
        assert sum(e['details']['connection_result'] == 'open' for e in events) == 1
    if attack == 'lateral_movement':
        assert all(e['source']['ip'] == '10.20.1.16' and e['target']['ip'] == '10.20.3.33' for e in events)
    if attack == 'exfiltration':
        assert result['total_bytes'] == 20000000


def test_auth_bounds_policy_and_compatibility(client):
    body = {'execution_id': str(uuid4()), 'device_id': 'CAM-06', 'attack': 'dos'}
    assert client.post('/sim/attacks/execute', json=body).status_code == 401
    for extra in [{'packets_per_second': 50001}, {'duration_s': 0}, {'external_ip': '8.8.8.8'},
                  {'device_id': 'missing'}, {'device_id': 'ACS-01', 'attack': 'exfiltration'},
                  {'attack': 'lateral_movement', 'destination_device_id': 'CAM-06'},
                  {'attack': 'lateral_movement', 'destination_device_id': 'NVR-01', 'port': 554}]:
        assert execute(client, **extra).status_code == 422
    assert all_events(client) == []


def test_idempotency_survives_engine_restart(client, sim):
    from app.attacks import AttackEngine
    execution_id = str(uuid4())
    first = execute(client, execution_id=execution_id).json()
    sim.attacks = AttackEngine(sim)
    assert execute(client, execution_id=execution_id).json() == first
    assert len(all_events(client)) == 10
    assert execute(client, execution_id=execution_id, duration_s=5).status_code == 422


def test_baseline_never_executes_attacks(client, sim):
    for second in range(400):
        sim.baseline.tick(float(second))
    events = all_events(client)
    assert events and all(e['origin'] == 'synthetic' and e['outcome'] != 'failure' for e in events)
    assert all('execution_id' not in e['details'] for e in events)
    assert client.get('/sim/executions').json() == []
    assert len(client.get('/sim/devices').json()) == 15


def test_partial_failure_is_truthful(client, sim, monkeypatch):
    original = sim.emit
    calls = []
    def emit(*args, **kwargs):
        if calls:
            raise RuntimeError('storage test failure')
        calls.append(1)
        return original(*args, **kwargs)
    monkeypatch.setattr(sim, 'emit', emit)
    result = execute(client).json()
    assert result['status'] == 'failed' and result['event_count'] == 1
    assert result['errors'] == ['storage test failure'] and len(all_events(client)) == 1
