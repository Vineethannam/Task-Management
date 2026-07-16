"""Bootstrap: indexes, roles, super-admin, demo data."""
import logging
from core.db import db
from core.config import (
    ADMIN_EMAIL, ADMIN_PASSWORD, DEFAULT_ROLE_PERMISSIONS, ROLE_PERMISSIONS,
)
from core.security import hash_password, verify_password
from core.utils import now_iso
from routes.bugs import _log_bug_activity

logger = logging.getLogger("sems.seed")


async def _seed_roles():
    for role_name, perms in DEFAULT_ROLE_PERMISSIONS.items():
        existing = await db.roles.find_one({"name": role_name})
        if existing:
            ROLE_PERMISSIONS[role_name] = existing.get("permissions", perms)
        else:
            await db.roles.insert_one({
                "name": role_name, "description": f"Default {role_name} role",
                "permissions": perms, "system": True,
                "created_at": now_iso(), "updated_at": now_iso(),
            })
            ROLE_PERMISSIONS[role_name] = perms


async def seed_data():
    # Indexes
    await db.users.create_index("email", unique=True)
    await db.roles.create_index("name", unique=True)
    await db.tasks.create_index([("project_id", 1)])
    await db.bugs.create_index([("project_id", 1)])
    await db.notifications.create_index([("user_id", 1), ("created_at", -1)])
    await db.timelogs.create_index([("task_id", 1)])
    await db.task_activity.create_index([("task_id", 1)])
    await db.bug_activity.create_index([("bug_id", 1)])
    await db.task_timers.create_index([("user_id", 1), ("status", 1)])
    await db.task_timers.create_index([("user_id", 1), ("task_id", 1)])

    await _seed_roles()

    admin_email = ADMIN_EMAIL.lower()
    existing = await db.users.find_one({"email": admin_email})
    if existing is None:
        await db.users.insert_one({
            "name": "Super Admin", "email": admin_email,
            "password_hash": hash_password(ADMIN_PASSWORD),
            "role": "SUPER_ADMIN", "skills": ["Management"],
            "active": True, "avatar": None, "created_at": now_iso(),
        })
        logger.info(f"Seeded super admin: {admin_email}")
    else:
        if not verify_password(ADMIN_PASSWORD, existing["password_hash"]):
            await db.users.update_one({"email": admin_email}, {"$set": {"password_hash": hash_password(ADMIN_PASSWORD)}})

    if await db.projects.count_documents({}) > 0:
        return

    admin_user = await db.users.find_one({"email": admin_email})
    admin_id = str(admin_user["_id"])

    sample_users = [
        {"name": "Aarav Sharma", "email": "aarav@sems.io", "role": "ADMIN", "skills": ["Leadership"]},
        {"name": "Meera Iyer", "email": "meera@sems.io", "role": "PROJECT_MANAGER", "skills": ["Scrum"]},
        {"name": "Rohan Verma", "email": "rohan@sems.io", "role": "TEAM_LEAD", "skills": ["React", "Node.js"]},
        {"name": "Priya Nair", "email": "priya@sems.io", "role": "TEAM_LEAD", "skills": ["Backend", "DevOps"]},
        {"name": "Kabir Singh", "email": "kabir@sems.io", "role": "DEVELOPER", "skills": ["React", "TypeScript"]},
        {"name": "Ananya Rao", "email": "ananya@sems.io", "role": "DEVELOPER", "skills": ["Python", "FastAPI"]},
        {"name": "Vikram Joshi", "email": "vikram@sems.io", "role": "DEVELOPER", "skills": ["Go", "PostgreSQL"]},
        {"name": "Isha Kapoor", "email": "isha@sems.io", "role": "TESTER", "skills": ["Selenium"]},
        {"name": "Neel Menon", "email": "neel@sems.io", "role": "TESTER", "skills": ["Playwright"]},
        {"name": "Riya Bhat", "email": "riya@sems.io", "role": "VIEWER", "skills": ["Stakeholder"]},
    ]
    user_ids = {}
    for u in sample_users:
        doc = {
            "name": u["name"], "email": u["email"].lower(),
            "password_hash": hash_password("Password@123"),
            "role": u["role"], "skills": u["skills"], "active": True, "avatar": None,
            "created_at": now_iso(),
        }
        try:
            r = await db.users.insert_one(doc)
            user_ids[u["email"]] = str(r.inserted_id)
        except Exception:
            eu = await db.users.find_one({"email": u["email"].lower()})
            user_ids[u["email"]] = str(eu["_id"])

    teams_seed = [
        {"name": "Frontend Guild", "description": "React specialists.", "lead": "rohan@sems.io", "members": ["kabir@sems.io", "rohan@sems.io"], "skills": ["React", "TypeScript"]},
        {"name": "Platform Core", "description": "Backend + infra.", "lead": "priya@sems.io", "members": ["ananya@sems.io", "vikram@sems.io", "priya@sems.io"], "skills": ["Python", "MongoDB"]},
        {"name": "Quality Squad", "description": "Testing & automation.", "lead": "isha@sems.io", "members": ["isha@sems.io", "neel@sems.io"], "skills": ["Cypress", "Playwright"]},
    ]
    team_ids = {}
    for t in teams_seed:
        doc = {
            "name": t["name"], "description": t["description"],
            "lead_id": user_ids[t["lead"]],
            "member_ids": [user_ids[m] for m in t["members"]],
            "skills": t["skills"], "created_at": now_iso(),
        }
        r = await db.teams.insert_one(doc)
        team_ids[t["name"]] = str(r.inserted_id)

    projects_seed = [
        {"name": "Apollo — SEMS v2", "description": "Next-gen SEMS with WebSockets and analytics.", "lead": "rohan@sems.io", "teams": ["Frontend Guild", "Platform Core", "Quality Squad"], "members": ["rohan@sems.io", "kabir@sems.io", "ananya@sems.io", "vikram@sems.io", "isha@sems.io"], "start": "2026-01-05", "end": "2026-06-30"},
        {"name": "Vega Analytics", "description": "Internal engineering productivity portal.", "lead": "priya@sems.io", "teams": ["Platform Core", "Quality Squad"], "members": ["priya@sems.io", "ananya@sems.io", "neel@sems.io"], "start": "2026-02-01", "end": "2026-05-15"},
        {"name": "Meridian Migration", "description": "Migrate legacy Jira boards to SEMS.", "lead": "meera@sems.io", "teams": ["Frontend Guild"], "members": ["meera@sems.io", "kabir@sems.io"], "start": "2026-01-20", "end": "2026-04-01"},
    ]
    project_ids = {}
    for p in projects_seed:
        doc = {
            "name": p["name"], "description": p["description"],
            "team_lead_id": user_ids[p["lead"]],
            "team_ids": [team_ids[tn] for tn in p["teams"]],
            "member_ids": [user_ids[m] for m in p["members"]],
            "start_date": p["start"], "end_date": p["end"],
            "status": "active", "created_by": admin_id, "created_at": now_iso(),
        }
        r = await db.projects.insert_one(doc)
        project_ids[p["name"]] = str(r.inserted_id)

    task_seed = [
        ("Build authentication module", "IN_REVIEW", "HIGH", "Apollo — SEMS v2", "ananya@sems.io", "Platform Core", 12, 2),
        ("Design kanban board UI", "IN_PROGRESS", "HIGH", "Apollo — SEMS v2", "kabir@sems.io", "Frontend Guild", 16, 3),
        ("Implement WebSocket notifications", "IN_PROGRESS", "URGENT", "Apollo — SEMS v2", "vikram@sems.io", "Platform Core", 20, 1),
        ("Theme switcher component", "COMPLETED", "MEDIUM", "Apollo — SEMS v2", "kabir@sems.io", "Frontend Guild", 6, 0),
        ("Role-based permission matrix", "BACKLOG", "MEDIUM", "Apollo — SEMS v2", "rohan@sems.io", "Frontend Guild", 8, 1),
        ("Task lifecycle state machine", "IN_REVIEW", "HIGH", "Apollo — SEMS v2", "priya@sems.io", "Platform Core", 10, 0),
        ("Sprint velocity report", "BACKLOG", "LOW", "Vega Analytics", "ananya@sems.io", "Platform Core", 8, 0),
        ("Bug triage dashboard", "IN_PROGRESS", "MEDIUM", "Vega Analytics", "kabir@sems.io", "Frontend Guild", 10, 2),
        ("Legacy Jira export parser", "BACKLOG", "MEDIUM", "Meridian Migration", "kabir@sems.io", "Frontend Guild", 14, 0),
        ("User onboarding flow", "COMPLETED", "LOW", "Meridian Migration", "kabir@sems.io", "Frontend Guild", 6, 0),
        ("Real-time bug alerts", "REASSIGNED", "HIGH", "Apollo — SEMS v2", "vikram@sems.io", "Platform Core", 12, 4),
        ("Export reports as PDF", "BACKLOG", "MEDIUM", "Vega Analytics", "ananya@sems.io", "Platform Core", 12, 1),
    ]
    task_id_list = []
    for title, status_, priority, pname, ae, tname, est, dcs in task_seed:
        doc = {
            "title": title, "description": f"{title} — seeded.",
            "project_id": project_ids[pname],
            "assignee_id": user_ids[ae], "team_id": team_ids[tname],
            "priority": priority, "status": status_,
            "estimated_hours": est, "due_date": None,
            "deadline_changes": dcs, "reassign_count": 1 if status_ == "REASSIGNED" else 0,
            "total_minutes_tracked": 0,
            "created_by": admin_id,
            "created_at": now_iso(), "updated_at": now_iso(),
        }
        r = await db.tasks.insert_one(doc)
        task_id_list.append(str(r.inserted_id))

    bugs_seed = [
        ("Login button not responsive on mobile", "OPEN", "HIGH", "Apollo — SEMS v2", "kabir@sems.io", "isha@sems.io", 0, 4),
        ("Task drag-drop loses assignee", "IN_PROGRESS", "MEDIUM", "Apollo — SEMS v2", "ananya@sems.io", "neel@sems.io", 1, 6),
        ("Report chart tooltip overlaps", "RESOLVED", "LOW", "Vega Analytics", "vikram@sems.io", "isha@sems.io", 0, 3),
        ("WebSocket disconnects on tab switch", "REOPENED", "CRITICAL", "Apollo — SEMS v2", "vikram@sems.io", "neel@sems.io", 2, 8),
        ("Timezone mismatch on task due dates", "OPEN", "MEDIUM", "Vega Analytics", "ananya@sems.io", "isha@sems.io", 0, 3),
        ("Permission matrix save fails silently", "IN_REVIEW", "HIGH", "Apollo — SEMS v2", "kabir@sems.io", "neel@sems.io", 1, 5),
    ]
    for title, status_, sev, pname, ae, reporter, reopens, est in bugs_seed:
        now = now_iso()
        doc = {
            "title": title, "description": f"Reported by QA: {title}",
            "project_id": project_ids[pname], "task_id": None,
            "assignee_id": user_ids[ae], "reporter_id": user_ids[reporter],
            "severity": sev, "status": status_, "estimated_hours": est,
            "reopen_count": reopens, "reassign_count": 0,
            "resolved_at": now if status_ == "RESOLVED" else None,
            "created_at": now, "updated_at": now,
        }
        r = await db.bugs.insert_one(doc)
        bid = str(r.inserted_id)
        await _log_bug_activity(bid, user_ids[reporter], "CREATED", {"title": title})
        if reopens > 0:
            await _log_bug_activity(bid, user_ids[reporter], "REOPENED", {"count": reopens})

    for tid in task_id_list[:8]:
        await db.timelogs.insert_one({
            "task_id": tid, "user_id": user_ids["ananya@sems.io"],
            "event_type": "STARTED", "minutes": 45, "progress": 30,
            "note": "Initial pass", "created_at": now_iso(),
        })

    logger.info("Seed data inserted.")
