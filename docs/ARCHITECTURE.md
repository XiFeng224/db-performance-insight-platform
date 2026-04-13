# 智值守 - 系统架构说明（ARCHITECTURE）

## 1. 架构总览

```text
┌───────────────────────────────────────────────────────────────────┐
│                           浏览器 / 移动端                         │
│   首页 / 工单中心 / AI助手 / 优化建议 / 复盘对比 / 排班 / 知识库   │
└───────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌───────────────────────────────────────────────────────────────────┐
│                           Nginx 网关层                            │
│   /            -> frontend/dist（React 静态资源）                 │
│   /api         -> FastAPI（127.0.0.1:8000）                       │
└───────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌───────────────────────────────────────────────────────────────────┐
│                         FastAPI 应用服务层                         │
│  assistant / tickets / duty / knowledge / optimization / alerts   │
│  comparison / metrics / ops                                       │
└───────────────────────────────────────────────────────────────────┘
                 │                              │
                 ▼                              ▼
┌──────────────────────────────┐    ┌──────────────────────────────┐
│        数据存储层             │    │        AI增强服务层           │
│ SQLite / MySQL               │    │ Qwen API + 规则引擎回退       │
│ tickets / events / ratings   │    │ mode=auto|rule|llm           │
│ knowledge / optimization      │    │ 失败自动 fallback             │
│ ai_call_logs                 │    │                                │
└──────────────────────────────┘    └──────────────────────────────┘
```

---

## 2. 分层职责

### 2.1 展示层（Frontend）
- 技术：React + TypeScript + Ant Design + Vite
- 作用：提供统一交互入口与状态展示
- 特点：
  - 响应式布局
  - 全局状态条（未闭环/P1/待验证）
  - 批量操作（优化建议批量转工单等）

核心文件：
- `frontend/src/App.tsx`
- `frontend/src/components/*`
- `frontend/src/services/api.ts`

### 2.2 网关层（Nginx）
- 作用：
  - 托管前端静态资源
  - 统一反向代理 API 请求
- 关键点：
  - 前端 `baseURL='/api'`
  - 避免写死 `localhost`

### 2.3 业务服务层（Backend）
- 技术：FastAPI + SQLAlchemy Async
- 作用：承载业务逻辑与流程编排

核心模块：
- `assistant.py`：问答/受理/交接/AI统计
- `tickets.py`：工单流转、ETA、评分、闭环回填
- `optimization.py`：优化建议生命周期
- `duty.py`：值班排班
- `knowledge.py`：知识库管理
- `comparison.py`：复盘与对比分析

### 2.4 数据层
关键模型：
- `tickets`：工单主数据
- `ticket_events`：事件留痕
- `ticket_ratings`：满意度反馈
- `knowledge_articles`：知识沉淀
- `optimization_suggestions`：优化执行跟踪
- `ai_call_logs`：AI可观测日志

### 2.5 AI增强层
- 服务：`backend/app/services/qwen_service.py`
- 能力：
  - 自然语言受理增强
  - 问答增强
  - 失败回退规则引擎
- 可观测：
  - `engine`
  - `source`
  - `fallback`
  - `latency_ms`

---

## 3. 核心业务时序

## 3.1 工单受理与闭环时序

```text
用户 -> 前端(工单受理) -> /api/assistant/intake(mode=auto)
    -> 后端规则引擎生成基础草稿
    -> (可选) Qwen增强
    -> 返回草稿(engine/source/fallback)

前端 -> /api/tickets/ 创建工单
值班员 -> /api/tickets/{id}/assign 自动派单
值班员 -> /api/tickets/{id}/eta 设置ETA
值班员 -> /api/tickets/{id}/status 流转状态
关闭时 -> 可回填 adopted_optimization_suggestion_id
系统 -> 关联优化建议状态为 done/applied
用户 -> /api/tickets/{id}/rating 提交评分
```

## 3.2 诊断与优化执行时序

```text
诊断页 -> 获取风险指标 + 优化建议执行状态
        -> 显示 doing/verifying/done 进度
        -> 跳转优化页(带 status 筛选)

优化页 -> 批量选择建议
       -> 批量转工单
       -> 成功后批量状态改为 doing
       -> 部分失败给出失败明细
```

---

## 4. 可观测与可靠性设计

### 4.1 可观测
- AI调用日志落表：`ai_call_logs`
- 指标接口：`GET /api/assistant/stats`
  - `count`
  - `avg_latency_ms`
  - `fallback_rate`
  - 引擎/场景分布

### 4.2 可靠性
- 双轨策略：规则引擎可独立运行
- 模型不可用自动回退，不阻塞主流程
- 批量操作有确认弹窗与失败明细

---

## 5. 部署架构（比赛可落地）

```text
ECS (Ubuntu)
  ├─ campus-backend.service (FastAPI)
  ├─ Nginx (80)
  └─ 项目目录 /opt/db-performance-insight-platform
```

关键路径：
- 前端入口：`http://<公网IP>/`
- API入口：`http://<公网IP>/api/...`

---

## 6. 架构亮点（用于答辩）

1. **完整闭环**：受理 -> 处置 -> 优化 -> 复盘
2. **工程化AI**：不是黑盒接入，具备回退与量化监控
3. **可演示性强**：一键初始化数据，场景路径清晰
4. **可扩展性**：模块边界清晰，易增功能与多端适配
