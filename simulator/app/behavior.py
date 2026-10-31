"""Behavior engine: synthetic baseline traffic for all online devices."""
from __future__ import annotations

import random
import secrets
import threading
import time
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from .state import Simulator

STAFF = [
    ("andrei.ionescu", "10.20.5.21"),
    ("maria.popa", "10.20.5.22"),
    ("radu.stan", "10.20.5.23"),
    ("elena.dumitru", "10.20.5.24"),
    ("operator.noc", "10.20.5.30"),
]
VPN_STAFF = ["it.mihai.georgescu", "it.ana.marin", "noc.oncall"]

_HOLDERS = [
    "Ion Popescu", "Ana Marin", "Mihai Georgescu", "Ioana Radu", "Cristian Stoica",
    "Elena Dumitru", "Andrei Ionescu", "Maria Popa", "Radu Stan", "Diana Matei",
    "Vlad Constantin", "Alina Toma", "George Barbu", "Laura Nistor", "Paul Moldovan",
    "Simona Iliescu", "Dan Preda", "Bianca Ene", "Florin Lazar", "Irina Voicu",
]
# 20 staff badges; the first five also hold operations (restricted) clearance. Each holder works
# in one area and badges at that area's reader, so a badge seen at two readers seconds apart is
# genuinely suspicious (the SOC's impossible-travel rule relies on this).
_HOME_READERS = ["ACS-01", "ACS-02"]
STAFF_BADGES = [
    {"badge_id": f"B-{10420 + i}", "holder": holder, "operations": i < 5,
     "reader": "ACS-03" if i < 5 else _HOME_READERS[i % 2]}
    for i, holder in enumerate(_HOLDERS)
]

DOORS = {
    "ACS-01": [("Terminal — intrare personal", False), ("Terminal — acces poartă îmbarcare", False)],
    "ACS-02": [("Platformă — poartă handling", False), ("Platformă — hangar", False)],
    "ACS-03": [("Operațiuni — sală servere OPS-2", True), ("Operațiuni — dispecerat", False)],
}


class BaselineEngine:
    def __init__(self, sim: "Simulator") -> None:
        self.sim = sim
        self.enabled = sim.settings.baseline_enabled
        self.rate = sim.settings.baseline_rate
        self._rng = random.Random()
        self._thread: threading.Thread | None = None
        self._stop = threading.Event()
        self._next_heartbeat: dict[str, float] = {}
        self._next_stream: dict[str, float] = {}

    def reset(self) -> None:
        self._next_heartbeat.clear()
        self._next_stream.clear()

    def configure(self, enabled: bool, rate: float | None = None) -> None:
        self.enabled = enabled
        if rate is not None:
            self.rate = max(0.1, min(rate, 10.0))

    # --- thread lifecycle -------------------------------------------------
    def start(self) -> None:
        if self._thread and self._thread.is_alive():
            return
        self._stop.clear()
        self._thread = threading.Thread(target=self._loop, name="baseline", daemon=True)
        self._thread.start()

    def shutdown(self) -> None:
        self._stop.set()
        if self._thread:
            self._thread.join(timeout=2)

    def _loop(self) -> None:
        while not self._stop.wait(1.0):
            if self.enabled:
                try:
                    self.tick()
                except Exception:  # keep the generator alive on transient errors
                    pass

    # --- generation -------------------------------------------------------
    def tick(self, now: float | None = None) -> None:
        """Emit one second's worth of baseline traffic."""
        now = time.monotonic() if now is None else now
        rng = self._rng
        interval = self.sim.settings.heartbeat_interval / self.rate
        active = [d for d in self.sim.registry.all() if d.status == "online"]

        for device in active:
            due = self._next_heartbeat.setdefault(
                device.device_id, now + rng.uniform(0, interval)
            )
            if now >= due:
                self._next_heartbeat[device.device_id] = now + interval * rng.uniform(0.9, 1.1)
                self._heartbeat(device)
            if device.type == "camera" and device.stream_ok:
                due = self._next_stream.setdefault(device.device_id, now + rng.uniform(0, 3 * interval))
                if now >= due:
                    self._next_stream[device.device_id] = now + 3 * interval
                    self.sim.emit(
                        device, "stream_status", "success", "synthetic",
                        source={"ip": device.ip, "user": None, "zone": device.zone},
                        details={"state": "up", "fps": rng.choice([15, 20, 25]), "bitrate_kbps": rng.randint(1800, 4200)},
                    )

        if rng.random() < 0.05 * self.rate:
            self._staff_login(active)
        if rng.random() < 0.08 * self.rate:
            self._badge_access(active)
        if rng.random() < 0.01 * self.rate:
            self._staff_vpn()

    def _heartbeat(self, device) -> None:
        self.sim.emit(
            device, "heartbeat", "info", "synthetic",
            source={"ip": device.ip, "user": None, "zone": device.zone},
            details={"cpu_pct": self._rng.randint(4, 35), "uptime_s": self._rng.randint(10_000, 900_000)},
        )
        # Normal profile used by the SOC's virtual-flow thresholds (100 pps, 64 KB/s).
        destination = self.sim.registry.get("NVR-01" if device.type == "camera" else "IOT-GW-01")
        if destination.status == "online" and destination != device:
            from datetime import datetime, timedelta, timezone
            end = datetime.now(timezone.utc)
            self.sim.emit(device, "network_flow", "info", "synthetic",
                source={"ip": device.ip, "zone": device.zone},
                target={"ip": destination.ip, "port": 554 if device.type == "camera" else 8883,
                        "service": "rtsp" if device.type == "camera" else "mqtt"},
                details={"interval_start": (end - timedelta(seconds=1)).isoformat(),
                         "interval_end": end.isoformat(), "duration_s": 1, "packet_count": 100,
                         "packets_per_second": 100, "total_bytes": 64000, "bytes_per_second": 64000,
                         "direction": "internal"})

    def _staff_login(self, active) -> None:
        targets = [d for d in active if d.type in ("camera", "nvr")]
        if not targets:
            return
        device = self._rng.choice(targets)
        user, ip = self._rng.choice(STAFF)
        source = {"ip": ip, "user": user, "zone": "operations"}
        self.sim.emit(device, "auth_login", "success", "synthetic", source=source,
                      details={"username": user, "method": "web"})
        if device.type == "nvr" and self._rng.random() < 0.5:
            self.sim.emit(device, "recording_access", "success", "synthetic", source=source,
                          details={"recording_id": f"REC-{self._rng.randint(1000, 9999)}",
                                   "camera": f"CAM-0{self._rng.randint(1, 8)}"})

    def _badge_access(self, active) -> None:
        readers = {d.device_id: d for d in active if d.type == "access_control"}
        pool = [b for b in STAFF_BADGES if b["reader"] in readers]
        if not pool:
            return
        badge = self._rng.choice(pool)
        device = readers[badge["reader"]]
        door, restricted = self._rng.choice(DOORS[device.device_id])
        self.sim.emit(
            device, "badge_access", "success", "synthetic",
            source={"ip": device.ip, "user": badge["holder"], "zone": device.zone},
            details={"badge_id": badge["badge_id"], "door": door, "restricted": restricted,
                     "holder": badge["holder"]},
        )

    def _staff_vpn(self) -> None:
        device = self.sim.registry.get("VPN-GW-01")
        if device is None or device.status != "online":
            return
        user = self._rng.choice(VPN_STAFF)
        self.sim.emit(
            device, "vpn_session", "success", "synthetic",
            source={"ip": f"86.120.{self._rng.randint(1, 254)}.{self._rng.randint(1, 254)}",
                    "user": user, "zone": None},
            details={"off_hours": False, "local_hour": self._rng.randint(8, 17),
                     "assigned_ip": f"10.20.0.{self._rng.randint(100, 120)}",
                     "session_id": f"VPN-{secrets.token_hex(4)}", "client": "OpenVPN"},
        )
