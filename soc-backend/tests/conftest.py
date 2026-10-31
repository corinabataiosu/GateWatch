import sys
import uuid
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any

import pytest
from fastapi.testclient import TestClient

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from app.config import Settings  # noqa: E402
from app.main import create_app  # noqa: E402

DEVICES = (
    [{"device_id": f"CAM-0{i}", "type": "camera", "zone": "terminal", "ip": f"10.20.1.{10 + i}",
      "name": f"Camera {i}", "status": "online", "last_seen": None} for i in range(1, 9)]
    + [{"device_id": d, "type": t, "zone": "operations", "ip": ip, "name": d, "status": "online", "last_seen": None}
       for d, t, ip in [("NVR-01", "nvr", "10.20.2.21"), ("NVR-02", "nvr", "10.20.2.22"),
                        ("ACS-01", "access_control", "10.20.3.31"), ("ACS-02", "access_control", "10.20.3.32"),
                        ("ACS-03", "access_control", "10.20.3.33"), ("IOT-GW-01", "iot_gateway", "10.20.0.2"),
                        ("VPN-GW-01", "vpn_gateway", "10.20.0.1")]]
)

ATTACKER = "10.20.0.250"


class EventFactory:
    """Builds contract-compliant events with a monotonic seq for one run."""

    def __init__(self, run_id: str = "run-test"):
        self.run_id = run_id
        self.seq = 0
        self.clock = datetime(2026, 10, 31, 1, 0, tzinfo=timezone.utc)

    def make(self, device_id: str, event_type: str, outcome: str = "success", *, ip: str = ATTACKER,
             user: str | None = None, origin: str = "scenario_generated", advance: float = 1.0,
             **details: Any) -> dict[str, Any]:
        self.seq += 1
        self.clock += timedelta(seconds=advance)
        return {
            "event_id": str(uuid.uuid4()), "run_id": self.run_id, "seq": self.seq,
            "occurred_at": self.clock.strftime("%Y-%m-%dT%H:%M:%S.000Z"), "device_id": device_id,
            "event_type": event_type, "outcome": outcome, "origin": origin,
            "source": {"ip": ip, "user": user, "zone": None},
            "target": {"ip": None, "port": 443, "service": "https"}, "details": details,
        }

    def compromised_vendor(self) -> list[dict[str, Any]]:
        """The seven stages of the 'Compromised Vendor' scenario (docs/contracts.md §4)."""
        ev = [self.make("VPN-GW-01", "vpn_session", ip="185.220.101.47", user="vendor.hikserv",
                        off_hours=True, local_hour=3, assigned_ip=ATTACKER, session_id="vpn-1")]
        ev.append(self.make("IOT-GW-01", "network_scan", "info", targets=[d["ip"] for d in DEVICES[:10]],
                            ports=[80, 443, 554]))
        ev += [self.make("CAM-01", "auth_login", "failure", user="admin", advance=2) for _ in range(8)]
        ev.append(self.make("CAM-01", "auth_login", "success", user="admin"))
        ev.append(self.make("CAM-01", "config_change", user="admin", change="motion_detection_off"))
        ev.append(self.make("CAM-01", "config_change", user="admin", change="stream_disabled"))
        ev.append(self.make("NVR-01", "auth_login", user="admin"))
        ev += [self.make("NVR-01", "recording_export", user="admin", recording_id=f"REC-{i}", size_mb=300)
               for i in range(4)]
        ev.append(self.make("ACS-01", "badge_access", ip="10.20.3.31", badge_id="B-1007", door="D1",
                            restricted=False, holder="Ion Popescu"))
        ev.append(self.make("ACS-03", "badge_access", ip="10.20.3.33", badge_id="B-1007", door="SRV-ROOM",
                            restricted=True, holder="Ion Popescu", advance=20))
        ev.append(self.make("NVR-01", "recording_delete", user="admin", recording_id="REC-1"))
        ev.append(self.make("NVR-01", "log_cleared", user="admin"))
        return ev


class FakeSimulator:
    def __init__(self, run_id: str = "run-test"):
        self.run_id = run_id
        self.events: list[dict[str, Any]] = []
        self.isolated: list[str] = []
        self.up = True

    def get(self, path: str) -> Any:
        if not self.up:
            raise OSError("connection refused")
        if path.startswith("/sim/health"):
            return {"status": "ok", "run_id": self.run_id}
        if path.startswith("/sim/devices"):
            return [{**d, "status": "isolated" if d["device_id"] in self.isolated else d["status"]}
                    for d in DEVICES]
        if path.startswith("/sim/events"):
            query = dict(p.split("=") for p in path.split("?", 1)[1].split("&"))
            after, limit = int(query["after_seq"]), int(query["limit"])
            page = [e for e in self.events if e["run_id"] == query["run_id"] and e["seq"] > after][:limit]
            return {"run_id": query["run_id"], "events": page, "last_seq": page[-1]["seq"] if page else after}
        raise AssertionError(path)

    def post(self, path: str, body: dict[str, Any]) -> Any:
        device_id = path.split("/")[3]
        if body["isolated"]:
            self.isolated.append(device_id)
        return {"device_id": device_id, "status": "isolated"}


@pytest.fixture
def sim() -> FakeSimulator:
    return FakeSimulator()


@pytest.fixture
def factory() -> EventFactory:
    return EventFactory()


@pytest.fixture
def client(tmp_path, sim):
    settings = Settings(db_path=str(tmp_path / "soc.sqlite3"), ingestion_enabled=False, page_size=5)
    app = create_app(settings, client=sim)
    with TestClient(app) as test_client:
        test_client.app_state = app.state
        yield test_client
