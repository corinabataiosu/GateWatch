"""Device registry: 15 virtual devices across 4 airport zones."""
from __future__ import annotations

import threading
from dataclasses import dataclass

ZONES = ("terminal", "airside", "perimeter", "operations")


@dataclass
class Device:
    device_id: str
    type: str
    zone: str
    ip: str
    name: str
    port: int
    service: str
    status: str = "online"  # online | offline | isolated
    last_seen: str | None = None
    stream_ok: bool = True  # cameras only

    def to_dict(self) -> dict:
        return {
            "device_id": self.device_id,
            "type": self.type,
            "zone": self.zone,
            "ip": self.ip,
            "name": self.name,
            "status": self.status,
            "last_seen": self.last_seen,
        }


_CAMERA_ZONES = {
    1: ("terminal", "Terminal — acces principal"),
    2: ("terminal", "Terminal — zonă check-in"),
    3: ("terminal", "Terminal — control securitate"),
    4: ("airside", "Platformă — poziții parcare"),
    5: ("airside", "Platformă — cale de rulare"),
    6: ("perimeter", "Perimetru — gard nord"),
    7: ("perimeter", "Perimetru — poartă acces auto"),
    8: ("operations", "Operațiuni — sală servere"),
}


def _build_devices() -> list[Device]:
    devices = [
        Device(f"CAM-{n:02d}", "camera", zone, f"10.20.1.{10 + n}", name, 80, "http")
        for n, (zone, name) in _CAMERA_ZONES.items()
    ]
    devices += [
        Device("NVR-01", "nvr", "operations", "10.20.2.21", "NVR principal", 443, "https"),
        Device("NVR-02", "nvr", "operations", "10.20.2.22", "NVR rezervă", 443, "https"),
        Device("ACS-01", "access_control", "terminal", "10.20.3.31", "Control acces terminal", 443, "https"),
        Device("ACS-02", "access_control", "airside", "10.20.3.32", "Control acces platformă", 443, "https"),
        Device("ACS-03", "access_control", "operations", "10.20.3.33", "Control acces operațiuni", 443, "https"),
        Device("IOT-GW-01", "iot_gateway", "operations", "10.20.0.2", "Gateway IoT", 8883, "mqtt"),
        Device("VPN-GW-01", "vpn_gateway", "perimeter", "10.20.0.1", "Gateway VPN furnizori", 443, "vpn"),
    ]
    return devices


class DeviceRegistry:
    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._devices: dict[str, Device] = {}
        self.reset()

    def reset(self) -> None:
        with self._lock:
            self._devices = {d.device_id: d for d in _build_devices()}

    def get(self, device_id: str) -> Device | None:
        return self._devices.get(device_id)

    def all(self) -> list[Device]:
        return list(self._devices.values())

    def by_type(self, device_type: str) -> list[Device]:
        return [d for d in self._devices.values() if d.type == device_type]

    def touch(self, device_id: str, when: str) -> None:
        device = self._devices.get(device_id)
        if device is not None:
            device.last_seen = when

    def set_status(self, device_id: str, status: str) -> None:
        with self._lock:
            self._devices[device_id].status = status
