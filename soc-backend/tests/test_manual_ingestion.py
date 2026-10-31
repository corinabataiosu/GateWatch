"""Real simulator API → existing SOC ingestion → pipeline → dashboard alerts."""
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient

from app.config import Settings
from app.main import create_app


@pytest.mark.parametrize('attack,extra,rule', [
    ('dos', {'direction': 'inbound'}, 'GW-R10'),
    ('dos', {'direction': 'outbound'}, 'GW-R10'),
    ('brute_force', {}, 'GW-R01'), ('port_scan', {}, 'GW-R09'),
    ('unauthorized_access', {}, 'GW-R11'),
    ('lateral_movement', {'destination_device_id': 'ACS-03'}, 'GW-R12'),
    ('exfiltration', {'device_id': 'NVR-01'}, 'GW-R13'),
])
def test_simulator_to_dashboard(tmp_path, monkeypatch, attack, extra, rule):
    monkeypatch.setenv('GATEWATCH_SIM_DB', ':memory:')
    monkeypatch.setenv('GATEWATCH_SIM_BACKGROUND', '0')
    from simulator.app.main import create_app as create_sim
    from simulator.app.config import Settings as SimSettings
    with TestClient(create_sim(SimSettings(db_path=':memory:', background=False))) as simulator:
        class Transport:
            def get(self, path):
                response = simulator.get(path)
                response.raise_for_status()
                return response.json()
        with TestClient(create_app(Settings(db_path=str(tmp_path / 'soc.db'), ingestion_enabled=False), client=Transport())) as soc:
            ingestion = soc.app.state.ingestion
            assert ingestion.poll_once() == 0
            result = simulator.post('/sim/attacks/execute', headers={'X-Admin-Token': 'gatewatch-admin'}, json={
                'execution_id': str(uuid4()), 'device_id': 'CAM-06', 'attack': attack, **extra})
            assert result.status_code == 200 and result.json()['status'] == 'completed'
            assert ingestion.poll_once() == result.json()['event_count']
            assert soc.app.state.pipeline.stats.rejected == 0
            alerts = soc.get('/api/alerts').json()
            assert any(a['rule_id'] == rule for a in alerts)
            assert ingestion.poll_once() == 0


def test_soc_uses_facts_and_policy_not_labels(factory):
    from app.models import Event
    from app.rules import RuleEngine
    engine = RuleEngine()
    label = factory.make('CAM-06', 'heartbeat', attack_type='dos', execution_id='fake', packet_count=999999)
    assert engine.evaluate(Event.model_validate(label)) == []
    for n in range(12):
        raw = factory.make('CAM-06', 'connection_attempt')
        raw['target'].update(ip='10.20.1.16', port=100 + n)
        detections = engine.evaluate(Event.model_validate(raw))
    assert any(d.rule_id == 'GW-R09' for d in detections)
    allowed = factory.make('CAM-06', 'connection_attempt', ip='10.20.1.16', policy_decision='deny')
    allowed['target'].update(ip='10.20.2.21', port=554)
    assert not any(d.rule_id == 'GW-R12' for d in RuleEngine().evaluate(Event.model_validate(allowed)))
