"""SEMS FastAPI entrypoint — thin wiring layer.

Business logic lives in routes/, core/, services/ and models/ modules.
"""
import logging
from fastapi import FastAPI, APIRouter
from starlette.middleware.cors import CORSMiddleware

from core.config import FRONTEND_URL
from core.db import client
from core.utils import now_iso
from services.seed import seed_data
from routes import (
    auth, meta, roles, users, teams, projects,
    tasks, timer, timelogs, bugs, notifications,
    reports, analytics, me,
)
from routes.ws import websocket_endpoint

# ---------------- Logging ----------------
logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")
logger = logging.getLogger("sems")

# ---------------- App ----------------
app = FastAPI(title="SEMS API")
api = APIRouter(prefix="/api")

# Domain routers (order does not matter functionally; timer must be after tasks
# so that /tasks/{id}/timer/* paths resolve correctly alongside /tasks/{id})
api.include_router(auth.router)
api.include_router(meta.router)
api.include_router(roles.router)
api.include_router(users.router)
api.include_router(teams.router)
api.include_router(projects.router)
api.include_router(tasks.router)
api.include_router(timer.router)
api.include_router(timelogs.router)
api.include_router(bugs.router)
api.include_router(notifications.router)
api.include_router(reports.router)
api.include_router(analytics.router)
api.include_router(me.router)


@api.get("/health")
async def health():
    return {"ok": True, "service": "SEMS", "time": now_iso()}


app.include_router(api)

# WebSocket endpoint sits on the raw app (path prefix kept intact)
app.add_websocket_route("/api/ws", websocket_endpoint)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=[FRONTEND_URL, "http://localhost:3000"],
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"],
)


@app.on_event("startup")
async def startup_event():
    try:
        await seed_data()
    except Exception as e:
        logger.error(f"Seed error: {e}")


@app.on_event("shutdown")
async def shutdown_event():
    client.close()
