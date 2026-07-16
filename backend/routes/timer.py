"""Task Timer — start / pause / resume / stop with automatic time-log persistence."""
from datetime import datetime, timezone
from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException

from core.db import db
from core.utils import serialize, now_iso
from core.permissions import perm_dep, get_current_user
from models.schemas import TimerAction

router = APIRouter(prefix="/tasks", tags=["timer"])


def _elapsed_seconds(iso_from: str, iso_to: str) -> int:
    try:
        a = datetime.fromisoformat(iso_from.replace("Z", "+00:00"))
        b = datetime.fromisoformat(iso_to.replace("Z", "+00:00"))
        return max(int((b - a).total_seconds()), 0)
    except Exception:
        return 0


async def _stop_running_timers_for_user(user_id: str, except_timer_id: str = None):
    q = {"user_id": user_id, "status": "RUNNING"}
    if except_timer_id:
        q["_id"] = {"$ne": ObjectId(except_timer_id)}
    now = now_iso()
    running = await db.task_timers.find(q).to_list(50)
    for t in running:
        add = _elapsed_seconds(t.get("last_resumed_at") or t.get("started_at"), now)
        await db.task_timers.update_one({"_id": t["_id"]}, {
            "$set": {"status": "STOPPED", "ended_at": now, "updated_at": now, "last_resumed_at": None},
            "$inc": {"accumulated_seconds": add},
        })
        minutes = round((t.get("accumulated_seconds", 0) + add) / 60.0, 2)
        await db.timelogs.insert_one({
            "task_id": t["task_id"], "user_id": user_id,
            "event_type": "COMPLETED", "minutes": minutes,
            "progress": None, "note": "Auto-stopped when a new timer started.",
            "created_at": now,
        })
        if minutes > 0 and t.get("task_id"):
            await db.tasks.update_one({"_id": ObjectId(t["task_id"])}, {"$inc": {"total_minutes_tracked": minutes}})


@router.post("/{task_id}/timer/start")
async def start_timer(task_id: str, body: TimerAction = None, user: dict = Depends(perm_dep("timelog.create"))):
    task = await db.tasks.find_one({"_id": ObjectId(task_id)})
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    uid = str(user["_id"])
    now = now_iso()

    # Look for existing timer for this user + task (paused/running)
    existing = await db.task_timers.find_one({
        "user_id": uid, "task_id": task_id,
        "status": {"$in": ["RUNNING", "PAUSED"]},
    })

    if existing and existing["status"] == "RUNNING":
        # Already running; just return it
        return serialize(existing)

    # Stop any other running timers for this user
    await _stop_running_timers_for_user(uid, except_timer_id=str(existing["_id"]) if existing else None)

    if existing:
        # Resume paused timer
        await db.task_timers.update_one(
            {"_id": existing["_id"]},
            {"$set": {"status": "RUNNING", "last_resumed_at": now, "updated_at": now}},
        )
        # Log RESUMED
        await db.timelogs.insert_one({
            "task_id": task_id, "user_id": uid,
            "event_type": "RESUMED", "minutes": None,
            "progress": None, "note": (body.note if body else "") or "",
            "created_at": now,
        })
        t = await db.task_timers.find_one({"_id": existing["_id"]})
        return serialize(t)

    # Create new timer
    doc = {
        "user_id": uid, "task_id": task_id,
        "status": "RUNNING",
        "started_at": now, "last_resumed_at": now,
        "paused_at": None, "ended_at": None,
        "accumulated_seconds": 0,
        "created_at": now, "updated_at": now,
    }
    r = await db.task_timers.insert_one(doc)
    doc["_id"] = r.inserted_id

    # If task was in BACKLOG, auto-transition to IN_PROGRESS (preserves prior behavior expectations)
    if task.get("status") == "BACKLOG":
        await db.tasks.update_one({"_id": ObjectId(task_id)}, {"$set": {"status": "IN_PROGRESS", "updated_at": now}})
        await db.task_activity.insert_one({
            "task_id": task_id, "user_id": uid, "event": "STATUS_CHANGED",
            "details": {"from": "BACKLOG", "to": "IN_PROGRESS", "reason": "timer_started"},
            "created_at": now,
        })

    await db.timelogs.insert_one({
        "task_id": task_id, "user_id": uid,
        "event_type": "STARTED", "minutes": None,
        "progress": None, "note": (body.note if body else "") or "",
        "created_at": now,
    })
    await db.task_activity.insert_one({
        "task_id": task_id, "user_id": uid, "event": "TIMER_STARTED",
        "details": {"timer_id": str(r.inserted_id)}, "created_at": now,
    })
    return serialize(doc)


@router.post("/{task_id}/timer/pause")
async def pause_timer(task_id: str, body: TimerAction = None, user: dict = Depends(perm_dep("timelog.create"))):
    uid = str(user["_id"])
    t = await db.task_timers.find_one({"user_id": uid, "task_id": task_id, "status": "RUNNING"})
    if not t:
        raise HTTPException(status_code=400, detail="No running timer for this task")
    now = now_iso()
    add = _elapsed_seconds(t.get("last_resumed_at") or t.get("started_at"), now)
    await db.task_timers.update_one({"_id": t["_id"]}, {
        "$set": {"status": "PAUSED", "paused_at": now, "last_resumed_at": None, "updated_at": now},
        "$inc": {"accumulated_seconds": add},
    })
    await db.timelogs.insert_one({
        "task_id": task_id, "user_id": uid,
        "event_type": "PAUSED", "minutes": round(add / 60.0, 2),
        "progress": None, "note": (body.note if body else "") or "",
        "created_at": now,
    })
    await db.task_activity.insert_one({
        "task_id": task_id, "user_id": uid, "event": "TIMER_PAUSED",
        "details": {"seconds_added": add}, "created_at": now,
    })
    t = await db.task_timers.find_one({"_id": t["_id"]})
    return serialize(t)


@router.post("/{task_id}/timer/stop")
async def stop_timer(task_id: str, body: TimerAction = None, user: dict = Depends(perm_dep("timelog.create"))):
    uid = str(user["_id"])
    t = await db.task_timers.find_one({
        "user_id": uid, "task_id": task_id,
        "status": {"$in": ["RUNNING", "PAUSED"]},
    })
    if not t:
        raise HTTPException(status_code=400, detail="No active timer for this task")
    now = now_iso()
    add = 0
    if t["status"] == "RUNNING":
        add = _elapsed_seconds(t.get("last_resumed_at") or t.get("started_at"), now)
    await db.task_timers.update_one({"_id": t["_id"]}, {
        "$set": {"status": "STOPPED", "ended_at": now, "last_resumed_at": None, "updated_at": now},
        "$inc": {"accumulated_seconds": add},
    })
    total_seconds = t.get("accumulated_seconds", 0) + add
    minutes = round(total_seconds / 60.0, 2)
    await db.timelogs.insert_one({
        "task_id": task_id, "user_id": uid,
        "event_type": "COMPLETED", "minutes": minutes,
        "progress": None, "note": (body.note if body else "") or "",
        "created_at": now,
    })
    if minutes > 0:
        await db.tasks.update_one({"_id": ObjectId(task_id)}, {"$inc": {"total_minutes_tracked": minutes}})
    await db.task_activity.insert_one({
        "task_id": task_id, "user_id": uid, "event": "TIMER_STOPPED",
        "details": {"total_seconds": total_seconds, "minutes": minutes},
        "created_at": now,
    })
    t = await db.task_timers.find_one({"_id": t["_id"]})
    return serialize(t)


@router.get("/{task_id}/timer")
async def get_task_timer(task_id: str, user: dict = Depends(get_current_user)):
    """Return current user's timer for a task (any status), if any."""
    t = await db.task_timers.find_one({"user_id": str(user["_id"]), "task_id": task_id})
    return serialize(t) if t else None
