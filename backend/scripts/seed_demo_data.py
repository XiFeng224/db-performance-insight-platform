import asyncio
from datetime import datetime, timedelta, time

from sqlalchemy import select

from app.database import async_session_maker, init_db
from app.models.database import (
    AICallLog,
    Alert,
    DutyShift,
    KnowledgeArticle,
    OpsActionLog,
    OptimizationSuggestion,
    PerformanceSnapshot,
    SlowQuery,
    Ticket,
    TicketEvent,
    TicketRating,
)


async def seed():
    await init_db()
    async with async_session_maker() as db:
        # 清空历史演示数据
        for model in [
            AICallLog,
            Alert,
            OpsActionLog,
            PerformanceSnapshot,
            SlowQuery,
            TicketRating,
            TicketEvent,
            Ticket,
            OptimizationSuggestion,
            DutyShift,
            KnowledgeArticle,
        ]:
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

        # 慢查询（用于数据库诊断与优化建议）
        slow_queries = [
            SlowQuery(
                sql_fingerprint='SELECT * FROM course_attendance WHERE course_id=?',
                sql_text='SELECT * FROM course_attendance WHERE course_id = 2026 ORDER BY created_at DESC;',
                execution_time=2.438,
                lock_time=0.012,
                rows_sent=120,
                rows_examined=15840,
                database='campus_lab',
                query_time=2.438,
                client_ip='10.10.1.23',
                user='lab_reader',
                timestamp=now - timedelta(minutes=14),
            ),
            SlowQuery(
                sql_fingerprint='SELECT * FROM live_stream_logs WHERE event_id=? AND status=?',
                sql_text='SELECT * FROM live_stream_logs WHERE event_id = 88 AND status = "retry";',
                execution_time=1.764,
                lock_time=0.007,
                rows_sent=45,
                rows_examined=9640,
                database='campus_activity',
                query_time=1.764,
                client_ip='10.10.3.17',
                user='club_service',
                timestamp=now - timedelta(minutes=28),
            ),
            SlowQuery(
                sql_fingerprint='SELECT * FROM lab_devices WHERE building=? AND status=?',
                sql_text='SELECT * FROM lab_devices WHERE building = "A" AND status = "offline";',
                execution_time=3.205,
                lock_time=0.016,
                rows_sent=26,
                rows_examined=22040,
                database='campus_asset',
                query_time=3.205,
                client_ip='10.10.2.8',
                user='asset_service',
                timestamp=now - timedelta(minutes=35),
            ),
        ]
        db.add_all(slow_queries)

        # 指标快照（用于复盘页）
        snapshots = [
            PerformanceSnapshot(
                snapshot_name='period_prev_1',
                qps=118,
                active_connections=92,
                slow_queries_count=22,
                avg_execution_time=1.94,
                metrics_data={
                    'cpu_usage': 64,
                    'memory_usage': 68,
                    'disk_io': 41,
                    'connections': 92,
                },
                created_at=now - timedelta(hours=2, minutes=10),
            ),
            PerformanceSnapshot(
                snapshot_name='period_prev_2',
                qps=124,
                active_connections=96,
                slow_queries_count=19,
                avg_execution_time=1.81,
                metrics_data={
                    'cpu_usage': 62,
                    'memory_usage': 67,
                    'disk_io': 43,
                    'connections': 96,
                },
                created_at=now - timedelta(hours=1, minutes=50),
            ),
            PerformanceSnapshot(
                snapshot_name='period_curr_1',
                qps=132,
                active_connections=88,
                slow_queries_count=12,
                avg_execution_time=1.33,
                metrics_data={
                    'cpu_usage': 56,
                    'memory_usage': 63,
                    'disk_io': 36,
                    'connections': 88,
                },
                created_at=now - timedelta(minutes=55),
            ),
            PerformanceSnapshot(
                snapshot_name='period_curr_2',
                qps=139,
                active_connections=83,
                slow_queries_count=9,
                avg_execution_time=1.08,
                metrics_data={
                    'cpu_usage': 52,
                    'memory_usage': 60,
                    'disk_io': 32,
                    'connections': 83,
                },
                created_at=now - timedelta(minutes=22),
            ),
        ]
        db.add_all(snapshots)

        # 告警（用于告警中心）
        alerts = [
            Alert(
                alert_type='slow_query',
                severity='warning',
                title='课堂高峰慢查询偏高',
                message='3教课程相关查询在15分钟窗口内慢查询次数上升。',
                threshold_value=15,
                current_value=22,
                status='active',
                created_at=now - timedelta(minutes=40),
            ),
            Alert(
                alert_type='connection_count',
                severity='critical',
                title='核心数据库连接数接近上限',
                message='连接池占用持续高位，请优先执行限流与连接池排查。',
                threshold_value=95,
                current_value=98,
                status='active',
                created_at=now - timedelta(minutes=18),
            ),
            Alert(
                alert_type='qps',
                severity='info',
                title='社团活动流量波动',
                message='晚间活动开始前后QPS波动正常，建议持续观察。',
                threshold_value=130,
                current_value=126,
                status='active',
                created_at=now - timedelta(minutes=8),
            ),
        ]
        db.add_all(alerts)

        # 运维动作日志（用于应急协作中心）
        ops_logs = [
            OpsActionLog(action='generate_runbook', instance='campus-db-primary', result='incident=classroom_outage,severity=high', created_at=now - timedelta(minutes=26)),
            OpsActionLog(action='apply_throttle', instance='campus-db-primary', result='limited classroom query burst to protect teaching traffic', created_at=now - timedelta(minutes=19)),
            OpsActionLog(action='switch_backup_link', instance='lab-network-b', result='backup uplink enabled, packet loss recovered', created_at=now - timedelta(minutes=14)),
            OpsActionLog(action='runbook_mark_all_done', instance='campus-db-primary', result='classroom outage playbook completed', created_at=now - timedelta(minutes=7)),
        ]
        db.add_all(ops_logs)

        # AI调用日志（用于AI助手统计）
        ai_logs = [
            AICallLog(scene='chat', engine='qwen', source='qwen_with_kb', fallback=False, latency_ms=2780, success=True, created_at=now - timedelta(minutes=33)),
            AICallLog(scene='chat', engine='rule', source='fallback_guide', fallback=True, latency_ms=6100, success=True, message='qwen timeout', created_at=now - timedelta(minutes=31)),
            AICallLog(scene='intake', engine='qwen', source='qwen', fallback=False, latency_ms=2430, success=True, created_at=now - timedelta(minutes=24)),
            AICallLog(scene='handover', engine='qwen', source='qwen', fallback=False, latency_ms=1980, success=True, created_at=now - timedelta(minutes=11)),
        ]
        db.add_all(ai_logs)

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

        # 慢查询样例（数据库诊断页）
        slow_queries = [
            SlowQuery(
                sql_fingerprint='SELECT * FROM course_attendance WHERE course_id=?',
                sql_text='SELECT * FROM course_attendance WHERE course_id = 2026 ORDER BY created_at DESC;',
                execution_time=2.438,
                lock_time=0.012,
                rows_sent=120,
                rows_examined=15840,
                database='campus_lab',
                timestamp=now - timedelta(minutes=30),
                query_time=2.438,
                client_ip='10.10.1.23',
                user='lab_reader',
            ),
            SlowQuery(
                sql_fingerprint='SELECT * FROM live_stream_logs WHERE event_id=?',
                sql_text='SELECT * FROM live_stream_logs WHERE event_id = 88 AND status = "retry";',
                execution_time=1.764,
                lock_time=0.007,
                rows_sent=45,
                rows_examined=9640,
                database='campus_activity',
                timestamp=now - timedelta(minutes=22),
                query_time=1.764,
                client_ip='10.10.3.17',
                user='club_service',
            ),
            SlowQuery(
                sql_fingerprint='SELECT * FROM projector_assets WHERE room_id=?',
                sql_text='SELECT * FROM projector_assets WHERE room_id = 402 AND status = "active";',
                execution_time=1.236,
                lock_time=0.004,
                rows_sent=18,
                rows_examined=3320,
                database='campus_teaching',
                timestamp=now - timedelta(minutes=15),
                query_time=1.236,
                client_ip='10.10.2.14',
                user='teaching_ops',
            ),
        ]
        db.add_all(slow_queries)

        # 性能快照（复盘页）
        snapshots = [
            PerformanceSnapshot(
                snapshot_name='class_peak_before_opt',
                qps=128.5,
                active_connections=96,
                slow_queries_count=24,
                avg_execution_time=1.92,
                metrics_data={'cpu_usage': 68, 'memory_usage': 74, 'disk_io': 58, 'connections': 96},
                created_at=now - timedelta(hours=2),
            ),
            PerformanceSnapshot(
                snapshot_name='class_peak_after_opt',
                qps=141.3,
                active_connections=81,
                slow_queries_count=13,
                avg_execution_time=1.21,
                metrics_data={'cpu_usage': 55, 'memory_usage': 66, 'disk_io': 44, 'connections': 81},
                created_at=now - timedelta(hours=1),
            ),
            PerformanceSnapshot(
                snapshot_name='club_event_evening',
                qps=117.6,
                active_connections=73,
                slow_queries_count=10,
                avg_execution_time=1.08,
                metrics_data={'cpu_usage': 49, 'memory_usage': 62, 'disk_io': 39, 'connections': 73},
                created_at=now - timedelta(minutes=35),
            ),
        ]
        db.add_all(snapshots)

        # 告警中心样例
        alerts = [
            Alert(
                alert_type='slow_query',
                severity='warning',
                title='慢查询数量升高',
                message='近5分钟慢查询数超过阈值，建议检查课堂高峰SQL。',
                threshold_value=10,
                current_value=18,
                status='active',
                created_at=now - timedelta(minutes=40),
            ),
            Alert(
                alert_type='connection_count',
                severity='critical',
                title='连接数接近上限',
                message='连接池压力偏高，建议限流并检查热点接口。',
                threshold_value=100,
                current_value=121,
                status='active',
                created_at=now - timedelta(minutes=28),
            ),
        ]
        db.add_all(alerts)

        # 应急协作中心留痕
        ops_logs = [
            OpsActionLog(action='generate_runbook', instance='机房B核心节点', result='incident=lab_offline,severity=high', created_at=now - timedelta(minutes=26)),
            OpsActionLog(action='switch_backup_network', instance='机房B核心节点', result='备用网络切换成功', created_at=now - timedelta(minutes=23)),
            OpsActionLog(action='notify_teacher_group', instance='3教402', result='已同步授课老师与教辅群', created_at=now - timedelta(minutes=20)),
            OpsActionLog(action='runbook_mark_all_done', instance='机房B核心节点', result='应急步骤全部完成', created_at=now - timedelta(minutes=15)),
        ]
        db.add_all(ops_logs)

        # AI调用日志（AI助手统计）
        ai_logs = [
            AICallLog(scene='chat', engine='qwen', source='qwen_with_kb', fallback=False, latency_ms=2200, success=True, message=None, created_at=now - timedelta(minutes=50)),
            AICallLog(scene='intake', engine='qwen', source='qwen', fallback=False, latency_ms=1800, success=True, message=None, created_at=now - timedelta(minutes=44)),
            AICallLog(scene='chat', engine='rule', source='fallback_guide', fallback=True, latency_ms=6100, success=True, message='qwen timeout fallback', created_at=now - timedelta(minutes=35)),
            AICallLog(scene='handover', engine='qwen', source='qwen', fallback=False, latency_ms=2500, success=True, message=None, created_at=now - timedelta(minutes=18)),
            AICallLog(scene='intake', engine='rule', source='rule_engine', fallback=True, latency_ms=120, success=True, message='llm disabled once', created_at=now - timedelta(minutes=12)),
        ]
        db.add_all(ai_logs)

        await db.commit()
        print('Demo data seeded successfully (tickets/knowledge/optimization/duty/ratings/slow_queries/snapshots/alerts/ops/ai_logs).')


if __name__ == '__main__':
    asyncio.run(seed())
