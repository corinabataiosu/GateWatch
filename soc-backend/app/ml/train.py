"""Train the Isolation Forest baseline model and save the artifact.

Usage (from soc-backend/):
    python ../simulator/tools/export_baseline.py --hours 8 --out data/sim_baseline.jsonl
    python -m app.ml.train --events data/sim_baseline.jsonl

Without --events only the built-in synthetic baseline is used (deterministic, seed 42).

Only normal behaviour is used for training: simulator events with origin ``scenario_generated``
or ``observed_http`` are excluded, so the model learns the airport's baseline and flags deviations.
"""
import argparse
import json
import random
import uuid
from datetime import datetime, timedelta, timezone
from pathlib import Path

import joblib
import numpy as np
from sklearn.ensemble import IsolationForest

from ..config import settings
from ..models import Event
from .features import FEATURE_NAMES, FeatureExtractor

MODEL_VERSION_PREFIX = "iforest"

CAMERAS = [f"CAM-0{i}" for i in range(1, 9)]
STAFF_IPS = [f"10.20.10.{i}" for i in range(10, 30)]
STAFF_USERS = ["operator.ionescu", "operator.popa", "tehnician.dinu", "admin.soc", "operator.marin"]
BADGES = [f"B-{1000 + i}" for i in range(20)]

# Expected events per minute for each device class during a normal shift.
RATES: dict[str, list[tuple[str, str, float]]] = {
    "camera": [("auth_login", "success", 0.06), ("auth_login", "failure", 0.015),
               ("auth_logout", "info", 0.05), ("snapshot_access", "success", 0.12),
               ("stream_status", "info", 0.5), ("config_change", "success", 0.004)],
    "nvr": [("auth_login", "success", 0.1), ("auth_login", "failure", 0.015),
            ("recording_access", "success", 0.5), ("recording_export", "success", 0.03),
            ("recording_delete", "success", 0.004)],
    "acs": [("badge_access", "success", 1.5), ("badge_access", "failure", 0.06),
            ("door_state", "info", 0.6)],
    "vpn": [("vpn_session", "success", 0.12), ("vpn_session", "failure", 0.01)],
    "iot": [("config_change", "success", 0.003), ("firmware_update", "info", 0.001)],
}
DEVICES = ([(d, "camera") for d in CAMERAS] + [("NVR-01", "nvr"), ("NVR-02", "nvr")]
           + [("ACS-01", "acs"), ("ACS-02", "acs"), ("ACS-03", "acs")]
           + [("VPN-GW-01", "vpn"), ("IOT-GW-01", "iot")])


def synthetic_baseline(hours: float, seed: int) -> list[Event]:
    rng = random.Random(seed)
    start = datetime(2026, 10, 1, 6, 0, tzinfo=timezone.utc)
    events: list[Event] = []
    seq = 0
    load = 1.0
    for minute in range(int(hours * 60)):
        if minute % 30 == 0:
            # Traffic intensity changes every half hour (quiet night shifts to busy peaks).
            load = 0.5 + 1.5 * rng.random()
        for device_id, kind in DEVICES:
            for event_type, outcome, rate in RATES[kind]:
                for _ in range(_poisson(rng, rate * load)):
                    seq += 1
                    at = start + timedelta(minutes=minute, seconds=rng.uniform(0, 60))
                    events.append(_event(rng, seq, at, device_id, kind, event_type, outcome))
    events.sort(key=lambda e: e.ts)
    return events


def _poisson(rng: random.Random, lam: float) -> int:
    count, p, limit = 0, 1.0, np.exp(-lam)
    while True:
        p *= rng.random()
        if p < limit:
            return count
        count += 1


def _event(rng, seq, at, device_id, kind, event_type, outcome) -> Event:
    user = rng.choice(STAFF_USERS)
    ip = rng.choice(STAFF_IPS)
    details: dict = {}
    if kind == "acs":
        ip = {"ACS-01": "10.20.3.31", "ACS-02": "10.20.3.32", "ACS-03": "10.20.3.33"}[device_id]
        user = None
        details = {"badge_id": rng.choice(BADGES), "door": "D1", "restricted": rng.random() < 0.15,
                   "holder": "personal"}
    if kind == "vpn":
        ip = f"86.{rng.randint(100, 130)}.{rng.randint(0, 255)}.{rng.randint(1, 254)}"
        details = {"off_hours": rng.random() < 0.03, "assigned_ip": rng.choice(STAFF_IPS)}
    if event_type == "config_change":
        details = {"change": rng.choice(["bitrate", "ntp_server", "image_profile"])}
    if event_type == "recording_delete":
        # Routine retention purge performed by the NVR itself.
        ip = {"NVR-01": "10.20.2.21", "NVR-02": "10.20.2.22"}[device_id]
        user = "system.retention"
        details = {"recording_id": f"REC-{rng.randint(1, 500)}", "reason": "retention"}
    if event_type == "recording_export":
        details = {"recording_id": f"REC-{rng.randint(1, 500)}", "size_mb": rng.randint(50, 400)}
    return Event(
        event_id=str(uuid.UUID(int=rng.getrandbits(128))), run_id="baseline-synthetic", seq=seq,
        occurred_at=at, device_id=device_id, event_type=event_type, outcome=outcome,
        origin="synthetic", source={"ip": ip, "user": user, "zone": None},
        target={"ip": None, "port": None, "service": kind}, details=details,
    )


def load_events(path: str) -> list[Event]:
    """Read simulator events (JSONL), keeping only baseline behaviour."""
    events = []
    with open(path, encoding="utf-8") as fh:
        for line in fh:
            raw = json.loads(line)
            if raw.get("origin") == "synthetic":
                events.append(Event.model_validate(raw))
    return events


def feature_matrix(events: list[Event]) -> np.ndarray:
    extractor = FeatureExtractor()
    rows = [f for f in (extractor.update(e) for e in events) if f is not None]
    return np.asarray(rows, dtype=float)


def train(events: list[Event], seed: int = 42) -> dict:
    X = feature_matrix(events)
    model = IsolationForest(n_estimators=300, max_samples=min(2048, len(X)), contamination="auto",
                            random_state=seed)
    model.fit(X)
    scores = -model.score_samples(X)
    # Alert only beyond (almost) everything seen in normal operation.
    threshold = float(np.percentile(scores, 99.95))
    now = datetime.now(timezone.utc)
    return {
        "model": model,
        "feature_names": FEATURE_NAMES,
        "threshold": threshold,
        "baseline_mean": X.mean(axis=0).tolist(),
        "baseline_std": np.maximum(X.std(axis=0), 0.5).tolist(),
        "version": f"{MODEL_VERSION_PREFIX}-{now:%Y%m%d%H%M}",
        "trained_at": now.isoformat(),
        "n_samples": int(len(X)),
        "score_p50": float(np.percentile(scores, 50)),
        "score_p99": float(np.percentile(scores, 99)),
    }


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--hours", type=float, default=12, help="hours of synthetic baseline")
    parser.add_argument("--seed", type=int, default=42)
    parser.add_argument("--events", help="JSONL of simulator baseline events (simulator/tools/export_baseline.py)")
    parser.add_argument("--out", default=settings.model_path)
    args = parser.parse_args()

    events = synthetic_baseline(args.hours, args.seed)
    sources = ["synthetic"]
    if args.events:
        # Simulator events are on their own clock: shift them after the synthetic block so the
        # trailing windows of the two sources never mix.
        recorded = load_events(args.events)
        offset = events[-1].ts + 3600 - min(e.ts for e in recorded)
        events += [e.model_copy(update={"occurred_at": datetime.fromtimestamp(e.ts + offset, timezone.utc)})
                   for e in recorded]
        sources.append(Path(args.events).name)

    artifact = train(events, args.seed)
    out = Path(args.out)
    out.parent.mkdir(parents=True, exist_ok=True)
    joblib.dump(artifact, out)
    card = {k: v for k, v in artifact.items() if k not in ("model", "baseline_mean", "baseline_std")}
    card["sources"] = sources
    out.with_name("model_card.json").write_text(json.dumps(card, indent=2), encoding="utf-8")
    print(f"saved {out} ({artifact['n_samples']} samples, threshold {artifact['threshold']:.3f}, "
          f"median score {artifact['score_p50']:.3f})")


if __name__ == "__main__":
    main()
