# -*- coding: utf-8 -*-
"""Extragerea caracteristicilor numerice din cadre video pentru GateWatch (ML-02.1).

Modulul este independent de captura live: primeste cadre deja disponibile
(numpy.ndarray in format OpenCV BGR) si calculeaza doar caracteristici numerice,
care vor fi intr-o etapa ulterioara intrarea pentru modelul Isolation Forest
(ML-02.2):

- luminozitate_medie: media imaginii grayscale, pe intervalul 0-255
  (0 = negru, 255 = alb);
- claritate: varianta Laplacianului aplicat pe imaginea grayscale
  (valori mari => contururi clare; valori mici => imagine uniforma sau inceta);
- diferenta_cadre: media diferentei absolute fata de cadrul anterior
  (valori mari => miscare/schimbare in scena); None cand nu exista
  cadru anterior, NU zero.

Restrictiile modulului: nu clasifica cadre in "atac"/"anomalie", nu introduce
praguri de alerta, nu modifica imaginile primite ca argumente si nu salveaza
nicio data video.
"""

from dataclasses import dataclass

import cv2
import numpy as np


class EroareCadruInvalid(ValueError):
    """Eroare ridicata cand cadrul primit nu poate fi analizat.

    Deriva din ValueError pentru a fi compatibila cu exceptiile standard.
    Acopera: cadre None, gol, cu dimensiuni incorecte sau cu tip nenumeric.
    """

    pass


@dataclass(frozen=True)
class RezultatCaracteristici:
    """Structura tipizata si fixa (imutabila) cu caracteristicile unui cadru.

    Campuri:
    - luminozitate_medie: media valorilor grayscale, interval 0-255;
    - claritate: varianta Laplacianului pe grayscale (masura a contururilor);
    - diferenta_cadre: media |gri_curent - gri_anterior| pe 0-255,
      sau None daca nu s-a primit un cadru anterior.
    """

    luminozitate_medie: float
    claritate: float
    diferenta_cadre: float | None = None


def _pregateste_grayscale(imagine: "np.ndarray", nume_argument: str) -> "np.ndarray":
    """Valideaza cadrul si intoarce versiunea grayscale in float64.

    Se aplica aceeasi validare si aceeasi conversie pentru orice cadru,
    astfel incat preprocesarea sa fie identica pentru cadru si cadrul anterior.
    Rezultatul este o matrice NOUA: originalul nu este modificat.

    Ridica EroareCadruInvalid pentru orice intrare inacceptabila.
    """
    if imagine is None:
        raise EroareCadruInvalid(
            f"Argumentul '{nume_argument}' este None; nu exista cadru de analizat."
        )
    if not isinstance(imagine, np.ndarray):
        raise EroareCadruInvalid(
            f"Argumentul '{nume_argument}' trebuie sa fie numpy.ndarray; "
            f"a primit {type(imagine).__name__}."
        )
    if imagine.ndim not in (2, 3):
        raise EroareCadruInvalid(
            f"Argumentul '{nume_argument}' trebuie sa fie 2D (ton gri) sau 3D (BGR); "
            f"a primit un tablou cu {imagine.ndim} dimensiuni."
        )
    canale = 1 if imagine.ndim == 2 else imagine.shape[2]
    if canale not in (1, 3, 4):
        raise EroareCadruInvalid(
            f"Argumentul '{nume_argument}' are {canale} canale; "
            "se accepta 1 (ton gri), 3 (BGR) sau 4 (BGRA)."
        )
    if imagine.size == 0:
        raise EroareCadruInvalid(
            f"Argumentul '{nume_argument}' este gol (are 0 pixeli)."
        )
    # Se accepta uint8 (cazul normal, cadru OpenCV BGR) sau tipuri flotante.
    # uint16 etc. sunt respinse explicit pentru ca cvtColor le rescaleaza si
    # ar schimba semnificatia intervalului 0-255.
    e_flotant = np.issubdtype(imagine.dtype, np.floating)
    if imagine.dtype != np.uint8 and not e_flotant:
        raise EroareCadruInvalid(
            f"Argumentul '{nume_argument}' are tipul {imagine.dtype}, neacceptat; "
            "foloseste uint8 sau float (32/64)."
        )
    if e_flotant and not np.isfinite(imagine).all():
        raise EroareCadruInvalid(
            f"Argumentul '{nume_argument}' contine valori nevalabile (NaN sau infinit)."
        )

    # Conversie intr-o matrice noua, contigua, in float64 - originalul ramane intact.
    flotant = np.ascontiguousarray(imagine, dtype=np.float64)

    if canale == 1:
        # Cadru deja in ton gri (2D sau 3D cu un singur canal).
        return flotant if imagine.ndim == 2 else np.ascontiguousarray(flotant[:, :, 0])
    if imagine.dtype == np.uint8:
        # Calea oficiala OpenCV pentru 8 biti: BGR/BGRA -> grayscale, apoi float64.
        cod_conversie = cv2.COLOR_BGRA2GRAY if canale == 4 else cv2.COLOR_BGR2GRAY
        gri = cv2.cvtColor(imagine, cod_conversie).astype(np.float64)
    else:
        # OpenCV 5 nu accepta CV_64F in cvtColor; calculam manual, cu
        # aceleasi ponderi ca OpenCV (R=0.299, G=0.587, B=0.114) si canalele in ordine BGR.
        # Rezultatul este numeric identic cu calea uint8 pentru valori uniforme.
        gri = (
            0.299 * flotant[:, :, 2]
            + 0.587 * flotant[:, :, 1]
            + 0.114 * flotant[:, :, 0]
        )
    return gri


def calculeaza_caracteristici(
    cadru: "np.ndarray",
    cadru_anterior: "np.ndarray | None" = None,
) -> RezultatCaracteristici:
    """Calculeaza caracteristicile numerice ale unui cadru OpenCV BGR.

    Argumente:
        cadru: numpy.ndarray 2D (ton gri) sau 3D (BGR, BGRA), uint8 sau float;
            se presupune ca valorile stau pe intervalul 0-255.
        cadru_anterior: cadru de referinta pentru diferenta; daca este None
            (cadru initial), diferenta_cadre este None, NU zero.

    Pentru diferenta dintre cadre se foloseste aceeasi preprocesare pentru
    ambele imagini (grayscale float64, validari identice); daca rezolutia
    difera, cadrul anterior este redimensionat la rezolutia cadrului curent,
    ca diferentele sa fie comparabile pixel cu pixel.

    Intoarce: RezultatCaracteristici cu:
        luminozitate_medie (float): media grayscale, interval 0-255;
        claritate (float): varianta Laplacianului pe grayscale (masura a contururilor);
        diferenta_cadre (float | None): media diferentei absolute fata de
            cadrul anterior, sau None cand nu exista cadru anterior.

    Ridica EroareCadruInvalid cand un cadru este invalid (None, gol,
    dimensiuni incorecte, tip neacceptat, valori NaN/infinit).

    Nota: nu clasifica cadrul si nu aplica praguri; imaginile primite ca
    argumente nu sunt modificati.
    """
    gri = _pregateste_grayscale(cadru, nume_argument="cadru")

    # Media pe matricea grayscale completa; float() da un tip simplu si clar.
    luminozitate_medie = float(np.mean(gri))

    # Claritate Clasica: varianta Laplacianului (CV_64F pastreaza precizia).
    claritate = float(np.var(cv2.Laplacian(gri, cv2.CV_64F)))

    diferenta_cadre = None
    if cadru_anterior is not None:
        gri_anterior = _pregateste_grayscale(
            cadru_anterior, nume_argument="cadru_anterior"
        )
        if gri_anterior.shape != gri.shape:
            # Aceeasi rezolutie pentru ambele cadre: cadrul anterior este
            # adus la forma cadrului curent (cv2.resize primeste (latime, inaltime)).
            gri_anterior = cv2.resize(
                gri_anterior,
                (gri.shape[1], gri.shape[0]),
                interpolation=cv2.INTER_LINEAR,
            )
        # Conversia in float64 face sigura diferenta absoluta (fara depasiri uint8).
        diferenta_cadre = float(np.mean(np.abs(gri - gri_anterior)))

    return RezultatCaracteristici(
        luminozitate_medie=luminozitate_medie,
        claritate=claritate,
        diferenta_cadre=diferenta_cadre,
    )
