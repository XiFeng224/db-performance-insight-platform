from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import get_db
from app.services.sql_scorer import SQLPerformanceScorer
from app.services.slow_query_service import SlowQueryService
from app.services.execution_plan_service import ExecutionPlanService
from app.services.mysql_service import MySQLConnection
from app.utils.logger import api_logger

router = APIRouter(prefix="/api/scoring", tags=["scoring"])


@router.post("/sql/{query_id}")
async def score_sql(
    query_id: int,
    db: AsyncSession = Depends(get_db)
):
    """对SQL进行性能评分"""
    try:
        # 获取慢查询
        slow_query_service = SlowQueryService(db)
        query = await slow_query_service.get_slow_query_by_id(query_id)
        
        if not query:
            raise HTTPException(status_code=404, detail="慢查询不存在")
        
        # 获取执行计划问题
        execution_plan_service = ExecutionPlanService(db)
        plan = await execution_plan_service.get_execution_plan(query_id)
        plan_issues = []
        
        if plan and plan.plan_json:
            plan_issues = execution_plan_service.analyze_execution_plan(plan.plan_json)
        
        # 进行评分
        score_result = SQLPerformanceScorer.score_sql(
            sql=query.sql_text,
            execution_time=query.execution_time,
            rows_examined=query.rows_examined,
            rows_sent=query.rows_sent,
            execution_plan_issues=plan_issues
        )
        
        return score_result
    except HTTPException:
        raise
    except Exception as e:
        api_logger.error(f"Error scoring SQL: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"SQL评分失败: {str(e)}")
