# -*- coding: utf-8 -*-
"""Teste unitare pentru caracteristici_video (GateWatch ML-02.1).

Toate imaginile folosite sunt sintetice si generate direct in teste;
nu se citesc si nu se salveaza fisier video.
"""

import os
import sys
import unittest

import numpy as np

# Adauga directorul ml/src in calea de import, independent de contextul de rulare.
CALE_SURSE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "src")
if CALE_SURSE not in sys.path:
    sys.path.insert(0, CALE_SURSE)

from caracteristici_video import (  # noqa: E402
    EroareCadruInvalid,
    RezultatCaracteristici,
    calculeaza_caracteristici,
)


def cadru_uniform(valoare, inaltime=32, latime=32, canale=3):
    """Construieste un cadru BGR sintetic, uniform, cu valoarea data."""
    baza = np.full((inaltime, latime), valoare, dtype=np.uint8)
    return np.repeat(baza[:, :, np.newaxis], canale, axis=2)


def pattern_sah(valoare_mica=27, valoare_mare=227, pas=8, inaltime=64, latime=64):
    """Construieste un cadru BGR cu un pattern in sah, determinist si neuniform."""
    indici = np.add.outer(np.arange(inaltime), np.arange(latime))
    blocuri = ((indici // pas) % 2) * (valoare_mare - valoare_mica) + valoare_mica
    return np.repeat(blocuri.astype(np.uint8)[:, :, np.newaxis], 3, axis=2)


class TesteLuminozitate(unittest.TestCase):
    """Verifica luminozitate_medie pe cadre sintetice simple."""

    def test_cadru_complet_negru_are_luminozitate_zero(self):
        rezultat = calculeaza_caracteristici(cadru_uniform(0))
        self.assertEqual(rezultat.luminozitate_medie, 0.0)

    def test_cadru_complet_alb_are_luminozitate_255(self):
        rezultat = calculeaza_caracteristici(cadru_uniform(255))
        self.assertAlmostEqual(rezultat.luminozitate_medie, 255.0, places=6)

    def test_luminozitate_respecta_valoarea_uniforma(self):
        rezultat = calculeaza_caracteristici(cadru_uniform(120))
        self.assertAlmostEqual(rezultat.luminozitate_medie, 120.0, places=6)

    def test_luminozitate_pe_pattern_neuniform(self):
        # Pattern sah cu valori 27 si 227 => media corecta este 127.
        rezultat = calculeaza_caracteristici(pattern_sah())
        self.assertAlmostEqual(rezultat.luminozitate_medie, 127.0, places=6)


class TesteClaritate(unittest.TestCase):
    """Verifica claritatea (varianta Laplacianului)."""

    def test_imagine_uniforma_are_claritate_aproximativ_zero(self):
        for valoare in (0, 100, 255):
            with self.subTest(valoare=valoare):
                rezultat = calculeaza_caracteristici(cadru_uniform(valoare))
                self.assertAlmostEqual(rezultat.claritate, 0.0, places=6)

    def test_imagine_neuniforma_are_claritate_pozitiva(self):
        rezultat = calculeaza_caracteristici(pattern_sah())
        self.assertGreater(rezultat.claritate, 0.0)


class TesteDiferentaCadre(unittest.TestCase):
    """Verifica diferenta_cadre fata de cadrul anterior."""

    def test_primul_cadru_are_diferenta_none(self):
        # Fara cadru_anterior => None (nu 0).
        rezultat = calculeaza_caracteristici(cadru_uniform(50))
        self.assertIsNone(rezultat.diferenta_cadre)
        rezultat = calculeaza_caracteristici(cadru_uniform(50), None)
        self.assertIsNone(rezultat.diferenta_cadre)

    def test_doua_cadre_identice_produc_diferenta_zero(self):
        cadru = pattern_sah()
        rezultat = calculeaza_caracteristici(cadru, cadru)
        self.assertAlmostEqual(rezultat.diferenta_cadre, 0.0, places=6)

    def test_doua_cadre_diferite_produc_diferenta_pozitiva(self):
        rezultat = calculeaza_caracteristici(cadru_uniform(0), cadru_uniform(128))
        self.assertGreater(rezultat.diferenta_cadre, 0.0)
        # Media exacta a diferentei absolute: |0 - 128| = 128 peste tot.
        self.assertAlmostEqual(rezultat.diferenta_cadre, 128.0, places=6)

    def test_diferenta_pe_rezolutii_diferite_dupa_redimensionare(self):
        # Ambele cadre uniforme cu 10: dupa adaptarea rezolutiei, diferenta ramane 0.
        anterior = cadru_uniform(10, inaltime=16, latime=16)
        curent = cadru_uniform(10, inaltime=32, latime=32)
        rezultat = calculeaza_caracteristici(curent, anterior)
        self.assertAlmostEqual(rezultat.diferenta_cadre, 0.0, places=6)


class TesteStructuraRezultat(unittest.TestCase):
    """Verifica structura tipizata returnata."""

    def test_intoarce_structura_rezultat_caracteristici(self):
        rezultat = calculeaza_caracteristici(cadru_uniform(60), cadru_uniform(20))
        self.assertIsInstance(rezultat, RezultatCaracteristici)
        self.assertIsInstance(rezultat.luminozitate_medie, float)
        self.assertIsInstance(rezultat.claritate, float)
        self.assertIsInstance(rezultat.diferenta_cadre, float)

    def test_diferenta_none_la_primele_cadre_are_campul_float(self):
        rezultat = calculeaza_caracteristici(cadru_uniform(5))
        self.assertIsInstance(rezultat.luminozitate_medie, float)
        self.assertIsInstance(rezultat.claritate, float)
        self.assertIsNone(rezultat.diferenta_cadre)

    def test_structura_e_imutabila(self):
        rezultat = calculeaza_caracteristici(cadru_uniform(5))
        with self.assertRaises(Exception):
            rezultat.claritate = 123.0


class TesteCadreInvalide(unittest.TestCase):
    """Verifica gestionarea explicita a cadrelor invalide sau goale."""

    def test_clasa_eroare_e_subclasa_valueerror(self):
        self.assertTrue(issubclass(EroareCadruInvalid, ValueError))

    def test_cadru_none_ridica_eroare(self):
        with self.assertRaises(EroareCadruInvalid):
            calculeaza_caracteristici(None)

    def test_cadru_anterior_none_ridica_eroare_cand_e_ne_array(self):
        with self.assertRaises(EroareCadruInvalid):
            calculeaza_caracteristici(cadru_uniform(1), "nu este cadru")

    def test_cadru_gol_ridica_eroare(self):
        with self.assertRaises(EroareCadruInvalid):
            calculeaza_caracteristici(np.zeros((0, 0, 3), dtype=np.uint8))

    def test_cadru_in_1_dimensiune_ridica_eroare(self):
        with self.assertRaises(EroareCadruInvalid):
            calculeaza_caracteristici(np.zeros(5, dtype=np.uint8))

    def test_cadru_cu_canale_incorecte_ridica_eroare(self):
        with self.assertRaises(EroareCadruInvalid):
            calculeaza_caracteristici(np.zeros((4, 4, 2), dtype=np.uint8))

    def test_cadru_boolean_ridica_eroare(self):
        with self.assertRaises(EroareCadruInvalid):
            calculeaza_caracteristici(np.zeros((4, 4, 3), dtype=bool))

    def test_cadru_uint16_ridica_eroare(self):
        # Tip intreg non-uint8 este respins explicit (nu se permite rescalare).
        with self.assertRaises(EroareCadruInvalid):
            calculeaza_caracteristici(np.zeros((4, 4, 3), dtype=np.uint16))

    def test_cadru_cu_nan_ridica_eroare(self):
        cadru_nan = np.full((4, 4, 3), np.nan, dtype=np.float64)
        with self.assertRaises(EroareCadruInvalid):
            calculeaza_caracteristici(cadru_nan)

    def test_cadru_lista_python_ridica_eroare(self):
        with self.assertRaises(EroareCadruInvalid):
            calculeaza_caracteristici([[[0, 0, 0]] * 8] * 8)


class TestePrietenieCuFormateOpenCV(unittest.TestCase):
    """Verifica acceptarea variantelor legitime intr-o aplicatie OpenCV."""

    def test_cadru_in_ton_gri_2d_e_acceptat(self):
        rezultat = calculeaza_caracteristici(np.full((16, 16), 90, dtype=np.uint8))
        self.assertAlmostEqual(rezultat.luminozitate_medie, 90.0, places=6)

    def test_cadru_bgra_e_acceptat(self):
        cadru_bgra = np.zeros((16, 16, 4), dtype=np.uint8)
        cadru_bgra[:, :, :3] = 40
        rezultat = calculeaza_caracteristici(cadru_bgra)
        self.assertAlmostEqual(rezultat.luminozitate_medie, 40.0, places=6)

    def test_cadru_monocanal_3d_e_acceptat(self):
        cadru_mono = np.full((16, 16, 1), 70, dtype=np.uint8)
        rezultat = calculeaza_caracteristici(cadru_mono)
        self.assertAlmostEqual(rezultat.luminozitate_medie, 70.0, places=6)

    def test_cadre_in_float_sunt_acceptate(self):
        anterior = np.full((16, 16, 3), 10.0, dtype=np.float64)
        curent = np.full((16, 16, 3), 30.0, dtype=np.float64)
        rezultat = calculeaza_caracteristici(curent, anterior)
        self.assertAlmostEqual(rezultat.luminozitate_medie, 30.0, places=6)
        self.assertAlmostEqual(rezultat.diferenta_cadre, 20.0, places=6)


class TesteIntegritateCadruluiOriginal(unittest.TestCase):
    """Verifica ca argumentele nu sunt modificate (originalul raman neschimbate)."""

    def test_originalul_curent_nu_se_modifica(self):
        cadru = pattern_sah()
        copie = cadru.copy()
        calculeaza_caracteristici(cadru)
        self.assertTrue(np.array_equal(cadru, copie))

    def test_originalul_anterior_nu_se_modifica(self):
        cadru_curent = cadru_uniform(25)
        cadru_trecut = pattern_sah()
        copie_curent = cadru_curent.copy()
        copie_trecut = cadru_trecut.copy()
        calculeaza_caracteristici(cadru_curent, cadru_trecut)
        self.assertTrue(np.array_equal(cadru_curent, copie_curent))
        self.assertTrue(np.array_equal(cadru_trecut, copie_trecut))

    def test_originalul_nu_se_modifica_la_rezolutii_diferite(self):
        curent = cadru_uniform(9, inaltime=48, latime=48)
        anterior = pattern_sah(inaltime=24, latime=24)
        copie_curent = curent.copy()
        copie_anterior = anterior.copy()
        calculeaza_caracteristici(curent, anterior)
        self.assertTrue(np.array_equal(curent, copie_curent))
        self.assertTrue(np.array_equal(anterior, copie_anterior))


if __name__ == "__main__":
    unittest.main(verbosity=2)
