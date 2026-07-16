"""Serialization + pagination helpers."""
from datetime import datetime, timezone
from typing import List, Optional
from bson import ObjectId


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
