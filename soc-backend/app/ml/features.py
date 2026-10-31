"""Per-device behavioural features over a trailing time window.

The same extractor is used for training (``train.py``) and live scoring (``detector.py``), so the
saved model always sees identically computed features.
"""
from collections import defaultdict, deque

from ..models import Event

WINDOW_SECONDS = 60.0

FEATURE_NAMES = [
    "n_events",
    "n_auth_fail",
    "n_auth_success",
    "n_distinct_src_ips",
    "n_external_src",
    "n_data_access",
    "n_export",
    "n_config",
    "n_destructive",
    "n_badge_denied",
    "n_restricted_badge",
    "off_hours",
    "failure_ratio",
]

DATA_ACCESS = {"snapshot_access", "recording_access", "recording_export"}
CONFIG = {"config_change", "firmware_update"}
DESTRUCTIVE = {"recording_delete", "log_cleared"}
IGNORED = {"heartbeat"}


def is_external(ip: str | None) -> bool:
    return bool(ip) and not (ip.startswith("10.") or ip.startswith("192.168.") or ip.startswith("127."))


def compute(events: list[Event]) -> list[float]:
    n = len(events)
    fails = sum(1 for e in events if e.outcome == "failure")
    ips = {e.source.ip for e in events if e.source.ip}
    return [
        float(n),
        float(sum(1 for e in events if e.event_type == "auth_login" and e.outcome == "failure")),
        float(sum(1 for e in events if e.event_type == "auth_login" and e.outcome == "success")),
        float(len(ips)),
        float(sum(1 for e in events if is_external(e.source.ip))),
        float(sum(1 for e in events if e.event_type in DATA_ACCESS)),
        float(sum(1 for e in events if e.event_type == "recording_export")),
        float(sum(1 for e in events if e.event_type in CONFIG)),
        float(sum(1 for e in events if e.event_type in DESTRUCTIVE)),
        float(sum(1 for e in events if e.event_type == "badge_access" and e.outcome == "failure")),
        float(sum(1 for e in events if e.event_type == "badge_access" and e.details.get("restricted"))),
        1.0 if any(e.details.get("off_hours") for e in events) else 0.0,
        fails / n if n else 0.0,
    ]


class FeatureExtractor:
    """Keeps a trailing window of relevant events per device."""

    def __init__(self, window_seconds: float = WINDOW_SECONDS):
        self.window = window_seconds
        self.buffers: dict[str, deque[Event]] = defaultdict(deque)

    def update(self, event: Event) -> list[float] | None:
        """Add an event; return the device's feature vector, or None for ignored events."""
        if event.event_type in IGNORED:
            return None
        buf = self.buffers[event.device_id]
        buf.append(event)
        while buf and event.ts - buf[0].ts > self.window:
            buf.popleft()
        return compute(list(buf))
