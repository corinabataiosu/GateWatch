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
- `GET  /api/report` → activity report built from current SOC data: `{generated_at, period, summary, totals, severity_counts, incidents_by_status, alerts_by_rule, techniques, incidents: [{…, alerts, actions}], devices_at_risk}`; `?format=html` returns the same report as a printable HTML download
- `POST /api/reset` → clear SOC state (alerts/incidents/events); ingestion follows simulator's current run

All mutating SOC endpoints require `X-Admin-Token`.

`POST /api/devices/{device_id}/restore`, body `{request_id: UUID}`, returns
`{device_id, closed_alerts, resolved_incidents, restored_at, result: "ok"}`.
The request is idempotent: repeat the same UUID after a timeout; using it for a
different device returns 409. Unknown devices return 404, offline devices 409,
and simulator communication failures 502 without closing alerts. The service
releases isolation if needed, closes only this device's open alerts, records the
admin action and resets its rule/ML/video windows. Incidents resolve only if no
open alerts remain. Source run/sequence watermarks retain pre-restoration backlog
as historical events without detecting it again. Watermarks and restoration audit
survive SOC reset/restart. Video captured before restoration is ignored. New
evidence is still detected. Run one SOC worker; this is not a distributed transaction
with the simulator (a successful release cannot be rolled back if a later DB write fails).

Incident responses add `open_alert_count`; `alert_count` remains the historical total.
Reopening an incident does not reopen its previously closed alerts.

## 6. Video telemetry (video module → SOC)

The video module (`ml/src/agent_video.py`) is a second source for the same logical camera: the simulator
reports what the camera *does*, the video module what it *sees*. It posts one sample per second:

`POST /api/video/telemetry` (header `X-Admin-Token`)

| Field | Type | Notes |
| --- | --- | --- |
| `device_id` | string | e.g. `CAM-01` |
| `captured_at` | string | ISO-8601 UTC |
| `brightness` | float 0–255 | mean grayscale (ML-02.1 `luminozitate_medie`) |
| `sharpness` | float ≥ 0 | Laplacian variance (ML-02.1 `claritate`) |
| `frame_diff` | float 0–255 \| null | mean abs. difference to previous frame |
| `score`, `threshold` | float | video Isolation Forest (ML-02.2) |
| `is_anomaly` | bool | score ≥ threshold or a feature outside the learned normal range |
| `out_of_range` | string[] | features outside the learned range |
| `model_version` | string | artifact version |
| `source` | `camera` \| `synthetic` | |

SOC behaviour: 3 consecutive samples with quality evidence → alert `GW-V01` (source `ml`, severity `medium`, device state
`warning`). It never opens an incident on its own; it joins an active incident that already involves the
device. Five consecutive samples without quality evidence close an unlinked `GW-V01` alert. `/api/devices[].video` exposes the
latest sample plus `stale` (no sample for 10 s), `diagnosis` and `image_state`
(`normal`, `atypical_sample`, `persistent_anomaly`, `unavailable`). A telemetry gap
over 10 s resets consecutive-sample counters. Security state still comes from open
alerts, independently of the current image.

Statistical novelty (`is_anomaly`) is advisory and remains visible. Quality evidence is
near-black brightness (<25), saturation (>230), or an ML anomaly accompanied by
sharpness below 25% of the calibrated normal reference. `reference_sharpness` is an
optional positive telemetry field, derived from the median training sharpness by
new calibrations. Without it, relative sharpness loss is not evaluated. Increased
sharpness, motion, or identical frames alone do not prove degradation/replay.
Responses expose `quality_issue` and `quality_reasons`. Thresholds are explicit in
`app/video_policy.py`; they require commissioning against the intended scene.
Naive timestamps and nonfinite metrics are rejected. Duplicate/out-of-order samples
are ignored; changing model or source resets consecutive evidence. Deploy one agent
per device at the contracted one sample/second rate and one SOC worker.
