"""Shared frame pacing for camera calibration and live analysis."""
import math
import time

FPS_IMPLICIT = 5.0


def fps_valid(valoare):
    fps = float(valoare)
    if not math.isfinite(fps) or fps <= 0:
        raise ValueError("FPS must be a finite positive number")
    return fps


class RitmCadre:
    """Space frame starts evenly; never catch up with a burst after a slow read."""

    def __init__(self, fps, ceas=time.monotonic, asteapta=time.sleep):
        self.interval = 1.0 / fps_valid(fps)
        self.ceas = ceas
        self.asteapta = asteapta
        self.urmator = None

    def asteapta_cadru(self):
        acum = self.ceas()
        if self.urmator is not None and acum < self.urmator:
            self.asteapta(self.urmator - acum)
        self.urmator = self.ceas() + self.interval
