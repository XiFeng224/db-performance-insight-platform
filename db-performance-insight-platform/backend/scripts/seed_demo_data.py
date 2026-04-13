import asyncio
from datetime import datetime, timedelta, time

from sqlalchemy import select

from app.database import async_session_maker, init_db
from app.models.database import (
    DutyShift,
    KnowledgeArticle,
    OptimizationSuggestion,
    Ticket,
    TicketEvent,
    TicketRating,
)


async def seed():
    await init_db()
    async with async_session_maker() as db:
        # 清空历史演示数据
        for model in [TicketRating, TicketEvent, Ticket, OptimizationSuggestion, DutyShift, KnowledgeArticle]:
            rows = (await db.execute(select(model))).scalars().all()
            for r in rows:
                await db.delete(r)
        await db.commit()

        # 值班排班
        shifts = [
            DutyShift(user_id=1001, role='assistant', start_time=time(8, 0), end_time=time(16, 0), is_active=True),
            DutyShift(user_id=1002, role='assistant', start_time=time(16, 0), end_time=time(23, 0), is_active=True),
            DutyShift(user_id=1003, role='club', start_time=time(18, 0), end_time=time(22, 30), is_active=True),
        ]
        db.add_all(shifts)

        # 知识库
        knowledge = [
            KnowledgeArticle(
                title='课堂投影黑屏应急SOP',
                keywords='投影,黑屏,课堂,HDMI,教学',
                content='先检查输入源与HDMI连接；切换备用线缆；确认投影电源与信号源；5分钟内无法恢复则升级值班老师。',
                category='teaching_support',
                view_count=28,
                solve_count=22,
            ),
            KnowledgeArticle(
                title='机房整排无法联网排障',
                keywords='机房,网络,DNS,网关,交换机',
                content='先确认受影响范围；检查交换机端口与指示灯；验证网关连通与DNS解析；必要时切换备用网络。',
                category='lab_support',
                view_count=34,
                solve_count=27,
            ),
            KnowledgeArticle(
                title='社团直播推流中断处置',
                keywords='社团,路演,直播,推流,编码器',
                content='优先恢复主推流链路；并行启动备推流；通知活动负责人与值班老师；活动结束后复盘编码器日志。',
                category='club_support',
                view_count=18,
                solve_count=13,
            ),
            KnowledgeArticle(
                title='数据库连接数突增应对',
                keywords='数据库,连接池,慢查询,连接数',
                content='先识别高并发来源；限流高风险接口；检查连接池配置与慢SQL；必要时临时扩容并保留回滚方案。',
                category='lab_support',
                view_count=21,
                solve_count=16,
            ),
        ]
        db.add_all(knowledge)
        await db.flush()

        now = datetime.utcnow()

        # 工单（覆盖待接单/处理中/待验收/已关闭）
        tickets = [
            Ticket(
                title='3教402上课中投影黑屏',
                description='教师无法展示课件，约40名学生在场，已重启无效。',
                category='teaching_support',
                severity='high',
                status='in_progress',
                location='3教402',
                reporter_id=2001,
                assignee_id=1001,
                eta_minutes=5,
                due_at=now + timedelta(minutes=5),
                created_at=now - timedelta(minutes=18),
                updated_at=now - timedelta(minutes=2),
            ),
            Ticket(
                title='机房B整排电脑无法联网',
                description='影响第3-4节实验课，交换机指示灯异常闪烁。',
                category='lab_support',
                severity='high',
                status='assigned',
                location='机房B',
                reporter_id=2002,
                assignee_id=1002,
                eta_minutes=8,
                due_at=now + timedelta(minutes=8),
                created_at=now - timedelta(minutes=10),
                updated_at=now - timedelta(minutes=4),
            ),
            Ticket(
                title='社团路演直播推流中断',
                description='活动20分钟后开始，主推流断开。',
                category='club_support',
                severity='medium',
                status='waiting_acceptance',
                location='学生活动中心A厅',
                reporter_id=2003,
                assignee_id=1003,
                eta_minutes=6,
                due_at=now - timedelta(minutes=3),
                created_at=now - timedelta(minutes=45),
                updated_at=now - timedelta(minutes=7),
            ),
            Ticket(
                title='数据库连接池告警恢复确认',
                description='晚高峰连接数异常上涨，已临时扩容并回落。',
                category='lab_support',
                severity='medium',
                status='closed',
                location='核心数据库集群',
                reporter_id=2004,
                assignee_id=1002,
                eta_minutes=12,
                due_at=now - timedelta(minutes=70),
                created_at=now - timedelta(minutes=120),
                updated_at=now - timedelta(minutes=50),
                closed_at=now - timedelta(minutes=45),
            ),
            Ticket(
                title='实验楼A门禁间歇失效',
                description='晚间高峰时段多次刷卡失败。',
                category='teaching_support',
                severity='low',
                status='pending',
                location='实验楼A一层',
                reporter_id=2005,
                created_at=now - timedelta(minutes=6),
                updated_at=now - timedelta(minutes=6),
            ),
        ]
        db.add_all(tickets)
        await db.flush()

        # 工单事件时间线
        events = []
        for t in tickets:
            events.append(TicketEvent(ticket_id=t.id, actor_id=t.reporter_id, event_type='created', content=f'工单已创建：{t.title}', created_at=t.created_at or now))
            if t.assignee_id:
                events.append(TicketEvent(ticket_id=t.id, actor_id=t.assignee_id, event_type='assigned', content=f'已派单给值班员 {t.assignee_id}', created_at=(t.created_at or now) + timedelta(minutes=2)))
            if t.status in ['in_progress', 'waiting_acceptance', 'closed']:
                events.append(TicketEvent(ticket_id=t.id, actor_id=t.assignee_id, event_type='status_changed', content=f'状态更新为 {t.status}', created_at=(t.created_at or now) + timedelta(minutes=5)))
            if t.status == 'closed':
                events.append(TicketEvent(ticket_id=t.id, actor_id=t.assignee_id, event_type='closed', content='问题已闭环，待复盘。', created_at=t.closed_at or now))
        db.add_all(events)

        # 服务评价
        ratings = [
            TicketRating(ticket_id=tickets[3].id, rater_id=2101, response_speed_score=5, service_attitude_score=5, comment='响应迅速，沟通清晰。'),
            TicketRating(ticket_id=tickets[3].id, rater_id=2102, response_speed_score=4, service_attitude_score=5, comment='恢复及时，建议增强通报模板。'),
            TicketRating(ticket_id=tickets[2].id, rater_id=2103, response_speed_score=4, service_attitude_score=4, comment='活动前处理完成，整体满意。'),
        ]
        db.add_all(ratings)

        # 优化建议（用于优化页/诊断页演示）
        suggestions = [
            OptimizationSuggestion(
                slow_query_id=101,
                suggestion_type='index_recommendation',
                description='对 orders(user_id, created_at) 建联合索引，降低实验课查询延迟。',
                priority='high',
                impact_score=0.92,
                sql_statement='CREATE INDEX idx_orders_user_created ON orders(user_id, created_at);',
                owner='机房DBA值班',
                due_date=(now + timedelta(days=1)).strftime('%Y-%m-%d'),
                exec_status='doing',
                created_at=now - timedelta(hours=3),
            ),
            OptimizationSuggestion(
                slow_query_id=102,
                suggestion_type='full_table_scan',
                description='优化 course_logs 条件过滤，避免全表扫描影响课堂高峰。',
                priority='medium',
                impact_score=0.67,
                owner='后端值班工程师',
                due_date=(now + timedelta(days=2)).strftime('%Y-%m-%d'),
                exec_status='verifying',
                created_at=now - timedelta(hours=2),
            ),
            OptimizationSuggestion(
                slow_query_id=103,
                suggestion_type='index_recommendation',
                description='为 assets(asset_code) 增加索引，提升机房资产检索速度。',
                priority='low',
                impact_score=0.35,
                sql_statement='CREATE INDEX idx_assets_code ON assets(asset_code);',
                owner='后端值班工程师',
                due_date=(now + timedelta(days=3)).strftime('%Y-%m-%d'),
                exec_status='todo',
                created_at=now - timedelta(hours=1),
            ),
            OptimizationSuggestion(
                slow_query_id=104,
                suggestion_type='index_recommendation',
                description='优化 live_stream_sessions 查询索引，降低社团直播监控告警误报。',
                priority='medium',
                impact_score=0.58,
                sql_statement='CREATE INDEX idx_live_stream_status ON live_stream_sessions(status, updated_at);',
                owner='中心值班老师',
                due_date=(now + timedelta(days=1)).strftime('%Y-%m-%d'),
                exec_status='done',
                created_at=now - timedelta(hours=4),
                applied=True,
                applied_at=now - timedelta(hours=1, minutes=30),
            ),
        ]
        db.add_all(suggestions)

        await db.commit()
        print('Demo data seeded successfully (tickets/knowledge/optimization/duty/ratings).')


if __name__ == '__main__':
    asyncio.run(seed())
