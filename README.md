# GateWatch

<div align="center">

### Airport Security Infrastructure · Mini-SOC Demonstrator

A virtual airport network connected to a Security Operations Center (SOC) that detects, correlates, and tracks simulated attacks through an interactive analyst dashboard.

<!-- Add your looping demo GIF at docs/gatewatch-demo.gif -->
<img src="docs/gatewatch-demo.gif" alt="GateWatch live demonstration" width="100%" />

*From simulated attack to detection, incident correlation, and analyst visibility.*

</div>

---

## Overview

GateWatch is a cybersecurity demonstration environment built around a virtual airport network.

It connects three main layers:

1. **Airport simulation:** 15 virtual devices generating baseline traffic and exposing interactive services.
2. **SOC backend:** receives events, applies detection rules and machine-learning analysis, and correlates alerts into incidents.
3. **Analyst dashboard:** displays the airport's 3D model, device security states, alerts, and incidents.

A separate video-analysis module processes camera frames and sends anomaly telemetry to the SOC.

## Architecture

| Component | Responsibility | Port |
|---|---|---:|
| `simulator/` | Layer 1: 15 virtual devices, baseline traffic, Compromised Vendor scenario, and Control Panel | `8001` |
| `soc-backend/` | Layer 2: event ingestion, detection rules, Isolation Forest, incident correlation, and response API | `8000` |
| `frontend/` | Layer 3: React/TypeScript analyst dashboard with a 3D airport model | `5173` |
| `ml/` | Video module: frame-feature extraction, video Isolation Forest, and agent posting telemetry to the SOC | — |
| `attacker-demo/` | Live attack script targeting the simulator's interactive services | — |
| `docs/` | Shared contracts: event format, APIs, and scenario definitions | — |

### Detection workflow

```text
Virtual Airport Devices
         │
         ▼
   Simulator (:8001)
         │
         │ Events
         ▼
   SOC Backend (:8000)
         │
         ├── Detection Rules
         ├── Event Isolation Forest
         ├── Video Anomaly Detection
         │
         ▼
   Incident Correlation
         │
         ▼
   React Dashboard (:5173)
         │
         └── Device states, alerts and incidents
```

## Running the Demo

For the complete Windows two-laptop setup with a real webcam, follow the detailed [Two-Laptop Demo Runbook](docs/two-laptop-demo.md).

The repository also includes:

- `scripts/start-demo.ps1` — starts the demo components.
- `scripts/check_demo.py` — performs non-destructive readiness checks.

### Prerequisites

- Python and pip
- Node.js and npm
- Windows PowerShell for the provided startup script

### 1. Install dependencies

Run from the repository root:

```bash
pip install -r simulator/requirements.txt -r soc-backend/requirements.txt -r ml/requirements.txt
```

Install the frontend dependencies:

```bash
cd frontend
npm install
```

### 2. Start the services

Run each component in a separate terminal.

**Terminal 1 — Simulator**

From the repository root:

```bash
python simulator/run.py
```

Control Panel: `http://127.0.0.1:8001/panel/`

**Terminal 2 — SOC Backend**

```bash
cd soc-backend
python -m uvicorn app.main:app --port 8000
```

**Terminal 3 — Frontend**

```bash
cd frontend
npm run dev
```

Dashboard: `http://localhost:5173`

> **Windows networking note**
>
> Service URLs default to `127.0.0.1`, not `localhost`. On Windows, `localhost` may resolve to IPv6 first, while the Uvicorn servers listen on IPv4. This can introduce an approximately 2-second fallback delay for requests.

If the SOC backend is unavailable, the dashboard falls back to its clearly labelled demo mode.

---

## CAM-01 End-to-End Verification

The CAM-01 verification script checks that an attack can travel through the complete detection pipeline, from the simulator to the dashboard.

With the simulator and SOC backend running, execute:

```bash
python scripts/verify_cam01_flow.py
```

### What the script verifies

1. Starts a fresh run.
2. Sends six incorrect passwords to CAM-01, followed by the correct password.
3. Fetches a snapshot of CAM-01.
4. Checks that the simulator generates `observed_http` events.
5. Verifies that the SOC ingests the same events using their original `event_id` values.
6. Checks that GW-R01/GW-R02 alerts are generated from those events.
7. Verifies that the alerts are correlated into one incident with the relevant event timeline.
8. Confirms that CAM-01 reaches `security_state=compromised`.

### Expected dashboard result

On the next 3-second polling cycle:

- CAM-01 turns red in the 3D airport model.
- The camera panel displays **Compromisă** and its associated alerts.
- The correlated incident appears under **Incidente**.

This verifies the complete chain:

**Attack → Simulator Events → SOC Ingestion → Detection → Incident Correlation → Dashboard**

---

## Tests

Run the following commands from the repository root.

### Simulator

```bash
python -m pytest simulator/tests -q
```

### Video and ML module

```bash
python -m pytest ml/tests -q
```

### SOC Backend

```bash
cd soc-backend
python -m pytest tests -q
```

### Frontend

```bash
cd frontend
npm run build
npm run lint
```

---

<div align="center">

**GateWatch**

*Simulate. Detect. Correlate. Respond.*

</div>
