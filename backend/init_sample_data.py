import asyncio
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from datetime import datetime, timedelta
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from app.models.database import Base, Ticket, TicketEvent, DutyShift, KnowledgeArticle
from app.models.alert import Alert
from app.config import settings

async def init_sample_data():
    engine = create_async_engine(settings.database_url, echo=True)
    async_session_maker = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    async with async_session_maker() as session:
        # 添加值班安排
        shifts = [
            DutyShift(
                user_id=1,
                role="值班老师",
                start_time=datetime.strptime("08:00", "%H:%M").time(),
                end_time=datetime.strptime("12:00", "%H:%M").time(),
                is_active=True,
                created_at=datetime.utcnow()
            ),
            DutyShift(
                user_id=2,
                role="学生助理",
                start_time=datetime.strptime("14:00", "%H:%M").time(),
                end_time=datetime.strptime("18:00", "%H:%M").time(),
                is_active=True,
                created_at=datetime.utcnow()
            ),
        ]
        session.add_all(shifts)

        # 添加知识库文章
        knowledge_articles = [
            KnowledgeArticle(
                title="投影仪黑屏解决方案",
                keywords="投影,黑屏,教室",
                content="1. 检查投影仪电源是否开启\n2. 检查信号线连接\n3. 按下投影仪遥控器的SOURCE键切换信号源",
                category="教室设备",
                view_count=10,
                solve_count=5,
                created_at=datetime.utcnow(),
                updated_at=datetime.utcnow()
            ),
            KnowledgeArticle(
                title="网络连接不稳定处理",
                keywords="网络,WiFi,连接",
                content="1. 重启网络设备\n2. 检查网线连接\n3. 联系网络管理员",
                category="网络问题",
                view_count=15,
                solve_count=8,
                created_at=datetime.utcnow(),
                updated_at=datetime.utcnow()
            ),
            KnowledgeArticle(
                title="电脑无法启动处理",
                keywords="电脑,无法启动,开机",
                content="1. 检查电源线连接\n2. 尝试长按电源键10秒强制关机后再开机\n3. 如果仍无法启动，联系技术支持",
                category="电脑问题",
                view_count=20,
                solve_count=12,
                created_at=datetime.utcnow(),
                updated_at=datetime.utcnow()
            ),
        ]
        session.add_all(knowledge_articles)

        # 添加告警
        alerts = [
            Alert(
                alert_type="performance",
                severity="warning",
                title="CPU使用率过高",
                message="当前CPU使用率达到85%，建议关注",
                threshold_value=80.0,
                current_value=85.0,
                status="active",
                created_at=datetime.utcnow()
            ),
            Alert(
                alert_type="connection",
                severity="info",
                title="数据库连接数上升",
                message="当前活动连接数为120，较平时增加20%",
                threshold_value=100.0,
                current_value=120.0,
                status="active",
                created_at=datetime.utcnow() - timedelta(hours=1)
            ),
        ]
        session.add_all(alerts)

        # 添加工单
        tickets = [
            Ticket(
                title="3教402投影仪黑屏",
                description="上课期间投影仪突然黑屏，已尝试重启无效",
                category="teaching_support",
                severity="high",
                status="in_progress",
                reporter_id=1,
                assignee_id=1,
                location="3教402",
                created_at=datetime.utcnow() - timedelta(hours=2),
                updated_at=datetime.utcnow() - timedelta(hours=1)
            ),
            Ticket(
                title="机房B网络不稳定",
                description="学生反映机房B无线网络经常掉线",
                category="lab_support",
                severity="medium",
                status="pending",
                reporter_id=2,
                location="机房B",
                created_at=datetime.utcnow() - timedelta(hours=1),
                updated_at=datetime.utcnow() - timedelta(minutes=30)
            ),
        ]
        session.add_all(tickets)
        await session.flush()

        # 添加工单事件
        events = [
            TicketEvent(
                ticket_id=tickets[0].id,
                actor_id=1,
                event_type="created",
                content="工单已创建",
                created_at=datetime.utcnow() - timedelta(hours=2)
            ),
            TicketEvent(
                ticket_id=tickets[0].id,
                actor_id=1,
                event_type="assigned",
                content="已派单给值班老师",
                created_at=datetime.utcnow() - timedelta(hours=1)
            ),
        ]
        session.add_all(events)

        await session.commit()
        print("示例数据初始化成功！")

if __name__ == "__main__":
    asyncio.run(init_sample_data())