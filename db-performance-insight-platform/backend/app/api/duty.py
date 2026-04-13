from datetime import datetime, time
from typing import Any, Dict, List

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.database import DutyShift

router = APIRouter(prefix="/api/duty", tags=["duty"])


class DutyShiftCreate(BaseModel):
    user_id: int = Field(..., ge=1)
    role: str = Field(default="assistant", max_length=50)
    start_time: str = Field(..., description="HH:MM")
    end_time: str = Field(..., description="HH:MM")
    is_active: bool = True


def _parse_hhmm(v: str) -> time:
    try:
        h, m = v.split(":")
        return time(hour=int(h), minute=int(m))
    except Exception as exc:
        raise HTTPException(status_code=400, detail="时间格式应为HH:MM") from exc


@router.get("/shifts")
async def list_shifts(db: AsyncSession = Depends(get_db)) -> Dict[str, Any]:
    result = await db.execute(select(DutyShift).order_by(DutyShift.start_time.asc(), DutyShift.user_id.asc()))
    rows = result.scalars().all()
    items: List[Dict[str, Any]] = []
    for r in rows:
        items.append(
            {
                "id": r.id,
                "user_id": r.user_id,
                "role": r.role,
                "start_time": r.start_time.strftime("%H:%M") if r.start_time else None,
                "end_time": r.end_time.strftime("%H:%M") if r.end_time else None,
                "is_active": r.is_active,
                "created_at": r.created_at.isoformat() if r.created_at else None,
            }
        )
    return {"items": items, "count": len(items)}


@router.post("/shifts")
async def create_shift(payload: DutyShiftCreate, db: AsyncSession = Depends(get_db)) -> Dict[str, Any]:
    shift = DutyShift(
        user_id=payload.user_id,
        role=payload.role,
        start_time=_parse_hhmm(payload.start_time),
        end_time=_parse_hhmm(payload.end_time),
        is_active=payload.is_active,
        created_at=datetime.utcnow(),
    )
    db.add(shift)
    await db.commit()
    await db.refresh(shift)
    return {
        "shift": {
            "id": shift.id,
            "user_id": shift.user_id,
            "role": shift.role,
            "start_time": shift.start_time.strftime("%H:%M"),
            "end_time": shift.end_time.strftime("%H:%M"),
            "is_active": shift.is_active,
        }
    }


@router.delete("/shifts/{shift_id}")
async def delete_shift(shift_id: int, db: AsyncSession = Depends(get_db)) -> Dict[str, Any]:
    result = await db.execute(select(DutyShift).where(DutyShift.id == shift_id))
    shift = result.scalar_one_or_none()
    if not shift:
        raise HTTPException(status_code=404, detail="值班记录不存在")
    await db.delete(shift)
    await db.commit()
    return {"ok": True}
