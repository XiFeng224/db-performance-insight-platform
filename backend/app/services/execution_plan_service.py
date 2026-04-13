from typing import List, Dict, Any, Optional
from app.models.database import ExecutionPlan, OptimizationSuggestion
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
import json


class ExecutionPlanService:
    
    def __init__(self, db: AsyncSession):
        self.db = db
    
    async def save_execution_plan(
        self,
        slow_query_id: int,
        plan_json: dict,
        plan_text: str
    ) -> ExecutionPlan:
        execution_plan = ExecutionPlan(
            slow_query_id=slow_query_id,
            plan_json=plan_json,
            plan_text=plan_text
        )
        
        self.db.add(execution_plan)
        await self.db.commit()
        await self.db.refresh(execution_plan)
        
        return execution_plan
    
    async def get_execution_plan(self, slow_query_id: int) -> Optional[ExecutionPlan]:
        query = select(ExecutionPlan).where(ExecutionPlan.slow_query_id == slow_query_id)
        result = await self.db.execute(query)
        return result.scalar_one_or_none()
    
    def visualize_execution_plan(self, plan_json: dict) -> Dict[str, Any]:
        nodes = []
        edges = []
        node_id = 0
        
        def process_node(node, parent_id=None):
            nonlocal node_id
            current_id = node_id
            node_id += 1
            
            node_type = node.get('access_type', 'ALL')
            table_name = node.get('table', {}).get('table_name', 'unknown')
            rows = node.get('rows_examined_per_scan', 0)
            cost = node.get('cost_info', {}).get('query_cost', 0)
            
            nodes.append({
                'id': current_id,
                'label': f"{table_name}\n{node_type}\nRows: {rows}",
                'type': node_type,
                'rows': rows,
                'cost': cost,
                'table': table_name
            })
            
            if parent_id is not None:
                edges.append({
                    'from': parent_id,
                    'to': current_id
                })
            
            if 'nested_loop' in node:
                for child in node['nested_loop']:
                    process_node(child, current_id)
            
            if 'table' in node:
                table_info = node['table']
                if 'pushed_conditions' in table_info:
                    pass
        
        if 'query_block' in plan_json:
            process_node(plan_json['query_block'])
        
        return {
            'nodes': nodes,
            'edges': edges
        }
    
    def analyze_execution_plan(self, plan_json: dict) -> List[Dict[str, Any]]:
        issues = []
        
        def _extra_str(node: dict) -> str:
            extra = node.get('extra', '')
            if isinstance(extra, list):
                return ' '.join(str(x) for x in extra).lower()
            return (extra or '').lower()

        def analyze_node(node, depth=0):
            access_type = node.get('access_type', '')
            rows = node.get('rows_examined_per_scan', 0) or 0
            cost = (node.get('cost_info') or {}).get('query_cost', 0) or 0
            extra_str = _extra_str(node)

            if access_type == 'ALL' and rows > 1000:
                table_name = (node.get('table') or {}).get('table_name', 'unknown')
                issues.append({
                    'type': 'full_table_scan',
                    'severity': 'high',
                    'description': f"Full table scan detected on {table_name} with {rows} rows",
                    'suggestion': 'Consider adding an index on the columns used in WHERE clause'
                })

            if 'using filesort' in extra_str or 'using_filesort' in extra_str:
                issues.append({
                    'type': 'filesort',
                    'severity': 'medium',
                    'description': 'Query requires filesort operation',
                    'suggestion': 'Consider adding an index to cover ORDER BY clause'
                })

            if 'using temporary' in extra_str or 'using_temporary' in extra_str:
                issues.append({
                    'type': 'temporary_table',
                    'severity': 'medium',
                    'description': 'Query uses temporary table',
                    'suggestion': 'Review query structure to avoid temporary tables'
                })
            
            if cost > 10000:
                issues.append({
                    'type': 'high_cost',
                    'severity': 'medium',
                    'description': f'High query cost: {cost}',
                    'suggestion': 'Consider query optimization or adding indexes'
                })
            
            if 'nested_loop' in node:
                for child in node['nested_loop']:
                    analyze_node(child, depth + 1)
        
        if 'query_block' in plan_json:
            analyze_node(plan_json['query_block'])
        
        return issues
