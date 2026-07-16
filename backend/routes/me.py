"""My Work + Active Timer endpoints (prefix: /me)."""
from typing import Optional, Dict, Any
from bson import ObjectId
from fastapi import APIRouter, Depends

from core.db import db
from core.utils import paginated, serialize
from core.permissions import get_current_user

router = APIRouter(prefix="/me", tags=["me"])


@router.get("/tasks")
async def my_tasks(
    page: int = 1, page_size: int = 10, status: Optional[str] = None,
    user: dict = Depends(get_current_user),
):
    filt: Dict[str, Any] = {"assignee_id": str(user["_id"])}
    if status: filt["status"] = status
    return await paginated(db.tasks, filt, "updated_at", page, page_size)


@router.get("/projects")
async def my_projects(page: int = 1, page_size: int = 20, user: dict = Depends(get_current_user)):
    uid = str(user["_id"])
    filt = {"$or": [{"member_ids": uid}, {"team_lead_id": uid}]}
    return await paginated(db.projects, filt, "created_at", page, page_size)


@router.get("/bugs")
async def my_bugs(page: int = 1, page_size: int = 10, user: dict = Depends(get_current_user)):
    filt = {"assignee_id": str(user["_id"])}
    return await paginated(db.bugs, filt, "updated_at", page, page_size)


@router.get("/timer/active")
async def active_timer(user: dict = Depends(get_current_user)):
    """Return the current user's running or paused timer, if any."""
    t = await db.task_timers.find_one({
        "user_id": str(user["_id"]),
        "status": {"$in": ["RUNNING", "PAUSED"]},
    })
    if not t:
        return None
    ser = serialize(t)
    # Attach task info
    if t.get("task_id"):
        task = await db.tasks.find_one({"_id": ObjectId(t["task_id"])})
        ser["task"] = serialize(task) if task else None
    return ser
