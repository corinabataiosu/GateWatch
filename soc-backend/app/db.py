"""SQLite persistence for ingested events, alerts, incidents and response actions."""
import json
import sqlite3
import threading
from pathlib import Path
from typing import Any, Iterable, Optional

SCHEMA = """
CREATE TABLE IF NOT EXISTS events (
    event_id TEXT PRIMARY KEY,
    run_id TEXT NOT NULL,
    seq INTEGER NOT NULL,
    occurred_at TEXT NOT NULL,
    device_id TEXT NOT NULL,
    event_type TEXT NOT NULL,
    outcome TEXT NOT NULL,
    origin TEXT NOT NULL,
    raw TEXT NOT NULL,
    ingested_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_events_device ON events(device_id, occurred_at);
CREATE INDEX IF NOT EXISTS idx_events_time ON events(occurred_at);

CREATE TABLE IF NOT EXISTS alerts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    alert_id TEXT UNIQUE,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    rule_id TEXT NOT NULL,
    source TEXT NOT NULL,
    severity TEXT NOT NULL,
    device_id TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    technique_id TEXT,
    technique TEXT,
    tactic TEXT,
    event_ids TEXT NOT NULL,
    entities TEXT NOT NULL,
    dedup_key TEXT,
    score REAL,
    incident_id TEXT,
    status TEXT NOT NULL DEFAULT 'open'
);
CREATE INDEX IF NOT EXISTS idx_alerts_dedup ON alerts(dedup_key, status);

CREATE TABLE IF NOT EXISTS incidents (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    incident_id TEXT UNIQUE,
    title TEXT NOT NULL,
    status TEXT NOT NULL,
    severity TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    last_alert_at TEXT NOT NULL,
    summary TEXT NOT NULL,
    devices TEXT NOT NULL,
    entities TEXT NOT NULL,
    tactics TEXT NOT NULL,
    run_id TEXT
);

CREATE TABLE IF NOT EXISTS actions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    incident_id TEXT NOT NULL,
    created_at TEXT NOT NULL,
    action TEXT NOT NULL,
    device_id TEXT,
    result TEXT NOT NULL,
    detail TEXT
);

CREATE TABLE IF NOT EXISTS cursors (
    run_id TEXT PRIMARY KEY,
    last_seq INTEGER NOT NULL,
    updated_at TEXT NOT NULL
);
"""

JSON_COLUMNS = {"event_ids", "entities", "devices", "tactics"}


class Database:
    def __init__(self, path: str):
        if path != ":memory:":
            Path(path).parent.mkdir(parents=True, exist_ok=True)
        self.conn = sqlite3.connect(path, check_same_thread=False)
        self.conn.row_factory = sqlite3.Row
        self.lock = threading.RLock()
        with self.lock:
            self.conn.executescript(SCHEMA)
            self.conn.commit()

    # -- helpers -----------------------------------------------------------
    def execute(self, sql: str, params: Iterable[Any] = ()) -> sqlite3.Cursor:
        with self.lock:
            cur = self.conn.execute(sql, tuple(params))
            self.conn.commit()
            return cur

    def query(self, sql: str, params: Iterable[Any] = ()) -> list[dict[str, Any]]:
        with self.lock:
            rows = self.conn.execute(sql, tuple(params)).fetchall()
        return [decode(row) for row in rows]

    def one(self, sql: str, params: Iterable[Any] = ()) -> Optional[dict[str, Any]]:
        rows = self.query(sql, params)
        return rows[0] if rows else None

    def scalar(self, sql: str, params: Iterable[Any] = ()) -> Any:
        with self.lock:
            row = self.conn.execute(sql, tuple(params)).fetchone()
        return row[0] if row else None

    def reset(self) -> None:
        with self.lock:
            for table in ("events", "alerts", "incidents", "actions"):
                self.conn.execute(f"DELETE FROM {table}")
            self.conn.commit()

    # -- cursors -----------------------------------------------------------
    def get_cursor(self, run_id: str) -> int:
        value = self.scalar("SELECT last_seq FROM cursors WHERE run_id = ?", (run_id,))
        return int(value or 0)

    def set_cursor(self, run_id: str, last_seq: int, now: str) -> None:
        self.execute(
            "INSERT INTO cursors(run_id, last_seq, updated_at) VALUES (?, ?, ?) "
            "ON CONFLICT(run_id) DO UPDATE SET last_seq = excluded.last_seq, updated_at = excluded.updated_at",
            (run_id, last_seq, now),
        )


def decode(row: sqlite3.Row) -> dict[str, Any]:
    data = dict(row)
    for key in JSON_COLUMNS & data.keys():
        data[key] = json.loads(data[key]) if data[key] else []
    if "raw" in data:
        data = json.loads(data["raw"])
    data.pop("id", None)
    return data
