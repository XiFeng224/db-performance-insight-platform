# 开发指南

本文档面向本项目二次开发与维护，覆盖本地启动、代码结构、开发约定和常见扩展点。

---

## 1. 本地开发

## 1.1 后端

```bash
cd backend
python -m venv .venv
# Windows
.venv\Scripts\activate
# Linux/Mac
# source .venv/bin/activate

python -m pip install --upgrade pip
pip install -r requirements.txt
python scripts/seed_demo_data.py
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

## 1.2 前端

```bash
cd frontend
npm install
npm run dev
```

---

## 2. 目录说明（当前）

```text
backend/app/
├── api/
│   ├── assistant.py        # AI问答/受理/交接
│   ├── tickets.py          # 工单全流程
│   ├── ops.py              # 运维中心相关接口
│   ├── slow_queries.py
│   ├── execution_plans.py
│   ├── optimization.py
│   ├── metrics.py
│   ├── alerts.py
│   ├── comparison.py
│   ├── config.py
│   ├── export.py
│   └── scoring.py
├── models/
│   └── database.py
├── services/
├── utils/
├── database.py
└── main.py

frontend/src/
├── components/
│   ├── HomePortal.tsx
│   ├── Dashboard.tsx
│   ├── AIAssistantPage.tsx
│   ├── OpsCenterPage.tsx
│   └── ...
├── services/
│   └── api.ts
└── App.tsx
```

---

## 3. 新增功能开发规范

## 3.1 后端 API 增加流程

1. 在 `backend/app/api/` 新增或扩展路由文件（如 `ops.py`）
2. 在 `backend/app/main.py` 注册路由
3. 如需持久化，补充 `models/database.py` 模型
4. 统一返回结构，必要时保留 `source` / `fallback` / `latency_ms`
5. 在 `docs/API.md` 更新接口说明

## 3.2 前端页面接入流程

1. 在 `frontend/src/services/api.ts` 增加类型与请求函数
2. 在 `components/` 新增页面或扩展现有模块
3. 在 `App.tsx` 注册菜单与路由
4. 补充异常处理与空状态
---

## 4. 已落地的运维中心能力（供扩展参考）

- 实例管理（分组、标签、筛选）
- 工作负载画像
- 会话与锁诊断
- 变更风险评估
- 容量基线与7天预测
- Runbook 自动生成
- 操作留痕（持久化、筛选、导出、自动刷新、日志详情）

---

## 5. 代码质量建议

## 5.1 后端

- 保持路由轻量，复杂逻辑下沉到 `services/`
- 数据结构变更时，优先保证向后兼容
- 对“降级返回”显式标记 `data_source`

## 5.2 前端

- 类型优先：新增接口时先补 TypeScript 类型
- 状态最小化：避免重复 `useState` 造成冲突
- 优先复用现有组件样式，保持页面一致性

---

## 6. 常见问题

### Q1: MySQL 不可用时是否可演示？

可以。项目多处支持降级 / demo 返回，前端仍可展示主要流程。

### Q2: 操作留痕刷新后会丢吗？

不会。日志已支持后端持久化（`ops_action_logs`）。

### Q3: 如何新增一个运维动作并留痕？

- 前端执行动作成功/失败后调用 `opsApi.createActionLog(...)`
- 在 `OpsCenterPage` 使用已有筛选与展示链路即可自动可视化。

---

## 7. 推荐下一步（开发路线）

1. 日志统计下推后端聚合接口（当前为前端计算）
2. Runbook 模板外置（JSON/DB）
3. 变更风险评估接入真实执行计划特征
4. 增加多实例配置中心
