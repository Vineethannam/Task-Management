"""Roles CRUD (with live permission cache updates)."""
from fastapi import APIRouter, Depends, HTTPException

from core.db import db
from core.config import ROLE_PERMISSIONS
from core.utils import serialize, now_iso
from core.permissions import perm_dep
from models.schemas import RoleUpdate

router = APIRouter(prefix="/roles", tags=["roles"])


@router.get("")
async def list_roles(user: dict = Depends(perm_dep("role.read"))):
    docs = await db.roles.find({}).sort("name", 1).to_list(200)
    return [serialize(d) for d in docs]


@router.get("/{role_name}")
async def get_role(role_name: str, user: dict = Depends(perm_dep("role.read"))):
    d = await db.roles.find_one({"name": role_name})
    if not d:
        raise HTTPException(status_code=404, detail="Role not found")
    return serialize(d)


@router.put("/{role_name}")
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
