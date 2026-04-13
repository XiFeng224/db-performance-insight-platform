from datetime import datetime
from typing import Any, Dict, List

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.database import PerformanceSnapshot, SlowQuery

router = APIRouter(prefix="/api/comparison", tags=["comparison"])


def _to_float(value: Any, default: float = 0.0) -> float:
    try:
        if value is None:
            return default
        return float(value)
    except (TypeError, ValueError):
        return default


def _calc_change(a: float, b: float) -> float:
    if a == 0 and b == 0:
        return 0.0
    if a == 0:
        return 100.0
    return ((b - a) / a) * 100.0


def _trend(change: float) -> str:
    if change > 0:
        return "up"
    if change < 0:
        return "down"
    return "flat"


async def _avg_snapshot_metrics(db: AsyncSession, start: datetime, end: datetime) -> Dict[str, float]:
    stmt = select(PerformanceSnapshot).where(
        PerformanceSnapshot.created_at >= start,
        PerformanceSnapshot.created_at <= end,
    )
    result = await db.execute(stmt)
    rows: List[PerformanceSnapshot] = list(result.scalars().all())

    if not rows:
        return {
            "qps": 0.0,
            "cpu_usage": 0.0,
            "memory_usage": 0.0,
            "disk_io": 0.0,
            "connections": 0.0,
            "slow_query_count": 0.0,
            "count": 0,
        }

    total = {
        "qps": 0.0,
        "cpu_usage": 0.0,
        "memory_usage": 0.0,
        "disk_io": 0.0,
        "connections": 0.0,
        "slow_query_count": 0.0,
    }

    for row in rows:
        data = row.metrics_data or {}
        total["qps"] += _to_float(getattr(row, "qps", 0.0), 0.0)
        total["cpu_usage"] += _to_float(data.get("cpu_usage"), 0.0)
        total["memory_usage"] += _to_float(data.get("memory_usage"), 0.0)
        total["disk_io"] += _to_float(data.get("disk_io"), 0.0)
        total["connections"] += _to_float(getattr(row, "active_connections", 0.0), 0.0)
        total["slow_query_count"] += _to_float(getattr(row, "slow_queries_count", 0.0), 0.0)

    n = float(len(rows))
    return {
        "qps": total["qps"] / n,
        "cpu_usage": total["cpu_usage"] / n,
        "memory_usage": total["memory_usage"] / n,
        "disk_io": total["disk_io"] / n,
        "connections": total["connections"] / n,
        "slow_query_count": total["slow_query_count"] / n,
        "count": int(n),
    }


async def _avg_slow_query_metrics(db: AsyncSession, start: datetime, end: datetime) -> Dict[str, float]:
    stmt = select(SlowQuery).where(SlowQuery.timestamp >= start, SlowQuery.timestamp <= end)
    result = await db.execute(stmt)
    rows: List[SlowQuery] = list(result.scalars().all())

    if not rows:
        return {
            "qps": 0.0,
            "cpu_usage": 0.0,
            "memory_usage": 0.0,
            "disk_io": 0.0,
            "connections": 0.0,
            "slow_query_count": 0.0,
            "count": 0,
        }

    duration_sec = max((end - start).total_seconds(), 1.0)
    avg_exec = sum(_to_float(r.execution_time, 0.0) for r in rows) / len(rows)
    avg_rows_examined = sum(_to_float(r.rows_examined, 0.0) for r in rows) / len(rows)

    return {
        "qps": len(rows) / duration_sec,
        "cpu_usage": min(95.0, avg_exec * 20.0),
        "memory_usage": min(95.0, avg_rows_examined / 10000.0),
        "disk_io": min(1000.0, avg_rows_examined / 2000.0),
        "connections": 0.0,
        "slow_query_count": float(len(rows)),
        "count": len(rows),
    }


@router.get("/metrics")
async def compare_metrics(
    period1_start: str = Query(...),
    period1_end: str = Query(...),
    period2_start: str = Query(...),
    period2_end: str = Query(...),
    db: AsyncSession = Depends(get_db),
):
    try:
        p1s = datetime.fromisoformat(period1_start.replace("Z", "+00:00"))
        p1e = datetime.fromisoformat(period1_end.replace("Z", "+00:00"))
        p2s = datetime.fromisoformat(period2_start.replace("Z", "+00:00"))
        p2e = datetime.fromisoformat(period2_end.replace("Z", "+00:00"))
    except ValueError:
        raise HTTPException(status_code=400, detail="时间参数格式错误，请使用 ISO8601")

    if p1s >= p1e or p2s >= p2e:
        raise HTTPException(status_code=400, detail="时间区间无效：start 必须早于 end")

    p1_snapshot = await _avg_snapshot_metrics(db, p1s, p1e)
    p2_snapshot = await _avg_snapshot_metrics(db, p2s, p2e)

    # 若没有快照数据，回退到慢查询近似指标，保证接口可用
    if p1_snapshot["count"] == 0 and p2_snapshot["count"] == 0:
        p1 = await _avg_slow_query_metrics(db, p1s, p1e)
        p2 = await _avg_slow_query_metrics(db, p2s, p2e)
        comparison_data_source = "slow_query_fallback"
        degraded = True
    else:
        p1 = p1_snapshot
        p2 = p2_snapshot
        comparison_data_source = "performance_snapshots"
        degraded = False

    metrics = ["qps", "cpu_usage", "memory_usage", "disk_io", "connections", "slow_query_count"]

    response: Dict[str, Any] = {
        "data_source": comparison_data_source,
        "degraded": degraded,
        "period1": {
            "start": period1_start,
            "end": period1_end,
            "count": int(p1.get("count", 0)),
            "averages": {k: _to_float(p1.get(k), 0.0) for k in metrics},
        },
        "period2": {
            "start": period2_start,
            "end": period2_end,
            "count": int(p2.get("count", 0)),
            "averages": {k: _to_float(p2.get(k), 0.0) for k in metrics},
        },
    }

    for metric in metrics:
        change = _calc_change(_to_float(p1.get(metric), 0.0), _to_float(p2.get(metric), 0.0))
        response[f"{metric}_change"] = change
        response[f"{metric}_trend"] = _trend(change)

    return response
