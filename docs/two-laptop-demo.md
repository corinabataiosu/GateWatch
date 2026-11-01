# Two-laptop demo (Windows / PowerShell)

Run each component in its own terminal, using the same Python environment.
Commands below are run from the repository root. Stop a component with Ctrl+C.
The launcher does not reset databases, change firewall rules or spawn hidden services.

## Laptop A: simulator

Install `python -m pip install -r simulator/requirements.txt`, then:

```powershell
./scripts/start-demo.ps1 simulator
```

Allow inbound TCP 8001 on your trusted private network. Use `ipconfig` to find
the Wi-Fi IPv4 address. The current rehearsal target is `192.168.8.120`.
Open `http://127.0.0.1:8001/panel/` on A for the control panel.

## Laptop B: SOC, dashboard and webcam

Install `python -m pip install -r soc-backend/requirements.txt -r ml/requirements.txt`.
Use a supported Node version (Node 22.13 or newer in the 22.x line), then run
`npm ci` from `frontend/`. The launcher also recognizes a project-local runtime
at `.tools/runtime/node_modules/node/bin/node.exe` if installed.

First verify `http://192.168.8.120:8001/sim/health` is reachable. Then, in separate terminals:

```powershell
./scripts/start-demo.ps1 soc -SimulatorUrl http://192.168.8.120:8001
./scripts/start-demo.ps1 dashboard
```

Open `http://127.0.0.1:5173` on B. Check `/api/health`: ingestion.connected must
be true, last_seq must advance, and model.loaded must be true. The dashboard
should list 15 devices. HTTP 200 alone does not prove ingestion works.

Read-only readiness check (add `--video` once the webcam agent is running):

```powershell
python scripts/check_demo.py --sim http://192.168.8.120:8001
```

Close other webcam apps and enable Windows desktop camera access. Calibrate
with representative normal lighting and movement (600 frames at 5 FPS, about
two minutes). The calibration command refuses to overwrite an existing model.

```powershell
./scripts/start-demo.ps1 calibrate -CameraIndex 0
./scripts/start-demo.ps1 camera -CameraIndex 0
```

Calibration must finish before starting the agent. Both use the same frame
pacing. If index 0 is unavailable, try 1 in both commands. Models stay local
and are excluded from git. Recalibrate if the scene or lighting changes.

Open `http://127.0.0.1:8002/flux.mjpg`, then Camere / Vezi fluxul. CAM-01 video
telemetry should report source=camera and stale=false. Covering the lens should
raise GW-V01 after three anomalous samples; five normal samples close a standalone
video alert. Allow additional time for the dashboard's three-second polling.

## Controlled rehearsal

Stop the video agent first. The following deliberately resets SOC, creates a
new simulator run and performs controlled login attempts against the simulator:

```powershell
python scripts/verify_cam01_flow.py --sim http://192.168.8.120:8001
```

After PASS, restart the webcam agent. Cover the lens after the incident is open
to demonstrate correlation of new video evidence with the CAM-01 incident.
Isolating CAM-01 blocks simulated services; it does not disable the physical
webcam. The simulator's snapshot is generated, not a webcam photograph.

For a clean rehearsal, stop the agent and SOC, create a new simulator run from
the panel, restart SOC and reset SOC before generating attacks. Do not reset
SOC alone against an old attack run: its events can be re-ingested. Keep one
SOC worker because detection and video state are partly in memory.

## Fallback and diagnostics

- If remote health times out: verify A's IP, simulator --host 0.0.0.0, firewall
  allowance and router/client isolation. Do not turn the firewall off.
- For one-laptop fallback, start the simulator on B and omit -SimulatorUrl.
- If the camera is visible but metrics are absent: check the agent's SOC errors
  and ensure the same -AdminToken is passed to simulator, SOC and camera.
- A failed webcam read releases the capture device; the live agent retries once
  per second. It sends no video telemetry during the outage, so SOC marks the
  previous sample stale after ten seconds. Calibration still fails on an outage
  rather than training on incomplete capture. Cover the lens with a finger or
  opaque card for an obstruction test; a hardware privacy switch may disable
  capture instead of producing dark frames.
- Keep the dashboard browser on B: the video server intentionally binds to
  loopback. Opening the dashboard on another machine is not this configuration.
- A connected dashboard can still have disconnected simulator ingestion; check
  ingestion.connected. A local demo fallback is not evidence of live integration.

## Checks

Run separately (the two Python services both have an `app` package):

```powershell
python -m pytest simulator/tests ml/tests -q
python -m pytest soc-backend/tests -q
```

From frontend/: `npm run build` and `npm run lint`.

## Current rehearsal on this laptop

The live verification uses `soc-backend/data/soc-rehearsal-20261031.sqlite3`,
preserving the original SOC database. To resume that same history in a new terminal:

```powershell
$env:GATEWATCH_SOC_DB = "$PWD/soc-backend/data/soc-rehearsal-20261031.sqlite3"
./scripts/start-demo.ps1 soc -SimulatorUrl http://192.168.8.120:8001
```

The installed system Node is too old for the current frontend dependencies.
The launcher uses the compatible project-local Node 22 runtime automatically.
For manual build checks from the repository root with that runtime:

```powershell
Push-Location frontend
../.tools/runtime/node_modules/node/bin/node.exe node_modules/typescript/bin/tsc -b
../.tools/runtime/node_modules/node/bin/node.exe node_modules/vite/bin/vite.js build
../.tools/runtime/node_modules/node/bin/node.exe node_modules/eslint/bin/eslint.js .
Pop-Location
```

The Windows `npm.cmd` launcher can select its adjacent system Node even when
PATH prefers another version. To reinstall dependencies using the local runtime
on this machine, invoke npm's JavaScript entry point explicitly:

```powershell
./.tools/runtime/node_modules/node/bin/node.exe 'C:/Program Files/nodejs/node_modules/npm/bin/npm-cli.js' ci --include=optional --prefix frontend
```
