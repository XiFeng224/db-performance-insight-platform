from typing import Dict, Any
import re


class SQLPerformanceScorer:
    """SQL性能评分系统"""
    
    MAX_SCORE = 100
    
    @classmethod
    def score_sql(
        cls,
        sql: str,
        execution_time: float,
        rows_examined: int,
        rows_sent: int,
        execution_plan_issues: list = None
    ) -> Dict[str, Any]:
        """
        对SQL进行性能评分
        返回评分结果和详细分析
        """
        scores = {}
        deductions = []
        
        # 1. 执行时间评分 (40分)
        time_score, time_deductions = cls._score_execution_time(execution_time)
        scores['execution_time'] = time_score
        deductions.extend(time_deductions)
        
        # 2. 扫描效率评分 (30分)
        efficiency_score, efficiency_deductions = cls._score_efficiency(
            rows_examined, rows_sent
        )
        scores['efficiency'] = efficiency_score
        deductions.extend(efficiency_deductions)
        
        # 3. SQL结构评分 (20分)
        structure_score, structure_deductions = cls._score_structure(sql)
        scores['structure'] = structure_score
        deductions.extend(structure_deductions)
        
        # 4. 执行计划问题评分 (10分)
        plan_score, plan_deductions = cls._score_execution_plan(execution_plan_issues or [])
        scores['execution_plan'] = plan_score
        deductions.extend(plan_deductions)
        
        # 计算总分
        total_score = sum(scores.values())
        
        # 确定等级
        grade = cls._get_grade(total_score)
        
        return {
            'total_score': total_score,
            'max_score': cls.MAX_SCORE,
            'grade': grade,
            'scores': scores,
            'deductions': deductions,
            'recommendations': cls._get_recommendations(total_score, deductions)
        }
    
    @classmethod
    def _score_execution_time(cls, execution_time: float) -> tuple:
        """执行时间评分"""
        score = 40
        deductions = []
        
        if execution_time > 10:
            score = 0
            deductions.append({
                'reason': '执行时间过长',
                'detail': f'执行时间 {execution_time:.2f}秒，严重影响性能',
                'deduction': 40
            })
        elif execution_time > 5:
            score = 10
            deductions.append({
                'reason': '执行时间较长',
                'detail': f'执行时间 {execution_time:.2f}秒，建议优化',
                'deduction': 30
            })
        elif execution_time > 2:
            score = 20
            deductions.append({
                'reason': '执行时间中等',
                'detail': f'执行时间 {execution_time:.2f}秒，有优化空间',
                'deduction': 20
            })
        elif execution_time > 1:
            score = 30
            deductions.append({
                'reason': '执行时间可接受',
                'detail': f'执行时间 {execution_time:.2f}秒',
                'deduction': 10
            })
        
        return score, deductions
    
    @classmethod
    def _score_efficiency(cls, rows_examined: int, rows_sent: int) -> tuple:
        """扫描效率评分"""
        score = 30
        deductions = []
        
        if rows_examined == 0:
            return score, deductions
        
        efficiency_ratio = rows_sent / rows_examined if rows_examined > 0 else 0
        
        if efficiency_ratio < 0.01:
            score = 5
            deductions.append({
                'reason': '扫描效率极低',
                'detail': f'扫描 {rows_examined} 行，仅返回 {rows_sent} 行，效率比 {efficiency_ratio:.2%}',
                'deduction': 25
            })
        elif efficiency_ratio < 0.1:
            score = 15
            deductions.append({
                'reason': '扫描效率较低',
                'detail': f'扫描 {rows_examined} 行，返回 {rows_sent} 行，效率比 {efficiency_ratio:.2%}',
                'deduction': 15
            })
        elif efficiency_ratio < 0.5:
            score = 25
            deductions.append({
                'reason': '扫描效率中等',
                'detail': f'扫描 {rows_examined} 行，返回 {rows_sent} 行，效率比 {efficiency_ratio:.2%}',
                'deduction': 5
            })
        
        return score, deductions
    
    @classmethod
    def _score_structure(cls, sql: str) -> tuple:
        """SQL结构评分"""
        score = 20
        deductions = []
        sql_upper = sql.upper()
        
        # 检查SELECT *
        if re.search(r'SELECT\s+\*', sql_upper):
            score -= 5
            deductions.append({
                'reason': '使用了SELECT *',
                'detail': '建议明确指定需要的列，避免不必要的字段传输',
                'deduction': 5
            })
        
        # 检查缺少WHERE条件
        if 'SELECT' in sql_upper and 'WHERE' not in sql_upper and 'JOIN' not in sql_upper:
            score -= 5
            deductions.append({
                'reason': '缺少WHERE条件',
                'detail': '可能导致全表扫描，建议添加WHERE条件',
                'deduction': 5
            })
        
        # 检查子查询嵌套过深
        nested_count = sql_upper.count('SELECT') - 1
        if nested_count > 2:
            score -= 5
            deductions.append({
                'reason': '子查询嵌套过深',
                'detail': f'包含 {nested_count} 层嵌套，建议优化为JOIN',
                'deduction': 5
            })
        
        # 检查ORDER BY没有LIMIT
        if 'ORDER BY' in sql_upper and 'LIMIT' not in sql_upper:
            score -= 2
            deductions.append({
                'reason': 'ORDER BY缺少LIMIT',
                'detail': '可能导致排序大量数据，建议添加LIMIT',
                'deduction': 2
            })
        
        return max(0, score), deductions
    
    @classmethod
    def _score_execution_plan(cls, issues: list) -> tuple:
        """执行计划问题评分"""
        score = 10
        deductions = []
        
        for issue in issues:
            if issue.get('severity') == 'high':
                score -= 5
                deductions.append({
                    'reason': issue.get('type', '执行计划问题'),
                    'detail': issue.get('description', ''),
                    'deduction': 5
                })
            elif issue.get('severity') == 'medium':
                score -= 3
                deductions.append({
                    'reason': issue.get('type', '执行计划问题'),
                    'detail': issue.get('description', ''),
                    'deduction': 3
                })
        
        return max(0, score), deductions
    
    @classmethod
    def _get_grade(cls, score: float) -> str:
        """获取等级"""
        if score >= 90:
            return 'A+'
        elif score >= 80:
            return 'A'
        elif score >= 70:
            return 'B'
        elif score >= 60:
            return 'C'
        elif score >= 50:
            return 'D'
        else:
            return 'F'
    
    @classmethod
    def _get_recommendations(cls, score: float, deductions: list) -> list:
        """获取优化建议"""
        recommendations = []
        
        if score < 60:
            recommendations.append('SQL性能较差，建议进行全面优化')
        
        # 根据扣分项生成建议
        high_priority_issues = [d for d in deductions if d.get('deduction', 0) >= 20]
        if high_priority_issues:
            recommendations.append('存在高优先级性能问题，建议优先处理')
        
        return recommendations
