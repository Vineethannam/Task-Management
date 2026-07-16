"""Analytics endpoints — bug timeline, top offenders, delay analytics."""
from datetime import datetime, timezone, timedelta
from typing import Dict
from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException

from core.db import db
from core.permissions import perm_dep

router = APIRouter(prefix="/analytics", tags=["analytics"])


def _iso_day(dt: datetime) -> str:
    return dt.strftime("%Y-%m-%d")


@router.get("/bugs/timeline")
async def bug_timeline(days: int = 30, user: dict = Depends(perm_dep("analytics.read"))):
    days = min(max(days, 7), 180)
    now = datetime.now(timezone.utc)
    start = now - timedelta(days=days - 1)
    start_iso = start.replace(hour=0, minute=0, second=0, microsecond=0).isoformat()
    created = await db.bugs.find({"created_at": {"$gte": start_iso}}).to_list(5000)
    resolved = await db.bugs.find({"resolved_at": {"$gte": start_iso}}).to_list(5000)
    buckets: Dict[str, Dict[str, int]] = {}
    for i in range(days):
        d = (start + timedelta(days=i))
        buckets[_iso_day(d)] = {"date": _iso_day(d), "created": 0, "resolved": 0}
    for b in created:
        try:
            d = datetime.fromisoformat(b["created_at"].replace("Z", "+00:00"))
            k = _iso_day(d)
            if k in buckets: buckets[k]["created"] += 1
        except Exception:
            pass
    for b in resolved:
        ra = b.get("resolved_at")
        if not ra: continue
        try:
            d = datetime.fromisoformat(ra.replace("Z", "+00:00"))
            k = _iso_day(d)
            if k in buckets: buckets[k]["resolved"] += 1
        except Exception:
            pass
    return {"days": days, "series": list(buckets.values())}


@router.get("/bugs/summary")
async def bug_summary(user: dict = Depends(perm_dep("analytics.read"))):
    total = await db.bugs.count_documents({})
    open_ = await db.bugs.count_documents({"status": {"$in": ["OPEN", "IN_PROGRESS", "IN_REVIEW", "REOPENED"]}})
    resolved = await db.bugs.count_documents({"status": {"$in": ["RESOLVED", "CLOSED"]}})
    reopened = await db.bugs.count_documents({"status": "REOPENED"})
    critical = await db.bugs.count_documents({"severity": "CRITICAL"})
    pipeline = [{"$group": {"_id": None, "sum": {"$sum": "$reopen_count"}}}]
    total_reopens = 0
    async for row in db.bugs.aggregate(pipeline):
        total_reopens = row.get("sum") or 0
    return {"total": total, "open": open_, "resolved": resolved, "reopened_now": reopened, "critical": critical, "total_reopens": total_reopens}


@router.get("/bugs/top")
async def bug_top(dimension: str = "user", limit: int = 10, user: dict = Depends(perm_dep("analytics.read"))):
    limit = min(max(limit, 1), 50)
    field_map = {"user": "assignee_id", "project": "project_id"}
    if dimension not in ("user", "project", "team"):
        raise HTTPException(status_code=400, detail="dimension must be user, project or team")

    if dimension == "team":
        pipeline = [
            {"$match": {"task_id": {"$ne": None}}},
            {"$addFields": {"task_oid": {"$toObjectId": "$task_id"}}},
            {"$lookup": {"from": "tasks", "localField": "task_oid", "foreignField": "_id", "as": "task"}},
            {"$unwind": "$task"},
            {"$match": {"task.team_id": {"$ne": None}}},
            {"$group": {"_id": "$task.team_id", "count": {"$sum": 1}, "open": {"$sum": {"$cond": [{"$in": ["$status", ["OPEN", "IN_PROGRESS", "IN_REVIEW", "REOPENED"]]}, 1, 0]}}, "critical": {"$sum": {"$cond": [{"$eq": ["$severity", "CRITICAL"]}, 1, 0]}}}},
            {"$sort": {"count": -1}}, {"$limit": limit},
        ]
        rows = [r async for r in db.bugs.aggregate(pipeline)]
        out = []
        for r in rows:
            team = await db.teams.find_one({"_id": ObjectId(r["_id"])}) if r.get("_id") else None
            out.append({"id": r["_id"], "name": (team or {}).get("name", "—"), "count": r["count"], "open": r.get("open", 0), "critical": r.get("critical", 0)})
        return out

    field = field_map[dimension]
    pipeline = [
        {"$match": {field: {"$ne": None}}},
        {"$group": {"_id": f"${field}", "count": {"$sum": 1}, "open": {"$sum": {"$cond": [{"$in": ["$status", ["OPEN", "IN_PROGRESS", "IN_REVIEW", "REOPENED"]]}, 1, 0]}}, "critical": {"$sum": {"$cond": [{"$eq": ["$severity", "CRITICAL"]}, 1, 0]}}}},
        {"$sort": {"count": -1}}, {"$limit": limit},
    ]
    rows = [r async for r in db.bugs.aggregate(pipeline)]
    out = []
    for r in rows:
        name = "—"
        try:
            if dimension == "user":
                u = await db.users.find_one({"_id": ObjectId(r["_id"])})
                name = (u or {}).get("name", "—")
            else:
                p = await db.projects.find_one({"_id": ObjectId(r["_id"])})
                name = (p or {}).get("name", "—")
        except Exception:
            pass
        out.append({"id": r["_id"], "name": name, "count": r["count"], "open": r.get("open", 0), "critical": r.get("critical", 0)})
    return out


@router.get("/delays")
async def delay_analytics(user: dict = Depends(perm_dep("analytics.read"))):
    user_pipe = [
        {"$match": {"assignee_id": {"$ne": None}, "deadline_changes": {"$gt": 0}}},
        {"$group": {"_id": "$assignee_id", "deadline_changes": {"$sum": "$deadline_changes"}, "reassigns": {"$sum": "$reassign_count"}, "tasks": {"$sum": 1}}},
        {"$sort": {"deadline_changes": -1}}, {"$limit": 10},
    ]
    user_rows = [r async for r in db.tasks.aggregate(user_pipe)]
    users_out = []
    for r in user_rows:
        u = await db.users.find_one({"_id": ObjectId(r["_id"])}) if r.get("_id") else None
        users_out.append({"id": r["_id"], "name": (u or {}).get("name", "—"), "deadline_changes": r["deadline_changes"], "reassigns": r.get("reassigns", 0), "tasks": r["tasks"]})

    team_pipe = [
        {"$match": {"team_id": {"$ne": None}, "deadline_changes": {"$gt": 0}}},
        {"$group": {"_id": "$team_id", "deadline_changes": {"$sum": "$deadline_changes"}, "reassigns": {"$sum": "$reassign_count"}, "tasks": {"$sum": 1}}},
        {"$sort": {"deadline_changes": -1}}, {"$limit": 10},
    ]
    team_rows = [r async for r in db.tasks.aggregate(team_pipe)]
    teams_out = []
    for r in team_rows:
        t = await db.teams.find_one({"_id": ObjectId(r["_id"])}) if r.get("_id") else None
        teams_out.append({"id": r["_id"], "name": (t or {}).get("name", "—"), "deadline_changes": r["deadline_changes"], "reassigns": r.get("reassigns", 0), "tasks": r["tasks"]})

    return {"users": users_out, "teams": teams_out}
