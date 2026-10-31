# -*- coding: utf-8 -*-
"""Flux MJPEG local pentru cadrele analizate de agentul video.

Agentul publica ultimul cadru citit; serverul il transmite browserului ca flux
multipart/x-mixed-replace (MJPEG), afisabil direct intr-un element <img>.
Cadrele sunt tinute doar in memorie si nu sunt salvate pe disc.

    GET /flux.mjpg   fluxul video
    GET /cadru.jpg   ultimul cadru, o singura imagine
"""

import threading
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

import cv2

LIMITA = b"cadru"


class PublicatorCadre:
    """Pastreaza ultimul cadru codat JPEG, partajat intre agent si server."""

    def __init__(self, calitate=80):
        self._calitate = calitate
        self._jpeg = None
        self._conditie = threading.Condition()

    def publica(self, cadru):
        reusit, codat = cv2.imencode(".jpg", cadru, [cv2.IMWRITE_JPEG_QUALITY, self._calitate])
        if reusit:
            with self._conditie:
                self._jpeg = codat.tobytes()
                self._conditie.notify_all()

    def asteapta(self, timp_maxim=2.0):
        with self._conditie:
            self._conditie.wait(timp_maxim)
            return self._jpeg

    def ultimul(self):
        with self._conditie:
            return self._jpeg


def porneste_server(publicator, port, gazda="127.0.0.1"):
    """Porneste serverul MJPEG intr-un fir separat si il intoarce."""

    class Handler(BaseHTTPRequestHandler):
        def do_GET(self):
            if self.path.startswith("/cadru.jpg"):
                jpeg = publicator.ultimul()
                if jpeg is None:
                    self.send_error(503, "niciun cadru disponibil")
                    return
                self.send_response(200)
                self.send_header("Content-Type", "image/jpeg")
                self.send_header("Content-Length", str(len(jpeg)))
                self.send_header("Cache-Control", "no-store")
                self.end_headers()
                self.wfile.write(jpeg)
                return
            if not self.path.startswith("/flux.mjpg"):
                self.send_error(404)
                return
            self.send_response(200)
            self.send_header("Content-Type", f"multipart/x-mixed-replace; boundary={LIMITA.decode()}")
            self.send_header("Cache-Control", "no-store")
            self.end_headers()
            try:
                while True:
                    jpeg = publicator.asteapta()
                    if jpeg is None:
                        time.sleep(0.2)
                        continue
                    self.wfile.write(b"--" + LIMITA + b"\r\nContent-Type: image/jpeg\r\n"
                                     + f"Content-Length: {len(jpeg)}\r\n\r\n".encode() + jpeg + b"\r\n")
            except (BrokenPipeError, ConnectionResetError, ConnectionAbortedError):
                pass  # browserul a inchis fluxul

        def log_message(self, *argumente):
            pass  # fara jurnal per cerere

    server = ThreadingHTTPServer((gazda, port), Handler)
    server.daemon_threads = True
    threading.Thread(target=server.serve_forever, name="flux-video", daemon=True).start()
    return server
