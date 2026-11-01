<#
Run one component per terminal. No background processes, database resets or firewall changes.
#>
[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [ValidateSet('simulator', 'soc', 'dashboard', 'calibrate', 'camera')]
    [string]$Component,
    [string]$SimulatorUrl = 'http://127.0.0.1:8001',
    [string]$AdminToken = 'gatewatch-admin',
    [ValidateRange(0, 20)][int]$CameraIndex = 0,
    [ValidateRange(10, 10000)][int]$Frames = 600
)
$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$cameraModel = Join-Path $projectRoot 'ml/models/video_camera.joblib'
$previousSim = $env:GATEWATCH_SIM_URL
$previousToken = $env:GATEWATCH_ADMIN_TOKEN
$previousFrontendToken = $env:VITE_ADMIN_TOKEN
$previousCamera = $env:GW_CAMERA_INDEX
$previousPath = $env:PATH
Push-Location $projectRoot
try {
    switch ($Component) {
        'simulator' {
            $env:GATEWATCH_ADMIN_TOKEN = $AdminToken
            & python simulator/run.py --host 0.0.0.0 --port 8001
        }
        'soc' {
            $health = Invoke-RestMethod "$($SimulatorUrl.TrimEnd('/'))/sim/health" -TimeoutSec 5
            if ($health.status -ne 'ok' -or -not $health.run_id) {
                throw 'The target is not a healthy GateWatch simulator.'
            }
            $env:GATEWATCH_SIM_URL = $SimulatorUrl.TrimEnd('/')
            $env:GATEWATCH_ADMIN_TOKEN = $AdminToken
            Set-Location (Join-Path $projectRoot 'soc-backend')
            & python -m uvicorn app.main:app --host 127.0.0.1 --port 8000
        }
        'dashboard' {
            $env:GATEWATCH_ADMIN_TOKEN = $AdminToken
            $env:VITE_ADMIN_TOKEN = $AdminToken
            $env:GW_CAMERA_INDEX = "$CameraIndex"
            $localNode = Join-Path $projectRoot '.tools/runtime/node_modules/node/bin'
            if (Test-Path -LiteralPath (Join-Path $localNode 'node.exe')) {
                $env:PATH = "$localNode;$env:PATH"
            }
            Set-Location (Join-Path $projectRoot 'frontend')
            & node node_modules/vite/bin/vite.js --host 127.0.0.1 --port 5173 --strictPort
        }
        'calibrate' {
            & python ml/src/calibrare_camera.py --camera $CameraIndex --cadre $Frames --fps 5 --iesire $cameraModel
        }
        'camera' {
            if (-not (Test-Path -LiteralPath $cameraModel)) {
                throw 'Camera calibration is missing. Run the calibrate component first.'
            }
            & python ml/src/agent_video.py --sursa camera --camera $CameraIndex --id-camera CAM-01 --fps 5 --model $cameraModel --soc http://127.0.0.1:8000 --token $AdminToken
        }
    }
    if ($LASTEXITCODE -ne 0) { throw "$Component exited with code $LASTEXITCODE" }
}
finally {
    $env:GATEWATCH_SIM_URL = $previousSim
    $env:GATEWATCH_ADMIN_TOKEN = $previousToken
    $env:VITE_ADMIN_TOKEN = $previousFrontendToken
    $env:GW_CAMERA_INDEX = $previousCamera
    $env:PATH = $previousPath
    Pop-Location
}
