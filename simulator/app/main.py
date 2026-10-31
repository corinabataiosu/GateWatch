"""FastAPI application for the GateWatch simulator (port 8001)."""
from __future__ import annotations

from contextlib import asynccontextmanager
from pathlib import Path
from typing import Literal

from fastapi import Depends, FastAPI, Header, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import RedirectResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

from .config import Settings
from .services import build_router
from .state import Simulator
from .attacks import AttackRequest, CATALOG

PANEL_DIR = Path(__file__).resolve().parent.parent / "control_panel"


class ScenarioStartBody(BaseModel):
    mode: Literal["AUTO", "LIVE"] = "AUTO"


class BaselineBody(BaseModel):
    enabled: bool
    rate: float | None = None


class IsolateBody(BaseModel):
    isolated: bool = True


def create_app(settings: Settings | None = None) -> FastAPI:
    settings = settings or Settings.from_env()
    sim = Simulator(settings)

    @asynccontextmanager
    async def lifespan(_: FastAPI):
        if settings.background:
            sim.baseline.start()
        yield
        sim.scenario.stop()
        sim.baseline.shutdown()

    app = FastAPI(title="GateWatch Simulator", version="1.0.0", lifespan=lifespan)
    app.state.sim = sim
    app.add_middleware(
        CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"]
    )

    def require_admin(x_admin_token: str | None = Header(default=None)) -> None:
        if x_admin_token != settings.admin_token:
            raise HTTPException(401, "Token de administrare lipsă sau invalid.")

    admin = [Depends(require_admin)]

    @app.get("/sim/attacks")
    def attacks():
        return CATALOG

    @app.get("/sim/executions")
    def executions():
        return sim.store.list_executions()

    @app.post("/sim/attacks/execute", dependencies=admin)
    def execute_attack(body: AttackRequest):
        try:
            return sim.attacks.execute(body)
        except ValueError as exc:
            raise HTTPException(422, str(exc)) from exc

    @app.get("/sim/health")
    def health():
        return {
            "status": "ok",
            "run_id": sim.store.current_run_id,
            "mode": sim.scenario.mode,
            "scenario": sim.scenario.state,
            "baseline": {"enabled": sim.baseline.enabled, "rate": sim.baseline.rate},
        }

    @app.get("/sim/devices")
    def devices():
        return [d.to_dict() for d in sim.registry.all()]

    @app.get("/sim/events")
    def events(
        run_id: str | None = None,
        after_seq: int = Query(0, ge=0),
        limit: int = Query(500, ge=1, le=5000),
    ):
        run_id = run_id or sim.store.current_run_id
        run = sim.store.get_run(run_id)
        if run is None:
            raise HTTPException(404, f"Rulare necunoscută: {run_id}")
        batch = sim.store.get_events(run_id, after_seq, limit)
        return {
            "run_id": run_id,
            "events": batch,
            "last_seq": batch[-1]["seq"] if batch else after_seq,
        }

    @app.get("/sim/runs")
    def runs():
        return sim.store.list_runs()

    @app.post("/sim/runs", dependencies=admin)
    def new_run():
        return sim.new_run()

    @app.get("/sim/scenario")
    def scenario():
        return sim.scenario.to_dict()

    @app.post("/sim/scenario/start", dependencies=admin)
    def scenario_start(body: ScenarioStartBody | None = None):
        with sim.attacks.lock:
            return sim.scenario.start((body or ScenarioStartBody()).mode)

    @app.post("/sim/scenario/step", dependencies=admin)
    def scenario_step():
        try:
            return sim.scenario.step()
        except RuntimeError as exc:
            raise HTTPException(409, str(exc)) from exc

    @app.post("/sim/scenario/stop", dependencies=admin)
    def scenario_stop():
        sim.scenario.stop()
        return sim.scenario.to_dict()

    @app.post("/sim/baseline", dependencies=admin)
    def baseline(body: BaselineBody):
        sim.baseline.configure(body.enabled, body.rate)
        return {"enabled": sim.baseline.enabled, "rate": sim.baseline.rate}

    @app.post("/sim/devices/{device_id}/isolate", dependencies=admin)
    def isolate(device_id: str, body: IsolateBody | None = None):
        if sim.registry.get(device_id) is None:
            raise HTTPException(404, f"Dispozitiv necunoscut: {device_id}")
        return sim.set_isolated(device_id, (body or IsolateBody()).isolated).to_dict()

    app.include_router(build_router(sim))

    @app.get("/panel", include_in_schema=False)
    def panel_redirect():
        return RedirectResponse("/panel/")

    @app.get("/", include_in_schema=False)
    def root():
        return RedirectResponse("/panel/")

    app.mount("/panel", StaticFiles(directory=PANEL_DIR, html=True), name="panel")
    return app


app = create_app()
