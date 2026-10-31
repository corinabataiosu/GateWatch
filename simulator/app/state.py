"""Simulator container wiring the registry, store and engines together."""
from __future__ import annotations

from .config import Settings
from .devices import Device, DeviceRegistry
from .events import make_event
from .store import EventStore

SOC_RESPONDER = {"ip": "10.20.9.10", "user": "soc.responder", "zone": "operations"}


class Simulator:
    def __init__(self, settings: Settings) -> None:
        from .behavior import BaselineEngine
        from .scenario import ScenarioEngine
        from .attacks import AttackEngine

        self.settings = settings
        self.registry = DeviceRegistry()
        self.store = EventStore(settings.db_path)
        if self.store.current_run_id is None:
            self.store.start_run()
        self.baseline = BaselineEngine(self)
        self.scenario = ScenarioEngine(self)
        self.attacks = AttackEngine(self)
        # Bearer sessions for the interactive services: token -> (device_id, user).
        self.sessions: dict[str, tuple[str, str]] = {}

    def emit(
        self,
        device: Device | str,
        event_type: str,
        outcome: str,
        origin: str,
        *,
        source: dict,
        details: dict | None = None,
        target: dict | None = None,
    ) -> dict:
        if isinstance(device, str):
            device = self.registry.get(device)
        event = make_event(
            device_id=device.device_id,
            event_type=event_type,
            outcome=outcome,
            origin=origin,
            source=source,
            target=target or {"ip": device.ip, "port": device.port, "service": device.service},
            details=details,
        )
        stored = self.store.append(event)
        self.registry.touch(device.device_id, stored["occurred_at"])
        return stored

    def new_run(self) -> dict:
        with self.attacks.lock:
            return self._new_run()

    def _new_run(self) -> dict:
        self.scenario.stop()
        self.scenario.reset()
        self.registry.reset()
        self.sessions.clear()
        self.baseline.reset()
        return self.store.start_run()

    def set_isolated(self, device_id: str, isolated: bool) -> Device:
        device = self.registry.get(device_id)
        self.registry.set_status(device_id, "isolated" if isolated else "online")
        if isolated:
            self.sessions = {t: s for t, s in self.sessions.items() if s[0] != device_id}
        # The single event an isolated device still produces.
        self.emit(
            device, "config_change", "info", "synthetic",
            source=SOC_RESPONDER,
            details={
                "change": "device_isolated" if isolated else "device_restored",
                "isolated": isolated,
            },
        )
        return device
