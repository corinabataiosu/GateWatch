"""Video telemetry from the camera video module (ml/src/agent_video.py).

The video module is a second source for the same logical device: the simulator reports what the
camera *does* (logins, config), the video module reports what the camera *sees*. A video anomaly
alone is evidence that the image is unusable, not proof of an attack, so it raises a medium alert
(device state "warning") and never opens an incident by itself; it joins an incident only when the
device is already part of one (see correlation.py).
"""
import time
from typing import Any, Literal, Optional

from pydantic import AwareDatetime, BaseModel, ConfigDict, Field

from .rules import AlertDraft
from .video_policy import VideoQualityPolicy, QUALITY_LABELS

CONSECUTIVE_ANOMALIES = 3   # ≈3 s at 1 sample/s, so a single odd frame does not alert
RECOVERY_SAMPLES = 5        # normal samples needed before an unlinked video alert is closed
STALE_AFTER_SECONDS = 10.0

FEATURE_LABELS = {
    "luminozitate_medie": "luminozitate",
    "claritate_log": "claritate",
    "diferenta_cadre": "diferență între cadre",
}


class VideoTelemetry(BaseModel):
    model_config = ConfigDict(allow_inf_nan=False)
    device_id: str = Field(min_length=1)
    captured_at: AwareDatetime
    brightness: float = Field(ge=0, le=255)
    sharpness: float = Field(ge=0)
    frame_diff: Optional[float] = Field(default=None, ge=0, le=255)
    score: float
    threshold: float
    is_anomaly: bool
    out_of_range: list[str] = Field(default_factory=list)
    model_version: Optional[str] = None
    source: Literal["camera", "synthetic"]
    reference_sharpness: Optional[float] = Field(default=None, gt=0)


def diagnose(t: VideoTelemetry) -> str:
    reasons = VideoQualityPolicy().evidence(t)
    return '; '.join(QUALITY_LABELS[r] for r in reasons) if reasons else 'abatere statistică; degradare neconfirmată'


class VideoMonitor:
    def reset_device(self, device_id: str) -> None:
        self.anomaly_streak.pop(device_id, None)
        self.normal_streak.pop(device_id, None)
        self.latest.pop(device_id, None)

    def __init__(self) -> None:
        self.policy = VideoQualityPolicy()
        self.latest: dict[str, dict[str, Any]] = {}
        self.anomaly_streak: dict[str, int] = {}
        self.normal_streak: dict[str, int] = {}

    def reset(self) -> None:
        self.latest.clear()
        self.anomaly_streak.clear()
        self.normal_streak.clear()

    def ingest(self, t: VideoTelemetry) -> tuple[Optional[AlertDraft], bool]:
        """Record a sample. Returns (alert draft to record, whether the condition has cleared)."""
        device = t.device_id
        previous = self.latest.get(device)
        if previous and (time.monotonic() - previous["received_monotonic"] > STALE_AFTER_SECONDS
                         or previous['model_version'] != t.model_version or previous['source'] != t.source):
            self.anomaly_streak.pop(device, None)
            self.normal_streak.pop(device, None)
        reasons = self.policy.evidence(t)
        self.latest[device] = {**t.model_dump(mode="json"), "quality_reasons": reasons,
                               "quality_issue": bool(reasons), "captured_at": t.captured_at.isoformat(),
                               "received_monotonic": time.monotonic()}
        if reasons:
            self.anomaly_streak[device] = self.anomaly_streak.get(device, 0) + 1
            self.normal_streak[device] = 0
        else:
            self.anomaly_streak[device] = 0
            self.normal_streak[device] = self.normal_streak.get(device, 0) + 1
        cleared = self.normal_streak[device] == RECOVERY_SAMPLES
        if self.anomaly_streak[device] < CONSECUTIVE_ANOMALIES:
            return None, cleared
        causes = ", ".join(FEATURE_LABELS.get(f, f) for f in t.out_of_range) or "scor ridicat"
        return AlertDraft(
            rule_id="GW-V01", source="ml", severity="medium", device_id=device,
            title=f"Degradare persistentă a imaginii pe {device}",
            description=(f"{diagnose(t).capitalize()}. Model video: scor {t.score:.2f} (prag {t.threshold:.2f}); "
                         f"în afara domeniului normal: {causes}. "
                         f"{self.anomaly_streak[device]} eșantioane consecutive."),
            technique_id=None, event_ids=[], entities={"devices": [device]},
            dedup_key=f"GW-V01:{device}", score=t.score,
        ), cleared

    def view(self, device_id: str) -> Optional[dict[str, Any]]:
        sample = self.latest.get(device_id)
        if not sample:
            return None
        age = time.monotonic() - sample["received_monotonic"]
        data = {k: v for k, v in sample.items() if k != "received_monotonic"}
        data["stale"] = age > STALE_AFTER_SECONDS
        streak = self.anomaly_streak.get(device_id, 0)
        data["image_state"] = ("unavailable" if data["stale"] else
                               "persistent_anomaly" if streak >= CONSECUTIVE_ANOMALIES else
                               "atypical_sample" if data["is_anomaly"] or data['quality_issue'] else "normal")
        data["diagnosis"] = (diagnose(VideoTelemetry.model_validate(data))
                             if data["is_anomaly"] or data['quality_issue'] else None)
        return data
