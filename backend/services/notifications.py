"""Notification helpers — persists to MongoDB and pushes over WebSocket."""
from core.db import db
from core.utils import serialize, now_iso
from services.ws_manager import manager


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
