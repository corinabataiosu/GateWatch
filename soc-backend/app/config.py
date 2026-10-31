import os
from dataclasses import dataclass, field
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent


@dataclass
class Settings:
    simulator_url: str = field(default_factory=lambda: os.getenv("GATEWATCH_SIM_URL", "http://localhost:8001"))
    admin_token: str = field(default_factory=lambda: os.getenv("GATEWATCH_ADMIN_TOKEN", "gatewatch-admin"))
    db_path: str = field(default_factory=lambda: os.getenv("GATEWATCH_SOC_DB", str(BASE_DIR / "data" / "soc.sqlite3")))
    model_path: str = field(default_factory=lambda: os.getenv("GATEWATCH_MODEL", str(BASE_DIR / "models" / "isolation_forest.joblib")))
    poll_interval: float = field(default_factory=lambda: float(os.getenv("GATEWATCH_POLL_INTERVAL", "1.0")))
    device_poll_interval: float = 5.0
    page_size: int = 500
    # Disabled in tests so the pipeline can be driven synchronously.
    ingestion_enabled: bool = field(default_factory=lambda: os.getenv("GATEWATCH_INGESTION", "1") == "1")


settings = Settings()
