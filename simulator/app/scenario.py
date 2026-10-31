"""Scenario engine: the 7-stage "Compromised Vendor" attack (AUTO / LIVE)."""
from __future__ import annotations

import secrets
import threading
from dataclasses import dataclass
from typing import TYPE_CHECKING, Callable

if TYPE_CHECKING:
    from .state import Simulator

ATTACKER_EXT_IP = "185.220.101.47"
ATTACKER_INT_IP = "10.20.0.250"
VENDOR_USER = "vendor.hikserv"
CLONED_BADGE = {"badge_id": "B-10421", "holder": "Ana Marin"}
SCENARIO_NAME = "Compromised Vendor"

_ATTACKER = {"ip": ATTACKER_INT_IP, "user": None, "zone": None}


@dataclass
class Stage:
    n: int
    name: str
    description: str
    mitre: dict
    run: Callable[["Simulator", dict], None]
    done: bool = False
    blocked: bool = False

    def to_dict(self) -> dict:
        return {
            "n": self.n, "name": self.name, "description": self.description,
            "mitre": self.mitre, "done": self.done, "blocked": self.blocked,
        }


def _reachable(sim: "Simulator", device_id: str) -> bool:
    device = sim.registry.get(device_id)
    return device is not None and device.status == "online"


def _stage1_vpn(sim: "Simulator", ctx: dict) -> None:
    ctx["session_id"] = f"VPN-{secrets.token_hex(4)}"
    sim.emit(
        "VPN-GW-01", "vpn_session", "success", "scenario_generated",
        source={"ip": ATTACKER_EXT_IP, "user": VENDOR_USER, "zone": None},
        details={"off_hours": True, "local_hour": 3, "assigned_ip": ATTACKER_INT_IP,
                 "session_id": ctx["session_id"], "client": "OpenVPN", "scenario_stage": 1},
    )


def _stage2_scan(sim: "Simulator", ctx: dict) -> None:
    targets = [d.ip for d in sim.registry.all() if d.device_id not in ("VPN-GW-01", "IOT-GW-01")]
    sim.emit(
        "IOT-GW-01", "network_scan", "info", "scenario_generated",
        source={**_ATTACKER, "user": VENDOR_USER},
        target={"ip": "10.20.0.0/16", "port": None, "service": "multiple"},
        details={"targets": targets, "ports": [22, 80, 443, 554, 8000, 8080],
                 "technique": "tcp_syn", "scenario_stage": 2},
    )


def _stage3_bruteforce(sim: "Simulator", ctx: dict) -> None:
    if not _reachable(sim, "CAM-01"):
        ctx["blocked"] = True
        return
    passwords = ["admin", "12345", "password", "admin123", "hikvision", "camera", "root", "Admin2025"]
    for attempt, password in enumerate(passwords, start=1):
        sim.emit(
            "CAM-01", "auth_login", "failure", "scenario_generated",
            source={**_ATTACKER, "user": "admin"},
            details={"username": "admin", "method": "http_basic", "reason": "invalid_password",
                     "attempt": attempt, "scenario_stage": 3},
        )
    sim.emit(
        "CAM-01", "auth_login", "success", "scenario_generated",
        source={**_ATTACKER, "user": "admin"},
        details={"username": "admin", "method": "http_basic", "attempt": len(passwords) + 1,
                 "scenario_stage": 3},
    )


def _stage4_tamper(sim: "Simulator", ctx: dict) -> None:
    if not _reachable(sim, "CAM-01"):
        ctx["blocked"] = True
        return
    source = {**_ATTACKER, "user": "admin"}
    sim.emit("CAM-01", "config_change", "success", "scenario_generated", source=source,
             details={"change": "motion_detection_off", "setting": "motion_detection",
                      "old": "on", "new": "off", "scenario_stage": 4})
    sim.emit("CAM-01", "config_change", "success", "scenario_generated", source=source,
             details={"change": "stream_disabled", "setting": "rtsp_stream",
                      "old": "enabled", "new": "disabled", "scenario_stage": 4})
    sim.registry.get("CAM-01").stream_ok = False
    sim.emit("CAM-01", "stream_status", "failure", "scenario_generated",
             source={"ip": sim.registry.get("CAM-01").ip, "user": None, "zone": "terminal"},
             details={"state": "down", "reason": "disabled_by_config", "scenario_stage": 4})


def _stage5_exfil(sim: "Simulator", ctx: dict) -> None:
    if not _reachable(sim, "NVR-01"):
        ctx["blocked"] = True
        return
    source = {**_ATTACKER, "user": "admin"}
    sim.emit("NVR-01", "auth_login", "success", "scenario_generated", source=source,
             details={"username": "admin", "method": "web", "scenario_stage": 5})
    recordings = [f"REC-CAM01-{2026103100 + i}" for i in range(6)]
    for rid in recordings:
        sim.emit("NVR-01", "recording_access", "success", "scenario_generated", source=source,
                 details={"recording_id": rid, "camera": "CAM-01", "scenario_stage": 5})
    for rid in recordings[:4]:
        sim.emit("NVR-01", "recording_export", "success", "scenario_generated", source=source,
                 details={"recording_id": rid, "camera": "CAM-01", "size_mb": 640,
                          "destination": "185.220.101.47", "scenario_stage": 5})
    ctx["recordings"] = recordings


def _stage6_badge(sim: "Simulator", ctx: dict) -> None:
    holder = CLONED_BADGE["holder"]
    if _reachable(sim, "ACS-01"):
        sim.emit("ACS-01", "badge_access", "success", "scenario_generated",
                 source={"ip": sim.registry.get("ACS-01").ip, "user": holder, "zone": "terminal"},
                 details={"badge_id": CLONED_BADGE["badge_id"], "door": "Terminal — intrare personal",
                          "restricted": False, "holder": holder, "scenario_stage": 6})
    if not _reachable(sim, "ACS-03"):
        ctx["blocked"] = True
        return
    acs3 = sim.registry.get("ACS-03")
    sim.emit("ACS-03", "badge_access", "success", "scenario_generated",
             source={"ip": acs3.ip, "user": holder, "zone": "operations"},
             details={"badge_id": CLONED_BADGE["badge_id"], "door": "Operațiuni — sală servere OPS-2",
                      "restricted": True, "holder": holder, "scenario_stage": 6})
    sim.emit("ACS-03", "door_state", "info", "scenario_generated",
             source={"ip": acs3.ip, "user": None, "zone": "operations"},
             details={"door": "Operațiuni — sală servere OPS-2", "state": "open",
                      "held_open_s": 95, "scenario_stage": 6})


def _stage7_cleanup(sim: "Simulator", ctx: dict) -> None:
    if not _reachable(sim, "NVR-01"):
        ctx["blocked"] = True
        return
    source = {**_ATTACKER, "user": "admin"}
    for rid in ctx.get("recordings", [f"REC-CAM01-{2026103100 + i}" for i in range(6)])[:3]:
        sim.emit("NVR-01", "recording_delete", "success", "scenario_generated", source=source,
                 details={"recording_id": rid, "camera": "CAM-01", "scenario_stage": 7})
    sim.emit("NVR-01", "log_cleared", "success", "scenario_generated", source=source,
             details={"log": "audit", "entries_removed": 1342, "scenario_stage": 7})


def _build_stages() -> list[Stage]:
    def mitre(tid: str, technique: str, tactic: str) -> dict:
        return {"technique_id": tid, "technique": technique, "tactic": tactic}

    return [
        Stage(1, "Autentificare VPN furnizor în afara programului",
              "Contul furnizorului vendor.hikserv se conectează la ora 03:00 de pe un IP extern.",
              mitre("T1133", "External Remote Services", "Initial Access"), _stage1_vpn),
        Stage(2, "Descoperire internă",
              "Scanare de porturi din 10.20.0.250 către echipamentele de securitate.",
              mitre("T1046", "Network Service Discovery", "Discovery"), _stage2_scan),
        Stage(3, "Atac brute force pe CAM-01",
              "8 parole greșite urmate de o autentificare reușită ca admin.",
              mitre("T1110", "Brute Force", "Credential Access"), _stage3_bruteforce),
        Stage(4, "Modificare configurație cameră",
              "Detecția de mișcare este oprită și fluxul video este dezactivat.",
              mitre("T1562", "Impair Defenses", "Defense Evasion"), _stage4_tamper),
        Stage(5, "Acces și export înregistrări NVR",
              "Autentificare pe NVR-01 și export în masă al înregistrărilor CAM-01.",
              mitre("T1005", "Data from Local System", "Collection"), _stage5_exfil),
        Stage(6, "Acces fizic cu ecuson clonat",
              "Același ecuson apare la ACS-01 și, după câteva secunde, la ușa restricționată ACS-03.",
              mitre("T1078", "Valid Accounts", "Persistence"), _stage6_badge),
        Stage(7, "Ștergerea urmelor",
              "Înregistrări șterse și jurnalul de audit golit pe NVR-01.",
              mitre("T1070", "Indicator Removal", "Defense Evasion"), _stage7_cleanup),
    ]


class ScenarioEngine:
    def __init__(self, sim: "Simulator") -> None:
        self.sim = sim
        self._lock = threading.RLock()
        self._stop = threading.Event()
        self._thread: threading.Thread | None = None
        self.reset()

    def reset(self) -> None:
        with self._lock:
            self.stages = _build_stages()
            self.mode: str | None = None
            self.state = "idle"
            self.current_stage = 0
            self._ctx: dict = {}

    def to_dict(self) -> dict:
        with self._lock:
            return {
                "name": SCENARIO_NAME,
                "mode": self.mode,
                "state": self.state,
                "current_stage": self.current_stage,
                "stages": [s.to_dict() for s in self.stages],
            }

    def start(self, mode: str) -> dict:
        self.stop()
        with self._lock:
            self.stages = _build_stages()
            self._ctx = {}
            self.mode = mode
            self.current_stage = 0
            self.state = "running" if mode == "AUTO" else "paused"
            self.sim.store.set_run_mode(mode)
        if mode == "AUTO":
            self._stop.clear()
            self._thread = threading.Thread(target=self._auto_loop, name="scenario", daemon=True)
            self._thread.start()
        return self.to_dict()

    def step(self) -> dict:
        """Execute the next stage (LIVE mode)."""
        with self._lock:
            if self.mode != "LIVE" or self.state not in ("paused", "running"):
                raise RuntimeError("Scenariul nu rulează în modul LIVE.")
            self._run_next()
            if self.state != "completed":
                self.state = "paused"
        return self.to_dict()

    def stop(self) -> None:
        self._stop.set()
        thread = self._thread
        if thread and thread.is_alive() and thread is not threading.current_thread():
            thread.join(timeout=5)
        self._thread = None
        with self._lock:
            if self.state in ("running", "paused"):
                self.state = "idle"

    def _run_next(self) -> None:
        stage = self.stages[self.current_stage]
        self._ctx["blocked"] = False
        stage.run(self.sim, self._ctx)
        stage.blocked = self._ctx["blocked"]
        stage.done = True
        self.current_stage = stage.n
        if self.current_stage >= len(self.stages):
            self.state = "completed"

    def _auto_loop(self) -> None:
        interval = self.sim.settings.scenario_interval
        while not self._stop.is_set():
            with self._lock:
                if self.state != "running":
                    return
                self._run_next()
                if self.state == "completed":
                    return
            if self._stop.wait(interval):
                return
