from datetime import datetime, timedelta

def _iso(dt: datetime) -> str:
    return dt.isoformat()


def test_comparison_metrics_invalid_range(client) -> None:

    now = datetime.utcnow()
    params = {
        "period1_start": _iso(now),
        "period1_end": _iso(now - timedelta(hours=1)),
        "period2_start": _iso(now - timedelta(hours=3)),
        "period2_end": _iso(now - timedelta(hours=2)),
    }

    resp = client.get("/api/comparison/metrics", params=params)
    assert resp.status_code == 400

    payload = resp.json()
    assert "detail" in payload
    assert payload["detail"]["code"] == "HTTP_400"


def test_comparison_metrics_happy_path(client) -> None:

    now = datetime.utcnow()
    params = {
        "period1_start": _iso(now - timedelta(hours=4)),
        "period1_end": _iso(now - timedelta(hours=3)),
        "period2_start": _iso(now - timedelta(hours=2)),
        "period2_end": _iso(now - timedelta(hours=1)),
    }

    resp = client.get("/api/comparison/metrics", params=params)
    assert resp.status_code == 200

    payload = resp.json()
    assert "period1" in payload and "period2" in payload
    assert "data_source" in payload
    assert "degraded" in payload
    assert "qps_change" in payload


def test_ai_optimize_sql_invalid_body(client) -> None:

    resp = client.post("/api/ai/optimize-sql", json={})
    assert resp.status_code in (400, 422)

    payload = resp.json()
    assert "detail" in payload


def test_ai_optimize_sql_happy_path(client) -> None:

    resp = client.post("/api/ai/optimize-sql", json={"sql": "SELECT * FROM users ORDER BY created_at"})
    assert resp.status_code == 200

    payload = resp.json()
    assert payload.get("mode") == "suggestion_only"
    assert payload.get("execution_policy") == "no_auto_execute"
    assert "optimized_sql_suggestion" in payload
    assert "suggestions" in payload


def test_ai_predict_insufficient_data(client) -> None:

    resp = client.post(
        "/api/ai/predict",
        json={
            "current_metrics": {
                "qps": 1200,
                "cpu_usage": 35,
                "memory_usage": 40,
                "disk_io": 25,
                "connections": 80,
                "slow_query_count": 1,
            },
            "steps": 3,
        },
    )

    # 在无历史慢查询数据时应返回参数/数据不足错误
    assert resp.status_code in (400, 422)
    payload = resp.json()
    assert "detail" in payload


def test_ai_diagnose_insufficient_data(client) -> None:

    resp = client.post(
        "/api/ai/diagnose",
        json=[
            {
                "timestamp": datetime.utcnow().isoformat(),
                "qps": 1000,
                "cpu_usage": 30,
                "memory_usage": 40,
                "disk_io": 20,
                "connections": 60,
                "slow_query_count": 1,
            }
        ],
    )

    assert resp.status_code == 400
    payload = resp.json()
    assert "detail" in payload


def test_ai_diagnose_happy_path(client) -> None:

    base = datetime.utcnow() - timedelta(hours=12)
    metrics_data = []
    for i in range(12):
        metrics_data.append(
            {
                "timestamp": (base + timedelta(hours=i)).isoformat(),
                "qps": 1000 + i * 10,
                "cpu_usage": 30 + i * 0.5,
                "memory_usage": 40 + i * 0.3,
                "disk_io": 20 + i * 0.4,
                "connections": 60 + i,
                "slow_query_count": max(0, i // 3),
            }
        )

    resp = client.post("/api/ai/diagnose", json=metrics_data)
    assert resp.status_code == 200

    payload = resp.json()
    assert "summary" in payload
    assert "trends" in payload
    assert "anomalies" in payload
    assert "recommendations" in payload
