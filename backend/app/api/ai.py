from collections import defaultdict
from datetime import datetime, timedelta
from typing import List, Dict, Any
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, Body
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.database import SlowQuery
from app.services.ai_diagnostic_engine import AIDiagnosticEngine, IndexRecommender, SQLOptimizer
from app.utils.logger import api_logger

router = APIRouter(prefix="/api/ai", tags=["ai"])


def _safe_float(value: Any, default: float = 0.0) -> float:
    try:
        if value is None:
            return default
        return float(value)
    except (TypeError, ValueError):
        return default


def _build_sql_optimization_suggestions(sql: str) -> List[Dict[str, Any]]:
    sql_upper = sql.upper()
    suggestions: List[Dict[str, Any]] = []

    if "SELECT *" in sql_upper:
        suggestions.append(
            {
                "type": "projection",
                "message": "避免 SELECT *，改为明确列名以减少 I/O 和网络开销",
                "risk": "low",
                "confidence": 0.95,
            }
        )

    if "ORDER BY" in sql_upper and "LIMIT" not in sql_upper:
        suggestions.append(
            {
                "type": "pagination",
                "message": "ORDER BY 场景建议增加 LIMIT，避免全量排序",
                "risk": "low",
                "confidence": 0.9,
            }
        )

    if "OR " in sql_upper and "WHERE" in sql_upper:
        suggestions.append(
            {
                "type": "predicate_rewrite",
                "message": "复杂 OR 条件可考虑拆分 UNION ALL 或补充索引",
                "risk": "medium",
                "confidence": 0.75,
            }
        )

    if "IN (SELECT" in sql_upper:
        suggestions.append(
            {
                "type": "subquery",
                "message": "可评估将 IN 子查询改写为 JOIN/EXISTS（需验证语义一致）",
                "risk": "medium",
                "confidence": 0.7,
            }
        )

    if not suggestions:
        suggestions.append(
            {
                "type": "general",
                "message": "未检测到高风险模式，建议结合执行计划进一步评估",
                "risk": "low",
                "confidence": 0.6,
            }
        )

    return suggestions


async def _load_training_metrics_from_db(
    db: AsyncSession,
    current_metrics: Dict[str, Any],
    lookback_hours: int = 24,
) -> List[Dict[str, Any]]:
    cutoff = datetime.utcnow() - timedelta(hours=lookback_hours)

    stmt = (
        select(SlowQuery.timestamp, SlowQuery.execution_time)
        .where(SlowQuery.timestamp >= cutoff)
        .order_by(SlowQuery.timestamp.asc())
    )
    result = await db.execute(stmt)
    rows = result.all()

    hourly = defaultdict(lambda: {"count": 0, "sum_exec": 0.0})
    for timestamp, exec_time in rows:
        if not timestamp:
            continue
        bucket = timestamp.replace(minute=0, second=0, microsecond=0)
        hourly[bucket]["count"] += 1
        hourly[bucket]["sum_exec"] += _safe_float(exec_time, 0.0)

    now = datetime.utcnow().replace(minute=0, second=0, microsecond=0)
    data: List[Dict[str, Any]] = []

    base_qps = _safe_float(current_metrics.get("qps"), 0.0)
    base_cpu = _safe_float(current_metrics.get("cpu_usage"), 0.0)
    base_mem = _safe_float(current_metrics.get("memory_usage"), 0.0)
    base_disk = _safe_float(current_metrics.get("disk_io"), 0.0)
    base_conn = _safe_float(current_metrics.get("connections"), 0.0)

    for i in range(lookback_hours):
        ts = now - timedelta(hours=lookback_hours - 1 - i)
        stat = hourly.get(ts, {"count": 0, "sum_exec": 0.0})
        slow_count = stat["count"]
        avg_exec = (stat["sum_exec"] / slow_count) if slow_count else 0.0

        qps_proxy = base_qps if base_qps > 0 else round(slow_count / 3600.0, 4)
        cpu_proxy = base_cpu if base_cpu > 0 else min(95.0, 15.0 + slow_count * 2.0 + avg_exec * 1.5)
        mem_proxy = base_mem if base_mem > 0 else min(95.0, 20.0 + slow_count * 1.2)
        disk_proxy = base_disk if base_disk > 0 else max(1.0, slow_count * 0.5 + avg_exec * 0.8)
        conn_proxy = base_conn if base_conn > 0 else min(2000.0, 20.0 + slow_count * 1.5)

        data.append(
            {
                "timestamp": ts.isoformat(),
                "qps": float(qps_proxy),
                "cpu_usage": float(cpu_proxy),
                "memory_usage": float(mem_proxy),
                "disk_io": float(disk_proxy),
                "connections": float(conn_proxy),
                "slow_query_count": int(slow_count),
            }
        )

    return data


@router.post("/predict")
async def predict_performance(
    current_metrics: Dict[str, Any] = Body(...),
    steps: int = Body(1, ge=1, le=24),
    db: AsyncSession = Depends(get_db),
):
    """预测未来性能（基于真实慢查询历史聚合，而非随机模拟数据）"""
    try:
        engine = AIDiagnosticEngine()
        metrics_data = await _load_training_metrics_from_db(db, current_metrics, lookback_hours=24)

        # 最少样本保障
        non_zero_points = sum(1 for p in metrics_data if p.get("slow_query_count", 0) > 0)
        if len(metrics_data) < 10 or non_zero_points < 3:
            raise HTTPException(
                status_code=400,
                detail="历史数据不足：请先采集至少 3 个含慢查询的时间点后再进行预测",
            )

        trained = engine.train(metrics_data)
        if not trained:
            raise HTTPException(status_code=400, detail="模型训练失败：历史数据质量不足")

        predictions = engine.predict(current_metrics, steps)
        trends = engine.analyze_trend(metrics_data)
        anomalies = engine.detect_anomalies(metrics_data)

        return {
            "data_source": "slow_queries_history_aggregated",
            "lookback_hours": 24,
            "training_points": len(metrics_data),
            "predictions": predictions,
            "trends": trends,
            "anomalies": anomalies,
        }
    except HTTPException:
        raise
    except Exception as e:
        api_logger.error(f"Error predicting performance: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"性能预测失败: {str(e)}")


@router.post("/recommend-indexes")
async def recommend_indexes(
    queries: List[str] = Body(...),
):
    """推荐索引"""
    try:
        patterns = IndexRecommender.analyze_query_patterns(queries)
        recommendations = IndexRecommender.recommend_indexes(patterns)

        return {
            "patterns": patterns,
            "recommendations": recommendations,
        }
    except Exception as e:
        api_logger.error(f"Error recommending indexes: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"索引推荐失败: {str(e)}")


@router.post("/optimize-sql")
async def optimize_sql(
    sql: str = Body(..., embed=True)
):
    """优化SQL语句（建议模式，不自动执行）"""
    try:
        complexity = SQLOptimizer.analyze_complexity(sql)
        optimized_sql = SQLOptimizer.rewrite(sql)
        suggestions = _build_sql_optimization_suggestions(sql)

        return {
            "mode": "suggestion_only",
            "execution_policy": "no_auto_execute",
            "original_sql": sql,
            "optimized_sql_suggestion": optimized_sql,
            "complexity": complexity,
            "suggestions": suggestions,
            "risk_label": "medium" if complexity.get("complexity_score", 0) >= 6 else "low",
        }
    except Exception as e:
        api_logger.error(f"Error optimizing SQL: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"SQL优化失败: {str(e)}")


@router.post("/diagnose")
async def diagnose_performance(
    metrics_data: List[Dict[str, Any]] = Body(...)
):
    """诊断性能问题（输出结构化证据链、风险、收益预测）"""
    try:
        engine = AIDiagnosticEngine()
        trained = engine.train(metrics_data)
        if not trained:
            raise HTTPException(status_code=400, detail="诊断失败：输入样本不足，至少需要 10 个时间点")

        trace_id = f"diag-{uuid4().hex[:12]}"
        trends = engine.analyze_trend(metrics_data)
        anomalies = engine.detect_anomalies(metrics_data)

        evidence_nodes: List[Dict[str, Any]] = []
        evidence_links: List[Dict[str, Any]] = []
        recommendations: List[Dict[str, Any]] = []

        evidence_nodes.append(
            {
                "id": "root-diagnosis",
                "type": "root",
                "label": "性能诊断会话",
                "severity": "info",
                "metadata": {
                    "trace_id": trace_id,
                    "sample_size": len(metrics_data),
                },
            }
        )

        for metric, trend in trends.items():
            trend_node_id = f"trend-{metric}"
            evidence_nodes.append(
                {
                    "id": trend_node_id,
                    "type": "trend",
                    "label": f"{metric}: {trend}",
                    "severity": "warning" if trend in ["increasing", "decreasing"] else "info",
                    "metadata": {"metric": metric, "trend": trend},
                }
            )
            evidence_links.append(
                {
                    "source": "root-diagnosis",
                    "target": trend_node_id,
                    "relation": "observed",
                }
            )

            should_recommend = (trend == "increasing" and metric in ["cpu_usage", "memory_usage", "disk_io"]) or (
                trend == "decreasing" and metric == "qps"
            )
            if should_recommend:
                base_conf = 0.8 if metric != "qps" else 0.75
                expected_gain = {
                    "latency_reduction_pct": 8 if metric in ["cpu_usage", "disk_io"] else 5,
                    "throughput_improvement_pct": 6 if metric == "qps" else 3,
                    "resource_saving_pct": 4 if metric == "memory_usage" else 2,
                }

                reco_id = f"reco-trend-{metric}"
                reco = {
                    "id": reco_id,
                    "title": f"{metric} 趋势风险处置",
                    "action": "建议排查热点 SQL、索引命中率、连接池和锁等待",
                    "risk": "medium",
                    "confidence": base_conf,
                    "impact_estimate": expected_gain,
                    "evidence": {
                        "type": "trend",
                        "metric": metric,
                        "trend": trend,
                        "node_id": trend_node_id,
                    },
                }
                recommendations.append(reco)

                reco_node_id = f"node-{reco_id}"
                evidence_nodes.append(
                    {
                        "id": reco_node_id,
                        "type": "recommendation",
                        "label": reco["title"],
                        "severity": reco["risk"],
                        "metadata": {
                            "confidence": reco["confidence"],
                            "impact_estimate": reco["impact_estimate"],
                        },
                    }
                )
                evidence_links.append(
                    {
                        "source": trend_node_id,
                        "target": reco_node_id,
                        "relation": "supports",
                    }
                )

        for idx, anomaly in enumerate(anomalies[:10]):
            node_id = f"anomaly-{idx}"
            evidence_nodes.append(
                {
                    "id": node_id,
                    "type": "anomaly",
                    "label": f"异常点 {idx + 1}",
                    "severity": anomaly.get("severity", "medium"),
                    "metadata": anomaly,
                }
            )
            evidence_links.append(
                {
                    "source": "root-diagnosis",
                    "target": node_id,
                    "relation": "observed",
                }
            )

        if anomalies:
            high_count = sum(1 for a in anomalies if a.get("severity") == "high")
            top_anomaly = max(anomalies, key=lambda x: _safe_float(x.get("fusion", {}).get("iforest_score"), 0.0))
            reco_id = "reco-anomaly-remediation"
            anomaly_reco = {
                "id": reco_id,
                "title": f"异常时段优先排障（共 {len(anomalies)} 个异常）",
                "action": "按异常时间窗口回放慢查询与执行计划，优先处理高 IF 得分异常",
                "risk": "high" if high_count >= 3 else "medium",
                "confidence": 0.86,
                "impact_estimate": {
                    "latency_reduction_pct": 12,
                    "throughput_improvement_pct": 8,
                    "resource_saving_pct": 6,
                },
                "evidence": {
                    "type": "anomaly",
                    "count": len(anomalies),
                    "high_severity_count": high_count,
                    "top_anomaly": top_anomaly,
                },
            }
            recommendations.append(anomaly_reco)

            reco_node_id = f"node-{reco_id}"
            evidence_nodes.append(
                {
                    "id": reco_node_id,
                    "type": "recommendation",
                    "label": anomaly_reco["title"],
                    "severity": anomaly_reco["risk"],
                    "metadata": {
                        "confidence": anomaly_reco["confidence"],
                        "impact_estimate": anomaly_reco["impact_estimate"],
                    },
                }
            )
            evidence_links.append(
                {
                    "source": "root-diagnosis",
                    "target": reco_node_id,
                    "relation": "supports",
                }
            )

        # 根因概率图
        cpu_inc = 1 if trends.get("cpu_usage") == "increasing" else 0
        disk_inc = 1 if trends.get("disk_io") == "increasing" else 0
        qps_dec = 1 if trends.get("qps") == "decreasing" else 0
        anomaly_factor = min(1.0, len(anomalies) / 10.0)

        score_index_missing = 0.35 + 0.2 * cpu_inc + 0.1 * qps_dec + 0.15 * anomaly_factor
        score_sort_spill = 0.25 + 0.2 * disk_inc + 0.15 * anomaly_factor
        score_lock_contention = 0.2 + 0.2 * qps_dec + 0.15 * anomaly_factor
        total_score = max(1e-6, score_index_missing + score_sort_spill + score_lock_contention)

        root_cause_probabilities = [
            {
                "cause": "索引缺失或低效索引",
                "probability": round(score_index_missing / total_score, 3),
                "evidence_refs": ["trend-cpu_usage", "root-diagnosis"],
            },
            {
                "cause": "排序/临时表开销过高",
                "probability": round(score_sort_spill / total_score, 3),
                "evidence_refs": ["trend-disk_io", "root-diagnosis"],
            },
            {
                "cause": "锁竞争或并发争用",
                "probability": round(score_lock_contention / total_score, 3),
                "evidence_refs": ["trend-qps", "root-diagnosis"],
            },
        ]

        # 建议冲突检测
        recommendation_conflicts = []
        titles = [r.get("title", "") for r in recommendations]
        if any("趋势风险处置" in t for t in titles) and any("异常时段优先排障" in t for t in titles):
            recommendation_conflicts.append(
                {
                    "type": "priority_conflict",
                    "description": "全局趋势治理与异常窗口排障可能争夺资源",
                    "recommendations": [t for t in titles if t],
                    "resolution_hint": "先处理高 IF 得分异常窗口，再执行全局趋势优化",
                }
            )

        # SLA 视角
        latest = metrics_data[-1] if metrics_data else {}
        latest_cpu = _safe_float(latest.get("cpu_usage"), 0.0)
        latest_slow = _safe_float(latest.get("slow_query_count"), 0.0)
        est_p95 = 120 + latest_slow * 12 + max(0, latest_cpu - 60) * 4
        error_risk_score = min(100.0, latest_slow * 5 + max(0, latest_cpu - 70) * 1.2)
        breach_risk = "high" if est_p95 > 300 or latest_cpu > 85 else "medium" if est_p95 > 220 or latest_cpu > 75 else "low"
        sla_assessment = {
            "target": {
                "p95_latency_ms": 220,
                "max_cpu_usage_pct": 75,
                "max_error_risk_score": 40,
            },
            "current": {
                "estimated_p95_latency_ms": round(est_p95, 2),
                "estimated_cpu_usage_pct": round(latest_cpu, 2),
                "error_risk_score": round(error_risk_score, 2),
            },
            "breach_risk": breach_risk,
        }

        report = {
            "trace_id": trace_id,
            "summary": {
                "sample_size": len(metrics_data),
                "anomaly_count": len(anomalies),
                "high_risk_recommendations": sum(1 for r in recommendations if r["risk"] == "high"),
            },
            "trends": trends,
            "anomalies": anomalies,
            "recommendations": recommendations,
            "evidence_chain": {
                "nodes": evidence_nodes,
                "links": evidence_links,
            },
            "root_cause_probabilities": root_cause_probabilities,
            "recommendation_conflicts": recommendation_conflicts,
            "sla_assessment": sla_assessment,
        }

        return report
    except HTTPException:
        raise
    except Exception as e:
        api_logger.error(f"Error diagnosing performance: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"性能诊断失败: {str(e)}")
