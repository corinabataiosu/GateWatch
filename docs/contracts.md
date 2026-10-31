# GateWatch — Shared Contracts (MVP)

Single source of truth for the three layers. Ports: **simulator 8001**, **SOC backend 8000**, **frontend (Vite) 5173**.

## 1. Event contract (simulator → SOC)

Every event emitted by the simulator has exactly this shape (JSON):

| Field | Type | Notes |
| --- | --- | --- |
| `event_id` | string | UUID4, globally unique (dedup key) |
| `run_id` | string | Simulator run window, e.g. `run-20261031-101500-ab12` |
| `seq` | int | Monotonic per `run_id`, starts at 1, no gaps |
| `occurred_at` | string | ISO-8601 UTC with `Z` |
| `device_id` | string | Registry id, e.g. `CAM-01` |
| `event_type` | string | See vocabulary below |
| `outcome` | string | `success` \| `failure` \| `info` |
| `origin` | string | `synthetic` (baseline behavior) \| `scenario_generated` (scenario engine) \| `observed_http` (real request hit an interactive service) |
| `source` | object | `{ "ip": str, "user": str \| null, "zone": str \| null }` |
| `target` | object | `{ "ip": str, "port": int \| null, "service": str }` |
| `details` | object | Free-form, event-type specific |

`scenario_stage` (int 1–7) is placed in `details` for scenario events **only for debugging**; the SOC must NOT use it for detection.

### `details` fields per event type (as emitted by the simulator)

- `vpn_session`: `off_hours` (bool), `local_hour` (int), `assigned_ip`, `session_id`, `client`. Scenario stage 1 uses user `vendor.hikserv`, `off_hours: true`, `local_hour: 3`, `assigned_ip: "10.20.0.250"`. Baseline sessions use staff users (`it.*`, `noc.oncall`), `off_hours: false`, office-hours `local_hour` (8–17) and `assigned_ip` in `10.20.0.100`–`10.20.0.120`.
- `badge_access`: `badge_id`, `door`, `restricted` (bool), `holder`. The baseline draws from a pool of 20 staff badges `B-10420`…`B-10439`. Only the first five have operations (restricted-door) clearance. Denied checks also carry `reason`.
- `auth_login`: `username`, `method`; failures add `reason: "invalid_password"`.
- `network_scan`: `targets` (list of IPs), `ports` (list of ints).
- `config_change`: `change`, one of `stream_disabled` \| `motion_detection_off` (attack) \| `device_isolated` \| `device_restored` (SOC response, `outcome: info`).
- `stream_status`: `state` (`up` \| `down`); `down` adds `reason`.
- `recording_access` / `recording_export` / `recording_delete`: `recording_id`, `camera`; exports add `size_mb` and `destination`.
- `log_cleared`: `log`, `entries_removed`.

Extension to §3: `POST /devices/NVR-01/login` (`admin / Nvr#2026`) issues the NVR session used by the recordings endpoints.

### Event-type vocabulary
`heartbeat`, `auth_login`, `auth_logout`, `config_change`, `firmware_update`, `stream_status`, `snapshot_access`, `recording_access`, `recording_export`, `recording_delete`, `badge_access`, `door_state`, `vpn_session`, `network_scan`, `log_cleared`.

## 2. Device registry (15 devices, 4 zones)

Zones: `terminal`, `airside`, `perimeter`, `operations`.

| id | type | zone | ip |
| --- | --- | --- | --- |
| CAM-01 … CAM-08 | camera | CAM-01..03 terminal, 04..05 airside, 06..07 perimeter, 08 operations | 10.20.1.11–18 |
| NVR-01, NVR-02 | nvr | operations | 10.20.2.21–22 |
| ACS-01, ACS-02, ACS-03 | access_control | terminal, airside, operations | 10.20.3.31–33 |
| IOT-GW-01 | iot_gateway | operations | 10.20.0.2 |
| VPN-GW-01 | vpn_gateway | perimeter | 10.20.0.1 |

## 3. Simulator API (port 8001)

Read endpoints are open; control endpoints require header `X-Admin-Token` (env `GATEWATCH_ADMIN_TOKEN`, default `gatewatch-admin`).

- `GET  /sim/health` → `{status, run_id, mode, scenario}`
- `GET  /sim/devices` → list of `{device_id, type, zone, ip, name, status: online|offline|isolated, last_seen}`
- `GET  /sim/events?run_id=&after_seq=0&limit=500` → `{run_id, events: [...], last_seq}` (ordered by `seq`). `run_id` omitted = current run.
- `GET  /sim/runs` → list of runs `{run_id, started_at, ended_at, mode, last_seq}`
- `GET  /sim/scenario` → `{name, mode: AUTO|LIVE|null, state: idle|running|paused|completed, current_stage, stages: [{n, name, description, mitre, done}]}`
- `POST /sim/runs` (admin) → start a new run window, returns run
- `POST /sim/scenario/start` (admin) body `{mode: "AUTO"|"LIVE"}`
- `POST /sim/scenario/step` (admin) → LIVE mode: execute next stage
- `POST /sim/scenario/stop` (admin)
- `POST /sim/baseline` (admin) body `{enabled: bool, rate: float}` – synthetic traffic on/off
- `POST /sim/devices/{id}/isolate` (admin) body `{isolated: bool}` – response action target
- Interactive services (produce `observed_http` events):
  - `POST /devices/CAM-01/login` `{username, password}` → 200/401
  - `GET  /devices/CAM-01/status`, `GET /devices/CAM-01/snapshot` (needs `Authorization: Bearer <session>`)
  - `GET  /devices/NVR-01/recordings`, `POST /devices/NVR-01/recordings/{rid}/export` (session)
  - `POST /devices/ACS-03/badge` `{badge_id, door}` → granted/denied
- `GET /panel` → Simulator Control Panel (static HTML/CSS/JS/SVG)

## 4. "Compromised Vendor" scenario (7 stages)

| # | Stage | Generated events | MITRE |
| --- | --- | --- | --- |
| 1 | Vendor VPN login off-hours | `vpn_session` success, user `vendor.hikserv`, ext IP 185.220.101.47, 03:00-style off-hours flag `details.off_hours=true` | T1133 External Remote Services |
| 2 | Internal discovery | `network_scan` from 10.20.0.250 against many devices | T1046 Network Service Discovery |
| 3 | Camera credential brute force | ≥8 `auth_login` failure on CAM-01 then 1 success with `admin` | T1110 Brute Force |
| 4 | Camera config tampering | `config_change` on CAM-01 (`stream_disabled`, `motion_detection=off`), then `stream_status` down | T1562 Impair Defenses |
| 5 | NVR recording access & export | `auth_login` success NVR-01, burst of `recording_access` + `recording_export` | T1530/T1005 Data from Local System |
| 6 | Physical access with cloned badge | `badge_access` on ACS-03 with badge already used at ACS-01 seconds ago (impossible travel), restricted door | T1078 Valid Accounts |
| 7 | Anti-forensics | `recording_delete` + `log_cleared` on NVR-01 | T1070 Indicator Removal |

Attacker internal IP after VPN: `10.20.0.250`.

## 5. SOC API (port 8000)

- `GET  /api/health` → `{status, ingestion: {connected, run_id, last_seq, events_ingested, last_poll_at, error}, model: {loaded, version}}`
- `GET  /api/overview` → `{events_total, alerts_open, incidents_open, devices: {total, at_risk}, severity_counts}`
- `GET  /api/devices` → `{device_id, type, zone, ip, name, operational_status, security_state: normal|warning|compromised|unknown, open_alerts, last_seen}` — **SOC is authoritative for `security_state`**
- `GET  /api/events?device_id=&limit=100` → most recent first
- `GET  /api/alerts?status=&limit=` → `{alert_id, created_at, rule_id, source: rule|ml, severity: low|medium|high|critical, device_id, title, description, mitre: {technique_id, technique, tactic}, event_ids: [], incident_id, status: open|closed, score?}`
- `GET  /api/incidents` → `{incident_id, title, status: new|investigating|contained|resolved, severity, created_at, updated_at, devices: [], alert_count, tactics: [], summary}`
- `GET  /api/incidents/{id}` → incident + `alerts` + `timeline` (events) + `actions`
- `PATCH /api/incidents/{id}` body `{status}`
- `POST /api/incidents/{id}/actions` body `{action: "isolate_device", device_id}` → calls simulator isolate
- `POST /api/reset` → clear SOC state (alerts/incidents/events); ingestion follows simulator's current run
