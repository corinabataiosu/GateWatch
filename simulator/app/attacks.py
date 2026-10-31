"""Bounded virtual observations only. No sockets, credentials or real payloads."""
from datetime import datetime, timedelta, timezone
from ipaddress import ip_address, ip_network
import threading
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator

from .store import utc_now

CATALOG = [
    {"id": "brute_force", "name": "Repeated Login Attempts / Brute Force", "description": "Simulează autentificări eșuate repetate la serviciul virtual al dispozitivului selectat."},
    {"id": "port_scan", "name": "Port Scanning", "description": "O sursă simulată încearcă să se conecteze la porturi virtuale distincte. Porturile deschise corespund serviciilor dispozitivului."},
    {"id": "dos", "name": "Traffic Flood / DoS", "description": "Simulează un volum ridicat de trafic, cu măsurători pentru fiecare secundă, la rata de pachete configurată."},
    {"id": "unauthorized_access", "name": "Unauthorized Access", "description": "Simulează încercări repetate de acces fără permisiuni la o resursă protejată. Operațiunile sunt refuzate."},
    {"id": "lateral_movement", "name": "Lateral Movement Attempt", "description": "Dispozitivul sursă selectat încearcă să comunice cu un alt dispozitiv intern printr-o legătură interzisă de politica rețelei virtuale."},
    {"id": "exfiltration", "name": "Data Exfiltration Attempt", "description": "Simulează transferul unui volum mare de date către o destinație externă fictivă, neaprobată. Nu sunt accesate sau transferate date reale."},
]
TEST_NETWORKS = [ip_network(n) for n in ("192.0.2.0/24", "198.51.100.0/24", "203.0.113.0/24")]


class AttackRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    execution_id: UUID
    device_id: str
    attack: Literal["brute_force", "port_scan", "dos", "unauthorized_access", "lateral_movement", "exfiltration"]
    external_ip: str = "198.51.100.24"
    destination_device_id: str | None = None
    direction: Literal["inbound", "outbound"] = "inbound"
    count: int = Field(default=12, ge=5, le=64)
    duration_s: int = Field(default=10, ge=3, le=30)
    packets_per_second: int = Field(default=5000, ge=1000, le=50000)
    bytes_per_second: int = Field(default=2000000, ge=1000000, le=10000000)
    port: int | None = Field(default=None, ge=1, le=65535)

    @field_validator("external_ip")
    @classmethod
    def test_address(cls, value):
        address = ip_address(value)
        if not any(address in network for network in TEST_NETWORKS):
            raise ValueError("Folosește o adresă IPv4 fictivă TEST-NET (192.0.2.x, 198.51.100.x sau 203.0.113.x).")
        return str(address)


def permitted(source, target, port):
    """Allow-list: camera streams, gateway telemetry and VPN management only."""
    return (source.type == "camera" and target.type == "nvr" and port in (443, 554)
            or source.type == "iot_gateway" and port == 8883 and source != target
            or source.type == "vpn_gateway" and target.type == "iot_gateway" and port == 443)


class AttackEngine:
    def __init__(self, sim):
        self.sim = sim
        self.lock = threading.RLock()

    def execute(self, request: AttackRequest):
        with self.lock:
            return self._execute(request)

    def _execute(self, r):
        sim = self.sim
        body = r.model_dump(mode="json")
        existing = sim.store.get_execution(str(r.execution_id))
        if existing:
            if existing[0] != body:
                raise ValueError("Identificatorul execuției a fost deja folosit cu alte setări.")
            return existing[1]
        device = sim.registry.get(r.device_id)
        if not device or device.status != "online":
            raise ValueError("Selectează un dispozitiv virtual conectat.")
        if sim.scenario.state in ("running", "paused"):
            raise ValueError("Oprește scenariul anterior înainte de a executa un atac independent.")
        if r.attack == "exfiltration" and device.type == "access_control":
            raise ValueError("Controlerele de acces nu acceptă profilul de transfer masiv de date.")
        destination = device
        port = r.port or device.port
        if r.attack == "lateral_movement":
            destination = sim.registry.get(r.destination_device_id)
            if not destination or destination == device or destination.status != "online":
                raise ValueError("Selectează un alt dispozitiv intern conectat ca destinație.")
            port = r.port or destination.port
            if permitted(device, destination, port):
                raise ValueError("Această legătură este permisă de politică. Selectează o destinație sau un port interzis.")
        outbound = r.attack in ("lateral_movement", "exfiltration") or r.attack == "dos" and r.direction == "outbound"
        src = device.ip if outbound else r.external_ip
        dst = destination.ip if r.attack == "lateral_movement" else r.external_ip if outbound else device.ip
        result = {"execution_id": str(r.execution_id), "run_id": sim.store.current_run_id,
                  "attack": r.attack, "device_id": device.device_id, "source_ip": src, "destination_ip": dst,
                  "started_at": utc_now(), "completed_at": None, "status": "running",
                  "event_count": 0, "packet_count": 0, "total_bytes": 0, "errors": [],
                  "summary": {}, "time_model": "compressed virtual time; no network traffic"}
        sim.store.save_execution(body, result)
        clock = datetime.now(timezone.utc) - timedelta(seconds=r.duration_s)
        result.update(virtual_started_at=clock.isoformat(),
                      virtual_completed_at=(clock + timedelta(seconds=r.duration_s)).isoformat(),
                      virtual_duration_s=r.duration_s)
        def emit(kind, outcome, index, details, target_port=port):
            event = sim.emit(device, kind, outcome, "scenario_generated",
                source={"ip": src, "zone": device.zone if outbound else "external"},
                target={"ip": dst, "port": target_port, "service": {80: "http", 443: "https", 554: "rtsp", 8883: "mqtt"}.get(target_port, "tcp")},
                details={"execution_id": str(r.execution_id), "virtual_offset_s": index,
                         "virtual_occurred_at": (clock + timedelta(seconds=index)).isoformat(),
                         "simulated": True, **details})
            result["event_count"] += 1
            result["packet_count"] += details.get("packet_count", 1)
            result["total_bytes"] += details.get("total_bytes", 0)
            result["summary"][kind] = result["summary"].get(kind, 0) + 1
            return event
        try:
            if r.attack in ("dos", "exfiltration"):
                for i in range(r.duration_s):
                    size = r.packets_per_second * 1024 if r.attack == "dos" else r.bytes_per_second
                    packets = r.packets_per_second if r.attack == "dos" else (size + 1023) // 1024
                    emit("network_flow", "info", i, {
                        "interval_start": (clock + timedelta(seconds=i)).isoformat(),
                        "interval_end": (clock + timedelta(seconds=i + 1)).isoformat(),
                        "duration_s": 1, "packet_count": packets, "packets_per_second": packets,
                        "total_bytes": size, "bytes_per_second": size,
                        "direction": "outbound" if outbound else "inbound",
                        "baseline_packets_per_second": 100, "baseline_bytes_per_second": 64000,
                    })
            elif r.attack == "port_scan":
                ports = list(dict.fromkeys([device.port, 22, 80, 443, 554, 8000, 8080, 21, 23, 25, 53, 110] + list(range(10000, 10064))))[:r.count]
                for i, scanned in enumerate(ports):
                    emit("connection_attempt", "success" if scanned == device.port else "failure",
                         i * r.duration_s / r.count, {"connection_result": "open" if scanned == device.port else "closed"}, scanned)
            else:
                resources = {"camera": "/protected/config", "nvr": "/recordings", "access_control": "/doors/unlock",
                             "iot_gateway": "/management/routes", "vpn_gateway": "/management/sessions"}
                for i in range(r.count):
                    details = {"attempt": i + 1}
                    kind = "auth_login"
                    if r.attack == "brute_force":
                        details.update(username="demo.operator", method="virtual_service", reason="invalid_credentials")
                    elif r.attack == "unauthorized_access":
                        kind = "access_denied"
                        details.update(resource=resources[device.type], operation="write", authorization="denied")
                    else:
                        kind = "connection_attempt"
                        details.update(source_device_id=device.device_id, destination_device_id=destination.device_id,
                                       policy_decision="deny", policy="airport-allowlist-v1")
                    emit(kind, "failure", i * r.duration_s / r.count, details)
            result["status"] = "completed"
        except Exception as exc:
            result["status"] = "failed"
            result["errors"].append(str(exc))
        result["completed_at"] = utc_now()
        sim.store.save_execution(body, result)
        return result
