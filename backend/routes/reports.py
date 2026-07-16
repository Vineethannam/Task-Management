"""Reports endpoints — user/team/project/global aggregations."""
from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException

from core.db import db
from core.config import TASK_STATUSES, TASK_PRIORITIES, BUG_STATUSES, BUG_SEVERITIES
from core.utils import serialize, serialize_list
from core.permissions import perm_dep

router = APIRouter(prefix="/reports", tags=["reports"])


@router.get("/dashboard")
async def dashboard_stats(user: dict = Depends(perm_dep("report.read"))):
    total_projects = await db.projects.count_documents({})
    total_users = await db.users.count_documents({})
    total_teams = await db.teams.count_documents({})
    total_tasks = await db.tasks.count_documents({})
    total_bugs = await db.bugs.count_documents({})
    tasks_by_status = {s: await db.tasks.count_documents({"status": s}) for s in TASK_STATUSES}
    bugs_by_status = {s: await db.bugs.count_documents({"status": s}) for s in BUG_STATUSES}
    bugs_by_severity = {s: await db.bugs.count_documents({"severity": s}) for s in BUG_SEVERITIES}
    tasks_by_priority = {p: await db.tasks.count_documents({"priority": p}) for p in TASK_PRIORITIES}
    return {
        "totals": {"projects": total_projects, "users": total_users, "teams": total_teams, "tasks": total_tasks, "bugs": total_bugs},
        "tasks_by_status": tasks_by_status, "bugs_by_status": bugs_by_status,
        "bugs_by_severity": bugs_by_severity, "tasks_by_priority": tasks_by_priority,
    }


@router.get("/tasks-global")
async def tasks_global(user: dict = Depends(perm_dep("report.read"))):
    return {s: await db.tasks.count_documents({"status": s}) for s in TASK_STATUSES}


@router.get("/user/{user_id}")
async def user_report(user_id: str, user: dict = Depends(perm_dep("report.read"))):
    tasks = await db.tasks.find({"assignee_id": user_id}).to_list(2000)
    by_status = {s: 0 for s in TASK_STATUSES}
    for t in tasks:
        by_status[t.get("status", "BACKLOG")] += 1
    logs = await db.timelogs.find({"user_id": user_id}).to_list(2000)
    total_minutes = sum([(l.get("minutes") or 0) for l in logs])
    bugs = await db.bugs.find({"assignee_id": user_id}).to_list(2000)
    bugs_by_status = {s: 0 for s in BUG_STATUSES}
    for b in bugs:
        bugs_by_status[b.get("status", "OPEN")] += 1
    total_deadline_changes = sum([(t.get("deadline_changes") or 0) for t in tasks])
    total_reopens = sum([(b.get("reopen_count") or 0) for b in bugs])
    return {
        "user_id": user_id, "tasks_by_status": by_status,
        "bugs_by_status": bugs_by_status,
        "total_tasks": len(tasks), "total_bugs": len(bugs),
        "total_minutes": total_minutes,
        "total_deadline_changes": total_deadline_changes,
        "total_bug_reopens": total_reopens,
    }


@router.get("/team/{team_id}")
async def team_report(team_id: str, user: dict = Depends(perm_dep("report.read"))):
    team = await db.teams.find_one({"_id": ObjectId(team_id)})
    if not team:
        raise HTTPException(status_code=404, detail="Team not found")
    tasks = await db.tasks.find({"team_id": team_id}).to_list(2000)
    by_status = {s: 0 for s in TASK_STATUSES}
    for t in tasks:
        by_status[t.get("status", "BACKLOG")] += 1
    return {"team": serialize(team), "tasks_by_status": by_status, "total_tasks": len(tasks)}


@router.get("/project/{project_id}")
async def project_report(project_id: str, user: dict = Depends(perm_dep("report.read"))):
    project = await db.projects.find_one({"_id": ObjectId(project_id)})
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    tasks = await db.tasks.find({"project_id": project_id}).to_list(2000)
    bugs = await db.bugs.find({"project_id": project_id}).to_list(2000)
    tasks_by_status = {s: 0 for s in TASK_STATUSES}
    for t in tasks:
        tasks_by_status[t.get("status", "BACKLOG")] += 1
    bugs_by_status = {s: 0 for s in BUG_STATUSES}
    for b in bugs:
        bugs_by_status[b.get("status", "OPEN")] += 1
    return {
        "project": serialize(project),
        "tasks_by_status": tasks_by_status, "bugs_by_status": bugs_by_status,
        "total_tasks": len(tasks), "total_bugs": len(bugs),
    }
