# 比赛现场 Demo 检查清单

## 1. 启动前
- [ ] `backend/.env` 已配置 `LLM_ENABLED=true` 与有效 `QWEN_API_KEY`
- [ ] 网络可访问 DashScope；若不可访问，确保可以演示规则回退
- [ ] 端口 `8000` / `5173` 空闲
- [ ] 已确认品牌标题：`智值守 - 校园实验室智能应急协作平台`

## 2. 一键启动
- [ ] 在项目根目录执行 `start.bat`
- [ ] 后端健康检查通过：`http://localhost:8000/health`
- [ ] 前端可访问：`http://localhost:5173`

## 3. 数据准备
- [ ] 已执行 `backend/scripts/seed_demo_data.py`
- [ ] 工单中心有多状态样例（pending / assigned / in_progress / waiting_acceptance / closed）
- [ ] 告警中心有 critical / warning / info 样例
- [ ] 优化建议页有 todo / doing / verifying / done 样例
- [ ] 知识库有课堂 / 机房 / 社团案例

## 4. 演示路径
- [ ] AI 助手：展示千问增强 + 回退标记
- [ ] 工单中心：派单、ETA、流转、关闭
- [ ] 优化建议：批量转工单、失败明细
- [ ] 诊断页：查看关联优化进度
- [ ] 复盘页：查看指标与统计结果

## 5. 风险预案
- [ ] 若 AI 不可用，演示规则回退（`fallback=true`）
- [ ] 若网络异常，走本地知识库直答与规则受理
- [ ] 准备一份离线截图，以防现场网络不稳定
