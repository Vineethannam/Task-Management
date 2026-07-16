"""Authentication & RBAC dependencies."""
from bson import ObjectId
from fastapi import Depends, HTTPException, Request
import jwt

from core.config import ROLE_PERMISSIONS
from core.security import decode_token
from core.db import db


def has_permission(user_role: str, perm: str) -> bool:
    perms = ROLE_PERMISSIONS.get(user_role, [])
    if "*" in perms:
        return True
    return perm in perms


async def get_current_user(request: Request) -> dict:
    token = request.cookies.get("access_token")
    if not token:
        auth = request.headers.get("Authorization", "")
        if auth.startswith("Bearer "):
            token = auth[7:]
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    try:
        payload = decode_token(token)
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
