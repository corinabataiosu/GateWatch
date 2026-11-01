# -*- coding: utf-8 -*-
"""Agentul video GateWatch: cadre -> caracteristici (ML-02.1) -> scor (ML-02.2) -> SOC.

Agentul citeste cadre de la o sursa (camera reala sau scena sintetica), calculeaza
caracteristicile fiecarui cadru, le evalueaza cu modelul video si trimite o data
pe secunda telemetria catre SOC (POST /api/video/telemetry). SOC-ul decide daca
o imagine atipica devine alerta; agentul nu declara atacuri.

Exemple (din radacina proiectului, cu SOC-ul pornit):
    python ml/src/agent_video.py                                   # scena sintetica normala
    python ml/src/agent_video.py --scenariu obturare --dupa 15     # obiectiv acoperit dupa 15 s
    python ml/src/agent_video.py --sursa camera --model ml/models/video_camera.joblib

Agentul publica si cadrele analizate ca flux MJPEG: http://127.0.0.1:8002/flux.mjpg
"""

import argparse
import json
import sys
import time
import urllib.error
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

from caracteristici_video import RezultatCaracteristici, calculeaza_caracteristici
from flux_video import PublicatorCadre, porneste_server
from model_video import CALE_MODEL_IMPLICIT, DetectorVideo
from sursa_video import MODURI_SINTETICE, EroareSursaVideo, SursaCamera, SursaSintetica
from esantionare_video import FPS_IMPLICIT, RitmCadre, fps_valid


def construieste_telemetrie(id_camera, rezultat: RezultatCaracteristici, evaluare, prag, versiune, sursa):
    """Corpul cererii catre SOC (contract: docs/contracts.md, telemetrie video)."""
    scor, este_anomalie, in_afara = evaluare
    return {
        "device_id": id_camera,
        "captured_at": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S.%f")[:-3] + "Z",
        "brightness": round(rezultat.luminozitate_medie, 2),
        "sharpness": round(rezultat.claritate, 2),
        "frame_diff": None if rezultat.diferenta_cadre is None else round(rezultat.diferenta_cadre, 3),
        "score": round(scor, 4),
        "threshold": round(prag, 4),
        "is_anomaly": bool(este_anomalie),
        "out_of_range": list(in_afara),
        "model_version": versiune,
        "source": sursa,
    }


def trimite(url_soc, token, telemetrie):
    cerere = urllib.request.Request(
        url_soc.rstrip("/") + "/api/video/telemetry",
        data=json.dumps(telemetrie).encode("utf-8"),
        method="POST",
        headers={"Content-Type": "application/json", "X-Admin-Token": token},
    )
    with urllib.request.urlopen(cerere, timeout=3) as raspuns:
        return json.load(raspuns)


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--sursa", choices=("sintetica", "camera"), default="sintetica")
    parser.add_argument("--camera", type=int, default=0, help="indexul camerei OpenCV")
    parser.add_argument("--id-camera", default="CAM-01")
    parser.add_argument("--scenariu", choices=MODURI_SINTETICE, default="normal",
                        help="modificarea simulata a imaginii (doar sursa sintetica)")
    parser.add_argument("--dupa", type=float, default=0, help="secunde de imagine normala inainte de scenariu")
    parser.add_argument("--durata", type=float, default=0, help="secunde de rulare (0 = pana la Ctrl+C)")
    parser.add_argument("--fps", type=fps_valid, default=FPS_IMPLICIT)
    parser.add_argument("--model", default=None)
    parser.add_argument("--soc", default="http://127.0.0.1:8000")
    parser.add_argument("--token", default="gatewatch-admin")
    parser.add_argument("--port-flux", type=int, default=8002,
                        help="port pentru fluxul MJPEG (http://127.0.0.1:PORT/flux.mjpg); 0 = dezactivat")
    args = parser.parse_args()

    model = args.model or (str(Path(__file__).resolve().parents[1] / 'models/video_camera.joblib')
                           if args.sursa == 'camera' else CALE_MODEL_IMPLICIT)
    detector = DetectorVideo(model)
    if args.sursa == 'camera':
        if detector.sursa != 'camera' or detector.fps != args.fps:
            parser.error('Webcam-ul necesită un model calibrat pe cameră la același FPS. Rulează calibrare_camera.py.')
        if detector.camera_index is not None and detector.camera_index != args.camera:
            parser.error('Modelul este calibrat pentru alt index de cameră.')
        if not detector.calibration_validated or detector.reference_sharpness is None:
            parser.error('Modelul camerei nu are validare separată. Rulează calibrare_camera.py înainte de pornire.')
    sursa = SursaSintetica() if args.sursa == "sintetica" else SursaCamera(args.camera)
    eticheta_sursa = "synthetic" if args.sursa == "sintetica" else "camera"
    print(f"agent video {args.id_camera}: sursa {args.sursa}, model {detector.versiune}, prag {detector.prag:.3f}")

    publicator = None
    server = None

    start = time.monotonic()
    ultima_trimitere = 0.0
    anterior = None
    ritm = RitmCadre(args.fps)
    try:
        if args.port_flux:
            publicator = PublicatorCadre()
            server = porneste_server(publicator, args.port_flux)
            print(f"flux video: http://127.0.0.1:{args.port_flux}/flux.mjpg")
        while not args.durata or time.monotonic() - start < args.durata:
            ritm.asteapta_cadru()
            mod = args.scenariu if time.monotonic() - start >= args.dupa else "normal"
            try:
                cadru = sursa.citeste(mod)
            except EroareSursaVideo as eroare:
                if args.sursa != "camera":
                    raise
                # Do not score a cached frame or compare across a capture outage.
                anterior = None
                print(f"camera indisponibila: {eroare}; reincercare in 1 s", file=sys.stderr, flush=True)
                time.sleep(1.0)
                continue
            rezultat = calculeaza_caracteristici(cadru, anterior)
            anterior = cadru
            if publicator:
                publicator.publica(cadru)
            evaluare = detector.evalueaza(rezultat)
            if evaluare is not None and time.monotonic() - ultima_trimitere >= 1.0:
                ultima_trimitere = time.monotonic()
                telemetrie = construieste_telemetrie(args.id_camera, rezultat, evaluare, detector.prag,
                                                     detector.versiune, eticheta_sursa)
                telemetrie['reference_sharpness'] = detector.reference_sharpness
                stare = "ANOMALIE" if telemetrie["is_anomaly"] else "normal"
                try:
                    raspuns = trimite(args.soc, args.token, telemetrie)
                    alerta = f" -> alerta {raspuns['alert_id']}" if raspuns.get("alert_id") else ""
                except (urllib.error.URLError, OSError) as eroare:
                    alerta = f" (SOC indisponibil: {getattr(eroare, 'reason', eroare)})"
                print(f"[{mod:<12}] lum {telemetrie['brightness']:6.1f}  clar {telemetrie['sharpness']:8.1f}  "
                      f"dif {telemetrie['frame_diff']:5.2f}  scor {telemetrie['score']:.3f}  {stare}{alerta}",
                      flush=True)
    except KeyboardInterrupt:
        pass
    except EroareSursaVideo as eroare:
        print(f"eroare sursa video: {eroare}", file=sys.stderr)
        return 2
    finally:
        sursa.elibereaza()
        if server:
            server.shutdown()
            server.server_close()
    return 0


if __name__ == "__main__":
    sys.exit(main())
