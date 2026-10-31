"""Interactive virtual services (CAM-01, NVR-01, ACS-03).

Every real HTTP request produces an `observed_http` event carrying the
client's actual IP address, so live attacks show up in the SOC.
"""
from __future__ import annotations

import base64
import secrets

from fastapi import APIRouter, Header, HTTPException, Request
from pydantic import BaseModel

from .behavior import STAFF_BADGES
from .store import utc_now

CREDENTIALS = {
    "CAM-01": {"admin": "Cam3ra!2026"},
    "NVR-01": {"admin": "Nvr#2026"},
}
ACS03_DOORS = {
    "Operațiuni — sală servere OPS-2": True,
    "Operațiuni — dispecerat": False,
}
RECORDINGS = [
    {"recording_id": f"REC-CAM0{c}-{20261031 * 10 + h}", "camera": f"CAM-0{c}", "size_mb": 640}
    for c in (1, 2, 3) for h in range(3)
]


class LoginBody(BaseModel):
    username: str
    password: str


class BadgeBody(BaseModel):
    badge_id: str
    door: str = "Operațiuni — sală servere OPS-2"


def _client_ip(request: Request) -> str:
    return request.client.host if request.client else "unknown"


def build_router(sim) -> APIRouter:
    router = APIRouter(prefix="/devices", tags=["interactive services"])

    def require_online(device_id: str):
        device = sim.registry.get(device_id)
        if device.status == "isolated":
            raise HTTPException(403, f"{device_id} este izolat de SOC.")
        return device

    def login(device_id: str, body: LoginBody, request: Request) -> dict:
        device = require_online(device_id)
        source = {"ip": _client_ip(request), "user": body.username, "zone": None}
        valid = CREDENTIALS[device_id].get(body.username) == body.password
        sim.emit(device, "auth_login", "success" if valid else "failure", "observed_http",
                 source=source,
                 details={"username": body.username, "method": "http_api",
                          **({} if valid else {"reason": "invalid_password"})})
        if not valid:
            raise HTTPException(401, "Credențiale invalide.")
        token = secrets.token_urlsafe(16)
        sim.sessions[token] = (device_id, body.username)
        return {"session": token, "device_id": device_id, "user": body.username}

    def session_user(device_id: str, authorization: str | None) -> str | None:
        if not authorization or not authorization.lower().startswith("bearer "):
            return None
        session = sim.sessions.get(authorization[7:].strip())
        if not session or session[0] != device_id:
            return None
        return session[1]

    @router.post("/CAM-01/login")
    def cam_login(body: LoginBody, request: Request):
        return login("CAM-01", body, request)

    @router.get("/CAM-01/status")
    def cam_status(request: Request, authorization: str | None = Header(default=None)):
        device = require_online("CAM-01")
        if session_user("CAM-01", authorization) is None:
            raise HTTPException(401, "Sesiune lipsă sau invalidă.")
        return {**device.to_dict(), "stream": "up" if device.stream_ok else "down"}

    @router.get("/CAM-01/snapshot")
    def cam_snapshot(request: Request, authorization: str | None = Header(default=None)):
        device = require_online("CAM-01")
        user = session_user("CAM-01", authorization)
        source = {"ip": _client_ip(request), "user": user, "zone": None}
        if user is None:
            sim.emit(device, "snapshot_access", "failure", "observed_http", source=source,
                     details={"reason": "unauthenticated"})
            raise HTTPException(401, "Sesiune lipsă sau invalidă.")
        captured = utc_now()
        sim.emit(device, "snapshot_access", "success", "observed_http", source=source,
                 details={"resolution": "1920x1080", "captured_at": captured})
        svg = (
            '<svg xmlns="http://www.w3.org/2000/svg" width="320" height="180">'
            '<rect width="320" height="180" fill="#1f2937"/>'
            f'<text x="12" y="24" fill="#e5e7eb" font-family="monospace" font-size="13">CAM-01 {captured}</text>'
            '<text x="12" y="170" fill="#9ca3af" font-family="monospace" font-size="11">SIMULATED SNAPSHOT</text>'
            "</svg>"
        )
        return {
            "device_id": "CAM-01",
            "captured_at": captured,
            "image": "data:image/svg+xml;base64," + base64.b64encode(svg.encode()).decode(),
        }

    @router.post("/NVR-01/login")
    def nvr_login(body: LoginBody, request: Request):
        return login("NVR-01", body, request)

    @router.get("/NVR-01/recordings")
    def nvr_recordings(request: Request, authorization: str | None = Header(default=None)):
        device = require_online("NVR-01")
        user = session_user("NVR-01", authorization)
        if user is None:
            raise HTTPException(401, "Sesiune lipsă sau invalidă.")
        sim.emit(device, "recording_access", "success", "observed_http",
                 source={"ip": _client_ip(request), "user": user, "zone": None},
                 details={"action": "list", "count": len(RECORDINGS)})
        return {"recordings": RECORDINGS}

    @router.post("/NVR-01/recordings/{rid}/export")
    def nvr_export(rid: str, request: Request, authorization: str | None = Header(default=None)):
        device = require_online("NVR-01")
        user = session_user("NVR-01", authorization)
        if user is None:
            raise HTTPException(401, "Sesiune lipsă sau invalidă.")
        recording = next((r for r in RECORDINGS if r["recording_id"] == rid), None)
        if recording is None:
            raise HTTPException(404, "Înregistrare inexistentă.")
        sim.emit(device, "recording_export", "success", "observed_http",
                 source={"ip": _client_ip(request), "user": user, "zone": None},
                 details={"recording_id": rid, "camera": recording["camera"],
                          "size_mb": recording["size_mb"], "destination": _client_ip(request)})
        return {"exported": rid, "size_mb": recording["size_mb"]}

    @router.post("/ACS-03/badge")
    def acs_badge(body: BadgeBody, request: Request):
        device = require_online("ACS-03")
        badge = next((b for b in STAFF_BADGES if b["badge_id"] == body.badge_id), None)
        restricted = ACS03_DOORS.get(body.door, True)
        granted = badge is not None and (badge["operations"] or not restricted)
        sim.emit(device, "badge_access", "success" if granted else "failure", "observed_http",
                 source={"ip": _client_ip(request), "user": badge["holder"] if badge else None,
                         "zone": "operations"},
                 details={"badge_id": body.badge_id, "door": body.door, "restricted": restricted,
                          "holder": badge["holder"] if badge else None,
                          **({} if granted else {"reason": "unknown_badge" if badge is None else "not_authorized"})})
        return {"badge_id": body.badge_id, "door": body.door,
                "result": "granted" if granted else "denied"}

    return router
