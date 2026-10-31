"""Runtime configuration, read from environment variables."""
from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path

DEFAULT_DB = Path(__file__).resolve().parent.parent / "data" / "simulator.sqlite3"


def _flag(name: str, default: bool) -> bool:
    value = os.environ.get(name)
    if value is None:
        return default
    return value.strip().lower() in {"1", "true", "yes", "on"}


@dataclass
class Settings:
    admin_token: str = "gatewatch-admin"
    db_path: str = str(DEFAULT_DB)
    # Starts the synthetic baseline thread on app startup (disabled in tests).
    background: bool = True
    baseline_enabled: bool = True
    baseline_rate: float = 1.0
    # Seconds between scenario stages in AUTO mode.
    scenario_interval: float = 6.0
    heartbeat_interval: float = 10.0

    @classmethod
    def from_env(cls) -> "Settings":
        return cls(
            admin_token=os.environ.get("GATEWATCH_ADMIN_TOKEN", "gatewatch-admin"),
            db_path=os.environ.get("GATEWATCH_SIM_DB", str(DEFAULT_DB)),
            background=_flag("GATEWATCH_SIM_BACKGROUND", True),
            baseline_enabled=_flag("GATEWATCH_BASELINE_ENABLED", True),
            baseline_rate=float(os.environ.get("GATEWATCH_BASELINE_RATE", "1.0")),
            scenario_interval=float(os.environ.get("GATEWATCH_SCENARIO_INTERVAL", "6.0")),
            heartbeat_interval=float(os.environ.get("GATEWATCH_HEARTBEAT_INTERVAL", "10.0")),
        )
