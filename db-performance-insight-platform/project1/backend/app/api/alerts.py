from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import get_db
from app.models.alert import Alert
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
