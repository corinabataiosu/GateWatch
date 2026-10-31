# -*- coding: utf-8 -*-
"""Testarea capturii video pentru GateWatch (sarcina ML-01).

Script simplu de verificare a camerei conectate la laptop:
- deschide camera indicata prin argumentul --index-camera (implicit 0);
- afiseaza fluxul live intr-o fereastra OpenCV;
- suprapune peste imagine indexul camerei, numarul cadrelor si FPS aproximativ;
- se inchide la apasarea tastei Q;
- elibereaza resursele in bloc finally, inclusiv in caz de eroare;
- nu salveaza fotografii, cadre sau inregistrari.

Acest script este fundamentul viitorului modul de detectie a anomaliilor
video cu Isolation Forest (ML-02+).
"""

import argparse
import sys
import time

import cv2
from sursa_video import deschide_camera, EroareSursaVideo


NUME_FEREASTRA = "GateWatch - testare camera"
TASTE_IESIRE = {"q", "Q"}


def proceseaza_argumente():
    """Citeste argumentele din linia de comanda."""
    parser = argparse.ArgumentParser(
        description="Testeaza captura video de la camera conectata la laptop (GateWatch ML-01)."
    )
    parser.add_argument(
        "--index-camera",
        type=int,
        default=0,
        metavar="INDEX",
        help="indexul camerei OpenCV folosit pentru deschidere (implicit: 0)",
    )
    return parser.parse_args()


def ruleaza_flux_video(index_camera):
    """Deschide camera, afiseaza fluxul si intoarce codul de iesire.

    Coduri de iesire: 0 = flux rulat normal, 1 = eroare de deschidere sau citire.
    """
    # Codul de iesire presupus reusit; se schimba in 1 la prima eroare.
    cod_iesire = 0
    numar_cadre = 0
    captura = None
    camera_deschisa = False

    try:
        captura = deschide_camera(index_camera)

        if not captura.isOpened():
            print(f"[EROARE] Nu s-a putut deschide camera cu indexul {index_camera}.")
            print("[INFO] Verifica conexiunea camerei sau incearca alt index (de exemplu 1).")
            return 1

        print(f"[INFO] Camera {index_camera} deschisa. Apasa Q in fereastra video pentru iesire.")

        timp_start = time.perf_counter()
        camera_deschisa = True

        while True:
            reusita, cadru = captura.read()

            if not reusita or cadru is None:
                print("[EROARE] Citirea cadrului a esuat (camera deconectata sau flux intrerupt).")
                cod_iesire = 1
                break

            numar_cadre += 1

            # FPS aproximativ: total cadre / timp scurs de la deschidere.
            timp_scurs = time.perf_counter() - timp_start
            if timp_scurs > 0:
                fps_aprox = numar_cadre / timp_scurs
            else:
                fps_aprox = 0.0

            text_hud = (
                f"Camera: {index_camera} | Cadre: {numar_cadre} | FPS aprox: {fps_aprox:.1f}"
            )
            cv2.putText(
                cadru,
                text_hud,
                (10, 30),
                cv2.FONT_HERSHEY_SIMPLEX,
                0.7,
                (0, 255, 0),
                2,
                cv2.LINE_AA,
            )
            cv2.imshow(NUME_FEREASTRA, cadru)

            # waitKey(1) mentine fereastra responsiva si citeste tastele.
            tasta = cv2.waitKey(1) & 0xFF
            if chr(tasta) in TASTE_IESIRE:
                print("[INFO] Iesire ceruta de utilizator (tasta Q).")
                break

    except (cv2.error, EroareSursaVideo) as exceptie:
        print(f"[EROARE] Eroare OpenCV in timpul capturii: {exceptie}")
        cod_iesire = 1
    except KeyboardInterrupt:
        print("[INFO] Intrerupt de utilizator (Ctrl+C).")
    finally:
        if captura is not None:
            captura.release()
        if camera_deschisa:
            print("[INFO] Camera a fost eliberata.")
        cv2.destroyAllWindows()
        print(f"[INFO] Resurse eliberate. Cadre procesate: {numar_cadre}.")

    return cod_iesire


def principal():
    """Punct de intrare al scriptului."""
    argumente = proceseaza_argumente()
    return ruleaza_flux_video(argumente.index_camera)


if __name__ == "__main__":
    sys.exit(principal())
