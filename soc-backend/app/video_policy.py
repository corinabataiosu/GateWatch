"""Explainable video quality evidence, independent from statistical novelty.

These conservative defaults are commissioning thresholds, not attack attribution.
Movement, a sharper image and low motion alone are not evidence of degradation.
"""
from dataclasses import dataclass


@dataclass(frozen=True)
class VideoQualityPolicy:
    dark_below: float = 25.0
    saturated_above: float = 230.0
    sharpness_fraction: float = 0.25

    def evidence(self, sample) -> list[str]:
        reasons = []
        if sample.brightness < self.dark_below:
            reasons.append('dark')
        if sample.brightness > self.saturated_above:
            reasons.append('saturated')
        if (sample.is_anomaly and sample.reference_sharpness is not None
                and sample.sharpness < sample.reference_sharpness * self.sharpness_fraction):
            reasons.append('sharpness_loss')
        return reasons


QUALITY_LABELS = {
    'dark': 'imagine aproape neagră (posibilă obturare a obiectivului)',
    'saturated': 'imagine saturată (posibilă orbire a camerei)',
    'sharpness_loss': 'pierdere puternică de claritate față de calibrare',
}
