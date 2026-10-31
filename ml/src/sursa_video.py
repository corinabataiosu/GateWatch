# -*- coding: utf-8 -*-
"""Surse de cadre pentru modulul video GateWatch (ML-02.2).

- SursaCamera: camera reala a laptopului, prin OpenCV (cv2.VideoCapture);
- SursaSintetica: scena generata determinist (hol de terminal cu persoane in
  miscare si zgomot de senzor), folosita la demonstratii si la teste, fara
  camera fizica.

Sursa sintetica poate simula modificari ale imaginii pe care un sistem de
supraveghere trebuie sa le semnaleze:

- "obturare": obiectiv acoperit (imagine aproape neagra);
- "orbire": obiectiv orbit de o sursa puternica de lumina (imagine saturata);
- "defocalizare": imagine neclara (obiectiv deplasat sau murdar);
- "inghetare": acelasi cadru repetat (flux inghetat sau reluat).

Modulul nu salveaza nicio imagine.
"""

import cv2
import numpy as np

MODURI_SINTETICE = ("normal", "obturare", "orbire", "defocalizare", "inghetare")


class EroareSursaVideo(RuntimeError):
    """Sursa video nu poate furniza cadre (camera indisponibila etc.)."""


class SursaSintetica:
    """Scena sintetica BGR, determinista pentru o valoare data a seed-ului."""

    def __init__(self, latime=320, inaltime=240, seed=0):
        self.latime = latime
        self.inaltime = inaltime
        self._rng = np.random.default_rng(seed)
        self._fundal = self._construieste_fundal()
        self._persoane = [
            {
                "x": float(self._rng.uniform(0, latime)),
                "y": float(self._rng.uniform(inaltime * 0.45, inaltime * 0.8)),
                "vx": float(self._rng.uniform(-3, 3)),
                "culoare": tuple(int(c) for c in self._rng.integers(30, 200, 3)),
            }
            for _ in range(int(self._rng.integers(2, 9)))
        ]
        # Fiecare scena are propriul nivel de zgomot al senzorului.
        self._zgomot = float(self._rng.uniform(2.0, 4.0))
        self._cadru_anterior = None
        self._index = 0

    def _construieste_fundal(self):
        # Pardoseala in carouri, pereti si o fereastra luminoasa: suficiente
        # contururi pentru o claritate realista.
        fundal = np.full((self.inaltime, self.latime, 3), 150, dtype=np.uint8)
        pas = 20
        for y in range(self.inaltime // 2, self.inaltime, pas):
            for x in range(0, self.latime, pas):
                if (x // pas + y // pas) % 2:
                    fundal[y:y + pas, x:x + pas] = 120
        fundal[: self.inaltime // 2] = (175, 170, 160)
        cv2.rectangle(fundal, (40, 20), (140, 90), (230, 225, 210), -1)
        cv2.rectangle(fundal, (200, 25), (290, 95), (90, 80, 70), 2)
        cv2.putText(fundal, "GATE 4", (205, 70), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (40, 40, 40), 2)
        return fundal

    def citeste(self, mod="normal", iluminare=1.0):
        """Intoarce urmatorul cadru BGR uint8 pentru modul cerut."""
        if mod not in MODURI_SINTETICE:
            raise ValueError(f"mod necunoscut {mod!r}; moduri: {', '.join(MODURI_SINTETICE)}")
        self._index += 1

        if mod == "inghetare" and self._cadru_anterior is not None:
            return self._cadru_anterior.copy()

        cadru = self._fundal.copy()
        for persoana in self._persoane:
            persoana["x"] = (persoana["x"] + persoana["vx"]) % self.latime
            x, y = int(persoana["x"]), int(persoana["y"])
            cv2.rectangle(cadru, (x - 6, y - 30), (x + 6, y), persoana["culoare"], -1)
            cv2.circle(cadru, (x, y - 36), 6, persoana["culoare"], -1)

        lucru = cadru.astype(np.float64) * iluminare
        if mod == "obturare":
            lucru = np.full_like(lucru, 8.0)
        elif mod == "orbire":
            lucru = 0.15 * lucru + 0.85 * 252.0
        elif mod == "defocalizare":
            lucru = cv2.GaussianBlur(lucru, (0, 0), 6)

        zgomot = 1.0 if mod == "obturare" else self._zgomot
        lucru = lucru + self._rng.normal(0, zgomot, lucru.shape)
        cadru = np.clip(lucru, 0, 255).astype(np.uint8)
        self._cadru_anterior = cadru
        return cadru

    def elibereaza(self):
        """Compatibilitate cu SursaCamera; nu exista resurse de eliberat."""


class SursaCamera:
    """Camera fizica (index OpenCV)."""

    def __init__(self, index=0):
        self._captura = cv2.VideoCapture(index)
        if not self._captura.isOpened():
            raise EroareSursaVideo(f"camera cu indexul {index} nu poate fi deschisa")

    def citeste(self, mod="normal", iluminare=1.0):
        # Modul si iluminarea se aplica doar sursei sintetice; camera reala livreaza ce vede.
        reusit, cadru = self._captura.read()
        if not reusit or cadru is None:
            raise EroareSursaVideo("camera nu a returnat niciun cadru")
        return cadru

    def elibereaza(self):
        self._captura.release()
