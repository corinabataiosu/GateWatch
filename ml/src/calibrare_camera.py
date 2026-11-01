"""Calibrate on normal frames, validate separately, then atomically activate a model."""
import argparse
import json
import os
from pathlib import Path
import shutil
import tempfile
import sys
import subprocess
from datetime import datetime, timezone

import joblib
import numpy as np

from model_video import antreneaza, colecteaza, NUME_CARACTERISTICI
from sursa_video import SursaCamera
from esantionare_video import fps_valid


def valideaza(artifact, samples):
    if samples.ndim != 2 or samples.shape[1] != 3 or len(samples) < 29 or not np.isfinite(samples).all():
        raise ValueError('Validarea necesită cel puțin 29 de vectori fini cu trei caracteristici.')
    scores = -artifact['model'].score_samples(samples)
    outside = np.any((samples < artifact['domeniu_min']) | (samples > artifact['domeniu_max']), axis=1)
    anomalous = (scores >= artifact['prag']) | outside
    longest = streak = 0
    for value in anomalous:
        streak = streak + 1 if value else 0
        longest = max(longest, streak)
    rate = float(np.mean(anomalous))
    return {'samples': len(samples), 'anomaly_rate': rate, 'longest_streak': longest,
            'accepted': rate <= 0.05 and longest < 3}


def activeaza(artifact, target):
    """The active joblib is replaced last; failures leave the previous model usable."""
    target = Path(target)
    target.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(dir=target.parent) as temporary:
        candidate = Path(temporary) / 'candidate.joblib'
        joblib.dump(artifact, candidate)
        loaded = joblib.load(candidate)
        if loaded['caracteristici'] != NUME_CARACTERISTICI:
            raise ValueError('Caracteristici incompatibile.')
        card = target.with_name(target.stem + '_card.json')
        candidate_card = Path(temporary) / 'card.json'
        candidate_card.write_text(json.dumps({k: v for k, v in artifact.items() if k != 'model'}, indent=2), encoding='utf-8')
        if target.exists():
            stamp = datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%S%f')
            shutil.copy2(target, target.with_name(f'{target.stem}.backup-{stamp}.joblib'))
        os.replace(candidate_card, card)
        os.replace(candidate, target)


def main():
    for stream in (sys.stdout, sys.stderr):
        if hasattr(stream, 'reconfigure'):
            stream.reconfigure(encoding='utf-8', errors='replace')
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--camera', type=int, default=0)
    parser.add_argument('--fps', type=fps_valid, default=5)
    parser.add_argument('--cadre', type=int, default=600)
    parser.add_argument('--validare', type=int, default=150)
    parser.add_argument('--iesire', default=str(Path(__file__).resolve().parents[1] / 'models/video_camera.joblib'))
    parser.add_argument('--capture-worker', action='store_true', help=argparse.SUPPRESS)
    args = parser.parse_args()
    if args.cadre < 100 or args.validare < 30:
        parser.error('Calibrarea necesită minimum 100 cadre și 30 cadre separate de validare.')
    if not args.capture_worker:
        # OpenCV drivers can block inside read(); a process boundary makes the timeout enforceable.
        timeout = max(60, (args.cadre + args.validare) / args.fps * 1.5 + 30)
        try:
            return subprocess.run([sys.executable, str(Path(__file__).resolve()),
                                   *sys.argv[1:], '--capture-worker'], timeout=timeout, check=False).returncode
        except subprocess.TimeoutExpired:
            print('Captura a depășit limita de timp. Închide celelalte aplicații video și reîncearcă. Modelul anterior a fost păstrat.', flush=True)
            return 2
    camera = SursaCamera(args.camera)
    try:
        print('Antrenare: păstrează scena normală, cu lumină și mișcare reprezentative.', flush=True)
        training = colecteaza(camera, args.cadre, fps=args.fps)
        artifact = antreneaza(training)
        print('Validare pe cadre noi: menține funcționarea normală.', flush=True)
        validation = colecteaza(camera, args.validare, fps=args.fps)
    finally:
        camera.elibereaza()
    report = valideaza(artifact, validation)
    print(json.dumps(report), flush=True)
    if not report['accepted']:
        print('Calibrare respinsă: prea multe abateri în scena normală. Modelul anterior a fost păstrat.', flush=True)
        return 2
    artifact.update(sursa='camera', fps=args.fps, camera_index=args.camera, validation=report,
                    reference_sharpness=float(np.expm1(np.median(training[:, 1]))))
    activeaza(artifact, args.iesire)
    print('Calibrare validată și activată. Modelul anterior a fost păstrat ca backup.', flush=True)
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
