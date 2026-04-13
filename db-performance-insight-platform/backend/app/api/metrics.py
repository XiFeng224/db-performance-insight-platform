import random
from typing import Dict, Any

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.services.mysql_service import MySQLConnection
from app.services.alert_service import AlertService
from app.database import get_db
from app.config import settings
from app.utils.logger import api_logger

router = APIRouter(prefix="/api/metrics", tags=["metrics"])


def _safe_int(value: Any, default: int = 0) -> int:
    try:
        return int(float(value))
    except (TypeError, ValueError):
        return default


def _safe_float(value: Any, default: float = 0.0) -> float:
    try:
        return float(value)
    except (TypeError, ValueError):
        return default


def _build_degraded_metrics() -> Dict[str, Any]:
    """MySQL 不可用时的降级指标（保底可用，不中断页面）"""
    return {
        'qps': round(random.uniform(100, 500), 2),
        'cpu_usage': round(random.uniform(20, 80), 2),
        'memory_usage': round(random.uniform(30, 75), 2),
        'disk_io': round(random.uniform(10, 120), 2),
        'connections': random.randint(10, 50),
        'active_connections': random.randint(1, 10),
        'innodb': {
            'buffer_pool_reads': random.randint(1000, 10000),
            'buffer_pool_read_requests': random.randint(100000, 500000),
            'rows_read': random.randint(10000, 100000),
            'rows_inserted': random.randint(100, 1000),
            'rows_updated': random.randint(50, 500),
            'rows_deleted': random.randint(10, 100)
        },
        'uptime': random.randint(3600, 86400),
        'questions': random.randint(10000, 100000),
        'slow_queries': random.randint(0, 100),
        'degraded': True,
        'data_source': 'fallback_mock'
    }


@router.get("/database")
async def get_database_metrics(db: AsyncSession = Depends(get_db)) -> Dict[str, Any]:
    mysql = MySQLConnection()
    try:
        mysql.connect()

        status = mysql.get_status_variables()
        innodb = mysql.get_innodb_status()

        uptime = max(_safe_float(status.get('Uptime', 1), 1.0), 1.0)
        questions = _safe_float(status.get('Questions', 0), 0.0)
        qps = questions / uptime

        threads_connected = _safe_int(status.get('Threads_connected', 0), 0)
        threads_running = _safe_int(status.get('Threads_running', 0), 0)
        slow_queries = _safe_int(status.get('Slow_queries', 0), 0)

        # 简单估算系统指标（用于统一前端展示）
        buffer_pool_reads = _safe_float(innodb.get('buffer_pool_reads', 0), 0.0)
        buffer_pool_read_requests = max(_safe_float(innodb.get('buffer_pool_read_requests', 1), 1.0), 1.0)
        cache_miss_ratio = min(1.0, max(0.0, buffer_pool_reads / buffer_pool_read_requests))

        cpu_usage = min(95.0, 15.0 + threads_running * 4.0 + cache_miss_ratio * 40.0)
        memory_usage = min(95.0, 20.0 + threads_connected * 0.8)
        disk_io = min(1000.0, 5.0 + buffer_pool_reads * 0.02)

        metrics_data = {
            'qps': round(qps, 2),
            'cpu_usage': round(cpu_usage, 2),
            'memory_usage': round(memory_usage, 2),
            'disk_io': round(disk_io, 2),
            'connections': threads_connected,
            'active_connections': threads_running,
            'innodb': innodb,
            'uptime': _safe_int(status.get('Uptime', 0), 0),
            'questions': _safe_int(status.get('Questions', 0), 0),
            'slow_queries': slow_queries,
            'degraded': False,
            'data_source': 'mysql_status'
        }

        if settings.alert_enabled:
            alert_service = AlertService(db)
            await alert_service.check_and_create_alerts(metrics_data)

        return metrics_data
    except Exception as e:
        api_logger.warning(f"MySQL metrics unavailable, fallback to degraded metrics: {e}")
        return _build_degraded_metrics()
    finally:
        mysql.disconnect()


@router.get("/tables")
async def get_table_metrics() -> Dict[str, Any]:
    mysql = MySQLConnection()
    try:
        mysql.connect()
        tables = mysql.get_table_info()

        table_metrics = []
        for table in tables:
            table_metrics.append({
                'name': table['Name'],
                'rows': table['Rows'],
                'data_length': table['Data_length'],
                'index_length': table['Index_length'],
                'engine': table['Engine']
            })

        return {
            'tables': table_metrics,
            'total_tables': len(table_metrics),
            'degraded': False,
            'data_source': 'mysql_status'
        }
    except Exception as e:
        api_logger.error(f"Error fetching table metrics: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="获取表指标失败")
    finally:
        mysql.disconnect()


@router.get("/status")
async def get_database_status() -> Dict[str, Any]:
    mysql = MySQLConnection()
    try:
        mysql.connect()
        status = mysql.get_status_variables()
        slow_log = mysql.get_slow_query_log_status()

        return {
            'version': status.get('version', ''),
            'slow_query_log': slow_log,
            'connections': {
                'max_connections': _safe_int(status.get('Max_used_connections', 0), 0),
                'current_connections': _safe_int(status.get('Threads_connected', 0), 0),
                'running_queries': _safe_int(status.get('Threads_running', 0), 0)
            },
            'degraded': False,
            'data_source': 'mysql_status'
        }
    except Exception as e:
        api_logger.error(f"Error fetching database status: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="获取数据库状态失败")
    finally:
        mysql.disconnect()
