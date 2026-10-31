"""Event factory: builds events conforming to docs/contracts.md section 1."""
from __future__ import annotations

import uuid

from .store import utc_now

EVENT_TYPES = frozenset({
    "heartbeat", "auth_login", "auth_logout", "config_change", "firmware_update",
    "stream_status", "snapshot_access", "recording_access", "recording_export",
    "recording_delete", "badge_access", "door_state", "vpn_session", "network_scan",
    "log_cleared",
})
OUTCOMES = frozenset({"success", "failure", "info"})
ORIGINS = frozenset({"synthetic", "scenario_generated", "observed_http"})


def make_event(
    *,
    device_id: str,
    event_type: str,
    outcome: str,
    origin: str,
    source: dict,
    target: dict,
    details: dict | None = None,
) -> dict:
    """Return an event without run_id/seq; the store assigns those."""
    if event_type not in EVENT_TYPES:
        raise ValueError(f"unknown event_type {event_type}")
    if outcome not in OUTCOMES:
        raise ValueError(f"unknown outcome {outcome}")
    if origin not in ORIGINS:
        raise ValueError(f"unknown origin {origin}")
    return {
        "event_id": str(uuid.uuid4()),
        "occurred_at": utc_now(),
        "device_id": device_id,
        "event_type": event_type,
        "outcome": outcome,
        "origin": origin,
        "source": {"ip": source["ip"], "user": source.get("user"), "zone": source.get("zone")},
        "target": {"ip": target["ip"], "port": target.get("port"), "service": target["service"]},
        "details": details or {},
    }
