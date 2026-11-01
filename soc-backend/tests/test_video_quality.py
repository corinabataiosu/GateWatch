from datetime import datetime, timedelta, timezone

from test_video import sample, post, cam01


def test_statistical_novelty_does_not_become_security_alert(client):
    for _ in range(15):
        post(client, sample(True, brightness=140, sharpness=900, frame_diff=35,
                            reference_sharpness=400, out_of_range=['claritate_log', 'diferenta_cadre']))
    device = cam01(client)
    assert device['security_state'] == 'normal'
    assert device['video']['is_anomaly'] is True
    assert device['video']['quality_issue'] is False
    assert not client.get('/api/alerts?status=open').json()


def test_sharpness_loss_requires_calibrated_reference(client):
    for _ in range(4):
        post(client, sample(True, brightness=120, sharpness=10))
    assert not client.get('/api/alerts?status=open').json()
    for _ in range(3):
        post(client, sample(True, brightness=120, sharpness=10, reference_sharpness=100))
    assert len(client.get('/api/alerts?status=open').json()) == 1


def test_static_scene_is_not_replay_evidence(client):
    for _ in range(6):
        post(client, sample(True, brightness=100, sharpness=300, frame_diff=0,
                            out_of_range=['diferenta_cadre']))
    assert not client.get('/api/alerts?status=open').json()
    assert 'înghețat' not in cam01(client)['video']['diagnosis']


def test_duplicate_and_older_samples_do_not_advance_streak(client):
    body = sample(True)
    post(client, body)
    for _ in range(6):
        assert post(client, body).json()['accepted'] is False
    older = (datetime.fromisoformat(body['captured_at']) - timedelta(seconds=1)).isoformat()
    assert post(client, sample(True, captured_at=older)).json()['accepted'] is False
    assert not client.get('/api/alerts?status=open').json()


def test_model_change_resets_evidence(client):
    for _ in range(2):
        post(client, sample(True, model_version='old'))
    assert post(client, sample(True, model_version='new')).json()['alert_id'] is None


def test_obvious_darkness_detected_even_if_model_calls_it_normal(client):
    for _ in range(3):
        post(client, sample(False, brightness=3))
    assert cam01(client)['security_state'] == 'warning'


def test_novelty_alone_allows_recovery_from_quality_alert(client):
    for _ in range(3):
        post(client, sample(True))
    for _ in range(5):
        post(client, sample(True, brightness=140, sharpness=800))
    assert not client.get('/api/alerts?status=open').json()


def test_rejects_naive_timestamp_and_nonfinite_metrics(client):
    assert post(client, sample(False, captured_at='2026-11-01T10:00:00')).status_code == 422
    assert post(client, sample(False, sharpness='Infinity')).status_code == 422
