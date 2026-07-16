"""Meta endpoints: permission modules list."""
from fastapi import APIRouter
from core.config import PERMISSION_MODULES

router = APIRouter(prefix="/meta", tags=["meta"])


@router.get("/modules")
async def get_modules():
    return {"modules": PERMISSION_MODULES}
