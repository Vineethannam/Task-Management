"""Notifications endpoints."""
from bson import ObjectId
from fastapi import APIRouter, Depends

from core.db import db
from core.utils import paginated
from core.permissions import get_current_user

router = APIRouter(prefix="/notifications", tags=["notifications"])


@router.get("")
async def list_notifications(page: int = 1, page_size: int = 10, user: dict = Depends(get_current_user)):
    uid = str(user["_id"])
    return await paginated(db.notifications, {"user_id": uid}, "created_at", page, page_size)


@router.get("/unread-count")
async def unread_count(user: dict = Depends(get_current_user)):
    n = await db.notifications.count_documents({"user_id": str(user["_id"]), "read": False})
    return {"count": n}


@router.post("/{note_id}/read")
async def mark_read(note_id: str, user: dict = Depends(get_current_user)):
    await db.notifications.update_one({"_id": ObjectId(note_id), "user_id": str(user["_id"])}, {"$set": {"read": True}})
    return {"ok": True}


@router.post("/read-all")
async def mark_all_read(user: dict = Depends(get_current_user)):
    await db.notifications.update_many({"user_id": str(user["_id"])}, {"$set": {"read": True}})
    return {"ok": True}
