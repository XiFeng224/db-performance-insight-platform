from datetime import datetime, timedelta
from typing import Any, Dict, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import and_, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.database import DutyShift, OptimizationSuggestion, Ticket, TicketEvent, TicketRating

router = APIRouter(prefix="/api/tickets", tags=["tickets"])


class TicketCreate(BaseModel):
    title: str = Field(..., min_length=2, max_length=200)
    description: str = Field(..., min_length=2, max_length=2000)
    category: str = Field(default="general", max_length=50)
    severity: str = Field(default="medium", max_length=20)
    reporter_id: Optional[int] = None
    location: Optional[str] = None
    asset_code: Optional[str] = None
    drill_mode: bool = False


class TicketStatusUpdate(BaseModel):
    status: str = Field(..., pattern="^(pending|assigned|in_progress|waiting_acceptance|closed)$")
    adopted_optimization_suggestion_id: Optional[int] = None
    adopted_optimization_note: Optional[str] = None


class TicketEtaUpdate(BaseModel):
    eta_minutes: int = Field(..., ge=1, le=240)


class TicketAssignRequest(BaseModel):
    assignee_id: Optional[int] = None


class TicketRatingCreate(BaseModel):
    response_speed_score: int = Field(..., ge=1, le=5)
    service_attitude_score: int = Field(..., ge=1, le=5)
    comment: Optional[str] = None
    rater_id: Optional[int] = None


async def _append_event(db: AsyncSession, ticket_id: int, event_type: str, content: str, actor_id: Optional[int] = None):
    event = TicketEvent(
        ticket_id=ticket_id,
        actor_id=actor_id,
        event_type=event_type,
        content=content,
        created_at=datetime.utcnow(),
    )
    db.add(event)


def _calc_risk_score(payload: TicketCreate) -> Dict[str, Any]:
    text = f"{payload.title} {payload.description} {payload.location or ''}".lower()
    score = 0

    high_keywords = ["中断", "黑屏", "断网", "离线", "故障", "无法", "告警", "泄漏", "异常"]
    for kw in high_keywords:
        if kw in text:
            score += 15

    if payload.category == "teaching_support":
        score += 20
    elif payload.category == "lab_support":
        score += 12
    elif payload.category == "club_support":
        score += 10

    if any(x in text for x in ["上课", "课堂", "考试", "直播", "路演"]):
        score += 20

    if payload.asset_code:
        score += 5

    if score >= 60:
        severity = "high"
    elif score >= 35:
        severity = "medium"
    else:
        severity = "low"

    return {"score": score, "severity": severity}


@router.post("/")
async def create_ticket(payload: TicketCreate, db: AsyncSession = Depends(get_db)) -> Dict[str, Any]:
    risk = _calc_risk_score(payload)
    final_severity = payload.severity
    if risk["score"] >= 35:
        final_severity = risk["severity"]

    ticket = Ticket(
        title=payload.title,
        description=(payload.description + ("\n[DRILL_MODE]" if payload.drill_mode else "")),
        category=payload.category,
        severity=final_severity,
        status="pending",
        reporter_id=payload.reporter_id,
        location=payload.location,
        asset_code=payload.asset_code,
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow(),
    )
    db.add(ticket)
    await db.flush()

    await _append_event(db, ticket.id, "created", f"工单已创建: {payload.title}", payload.reporter_id)
    await _append_event(db, ticket.id, "risk_scored", f"风险评分={risk['score']}，自动判级={final_severity}", payload.reporter_id)
    await db.commit()
    await db.refresh(ticket)

    return {"ticket": ticket.to_dict()}


@router.get("/")
async def list_tickets(status: Optional[str] = None, limit: int = 50, db: AsyncSession = Depends(get_db)) -> Dict[str, Any]:
    stmt = select(Ticket).order_by(Ticket.created_at.desc()).limit(max(1, min(limit, 200)))
    if status:
      stmt = stmt.where(Ticket.status == status)

    result = await db.execute(stmt)
    rows = result.scalars().all()

    now = datetime.utcnow()
    for t in rows:
        if t.status in ["assigned", "in_progress", "waiting_acceptance"] and t.due_at and t.due_at < now:
            overdue_minutes = int((now - t.due_at).total_seconds() // 60)
            if t.severity != "high":
                t.severity = "high"
                t.updated_at = now
                await _append_event(db, t.id, "sla_escalated", f"SLA超时 {overdue_minutes} 分钟，自动升级为高优先级")

    await db.commit()
    return {"items": [r.to_dict() for r in rows], "count": len(rows)}


@router.get("/{ticket_id}")
async def get_ticket(ticket_id: int, db: AsyncSession = Depends(get_db)) -> Dict[str, Any]:
    result = await db.execute(select(Ticket).where(Ticket.id == ticket_id))
    ticket = result.scalar_one_or_none()
    if not ticket:
        raise HTTPException(status_code=404, detail="工单不存在")
    return {"ticket": ticket.to_dict()}


@router.post("/{ticket_id}/status")
async def update_ticket_status(ticket_id: int, payload: TicketStatusUpdate, db: AsyncSession = Depends(get_db)) -> Dict[str, Any]:
    result = await db.execute(select(Ticket).where(Ticket.id == ticket_id))
    ticket = result.scalar_one_or_none()
    if not ticket:
        raise HTTPException(status_code=404, detail="工单不存在")

    ticket.status = payload.status
    ticket.updated_at = datetime.utcnow()
    if payload.status == "closed":
        ticket.closed_at = datetime.utcnow()
        ticket.adopted_optimization_suggestion_id = payload.adopted_optimization_suggestion_id
        ticket.adopted_optimization_note = payload.adopted_optimization_note
        if payload.adopted_optimization_suggestion_id:
            suggestion = (
                await db.execute(
                    select(OptimizationSuggestion).where(
                        OptimizationSuggestion.id == payload.adopted_optimization_suggestion_id
                    )
                )
            ).scalar_one_or_none()
            if suggestion:
                suggestion.exec_status = "done"
                suggestion.applied = True
                suggestion.applied_at = datetime.utcnow()

    await _append_event(db, ticket.id, "status_changed", f"状态更新为 {payload.status}")
    await db.commit()
    await db.refresh(ticket)
    return {"ticket": ticket.to_dict()}


@router.post("/{ticket_id}/eta")
async def set_ticket_eta(ticket_id: int, payload: TicketEtaUpdate, db: AsyncSession = Depends(get_db)) -> Dict[str, Any]:
    result = await db.execute(select(Ticket).where(Ticket.id == ticket_id))
    ticket = result.scalar_one_or_none()
    if not ticket:
        raise HTTPException(status_code=404, detail="工单不存在")

    ticket.eta_minutes = payload.eta_minutes
    ticket.due_at = datetime.utcnow() + timedelta(minutes=payload.eta_minutes)
    ticket.updated_at = datetime.utcnow()

    await _append_event(db, ticket.id, "eta_set", f"预计到场时间 {payload.eta_minutes} 分钟")
    await db.commit()
    await db.refresh(ticket)
    return {"ticket": ticket.to_dict()}


@router.post("/{ticket_id}/assign")
async def assign_ticket(ticket_id: int, payload: TicketAssignRequest, db: AsyncSession = Depends(get_db)) -> Dict[str, Any]:
    result = await db.execute(select(Ticket).where(Ticket.id == ticket_id))
    ticket = result.scalar_one_or_none()
    if not ticket:
        raise HTTPException(status_code=404, detail="工单不存在")

    assignee_id = payload.assignee_id

    if assignee_id is None:
        now = datetime.utcnow().time()

        shift_stmt = select(DutyShift.user_id).where(
            and_(DutyShift.is_active == True, DutyShift.start_time <= now, DutyShift.end_time >= now)
        )
        shift_rows = (await db.execute(shift_stmt)).all()
        candidates = [row[0] for row in shift_rows]

        if not candidates:
            raise HTTPException(status_code=400, detail="当前无值班人员可分配")

        load_stmt = (
            select(Ticket.assignee_id, func.count(Ticket.id).label("c"))
            .where(and_(Ticket.assignee_id.in_(candidates), Ticket.status.in_(["assigned", "in_progress", "waiting_acceptance"])))
            .group_by(Ticket.assignee_id)
        )
        load_rows = (await db.execute(load_stmt)).all()
        load_map = {row[0]: row[1] for row in load_rows}

        assignee_id = sorted(candidates, key=lambda uid: load_map.get(uid, 0))[0]

    ticket.assignee_id = assignee_id
    ticket.status = "assigned"
    ticket.updated_at = datetime.utcnow()

    await _append_event(db, ticket.id, "assigned", f"工单已派单给值班员 {assignee_id}", assignee_id)
    await db.commit()
    await db.refresh(ticket)
    return {"ticket": ticket.to_dict()}


@router.get("/{ticket_id}/events")
async def list_ticket_events(ticket_id: int, db: AsyncSession = Depends(get_db)) -> Dict[str, Any]:
    result = await db.execute(select(TicketEvent).where(TicketEvent.ticket_id == ticket_id).order_by(TicketEvent.created_at.asc()))
    rows = result.scalars().all()
    return {"items": [r.to_dict() for r in rows], "count": len(rows)}


@router.post("/{ticket_id}/rating")
async def create_ticket_rating(ticket_id: int, payload: TicketRatingCreate, db: AsyncSession = Depends(get_db)) -> Dict[str, Any]:
    t = (await db.execute(select(Ticket).where(Ticket.id == ticket_id))).scalar_one_or_none()
    if not t:
        raise HTTPException(status_code=404, detail="工单不存在")

    rating = TicketRating(
        ticket_id=ticket_id,
        rater_id=payload.rater_id,
        response_speed_score=payload.response_speed_score,
        service_attitude_score=payload.service_attitude_score,
        comment=payload.comment,
        created_at=datetime.utcnow(),
    )
    db.add(rating)
    await _append_event(db, ticket_id, "rating", f"用户评分 已提交: 速度={payload.response_speed_score}, 态度={payload.service_attitude_score}", payload.rater_id)
    await db.commit()
    await db.refresh(rating)
    return {"item": rating.to_dict()}


@router.get("/ratings/summary")
async def ticket_rating_summary(db: AsyncSession = Depends(get_db)) -> Dict[str, Any]:
    rows = (await db.execute(select(TicketRating))).scalars().all()
    if not rows:
        return {
            "count": 0,
            "avg_response_speed": 0,
            "avg_service_attitude": 0,
            "avg_overall": 0,
        }

    avg_response = sum(r.response_speed_score for r in rows) / len(rows)
    avg_attitude = sum(r.service_attitude_score for r in rows) / len(rows)
    return {
        "count": len(rows),
        "avg_response_speed": round(avg_response, 2),
        "avg_service_attitude": round(avg_attitude, 2),
        "avg_overall": round((avg_response + avg_attitude) / 2, 2),
    }


@router.get("/drill-report")
async def drill_report(db: AsyncSession = Depends(get_db)) -> Dict[str, Any]:
    rows = (await db.execute(select(Ticket).order_by(Ticket.created_at.desc()))).scalars().all()
    drills = [t for t in rows if (t.description or "").find("[DRILL_MODE]") >= 0]

    closed = [t for t in drills if t.status == "closed"]
    total = len(drills)
    close_rate = round((len(closed) / total) * 100, 2) if total else 0

    return {
        "count": total,
        "closed_count": len(closed),
        "close_rate": close_rate,
        "items": [
            {
                "id": t.id,
                "title": t.title,
                "status": t.status,
                "severity": t.severity,
                "created_at": t.created_at.isoformat() if t.created_at else None,
                "closed_at": t.closed_at.isoformat() if t.closed_at else None,
            }
            for t in drills[:100]
        ],
    }
