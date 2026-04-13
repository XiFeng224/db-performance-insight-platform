from typing import Dict, Any, List, Tuple
import re

import numpy as np
from sklearn.ensemble import IsolationForest
from sklearn.linear_model import LinearRegression
from sklearn.preprocessing import StandardScaler


class AIDiagnosticEngine:
    """AI诊断引擎（可解释优先：趋势 + 统计异常 + IsolationForest 融合）"""

    def __init__(self):
        self.models: Dict[str, LinearRegression] = {}
        self.scalers: Dict[str, StandardScaler] = {}
        self.metrics = [
            "qps",
            "cpu_usage",
            "memory_usage",
            "disk_io",
            "connections",
            "slow_query_count",
        ]

    def prepare_data(self, metrics_data: List[Dict[str, Any]]) -> Tuple[Any, Any]:
        """准备训练数据"""
        if len(metrics_data) < 10:
            return None, None

        X = []
        y_dict = {metric: [] for metric in self.metrics}

        for i in range(len(metrics_data) - 1):
            current = metrics_data[i]
            next_data = metrics_data[i + 1]

            features = [
                float(current.get("qps", 0) or 0),
                float(current.get("cpu_usage", 0) or 0),
                float(current.get("memory_usage", 0) or 0),
                float(current.get("disk_io", 0) or 0),
                float(current.get("connections", 0) or 0),
                float(current.get("slow_query_count", 0) or 0),
                i,
            ]

            X.append(features)

            for metric in self.metrics:
                y_dict[metric].append(float(next_data.get(metric, 0) or 0))

        return np.array(X), {k: np.array(v) for k, v in y_dict.items()}

    def train(self, metrics_data: List[Dict[str, Any]]) -> bool:
        """训练预测模型"""
        X, y_dict = self.prepare_data(metrics_data)

        if X is None or len(X) < 9:
            return False

        for metric in self.metrics:
            if len(y_dict[metric]) > 0:
                scaler = StandardScaler()
                X_scaled = scaler.fit_transform(X)

                model = LinearRegression()
                model.fit(X_scaled, y_dict[metric])

                self.models[metric] = model
                self.scalers[metric] = scaler

        return True

    def predict(self, current_metrics: Dict[str, Any], steps: int = 1) -> List[Dict[str, Any]]:
        """预测未来性能"""
        predictions = []

        if not self.models:
            return predictions

        current = current_metrics.copy()

        for step in range(steps):
            features = [
                float(current.get("qps", 0) or 0),
                float(current.get("cpu_usage", 0) or 0),
                float(current.get("memory_usage", 0) or 0),
                float(current.get("disk_io", 0) or 0),
                float(current.get("connections", 0) or 0),
                float(current.get("slow_query_count", 0) or 0),
                step,
            ]

            X = np.array([features])

            prediction = {}
            for metric in self.metrics:
                if metric in self.models and metric in self.scalers:
                    X_scaled = self.scalers[metric].transform(X)
                    pred_value = self.models[metric].predict(X_scaled)[0]
                    prediction[metric] = max(0.0, float(pred_value))

            predictions.append(prediction)
            current = prediction

        return predictions

    @staticmethod
    def _robust_z_scores(values: List[float]) -> np.ndarray:
        arr = np.array(values, dtype=float)
        median = np.median(arr)
        mad = np.median(np.abs(arr - median))
        if mad == 0:
            return np.zeros_like(arr)
        # 0.6745 is scaling factor for normal distribution consistency
        return 0.6745 * (arr - median) / mad

    @staticmethod
    def _ewma(values: List[float], alpha: float = 0.3) -> np.ndarray:
        arr = np.array(values, dtype=float)
        if len(arr) == 0:
            return arr
        ewma = np.zeros_like(arr)
        ewma[0] = arr[0]
        for i in range(1, len(arr)):
            ewma[i] = alpha * arr[i] + (1 - alpha) * ewma[i - 1]
        return ewma

    def detect_anomalies(self, metrics_data: List[Dict[str, Any]], threshold: float = 2.5) -> List[Dict[str, Any]]:
        """检测异常：robust-z + EWMA偏差 + IsolationForest 融合"""
        anomalies: List[Dict[str, Any]] = []

        if len(metrics_data) < 8:
            return anomalies

        # 1) 单指标统计异常
        stat_hits = {}
        for metric in self.metrics:
            values = [float(d.get(metric, 0) or 0) for d in metrics_data]
            if len(values) < 6:
                continue

            rz = np.abs(self._robust_z_scores(values))
            ewma = self._ewma(values)
            residual = np.array(values) - ewma
            residual_std = float(np.std(residual)) or 1e-6
            ewma_score = np.abs(residual) / residual_std

            for i, value in enumerate(values):
                if rz[i] > threshold or ewma_score[i] > threshold:
                    key = (i, metric)
                    stat_hits[key] = {
                        "timestamp": metrics_data[i].get("timestamp", ""),
                        "metric": metric,
                        "value": value,
                        "robust_z": float(rz[i]),
                        "ewma_score": float(ewma_score[i]),
                    }

        # 2) 多指标异常（IsolationForest）
        X = []
        for d in metrics_data:
            X.append([float(d.get(m, 0) or 0) for m in self.metrics])
        X_arr = np.array(X, dtype=float)

        scaler = StandardScaler()
        X_scaled = scaler.fit_transform(X_arr)
        iso = IsolationForest(contamination=0.1, random_state=42)
        labels = iso.fit_predict(X_scaled)  # -1 anomaly, 1 normal
        scores = -iso.score_samples(X_scaled)  # larger => more anomalous

        # 3) 融合并输出
        for i in range(len(metrics_data)):
            metric_events = [v for (idx, _), v in stat_hits.items() if idx == i]
            iso_flag = labels[i] == -1

            if metric_events or iso_flag:
                severity = "high" if (len(metric_events) >= 2 or scores[i] > np.percentile(scores, 90)) else "medium"
                anomalies.append(
                    {
                        "timestamp": metrics_data[i].get("timestamp", ""),
                        "severity": severity,
                        "fusion": {
                            "stat_metric_hits": len(metric_events),
                            "isolation_forest": bool(iso_flag),
                            "iforest_score": float(scores[i]),
                        },
                        "details": metric_events,
                    }
                )

        return anomalies

    def analyze_trend(self, metrics_data: List[Dict[str, Any]]) -> Dict[str, Any]:
        """分析趋势"""
        trends: Dict[str, Any] = {}

        for metric in self.metrics:
            values = [float(d.get(metric, 0) or 0) for d in metrics_data]
            if len(values) < 2:
                trends[metric] = "insufficient_data"
                continue

            x = np.arange(len(values)).reshape(-1, 1)
            y = np.array(values)

            model = LinearRegression()
            model.fit(x, y)
            slope = float(model.coef_[0])

            if abs(slope) < 0.01:
                trends[metric] = "stable"
            elif slope > 0:
                trends[metric] = "increasing"
            else:
                trends[metric] = "decreasing"

        return trends


class IndexRecommender:
    """智能索引推荐引擎（频次 + 风险提示）"""

    @staticmethod
    def analyze_query_patterns(queries: List[str]) -> Dict[str, Any]:
        """分析查询模式"""
        patterns = {
            "where_columns": {},
            "order_by_columns": {},
            "group_by_columns": {},
            "join_columns": {},
        }

        for query in queries:
            query_upper = query.upper()

            where_match = re.search(r"WHERE\s+(.+?)(?:\s+(?:GROUP|ORDER|LIMIT|$))", query_upper, re.DOTALL)
            if where_match:
                where_clause = where_match.group(1)
                cols = re.findall(r"([A-Z0-9_\.]+)\s*[=<>]", where_clause)
                for col in cols:
                    patterns["where_columns"][col] = patterns["where_columns"].get(col, 0) + 1

            order_match = re.search(r"ORDER\s+BY\s+(.+?)(?:\s+(?:LIMIT|$))", query_upper, re.DOTALL)
            if order_match:
                order_clause = order_match.group(1)
                cols = [col.strip() for col in order_clause.split(",") if col.strip()]
                for col in cols:
                    patterns["order_by_columns"][col] = patterns["order_by_columns"].get(col, 0) + 1

            group_match = re.search(r"GROUP\s+BY\s+(.+?)(?:\s+(?:ORDER|LIMIT|$))", query_upper, re.DOTALL)
            if group_match:
                group_clause = group_match.group(1)
                cols = [col.strip() for col in group_clause.split(",") if col.strip()]
                for col in cols:
                    patterns["group_by_columns"][col] = patterns["group_by_columns"].get(col, 0) + 1

            join_matches = re.findall(
                r"JOIN\s+[A-Z0-9_]+\s+ON\s+(.+?)(?:\s+(?:JOIN|WHERE|GROUP|ORDER|LIMIT|$))",
                query_upper,
                re.DOTALL,
            )
            for join_clause in join_matches:
                cols = re.findall(r"([A-Z0-9_]+\.[A-Z0-9_]+)", join_clause)
                for col in cols:
                    patterns["join_columns"][col] = patterns["join_columns"].get(col, 0) + 1

        return patterns

    @staticmethod
    def _normalize_column(col: str) -> str:
        col = col.strip()
        if "." in col:
            return col.split(".")[-1]
        return col

    @staticmethod
    def recommend_indexes(patterns: Dict[str, Any]) -> List[Dict[str, Any]]:
        """推荐索引（含收益、风险、冗余提示）"""
        recommendations: List[Dict[str, Any]] = []
        seen = set()

        def add_reco(col: str, source: str, count: int, benefit: str):
            normalized_col = IndexRecommender._normalize_column(col)
            key = normalized_col
            if key in seen:
                return
            seen.add(key)

            write_amplification_risk = "high" if count >= 10 else "medium" if count >= 5 else "low"
            confidence = min(0.95, 0.5 + count * 0.05)

            recommendations.append(
                {
                    "type": "INDEX",
                    "columns": [normalized_col],
                    "source": source,
                    "reason": f"{source} 中频繁出现（{count}次）",
                    "benefit": benefit,
                    "risk": {
                        "write_amplification": write_amplification_risk,
                        "redundancy_check_required": True,
                    },
                    "confidence": round(confidence, 2),
                }
            )

        for col, count in patterns.get("where_columns", {}).items():
            if count >= 3:
                add_reco(col, "WHERE", count, "high" if count > 6 else "medium")

        for col, count in patterns.get("join_columns", {}).items():
            if count >= 2:
                add_reco(col, "JOIN", count, "high" if count > 4 else "medium")

        for col, count in patterns.get("order_by_columns", {}).items():
            if count >= 2:
                add_reco(col, "ORDER BY", count, "medium")

        for col, count in patterns.get("group_by_columns", {}).items():
            if count >= 2:
                add_reco(col, "GROUP BY", count, "medium")

        return recommendations


class SQLOptimizer:
    """SQL改写助手（仅给建议，不直接执行）"""

    @staticmethod
    def rewrite(sql: str) -> str:
        """重写SQL语句（保守策略）"""
        sql = re.sub(r"\s+", " ", sql).strip()

        # 不再做硬编码列替换，仅提示型变换
        # 若无 LIMIT 且有 ORDER BY，仅附加注释提示，不改变语义
        sql_upper = sql.upper()
        if "ORDER BY" in sql_upper and "LIMIT" not in sql_upper:
            sql = f"{sql} /* suggestion: consider LIMIT for pagination */"

        return sql

    @staticmethod
    def analyze_complexity(sql: str) -> Dict[str, Any]:
        """分析SQL复杂度"""
        complexity = {
            "nested_level": 0,
            "join_count": 0,
            "where_conditions": 0,
            "order_by_count": 0,
            "group_by_count": 0,
            "complexity_score": 0,
        }

        sql_upper = sql.upper()
        complexity["nested_level"] = sql_upper.count("SELECT") - 1
        complexity["join_count"] = sql_upper.count("JOIN")
        complexity["where_conditions"] = sql_upper.count("AND") + sql_upper.count("OR")
        complexity["order_by_count"] = max(0, len([c for c in sql_upper.split("ORDER BY") if c.strip()]) - 1)
        complexity["group_by_count"] = max(0, len([c for c in sql_upper.split("GROUP BY") if c.strip()]) - 1)

        complexity["complexity_score"] = (
            complexity["nested_level"] * 3
            + complexity["join_count"] * 2
            + complexity["where_conditions"] * 1
            + complexity["order_by_count"] * 1
            + complexity["group_by_count"] * 1
        )

        return complexity
