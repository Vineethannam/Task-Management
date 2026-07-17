"""Tasks CRUD + activity + comments."""
from typing import Optional, Dict, Any
from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException

from core.db import db
from core.config import TASK_STATUSES, TASK_PRIORITIES
from core.utils import serialize, serialize_list, paginated, now_iso
from core.permissions import perm_dep
from services.notifications import create_notification
from models.schemas import TaskCreate, TaskUpdate, TaskComment

router = APIRouter(prefix="/tasks", tags=["tasks"])


async def _log_task_activity(task_id: str, user_id: str, event: str, details: dict = None):
    await db.task_activity.insert_one({
        "task_id": task_id, "user_id": user_id, "event": event,
        "details": details or {}, "created_at": now_iso(),
    })


@router.get("")
async def list_tasks(
    page: int = 1, page_size: int = 10,
    project_id: Optional[str] = None,
    assignee_id: Optional[str] = None,
    team_id: Optional[str] = None,
    status: Optional[str] = None,
    priority: Optional[str] = None,
    q: Optional[str] = None,
    user: dict = Depends(perm_dep("task.read")),
):
    filt: Dict[str, Any] = {}
    if project_id: filt["project_id"] = project_id
    if assignee_id: filt["assignee_id"] = assignee_id
    if team_id: filt["team_id"] = team_id
    if status: filt["status"] = status
    if priority: filt["priority"] = priority
    if q: filt["title"] = {"$regex": q, "$options": "i"}
    return await paginated(db.tasks, filt, "updated_at", page, page_size)


@router.get("/by-project/{project_id}")
async def tasks_by_project(project_id: str, user: dict = Depends(perm_dep("task.read"))):
    docs = await db.tasks.find({
        "project_id": project_id,
        "$or": [{"parent_id": None}, {"parent_id": {"$exists": False}}]
    }).sort("created_at", -1).to_list(2000)
    return serialize_list(docs)


@router.post("")
async def create_task(body: TaskCreate, user: dict = Depends(perm_dep("task.create"))):
    if body.status not in TASK_STATUSES:
        raise HTTPException(status_code=400, detail="Invalid status")
    if body.priority not in TASK_PRIORITIES:
        raise HTTPException(status_code=400, detail="Invalid priority")
    doc = {
        "title": body.title, "description": body.description or "",
        "project_id": body.project_id,
        "assignee_id": body.assignee_id, "team_id": body.team_id,
        "priority": body.priority, "status": body.status,
        "estimated_hours": body.estimated_hours, "due_date": body.due_date,
        "parent_id": body.parent_id,
        "deadline_changes": 0, "reassign_count": 0,
        "total_minutes_tracked": 0,
        "created_by": str(user["_id"]),
        "created_at": now_iso(), "updated_at": now_iso(),
    }
    r = await db.tasks.insert_one(doc)
    doc["_id"] = r.inserted_id
    await _log_task_activity(str(r.inserted_id), str(user["_id"]), "CREATED", {"title": body.title, "assignee_id": body.assignee_id, "due_date": body.due_date})
    if body.assignee_id:
        await create_notification(body.assignee_id, "TASK_ASSIGNED", f"Task assigned: {body.title}", {"task_id": str(r.inserted_id), "project_id": body.project_id})
    return serialize(doc)


@router.get("/{task_id}")
async def get_task(task_id: str, user: dict = Depends(perm_dep("task.read"))):
    t = await db.tasks.find_one({"_id": ObjectId(task_id)})
    if not t:
        raise HTTPException(status_code=404, detail="Task not found")
    return serialize(t)


@router.put("/{task_id}")
async def update_task(task_id: str, body: TaskUpdate, user: dict = Depends(perm_dep("task.update"))):
    existing = await db.tasks.find_one({"_id": ObjectId(task_id)})
    if not existing:
        raise HTTPException(status_code=404, detail="Task not found")
    updates = body.model_dump(exclude_none=True)
    if "status" in updates and updates["status"] not in TASK_STATUSES:
        raise HTTPException(status_code=400, detail="Invalid status")
    if "priority" in updates and updates["priority"] not in TASK_PRIORITIES:
        raise HTTPException(status_code=400, detail="Invalid priority")
    updates["updated_at"] = now_iso()

    inc: Dict[str, int] = {}
    if "due_date" in updates and updates["due_date"] != existing.get("due_date"):
        inc["deadline_changes"] = 1
    if "assignee_id" in updates and updates["assignee_id"] != existing.get("assignee_id"):
        inc["reassign_count"] = 1

    op: Dict[str, Any] = {"$set": updates}
    if inc:
        op["$inc"] = inc
    await db.tasks.update_one({"_id": ObjectId(task_id)}, op)

    uid = str(user["_id"])
    if "status" in updates and updates["status"] != existing.get("status"):
        await _log_task_activity(task_id, uid, "STATUS_CHANGED", {"from": existing.get("status"), "to": updates["status"]})
    if "assignee_id" in updates and updates["assignee_id"] != existing.get("assignee_id"):
        await _log_task_activity(task_id, uid, "REASSIGNED", {"from": existing.get("assignee_id"), "to": updates["assignee_id"]})
        if updates["assignee_id"]:
            await create_notification(updates["assignee_id"], "TASK_ASSIGNED", f"Task assigned: {existing['title']}", {"task_id": task_id, "project_id": existing.get("project_id")})
    if "due_date" in updates and updates["due_date"] != existing.get("due_date"):
        await _log_task_activity(task_id, uid, "DEADLINE_CHANGED", {"from": existing.get("due_date"), "to": updates["due_date"]})
    if "priority" in updates and updates["priority"] != existing.get("priority"):
        await _log_task_activity(task_id, uid, "PRIORITY_CHANGED", {"from": existing.get("priority"), "to": updates["priority"]})
    if "estimated_hours" in updates and updates["estimated_hours"] != existing.get("estimated_hours"):
        await _log_task_activity(task_id, uid, "ESTIMATE_CHANGED", {"from": existing.get("estimated_hours"), "to": updates["estimated_hours"]})

    t = await db.tasks.find_one({"_id": ObjectId(task_id)})
    return serialize(t)


@router.delete("/{task_id}")
async def delete_task(task_id: str, user: dict = Depends(perm_dep("task.delete"))):
    await db.tasks.delete_one({"_id": ObjectId(task_id)})
    await db.task_activity.delete_many({"task_id": task_id})
    await db.task_comments.delete_many({"task_id": task_id})
    return {"ok": True}


@router.get("/{task_id}/activity")
async def task_activity(task_id: str, user: dict = Depends(perm_dep("task.read"))):
    acts = await db.task_activity.find({"task_id": task_id}).sort("created_at", -1).to_list(500)
    return serialize_list(acts)


@router.get("/{task_id}/comments")
async def get_comments(task_id: str, user: dict = Depends(perm_dep("task.read"))):
    comments = await db.task_comments.find({"task_id": task_id}).sort("created_at", 1).to_list(500)
    return serialize_list(comments)


@router.post("/{task_id}/comments")
async def add_comment(task_id: str, body: TaskComment, user: dict = Depends(perm_dep("task.read"))):
    doc = {
        "task_id": task_id, "user_id": str(user["_id"]),
        "user_name": user.get("name", "User"),
        "content": body.content, "created_at": now_iso(),
    }
    r = await db.task_comments.insert_one(doc)
    doc["_id"] = r.inserted_id
    await _log_task_activity(task_id, str(user["_id"]), "COMMENTED", {"preview": body.content[:100]})
    return serialize(doc)


@router.get("/{task_id}/subtasks")
async def list_subtasks(task_id: str, user: dict = Depends(perm_dep("task.read"))):
    docs = await db.tasks.find({"parent_id": task_id}).sort("created_at", 1).to_list(100)
    return serialize_list(docs)
