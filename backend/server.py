from dotenv import load_dotenv
from pathlib import Path

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

import os
import logging
import json
from datetime import datetime, timezone, timedelta
from typing import List, Optional, Dict, Any

import bcrypt
import jwt
from bson import ObjectId
from fastapi import FastAPI, APIRouter, HTTPException, Depends, Request, Response, WebSocket, WebSocketDisconnect, Query
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field, EmailStr

# ---------------- Constants ----------------
JWT_ALGORITHM = "HS256"
ACCESS_TOKEN_MINUTES = 60 * 24
REFRESH_TOKEN_DAYS = 7

ROLES = ["SUPER_ADMIN", "ADMIN", "PROJECT_MANAGER", "TEAM_LEAD", "DEVELOPER", "TESTER", "VIEWER"]

# Modules exposed in permission matrix
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

DEFAULT_ROLE_PERMISSIONS: Dict[str, List[str]] = {
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

# In-memory role permissions cache (loaded from DB on startup)
ROLE_PERMISSIONS: Dict[str, List[str]] = dict(DEFAULT_ROLE_PERMISSIONS)

# ---------------- MongoDB ----------------
mongo_url = os.environ["MONGO_URL"]
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ["DB_NAME"]]

# ---------------- Helpers ----------------

def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")

def verify_password(plain: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))
    except Exception:
        return False

def get_jwt_secret() -> str:
    return os.environ["JWT_SECRET"]

def create_access_token(user_id: str, email: str, role: str) -> str:
    payload = {
        "sub": user_id, "email": email, "role": role,
        "exp": datetime.now(timezone.utc) + timedelta(minutes=ACCESS_TOKEN_MINUTES),
        "type": "access",
    }
    return jwt.encode(payload, get_jwt_secret(), algorithm=JWT_ALGORITHM)

def create_refresh_token(user_id: str) -> str:
    payload = {
        "sub": user_id,
        "exp": datetime.now(timezone.utc) + timedelta(days=REFRESH_TOKEN_DAYS),
        "type": "refresh",
    }
    return jwt.encode(payload, get_jwt_secret(), algorithm=JWT_ALGORITHM)

def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()

def serialize(doc: Optional[dict]) -> Optional[dict]:
    if doc is None:
        return None
    out = {}
    for k, v in doc.items():
        if k == "_id":
            out["id"] = str(v)
            continue
        if k == "password_hash":
            continue
        if isinstance(v, ObjectId):
            out[k] = str(v)
        elif isinstance(v, list):
            out[k] = [str(x) if isinstance(x, ObjectId) else x for x in v]
        elif isinstance(v, datetime):
            out[k] = v.isoformat()
        else:
            out[k] = v
    return out

def serialize_list(docs: List[dict]) -> List[dict]:
    return [serialize(d) for d in docs]

def has_permission(user_role: str, perm: str) -> bool:
    perms = ROLE_PERMISSIONS.get(user_role, [])
    if "*" in perms:
        return True
    return perm in perms

async def paginated(collection, filter_q: dict, sort_field: str, page: int, page_size: int, sort_dir: int = -1):
    page = max(page, 1)
    page_size = min(max(page_size, 1), 200)
    total = await collection.count_documents(filter_q)
    cursor = collection.find(filter_q).sort(sort_field, sort_dir).skip((page - 1) * page_size).limit(page_size)
    items = await cursor.to_list(page_size)
    return {
        "items": serialize_list(items),
        "total": total,
        "page": page,
        "page_size": page_size,
        "total_pages": (total + page_size - 1) // page_size if total else 0,
    }

# ---------------- Auth ----------------

async def get_current_user(request: Request) -> dict:
    token = request.cookies.get("access_token")
    if not token:
        auth = request.headers.get("Authorization", "")
        if auth.startswith("Bearer "):
            token = auth[7:]
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    try:
        payload = jwt.decode(token, get_jwt_secret(), algorithms=[JWT_ALGORITHM])
        if payload.get("type") != "access":
            raise HTTPException(status_code=401, detail="Invalid token type")
        user = await db.users.find_one({"_id": ObjectId(payload["sub"])})
        if not user:
            raise HTTPException(status_code=401, detail="User not found")
        if not user.get("active", True):
            raise HTTPException(status_code=403, detail="User disabled")
        return user
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")

def perm_dep(perm: str):
    async def dep(user: dict = Depends(get_current_user)) -> dict:
        if not has_permission(user.get("role", "VIEWER"), perm):
            raise HTTPException(status_code=403, detail=f"Missing permission: {perm}")
        return user
    return dep

# ---------------- WebSocket ----------------

class WSManager:
    def __init__(self):
        self.connections: Dict[str, List[WebSocket]] = {}

    async def connect(self, user_id: str, ws: WebSocket):
        await ws.accept()
        self.connections.setdefault(user_id, []).append(ws)

    def disconnect(self, user_id: str, ws: WebSocket):
        if user_id in self.connections:
            try:
                self.connections[user_id].remove(ws)
            except ValueError:
                pass
            if not self.connections[user_id]:
                self.connections.pop(user_id, None)

    async def send_to_user(self, user_id: str, message: dict):
        for ws in list(self.connections.get(user_id, [])):
            try:
                await ws.send_json(message)
            except Exception:
                self.disconnect(user_id, ws)

manager = WSManager()

async def create_notification(user_id: str, event_type: str, title: str, payload: dict):
    doc = {
        "user_id": user_id, "event_type": event_type,
        "title": title, "payload": payload, "read": False,
        "created_at": now_iso(),
    }
    r = await db.notifications.insert_one(doc)
    doc["_id"] = r.inserted_id
    ser = serialize(doc)
    await manager.send_to_user(user_id, {"type": event_type, "notification": ser})
    return ser

# ---------------- Schemas ----------------

class LoginIn(BaseModel):
    email: EmailStr
    password: str

class UserCreate(BaseModel):
    name: str; email: EmailStr; password: str; role: str
    skills: List[str] = []

class UserUpdate(BaseModel):
    name: Optional[str] = None
    role: Optional[str] = None
    active: Optional[bool] = None
    skills: Optional[List[str]] = None
    password: Optional[str] = None

class TeamCreate(BaseModel):
    name: str
    description: Optional[str] = ""
    lead_id: Optional[str] = None
    member_ids: List[str] = []
    skills: List[str] = []

class TeamUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    lead_id: Optional[str] = None
    member_ids: Optional[List[str]] = None
    skills: Optional[List[str]] = None

class ProjectCreate(BaseModel):
    name: str
    description: Optional[str] = ""
    team_lead_id: Optional[str] = None
    team_ids: List[str] = []
    member_ids: List[str] = []
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    status: Optional[str] = "active"

class ProjectUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    team_lead_id: Optional[str] = None
    team_ids: Optional[List[str]] = None
    member_ids: Optional[List[str]] = None
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    status: Optional[str] = None

class TaskCreate(BaseModel):
    title: str
    description: Optional[str] = ""
    project_id: str
    assignee_id: Optional[str] = None
    team_id: Optional[str] = None
    priority: str = "MEDIUM"
    status: str = "BACKLOG"
    estimated_hours: Optional[float] = None
    due_date: Optional[str] = None

class TaskUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    assignee_id: Optional[str] = None
    team_id: Optional[str] = None
    priority: Optional[str] = None
    status: Optional[str] = None
    estimated_hours: Optional[float] = None
    due_date: Optional[str] = None

class TaskComment(BaseModel):
    content: str

class BugCreate(BaseModel):
    title: str
    description: Optional[str] = ""
    project_id: str
    task_id: Optional[str] = None
    assignee_id: Optional[str] = None
    severity: str = "MEDIUM"
    status: str = "OPEN"
    estimated_hours: Optional[float] = None

class BugUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    task_id: Optional[str] = None
    assignee_id: Optional[str] = None
    severity: Optional[str] = None
    status: Optional[str] = None
    estimated_hours: Optional[float] = None

class TimeLogCreate(BaseModel):
    task_id: str
    event_type: str
    progress: Optional[float] = None
    minutes: Optional[float] = None
    note: Optional[str] = ""

class RoleUpdate(BaseModel):
    permissions: List[str]
    description: Optional[str] = None

class RoleCreate(BaseModel):
    name: str
    description: Optional[str] = ""
    permissions: List[str] = []

# ---------------- App ----------------

app = FastAPI(title="SEMS API")
api = APIRouter(prefix="/api")

# ---------------- Auth Endpoints ----------------

@api.post("/auth/login")
async def login(body: LoginIn, response: Response):
    user = await db.users.find_one({"email": body.email.lower()})
    if not user or not verify_password(body.password, user.get("password_hash", "")):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    if not user.get("active", True):
        raise HTTPException(status_code=403, detail="Account disabled")
    uid = str(user["_id"])
    access = create_access_token(uid, user["email"], user["role"])
    refresh = create_refresh_token(uid)
    response.set_cookie("access_token", access, httponly=True, secure=False, samesite="lax", max_age=ACCESS_TOKEN_MINUTES * 60, path="/")
    response.set_cookie("refresh_token", refresh, httponly=True, secure=False, samesite="lax", max_age=REFRESH_TOKEN_DAYS * 86400, path="/")
    return {"user": serialize(user), "access_token": access}

@api.post("/auth/logout")
async def logout(response: Response, _user: dict = Depends(get_current_user)):
    response.delete_cookie("access_token", path="/")
    response.delete_cookie("refresh_token", path="/")
    return {"ok": True}

@api.get("/auth/me")
async def me(user: dict = Depends(get_current_user)):
    u = serialize(user)
    u["permissions"] = ROLE_PERMISSIONS.get(u["role"], [])
    return u

@api.post("/auth/refresh")
async def refresh_token(request: Request, response: Response):
    rt = request.cookies.get("refresh_token")
    if not rt:
        raise HTTPException(status_code=401, detail="No refresh token")
    try:
        payload = jwt.decode(rt, get_jwt_secret(), algorithms=[JWT_ALGORITHM])
        if payload.get("type") != "refresh":
            raise HTTPException(status_code=401, detail="Invalid token type")
        user = await db.users.find_one({"_id": ObjectId(payload["sub"])})
        if not user:
            raise HTTPException(status_code=401, detail="User not found")
        access = create_access_token(str(user["_id"]), user["email"], user["role"])
        response.set_cookie("access_token", access, httponly=True, secure=False, samesite="lax", max_age=ACCESS_TOKEN_MINUTES * 60, path="/")
        return {"ok": True}
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid refresh token")

# ---------------- Meta / Roles ----------------

@api.get("/meta/modules")
async def get_modules():
    return {"modules": PERMISSION_MODULES}

@api.get("/roles")
async def list_roles(user: dict = Depends(perm_dep("role.read"))):
    docs = await db.roles.find({}).sort("name", 1).to_list(200)
    return [{**serialize(d)} for d in docs]

@api.get("/roles/{role_name}")
async def get_role(role_name: str, user: dict = Depends(perm_dep("role.read"))):
    d = await db.roles.find_one({"name": role_name})
    if not d:
        raise HTTPException(status_code=404, detail="Role not found")
    return serialize(d)

@api.put("/roles/{role_name}")
async def update_role(role_name: str, body: RoleUpdate, user: dict = Depends(perm_dep("role.update"))):
    if role_name == "SUPER_ADMIN" and user.get("role") != "SUPER_ADMIN":
        raise HTTPException(status_code=403, detail="Only SUPER_ADMIN can edit itself")
    d = await db.roles.find_one({"name": role_name})
    if not d:
        raise HTTPException(status_code=404, detail="Role not found")
    updates = {"permissions": body.permissions}
    if body.description is not None:
        updates["description"] = body.description
    updates["updated_at"] = now_iso()
    await db.roles.update_one({"name": role_name}, {"$set": updates})
    ROLE_PERMISSIONS[role_name] = body.permissions
    d = await db.roles.find_one({"name": role_name})
    return serialize(d)

# ---------------- Users ----------------

@api.get("/users")
async def list_users(
    page: int = 1, page_size: int = 10, q: Optional[str] = None,
    role: Optional[str] = None, active: Optional[bool] = None,
    user: dict = Depends(perm_dep("user.read")),
):
    filt: Dict[str, Any] = {}
    if q:
        filt["$or"] = [
            {"name": {"$regex": q, "$options": "i"}},
            {"email": {"$regex": q, "$options": "i"}},
        ]
    if role: filt["role"] = role
    if active is not None: filt["active"] = active
    return await paginated(db.users, filt, "created_at", page, page_size)

@api.get("/users/all")
async def all_users(user: dict = Depends(perm_dep("user.read"))):
    docs = await db.users.find({}).sort("name", 1).to_list(2000)
    return serialize_list(docs)

@api.post("/users")
async def create_user(body: UserCreate, user: dict = Depends(perm_dep("user.create"))):
    if body.role not in ROLES:
        raise HTTPException(status_code=400, detail="Invalid role")
    email = body.email.lower()
    if await db.users.find_one({"email": email}):
        raise HTTPException(status_code=400, detail="Email already exists")
    doc = {
        "name": body.name, "email": email,
        "password_hash": hash_password(body.password),
        "role": body.role, "skills": body.skills,
        "active": True, "avatar": None, "created_at": now_iso(),
    }
    res = await db.users.insert_one(doc)
    doc["_id"] = res.inserted_id
    return serialize(doc)

@api.get("/users/{user_id}")
async def get_user(user_id: str, user: dict = Depends(perm_dep("user.read"))):
    u = await db.users.find_one({"_id": ObjectId(user_id)})
    if not u:
        raise HTTPException(status_code=404, detail="User not found")
    return serialize(u)

@api.put("/users/{user_id}")
async def update_user(user_id: str, body: UserUpdate, user: dict = Depends(perm_dep("user.update"))):
    updates = {k: v for k, v in body.model_dump(exclude_none=True).items()}
    if "password" in updates:
        updates["password_hash"] = hash_password(updates.pop("password"))
    if "role" in updates and updates["role"] not in ROLES:
        raise HTTPException(status_code=400, detail="Invalid role")
    if updates:
        await db.users.update_one({"_id": ObjectId(user_id)}, {"$set": updates})
    u = await db.users.find_one({"_id": ObjectId(user_id)})
    return serialize(u)

@api.delete("/users/{user_id}")
async def delete_user(user_id: str, user: dict = Depends(perm_dep("user.delete"))):
    await db.users.delete_one({"_id": ObjectId(user_id)})
    return {"ok": True}

# ---------------- My Work ----------------

@api.get("/me/tasks")
async def my_tasks(
    page: int = 1, page_size: int = 10, status: Optional[str] = None,
    user: dict = Depends(get_current_user),
):
    filt: Dict[str, Any] = {"assignee_id": str(user["_id"])}
    if status: filt["status"] = status
    return await paginated(db.tasks, filt, "updated_at", page, page_size)

@api.get("/me/projects")
async def my_projects(page: int = 1, page_size: int = 20, user: dict = Depends(get_current_user)):
    uid = str(user["_id"])
    filt = {"$or": [{"member_ids": uid}, {"team_lead_id": uid}]}
    return await paginated(db.projects, filt, "created_at", page, page_size)

@api.get("/me/bugs")
async def my_bugs(page: int = 1, page_size: int = 10, user: dict = Depends(get_current_user)):
    filt = {"assignee_id": str(user["_id"])}
    return await paginated(db.bugs, filt, "updated_at", page, page_size)

# ---------------- Teams ----------------

@api.get("/teams")
async def list_teams(
    page: int = 1, page_size: int = 10, q: Optional[str] = None,
    user: dict = Depends(perm_dep("team.read")),
):
    filt: Dict[str, Any] = {}
    if q: filt["name"] = {"$regex": q, "$options": "i"}
    return await paginated(db.teams, filt, "created_at", page, page_size)

@api.get("/teams/all")
async def all_teams(user: dict = Depends(perm_dep("team.read"))):
    docs = await db.teams.find({}).sort("name", 1).to_list(500)
    return serialize_list(docs)

@api.post("/teams")
async def create_team(body: TeamCreate, user: dict = Depends(perm_dep("team.create"))):
    doc = {
        "name": body.name, "description": body.description or "",
        "lead_id": body.lead_id,
        "member_ids": list(set(body.member_ids)),
        "skills": body.skills, "created_at": now_iso(),
    }
    r = await db.teams.insert_one(doc)
    doc["_id"] = r.inserted_id
    for uid in doc["member_ids"]:
        await create_notification(uid, "USER_ADDED_TO_TEAM", f"You were added to team {body.name}", {"team_id": str(r.inserted_id)})
    return serialize(doc)

@api.get("/teams/{team_id}")
async def get_team(team_id: str, user: dict = Depends(perm_dep("team.read"))):
    t = await db.teams.find_one({"_id": ObjectId(team_id)})
    if not t:
        raise HTTPException(status_code=404, detail="Team not found")
    return serialize(t)

@api.put("/teams/{team_id}")
async def update_team(team_id: str, body: TeamUpdate, user: dict = Depends(perm_dep("team.update"))):
    existing = await db.teams.find_one({"_id": ObjectId(team_id)})
    if not existing:
        raise HTTPException(status_code=404, detail="Team not found")
    updates = body.model_dump(exclude_none=True)
    if updates:
        await db.teams.update_one({"_id": ObjectId(team_id)}, {"$set": updates})
    if "member_ids" in updates:
        new_members = set(updates["member_ids"]) - set(existing.get("member_ids", []))
        for uid in new_members:
            await create_notification(uid, "USER_ADDED_TO_TEAM", f"You were added to team {existing['name']}", {"team_id": team_id})
    t = await db.teams.find_one({"_id": ObjectId(team_id)})
    return serialize(t)

@api.delete("/teams/{team_id}")
async def delete_team(team_id: str, user: dict = Depends(perm_dep("team.delete"))):
    await db.teams.delete_one({"_id": ObjectId(team_id)})
    return {"ok": True}

# ---------------- Projects ----------------

@api.get("/projects")
async def list_projects(
    page: int = 1, page_size: int = 10, q: Optional[str] = None,
    status: Optional[str] = None,
    user: dict = Depends(perm_dep("project.read")),
):
    filt: Dict[str, Any] = {}
    if q: filt["name"] = {"$regex": q, "$options": "i"}
    if status: filt["status"] = status
    return await paginated(db.projects, filt, "created_at", page, page_size)

@api.get("/projects/all")
async def all_projects(user: dict = Depends(perm_dep("project.read"))):
    docs = await db.projects.find({}).sort("name", 1).to_list(500)
    return serialize_list(docs)

@api.post("/projects")
async def create_project(body: ProjectCreate, user: dict = Depends(perm_dep("project.create"))):
    doc = {
        "name": body.name, "description": body.description or "",
        "team_lead_id": body.team_lead_id,
        "team_ids": body.team_ids, "member_ids": list(set(body.member_ids)),
        "start_date": body.start_date, "end_date": body.end_date,
        "status": body.status or "active",
        "created_by": str(user["_id"]), "created_at": now_iso(),
    }
    r = await db.projects.insert_one(doc)
    doc["_id"] = r.inserted_id
    for uid in doc["member_ids"]:
        await create_notification(uid, "USER_ADDED_TO_PROJECT", f"You were added to project {body.name}", {"project_id": str(r.inserted_id)})
    return serialize(doc)

@api.get("/projects/{project_id}")
async def get_project(project_id: str, user: dict = Depends(perm_dep("project.read"))):
    p = await db.projects.find_one({"_id": ObjectId(project_id)})
    if not p:
        raise HTTPException(status_code=404, detail="Project not found")
    return serialize(p)

@api.put("/projects/{project_id}")
async def update_project(project_id: str, body: ProjectUpdate, user: dict = Depends(perm_dep("project.update"))):
    existing = await db.projects.find_one({"_id": ObjectId(project_id)})
    if not existing:
        raise HTTPException(status_code=404, detail="Project not found")
    updates = body.model_dump(exclude_none=True)
    if updates:
        await db.projects.update_one({"_id": ObjectId(project_id)}, {"$set": updates})
    if "member_ids" in updates:
        new_members = set(updates["member_ids"]) - set(existing.get("member_ids", []))
        for uid in new_members:
            await create_notification(uid, "USER_ADDED_TO_PROJECT", f"You were added to project {existing['name']}", {"project_id": project_id})
    p = await db.projects.find_one({"_id": ObjectId(project_id)})
    return serialize(p)

@api.delete("/projects/{project_id}")
async def delete_project(project_id: str, user: dict = Depends(perm_dep("project.delete"))):
    await db.projects.delete_one({"_id": ObjectId(project_id)})
    return {"ok": True}

# ---------------- Tasks ----------------

TASK_STATUSES = ["BACKLOG", "IN_PROGRESS", "IN_REVIEW", "COMPLETED", "REASSIGNED"]
TASK_PRIORITIES = ["LOW", "MEDIUM", "HIGH", "URGENT"]

async def _log_task_activity(task_id: str, user_id: str, event: str, details: dict = None):
    await db.task_activity.insert_one({
        "task_id": task_id, "user_id": user_id, "event": event,
        "details": details or {}, "created_at": now_iso(),
    })

@api.get("/tasks")
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

@api.get("/tasks/by-project/{project_id}")
async def tasks_by_project(project_id: str, user: dict = Depends(perm_dep("task.read"))):
    docs = await db.tasks.find({"project_id": project_id}).sort("created_at", -1).to_list(2000)
    return serialize_list(docs)

@api.post("/tasks")
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
        "deadline_changes": 0, "reassign_count": 0,
        "created_by": str(user["_id"]),
        "created_at": now_iso(), "updated_at": now_iso(),
    }
    r = await db.tasks.insert_one(doc)
    doc["_id"] = r.inserted_id
    await _log_task_activity(str(r.inserted_id), str(user["_id"]), "CREATED", {"title": body.title, "assignee_id": body.assignee_id, "due_date": body.due_date})
    if body.assignee_id:
        await create_notification(body.assignee_id, "TASK_ASSIGNED", f"Task assigned: {body.title}", {"task_id": str(r.inserted_id), "project_id": body.project_id})
    return serialize(doc)

@api.get("/tasks/{task_id}")
async def get_task(task_id: str, user: dict = Depends(perm_dep("task.read"))):
    t = await db.tasks.find_one({"_id": ObjectId(task_id)})
    if not t:
        raise HTTPException(status_code=404, detail="Task not found")
    return serialize(t)

@api.put("/tasks/{task_id}")
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

    # Track deadline changes
    inc = {}
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

@api.delete("/tasks/{task_id}")
async def delete_task(task_id: str, user: dict = Depends(perm_dep("task.delete"))):
    await db.tasks.delete_one({"_id": ObjectId(task_id)})
    await db.task_activity.delete_many({"task_id": task_id})
    await db.task_comments.delete_many({"task_id": task_id})
    return {"ok": True}

@api.get("/tasks/{task_id}/activity")
async def task_activity(task_id: str, user: dict = Depends(perm_dep("task.read"))):
    acts = await db.task_activity.find({"task_id": task_id}).sort("created_at", -1).to_list(500)
    return serialize_list(acts)

@api.get("/tasks/{task_id}/comments")
async def get_comments(task_id: str, user: dict = Depends(perm_dep("task.read"))):
    comments = await db.task_comments.find({"task_id": task_id}).sort("created_at", 1).to_list(500)
    return serialize_list(comments)

@api.post("/tasks/{task_id}/comments")
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

# ---------------- Time Logs ----------------

@api.post("/timelogs")
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

@api.get("/timelogs")
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

# ---------------- Bugs ----------------

BUG_STATUSES = ["OPEN", "IN_PROGRESS", "IN_REVIEW", "RESOLVED", "REOPENED", "CLOSED"]
BUG_SEVERITIES = ["LOW", "MEDIUM", "HIGH", "CRITICAL"]

async def _log_bug_activity(bug_id: str, user_id: str, event: str, details: dict = None):
    await db.bug_activity.insert_one({
        "bug_id": bug_id, "user_id": user_id, "event": event,
        "details": details or {}, "created_at": now_iso(),
    })

@api.get("/bugs")
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

@api.post("/bugs")
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

@api.get("/bugs/{bug_id}")
async def get_bug(bug_id: str, user: dict = Depends(perm_dep("bug.read"))):
    b = await db.bugs.find_one({"_id": ObjectId(bug_id)})
    if not b:
        raise HTTPException(status_code=404, detail="Bug not found")
    return serialize(b)

@api.put("/bugs/{bug_id}")
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

@api.delete("/bugs/{bug_id}")
async def delete_bug(bug_id: str, user: dict = Depends(perm_dep("bug.delete"))):
    await db.bugs.delete_one({"_id": ObjectId(bug_id)})
    await db.bug_activity.delete_many({"bug_id": bug_id})
    return {"ok": True}

@api.get("/bugs/{bug_id}/activity")
async def bug_activity(bug_id: str, user: dict = Depends(perm_dep("bug.read"))):
    acts = await db.bug_activity.find({"bug_id": bug_id}).sort("created_at", -1).to_list(500)
    return serialize_list(acts)

# ---------------- Notifications ----------------

@api.get("/notifications")
async def list_notifications(page: int = 1, page_size: int = 10, user: dict = Depends(get_current_user)):
    uid = str(user["_id"])
    return await paginated(db.notifications, {"user_id": uid}, "created_at", page, page_size)

@api.get("/notifications/unread-count")
async def unread_count(user: dict = Depends(get_current_user)):
    n = await db.notifications.count_documents({"user_id": str(user["_id"]), "read": False})
    return {"count": n}

@api.post("/notifications/{note_id}/read")
async def mark_read(note_id: str, user: dict = Depends(get_current_user)):
    await db.notifications.update_one({"_id": ObjectId(note_id), "user_id": str(user["_id"])}, {"$set": {"read": True}})
    return {"ok": True}

@api.post("/notifications/read-all")
async def mark_all_read(user: dict = Depends(get_current_user)):
    await db.notifications.update_many({"user_id": str(user["_id"])}, {"$set": {"read": True}})
    return {"ok": True}

# ---------------- Reports (backwards compat) ----------------

@api.get("/reports/dashboard")
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

@api.get("/reports/tasks-global")
async def tasks_global(user: dict = Depends(perm_dep("report.read"))):
    return {s: await db.tasks.count_documents({"status": s}) for s in TASK_STATUSES}

@api.get("/reports/user/{user_id}")
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

@api.get("/reports/team/{team_id}")
async def team_report(team_id: str, user: dict = Depends(perm_dep("report.read"))):
    team = await db.teams.find_one({"_id": ObjectId(team_id)})
    if not team:
        raise HTTPException(status_code=404, detail="Team not found")
    tasks = await db.tasks.find({"team_id": team_id}).to_list(2000)
    by_status = {s: 0 for s in TASK_STATUSES}
    for t in tasks:
        by_status[t.get("status", "BACKLOG")] += 1
    return {"team": serialize(team), "tasks_by_status": by_status, "total_tasks": len(tasks)}

@api.get("/reports/project/{project_id}")
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

# ---------------- Analytics (new) ----------------

def _iso_day(dt: datetime) -> str:
    return dt.strftime("%Y-%m-%d")

@api.get("/analytics/bugs/timeline")
async def bug_timeline(days: int = 30, user: dict = Depends(perm_dep("analytics.read"))):
    days = min(max(days, 7), 180)
    now = datetime.now(timezone.utc)
    start = now - timedelta(days=days - 1)
    start_iso = start.replace(hour=0, minute=0, second=0, microsecond=0).isoformat()
    created = await db.bugs.find({"created_at": {"$gte": start_iso}}).to_list(5000)
    resolved = await db.bugs.find({"resolved_at": {"$gte": start_iso}}).to_list(5000)
    # Bucket per day
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

@api.get("/analytics/bugs/summary")
async def bug_summary(user: dict = Depends(perm_dep("analytics.read"))):
    total = await db.bugs.count_documents({})
    open_ = await db.bugs.count_documents({"status": {"$in": ["OPEN", "IN_PROGRESS", "IN_REVIEW", "REOPENED"]}})
    resolved = await db.bugs.count_documents({"status": {"$in": ["RESOLVED", "CLOSED"]}})
    reopened = await db.bugs.count_documents({"status": "REOPENED"})
    critical = await db.bugs.count_documents({"severity": "CRITICAL"})
    # total reopens across bugs
    pipeline = [{"$group": {"_id": None, "sum": {"$sum": "$reopen_count"}}}]
    total_reopens = 0
    async for row in db.bugs.aggregate(pipeline):
        total_reopens = row.get("sum") or 0
    return {"total": total, "open": open_, "resolved": resolved, "reopened_now": reopened, "critical": critical, "total_reopens": total_reopens}

@api.get("/analytics/bugs/top")
async def bug_top(dimension: str = "user", limit: int = 10, user: dict = Depends(perm_dep("analytics.read"))):
    limit = min(max(limit, 1), 50)
    field_map = {"user": "assignee_id", "project": "project_id", "team": "task_id"}
    if dimension not in ("user", "project", "team"):
        raise HTTPException(status_code=400, detail="dimension must be user, project or team")

    if dimension == "team":
        # Bugs don't directly reference team. Aggregate via linked task's team.
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

@api.get("/analytics/delays")
async def delay_analytics(user: dict = Depends(perm_dep("analytics.read"))):
    """Users/teams causing delays: sum of deadline_changes and reassigns for tasks."""
    # Top users by deadline changes on tasks assigned to them
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

# ---------------- WebSocket ----------------

@app.websocket("/api/ws")
async def websocket_endpoint(websocket: WebSocket, token: str = Query(...)):
    try:
        payload = jwt.decode(token, get_jwt_secret(), algorithms=[JWT_ALGORITHM])
        if payload.get("type") != "access":
            await websocket.close(code=4001)
            return
        user_id = payload["sub"]
    except jwt.InvalidTokenError:
        await websocket.close(code=4001)
        return
    await manager.connect(user_id, websocket)
    try:
        while True:
            data = await websocket.receive_text()
            try:
                msg = json.loads(data)
                if msg.get("type") == "ping":
                    await websocket.send_json({"type": "pong"})
            except Exception:
                pass
    except WebSocketDisconnect:
        manager.disconnect(user_id, websocket)
    except Exception:
        manager.disconnect(user_id, websocket)

# ---------------- Seeding ----------------

async def seed_roles():
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
    await db.users.create_index("email", unique=True)
    await db.roles.create_index("name", unique=True)
    await db.tasks.create_index([("project_id", 1)])
    await db.bugs.create_index([("project_id", 1)])
    await db.notifications.create_index([("user_id", 1), ("created_at", -1)])
    await db.timelogs.create_index([("task_id", 1)])
    await db.task_activity.create_index([("task_id", 1)])
    await db.bug_activity.create_index([("bug_id", 1)])

    await seed_roles()

    admin_email = os.environ.get("ADMIN_EMAIL", "admin@sems.io").lower()
    admin_password = os.environ.get("ADMIN_PASSWORD", "Admin@123")
    existing = await db.users.find_one({"email": admin_email})
    if existing is None:
        await db.users.insert_one({
            "name": "Super Admin", "email": admin_email,
            "password_hash": hash_password(admin_password),
            "role": "SUPER_ADMIN", "skills": ["Management"],
            "active": True, "avatar": None, "created_at": now_iso(),
        })
        logger.info(f"Seeded super admin: {admin_email}")
    else:
        if not verify_password(admin_password, existing["password_hash"]):
            await db.users.update_one({"email": admin_email}, {"$set": {"password_hash": hash_password(admin_password)}})

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
    user_ids: Dict[str, str] = {}
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
    team_ids: Dict[str, str] = {}
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
    project_ids: Dict[str, str] = {}
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

# ---------------- Wire up ----------------

app.include_router(api)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=[os.environ.get("FRONTEND_URL", "http://localhost:3000"), "http://localhost:3000"],
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"],
)

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")
logger = logging.getLogger("sems")

@app.on_event("startup")
async def startup_event():
    try:
        await seed_data()
    except Exception as e:
        logger.error(f"Seed error: {e}")

@app.on_event("shutdown")
async def shutdown_event():
    client.close()

@api.get("/health")
async def health():
    return {"ok": True, "service": "SEMS", "time": now_iso()}
