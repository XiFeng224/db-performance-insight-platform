# 校园实验室智能值班与应急协作平台
面向**校园实验室 / 机房 / 社团服务**的值班响应与应急协作平台。


> 目标：让值班同学在告警发生后，快速定位、规范处置、可追溯复盘。

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
│   │   │   ├── ai.py
│   │   │   ├── alerts.py
│   │   │   ├── comparison.py
│   │   │   ├── config.py
│   │   │   ├── execution_plans.py
│   │   │   ├── export.py
│   │   │   ├── flamegraph.py
│   │   │   ├── metrics.py
│   │   │   ├── ops.py                # 运维中心接口（新增）
│   │   │   ├── optimization.py
│   │   │   ├── scoring.py
│   │   │   └── slow_queries.py
│   │   ├── models/
│   │   │   └── database.py           # 包含 OpsActionLog（新增）
│   │   └── main.py
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── HomePortal.tsx        # 平台首页（新增）
│   │   │   ├── OpsCenterPage.tsx     # 运维中心（新增）
│   │   │   ├── AIDiagnosticPage.tsx
│   │   │   └── ...
│   │   ├── services/
│   │   │   └── api.ts                # 各模块 API 封装
│   │   └── App.tsx
│   └── package.json
├── docs/
│   ├── API.md
│   ├── DEVELOPMENT.md
│   └── DEPLOYMENT.md
└── README.md
```

---

## 4. 快速启动

### 4.0 比赛模式一键启动（推荐）

在项目根目录直接运行：

```bash
start.bat
```

脚本会自动完成：
- 后端虚拟环境检测/创建（优先 `.venv`）
- 后端依赖安装
- 演示数据一键重置（`backend/scripts/seed_demo_data.py`）
- 启动后端（`8000`）与前端（`5173`）

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

- 前端：`http://localhost:3000`
- 后端：`http://localhost:8000`
- OpenAPI：`http://localhost:8000/docs`

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

## 7. 文档索引

- API 文档：`docs/API.md`
- 开发指南：`docs/DEVELOPMENT.md`
- 部署指南：`docs/DEPLOYMENT.md`

---

## 8. 许可证

MIT
