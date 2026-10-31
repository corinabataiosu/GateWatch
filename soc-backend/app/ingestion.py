"""SOC ingestion engine: cursor-based polling of the simulator events API.

The cursor (last processed ``seq``) is persisted per ``run_id``, so a restarted SOC resumes where
it stopped and never re-processes or skips events. When the simulator starts a new run the
poller follows it automatically. Gaps in ``seq`` are reported; duplicates are dropped by the
pipeline using ``event_id``.
"""
import json
import logging
import threading
import time
import urllib.error
import urllib.request
from typing import Any, Optional

from .config import Settings
from .db import Database
from .models import now_iso
from .pipeline import Pipeline

log = logging.getLogger("gatewatch.ingestion")


class SimulatorClient:
    def __init__(self, base_url: str, admin_token: str, timeout: float = 5.0):
        self.base_url = base_url.rstrip("/")
        self.admin_token = admin_token
        self.timeout = timeout

    def get(self, path: str) -> Any:
        with urllib.request.urlopen(self.base_url + path, timeout=self.timeout) as resp:
            return json.load(resp)

    def post(self, path: str, body: dict[str, Any]) -> Any:
        req = urllib.request.Request(
            self.base_url + path, data=json.dumps(body).encode(), method="POST",
            headers={"Content-Type": "application/json", "X-Admin-Token": self.admin_token},
        )
        with urllib.request.urlopen(req, timeout=self.timeout) as resp:
            return json.load(resp)


class IngestionEngine:
    def __init__(self, settings: Settings, db: Database, pipeline: Pipeline,
                 client: Optional[SimulatorClient] = None):
        self.settings = settings
        self.db = db
        self.pipeline = pipeline
        self.client = client or SimulatorClient(settings.simulator_url, settings.admin_token)
        self.devices: list[dict[str, Any]] = []
        self.status: dict[str, Any] = {
            "connected": False, "run_id": None, "last_seq": 0, "events_ingested": 0,
            "last_poll_at": None, "gaps": 0, "error": None,
        }
        self._stop = threading.Event()
        self._thread: Optional[threading.Thread] = None
        self._last_device_poll = 0.0

    def start(self) -> None:
        self._thread = threading.Thread(target=self._loop, name="soc-ingestion", daemon=True)
        self._thread.start()

    def stop(self) -> None:
        self._stop.set()
        if self._thread:
            self._thread.join(timeout=5)

    def _loop(self) -> None:
        while not self._stop.is_set():
            self.poll_once()
            self._stop.wait(self.settings.poll_interval)

    def poll_once(self) -> int:
        """Fetch and process every new event of the simulator's current run. Returns the count."""
        try:
            health = self.client.get("/sim/health")
            run_id = health.get("run_id")
            if not run_id:
                raise RuntimeError("simulator reports no active run")
            if run_id != self.status["run_id"]:
                log.info("following simulator run %s", run_id)
                self.status["run_id"] = run_id
            processed = self._drain(run_id)
            if time.monotonic() - self._last_device_poll >= self.settings.device_poll_interval or not self.devices:
                self.devices = self.client.get("/sim/devices")
                self._last_device_poll = time.monotonic()
            self.status.update(connected=True, error=None, last_poll_at=now_iso())
            return processed
        except (urllib.error.URLError, OSError, ValueError, RuntimeError) as exc:
            self.status.update(connected=False, error=str(getattr(exc, "reason", exc)), last_poll_at=now_iso())
            return 0

    def _drain(self, run_id: str) -> int:
        cursor = self.db.get_cursor(run_id)
        total = 0
        while True:
            page = self.client.get(
                f"/sim/events?run_id={run_id}&after_seq={cursor}&limit={self.settings.page_size}")
            events = sorted(page.get("events", []), key=lambda e: e.get("seq", 0))
            if not events:
                break
            if events[0].get("seq") != cursor + 1:
                self.status["gaps"] += 1
                log.warning("seq gap in %s: expected %s, got %s", run_id, cursor + 1, events[0].get("seq"))
            self.pipeline.process(events)
            cursor = max(cursor, max(int(e.get("seq", 0)) for e in events))
            self.db.set_cursor(run_id, cursor, now_iso())
            total += len(events)
            if len(events) < self.settings.page_size:
                break
        self.status["last_seq"] = cursor
        self.status["events_ingested"] += total
        return total

    def isolate(self, device_id: str, isolated: bool = True) -> dict[str, Any]:
        result = self.client.post(f"/sim/devices/{device_id}/isolate", {"isolated": isolated})
        self._last_device_poll = 0.0
        return result
