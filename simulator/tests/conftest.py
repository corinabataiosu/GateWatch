import os
import sys
from pathlib import Path

import pytest

# Keep the module-level app in app.main off disk and free of background threads.
os.environ.setdefault("GATEWATCH_SIM_DB", ":memory:")
os.environ.setdefault("GATEWATCH_SIM_BACKGROUND", "0")
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from fastapi.testclient import TestClient  # noqa: E402

from app.config import Settings  # noqa: E402
from app.main import create_app  # noqa: E402

ADMIN = {"X-Admin-Token": "test-token"}


@pytest.fixture
def settings(tmp_path):
    return Settings(
        admin_token="test-token",
        db_path=str(tmp_path / "sim.sqlite3"),
        background=False,
        scenario_interval=0.01,
    )


@pytest.fixture
def client(settings):
    with TestClient(create_app(settings)) as test_client:
        yield test_client


@pytest.fixture
def sim(client):
    return client.app.state.sim


def all_events(client):
    return client.get("/sim/events", params={"limit": 5000}).json()["events"]
