# GateWatch

Airport security-infrastructure SOC demo: a virtual airport network, a SOC that detects and correlates
attacks on it, and a dashboard for analysts.

```
simulator/      Layer 1 — 15 virtual devices, baseline traffic, "Compromised Vendor" scenario, Control Panel (:8001)
soc-backend/    Layer 2 — ingestion, detection rules, Isolation Forest, incident correlation, response API (:8000)
frontend/       Layer 3 — React/TypeScript dashboard with the 3D airport model (:5173)
ml/             Video module — frame features, video Isolation Forest, agent posting telemetry to the SOC
attacker-demo/  Live attack script against the simulator's interactive services
docs/           Shared contracts (event format, APIs, scenario)
```

## Run the full demo

For a Windows two-laptop setup with the real webcam, follow
[the step-by-step runbook](docs/two-laptop-demo.md). Use `scripts/start-demo.ps1`
to run each component and `scripts/check_demo.py` for non-destructive readiness checks.

```bash
pip install -r simulator/requirements.txt -r soc-backend/requirements.txt -r ml/requirements.txt

python simulator/run.py                                            # terminal 1 → http://127.0.0.1:8001/panel/
cd soc-backend && python -m uvicorn app.main:app --port 8000      # terminal 2
cd frontend && npm install && npm run dev                          # terminal 3 → http://localhost:5173
```

1. In the **Control Panel** start *Pornește AUTO* (or LIVE and step through the 7 stages).
2. In the dashboard, the incident appears under **Incidente** within seconds; CAM-01 turns compromised.
3. Optionally attack live: `python attacker-demo/attack_cam01.py`.
4. Optionally run the video module: `python ml/src/agent_video.py --scenariu obturare --dupa 15`.
   The CAM-01 panel shows live brightness, sharpness and frame-difference metrics; once the lens is covered,
   CAM-01 goes to *Avertizare* with a video alert. That alert joins a CAM-01 incident if one is open.
5. Respond from the incident view: *Izolează dispozitiv* isolates the device in the simulator (its services
   then return 403) and moves the incident to *contained*.

If the SOC is not running, the dashboard falls back to its labelled demo mode.

Service URLs default to `127.0.0.1`, not `localhost`. On Windows `localhost` resolves to IPv6 first and every request
to the IPv4-only uvicorn servers then waits about 2 s for the fallback.

## Verify the CAM-01 chain

With the simulator and SOC running:

```bash
python scripts/verify_cam01_flow.py
```

It starts a fresh run, sends 6 wrong passwords, then the right one, then fetches a snapshot from CAM-01. It checks each hop:
`observed_http` events in the simulator → the same `event_id`s ingested by the SOC → GW-R01/GW-R02 alerts built
from them → one correlated incident whose timeline holds those events → CAM-01 `security_state=compromised`.
On the next 3 s poll the dashboard shows it: the CAM-01 label in the 3D view turns red, the camera panel
shows *Compromisă* with the alerts, and the incident appears under **Incidente**.

## Tests

```bash
python -m pytest simulator/tests -q
python -m pytest ml/tests -q
(cd soc-backend && python -m pytest tests -q)
(cd frontend && npm run build && npm run lint)
```
