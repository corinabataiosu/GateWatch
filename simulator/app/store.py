"""SQLite event store with per-run monotonic sequence numbers."""
from __future__ import annotations

import json
import secrets
import sqlite3
import threading
from datetime import datetime, timezone
from pathlib import Path


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="milliseconds").replace("+00:00", "Z")


_SCHEMA = """
CREATE TABLE IF NOT EXISTS runs (
    run_id TEXT PRIMARY KEY,
    started_at TEXT NOT NULL,
    ended_at TEXT,
    mode TEXT,
    last_seq INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS events (
    run_id TEXT NOT NULL,
    seq INTEGER NOT NULL,
    event_id TEXT NOT NULL UNIQUE,
    payload TEXT NOT NULL,
    PRIMARY KEY (run_id, seq)
);
CREATE TABLE IF NOT EXISTS executions (
    execution_id TEXT PRIMARY KEY,
    run_id TEXT NOT NULL,
    request TEXT NOT NULL,
    payload TEXT NOT NULL
);
"""


class EventStore:
    def __init__(self, db_path: str) -> None:
        if db_path != ":memory:":
            Path(db_path).parent.mkdir(parents=True, exist_ok=True)
        self._conn = sqlite3.connect(db_path, check_same_thread=False)
        self._conn.row_factory = sqlite3.Row
        self._lock = threading.RLock()
        with self._lock:
            self._conn.executescript(_SCHEMA)
            self._conn.commit()
            row = self._conn.execute(
                "SELECT run_id FROM runs WHERE ended_at IS NULL ORDER BY started_at DESC LIMIT 1"
            ).fetchone()
        self.current_run_id: str | None = row["run_id"] if row else None

    def start_run(self) -> dict:
        now = datetime.now(timezone.utc)
        run_id = f"run-{now:%Y%m%d-%H%M%S}-{secrets.token_hex(2)}"
        stamp = utc_now()
        with self._lock:
            self._conn.execute("UPDATE runs SET ended_at = ? WHERE ended_at IS NULL", (stamp,))
            self._conn.execute(
                "INSERT INTO runs (run_id, started_at) VALUES (?, ?)", (run_id, stamp)
            )
            self._conn.commit()
            self.current_run_id = run_id
        return self.get_run(run_id)

    def set_run_mode(self, mode: str | None) -> None:
        with self._lock:
            self._conn.execute(
                "UPDATE runs SET mode = ? WHERE run_id = ?", (mode, self.current_run_id)
            )
            self._conn.commit()

    def get_run(self, run_id: str) -> dict | None:
        with self._lock:
            row = self._conn.execute("SELECT * FROM runs WHERE run_id = ?", (run_id,)).fetchone()
        return dict(row) if row else None

    def list_runs(self) -> list[dict]:
        with self._lock:
            rows = self._conn.execute("SELECT * FROM runs ORDER BY started_at DESC").fetchall()
        return [dict(r) for r in rows]

    def append(self, event: dict) -> dict:
        """Assign run_id and the next seq atomically, then persist the event."""
        with self._lock:
            run_id = self.current_run_id
            row = self._conn.execute(
                "SELECT last_seq FROM runs WHERE run_id = ?", (run_id,)
            ).fetchone()
            seq = row["last_seq"] + 1
            stored = {"event_id": event["event_id"], "run_id": run_id, "seq": seq}
            stored.update({k: v for k, v in event.items() if k != "event_id"})
            self._conn.execute(
                "INSERT INTO events (run_id, seq, event_id, payload) VALUES (?, ?, ?, ?)",
                (run_id, seq, stored["event_id"], json.dumps(stored)),
            )
            self._conn.execute("UPDATE runs SET last_seq = ? WHERE run_id = ?", (seq, run_id))
            self._conn.commit()
        return stored

    def get_events(self, run_id: str, after_seq: int = 0, limit: int = 500) -> list[dict]:
        with self._lock:
            rows = self._conn.execute(
                "SELECT payload FROM events WHERE run_id = ? AND seq > ? ORDER BY seq LIMIT ?",
                (run_id, after_seq, limit),
            ).fetchall()
        return [json.loads(r["payload"]) for r in rows]

    def save_execution(self, request: dict, result: dict) -> None:
        with self._lock:
            self._conn.execute(
                "INSERT OR REPLACE INTO executions VALUES (?, ?, ?, ?)",
                (result["execution_id"], result["run_id"], json.dumps(request), json.dumps(result)),
            )
            self._conn.commit()

    def get_execution(self, execution_id: str) -> tuple[dict, dict] | None:
        with self._lock:
            row = self._conn.execute("SELECT request, payload FROM executions WHERE execution_id = ?",
                                     (execution_id,)).fetchone()
        return (json.loads(row["request"]), json.loads(row["payload"])) if row else None

    def list_executions(self) -> list[dict]:
        with self._lock:
            rows = self._conn.execute("SELECT payload FROM executions WHERE run_id = ? ORDER BY rowid DESC LIMIT 20",
                                      (self.current_run_id,)).fetchall()
        return [json.loads(r["payload"]) for r in rows]
