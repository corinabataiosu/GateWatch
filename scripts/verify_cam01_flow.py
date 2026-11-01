"""End-to-end check: one controlled HTTP interaction with CAM-01 must travel the whole chain.

    HTTP → simulator CAM-01 service → observed_http events (Server 1, :8001)
         → SOC ingestion → alert(s) → correlated incident → CAM-01 security_state (Server 2, :8000)

The dashboard renders /api/devices and /api/incidents, so once this script passes the CAM-01 marker
and panel change on the next 3 s poll.

Usage (both servers running):
    python scripts/verify_cam01_flow.py            # new simulator run + SOC reset first
    python scripts/verify_cam01_flow.py --keep     # reuse current run and SOC state
Exit code 0 when every step passes. stdlib only.
"""
from __future__ import annotations

import argparse
import json
import sys
import time
import urllib.error
import urllib.request

WRONG_PASSWORDS = ["admin", "12345", "password", "admin123", "hikvision", "camera"]
RIGHT_PASSWORD = "Cam3ra!2026"


def call(url: str, method: str = "GET", body: dict | None = None, headers: dict | None = None):
    req = urllib.request.Request(url, method=method, data=json.dumps(body).encode() if body is not None else None)
    req.add_header("Content-Type", "application/json")
    for key, value in (headers or {}).items():
        req.add_header(key, value)
    try:
        with urllib.request.urlopen(req, timeout=5) as resp:
            return resp.status, json.loads(resp.read() or b"null")
    except urllib.error.HTTPError as err:
        return err.code, None


def wait_for(description: str, check, timeout: float):
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        result = check()
        if result:
            return result
        time.sleep(0.5)
    raise SystemExit(f"FAIL  {description} (no result after {timeout:.0f} s)")


def ok(step: str, detail: str) -> None:
    print(f"OK    {step:<34} {detail}")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--sim", default="http://127.0.0.1:8001")
    parser.add_argument("--soc", default="http://127.0.0.1:8000")
    parser.add_argument("--token", default="gatewatch-admin", help="simulator admin token")
    parser.add_argument("--keep", action="store_true", help="do not start a new run / reset the SOC")
    parser.add_argument("--timeout", type=float, default=20)
    args = parser.parse_args()
    admin = {"X-Admin-Token": args.token}

    # 0. Both servers up, clean starting point.
    for name, url in (("simulator", f"{args.sim}/sim/health"), ("SOC", f"{args.soc}/api/health")):
        try:
            status, _ = call(url)
        except urllib.error.URLError as exc:
            raise SystemExit(f"FAIL  {name} unreachable at {url}: {exc.reason}")
        if status != 200:
            raise SystemExit(f"FAIL  {name} health returned {status}")
    if not args.keep:
        status, run = call(f"{args.sim}/sim/runs", "POST", {}, admin)
        if status != 200:
            raise SystemExit(f"FAIL  could not start a simulator run (HTTP {status}; check --token)")
        call(f"{args.soc}/api/reset", "POST", {}, admin)
        wait_for("SOC follows the new run",
                 lambda: call(f"{args.soc}/api/health")[1]["ingestion"]["run_id"] == run["run_id"], args.timeout)
        ok("fresh run", run["run_id"])
    _, sim_health = call(f"{args.sim}/sim/health")
    run_id = sim_health["run_id"]
    _, devices = call(f"{args.soc}/api/devices")
    before = next(d for d in devices if d["device_id"] == "CAM-01")
    ok("CAM-01 before", f"security_state={before['security_state']} open_alerts={before['open_alerts']}")

    # 1. Controlled HTTP interaction with CAM-01 (credential guessing, then a valid login + snapshot).
    _, runs = call(f"{args.sim}/sim/runs")
    start_seq = next(r["last_seq"] for r in runs if r["run_id"] == run_id)
    codes = [call(f"{args.sim}/devices/CAM-01/login", "POST", {"username": "admin", "password": p})[0]
             for p in WRONG_PASSWORDS]
    status, session = call(f"{args.sim}/devices/CAM-01/login", "POST",
                           {"username": "admin", "password": RIGHT_PASSWORD})
    if codes != [401] * len(WRONG_PASSWORDS) or status != 200:
        raise SystemExit(f"FAIL  CAM-01 login responses {codes} + {status}")
    snap_status, _ = call(f"{args.sim}/devices/CAM-01/snapshot",
                          headers={"Authorization": f"Bearer {session['session']}"})
    ok("HTTP -> CAM-01", f"{len(codes)}x401, 1x200 login, snapshot {snap_status}")

    # 2. Server 1 recorded them as observed_http events.
    def observed():
        _, data = call(f"{args.sim}/sim/events?run_id={run_id}&after_seq={start_seq}&limit=500")
        mine = [e for e in data["events"] if e["device_id"] == "CAM-01" and e["origin"] == "observed_http"]
        return mine if len(mine) >= len(WRONG_PASSWORDS) + 2 else None
    events = wait_for("observed_http events in simulator", observed, args.timeout)
    event_ids = {e["event_id"] for e in events}
    failures = sum(1 for e in events if e["event_type"] == "auth_login" and e["outcome"] == "failure")
    ok("Server 1 events", f"{len(events)} observed_http (seq {events[0]['seq']}-{events[-1]['seq']}, "
                          f"{failures} failed logins, source {events[0]['source']['ip']})")

    # 3. Server 2 ingested exactly those events.
    def ingested():
        _, data = call(f"{args.soc}/api/events?device_id=CAM-01&limit=1000")
        return event_ids <= {e["event_id"] for e in data}
    wait_for("SOC ingestion of the CAM-01 events", ingested, args.timeout)
    ok("Server 2 ingestion", "all event_ids present")

    # 4. Alerts built from those events.
    def alerts():
        _, data = call(f"{args.soc}/api/alerts?device_id=CAM-01")
        linked = [a for a in data if event_ids & set(a["event_ids"])]
        return linked if {"GW-R01", "GW-R02"} <= {a["rule_id"] for a in linked} else None
    linked = wait_for("brute-force alerts on CAM-01", alerts, args.timeout)
    for alert in sorted(linked, key=lambda a: a["alert_id"]):
        technique = alert["mitre"]["technique_id"] if alert["mitre"] else "ML"
        ok(f"alert {alert['alert_id']}", f"{alert['rule_id']} {alert['severity']} {technique} -> {alert['incident_id']}")

    # 5. One correlated incident holds them.
    incident_ids = {a["incident_id"] for a in linked if a["source"] == "rule"}
    if len(incident_ids) != 1 or None in incident_ids:
        raise SystemExit(f"FAIL  rule alerts not correlated into one incident: {incident_ids}")
    incident_id = incident_ids.pop()
    _, incident = call(f"{args.soc}/api/incidents/{incident_id}")
    timeline_ids = {e["event_id"] for e in incident["timeline"]}
    if not (event_ids & timeline_ids) or "CAM-01" not in incident["devices"]:
        raise SystemExit(f"FAIL  incident {incident_id} timeline does not reference the CAM-01 events")
    ok(f"incident {incident_id}", f"{incident['severity']} | {incident['status']} | {incident['alert_count']} alerts | "
                                  f"{', '.join(incident['tactics'])}")

    # 6. Device state the dashboard renders.
    _, devices = call(f"{args.soc}/api/devices")
    after = next(d for d in devices if d["device_id"] == "CAM-01")
    if after["security_state"] != "compromised":
        raise SystemExit(f"FAIL  CAM-01 security_state is {after['security_state']}, expected compromised")
    ok("CAM-01 after", f"security_state={after['security_state']} open_alerts={after['open_alerts']}")
    print("PASS  HTTP -> Server 1 event -> Server 2 alert + incident -> dashboard state")
    return 0


if __name__ == "__main__":
    sys.exit(main())
