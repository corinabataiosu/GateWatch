import sys
from pathlib import Path
from unittest.mock import Mock

import joblib
import numpy as np
import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'src'))
from calibrare_camera import valideaza, activeaza
from model_video import antreneaza, colecteaza_sintetic


def test_validation_rejects_persistent_or_frequent_anomalies():
    model = Mock()
    artifact = {'model': model, 'prag': 0.7, 'domeniu_min': [0, 0, 0], 'domeniu_max': [10, 10, 10]}
    x = np.ones((100, 3))
    model.score_samples.return_value = np.full(100, -0.4)
    assert valideaza(artifact, x)['accepted']
    x[:3] = 20
    assert not valideaza(artifact, x)['accepted']  # only 3%, but persistent
    x[:] = 1
    x[::10] = 20
    assert not valideaza(artifact, x)['accepted']  # 10%, not consecutive


def test_activation_preserves_previous_and_rejects_invalid_artifact(tmp_path):
    target = tmp_path / 'video_camera.joblib'
    joblib.dump({'previous': True}, target)
    artifact = antreneaza(colecteaza_sintetic(160, 42))
    activeaza(artifact, target)
    backup = next(tmp_path.glob('*.backup-*.joblib'))
    assert joblib.load(backup) == {'previous': True}
    before = target.read_bytes()
    with pytest.raises(ValueError):
        activeaza({**artifact, 'caracteristici': []}, target)
    assert target.read_bytes() == before


def test_camera_agent_rejects_synthetic_model_before_opening_camera(tmp_path, monkeypatch):
    import agent_video
    target = tmp_path / 'synthetic.joblib'
    joblib.dump(antreneaza(colecteaza_sintetic(160, 42)), target)
    camera = Mock(side_effect=AssertionError('Camera must not be opened'))
    monkeypatch.setattr(agent_video, 'SursaCamera', camera)
    monkeypatch.setattr(sys, 'argv', ['agent_video', '--sursa', 'camera', '--model', str(target)])
    with pytest.raises(SystemExit) as error:
        agent_video.main()
    assert error.value.code == 2
    camera.assert_not_called()


def test_calibration_timeout_preserves_model_without_opening_parent_camera(tmp_path, monkeypatch):
    import calibrare_camera
    import subprocess
    target = tmp_path / 'video_camera.joblib'
    target.write_bytes(b'previous-model')
    monkeypatch.setattr(sys, 'argv', ['calibrare_camera', '--iesire', str(target)])
    run = Mock(side_effect=subprocess.TimeoutExpired('capture', 255))
    monkeypatch.setattr(calibrare_camera.subprocess, 'run', run)
    camera = Mock(side_effect=AssertionError('Parent must not open camera'))
    monkeypatch.setattr(calibrare_camera, 'SursaCamera', camera)
    assert calibrare_camera.main() == 2
    assert target.read_bytes() == b'previous-model'
    assert run.call_args.kwargs['timeout'] == 255
    camera.assert_not_called()
