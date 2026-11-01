"""Regression checks for calibration/live sampling cadence without hardware."""
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))
from esantionare_video import RitmCadre, fps_valid


def test_pacing_accounts_for_processing_and_does_not_burst_after_stall():
    now = [0.0]
    waits = []

    def sleep(seconds):
        waits.append(seconds)
        now[0] += seconds

    pace = RitmCadre(5, ceas=lambda: now[0], asteapta=sleep)
    pace.asteapta_cadru()
    now[0] += 0.07
    pace.asteapta_cadru()
    assert now[0] == pytest.approx(0.2)
    assert waits == pytest.approx([0.13])
    now[0] = 3.0  # e.g. a slow telemetry request
    pace.asteapta_cadru()
    pace.asteapta_cadru()
    assert now[0] == pytest.approx(3.2)


@pytest.mark.parametrize("value", [0, -1, float("nan"), float("inf")])
def test_invalid_frame_rates_are_rejected(value):
    with pytest.raises(ValueError):
        fps_valid(value)


def test_camera_calibration_uses_pacer(monkeypatch):
    import model_video
    from sursa_video import SursaSintetica

    calls = []

    class Pace:
        def __init__(self, fps):
            assert fps == 5

        def asteapta_cadru(self):
            calls.append(1)

    monkeypatch.setattr(model_video, "RitmCadre", Pace)
    samples = model_video.colecteaza(SursaSintetica(), 10, fps=5)
    assert samples.shape == (9, 3)
    assert len(calls) == 10


def test_camera_fallback_releases_failed_capture(monkeypatch):
    import sursa_video
    from unittest.mock import Mock

    failed = Mock()
    failed.isOpened.return_value = False
    working = Mock()
    working.isOpened.return_value = True
    opened = Mock(side_effect=[failed, working])
    monkeypatch.setattr(sursa_video.os, 'name', 'nt')
    monkeypatch.setattr(sursa_video.cv2, 'VideoCapture', opened)
    assert sursa_video.deschide_camera(0) is working
    failed.release.assert_called_once()
    working.release.assert_not_called()
    assert opened.call_args_list[0].args == (0, sursa_video.cv2.CAP_DSHOW)
    assert opened.call_args_list[1].args == (0, sursa_video.cv2.CAP_MSMF)


def test_camera_reopens_after_failed_read(monkeypatch):
    import sursa_video
    from unittest.mock import Mock

    failed, recovered = Mock(), Mock()
    failed.read.return_value = (False, None)
    frame = object()
    recovered.read.return_value = (True, frame)
    opened = Mock(side_effect=[failed, recovered])
    monkeypatch.setattr(sursa_video, 'deschide_camera', opened)
    source = sursa_video.SursaCamera(2)
    with pytest.raises(sursa_video.EroareSursaVideo):
        source.citeste()
    failed.release.assert_called_once()
    assert source.citeste() is frame
    assert opened.call_count == 2
    source.elibereaza()
    source.elibereaza()
    recovered.release.assert_called_once()
