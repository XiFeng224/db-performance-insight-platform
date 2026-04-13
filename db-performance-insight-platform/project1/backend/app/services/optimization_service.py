from typing import List, Dict, Any
from app.models.database import OptimizationSuggestion
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
import re


class IndexRecommendationEngine:
    
    RULES = [
        {
            'name': 'missing_where_index',
            'pattern': r'WHERE\s+(\w+)\s*=',
            'description': 'Column in WHERE clause may need an index',
            'priority': 'high'
        },
        {
            'name': 'missing_orderby_index',
            'pattern': r'ORDER\s+BY\s+(\w+)',
            'description': 'Column in ORDER BY clause may need an index',
            'priority': 'medium'
        },
        {
            'name': 'missing_groupby_index',
            'pattern': r'GROUP\s+BY\s+(\w+)',
            'description': 'Column in GROUP BY clause may need an index',
            'priority': 'medium'
        },
        {
            'name': 'join_condition',
            'pattern': r'JOIN\s+\w+\s+ON\s+(\w+)\.(\w+)\s*=\s*(\w+)\.(\w+)',
            'description': 'JOIN condition columns should be indexed',
            'priority': 'high'
        }
    ]
    
    @classmethod
    def analyze_sql(cls, sql: str, schema_info: Dict[str, Any]) -> List[Dict[str, Any]]:
        suggestions = []
        
        normalized_sql = sql.upper()
        
        for rule in cls.RULES:
            matches = re.finditer(rule['pattern'], normalized_sql)
            
            for match in matches:
                suggestion = {
                    'type': rule['name'],
                    'description': rule['description'],
                    'priority': rule['priority'],
                    'matched_text': match.group(0),
                    'column': match.group(1) if match.lastindex >= 1 else None
                }
                
                if cls._check_index_exists(match.group(1), schema_info):
                    suggestion['status'] = 'index_exists'
                    suggestion['impact_score'] = 0.0
                else:
                    suggestion['status'] = 'index_missing'
                    suggestion['impact_score'] = cls._calculate_impact_score(rule['priority'])
                
                suggestions.append(suggestion)
        
        return suggestions
    
    @classmethod
    def _check_index_exists(cls, column: str, schema_info: Dict[str, Any]) -> bool:
        for table_name, table_info in schema_info.items():
            indexes = table_info.get('indexes', [])
            for index in indexes:
                if column.lower() in index['Column_name'].lower():
                    return True
        return False
    
    @classmethod
    def generate_index_ddl(cls, table_name: str, column: str, index_type: str = 'INDEX') -> str:
        """生成索引DDL SQL语句"""
        index_name = f"idx_{table_name}_{column}".lower()[:64]  # MySQL索引名限制64字符
        return f"CREATE {index_type} {index_name} ON {table_name}({column});"
    
    @classmethod
    def _calculate_impact_score(cls, priority: str) -> float:
        scores = {
            'high': 0.9,
            'medium': 0.6,
            'low': 0.3
        }
        return scores.get(priority, 0.5)
    
    @classmethod
    def _extract_table_name(cls, sql: str) -> str:
        """从SQL中提取表名（简化实现）"""
        import re
        sql_upper = sql.upper()
        
        # 尝试从FROM子句提取
        from_match = re.search(r'FROM\s+(\w+)', sql_upper)
        if from_match:
            return from_match.group(1).lower()
        
        # 尝试从JOIN子句提取
        join_match = re.search(r'JOIN\s+(\w+)', sql_upper)
        if join_match:
            return join_match.group(1).lower()
        
        return 'unknown'


class OptimizationService:
    
    def __init__(self, db: AsyncSession):
        self.db = db
    
    async def generate_suggestions(
        self,
        slow_query_id: int,
        sql: str,
        schema_info: Dict[str, Any],
        execution_plan_issues: List[Dict[str, Any]] = None
    ) -> List[OptimizationSuggestion]:
        suggestions = []
        
        index_suggestions = IndexRecommendationEngine.analyze_sql(sql, schema_info)
        
        for idx_sugg in index_suggestions:
            if idx_sugg['status'] == 'index_missing':
                # 提取表名（简化处理，实际应该从SQL解析中获取）
                table_name = IndexRecommendationEngine._extract_table_name(sql)
                column = idx_sugg.get('column', 'unknown')
                
                # 生成DDL SQL
                ddl_sql = None
                if table_name and column != 'unknown':
                    ddl_sql = IndexRecommendationEngine.generate_index_ddl(
                        table_name, column
                    )
                
                suggestion = OptimizationSuggestion(
                    slow_query_id=slow_query_id,
                    suggestion_type='index_recommendation',
                    description=f"{idx_sugg['description']}. Column: {column}",
                    priority=idx_sugg['priority'],
                    impact_score=idx_sugg['impact_score'],
                    sql_statement=ddl_sql
                )
                self.db.add(suggestion)
                suggestions.append(suggestion)
        
        if execution_plan_issues:
            for issue in execution_plan_issues:
                suggestion = OptimizationSuggestion(
                    slow_query_id=slow_query_id,
                    suggestion_type=issue['type'],
                    description=issue['description'],
                    priority=issue['severity'],
                    impact_score=0.7 if issue['severity'] == 'high' else 0.5
                )
                self.db.add(suggestion)
                suggestions.append(suggestion)
        
        await self.db.commit()
        
        for sugg in suggestions:
            await self.db.refresh(sugg)
        
        return suggestions
    
    async def get_suggestions(self, slow_query_id: int) -> List[OptimizationSuggestion]:
        query = select(OptimizationSuggestion).where(
            OptimizationSuggestion.slow_query_id == slow_query_id
        ).order_by(OptimizationSuggestion.impact_score.desc())
        
        result = await self.db.execute(query)
        return result.scalars().all()
    
    async def get_top_suggestions(self, limit: int = 20) -> List[OptimizationSuggestion]:
        query = select(OptimizationSuggestion).order_by(
            OptimizationSuggestion.impact_score.desc()
        ).limit(limit)

        result = await self.db.execute(query)
        return result.scalars().all()

    async def update_suggestion_plan(
        self,
        suggestion_id: int,
        owner: str | None = None,
        due_date: str | None = None,
        exec_status: str | None = None,
    ) -> OptimizationSuggestion | None:
        query = select(OptimizationSuggestion).where(OptimizationSuggestion.id == suggestion_id)
        result = await self.db.execute(query)
        suggestion = result.scalar_one_or_none()
        if not suggestion:
            return None

        if owner is not None:
            suggestion.owner = owner
        if due_date is not None:
            suggestion.due_date = due_date
        if exec_status is not None:
            suggestion.exec_status = exec_status

        await self.db.commit()
        await self.db.refresh(suggestion)
        return suggestion
