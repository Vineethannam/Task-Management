"""Environment configuration and static constants."""
import os
from pathlib import Path
from dotenv import load_dotenv

ROOT_DIR = Path(__file__).parent.parent
load_dotenv(ROOT_DIR / ".env")

# ---- Environment (must be set)
MONGO_URL = os.environ["MONGO_URL"]
DB_NAME = os.environ["DB_NAME"]
JWT_SECRET = os.environ["JWT_SECRET"]
ADMIN_EMAIL = os.environ.get("ADMIN_EMAIL", "admin@sems.io")
ADMIN_PASSWORD = os.environ.get("ADMIN_PASSWORD", "Admin@123")
FRONTEND_URL = os.environ.get("FRONTEND_URL", "http://localhost:3000","task-management-frontend-puce-eight.vercel.app")

# ---- Auth constants
JWT_ALGORITHM = "HS256"
ACCESS_TOKEN_MINUTES = 60 * 24  # 1 day
REFRESH_TOKEN_DAYS = 7

# ---- Domain constants
ROLES = ["SUPER_ADMIN", "ADMIN", "PROJECT_MANAGER", "TEAM_LEAD", "DEVELOPER", "TESTER", "VIEWER"]

TASK_STATUSES = ["BACKLOG", "IN_PROGRESS", "IN_REVIEW", "COMPLETED", "REASSIGNED"]
TASK_PRIORITIES = ["LOW", "MEDIUM", "HIGH", "URGENT"]

BUG_STATUSES = ["OPEN", "IN_PROGRESS", "IN_REVIEW", "RESOLVED", "REOPENED", "CLOSED"]
BUG_SEVERITIES = ["LOW", "MEDIUM", "HIGH", "CRITICAL"]

# ---- Permission matrix modules (used by frontend to render matrix)
PERMISSION_MODULES = [
    {"key": "dashboard", "label": "Dashboard", "actions": ["read"]},
    {"key": "user", "label": "User Management", "actions": ["create", "read", "update", "delete"]},
    {"key": "role", "label": "Role Management", "actions": ["create", "read", "update", "delete"]},
    {"key": "team", "label": "Team Management", "actions": ["create", "read", "update", "delete"]},
    {"key": "project", "label": "Project Management", "actions": ["create", "read", "update", "delete"]},
    {"key": "task", "label": "Task Management", "actions": ["create", "read", "update", "delete", "assign"]},
    {"key": "bug", "label": "Bug Management", "actions": ["create", "read", "update", "delete", "assign"]},
    {"key": "timelog", "label": "Time Logs", "actions": ["create", "read"]},
    {"key": "report", "label": "Reports", "actions": ["read"]},
    {"key": "analytics", "label": "Analytics", "actions": ["read"]},
]

DEFAULT_ROLE_PERMISSIONS = {
    "SUPER_ADMIN": ["*"],
    "ADMIN": [
        "dashboard.read",
        "user.read", "user.create", "user.update", "user.delete",
        "role.read", "role.update",
        "team.read", "team.create", "team.update", "team.delete",
        "project.read", "project.create", "project.update", "project.delete",
        "task.read", "task.create", "task.update", "task.delete", "task.assign",
        "bug.read", "bug.create", "bug.update", "bug.delete", "bug.assign",
        "timelog.read", "timelog.create", "report.read", "analytics.read",
    ],
    "PROJECT_MANAGER": [
        "dashboard.read",
        "user.read", "role.read", "team.read", "team.create", "team.update",
        "project.read", "project.create", "project.update",
        "task.read", "task.create", "task.update", "task.assign",
        "bug.read", "bug.update", "bug.assign",
        "timelog.read", "timelog.create", "report.read", "analytics.read",
    ],
    "TEAM_LEAD": [
        "dashboard.read", "user.read", "role.read", "team.read", "project.read",
        "task.read", "task.create", "task.update", "task.assign",
        "bug.read", "bug.update", "bug.assign",
        "timelog.read", "timelog.create", "report.read", "analytics.read",
    ],
    "DEVELOPER": [
        "dashboard.read", "user.read", "role.read", "team.read", "project.read",
        "task.read", "task.update", "bug.read", "bug.update",
        "timelog.read", "timelog.create", "report.read", "analytics.read",
    ],
    "TESTER": [
        "dashboard.read", "user.read", "role.read", "team.read", "project.read",
        "task.read", "bug.read", "bug.create", "bug.update",
        "timelog.read", "timelog.create", "report.read", "analytics.read",
    ],
    "VIEWER": [
        "dashboard.read", "user.read", "role.read", "team.read", "project.read", "task.read", "bug.read", "report.read",
    ],
}

# Live cache of role -> permissions (mutated by /roles endpoints)
ROLE_PERMISSIONS = dict(DEFAULT_ROLE_PERMISSIONS)
