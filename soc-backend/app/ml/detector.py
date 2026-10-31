"""Online anomaly scoring with the saved Isolation Forest artifact."""
import logging
from dataclasses import dataclass
from pathlib import Path
from typing import Optional

import joblib
import numpy as np

from ..models import Event, iso
from ..rules import AlertDraft
from .features import FEATURE_NAMES, FeatureExtractor

log = logging.getLogger("gatewatch.ml")


@dataclass
class Score:
    device_id: str
    score: float
    threshold: float
    is_anomaly: bool
    evaluated_at: str
    top_features: list[str]


class AnomalyDetector:
    def __init__(self, model_path: str):
        self.model_path = model_path
        self.model = None
        self.threshold = 1.0
        self.version: Optional[str] = None
        self.baseline_mean: Optional[np.ndarray] = None
        self.baseline_std: Optional[np.ndarray] = None
        self.extractor = FeatureExtractor()
        self.latest: dict[str, Score] = {}
        self.load()

    @property
    def loaded(self) -> bool:
        return self.model is not None

    def load(self) -> None:
        path = Path(self.model_path)
        if not path.exists():
            log.warning("ML model artifact not found at %s; ML scoring disabled", path)
            return
        artifact = joblib.load(path)
        if artifact.get("feature_names") != FEATURE_NAMES:
            log.error("ML artifact feature set does not match extractor; retrain with app.ml.train")
            return
        self.model = artifact["model"]
        self.threshold = float(artifact["threshold"])
        self.version = artifact.get("version")
        self.baseline_mean = np.asarray(artifact["baseline_mean"])
        self.baseline_std = np.asarray(artifact["baseline_std"])

    def info(self) -> dict:
        return {"loaded": self.loaded, "version": self.version, "threshold": self.threshold,
                "features": FEATURE_NAMES, "path": self.model_path}

    def reset(self) -> None:
        self.extractor = FeatureExtractor()
        self.latest.clear()

    def score(self, event: Event) -> Optional[Score]:
        if not self.loaded:
            return None
        features = self.extractor.update(event)
        if features is None:
            return None
        x = np.asarray([features])
        # score_samples is the negated anomaly score from the Isolation Forest paper:
        # flip it so that higher means more anomalous (≈0.35 normal, >0.6 strongly anomalous).
        value = float(-self.model.score_samples(x)[0])
        z = (x[0] - self.baseline_mean) / self.baseline_std
        top = [FEATURE_NAMES[i] for i in np.argsort(-z)[:3] if z[i] > 2]
        result = Score(event.device_id, round(value, 3), round(self.threshold, 3),
                       value >= self.threshold, iso(event.occurred_at), top)
        self.latest[event.device_id] = result
        return result

    def draft(self, event: Event, score: Score) -> Optional[AlertDraft]:
        # A routine status report inside an already anomalous window updates the score but is not
        # evidence, so it must not be attached to the alert (and the incident timeline).
        routine = event.event_type == "stream_status" and event.outcome != "failure"
        if not score.is_anomaly or routine:
            return None
        severity = "high" if score.score >= self.threshold + 0.08 else "medium"
        drivers = ", ".join(score.top_features) or "combinație neobișnuită de evenimente"
        return AlertDraft(
            rule_id="GW-ML01", source="ml", severity=severity, device_id=event.device_id,
            title=f"Comportament anormal detectat pe {event.device_id}",
            description=(f"Isolation Forest: scor {score.score:.2f} peste pragul {score.threshold:.2f} "
                         f"în ultimele 60 s. Factori principali: {drivers}."),
            # The window, not the triggering event, is anomalous: link by device only so a bystander's
            # routine login inside the window is not pulled into the incident.
            technique_id=None, event_ids=[event.event_id], entities={"devices": [event.device_id]},
            dedup_key=f"GW-ML01:{event.device_id}", score=score.score,
        )
