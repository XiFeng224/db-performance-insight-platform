from fastapi import APIRouter
from typing import Dict, Any
import random

# 仅用于离线演示/开发测试，避免与真实 /api/metrics 路由冲突
router = APIRouter(prefix="/api/mock/metrics", tags=["metrics-mock"])


@router.get("/database")
async def get_database_metrics() -> Dict[str, Any]:
    return {
        'qps': round(random.uniform(100, 500), 2),
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
        'slow_queries': random.randint(0, 100)
    }


@router.get("/tables")
async def get_table_metrics() -> Dict[str, Any]:
    tables = ['users', 'orders', 'products', 'categories', 'reviews']
    table_metrics = []
    
    for table in tables:
        table_metrics.append({
            'name': table,
            'rows': random.randint(1000, 100000),
            'data_length': random.randint(1024, 1048576),
            'index_length': random.randint(512, 524288),
            'engine': 'InnoDB'
        })
    
    return {
        'tables': table_metrics,
        'total_tables': len(table_metrics)
    }


@router.get("/status")
async def get_database_status() -> Dict[str, Any]:
    return {
        'version': '8.0.35',
        'slow_query_log': {
            'slow_query_log': 'ON',
            'slow_query_log_file': '/var/log/mysql/slow.log',
            'long_query_time': '1.0'
        },
        'connections': {
            'max_connections': 151,
            'current_connections': random.randint(10, 50),
            'running_queries': random.randint(1, 10)
        }
    }
