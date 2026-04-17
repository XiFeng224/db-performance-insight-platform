# 智值守 - 校园实验室智能应急协作平台
面向**校园实验室 / 机房 / 社团服务**的智能值守与应急协作平台。


> Slogan：智联值守，秒级响应，闭环复盘。

---

## 0. 业务闭环流程（MVP）

```text
用户报修提交
  -> 知识库自助命中（可拦截无效工单）
  -> 工单创建（待受理）
  -> 动态智能派单（按值班时段 + 负载均衡）
  -> 值班员接单并设置ETA
  -> 处理中（Runbook协作 + 操作留痕）
  -> 待验收
  -> 已关闭
  -> 用户评分（响应速度/服务态度）
  -> 服务质量画像与复盘分析
```

## 1. 项目亮点（当前版本）

### 1.1 校园场景核心能力

- 告警响应中心（接单、转派、升级）
- 应急协作中心（Runbook 生成与执行）
- 操作留痕（持久化、筛选、自动刷新、导出）
- 复盘与历史对比（处置前后指标变化）
- AI 辅助分析（根因线索、建议优先级）

### 1.2 可扩展能力（插件化）

- 数据库诊断（慢查询、执行计划、优化建议）
- 容量基线与风险预测
- 变更风险评估
- 规则引擎与告警阈值配置

---

## 2. 技术栈

### 后端

- FastAPI
- SQLAlchemy（Async）
- MySQL
- scikit-learn / numpy / pandas（AI & 数据处理）

### 前端

- React + TypeScript
- Vite
- Ant Design
- ECharts / Recharts

---

## 3. 项目结构

```text
项目一/
├── backend/
│   ├── app/
│   │   ├── api/
│   │   │   ├── assistant.py          # AI问答/受理/交接 + 调用统计
│   │   │   ├── tickets.py            # 工单全流程（创建/派单/状态/评分）
│   │   │   ├── duty.py               # 值班排班
│   │   │   ├── knowledge.py          # 知识库管理
│   │   │   ├── optimization.py       # 优化建议与执行计划
│   │   │   ├── alerts.py             # 告警响应
│   │   │   ├── comparison.py         # 复盘与历史对比
│   │   │   ├── ops.py                # 应急协作中心
│   │   │   ├── metrics.py            # 指标查询
│   │   │   └── ...
│   │   ├── services/
│   │   │   └── qwen_service.py       # 千问模型调用封装
│   │   ├── models/
│   │   │   └── database.py           # 工单/知识库/优化建议/AI日志等模型
│   │   ├── config.py                 # 环境变量与系统配置
│   │   └── main.py
│   ├── scripts/
│   │   └── seed_demo_data.py         # 演示数据初始化脚本
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── HomePortal.tsx        # 平台首页
│   │   │   ├── TicketSubmitPage.tsx  # 工单提交
│   │   │   ├── TicketCenterPage.tsx  # 工单中心
│   │   │   ├── AIAssistantPage.tsx   # AI值班助手
│   │   │   ├── AIDiagnosticPage.tsx  # 诊断与升级研判
│   │   │   ├── OptimizationPage.tsx  # 优化建议执行
│   │   │   └── ...
│   │   ├── services/
│   │   │   └── api.ts                # 前端统一 API 封装
│   │   ├── utils/
│   │   │   └── campusMeta.ts         # 校园场景元数据
│   │   ├── App.tsx                   # 主框架与路由
│   │   └── index.css                 # 全局 UI 风格
│   └── package.json
├── docs/
│   ├── API.md
│   ├── DEVELOPMENT.md
│   ├── DEPLOYMENT.md
│   ├── COMPETITION_SCRIPT.md         # 比赛演示脚本
│   └── DEMO_CHECKLIST.md             # 现场检查清单
├── start.bat                         # 一键启动（Windows）
└── README.md
```

### 3.1 系统框架（业务 + 技术）

```text
前端展示层（React + AntD）
  ├─ 值班门户/工单中心/优化中心/AI助手
  └─ 通过 /api 统一访问后端

后端服务层（FastAPI）
  ├─ 工单服务（tickets）
  ├─ 排班服务（duty）
  ├─ 知识库服务（knowledge）
  ├─ 诊断优化服务（optimization/ai/comparison）
  └─ AI服务（assistant + qwen_service）

数据层（SQLite/MySQL）
  ├─ tickets / ticket_events / ticket_ratings
  ├─ knowledge_articles
  ├─ optimization_suggestions
  └─ ai_call_logs（engine/source/fallback/latency）
```

### 3.2 关键闭环路径

```text
自然语言报障
  -> AI/规则受理（可降级）
  -> 工单创建与派单
  -> 处置执行与ETA更新
  -> 关联优化建议执行
  -> 工单关闭与用户评分
  -> 复盘分析与班次交接
```

### 3.3 部署框架（比赛演示版）

```text
浏览器
  -> Nginx (80)
      ├─ /            -> frontend/dist (React 静态资源)
      └─ /api         -> FastAPI (127.0.0.1:8000)
                           ├─ assistant / tickets / duty / knowledge
                           ├─ optimization / comparison / alerts / ops
                           └─ qwen_service（千问增强，失败自动回退规则）
```

### 3.4 前端页面路由总览

- `/`：平台首页（值班总览）
- `/ticket-submit`：工单提交
- `/ticket-center`：工单中心（派单/流转/评分）
- `/duty-schedule`：值班排班
- `/knowledge-center`：知识库管理
- `/ai-assistant`：AI值班助手（问答/受理/交接）
- `/optimization`：优化建议执行
- `/comparison`：复盘与历史对比
- `/alerts`：告警响应中心
- `/ops-center`：应急协作中心

### 3.5 比赛评审关注点映射

- **完整性**：工单全流程 + 排班 + 知识库 + 复盘
- **创新性**：规则引擎 + 千问增强双轨架构
- **工程性**：AI调用日志（engine/source/fallback/latency）可量化
- **可用性**：批量操作、状态条、异常兜底、演示数据一键初始化

---

## 4. 快速启动

### 4.0 准备环境（首次使用）

先执行准备脚本完成环境与演示数据初始化：

- Windows：`prepare.bat`
- Linux/Mac：`./prepare.sh`

准备脚本通常会完成：
- 创建或检查后端虚拟环境（优先 `.venv`）
- 安装后端依赖
- 初始化或重置演示数据（`backend/scripts/seed_demo_data.py`）

### 4.1 比赛模式一键启动（推荐）

在项目根目录直接运行：

```bash
start.bat
```

启动脚本会自动完成：
- 启动后端（`8000`）与前端（`5173`）
- 输出访问地址
- 在失败时给出基础排查提示

> 适合比赛现场快速恢复环境。

## 4.1 环境要求

- Python 3.10+
- Node.js 18+
- MySQL 8.0+（可选；无 MySQL 时部分接口使用降级 / demo 数据）

### 4.2 后端启动

```bash
cd backend
python -m venv venv
# Windows
venv\Scripts\activate
# Linux/Mac
# source venv/bin/activate

python -m pip install --upgrade pip
pip install -r requirements.txt
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

### 4.3 前端启动

```bash
cd frontend
npm install
npm run dev
```

### 4.4 访问地址

- 本地前端：`http://localhost:5173`
- 本地后端：`http://localhost:8000`
- OpenAPI：`http://localhost:8000/docs`
- 生产部署：通过 Nginx 域名或公网 IP 访问 `/`，接口统一走 `/api`

---

## 5. 关键接口（摘要）

- `GET /api/metrics/database`
- `GET /api/slow-queries/`
- `POST /api/execution-plans/analyze`
- `POST /api/optimization/generate-suggestions`
- `POST /api/ai/diagnose`

### Ops Center（新增）

- `GET /api/ops/instances`
- `GET /api/ops/workload-profile`
- `GET /api/ops/session-locks`
- `POST /api/ops/change-risk/assess`
- `GET /api/ops/capacity/baseline`
- `POST /api/ops/runbook/generate`
- `POST /api/ops/action-log`
- `GET /api/ops/action-log`

> 完整请求/响应示例见：`docs/API.md`

---

## 6. 对标与创新（可用于答辩）

### 借鉴（对标 DBdoctor）

- 诊断闭环思路（发现 -> 分析 -> 建议 -> 验证）
- 模块化运维视角（实例、锁、容量、变更风险）
- 工程可追踪性（操作留痕）

### 创新（本项目）

- 可解释 AI 证据链
- 根因概率图 + 建议冲突检测
- SLA 视角评估
- 教学/竞赛友好的可视化与可复盘路径

---

## 7. 核心模块说明（按代码实现）

### 7.1 AI 值班助手（`backend/app/api/assistant.py`）

- `POST /api/assistant/chat`：校园事件问答（知识库优先 + 千问增强 + 规则兜底）
- `POST /api/assistant/intake`：自然语言转工单草稿（支持 `mode=auto|rule|llm`）
- `POST /api/assistant/handover-summary`：值班交接摘要生成
- `GET /api/assistant/stats`：AI调用统计（调用数、平均延迟、回退率）

### 7.2 工单中心（`backend/app/api/tickets.py`）

- 工单创建、自动派单、ETA设置、状态流转、事件时间线
- 工单关闭时可回填采用的优化建议（闭环追踪）
- 用户评分与服务满意度统计

### 7.3 优化建议中心（`backend/app/api/optimization.py`）

- 优化建议生成/查询/状态更新
- 批量执行场景支撑（前端批量改状态/转工单）
- 与工单闭环联动（done/applied）

### 7.4 前端主框架（`frontend/src/App.tsx`）

- 左侧导航 + 内容路由 + 顶部全局状态条
- 全站统一视觉风格（`index.css`）
- 移动端折叠与响应式布局

---

## 8. 数据模型（关键表）

- `tickets`：工单主表（标题、级别、状态、ETA、地点）
- `ticket_events`：工单事件时间线（创建/派单/状态变更/评分）
- `ticket_ratings`：服务评分（响应速度/服务态度）
- `knowledge_articles`：知识库条目（浏览/解决统计）
- `optimization_suggestions`：优化建议（执行状态、负责人、完成时间）
- `ai_call_logs`：AI调用日志（engine/source/fallback/latency/success）

> 这些模型定义位于：`backend/app/models/database.py`

---

## 9. 环境变量（关键）

在 `backend/.env` 中配置：

```env
LLM_ENABLED=true
QWEN_API_KEY=你的千问Key
QWEN_MODEL=qwen-turbo
QWEN_TIMEOUT_SECONDS=6
```

可选：

```env
DATABASE_URL=sqlite+aiosqlite:///./data/platform.db
DEBUG=true
```

---

## 10. 线上部署（ECS/Nginx）

### 10.1 部署目标

- 公网入口：`http://<公网IP>/`
- Nginx 负责静态资源与 `/api` 反向代理
- FastAPI 常驻在 `127.0.0.1:8000`

### 10.2 Nginx 反向代理示意

```nginx
server {
    listen 80;
    server_name _;

    root /opt/db-performance-insight-platform/frontend/dist;
    index index.html;

    location /api {
        proxy_pass http://127.0.0.1:8000;
    }

    location / {
        try_files $uri /index.html;
    }
}
```

### 10.3 验收清单

- `http://<公网IP>/` 可访问
- `http://<公网IP>/api/assistant/stats` 可返回 JSON
- 前端页面接口无“网络错误”

---

## 11. 常见问题排查

### 11.1 页面提示“网络错误，请检查网络连接”

- 检查前端 `baseURL` 是否为 `'/api'`（不要写死 `localhost`）
- 重新执行前端构建：`npm run build`
- 重启 Nginx：`systemctl restart nginx`

### 11.2 Nginx 返回 500

- 多数是前端 `dist/index.html` 不存在
- 重新构建前端并确认 `dist` 目录
- 查看日志：`tail -n 80 /var/log/nginx/error.log`

### 11.3 后端服务异常

- 查看状态：`systemctl status campus-backend`
- 查看日志：`journalctl -u campus-backend -n 100 --no-pager`

---

## 12. 文档索引

- API 文档：`docs/API.md`
- 开发指南：`docs/DEVELOPMENT.md`
- 部署指南：`docs/DEPLOYMENT.md`
- 比赛脚本：`docs/COMPETITION_SCRIPT.md`
- 现场清单：`docs/DEMO_CHECKLIST.md`

---

## 13. 许可证

MIT
