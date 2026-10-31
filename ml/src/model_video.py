# -*- coding: utf-8 -*-
"""Modelul Isolation Forest pentru caracteristicile video GateWatch (ML-02.2).

Intrarea modelului este vectorul calculat de caracteristici_video (ML-02.1):
    [luminozitate_medie, log(1 + claritate), diferenta_cadre]
Claritatea (varianta Laplacianului) nu are limita superioara, de aceea se
foloseste logaritmul ei. Cadrele fara cadru anterior (diferenta None) nu sunt
evaluate.

Modelul invata doar functionarea normala; un scor peste prag inseamna
"imagine atipica", nu "atac confirmat". Decizia de securitate ramane la SOC.

Isolation Forest nu extrapoleaza: un cadru complet negru primeste acelasi scor
ca cel mai intunecat cadru normal vazut la antrenare. De aceea artefactul
pastreaza si domeniul invatat (min/max pe fiecare caracteristica, cu o marja);
o valoare in afara domeniului este semnalata explicit, cu numele caracteristicii.

Antrenare (din radacina proiectului):
    python ml/src/model_video.py --sursa sintetica --cadre 3000
    python ml/src/model_video.py --sursa camera --cadre 600 --iesire ml/models/video_camera.joblib
"""

import argparse
import json
import math
import os
import sys
from datetime import datetime, timezone

import joblib
import numpy as np
from sklearn.ensemble import IsolationForest

from caracteristici_video import RezultatCaracteristici, calculeaza_caracteristici
from sursa_video import SursaCamera, SursaSintetica

DIRECTOR_MODELE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "models")
CALE_MODEL_IMPLICIT = os.path.normpath(os.path.join(DIRECTOR_MODELE, "video_iforest.joblib"))
NUME_CARACTERISTICI = ["luminozitate_medie", "claritate_log", "diferenta_cadre"]
PERCENTILA_PRAG = 99.5
# Marja domeniului invatat, ca fractie din amplitudinea observata pe fiecare caracteristica.
MARJA_DOMENIU = 0.25


def vector(rezultat: RezultatCaracteristici):
    """Vectorul de intrare al modelului sau None daca lipseste diferenta dintre cadre."""
    if rezultat.diferenta_cadre is None:
        return None
    return [rezultat.luminozitate_medie, math.log1p(rezultat.claritate), rezultat.diferenta_cadre]


def colecteaza(sursa, numar_cadre, iluminare_variabila=False):
    """Citeste cadre normale si intoarce matricea de caracteristici."""
    randuri, anterior = [], None
    for index in range(numar_cadre):
        # Pentru sursa sintetica: iluminarea variaza lent (zi / seara), ca modelul
        # sa nu considere anormala orice schimbare de lumina ambientala.
        iluminare = 0.95 + 0.2 * math.sin(index / 150.0) if iluminare_variabila else 1.0
        cadru = sursa.citeste("normal", iluminare)
        rand = vector(calculeaza_caracteristici(cadru, anterior))
        if rand is not None:
            randuri.append(rand)
        anterior = cadru
    return np.asarray(randuri, dtype=np.float64)


def colecteaza_sintetic(numar_cadre, seed, scene=8):
    """Cadre normale din mai multe scene sintetice (persoane, zgomot, lumina diferite)."""
    pe_scena = max(2, numar_cadre // scene)
    return np.vstack([colecteaza(SursaSintetica(seed=seed + i), pe_scena, iluminare_variabila=True)
                      for i in range(scene)])


def antreneaza(X, seed=42):
    model = IsolationForest(n_estimators=200, max_samples=min(512, len(X)), random_state=seed)
    model.fit(X)
    scoruri = -model.score_samples(X)
    acum = datetime.now(timezone.utc)
    return {
        "model": model,
        "caracteristici": NUME_CARACTERISTICI,
        "prag": float(np.percentile(scoruri, PERCENTILA_PRAG)),
        "versiune": f"video-iforest-{acum:%Y%m%d%H%M}",
        "antrenat_la": acum.isoformat(),
        "esantioane": int(len(X)),
        "medie": X.mean(axis=0).tolist(),
        "abatere": X.std(axis=0).tolist(),
        "domeniu_min": (X.min(axis=0) - MARJA_DOMENIU * np.ptp(X, axis=0)).tolist(),
        "domeniu_max": (X.max(axis=0) + MARJA_DOMENIU * np.ptp(X, axis=0)).tolist(),
    }


class DetectorVideo:
    """Incarca artefactul salvat si evalueaza rezultatele ML-02.1."""

    def __init__(self, cale=CALE_MODEL_IMPLICIT):
        if not os.path.exists(cale):
            raise FileNotFoundError(f"modelul video nu exista la {cale}; ruleaza model_video.py")
        artefact = joblib.load(cale)
        if artefact.get("caracteristici") != NUME_CARACTERISTICI:
            raise ValueError("artefactul video are alte caracteristici; reantreneaza modelul")
        self.model = artefact["model"]
        self.prag = float(artefact["prag"])
        self.versiune = artefact["versiune"]
        self.domeniu_min = np.asarray(artefact["domeniu_min"])
        self.domeniu_max = np.asarray(artefact["domeniu_max"])

    def evalueaza(self, rezultat: RezultatCaracteristici):
        """Intoarce (scor, este_anomalie, caracteristici_in_afara_domeniului) sau None pentru cadrul initial."""
        rand = vector(rezultat)
        if rand is None:
            return None
        x = np.asarray(rand)
        scor = float(-self.model.score_samples(x[np.newaxis, :])[0])
        in_afara = [nume for nume, valoare, minim, maxim
                    in zip(NUME_CARACTERISTICI, x, self.domeniu_min, self.domeniu_max)
                    if valoare < minim or valoare > maxim]
        return scor, scor >= self.prag or bool(in_afara), in_afara


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--sursa", choices=("sintetica", "camera"), default="sintetica")
    parser.add_argument("--camera", type=int, default=0, help="indexul camerei OpenCV")
    parser.add_argument("--cadre", type=int, default=3000)
    parser.add_argument("--seed", type=int, default=42)
    parser.add_argument("--iesire", default=CALE_MODEL_IMPLICIT)
    args = parser.parse_args()

    if args.sursa == "sintetica":
        X = colecteaza_sintetic(args.cadre, args.seed)
    else:
        sursa = SursaCamera(args.camera)
        try:
            X = colecteaza(sursa, args.cadre)
        finally:
            sursa.elibereaza()
    artefact = antreneaza(X, args.seed)
    os.makedirs(os.path.dirname(os.path.abspath(args.iesire)), exist_ok=True)
    joblib.dump(artefact, args.iesire)
    fisa = {k: v for k, v in artefact.items() if k != "model"}
    fisa["sursa"] = args.sursa
    with open(os.path.splitext(args.iesire)[0] + "_card.json", "w", encoding="utf-8") as fisier:
        json.dump(fisa, fisier, indent=2)
    print(f"model salvat: {args.iesire} ({artefact['esantioane']} esantioane, prag {artefact['prag']:.3f})")
    return 0


if __name__ == "__main__":
    sys.exit(main())
