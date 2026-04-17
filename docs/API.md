# API 文档

本文档覆盖当前版本后端核心接口，服务于“智值守 - 校园实验室智能应急协作平台”。

主流程：工单受理 -> 告警响应 -> 应急协作（Runbook）-> 操作留痕 -> 复盘对比。

数据库诊断能力保留为扩展模块（可用于更深层定位与优化）。

- Base URL: `http://localhost:8000/api`
- Swagger: `http://localhost:8000/docs`

---

## 1. 通用说明

### 1.1 响应状态码

- `200` 成功
- `400` 参数错误
- `404` 资源不存在
- `500` 服务器异常

### 1.2 错误响应（FastAPI 默认）

```json
{
  "detail": "error message"
}
```

---

## 2. 监控与慢查询

### 2.1 获取数据库指标

- `GET /metrics/database`

### 2.2 慢查询列表

- `GET /slow-queries/`
- Query:
  - `skip` `limit`
  - `database`（可选）
  - `min_execution_time`（可选）

### 2.3 慢查询统计

- `GET /slow-queries/stats/summary`

### 2.4 慢查询聚类

- `GET /slow-queries/clusters/top?top_n=10`

---

## 3. 执行计划与优化

### 3.1 执行计划分析

- `POST /execution-plans/analyze`

```json
{
  "sql": "SELECT * FROM users WHERE id = 1"
}
```

### 3.2 生成优化建议

- `POST /optimization/generate-suggestions`

```json
{
  "slow_query_id": 1,
  "sql": "SELECT * FROM users WHERE id = 1"
}
```

---

## 4. AI 诊断（增强版）

### 4.1 性能预测

- `POST /ai/predict`

### 4.2 SQL 优化建议

- `POST /ai/optimize-sql`

### 4.3 索引推荐

- `POST /ai/recommend-indexes`

### 4.4 诊断报告（重点）

- `POST /ai/diagnose`

返回包含：

- `trace_id`
- `summary`
- `trends`
- `anomalies`
- `recommendations`
- `evidence_chain`
- `root_cause_probabilities`（根因概率图）
- `recommendation_conflicts`（建议冲突检测）
- `sla_assessment`（SLA 视角评估）
---

## 5. Ops Center（新增）

## 5.1 实例管理

- `GET /ops/instances`

返回重点字段：

- `instances[]`（含 `env` / `biz_line` / `criticality` / `tags`）
- `group_summary.by_env`
- `group_summary.by_criticality`

## 5.2 工作负载画像

- `GET /ops/workload-profile`

返回：

- `workload_type`
- `read_ratio` / `write_ratio`
- `patterns`
- `hotspots`

## 5.3 会话与锁诊断

- `GET /ops/session-locks`

返回：

- `sessions`
- `blockers`
- `summary`

## 5.4 变更风险评估

- `POST /ops/change-risk/assess`

```json
{
  "sql": "ALTER TABLE users ADD INDEX idx_users_created_at(created_at);",
  "change_type": "ddl"
}
```

返回：

- `risk_level`
- `score`
- `reasons`
- `guards`
- `estimated_impact`

## 5.5 容量基线与预测

- `GET /ops/capacity/baseline`

返回：

- `baseline`（近7天）
- `forecast_7d`（未来7天）
- `capacity_risk`

## 5.6 Runbook 自动生成

- `POST /ops/runbook/generate`

```json
{
  "incident_type": "lock_wait",
  "severity": "high"
}
```

返回：

- `runbook.title`
- `runbook.steps`
- `runbook.commands`
- `runbook.rollback`
- `sla_guard`

## 5.7 操作留痕

### 写入

- `POST /ops/action-log`

```json
{
  "action": "generate_runbook",
  "instance": "MySQL-Primary",
  "result": "incident=lock_wait,severity=high"
}
```

### 查询（支持过滤）

- `GET /ops/action-log`

Query:

- `limit`（默认 20）
- `action`（可选）
- `instance`（可选）
- `time_range`（`1h` / `24h` / `7d` / `all`）

---

## 6. 其它模块

- 告警：`/alerts/*`
- 配置：`/config/*`
- 评分：`/scoring/*`
- 导出：`/export/*`
- 历史对比：`/comparison/*`

---

## 7. 建议调试顺序

1. `GET /metrics/database`
2. `GET /slow-queries/`
3. `POST /ai/diagnose`
4. `GET /ops/instances`
5. `POST /ops/change-risk/assess`
6. `POST /ops/runbook/generate`
7. `POST/GET /ops/action-log`
