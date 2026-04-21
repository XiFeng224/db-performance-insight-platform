# 智值守 - 系统架构说明

## 1. 项目定位

“智值守”面向高校实验室值班、告警处置与复盘优化场景，目标是把告警、工单、应急协作、知识沉淀与优化复盘串成一个可执行、可追踪、可量化的闭环平台。

---

## 2. 架构总览

```text
┌───────────────────────────────────────────────────────────────────┐
│                           浏览器 / 移动端                         │
│  首页 / 告警中心 / 工单中心 / AI助手 / 优化建议 / 复盘 / 知识库  │
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
│  comparison / metrics / ops / ai_logs                             │
└───────────────────────────────────────────────────────────────────┘
                 │                              │
                 ▼                              ▼
┌──────────────────────────────┐    ┌──────────────────────────────┐
│        数据存储层             │    │        AI增强服务层           │
│ SQLite / MySQL               │    │ Qwen API + 规则引擎回退       │
│ tickets / events / ratings   │    │ mode=auto|rule|llm           │
│ knowledge / optimization      │    │ 失败自动 fallback             │
│ ai_call_logs                 │    │ latency / source / engine     │
└──────────────────────────────┘    └──────────────────────────────┘
```

---

## 3. 分层职责

### 3.1 展示层（Frontend）
- 技术栈：React + TypeScript + Ant Design + Vite
- 作用：提供统一入口、页面导航、状态展示与交互操作
- 典型能力：
  - 响应式布局
  - 批量操作与二次确认
  - AI结果展示与回退标识
  - 复盘数据和指标可视化

核心文件：
- `frontend/src/App.tsx`
- `frontend/src/components/*`
- `frontend/src/services/api.ts`

### 3.2 网关层（Nginx）
- 作用：
  - 托管前端静态资源
  - 统一转发 `/api` 请求到后端
- 关键点：
  - 前端统一使用相对路径 `baseURL='/api'`
  - 避免把环境地址写死到代码中

### 3.3 业务服务层（Backend）
- 技术栈：FastAPI + SQLAlchemy Async
- 作用：承载业务逻辑、流程编排和状态流转

核心模块：
- `assistant.py`：受理、问答、交接摘要、AI统计
- `tickets.py`：工单创建、派单、ETA、评分、闭环
- `optimization.py`：优化建议生命周期与批量转工单
- `duty.py`：值班排班与班次管理
- `knowledge.py`：知识库检索与维护
- `comparison.py`：复盘与对比分析
- `ops.py`：运维流程、变更风险、Runbook 等

### 3.4 数据层
主要数据对象：
- `tickets`：工单主数据
- `ticket_events`：状态流转与事件留痕
- `ticket_ratings`：满意度反馈
- `knowledge_articles`：知识沉淀
- `optimization_suggestions`：优化执行跟踪
- `ai_call_logs`：AI 调用与回退记录

### 3.5 AI增强层
- 服务文件：`backend/app/services/qwen_service.py`
- 作用：
  - 自然语言受理增强
  - 问答与摘要生成
  - 失败回退到规则引擎
- 可观测字段：
  - `engine`
  - `source`
  - `fallback`
  - `latency_ms`

---

## 4. 核心业务时序

### 4.1 工单受理与闭环时序

```text
用户 -> 前端(工单受理) -> /api/assistant/intake(mode=auto)
    -> 后端规则引擎生成基础草稿
    -> (可选) Qwen 增强
    -> 返回草稿(engine/source/fallback)

前端 -> /api/tickets/ 创建工单
值班员 -> /api/tickets/{id}/assign 自动派单
值班员 -> /api/tickets/{id}/eta 设置 ETA
值班员 -> /api/tickets/{id}/status 流转状态
关闭时 -> 可回填 adopted_optimization_suggestion_id
系统 -> 关联优化建议状态为 done/applied
用户 -> /api/tickets/{id}/rating 提交评分
```

### 4.2 诊断与优化执行时序

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

## 5. 可观测与可靠性设计

### 5.1 可观测
- AI 调用日志落表：`ai_call_logs`
- 统计接口：`GET /api/assistant/stats`
- 常见指标：
  - 调用次数 `count`
  - 平均耗时 `avg_latency_ms`
  - 回退率 `fallback_rate`
  - 场景分布 / 引擎分布

### 5.2 可靠性
- 双轨策略：规则引擎可独立运行
- 模型不可用时自动回退，不阻塞主流程
- 批量操作提供确认弹窗和失败明细
- 关键操作支持幂等与状态校验

---

## 6. 部署架构（比赛可落地）

```text
ECS (Ubuntu)
  ├─ campus-backend.service (FastAPI)
  ├─ Nginx (80)
  └─ 项目目录 /opt/db-performance-insight-platform
```

关键访问地址：
- 前端入口：`http://<公网IP>/`
- API 入口：`http://<公网IP>/api/...`

---

## 7. 架构亮点（答辩可直接讲）

1. **完整闭环**：受理 -> 处置 -> 优化 -> 复盘
2. **工程化 AI**：不是黑盒接入，具备回退与量化监控
3. **演示稳定**：支持演示数据与降级策略，比赛现场可控
4. **扩展性好**：模块边界清晰，便于后续接入更多角色与设备
