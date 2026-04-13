from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import get_db
from app.models.alert import Alert
from app.models.database import Ticket, TicketEvent
from app.schemas.alert import AlertCreate, AlertResponse, AlertUpdate
from app.utils.logger import api_logger
from typing import List
import datetime

router = APIRouter(prefix="/api/alerts", tags=["alerts"])


@router.get("/active", response_model=List[AlertResponse])
async def get_active_alerts(
    db: AsyncSession = Depends(get_db)
):
    """获取活跃告警"""
    try:
        alerts = await db.execute(
            Alert.__table__.select().where(Alert.status == "active")
        )
        return alerts.fetchall()
    except Exception as e:
        api_logger.error(f"Error getting active alerts: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"获取活跃告警失败: {str(e)}")


@router.post("/{alert_id}/resolve")
async def resolve_alert(
    alert_id: int,
    db: AsyncSession = Depends(get_db)
):
    """解决告警"""
    try:
        alert = await db.get(Alert, alert_id)
        if not alert:
            raise HTTPException(status_code=404, detail="告警不存在")
        
        alert.status = "resolved"
        alert.resolved_at = datetime.datetime.utcnow()
        await db.commit()
        
        return {"message": "告警已解决"}
    except HTTPException:
        raise
    except Exception as e:
        api_logger.error(f"Error resolving alert: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"解决告警失败: {str(e)}")


@router.post("/{alert_id}/to-ticket")
async def alert_to_ticket(
    alert_id: int,
    db: AsyncSession = Depends(get_db)
):
    """告警一键转工单（携带告警上下文）"""
    try:
        alert = await db.get(Alert, alert_id)
        if not alert:
            raise HTTPException(status_code=404, detail="告警不存在")

        severity = "high" if alert.severity == "critical" else ("medium" if alert.severity == "warning" else "low")
        category = "lab_support"
        text = f"{alert.title} {alert.message}".lower()
        if "课堂" in text or "教学" in text:
            category = "teaching_support"
        elif "社团" in text or "活动" in text or "直播" in text:
            category = "club_support"

        ticket = Ticket(
            title=f"告警转工单：{alert.title}",
            description=(
                f"告警类型: {alert.alert_type}\n"
                f"严重级别: {alert.severity}\n"
                f"告警内容: {alert.message}\n"
                f"阈值/当前值: {alert.threshold_value} / {alert.current_value}\n"
                f"触发时间: {alert.created_at.isoformat() if alert.created_at else '-'}"
            ),
            category=category,
            severity=severity,
            status="pending",
            location="校园告警中心",
            created_at=datetime.datetime.utcnow(),
            updated_at=datetime.datetime.utcnow(),
        )
        db.add(ticket)
        await db.flush()

        db.add(
            TicketEvent(
                ticket_id=ticket.id,
                actor_id=None,
                event_type="created",
                content=f"由告警 #{alert.id} 一键转工单",
                created_at=datetime.datetime.utcnow(),
            )
        )

        alert.status = "resolved"
        alert.resolved_at = datetime.datetime.utcnow()
        await db.commit()

        return {"message": "已转工单", "ticket": ticket.to_dict()}
    except HTTPException:
        raise
    except Exception as e:
        api_logger.error(f"Error converting alert to ticket: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"告警转工单失败: {str(e)}")


@router.post("/{alert_id}/dismiss")
async def dismiss_alert(
    alert_id: int,
    db: AsyncSession = Depends(get_db)
):
    """忽略告警"""
    try:
        alert = await db.get(Alert, alert_id)
        if not alert:
            raise HTTPException(status_code=404, detail="告警不存在")
        
        alert.status = "dismissed"
        alert.resolved_at = datetime.datetime.utcnow()
        await db.commit()
        
        return {"message": "告警已忽略"}
    except HTTPException:
        raise
    except Exception as e:
        api_logger.error(f"Error dismissing alert: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"忽略告警失败: {str(e)}")


@router.post("/", response_model=AlertResponse)
async def create_alert(
    alert: AlertCreate,
    db: AsyncSession = Depends(get_db)
):
    """创建告警"""
    try:
        db_alert = Alert(
            alert_type=alert.alert_type,
            severity=alert.severity,
            title=alert.title,
            message=alert.message,
            threshold_value=alert.threshold_value,
            current_value=alert.current_value,
            status="active",
            created_at=datetime.datetime.utcnow()
        )
        db.add(db_alert)
        await db.commit()
        await db.refresh(db_alert)
        return db_alert
    except Exception as e:
        api_logger.error(f"Error creating alert: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"创建告警失败: {str(e)}")


@router.get("/", response_model=List[AlertResponse])
async def get_alerts(
    skip: int = 0,
    limit: int = 100,
    db: AsyncSession = Depends(get_db)
):
    """获取告警列表"""
    try:
        alerts = await db.execute(
            Alert.__table__.select().offset(skip).limit(limit)
        )
        return alerts.fetchall()
    except Exception as e:
        api_logger.error(f"Error getting alerts: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"获取告警列表失败: {str(e)}")


@router.get("/{alert_id}", response_model=AlertResponse)
async def get_alert(
    alert_id: int,
    db: AsyncSession = Depends(get_db)
):
    """获取单个告警"""
    try:
        alert = await db.get(Alert, alert_id)
        if not alert:
            raise HTTPException(status_code=404, detail="告警不存在")
        return alert
    except HTTPException:
        raise
    except Exception as e:
        api_logger.error(f"Error getting alert: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"获取告警失败: {str(e)}")


@router.put("/{alert_id}", response_model=AlertResponse)
async def update_alert(
    alert_id: int,
    alert: AlertUpdate,
    db: AsyncSession = Depends(get_db)
):
    """更新告警"""
    try:
        db_alert = await db.get(Alert, alert_id)
        if not db_alert:
            raise HTTPException(status_code=404, detail="告警不存在")
        
        for field, value in alert.dict(exclude_unset=True).items():
            setattr(db_alert, field, value)
        
        await db.commit()
        await db.refresh(db_alert)
        return db_alert
    except HTTPException:
        raise
    except Exception as e:
        api_logger.error(f"Error updating alert: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"更新告警失败: {str(e)}")


@router.delete("/{alert_id}")
async def delete_alert(
    alert_id: int,
    db: AsyncSession = Depends(get_db)
):
    """删除告警"""
    try:
        alert = await db.get(Alert, alert_id)
        if not alert:
            raise HTTPException(status_code=404, detail="告警不存在")
        
        await db.delete(alert)
        await db.commit()
        
        return {"message": "告警已删除"}
    except HTTPException:
        raise
    except Exception as e:
        api_logger.error(f"Error deleting alert: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"删除告警失败: {str(e)}")
