# GateWatch — SOC Backend (Layer 2)

Ingests simulator events, detects attacks with rules and an Isolation Forest model, correlates alerts into
incidents (MITRE ATT&CK-mapped) and exposes the incident/response API used by the dashboard.
API contract: [`../docs/contracts.md`](../docs/contracts.md) §5.

## Run

```bash
pip install -r soc-backend/requirements.txt
cd soc-backend
python -m uvicorn app.main:app --port 8000      # needs the simulator on :8001
```

| Variable | Default | Meaning |
| --- | --- | --- |
| `GATEWATCH_SIM_URL` | `http://localhost:8001` | Simulator base URL |
| `GATEWATCH_ADMIN_TOKEN` | `gatewatch-admin` | Token sent for response actions (isolate device) |
| `GATEWATCH_SOC_DB` | `soc-backend/data/soc.sqlite3` | SQLite store |
| `GATEWATCH_MODEL` | `soc-backend/models/isolation_forest.joblib` | ML artifact |
| `GATEWATCH_POLL_INTERVAL` | `1.0` | Seconds between ingestion polls |
| `GATEWATCH_INGESTION` | `1` | Set `0` to disable the poller |

## Pipeline

`ingestion.py` → `pipeline.py` → `rules.py` + `ml/detector.py` → `correlation.py` → `main.py` (API)

- **Ingestion**: cursor polling of `/sim/events` (`after_seq`, page 500). The cursor is persisted per `run_id`,
  so a restart resumes exactly; new simulator runs are followed automatically; `seq` gaps are counted,
  duplicates are dropped by `event_id`, invalid events are rejected (pydantic contract model).
- **Rules** (event time, never using `details.scenario_stage`):

  | Rule | Detects | MITRE |
  | --- | --- | --- |
  | GW-R01 | ≥5 failed logins, same device + source, 120 s | T1110 |
  | GW-R02 | successful login right after GW-R01 | T1078 |
  | GW-R03 | vendor VPN session off-hours | T1133 |
  | GW-R04 | network scan / one source touching ≥5 devices in 60 s | T1046 |
  | GW-R05 | camera stream / motion detection disabled | T1562 |
  | GW-R06 | ≥3 recording exports in 5 min | T1005 |
  | GW-R07 | same badge at two ACS units within 120 s | T1078 |
  | GW-R08 | recordings deleted / logs cleared | T1070 |

- **ML** (`GW-ML01`): Isolation Forest over 13 per-device features in a trailing 60 s window
  (`ml/features.py`). Alerts link to incidents by device only and never open an incident on their own.
- **Correlation**: an alert joins an active incident sharing a device/IP/user/badge within 30 min; a
  high-severity rule alert with no shared entity joins a recent multi-alert incident (10 min) — this links
  the physical-access step. Repeated detections update one alert (10 min de-dup window).
- **Security state** per device (authoritative for the dashboard): `compromised` (open critical alert, or
  high in a ≥3-tactic incident) · `warning` (any open alert) · `unknown` (offline, no evidence) · `normal`.

## Saved model artifact

`models/isolation_forest.joblib` (+ `models/model_card.json`) holds the model, feature names, threshold
(99.95th percentile of baseline scores) and baseline statistics. It was trained on 12 h of synthetic baseline
plus 8 h of the simulator's own baseline engine. To retrain:

```bash
python simulator/tools/export_baseline.py --hours 8 --out soc-backend/data/sim_baseline.jsonl
cd soc-backend && python -m app.ml.train --events data/sim_baseline.jsonl
```

On a 3 h held-out simulator baseline the current model raised 2 false windows out of 4,561, while flagging
CAM-01 (brute force + tampering) and NVR-01 (export + evidence deletion) in the attack scenario.

## Tests

```bash
cd soc-backend && python -m pytest tests -q
```
