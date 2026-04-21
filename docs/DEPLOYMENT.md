# 部署指南

本文档说明“智值守”平台的本地开发部署与基础生产部署建议。

---

## 1. 环境要求

- 操作系统：Windows / Linux / macOS
- Python：3.10+
- Node.js：18+
- MySQL：8.0+（可选，未连接时部分模块会降级）

推荐最低资源：
- 2 Core CPU
- 4GB RAM
- 20GB Disk

---

## 2. 本地部署

### 2.1 后端

```bash
cd backend
python -m venv venv

# Windows
venv\Scripts\activate

# Linux / macOS
# source venv/bin/activate

python -m pip install --upgrade pip
pip install -r requirements.txt
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

后端地址：
- API：`http://localhost:8000`
- Swagger：`http://localhost:8000/docs`

### 2.2 前端

```bash
cd frontend
npm install
npm run dev
```

前端地址：
- `http://localhost:5173`

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
- MySQL 不可达时，部分接口会返回降级数据，便于演示。

---

## 4. 关键健康检查

启动后可快速验证：

- `GET /health`：后端健康检查
- `GET /docs`：接口文档
- `GET /api/assistant/stats`：AI 统计接口
- `GET /api/tickets`：工单接口
- `GET /api/knowledge`：知识库接口

---

## 5. 生产部署建议（简版）

1. **反向代理**：Nginx 转发前后端
2. **进程守护**：Uvicorn workers + systemd / Supervisor
3. **日志**：应用日志按天滚动
4. **数据库**：生产建议使用 MySQL 或 PostgreSQL
5. **安全**：
   - 限制 CORS
   - 开启 HTTPS
   - 配置接口鉴权（可接 JWT / RBAC）
6. **备份**：定期备份业务库与平台元数据库

---

## 6. 常见问题

### Q1: 前端能打开但数据全空？
- 检查后端是否在 `8000` 启动
- 检查浏览器网络请求是否返回 200
- 检查数据初始化脚本是否执行

### Q2: AI 助手不返回结果？
- 检查 `QWEN_API_KEY` 是否配置
- 检查网络是否可访问模型服务
- 若不可用，可切换到规则回退模式

### Q3: 变更风险评估 / Runbook 无返回？
- 确认相关接口请求体字段完整
- 若返回 422，多为字段缺失或格式不符

---

## 7. 版本升级建议

- 升级前备份数据库
- 更新依赖：`pip install -r requirements.txt` / `npm install`
- 启动后优先回归：
  - 首页
  - 告警中心
  - 工单中心
  - AI 助手
  - 复盘页面

---

如需，我可以继续补一份适配当前项目的 `docker-compose.yml` 示例。
