from typing import List, Dict, Any, Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_
from app.models.database import Alert
from app.config import settings
from app.utils.logger import logger
from datetime import datetime


class AlertService:
    
    def __init__(self, db: AsyncSession):
        self.db = db
    
    async def check_and_create_alerts(self, metrics: Dict[str, Any]) -> List[Alert]:
        """检查指标并创建告警"""
        alerts = []
        thresholds = settings.alert_thresholds
        
        # 检查慢查询数
        slow_query_count = metrics.get('slow_queries', 0)
        if slow_query_count > thresholds.get('slow_query', 10):
            alert = await self._create_alert_if_not_exists(
                alert_type='slow_query',
                severity='warning',
                title='慢查询数量异常',
                message=f'当前慢查询数量为 {slow_query_count}，超过阈值 {thresholds.get("slow_query", 10)}',
                threshold_value=thresholds.get('slow_query', 10),
                current_value=slow_query_count
            )
            if alert:
                alerts.append(alert)
        
        # 检查连接数
        connection_count = metrics.get('active_connections', 0)
        if connection_count > thresholds.get('connection_count', 100):
            alert = await self._create_alert_if_not_exists(
                alert_type='connection_limit',
                severity='critical',
                title='数据库连接数接近上限',
                message=f'当前活跃连接数为 {connection_count}，超过阈值 {thresholds.get("connection_count", 100)}',
                threshold_value=thresholds.get('connection_count', 100),
                current_value=connection_count
            )
            if alert:
                alerts.append(alert)
        
        # 检查QPS
        qps = metrics.get('qps', 0)
        if qps > thresholds.get('qps', 10000):
            alert = await self._create_alert_if_not_exists(
                alert_type='high_qps',
                severity='warning',
                title='QPS异常高',
                message=f'当前QPS为 {qps:.2f}，超过阈值 {thresholds.get("qps", 10000)}',
                threshold_value=thresholds.get('qps', 10000),
                current_value=qps
            )
            if alert:
                alerts.append(alert)
        
        return alerts
    
    async def _create_alert_if_not_exists(
        self,
        alert_type: str,
        severity: str,
        title: str,
        message: str,
        threshold_value: float,
        current_value: float
    ) -> Optional[Alert]:
        """如果不存在相同类型的活跃告警，则创建新告警"""
        # 检查是否存在相同类型的活跃告警
        query = select(Alert).where(
            and_(
                Alert.alert_type == alert_type,
                Alert.status == 'active'
            )
        )
        result = await self.db.execute(query)
        existing = result.scalar_one_or_none()
        
        if existing:
            # 更新现有告警的当前值
            existing.current_value = current_value
            await self.db.commit()
            await self.db.refresh(existing)
            return None
        
        # 创建新告警
        alert = Alert(
            alert_type=alert_type,
            severity=severity,
            title=title,
            message=message,
            threshold_value=threshold_value,
            current_value=current_value,
            status='active'
        )
        self.db.add(alert)
        await self.db.commit()
        await self.db.refresh(alert)
        
        logger.warning(f"Alert created: {title} - {message}")
        return alert
    
    async def get_active_alerts(self, limit: int = 50) -> List[Alert]:
        """获取活跃告警列表"""
        query = select(Alert).where(
            Alert.status == 'active'
        ).order_by(Alert.created_at.desc()).limit(limit)
        
        result = await self.db.execute(query)
        return result.scalars().all()
    
    async def resolve_alert(self, alert_id: int) -> bool:
        """解决告警"""
        query = select(Alert).where(Alert.id == alert_id)
        result = await self.db.execute(query)
        alert = result.scalar_one_or_none()
        
        if alert:
            alert.status = 'resolved'
            alert.resolved_at = datetime.utcnow()
            await self.db.commit()
            return True
        return False
    
    async def dismiss_alert(self, alert_id: int) -> bool:
        """忽略告警"""
        query = select(Alert).where(Alert.id == alert_id)
        result = await self.db.execute(query)
        alert = result.scalar_one_or_none()
        
        if alert:
            alert.status = 'dismissed'
            await self.db.commit()
            return True
        return False
