"""Pydantic request schemas."""
from typing import List, Optional
from pydantic import BaseModel, EmailStr


class LoginIn(BaseModel):
    email: EmailStr
    password: str


class UserCreate(BaseModel):
    name: str
    email: EmailStr
    password: str
    role: str
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
    parent_id: Optional[str] = None


class TaskUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    assignee_id: Optional[str] = None
    team_id: Optional[str] = None
    priority: Optional[str] = None
    status: Optional[str] = None
    estimated_hours: Optional[float] = None
    due_date: Optional[str] = None
    parent_id: Optional[str] = None


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


class TimerAction(BaseModel):
    note: Optional[str] = ""
