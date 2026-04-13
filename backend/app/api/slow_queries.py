from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List, Optional
from pydantic import BaseModel, Field, validator
from app.database import get_db
from app.services.slow_query_service import SlowQueryService
from app.models.database import SlowQuery
from app.utils.logger import api_logger

router = APIRouter(prefix="/api/slow-queries", tags=["slow-queries"])


class SlowQueryCreate(BaseModel):
    sql: str = Field(..., min_length=1, description="SQL查询语句")
    execution_time: float = Field(..., ge=0, description="执行时间（秒）")
    lock_time: float = Field(0.0, ge=0, description="锁等待时间（秒）")
    rows_sent: int = Field(0, ge=0, description="返回行数")
    rows_examined: int = Field(0, ge=0, description="扫描行数")
    database: str = Field("", description="数据库名")
    query_time: float = Field(0.0, ge=0, description="查询总时间（秒）")
    client_ip: str = Field("", description="客户端IP")
    user: str = Field("", description="用户名")

    @validator('sql')
    def validate_sql(cls, v):
        if not v or not v.strip():
            raise ValueError('SQL语句不能为空')
        return v.strip()


class SlowQueryResponse(BaseModel):
    id: int
    sql_fingerprint: str
    sql_text: str
    execution_time: float
    lock_time: float
    rows_sent: int
    rows_examined: int
    database: str
    timestamp: str
    query_time: float
    client_ip: str
    user: str


@router.post("/", response_model=SlowQueryResponse)
async def create_slow_query(
    query_data: SlowQueryCreate,
    db: AsyncSession = Depends(get_db)
):
    try:
        api_logger.info(f"Creating slow query: {query_data.sql[:100]}...")
        service = SlowQueryService(db)
        query = await service.add_slow_query(query_data.dict())
        api_logger.info(f"Slow query created with ID: {query.id}")
        return SlowQueryResponse(**query.to_dict())
    except Exception as e:
        api_logger.error(f"Error creating slow query: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"创建慢查询记录失败: {str(e)}")


@router.get("/", response_model=List[SlowQueryResponse])
async def get_slow_queries(
    skip: int = Query(0, ge=0, description="跳过记录数"),
    limit: int = Query(100, ge=1, le=1000, description="返回记录数"),
    database: Optional[str] = Query(None, description="数据库名过滤"),
    min_execution_time: Optional[float] = Query(None, ge=0, description="最小执行时间（秒）"),
    db: AsyncSession = Depends(get_db)
):
    try:
        api_logger.info(f"Fetching slow queries: skip={skip}, limit={limit}, database={database}")
        service = SlowQueryService(db)
        queries = await service.get_slow_queries(skip, limit, database, min_execution_time)
        return [SlowQueryResponse(**q.to_dict()) for q in queries]
    except Exception as e:
        api_logger.error(f"Error fetching slow queries: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"获取慢查询列表失败: {str(e)}")


@router.get("/{query_id}", response_model=SlowQueryResponse)
async def get_slow_query(
    query_id: int,
    db: AsyncSession = Depends(get_db)
):
    service = SlowQueryService(db)
    query = await service.get_slow_query_by_id(query_id)
    if not query:
        raise HTTPException(status_code=404, detail="Slow query not found")
    return SlowQueryResponse(**query.to_dict())


@router.get("/stats/summary")
async def get_slow_query_stats(db: AsyncSession = Depends(get_db)):
    try:
        service = SlowQueryService(db)
        stats = await service.get_slow_query_stats()
        return stats
    except Exception as e:
        api_logger.error(f"Error fetching slow query stats: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"获取统计信息失败: {str(e)}")


@router.get("/clusters/top")
async def get_top_clusters(
    top_n: int = 10,
    db: AsyncSession = Depends(get_db)
):
    service = SlowQueryService(db)
    clusters = await service.get_query_clusters(top_n)
    return clusters
