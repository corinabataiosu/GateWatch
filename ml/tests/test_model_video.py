# -*- coding: utf-8 -*-
"""Teste pentru sursa sintetica, modelul video (ML-02.2) si telemetria agentului.

Toate cadrele sunt sintetice; nu se foloseste camera si nu se salveaza imagini.
"""

import os
import sys
import tempfile
import unittest

import joblib

CALE_SURSE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "src")
if CALE_SURSE not in sys.path:
    sys.path.insert(0, CALE_SURSE)

from agent_video import construieste_telemetrie  # noqa: E402
from caracteristici_video import calculeaza_caracteristici  # noqa: E402
from model_video import (  # noqa: E402
    CALE_MODEL_IMPLICIT,
    NUME_CARACTERISTICI,
    DetectorVideo,
    antreneaza,
    colecteaza_sintetic,
)
from sursa_video import MODURI_SINTETICE, SursaSintetica  # noqa: E402


def evaluari(detector, mod, seed, cadre=40):
    """Evaluarile cadrelor unei scene noi: 5 cadre normale, apoi modul cerut."""
    sursa, anterior, rezultate = SursaSintetica(seed=seed), None, []
    for index in range(cadre):
        cadru = sursa.citeste("normal" if index < 5 else mod)
        evaluare = detector.evalueaza(calculeaza_caracteristici(cadru, anterior))
        anterior = cadru
        if evaluare is not None and index >= 6:
            rezultate.append(evaluare)
    return rezultate


class TesteSursaSintetica(unittest.TestCase):
    def test_aceeasi_seed_aceleasi_cadre(self):
        a, b = SursaSintetica(seed=3), SursaSintetica(seed=3)
        for _ in range(3):
            self.assertTrue((a.citeste() == b.citeste()).all())

    def test_inghetarea_repeta_exact_cadrul(self):
        sursa = SursaSintetica(seed=1)
        primul = sursa.citeste("inghetare")
        self.assertTrue((sursa.citeste("inghetare") == primul).all())

    def test_mod_necunoscut_este_respins(self):
        with self.assertRaises(ValueError):
            SursaSintetica().citeste("teleportare")


class TesteDetectorVideo(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.director = tempfile.TemporaryDirectory()
        cale = os.path.join(cls.director.name, "video.joblib")
        joblib.dump(antreneaza(colecteaza_sintetic(1600, seed=42)), cale)
        cls.detector = DetectorVideo(cale)

    @classmethod
    def tearDownClass(cls):
        cls.director.cleanup()

    def test_scene_normale_noi_nu_sunt_semnalate(self):
        for seed in (101, 202):
            rezultate = evaluari(self.detector, "normal", seed)
            self.assertFalse(any(anomalie for _, anomalie, _ in rezultate), f"seed {seed}")

    def test_fiecare_modificare_a_imaginii_este_semnalata(self):
        for mod in MODURI_SINTETICE[1:]:
            with self.subTest(mod=mod):
                rezultate = evaluari(self.detector, mod, seed=101)
                self.assertTrue(all(anomalie for _, anomalie, _ in rezultate))

    def test_cauza_este_numita(self):
        _, _, in_afara = evaluari(self.detector, "obturare", seed=101)[-1]
        self.assertIn("luminozitate_medie", in_afara)
        _, _, in_afara = evaluari(self.detector, "inghetare", seed=101)[-1]
        self.assertEqual(in_afara, ["diferenta_cadre"])

    def test_cadrul_initial_nu_este_evaluat(self):
        cadru = SursaSintetica().citeste()
        self.assertIsNone(self.detector.evalueaza(calculeaza_caracteristici(cadru)))


class TesteArtefactSalvat(unittest.TestCase):
    def test_artefactul_din_depozit_se_incarca(self):
        detector = DetectorVideo(CALE_MODEL_IMPLICIT)
        self.assertTrue(detector.versiune.startswith("video-iforest"))
        self.assertEqual(len(detector.domeniu_min), len(NUME_CARACTERISTICI))


class TesteTelemetrie(unittest.TestCase):
    def test_corpul_respecta_contractul_soc(self):
        sursa = SursaSintetica(seed=5)
        anterior = sursa.citeste()
        rezultat = calculeaza_caracteristici(sursa.citeste(), anterior)
        corp = construieste_telemetrie("CAM-01", rezultat, (0.5, False, []), 0.63, "video-iforest-x", "synthetic")
        self.assertEqual(
            set(corp),
            {"device_id", "captured_at", "brightness", "sharpness", "frame_diff", "score", "threshold",
             "is_anomaly", "out_of_range", "model_version", "source"},
        )
        self.assertEqual(corp["device_id"], "CAM-01")
        self.assertTrue(corp["captured_at"].endswith("Z"))
        self.assertIs(corp["is_anomaly"], False)


if __name__ == "__main__":
    unittest.main()


class TesteFluxVideo(unittest.TestCase):
    def test_serverul_publica_ultimul_cadru_jpeg(self):
        import urllib.request

        from flux_video import PublicatorCadre, porneste_server

        publicator = PublicatorCadre()
        server = porneste_server(publicator, 0)  # port liber ales de sistem
        try:
            port = server.server_address[1]
            publicator.publica(SursaSintetica(seed=2).citeste())
            with urllib.request.urlopen(f"http://127.0.0.1:{port}/cadru.jpg", timeout=3) as raspuns:
                self.assertEqual(raspuns.headers["Content-Type"], "image/jpeg")
                self.assertEqual(raspuns.read(2), b"\xff\xd8")  # antet JPEG
        finally:
            server.shutdown()
