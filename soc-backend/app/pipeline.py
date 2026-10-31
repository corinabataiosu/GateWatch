"""Event processing pipeline: validate → de-duplicate → store → detect (rules + ML) → correlate."""
import json
import logging
import threading
from dataclasses import dataclass, field
from typing import Any

from pydantic import ValidationError

from .correlation import Correlator
from .db import Database
from .ml.detector import AnomalyDetector
from .models import Event, now_iso
from .rules import RuleEngine

log = logging.getLogger("gatewatch.pipeline")


@dataclass
class PipelineStats:
    received: int = 0
    stored: int = 0
    duplicates: int = 0
    rejected: int = 0
    alerts_created: int = 0
    last_errors: list[str] = field(default_factory=list)


class Pipeline:
    def __init__(self, db: Database, detector: AnomalyDetector):
        self.db = db
        self.detector = detector
        self.rules = RuleEngine()
        self.correlator = Correlator(db)
        self.stats = PipelineStats()
        self.lock = threading.Lock()

    def reset(self) -> None:
        with self.lock:
            self.db.reset()
            self.rules = RuleEngine()
            self.detector.reset()
            self.stats = PipelineStats()

    def process(self, raw_events: list[dict[str, Any]]) -> list[dict[str, Any]]:
        """Process a batch in order; returns the alerts that were newly created."""
        created: list[dict[str, Any]] = []
        with self.lock:
            for raw in raw_events:
                self.stats.received += 1
                try:
                    event = Event.model_validate(raw)
                except ValidationError as exc:
                    self.stats.rejected += 1
                    self.stats.last_errors = (self.stats.last_errors + [f"{raw.get('event_id')}: {exc.errors()[0]['msg']}"])[-5:]
                    continue
                if not self._store(event):
                    self.stats.duplicates += 1
                    continue
                self.stats.stored += 1
                created.extend(self._detect(event))
        self.stats.alerts_created += len(created)
        return created

    def _store(self, event: Event) -> bool:
        record = event.to_record()
        cur = self.db.execute(
            "INSERT OR IGNORE INTO events(event_id, run_id, seq, occurred_at, device_id, event_type, outcome, "
            "origin, raw, ingested_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
            (event.event_id, event.run_id, event.seq, record["occurred_at"], event.device_id, event.event_type,
             event.outcome, event.origin, json.dumps(record), now_iso()),
        )
        return cur.rowcount == 1

    def _detect(self, event: Event) -> list[dict[str, Any]]:
        drafts = self.rules.evaluate(event)
        score = self.detector.score(event)
        if score is not None:
            ml_draft = self.detector.draft(event, score)
            if ml_draft:
                drafts.append(ml_draft)
        occurred_at = event.to_record()["occurred_at"]
        alerts = [self.correlator.record(d, occurred_at, event.run_id) for d in drafts]
        return [a for a in alerts if a]
