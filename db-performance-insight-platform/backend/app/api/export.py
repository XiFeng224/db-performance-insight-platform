from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import get_db
from app.services.slow_query_service import SlowQueryService
from app.utils.logger import api_logger
import csv
import io
from typing import Optional

router = APIRouter(prefix="/api/export", tags=["export"])


@router.get("/slow-queries/csv")
async def export_slow_queries_csv(
    database: Optional[str] = None,
    limit: int = 1000,
    db: AsyncSession = Depends(get_db)
):
    """导出慢查询为CSV格式"""
    try:
        api_logger.info(f"Exporting slow queries to CSV: database={database}, limit={limit}")
        service = SlowQueryService(db)
        queries = await service.get_slow_queries(0, limit, database, None)
        
        output = io.StringIO()
        writer = csv.writer(output)
        
        # 写入表头
        writer.writerow([
            'ID', 'SQL指纹', 'SQL语句', '执行时间(秒)', '锁时间(秒)',
            '返回行数', '扫描行数', '数据库', '查询时间(秒)', '客户端IP', '用户', '时间戳'
        ])
        
        # 写入数据
        for query in queries:
            writer.writerow([
                query.id,
                query.sql_fingerprint,
                query.sql_text,
                query.execution_time,
                query.lock_time,
                query.rows_sent,
                query.rows_examined,
                query.database,
                query.query_time,
                query.client_ip,
                query.user,
                query.timestamp.isoformat() if hasattr(query.timestamp, 'isoformat') else str(query.timestamp)
            ])
        
        output.seek(0)
        
        return StreamingResponse(
            iter([output.getvalue()]),
            media_type="text/csv",
            headers={
                "Content-Disposition": f"attachment; filename=slow_queries_{database or 'all'}.csv"
            }
        )
    except Exception as e:
        api_logger.error(f"Error exporting slow queries: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"导出失败: {str(e)}")
