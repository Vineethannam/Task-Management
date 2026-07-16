"""Projects CRUD."""
from typing import Optional, Dict, Any
from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException

from core.db import db
from core.utils import serialize, serialize_list, paginated, now_iso
from core.permissions import perm_dep
from services.notifications import create_notification
from models.schemas import ProjectCreate, ProjectUpdate

router = APIRouter(prefix="/projects", tags=["projects"])


@router.get("")
async def list_projects(
    page: int = 1, page_size: int = 10, q: Optional[str] = None,
    status: Optional[str] = None,
    user: dict = Depends(perm_dep("project.read")),
):
    filt: Dict[str, Any] = {}
    if q: filt["name"] = {"$regex": q, "$options": "i"}
    if status: filt["status"] = status
    return await paginated(db.projects, filt, "created_at", page, page_size)


@router.get("/all")
async def all_projects(user: dict = Depends(perm_dep("project.read"))):
    docs = await db.projects.find({}).sort("name", 1).to_list(500)
    return serialize_list(docs)


@router.post("")
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


@router.get("/{project_id}")
async def get_project(project_id: str, user: dict = Depends(perm_dep("project.read"))):
    p = await db.projects.find_one({"_id": ObjectId(project_id)})
    if not p:
        raise HTTPException(status_code=404, detail="Project not found")
    return serialize(p)


@router.put("/{project_id}")
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


@router.delete("/{project_id}")
async def delete_project(project_id: str, user: dict = Depends(perm_dep("project.delete"))):
    await db.projects.delete_one({"_id": ObjectId(project_id)})
    return {"ok": True}
