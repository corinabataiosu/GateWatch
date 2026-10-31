"""Validated event contract (docs/contracts.md §1)."""
from datetime import datetime, timezone
from typing import Any, Literal, Optional

from pydantic import BaseModel, ConfigDict, Field, field_validator

EVENT_TYPES = {
    "heartbeat", "auth_login", "auth_logout", "config_change", "firmware_update",
    "stream_status", "snapshot_access", "recording_access", "recording_export",
    "recording_delete", "badge_access", "door_state", "vpn_session", "network_scan",
    "log_cleared",
}


class Endpoint(BaseModel):
    model_config = ConfigDict(extra="allow")
    ip: Optional[str] = None
    user: Optional[str] = None
    zone: Optional[str] = None
    port: Optional[int] = None
    service: Optional[str] = None


class Event(BaseModel):
    model_config = ConfigDict(extra="ignore")

    event_id: str = Field(min_length=1)
    run_id: str = Field(min_length=1)
    seq: int = Field(ge=1)
    occurred_at: datetime
    device_id: str = Field(min_length=1)
    event_type: str
    outcome: Literal["success", "failure", "info"]
    origin: Literal["synthetic", "scenario_generated", "observed_http"]
    source: Endpoint = Field(default_factory=Endpoint)
    target: Endpoint = Field(default_factory=Endpoint)
    details: dict[str, Any] = Field(default_factory=dict)

    @field_validator("event_type")
    @classmethod
    def known_type(cls, value: str) -> str:
        if value not in EVENT_TYPES:
            raise ValueError(f"unknown event_type {value!r}")
        return value

    @field_validator("occurred_at")
    @classmethod
    def as_utc(cls, value: datetime) -> datetime:
        if value.tzinfo is None:
            return value.replace(tzinfo=timezone.utc)
        return value.astimezone(timezone.utc)

    @property
    def ts(self) -> float:
        return self.occurred_at.timestamp()

    def to_record(self) -> dict[str, Any]:
        data = self.model_dump(mode="json")
        data["occurred_at"] = iso(self.occurred_at)
        return data


def iso(value: datetime) -> str:
    return value.astimezone(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S.%f")[:-3] + "Z"


def now_iso() -> str:
    return iso(datetime.now(timezone.utc))
