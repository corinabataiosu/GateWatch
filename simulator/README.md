# GateWatch — Airport Infrastructure Simulator (Layer 1)

A virtual airport security network: 15 devices across 4 zones. It generates synthetic baseline traffic, runs the 7-stage **Compromised Vendor** attack scenario, and exposes interactive device services that record real HTTP requests. Every event follows the contract in [`../docs/contracts.md`](../docs/contracts.md).

## Run

Open `/panel/` for manual testing: select a device, choose one of six attacks, configure it,
then click **Execute Attack** using the existing administration token. Baseline controls are
independent; the legacy scenario remains under its optional disclosure and must be stopped
before a manual execution. A new run resets the devices and event cursor, preserving history.

`GET /sim/attacks` lists profiles; authenticated `POST /sim/attacks/execute` requires a UUID
`execution_id`, `device_id` and `attack`. Reusing an ID with identical parameters returns the
persisted result without generating more events. `GET /sim/executions` returns the latest
20 executions in the current run. External addresses must be fictional TEST-NET IPv4 addresses.

New factual event types are `connection_attempt`, `access_denied` and `network_flow`.
Flow details contain one-second intervals, packet counts/rates and byte counts/rates.
Observations replay immediately in compressed virtual time; `occurred_at` is recording time,
while `details.virtual_occurred_at` and interval bounds describe virtual time. Baseline flows
use 100 pps / 64 KB/s. The SOC independently evaluates facts and its own policy (GW-R09–R13,
plus existing brute-force rule GW-R01). Simulator completion makes no detection claim.

```bash
pip install -r simulator/requirements.txt
python simulator/run.py            # http://127.0.0.1:8001
# or, from simulator/:
python -m uvicorn app.main:app --port 8001
```

- Control Panel: <http://127.0.0.1:8001/panel/>
- API docs: <http://127.0.0.1:8001/docs>
- Events (SOC cursor): `GET /sim/events?run_id=…&after_seq=N`

## Configuration (environment)

| Variable | Default | Meaning |
| --- | --- | --- |
| `GATEWATCH_ADMIN_TOKEN` | `gatewatch-admin` | Required in `X-Admin-Token` for control endpoints |
| `GATEWATCH_SIM_DB` | `simulator/data/simulator.sqlite3` | SQLite event store (`:memory:` allowed) |
| `GATEWATCH_SIM_BACKGROUND` | `1` | Start the baseline thread on startup |
| `GATEWATCH_BASELINE_ENABLED` | `1` | Baseline traffic initially on |
| `GATEWATCH_BASELINE_RATE` | `1.0` | Baseline traffic multiplier (0.1–10) |
| `GATEWATCH_SCENARIO_INTERVAL` | `6.0` | Seconds between stages in AUTO mode |
| `GATEWATCH_HEARTBEAT_INTERVAL` | `10.0` | Seconds between device heartbeats |

## Modules

| File | Role |
| --- | --- |
| `app/devices.py` | Device registry (8 cameras, 2 NVRs, 3 ACS, IoT and VPN gateways) |
| `app/store.py` | SQLite store; run windows and a gap-free `seq` per run |
| `app/events.py` | Event factory and vocabulary validation |
| `app/behavior.py` | Baseline: heartbeats, stream status, staff logins, badge swipes, staff VPN |
| `app/scenario.py` | Compromised Vendor scenario, AUTO (timed) / LIVE (operator steps) |
| `app/services.py` | Interactive CAM-01 / NVR-01 / ACS-03 services (`observed_http` events) |
| `app/main.py` | FastAPI routes, admin-token check, Control Panel mount |

Interactive credentials (for demos): CAM-01 `admin / Cam3ra!2026`, NVR-01 `admin / Nvr#2026`.

When the SOC isolates a device (`POST /sim/devices/{id}/isolate`), its services return 403. Its baseline traffic stops and it emits a single `config_change` event (`details.change = "device_isolated"`). Scenario stages that need an isolated device are reported as `blocked`.

## Tests

```bash
python -m pytest simulator/tests -q
```
