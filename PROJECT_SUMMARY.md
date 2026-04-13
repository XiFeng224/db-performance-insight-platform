# 智值守 - 校园实验室智能应急协作平台 - 项目总结

## 1. 项目定位与问题背景

本项目面向高校日常运维与教学保障场景，聚焦“故障受理慢、处置链路散、复盘数据弱、交接不标准”四类常见问题，构建了一个可落地、可演示、可扩展的 B/S 架构平台。

核心目标：
- 让值班流程从“经验驱动”升级为“流程化、数据化、可复盘”
- 在不牺牲稳定性的前提下引入 AI，提升受理效率与处置质量

适配场景：
- 教学保障（课堂中断、投影异常、课程系统不可用）
- 机房保障（网络故障、共享盘不可用、实验环境异常）
- 社团保障（直播推流、活动设备、场地技术支持）

---

## 2. 业务闭环（已落地）

```text
自然语言报障
  -> AI/规则双轨受理（可降级）
  -> 工单创建（风险评分自动分级 + 地点识别 + 演练模式）
  -> 值班派单（按班次与负载）
  -> ETA设置与处理中流转
  -> 关联优化建议执行
  -> 工单关闭（可回填采用建议）
  -> 用户评分
  -> 复盘分析与交接摘要
```

说明：
- AI失败不会阻塞流程，自动回退规则引擎。
- 诊断->优化->工单->复盘形成可追踪闭环。

---

## 3. 技术架构

### 3.1 整体架构

```text
浏览器（PC/Mobile）
  -> Nginx (80)
      ├─ /      -> 前端静态资源（React + Vite）
      └─ /api   -> FastAPI（127.0.0.1:8000）
                    ├─ 工单/排班/知识库/优化/复盘/告警
                    └─ AI助手（Qwen + 规则回退）
  -> SQLite/MySQL 持久化存储
```

### 3.2 技术栈

后端：
- FastAPI
- SQLAlchemy（Async）
- Pydantic
- httpx（模型调用）

前端：
- React + TypeScript
- Vite
- Ant Design
- ECharts / Recharts

AI：
- 通义千问（Qwen）API
- 双轨策略：`rule + llm`，支持 `mode=auto|rule|llm`

---

## 4. 核心模块实现

### 4.1 AI值班助手（assistant）

接口：`backend/app/api/assistant.py`
- `POST /api/assistant/chat`：知识库优先问答 + 千问增强 + 兜底
- `POST /api/assistant/intake`：自然语言转工单草稿
- `POST /api/assistant/handover-summary`：班次交接摘要生成
- `GET /api/assistant/stats`：AI调用统计

工程特性：
- 记录 `engine/source/fallback/latency`
- 模型异常自动回退，保障主流程可用

### 4.2 工单中心（tickets）

接口：`backend/app/api/tickets.py`
- 工单创建、查询、自动派单、状态流转、ETA
- 事件时间线（`ticket_events`）
- 服务评价（`ticket_ratings`）
- 关闭工单时可回填“采用优化建议”

### 4.3 优化建议中心（optimization）

接口：`backend/app/api/optimization.py`
- 优化建议查询/更新执行状态
- 前端支持批量操作（批量改状态/负责人、批量转工单）
- 与工单闭环联动（done/applied）

### 4.4 知识库与排班

接口：
- `backend/app/api/knowledge.py`
- `backend/app/api/duty.py`

能力：
- 知识条目维护 + 命中复用
- 班次配置支撑自动派单

### 4.5 复盘与运营视角

页面：`ComparisonPage`、`AIDiagnosticPage`
- 对比关键指标
- 追踪优化执行进度
- 支撑交接与复盘汇报

---

## 5. 数据模型（关键表）

定义文件：`backend/app/models/database.py`

- `tickets`：工单主表
- `ticket_events`：工单事件日志
- `ticket_ratings`：用户评分
- `knowledge_articles`：知识库条目
- `optimization_suggestions`：优化建议执行信息
- `duty_shifts`：值班排班
- `ai_call_logs`：AI调用日志（engine/source/fallback/latency/success）

---

## 6. 前端框架与页面路由

主框架：`frontend/src/App.tsx`
- 左侧导航 + 主内容路由
- 顶部全局状态条（未闭环/P1/总工单/待验证）
- 新手引导与响应式布局

核心路由：
- `/` 平台首页
- `/ticket-submit` 工单提交
- `/ticket-center` 工单中心
- `/ticket-board` 进度看板
- `/duty-schedule` 值班排班
- `/knowledge-center` 知识库管理
- `/ai-assistant` AI值班助手
- `/optimization` 优化建议
- `/comparison` 复盘对比
- `/alerts` 告警响应中心
- `/ops-center` 应急协作中心

---

## 7. AI工程化与可量化指标

本项目不是“只接模型”，而是工程化可控方案：
- 规则与模型双轨并行
- 模型超时/异常回退规则
- 全链路调用日志
- 可视化统计：调用数、平均延迟、回退率

评审价值：
- 可解释性：知道答案来自知识库、模型还是兜底
- 可靠性：AI故障不影响业务闭环
- 可运营性：能持续观察模型效果

---

## 8. 特色能力与完成度

### 8.1 功能完成度
- 工单全生命周期（提交->派单->处置->验收->关闭->评分）
- 值班排班管理
- 知识库管理
- AI问答/受理/交接
- 优化建议执行与批量操作
- 复盘与对比分析

### 8.2 产品体验
- 全局统一UI风格
- 状态标签与风险提示
- 批量操作确认与失败明细
- 空状态/异常状态友好提示

### 8.3 比赛演示友好
- 一键启动脚本：`start.bat`
- 演示数据脚本：`backend/scripts/seed_demo_data.py`
- 演示文档：`docs/COMPETITION_SCRIPT.md`
- 现场清单：`docs/DEMO_CHECKLIST.md`

---

## 9. 部署方案（ECS）

已验证部署模式：
- Nginx 托管前端静态资源
- `/api` 反代 FastAPI
- FastAPI 通过 systemd 常驻

推荐提交地址：
- `http://<公网IP>/`

验收项：
- 首页可访问
- `/api/assistant/stats` 可返回 JSON
- 前端无跨域/本地地址硬编码问题（`baseURL='/api'`）

---

## 10. 与赛事方向匹配

建议申报：**Web应用与开发**（主赛道）

匹配点：
- 标准 B/S 架构
- 真实业务流程闭环
- 管理信息系统能力（工单、排班、知识、统计）
- AI增强与算法应用（受理、摘要、建议）

---

## 11. 后续演进方向

短期：
- 加入账号体系与权限控制
- 增加部门/校区维度统计
- 丰富交接模板与消息通知

中期：
- 引入 RAG（知识检索增强）
- 强化 SLA 指标与预警
- 增加移动端轻量入口

长期：
- 校园多系统联动（教务/资产/网络）
- 自动化处置编排与审批闭环

---

## 12. 结论

本项目已从“数据库诊断工具”扩展为“校园值班协作平台”，完成了从事件受理到复盘改进的全链路实现，具备：
- 业务完整性
- 工程可靠性
- AI增强可控性
- 比赛展示可落地性

在当前版本下，项目能够满足软件应用与开发类赛事对“可用、可演示、可量化、可扩展”的核心要求。
