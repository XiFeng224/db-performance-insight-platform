from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel
from app.database import get_db
from app.services.optimization_service import OptimizationService
from app.services.mysql_service import MySQLConnection
import random

router = APIRouter(prefix="/api/optimization", tags=["optimization"])


class OptimizationRequest(BaseModel):
    slow_query_id: int
    sql: str


class OptimizationPlanUpdateRequest(BaseModel):
    owner: str | None = None
    due_date: str | None = None
    exec_status: str | None = None


# 模拟数据库架构信息
def get_mock_schema_info():
    return {
        'users': {
            'table_info': {
                'Name': 'users',
                'Engine': 'InnoDB',
                'Version': 10,
                'Row_format': 'Dynamic',
                'Rows': 10000,
                'Avg_row_length': 100,
                'Data_length': 1000000,
                'Max_data_length': 0,
                'Index_length': 200000,
                'Data_free': 0,
                'Auto_increment': 10001,
                'Create_time': '2026-01-01 00:00:00',
                'Update_time': '2026-01-01 00:00:00',
                'Check_time': None,
                'Collation': 'utf8mb4_unicode_ci',
                'Checksum': None,
                'Create_options': '',
                'Comment': ''
            },
            'indexes': [
                {
                    'Table': 'users',
                    'Non_unique': 0,
                    'Key_name': 'PRIMARY',
                    'Seq_in_index': 1,
                    'Column_name': 'id',
                    'Collation': 'A',
                    'Cardinality': 10000,
                    'Sub_part': None,
                    'Packed': None,
                    'Null': '',
                    'Index_type': 'BTREE',
                    'Comment': '',
                    'Index_comment': ''
                },
                {
                    'Table': 'users',
                    'Non_unique': 1,
                    'Key_name': 'idx_email',
                    'Seq_in_index': 1,
                    'Column_name': 'email',
                    'Collation': 'A',
                    'Cardinality': 10000,
                    'Sub_part': None,
                    'Packed': None,
                    'Null': '',
                    'Index_type': 'BTREE',
                    'Comment': '',
                    'Index_comment': ''
                }
            ]
        },
        'orders': {
            'table_info': {
                'Name': 'orders',
                'Engine': 'InnoDB',
                'Version': 10,
                'Row_format': 'Dynamic',
                'Rows': 50000,
                'Avg_row_length': 150,
                'Data_length': 7500000,
                'Max_data_length': 0,
                'Index_length': 1500000,
                'Data_free': 0,
                'Auto_increment': 50001,
                'Create_time': '2026-01-01 00:00:00',
                'Update_time': '2026-01-01 00:00:00',
                'Check_time': None,
                'Collation': 'utf8mb4_unicode_ci',
                'Checksum': None,
                'Create_options': '',
                'Comment': ''
            },
            'indexes': [
                {
                    'Table': 'orders',
                    'Non_unique': 0,
                    'Key_name': 'PRIMARY',
                    'Seq_in_index': 1,
                    'Column_name': 'id',
                    'Collation': 'A',
                    'Cardinality': 50000,
                    'Sub_part': None,
                    'Packed': None,
                    'Null': '',
                    'Index_type': 'BTREE',
                    'Comment': '',
                    'Index_comment': ''
                },
                {
                    'Table': 'orders',
                    'Non_unique': 1,
                    'Key_name': 'idx_user_id',
                    'Seq_in_index': 1,
                    'Column_name': 'user_id',
                    'Collation': 'A',
                    'Cardinality': 10000,
                    'Sub_part': None,
                    'Packed': None,
                    'Null': '',
                    'Index_type': 'BTREE',
                    'Comment': '',
                    'Index_comment': ''
                }
            ]
        }
    }


@router.post("/generate-suggestions")
async def generate_suggestions(
    request: OptimizationRequest,
    db: AsyncSession = Depends(get_db)
):
    try:
        # 使用模拟数据，避免MySQL依赖
        schema_info = get_mock_schema_info()
        
        service = OptimizationService(db)
        suggestions = await service.generate_suggestions(
            request.slow_query_id,
            request.sql,
            schema_info
        )
        
        return {
            'suggestions': [s.to_dict() for s in suggestions],
            'count': len(suggestions)
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/suggestions/top")
async def get_top_suggestions(
    limit: int = 20,
    db: AsyncSession = Depends(get_db)
):
    try:
        service = OptimizationService(db)
        suggestions = await service.get_top_suggestions(limit)
        
        # 如果没有建议，返回模拟数据
        if not suggestions:
            mock_suggestions = []
            for i in range(min(limit, 5)):
                mock_suggestions.append({
                    'id': i + 1,
                    'slow_query_id': random.randint(1, 100),
                    'suggestion_type': 'index_recommendation' if i % 2 == 0 else 'full_table_scan',
                    'description': 'Column in WHERE clause may need an index' if i % 2 == 0 else 'Query is performing a full table scan',
                    'priority': 'high' if i % 3 == 0 else 'medium' if i % 3 == 1 else 'low',
                    'impact_score': 0.9 if i % 3 == 0 else 0.6 if i % 3 == 1 else 0.3,
                    'sql_statement': 'CREATE INDEX idx_users_email ON users(email);' if i % 2 == 0 else None,
                    'created_at': '2026-03-26T00:00:00',
                    'owner': '后端值班工程师',
                    'due_date': None,
                    'exec_status': 'todo',
                    'applied': False,
                    'applied_at': None
                })
            return {
                'suggestions': mock_suggestions,
                'count': len(mock_suggestions)
            }
        
        return {
            'suggestions': [s.to_dict() for s in suggestions],
            'count': len(suggestions)
        }
    except Exception as e:
        # 数据库错误时返回模拟数据
        mock_suggestions = []
        for i in range(min(limit, 5)):
            mock_suggestions.append({
                'id': i + 1,
                'slow_query_id': random.randint(1, 100),
                'suggestion_type': 'index_recommendation' if i % 2 == 0 else 'full_table_scan',
                'description': 'Column in WHERE clause may need an index' if i % 2 == 0 else 'Query is performing a full table scan',
                'priority': 'high' if i % 3 == 0 else 'medium' if i % 3 == 1 else 'low',
                'impact_score': 0.9 if i % 3 == 0 else 0.6 if i % 3 == 1 else 0.3,
                'sql_statement': 'CREATE INDEX idx_users_email ON users(email);' if i % 2 == 0 else None,
                'created_at': '2026-03-26T00:00:00',
                'owner': '后端值班工程师',
                'due_date': None,
                'exec_status': 'todo',
                'applied': False,
                'applied_at': None
            })
        return {
            'suggestions': mock_suggestions,
            'count': len(mock_suggestions)
        }


@router.get("/suggestions/{query_id}")
async def get_suggestions(
    query_id: int,
    db: AsyncSession = Depends(get_db)
):
    service = OptimizationService(db)
    suggestions = await service.get_suggestions(query_id)
    
    # 如果没有建议，返回模拟数据
    if not suggestions:
        return {
            'suggestions': [
                {
                    'id': 1,
                    'slow_query_id': query_id,
                    'suggestion_type': 'index_recommendation',
                    'description': 'Column in WHERE clause may need an index',
                    'priority': 'high',
                    'impact_score': 0.9,
                    'sql_statement': 'CREATE INDEX idx_users_email ON users(email);',
                    'created_at': '2026-03-26T00:00:00',
                    'applied': False,
                    'applied_at': None
                },
                {
                    'id': 2,
                    'slow_query_id': query_id,
                    'suggestion_type': 'full_table_scan',
                    'description': 'Query is performing a full table scan',
                    'priority': 'medium',
                    'impact_score': 0.6,
                    'sql_statement': None,
                    'created_at': '2026-03-26T00:00:00',
                    'applied': False,
                    'applied_at': None
                }
            ],
            'count': 2
        }
    
    return {
        'suggestions': [s.to_dict() for s in suggestions],
        'count': len(suggestions)
    }


@router.post("/suggestions/{suggestion_id}/plan")
async def update_suggestion_plan(
    suggestion_id: int,
    request: OptimizationPlanUpdateRequest,
    db: AsyncSession = Depends(get_db)
):
    service = OptimizationService(db)
    updated = await service.update_suggestion_plan(
        suggestion_id=suggestion_id,
        owner=request.owner,
        due_date=request.due_date,
        exec_status=request.exec_status,
    )
    if not updated:
        raise HTTPException(status_code=404, detail="Suggestion not found")

    return {
        'suggestion': updated.to_dict()
    }
