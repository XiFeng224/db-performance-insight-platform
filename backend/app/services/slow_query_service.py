from typing import List, Dict, Any, Optional
from app.utils.sql_parser import SQLFingerprintExtractor, QueryCluster
from app.models.database import SlowQuery, ExecutionPlan, OptimizationSuggestion
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
import json


class SlowQueryService:
    
    def __init__(self, db: AsyncSession):
        self.db = db
        self.cluster = QueryCluster()
    
    async def add_slow_query(self, query_data: dict) -> SlowQuery:
        fingerprint = SQLFingerprintExtractor.extract_fingerprint(query_data['sql'])
        
        slow_query = SlowQuery(
            sql_fingerprint=fingerprint,
            sql_text=query_data['sql'],
            execution_time=query_data.get('execution_time', 0),
            lock_time=query_data.get('lock_time', 0),
            rows_sent=query_data.get('rows_sent', 0),
            rows_examined=query_data.get('rows_examined', 0),
            database=query_data.get('database', ''),
            query_time=query_data.get('query_time', 0),
            client_ip=query_data.get('client_ip', ''),
            user=query_data.get('user', '')
        )
        
        self.db.add(slow_query)
        await self.db.commit()
        await self.db.refresh(slow_query)
        
        self.cluster.add_query(query_data['sql'], query_data)
        
        return slow_query
    
    async def get_slow_queries(
        self,
        skip: int = 0,
        limit: int = 100,
        database: str = None,
        min_execution_time: float = None
    ) -> List[SlowQuery]:
        query = select(SlowQuery)
        
        if database:
            query = query.where(SlowQuery.database == database)
        
        if min_execution_time:
            query = query.where(SlowQuery.execution_time >= min_execution_time)
        
        query = query.order_by(SlowQuery.execution_time.desc()).offset(skip).limit(limit)
        
        result = await self.db.execute(query)
        return result.scalars().all()
    
    async def get_slow_query_by_id(self, query_id: int) -> Optional[SlowQuery]:
        query = select(SlowQuery).where(SlowQuery.id == query_id)
        result = await self.db.execute(query)
        return result.scalar_one_or_none()
    
    async def get_query_clusters(self, top_n: int = 10) -> List[Dict]:
        clusters = self.cluster.get_clusters()
        sorted_clusters = sorted(
            clusters.values(),
            key=lambda x: x['avg_execution_time'] * x['count'],
            reverse=True
        )
        return sorted_clusters[:top_n]
    
    async def get_slow_query_stats(self) -> Dict[str, Any]:
        total = await self.db.execute(select(func.count(SlowQuery.id)))
        total_count = total.scalar() if total else 0
        
        avg_time = await self.db.execute(
            select(func.avg(SlowQuery.execution_time))
        )
        avg_execution_time = avg_time.scalar() or 0
        
        max_time = await self.db.execute(
            select(func.max(SlowQuery.execution_time))
        )
        max_execution_time = max_time.scalar() or 0
        
        db_result = await self.db.execute(
            select(
                SlowQuery.database,
                func.count(SlowQuery.id).label('count'),
                func.avg(SlowQuery.execution_time).label('avg_time')
            ).group_by(SlowQuery.database)
        )
        db_rows = db_result.all() if hasattr(db_result, 'all') else list(db_result)
        
        database_stats = [
            {
                'database': row.database,
                'count': row.count,
                'avg_time': float(row.avg_time)
            }
            for row in db_rows
        ]
        by_database = {(row.database or '(empty)'): row.count for row in db_rows}
        
        return {
            'total': total_count or 0,
            'total_count': total_count,
            'avg_execution_time': float(avg_execution_time),
            'max_execution_time': float(max_execution_time),
            'by_database': by_database,
            'database_stats': database_stats
        }
