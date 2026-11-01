import random

import numpy as np

from app.config import settings
from app.ml.detector import AnomalyDetector
from app.ml.train import synthetic_baseline
from app.models import Event
from conftest import ATTACKER, EventFactory


def ingest(client) -> int:
    return client.app_state.ingestion.poll_once()


# -- ingestion -------------------------------------------------------------

def test_cursor_paging_ingests_everything_once(client, sim, factory):
    sim.events = [factory.make("CAM-02", "heartbeat", "info", origin="synthetic") for _ in range(12)]
    assert ingest(client) == 12  # page_size=5 → three pages
    assert ingest(client) == 0
    health = client.get("/api/health").json()["ingestion"]
    assert health["connected"] and health["last_seq"] == 12 and health["stored"] == 12


def test_duplicates_and_invalid_events_are_dropped(client, factory):
    good = factory.make("CAM-02", "heartbeat", "info", origin="synthetic")
    bad = {**factory.make("CAM-02", "heartbeat", "info"), "event_type": "teleport"}
    pipeline = client.app_state.pipeline
    pipeline.process([good, good, bad])
    assert (pipeline.stats.stored, pipeline.stats.duplicates, pipeline.stats.rejected) == (1, 1, 1)


def test_new_run_is_followed_and_cursor_persists(client, sim, factory):
    sim.events = [factory.make("CAM-02", "heartbeat", "info") for _ in range(3)]
    ingest(client)
    second = EventFactory("run-2")
    sim.run_id = "run-2"
    sim.events += [second.make("CAM-03", "heartbeat", "info") for _ in range(2)]
    assert ingest(client) == 2
    assert client.app_state.db.get_cursor("run-test") == 3
    assert client.app_state.db.get_cursor("run-2") == 2


def test_simulator_down_reports_disconnected(client, sim):
    sim.up = False
    assert ingest(client) == 0
    status = client.get("/api/health").json()["ingestion"]
    assert status["connected"] is False and "refused" in status["error"]


def test_backlog_is_bounded_and_devices_available_before_processing(client, sim, factory, monkeypatch):
    engine = client.app_state.ingestion
    engine.settings.max_pages_per_poll = 1
    sim.events = [factory.make("CAM-02", "heartbeat", "info") for _ in range(12)]
    original = engine.pipeline.process

    def process(events):
        assert len(engine.devices) == 15
        assert engine.status["connected"]
        return original(events)

    monkeypatch.setattr(engine.pipeline, "process", process)
    assert ingest(client) == 5
    assert engine.status["catching_up"]
    assert engine.status["last_seq"] == 5
    assert engine.status["events_ingested"] == 5
    assert ingest(client) == 5
    assert ingest(client) == 2
    assert not engine.status["catching_up"]
    assert engine.status["last_seq"] == 12
    assert engine.status["events_ingested"] == 12


# -- detection & correlation -------------------------------------------------

def test_compromised_vendor_scenario_end_to_end(client, sim, factory):
    sim.events = factory.compromised_vendor()
    ingest(client)

    rules = {a["rule_id"] for a in client.get("/api/alerts").json()}
    assert {"GW-R01", "GW-R02", "GW-R03", "GW-R04", "GW-R05", "GW-R06", "GW-R07", "GW-R08"} <= rules

    incidents = client.get("/api/incidents").json()
    assert len(incidents) == 1, incidents
    incident = incidents[0]
    assert incident["severity"] == "critical"
    assert {"Initial Access", "Discovery", "Credential Access", "Defense Evasion", "Collection"} <= set(
        incident["tactics"])
    assert {"VPN-GW-01", "CAM-01", "NVR-01", "ACS-03"} <= set(incident["devices"])

    detail = client.get(f"/api/incidents/{incident['incident_id']}").json()
    times = [e["occurred_at"] for e in detail["timeline"]]
    assert times == sorted(times) and len(detail["timeline"]) >= 15
    assert all(a["mitre"] for a in detail["alerts"] if a["source"] == "rule")

    devices = {d["device_id"]: d for d in client.get("/api/devices").json()}
    assert devices["CAM-01"]["security_state"] == "compromised"
    assert devices["CAM-05"]["security_state"] == "normal"


def test_repeated_failures_are_one_alert_not_many(client, factory):
    events = [factory.make("CAM-02", "auth_login", "failure", user="admin") for _ in range(20)]
    client.app_state.pipeline.process(events)
    brute = [a for a in client.get("/api/alerts").json() if a["rule_id"] == "GW-R01"]
    assert len(brute) == 1 and len(brute[0]["event_ids"]) >= 5


def test_baseline_noise_raises_no_rule_alerts(client, factory):
    rng = random.Random(1)
    events = []
    for _ in range(200):
        device = rng.choice(["CAM-02", "CAM-03", "NVR-02"])
        outcome = "failure" if rng.random() < 0.05 else "success"
        events.append(factory.make(device, "auth_login", outcome, ip=f"10.20.10.{rng.randint(10, 29)}",
                                   user="operator.popa", origin="synthetic", advance=20))
    client.app_state.pipeline.process(events)
    assert [a for a in client.get("/api/alerts").json() if a["source"] == "rule"] == []


def test_resolving_incident_closes_alerts_and_restores_state(client, sim, factory):
    sim.events = factory.compromised_vendor()
    ingest(client)
    incident_id = client.get("/api/incidents").json()[0]["incident_id"]
    assert client.patch(f"/api/incidents/{incident_id}", json={"status": "resolved"}).json()["status"] == "resolved"
    assert client.get("/api/alerts?status=open").json() == []
    assert client.get("/api/overview").json()["incidents_open"] == 0
    assert client.patch(f"/api/incidents/{incident_id}", json={"status": "bogus"}).status_code == 422


def test_isolate_action_calls_simulator_and_contains(client, sim, factory):
    sim.events = factory.compromised_vendor()
    ingest(client)
    incident_id = client.get("/api/incidents").json()[0]["incident_id"]
    resp = client.post(f"/api/incidents/{incident_id}/actions", json={"action": "isolate_device", "device_id": "CAM-01"})
    assert resp.status_code == 200 and sim.isolated == ["CAM-01"]
    assert resp.json()["incident"]["status"] == "contained"
    assert client.post(f"/api/incidents/{incident_id}/actions",
                       json={"action": "isolate_device", "device_id": "CAM-07"}).status_code == 400


# -- ML ----------------------------------------------------------------------

def test_saved_model_artifact_loads():
    detector = AnomalyDetector(settings.model_path)
    assert detector.loaded and detector.version.startswith("iforest")


def test_model_separates_baseline_from_attack():
    detector = AnomalyDetector(settings.model_path)
    baseline = synthetic_baseline(hours=2, seed=7)
    scores = [s.score for s in map(detector.score, baseline) if s]
    false_positive_rate = np.mean([s >= detector.threshold for s in scores])
    assert false_positive_rate < 0.005

    detector.reset()
    attack = [Event.model_validate(e) for e in EventFactory().compromised_vendor()]
    flagged = {e.device_id for e in attack if (s := detector.score(e)) and s.is_anomaly}
    assert {"CAM-01", "NVR-01"} <= flagged


def test_ml_alerts_attach_to_incident_by_entity(client, sim, factory):
    sim.events = factory.compromised_vendor()
    ingest(client)
    ml = [a for a in client.get("/api/alerts").json() if a["source"] == "ml"]
    assert ml and all(a["incident_id"] for a in ml)
    assert all(a["score"] >= client.app_state.pipeline.detector.threshold for a in ml)
    assert any(d["ml"] for d in client.get("/api/devices").json() if d["device_id"] == "CAM-01")
    assert ATTACKER in client.get("/api/incidents").json()[0]["entities"]["ips"]


def test_http_brute_force_on_cam01_opens_incident_with_only_evidence(client, sim, factory):
    """The primary demo path: observed_http logins against CAM-01, interleaved with routine traffic."""
    events = []
    for _ in range(6):
        events.append(factory.make("CAM-01", "auth_login", "failure", ip="127.0.0.1", user="admin",
                                   origin="observed_http", advance=2))
        events.append(factory.make("CAM-01", "stream_status", ip="10.20.1.11", origin="synthetic", advance=0.5))
    events.append(factory.make("CAM-01", "auth_login", ip="127.0.0.1", user="admin", origin="observed_http"))
    events += [factory.make("CAM-01", "stream_status", ip="10.20.1.11", origin="synthetic", advance=5)
               for _ in range(3)]
    sim.events = events
    ingest(client)

    incidents = client.get("/api/incidents").json()
    assert len(incidents) == 1 and incidents[0]["devices"] == ["CAM-01"]
    detail = client.get(f"/api/incidents/{incidents[0]['incident_id']}").json()
    assert {"GW-R01", "GW-R02"} <= {a["rule_id"] for a in detail["alerts"]}
    assert {e["event_type"] for e in detail["timeline"]} == {"auth_login"}
    cam = next(d for d in client.get("/api/devices").json() if d["device_id"] == "CAM-01")
    assert cam["security_state"] == "compromised"
