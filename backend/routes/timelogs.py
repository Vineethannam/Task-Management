"""TimeLogs CRUD."""
from typing import Optional, Dict, Any
from fastapi import APIRouter, Depends

from core.db import db
from core.utils import paginated, serialize, now_iso
from core.permissions import perm_dep
from models.schemas import TimeLogCreate

router = APIRouter(prefix="/timelogs", tags=["timelogs"])


@router.post("")
async def create_timelog(body: TimeLogCreate, user: dict = Depends(perm_dep("timelog.create"))):
    doc = {
        "task_id": body.task_id, "user_id": str(user["_id"]),
        "event_type": body.event_type, "progress": body.progress,
        "minutes": body.minutes, "note": body.note or "",
        "created_at": now_iso(),
    }
    r = await db.timelogs.insert_one(doc)
    doc["_id"] = r.inserted_id
    return serialize(doc)


@router.get("")
async def list_timelogs(
    page: int = 1, page_size: int = 10,
    task_id: Optional[str] = None, user_id: Optional[str] = None,
    project_id: Optional[str] = None,
    user: dict = Depends(perm_dep("timelog.read")),
):
    filt: Dict[str, Any] = {}
    if task_id: filt["task_id"] = task_id
    if user_id: filt["user_id"] = user_id
    if project_id:
        tasks = await db.tasks.find({"project_id": project_id}, {"_id": 1}).to_list(2000)
        filt["task_id"] = {"$in": [str(t["_id"]) for t in tasks]}
    return await paginated(db.timelogs, filt, "created_at", page, page_size)
