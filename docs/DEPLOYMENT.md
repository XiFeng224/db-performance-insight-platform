# 部署指南（当前版本）

本文档与当前代码保持一致，覆盖：
- 本地开发部署
- 基础生产部署建议
- 常见故障排查

---

## 1. 环境要求

- OS：Windows / Linux / macOS
- Python：3.10+
- Node.js：18+
- MySQL：8.0+（可选，未连接时部分模块会降级）

推荐最低资源：
- 2 Core CPU
- 4GB RAM
- 20GB Disk

---

## 2. 本地部署

## 2.1 后端

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

后端地址：
- API: `http://localhost:8000`
- Swagger: `http://localhost:8000/docs`

## 2.2 前端

```bash
cd frontend
npm install
npm run dev
```

前端地址：
- `http://localhost:3000`

---

## 3. 环境变量（后端）

在 `backend/.env` 中配置（若无可参考 `.env.example`）：

```env
DEBUG=true
DATABASE_URL=sqlite+aiosqlite:///data/platform.db

# MySQL（可选）
MYSQL_HOST=127.0.0.1
MYSQL_PORT=3306
MYSQL_USER=root
MYSQL_PASSWORD=your_password
MYSQL_DATABASE=your_database
```

说明：
- `DATABASE_URL` 用于平台自身元数据（包括操作留痕）。
- MySQL 不可达时，监控/运维部分接口会返回降级数据，便于演示。

---

## 4. 关键健康检查

启动后可快速验证：

- `GET /docs`：文档可打开
- `GET /api/metrics/database`：监控指标接口
- `GET /api/ops/instances`：运维中心实例接口
- `GET /api/ops/action-log`：操作留痕查询

---

## 5. 生产部署建议（简版）

1. **反向代理**：Nginx 转发前后端
2. **进程守护**：Gunicorn/Uvicorn workers + Supervisor/systemd
3. **日志**：应用日志按天滚动
4. **数据库**：生产建议 MySQL/PostgreSQL（替代 sqlite）
5. **安全**：
   - 限制 CORS
   - 开启 HTTPS
   - 配置接口鉴权（后续可接 JWT/RBAC）
6. **备份**：定期备份业务库 + 平台元数据库

---

## 6. 常见问题

### Q1: 前端能打开但数据全空？
- 检查后端是否在 `8000` 启动
- 检查浏览器网络请求是否 200
- 检查 MySQL 是否可达（不可达时部分接口降级）

### Q2: 运维中心日志不刷新？
- 检查 `GET /api/ops/action-log` 是否返回数据
- 检查自动刷新开关是否开启
- 检查浏览器控制台是否有跨域错误

### Q3: 变更风险评估/Runbook 无返回？
- 确认 `POST /api/ops/change-risk/assess`
- 确认 `POST /api/ops/runbook/generate`
- 若 422，多为请求体字段缺失

---

## 7. 版本升级建议

- 升级前备份数据库
- `pip install -r requirements.txt` / `npm install`
- 启动后优先回归：
  - 首页
  - 运维中心
  - AI 诊断
  - 操作留痕

---

如需，我可以再补一份 `docker-compose.yml` 的当前项目可运行模板。