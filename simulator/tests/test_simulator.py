import time
from datetime import datetime

from conftest import ADMIN, all_events

CONTRACT_FIELDS = {
    "event_id", "run_id", "seq", "occurred_at", "device_id", "event_type",
    "outcome", "origin", "source", "target", "details",
}


def test_registry_has_15_devices_in_4_zones(client):
    devices = client.get("/sim/devices").json()
    assert len(devices) == 15
    assert {d["zone"] for d in devices} == {"terminal", "airside", "perimeter", "operations"}
    types = [d["type"] for d in devices]
    assert types.count("camera") == 8
    assert types.count("nvr") == 2
    assert types.count("access_control") == 3
    assert {"IOT-GW-01", "VPN-GW-01"} <= {d["device_id"] for d in devices}
    assert all(d["status"] == "online" for d in devices)


def test_baseline_events_follow_contract(client, sim):
    for second in range(40):
        sim.baseline.tick(now=float(second))
    events = all_events(client)
    assert events, "baseline should produce events"
    for event in events:
        assert set(event) == CONTRACT_FIELDS
        assert event["origin"] == "synthetic"
        assert event["outcome"] in {"success", "failure", "info"}
        assert set(event["source"]) == {"ip", "user", "zone"}
        assert set(event["target"]) == {"ip", "port", "service"}
        assert event["occurred_at"].endswith("Z")
        datetime.fromisoformat(event["occurred_at"].replace("Z", "+00:00"))
    assert {"heartbeat"} <= {e["event_type"] for e in events}


def test_seq_is_monotonic_and_cursor_paging_works(client, sim):
    for second in range(30):
        sim.baseline.tick(now=float(second))
    events = all_events(client)
    seqs = [e["seq"] for e in events]
    assert seqs == list(range(1, len(seqs) + 1))

    first = client.get("/sim/events", params={"after_seq": 0, "limit": 5}).json()
    assert [e["seq"] for e in first["events"]] == [1, 2, 3, 4, 5]
    assert first["last_seq"] == 5
    rest = client.get("/sim/events", params={"after_seq": first["last_seq"]}).json()
    assert rest["events"][0]["seq"] == 6
    empty = client.get("/sim/events", params={"after_seq": seqs[-1]}).json()
    assert empty["events"] == [] and empty["last_seq"] == seqs[-1]


def test_new_run_resets_sequence(client):
    old_run = client.get("/sim/health").json()["run_id"]
    client.post("/sim/scenario/start", json={"mode": "LIVE"}, headers=ADMIN)
    client.post("/sim/scenario/step", headers=ADMIN)
    run = client.post("/sim/runs", headers=ADMIN).json()
    assert run["run_id"] != old_run
    assert client.get("/sim/health").json()["run_id"] == run["run_id"]
    assert all_events(client) == []
    old = client.get("/sim/events", params={"run_id": old_run}).json()["events"]
    assert old and old[0]["run_id"] == old_run
    runs = client.get("/sim/runs").json()
    assert {r["run_id"] for r in runs} >= {old_run, run["run_id"]}


def test_live_scenario_generates_all_seven_stages(client):
    started = client.post("/sim/scenario/start", json={"mode": "LIVE"}, headers=ADMIN).json()
    assert started["state"] == "paused" and started["current_stage"] == 0
    for n in range(1, 8):
        state = client.post("/sim/scenario/step", headers=ADMIN).json()
        assert state["current_stage"] == n
    assert state["state"] == "completed"
    assert all(s["done"] and not s["blocked"] for s in state["stages"])
    assert client.post("/sim/scenario/step", headers=ADMIN).status_code == 409

    events = [e for e in all_events(client) if e["origin"] == "scenario_generated"]
    stages = {e["details"]["scenario_stage"] for e in events}
    assert stages == set(range(1, 8))

    vpn = next(e for e in events if e["event_type"] == "vpn_session")
    assert vpn["details"]["off_hours"] is True and vpn["source"]["user"].startswith("vendor")
    assert vpn["details"]["assigned_ip"] == "10.20.0.250" and vpn["details"]["session_id"]
    scan = next(e for e in events if e["event_type"] == "network_scan")
    assert len(scan["details"]["targets"]) >= 10
    failures = [e for e in events if e["event_type"] == "auth_login"
                and e["device_id"] == "CAM-01" and e["outcome"] == "failure"]
    assert len(failures) >= 8 and all(e["source"]["ip"] == "10.20.0.250" for e in failures)
    changes = {e["details"]["change"] for e in events if e["event_type"] == "config_change"}
    assert {"stream_disabled", "motion_detection_off"} <= changes
    assert sum(e["event_type"] == "recording_export" for e in events) >= 3
    badges = [e for e in events if e["event_type"] == "badge_access"]
    assert {e["device_id"] for e in badges} == {"ACS-01", "ACS-03"}
    assert len({e["details"]["badge_id"] for e in badges}) == 1
    assert {"recording_delete", "log_cleared"} <= {e["event_type"] for e in events}


def test_auto_scenario_completes(client):
    client.post("/sim/scenario/start", json={"mode": "AUTO"}, headers=ADMIN)
    deadline = time.time() + 5
    while time.time() < deadline:
        state = client.get("/sim/scenario").json()
        if state["state"] == "completed":
            break
        time.sleep(0.02)
    assert state["state"] == "completed" and state["mode"] == "AUTO"
    assert client.get("/sim/runs").json()[0]["mode"] == "AUTO"


def test_cam01_login_failure_and_success_are_observed(client):
    bad = client.post("/devices/CAM-01/login", json={"username": "admin", "password": "x"})
    assert bad.status_code == 401
    good = client.post("/devices/CAM-01/login", json={"username": "admin", "password": "Cam3ra!2026"})
    assert good.status_code == 200
    token = good.json()["session"]

    assert client.get("/devices/CAM-01/snapshot").status_code == 401
    snap = client.get("/devices/CAM-01/snapshot", headers={"Authorization": f"Bearer {token}"})
    assert snap.status_code == 200 and snap.json()["image"].startswith("data:image/svg+xml")

    observed = [e for e in all_events(client) if e["origin"] == "observed_http"]
    logins = [e for e in observed if e["event_type"] == "auth_login"]
    assert [e["outcome"] for e in logins] == ["failure", "success"]
    assert all(e["source"]["ip"] == "testclient" for e in observed)
    snapshots = [e for e in observed if e["event_type"] == "snapshot_access"]
    assert [e["outcome"] for e in snapshots] == ["failure", "success"]


def test_acs03_badge_check(client):
    granted = client.post("/devices/ACS-03/badge", json={"badge_id": "B-10420"}).json()
    denied = client.post("/devices/ACS-03/badge", json={"badge_id": "B-99999"}).json()
    assert granted["result"] == "granted" and denied["result"] == "denied"
    badges = [e for e in all_events(client) if e["event_type"] == "badge_access"]
    assert [e["outcome"] for e in badges] == ["success", "failure"]
    assert all({"badge_id", "door", "restricted", "holder"} <= set(e["details"]) for e in badges)


def test_admin_token_is_enforced(client):
    assert client.post("/sim/runs").status_code == 401
    assert client.post("/sim/scenario/start", json={"mode": "AUTO"},
                       headers={"X-Admin-Token": "wrong"}).status_code == 401
    assert client.post("/sim/devices/CAM-01/isolate", json={"isolated": True}).status_code == 401
    assert client.post("/sim/baseline", json={"enabled": False}).status_code == 401
    # Read endpoints stay open.
    assert client.get("/sim/events").status_code == 200
    assert client.get("/sim/scenario").status_code == 200


def test_isolation_blocks_services_baseline_and_scenario(client, sim):
    response = client.post("/sim/devices/CAM-01/isolate", json={"isolated": True}, headers=ADMIN)
    assert response.json()["status"] == "isolated"
    assert client.post("/devices/CAM-01/login",
                       json={"username": "admin", "password": "Cam3ra!2026"}).status_code == 403

    for second in range(60):
        sim.baseline.tick(now=float(second))
    cam_events = [e for e in all_events(client) if e["device_id"] == "CAM-01"]
    assert len(cam_events) == 1
    assert cam_events[0]["event_type"] == "config_change"
    assert cam_events[0]["details"]["change"] == "device_isolated"

    client.post("/sim/scenario/start", json={"mode": "LIVE"}, headers=ADMIN)
    for _ in range(7):
        state = client.post("/sim/scenario/step", headers=ADMIN).json()
    blocked = {s["n"] for s in state["stages"] if s["blocked"]}
    assert blocked == {3, 4}

    client.post("/sim/devices/CAM-01/isolate", json={"isolated": False}, headers=ADMIN)
    assert client.get("/sim/devices").json()[0]["status"] == "online"


def test_baseline_toggle(client, sim):
    result = client.post("/sim/baseline", json={"enabled": False, "rate": 2}, headers=ADMIN).json()
    assert result == {"enabled": False, "rate": 2.0}
    assert client.get("/sim/health").json()["baseline"]["enabled"] is False


def test_control_panel_is_served(client):
    response = client.get("/panel/")
    assert response.status_code == 200
    assert "Panou de control simulator" in response.text
