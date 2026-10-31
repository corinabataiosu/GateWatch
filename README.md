# GateWatch

Airport security-infrastructure SOC demo: a virtual airport network, a SOC that detects and correlates
attacks on it, and a dashboard for analysts.

```
simulator/      Layer 1 — 15 virtual devices, baseline traffic, "Compromised Vendor" scenario, Control Panel (:8001)
soc-backend/    Layer 2 — ingestion, detection rules, Isolation Forest, incident correlation, response API (:8000)
frontend/       Layer 3 — React/TypeScript dashboard with the 3D airport model (:5173)
attacker-demo/  Live attack script against the simulator's interactive services
docs/           Shared contracts (event format, APIs, scenario)
```

## Run the full demo

```bash
pip install -r simulator/requirements.txt -r soc-backend/requirements.txt

python simulator/run.py                                            # terminal 1 → http://localhost:8001/panel/
cd soc-backend && python -m uvicorn app.main:app --port 8000      # terminal 2
cd frontend && npm install && npm run dev                          # terminal 3 → http://localhost:5173
```

1. In the **Control Panel** start *Pornește AUTO* (or LIVE and step through the 7 stages).
2. In the dashboard, the incident appears under **Incidente** within seconds; CAM-01 turns compromised.
3. Optionally attack live: `python attacker-demo/attack_cam01.py`.
4. Respond from the incident view: *Izolează dispozitiv* isolates the device in the simulator (its services
   then return 403) and moves the incident to *contained*.

If the SOC is not running, the dashboard falls back to its labelled demo mode.

## Tests

```bash
python -m pytest simulator/tests -q
cd soc-backend && python -m pytest tests -q
cd frontend && npm run build && npm run lint
```
