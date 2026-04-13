from datetime import datetime, timedelta
from typing import Any, Dict, List

from fastapi import APIRouter, Body, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.database import OpsActionLog
from app.services.mysql_service import MySQLConnection
from app.utils.logger import api_logger

router = APIRouter(prefix="/api/ops", tags=["ops"])


def _safe_int(value: Any, default: int = 0) -> int:
    try:
        return int(float(value))
    except (TypeError, ValueError):
        return default


@router.get("/instances")
async def list_instances() -> Dict[str, Any]:
    """实例中心：当前先返回单实例，可扩展为多实例注册表"""
    mysql = MySQLConnection()
    try:
        mysql.connect()
        status = mysql.get_status_variables()
        instances = [
            {
                "instance_id": "local-mysql-1",
                "name": "MySQL-Primary",
                "engine": "MySQL",
                "version": status.get("version", "8.0"),
                "status": "online",
                "connections": _safe_int(status.get("Threads_connected", 0)),
                "qps_estimate": round(
                    _safe_int(status.get("Questions", 0)) / max(_safe_int(status.get("Uptime", 1), 1), 1),
                    2,
                ),
                "env": "prod",
                "biz_line": "core-order",
                "criticality": "high",
                "tags": ["primary", "payment", "core"],
            }
        ]
        return {
            "instances": instances,
            "count": len(instances),
            "group_summary": {
                "by_env": {"prod": len(instances)},
                "by_criticality": {"high": len(instances)},
            },
            "data_source": "mysql_status",
        }
    except Exception as e:
        api_logger.warning(f"Failed to load instances from mysql: {e}")
        instances = [
            {
                "instance_id": "demo-instance-1",
                "name": "Demo-MySQL",
                "engine": "MySQL",
                "version": "8.0",
                "status": "degraded",
                "connections": 0,
                "qps_estimate": 0,
                "env": "test",
                "biz_line": "demo",
                "criticality": "medium",
                "tags": ["demo", "fallback"],
            }
        ]
        return {
            "instances": instances,
            "count": len(instances),
            "group_summary": {
                "by_env": {"test": len(instances)},
                "by_criticality": {"medium": len(instances)},
            },
            "data_source": "fallback_demo",
        }
    finally:
        mysql.disconnect()


@router.post("/change-risk/assess")
async def assess_change_risk(payload: Dict[str, Any] = Body(...)) -> Dict[str, Any]:
    """变更风险评估（DDL/索引变更）"""
    sql = str(payload.get("sql") or "").strip()
    change_type = str(payload.get("change_type") or "ddl").lower()
    if not sql:
        return {
            "risk_level": "high",
            "score": 90,
            "reasons": ["SQL 为空，无法评估"],
            "guards": ["请提供完整 DDL/变更语句"],
            "estimated_impact": {
                "write_latency_increase_pct": 0,
                "read_gain_pct": 0,
                "lock_risk": "unknown",
            },
        }

    sql_u = sql.upper()
    score = 20
    reasons: List[str] = []
    guards: List[str] = []

    if "DROP" in sql_u:
        score += 40
        reasons.append("包含 DROP 操作，存在高风险数据/结构影响")
        guards.append("必须先备份并在影子环境验证")

    if "ALTER TABLE" in sql_u:
        score += 20
        reasons.append("ALTER TABLE 可能触发表重建与锁等待")
        guards.append("建议在低峰期执行并评估锁影响")

    if "ADD INDEX" in sql_u or "CREATE INDEX" in sql_u:
        score += 15
        reasons.append("新增索引会增加写放大")
        guards.append("校验索引冗余并评估写入成本")

    if "UNIQUE" in sql_u:
        score += 10
        reasons.append("唯一约束可能导致写入冲突与回滚")
        guards.append("确认历史脏数据清理策略")

    if len(sql) > 200:
        score += 5
        reasons.append("语句较长，变更复杂度较高")

    score = min(100, score)
    if score >= 75:
        risk_level = "high"
    elif score >= 45:
        risk_level = "medium"
    else:
        risk_level = "low"

    read_gain = 12 if ("INDEX" in sql_u and change_type in ["index", "ddl"]) else 3
    write_cost = 8 if "INDEX" in sql_u else 2
    lock_risk = "high" if "ALTER TABLE" in sql_u else "medium" if "INDEX" in sql_u else "low"

    return {
        "risk_level": risk_level,
        "score": score,
        "change_type": change_type,
        "reasons": reasons or ["未检测到高风险关键词，建议按标准流程灰度变更"],
        "guards": guards or ["建议先在测试环境回放并准备回滚脚本"],
        "estimated_impact": {
            "write_latency_increase_pct": write_cost,
            "read_gain_pct": read_gain,
            "lock_risk": lock_risk,
        },
    }


@router.get("/workload-profile")
async def get_workload_profile() -> Dict[str, Any]:
    """工作负载画像：读写占比、热点表、SQL模式分布"""
    mysql = MySQLConnection()
    try:
        mysql.connect()
        processlist = mysql.get_processlist()

        read_count = 0
        write_count = 0
        patterns = {"select": 0, "join": 0, "order_by": 0, "group_by": 0}
        table_hotspots: Dict[str, int] = {}

        for p in processlist:
            sql = str(p.get("Info") or "").strip().lower()
            if not sql:
                continue
            if sql.startswith("select"):
                read_count += 1
            elif sql.startswith(("insert", "update", "delete", "replace")):
                write_count += 1

            if " join " in sql:
                patterns["join"] += 1
            if " order by " in sql:
                patterns["order_by"] += 1
            if " group by " in sql:
                patterns["group_by"] += 1
            if sql.startswith("select"):
                patterns["select"] += 1

            for t in ["users", "orders", "products", "categories", "reviews"]:
                if t in sql:
                    table_hotspots[t] = table_hotspots.get(t, 0) + 1

        total = max(1, read_count + write_count)
        workload_type = "oltp" if read_count / total > 0.65 else "mixed"

        hotspots = [
            {"table": k, "hits": v}
            for k, v in sorted(table_hotspots.items(), key=lambda x: x[1], reverse=True)
        ]

        return {
            "workload_type": workload_type,
            "read_ratio": round(read_count / total, 3),
            "write_ratio": round(write_count / total, 3),
            "patterns": patterns,
            "hotspots": hotspots[:10],
            "sample_size": len(processlist),
            "data_source": "processlist",
        }
    except Exception as e:
        api_logger.warning(f"Failed to build workload profile: {e}")
        return {
            "workload_type": "unknown",
            "read_ratio": 0.0,
            "write_ratio": 0.0,
            "patterns": {"select": 0, "join": 0, "order_by": 0, "group_by": 0},
            "hotspots": [],
            "sample_size": 0,
            "data_source": "fallback_demo",
        }
    finally:
        mysql.disconnect()


@router.get("/capacity/baseline")
async def get_capacity_baseline() -> Dict[str, Any]:
    """容量基线与7天预测（轻量版本）"""
    mysql = MySQLConnection()
    try:
        mysql.connect()
        status = mysql.get_status_variables()

        uptime = max(_safe_int(status.get("Uptime", 1), 1), 1)
        questions = _safe_int(status.get("Questions", 0), 0)
        current_qps = round(questions / uptime, 2)
        current_conn = _safe_int(status.get("Threads_connected", 0), 0)

        base_storage = 50.0  # 轻量估算值，后续可接入 information_schema

        baseline = []
        now = datetime.utcnow().date()
        for i in range(7):
            d = now - timedelta(days=6 - i)
            baseline.append(
                {
                    "date": d.isoformat(),
                    "qps": round(max(1.0, current_qps * (0.9 + i * 0.01)), 2),
                    "connections": max(1, int(current_conn * (0.9 + i * 0.015))),
                    "storage_used_gb": round(base_storage * (0.98 + i * 0.005), 2),
                }
            )

        forecast_7d = []
        for i in range(1, 8):
            forecast_7d.append(
                {
                    "day_offset": i,
                    "predicted_qps": round(current_qps * (1 + i * 0.03), 2),
                    "predicted_connections": max(1, int(current_conn * (1 + i * 0.025))),
                    "predicted_storage_gb": round(base_storage * (1 + i * 0.02), 2),
                }
            )

        qps_risk = "high" if forecast_7d[-1]["predicted_qps"] > current_qps * 1.5 else "medium" if forecast_7d[-1]["predicted_qps"] > current_qps * 1.25 else "low"
        conn_risk = "high" if forecast_7d[-1]["predicted_connections"] > 200 else "medium" if forecast_7d[-1]["predicted_connections"] > 120 else "low"
        storage_risk = "high" if forecast_7d[-1]["predicted_storage_gb"] > 200 else "medium" if forecast_7d[-1]["predicted_storage_gb"] > 120 else "low"

        overall = "high" if "high" in [qps_risk, conn_risk, storage_risk] else "medium" if "medium" in [qps_risk, conn_risk, storage_risk] else "low"

        return {
            "baseline": baseline,
            "forecast_7d": forecast_7d,
            "capacity_risk": {
                "qps": qps_risk,
                "connections": conn_risk,
                "storage": storage_risk,
                "overall": overall,
            },
            "data_source": "mysql_status_estimated",
        }
    except Exception as e:
        api_logger.warning(f"Failed to build capacity baseline: {e}")
        return {
            "baseline": [],
            "forecast_7d": [],
            "capacity_risk": {"qps": "unknown", "connections": "unknown", "storage": "unknown", "overall": "unknown"},
            "data_source": "fallback_demo",
        }
    finally:
        mysql.disconnect()


@router.post("/runbook/generate")
async def generate_runbook(payload: Dict[str, Any] = Body(...)) -> Dict[str, Any]:
    """自动化处置剧本：按异常类型生成分步排障方案"""
    incident_type = str(payload.get("incident_type") or "general_performance").lower()
    severity = str(payload.get("severity") or "medium").lower()

    runbooks: Dict[str, Dict[str, Any]] = {
        "lock_wait": {
            "title": "锁等待与阻塞链处置",
            "steps": [
                "确认阻塞链：SHOW PROCESSLIST / information_schema.innodb_trx",
                "识别阻塞源 SQL 与会话用户，判断是否可中断",
                "优先终止低优先级长事务（必要时 KILL QUERY）",
                "回放业务请求，确认等待时间恢复",
                "复盘并补充索引/事务粒度优化",
            ],
            "commands": [
                "SHOW PROCESSLIST;",
                "SELECT * FROM information_schema.innodb_trx;",
                "KILL QUERY <blocking_query_id>;",
            ],
            "rollback": [
                "若误杀关键会话，通知应用侧重试并临时扩容连接池",
                "回滚临时限流策略",
            ],
        },
        "cpu_spike": {
            "title": "CPU 突增处置",
            "steps": [
                "定位热点 SQL（按执行次数/总耗时排序）",
                "检查执行计划是否退化（全表扫描/临时表）",
                "应用限流与读写隔离策略，缓解高峰",
                "验证 CPU 回落与 QPS 恢复",
                "固化索引与SQL改写方案",
            ],
            "commands": [
                "SHOW PROCESSLIST;",
                "EXPLAIN <hot_sql>;",
                "SHOW GLOBAL STATUS LIKE 'Threads_running';",
            ],
            "rollback": [
                "撤销临时限流参数",
                "恢复变更前索引策略（如有）",
            ],
        },
        "slow_query_burst": {
            "title": "慢查询激增处置",
            "steps": [
                "筛选高频慢SQL指纹并分组",
                "优先处理高影响SQL（耗时×频次）",
                "对TOP SQL进行索引补全与改写验证",
                "观察慢查询计数与P95变化",
                "形成长期优化清单",
            ],
            "commands": [
                "SELECT * FROM slow_queries ORDER BY execution_time DESC LIMIT 20;",
                "EXPLAIN <slow_sql>;",
            ],
            "rollback": [
                "撤销高风险索引变更",
                "恢复旧查询模板（若新SQL有回归）",
            ],
        },
    }

    selected = runbooks.get(incident_type, {
        "title": "通用性能事件处置",
        "steps": [
            "确认异常指标与影响范围",
            "定位相关SQL/会话/锁等待",
            "执行低风险缓解动作（限流/扩容/降级）",
            "验证指标回归",
            "输出复盘记录",
        ],
        "commands": ["SHOW PROCESSLIST;", "SHOW GLOBAL STATUS;"],
        "rollback": ["撤销临时策略并恢复默认配置"],
    })

    return {
        "incident_type": incident_type,
        "severity": severity,
        "runbook": selected,
        "sla_guard": {
            "max_step_minutes": 10 if severity == "high" else 20,
            "owner": "dba_oncall",
        },
        "data_source": "rule_engine_v1",
    }


@router.post("/action-log")
async def create_action_log(payload: Dict[str, Any] = Body(...), db: AsyncSession = Depends(get_db)) -> Dict[str, Any]:
    action = str(payload.get("action") or "unknown")
    instance = str(payload.get("instance") or "") or None
    result = str(payload.get("result") or "")[:500]

    log = OpsActionLog(action=action, instance=instance, result=result)
    db.add(log)
    await db.commit()
    await db.refresh(log)
    return {"ok": True, "log": log.to_dict()}


@router.get("/action-log")
async def list_action_logs(
    limit: int = 20,
    action: str = "",
    instance: str = "",
    time_range: str = "all",
    db: AsyncSession = Depends(get_db),
) -> Dict[str, Any]:
    stmt = select(OpsActionLog)

    if action:
        stmt = stmt.where(OpsActionLog.action == action)
    if instance and instance != "-":
        stmt = stmt.where(OpsActionLog.instance == instance)

    if time_range in ["1h", "24h", "7d"]:
        now = datetime.utcnow()
        hours = 1 if time_range == "1h" else 24 if time_range == "24h" else 24 * 7
        stmt = stmt.where(OpsActionLog.created_at >= now - timedelta(hours=hours))

    stmt = stmt.order_by(OpsActionLog.created_at.desc()).limit(max(1, min(limit, 200)))
    result = await db.execute(stmt)
    rows = result.scalars().all()
    return {"items": [r.to_dict() for r in rows], "count": len(rows)}


@router.get("/session-locks")
async def get_session_locks() -> Dict[str, Any]:
    """会话与锁诊断：基于 processlist 的轻量阻塞视图"""
    mysql = MySQLConnection()
    try:
        mysql.connect()
        processlist = mysql.get_processlist()

        sessions: List[Dict[str, Any]] = []
        blockers: List[Dict[str, Any]] = []

        for p in processlist:
            cmd = str(p.get("Command") or "")
            state = str(p.get("State") or "")
            info = str(p.get("Info") or "")
            t = _safe_int(p.get("Time", 0))

            session = {
                "id": p.get("Id"),
                "user": p.get("User"),
                "db": p.get("db") or p.get("DB") or "",
                "command": cmd,
                "state": state,
                "time": t,
                "sql": info[:200],
            }
            sessions.append(session)

            if "lock" in state.lower() or "waiting" in state.lower() or t >= 30:
                blockers.append(
                    {
                        "session_id": p.get("Id"),
                        "reason": state or "long_running",
                        "duration_sec": t,
                        "user": p.get("User"),
                    }
                )

        blockers = sorted(blockers, key=lambda x: x["duration_sec"], reverse=True)
        return {
            "sessions": sessions[:100],
            "blockers": blockers[:20],
            "summary": {
                "total_sessions": len(sessions),
                "suspected_blockers": len(blockers),
                "high_risk": sum(1 for b in blockers if b["duration_sec"] >= 120),
            },
            "data_source": "processlist",
        }
    except Exception as e:
        api_logger.warning(f"Failed to load session locks: {e}")
        return {
            "sessions": [],
            "blockers": [],
            "summary": {"total_sessions": 0, "suspected_blockers": 0, "high_risk": 0},
            "data_source": "fallback_demo",
        }
    finally:
        mysql.disconnect()
