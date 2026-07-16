"""Bugs CRUD + activity log."""
from typing import Optional, Dict, Any
from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException

from core.db import db
from core.config import BUG_STATUSES, BUG_SEVERITIES
from core.utils import serialize, serialize_list, paginated, now_iso
from core.permissions import perm_dep
from services.notifications import create_notification
from models.schemas import BugCreate, BugUpdate

router = APIRouter(prefix="/bugs", tags=["bugs"])


async def _log_bug_activity(bug_id: str, user_id: str, event: str, details: dict = None):
    await db.bug_activity.insert_one({
        "bug_id": bug_id, "user_id": user_id, "event": event,
        "details": details or {}, "created_at": now_iso(),
    })


@router.get("")
async def list_bugs(
    page: int = 1, page_size: int = 10,
    project_id: Optional[str] = None, task_id: Optional[str] = None,
    assignee_id: Optional[str] = None, status: Optional[str] = None,
    severity: Optional[str] = None, q: Optional[str] = None,
    user: dict = Depends(perm_dep("bug.read")),
):
    filt: Dict[str, Any] = {}
    if project_id: filt["project_id"] = project_id
    if task_id: filt["task_id"] = task_id
    if assignee_id: filt["assignee_id"] = assignee_id
    if status: filt["status"] = status
    if severity: filt["severity"] = severity
    if q: filt["title"] = {"$regex": q, "$options": "i"}
    return await paginated(db.bugs, filt, "updated_at", page, page_size)


@router.post("")
async def create_bug(body: BugCreate, user: dict = Depends(perm_dep("bug.create"))):
    if body.status not in BUG_STATUSES:
        raise HTTPException(status_code=400, detail="Invalid status")
    if body.severity not in BUG_SEVERITIES:
        raise HTTPException(status_code=400, detail="Invalid severity")
    now = now_iso()
    doc = {
        "title": body.title, "description": body.description or "",
        "project_id": body.project_id, "task_id": body.task_id,
        "assignee_id": body.assignee_id, "reporter_id": str(user["_id"]),
        "severity": body.severity, "status": body.status,
        "estimated_hours": body.estimated_hours,
        "reopen_count": 0, "reassign_count": 0,
        "resolved_at": None,
        "created_at": now, "updated_at": now,
    }
    r = await db.bugs.insert_one(doc)
    doc["_id"] = r.inserted_id
    bid = str(r.inserted_id)
    await _log_bug_activity(bid, str(user["_id"]), "CREATED", {"title": body.title, "severity": body.severity})
    if body.assignee_id:
        await _log_bug_activity(bid, str(user["_id"]), "ASSIGNED", {"to": body.assignee_id})
        await create_notification(body.assignee_id, "BUG_ASSIGNED", f"Bug assigned: {body.title}", {"bug_id": bid, "project_id": body.project_id})
    return serialize(doc)


@router.get("/{bug_id}")
async def get_bug(bug_id: str, user: dict = Depends(perm_dep("bug.read"))):
    b = await db.bugs.find_one({"_id": ObjectId(bug_id)})
    if not b:
        raise HTTPException(status_code=404, detail="Bug not found")
    return serialize(b)


@router.put("/{bug_id}")
async def update_bug(bug_id: str, body: BugUpdate, user: dict = Depends(perm_dep("bug.update"))):
    existing = await db.bugs.find_one({"_id": ObjectId(bug_id)})
    if not existing:
        raise HTTPException(status_code=404, detail="Bug not found")
    updates = body.model_dump(exclude_none=True)
    if "status" in updates and updates["status"] not in BUG_STATUSES:
        raise HTTPException(status_code=400, detail="Invalid status")
    if "severity" in updates and updates["severity"] not in BUG_SEVERITIES:
        raise HTTPException(status_code=400, detail="Invalid severity")
    updates["updated_at"] = now_iso()

    inc: Dict[str, int] = {}
    old_status = existing.get("status")
    new_status = updates.get("status", old_status)
    if new_status == "REOPENED" and old_status in ("RESOLVED", "CLOSED"):
        inc["reopen_count"] = 1
    if new_status == "RESOLVED" and old_status != "RESOLVED":
        updates["resolved_at"] = now_iso()
    if "assignee_id" in updates and updates["assignee_id"] != existing.get("assignee_id"):
        inc["reassign_count"] = 1

    op: Dict[str, Any] = {"$set": updates}
    if inc:
        op["$inc"] = inc
    await db.bugs.update_one({"_id": ObjectId(bug_id)}, op)

    uid = str(user["_id"])
    if "status" in updates and new_status != old_status:
        event = "REOPENED" if new_status == "REOPENED" else ("RESOLVED" if new_status == "RESOLVED" else "STATUS_CHANGED")
        await _log_bug_activity(bug_id, uid, event, {"from": old_status, "to": new_status})
    if "assignee_id" in updates and updates["assignee_id"] != existing.get("assignee_id"):
        await _log_bug_activity(bug_id, uid, "ASSIGNED", {"from": existing.get("assignee_id"), "to": updates["assignee_id"]})
        if updates["assignee_id"]:
            await create_notification(updates["assignee_id"], "BUG_ASSIGNED", f"Bug assigned: {existing['title']}", {"bug_id": bug_id, "project_id": existing.get("project_id")})
    if "severity" in updates and updates["severity"] != existing.get("severity"):
        await _log_bug_activity(bug_id, uid, "SEVERITY_CHANGED", {"from": existing.get("severity"), "to": updates["severity"]})

    b = await db.bugs.find_one({"_id": ObjectId(bug_id)})
    return serialize(b)


@router.delete("/{bug_id}")
async def delete_bug(bug_id: str, user: dict = Depends(perm_dep("bug.delete"))):
    await db.bugs.delete_one({"_id": ObjectId(bug_id)})
    await db.bug_activity.delete_many({"bug_id": bug_id})
    return {"ok": True}


@router.get("/{bug_id}/activity")
async def bug_activity(bug_id: str, user: dict = Depends(perm_dep("bug.read"))):
    acts = await db.bug_activity.find({"bug_id": bug_id}).sort("created_at", -1).to_list(500)
    return serialize_list(acts)
