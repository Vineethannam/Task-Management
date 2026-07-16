"""Users CRUD."""
from typing import Optional, Dict, Any
from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException

from core.db import db
from core.config import ROLES
from core.security import hash_password
from core.utils import serialize, serialize_list, paginated, now_iso
from core.permissions import perm_dep
from models.schemas import UserCreate, UserUpdate

router = APIRouter(prefix="/users", tags=["users"])


@router.get("")
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


@router.get("/all")
async def all_users(user: dict = Depends(perm_dep("user.read"))):
    docs = await db.users.find({}).sort("name", 1).to_list(2000)
    return serialize_list(docs)


@router.post("")
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


@router.get("/{user_id}")
async def get_user(user_id: str, user: dict = Depends(perm_dep("user.read"))):
    u = await db.users.find_one({"_id": ObjectId(user_id)})
    if not u:
        raise HTTPException(status_code=404, detail="User not found")
    return serialize(u)


@router.put("/{user_id}")
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


@router.delete("/{user_id}")
async def delete_user(user_id: str, user: dict = Depends(perm_dep("user.delete"))):
    await db.users.delete_one({"_id": ObjectId(user_id)})
    return {"ok": True}
