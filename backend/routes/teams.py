"""Teams CRUD."""
from typing import Optional, Dict, Any
from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException

from core.db import db
from core.utils import serialize, serialize_list, paginated, now_iso
from core.permissions import perm_dep
from services.notifications import create_notification
from models.schemas import TeamCreate, TeamUpdate

router = APIRouter(prefix="/teams", tags=["teams"])


@router.get("")
async def list_teams(
    page: int = 1, page_size: int = 10, q: Optional[str] = None,
    user: dict = Depends(perm_dep("team.read")),
):
    filt: Dict[str, Any] = {}
    if q: filt["name"] = {"$regex": q, "$options": "i"}
    return await paginated(db.teams, filt, "created_at", page, page_size)


@router.get("/all")
async def all_teams(user: dict = Depends(perm_dep("team.read"))):
    docs = await db.teams.find({}).sort("name", 1).to_list(500)
    return serialize_list(docs)


@router.post("")
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


@router.get("/{team_id}")
async def get_team(team_id: str, user: dict = Depends(perm_dep("team.read"))):
    t = await db.teams.find_one({"_id": ObjectId(team_id)})
    if not t:
        raise HTTPException(status_code=404, detail="Team not found")
    return serialize(t)


@router.put("/{team_id}")
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


@router.delete("/{team_id}")
async def delete_team(team_id: str, user: dict = Depends(perm_dep("team.delete"))):
    await db.teams.delete_one({"_id": ObjectId(team_id)})
    return {"ok": True}
