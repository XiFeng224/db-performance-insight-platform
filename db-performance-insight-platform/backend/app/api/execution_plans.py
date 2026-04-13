from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Optional
from pydantic import BaseModel
from app.database import get_db
from app.services.execution_plan_service import ExecutionPlanService
from app.services.mysql_service import MySQLConnection

router = APIRouter(prefix="/api/execution-plans", tags=["execution-plans"])


class ExecutionPlanRequest(BaseModel):
    sql: str


@router.post("/analyze")
async def analyze_execution_plan(
    request: ExecutionPlanRequest,
    db: AsyncSession = Depends(get_db)
):
    mysql = MySQLConnection()
    try:
        mysql.connect()
        plan_json = mysql.explain_query(request.sql)
        
        service = ExecutionPlanService(db)
        
        visualization = service.visualize_execution_plan(plan_json)
        issues = service.analyze_execution_plan(plan_json)
        
        return {
            'plan_json': plan_json,
            'visualization': visualization,
            'issues': issues
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        mysql.disconnect()


@router.get("/visualize/{query_id}")
async def visualize_plan(
    query_id: int,
    db: AsyncSession = Depends(get_db)
):
    service = ExecutionPlanService(db)
    plan = await service.get_execution_plan(query_id)
    
    if not plan:
        raise HTTPException(status_code=404, detail="Execution plan not found")
    
    visualization = service.visualize_execution_plan(plan.plan_json)
    issues = service.analyze_execution_plan(plan.plan_json)
    
    return {
        'visualization': visualization,
        'issues': issues,
        'plan_text': plan.plan_text
    }
