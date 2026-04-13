import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Alert, Button, Card, Col, Progress, Row, Space, Statistic, Table, Tag, Typography } from 'antd';
import dayjs from 'dayjs';
import { BookOutlined, ApartmentOutlined, TeamOutlined } from '@ant-design/icons';
import { KnowledgeItem, OptimizationSuggestion, TicketItem, TicketRatingSummary, knowledgeApi, optimizationApi, ticketsApi } from '../services/api';

const { Title, Text } = Typography;

interface PriorityRow {
  key: number;
  ticket: TicketItem;
  waitMinutes: number;
  overdueMinutes: number;
  priorityScore: number;
  suggestion: string;
}

const severityWeight: Record<string, number> = {
  high: 60,
  medium: 35,
  low: 20,
};

const rootCauseRules = [
  { keyword: '投影仪', cause: '教学显示链路异常', action: '优先检查输入源/HDMI/投影设备供电并安排现场验证' },
  { keyword: '网络', cause: '网络接入或DNS异常', action: '先验证网关连通，再核查交换机端口与DNS解析' },
  { keyword: '服务器', cause: '核心服务可用性风险', action: '优先执行服务健康检查与端口连通性排查' },
  { keyword: '数据库', cause: '数据服务响应异常', action: '检查连接池、慢SQL与容量阈值，必要时降级保护' },
  { keyword: '门禁', cause: '物理访问控制异常', action: '同步通知管理员并切换应急通行方案' },
  { keyword: '打印机', cause: '终端外设故障', action: '安排现场处理，确认耗材与卡纸状态' },
];

const statusCN: Record<string, string> = {
  pending: '待接单',
  assigned: '已派单（待响应）',
  in_progress: '处理中',
  waiting_acceptance: '待验收（老师/报修人）',
  closed: '已关闭',
};

const AIDiagnosticPage: React.FC = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [tickets, setTickets] = useState<TicketItem[]>([]);
  const [knowledge, setKnowledge] = useState<KnowledgeItem[]>([]);
  const [optSuggestions, setOptSuggestions] = useState<OptimizationSuggestion[]>([]);
  const [rating, setRating] = useState<TicketRatingSummary>({
    count: 0,
    avg_response_speed: 0,
    avg_service_attitude: 0,
    avg_overall: 0,
  });

  const load = async () => {
    setLoading(true);
    try {
      const [tRes, kRes, rRes, oRes] = await Promise.all([
        ticketsApi.list({ limit: 200 }),
        knowledgeApi.list({ limit: 50 }),
        ticketsApi.ratingSummary(),
        optimizationApi.getTop(100),
      ]);
      setTickets(tRes.data.items || []);
      setKnowledge(kRes.data.items || []);
      setRating(rRes.data);
      setOptSuggestions(oRes.data.suggestions || []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const openTickets = useMemo(() => tickets.filter((t) => t.status !== 'closed'), [tickets]);

  const priorityRows = useMemo<PriorityRow[]>(() => {
    const now = dayjs();
    return openTickets
      .map((t) => {
        const waitMinutes = Math.max(0, now.diff(dayjs(t.created_at), 'minute'));
        const overdueMinutes = t.due_at ? Math.max(0, now.diff(dayjs(t.due_at), 'minute')) : 0;
        const score = (severityWeight[t.severity] || 25) + Math.min(25, Math.floor(waitMinutes / 10)) + Math.min(30, Math.floor(overdueMinutes / 5));
        const rule = rootCauseRules.find((r) => t.title.includes(r.keyword) || t.description.includes(r.keyword)) || rootCauseRules[2];
        return { key: t.id, ticket: t, waitMinutes, overdueMinutes, priorityScore: score, suggestion: rule.action };
      })
      .sort((a, b) => b.priorityScore - a.priorityScore)
      .slice(0, 20);
  }, [openTickets]);

  const rootCauseStats = useMemo(() => {
    const counter: Record<string, number> = {};
    openTickets.forEach((t) => {
      const text = `${t.title} ${t.description}`;
      const hit = rootCauseRules.find((r) => text.includes(r.keyword));
      const cause = hit?.cause || '通用设备/服务异常';
      counter[cause] = (counter[cause] || 0) + 1;
    });
    return Object.entries(counter).map(([cause, count]) => ({ cause, count })).sort((a, b) => b.count - a.count);
  }, [openTickets]);

  const knowledgeSuggest = useMemo(() => {
    const topKeywords = rootCauseRules
      .map((r) => ({ keyword: r.keyword, count: openTickets.filter((t) => `${t.title} ${t.description}`.includes(r.keyword)).length }))
      .filter((x) => x.count > 0)
      .sort((a, b) => b.count - a.count)
      .slice(0, 3)
      .map((x) => x.keyword);

    return knowledge.filter((k) => topKeywords.some((kw) => k.title.includes(kw) || (k.keywords || '').includes(kw))).slice(0, 6);
  }, [knowledge, openTickets]);

  const p1Risk = useMemo(() => {
    const highOpen = openTickets.filter((t) => t.severity === 'high').length;
    const overdue = priorityRows.filter((r) => r.overdueMinutes > 0).length;
    return Math.min(100, highOpen * 18 + overdue * 12);
  }, [openTickets, priorityRows]);

  const campusImpact = useMemo(() => {
    const teaching = openTickets.filter((t) => t.category === 'teaching_support').length;
    const lab = openTickets.filter((t) => t.category === 'lab_support').length;
    const club = openTickets.filter((t) => t.category === 'club_support').length;
    return {
      teaching,
      lab,
      club,
      teachingAffectedCourses: Math.max(0, Math.round(teaching * 1.3)),
      labAffectedRooms: Math.max(0, Math.round(lab * 0.9)),
      clubAffectedActivities: Math.max(0, Math.round(club * 0.8)),
    };
  }, [openTickets]);

  const escalationConclusion = useMemo(() => {
    if (p1Risk >= 70 || campusImpact.teaching >= 3) {
      return { type: 'error' as const, title: '建议立即升级到中心值班老师与平台主管老师', detail: '课堂保障风险较高，请优先处理教学相关工单并同步应急通报。' };
    }
    if (p1Risk >= 40 || campusImpact.lab >= 3) {
      return { type: 'warning' as const, title: '建议升级到中心值班老师关注', detail: '机房保障存在波动，建议加密巡检并保持升级链路畅通。' };
    }
    return { type: 'success' as const, title: '当前可由现场值班闭环处置', detail: '风险可控，保持常规值班节奏并关注待验收工单。' };
  }, [p1Risk, campusImpact]);

  const optimizationProgress = useMemo(() => {
    const doing = optSuggestions.filter((s) => s.exec_status === 'doing').length;
    const verifying = optSuggestions.filter((s) => s.exec_status === 'verifying').length;
    const done = optSuggestions.filter((s) => s.exec_status === 'done').length;
    const related = optSuggestions.length;
    return { related, doing, verifying, done };
  }, [optSuggestions]);

  return (
    <div className="fade-in">
      <Space direction="vertical" size={4} style={{ marginBottom: 12 }} className="page-header">
        <Title level={2} style={{ margin: 0 }}>数据库诊断（扩展）</Title>
        <Text type="secondary" className="page-subtitle">结合工单、知识库、优化建议与评分进行校园值班研判，输出影响面与升级建议。</Text>
      </Space>

      <Alert type="info" showIcon style={{ marginBottom: 16 }} message="本模块用于值班研判：分诊优先级排序、根因线索聚合、校园影响评估、升级链路建议。" />
      <Alert type={escalationConclusion.type} showIcon style={{ marginBottom: 16 }} message={escalationConclusion.title} description={escalationConclusion.detail} />

      <Row gutter={[16, 16]}>
        <Col xs={24} md={8}><Card loading={loading}><Text type="secondary">当前未闭环工单</Text><Title level={3} style={{ marginTop: 8 }}>{openTickets.length}</Title><Tag color="blue">含待接单/处理中/待验收</Tag></Card></Col>
        <Col xs={24} md={8}><Card loading={loading}><Text type="secondary">P1风险指数</Text><Title level={3} style={{ marginTop: 8 }}>{p1Risk}</Title><Progress percent={p1Risk} status={p1Risk >= 70 ? 'exception' : p1Risk >= 40 ? 'active' : 'success'} showInfo={false} /></Card></Col>
        <Col xs={24} md={8}><Card loading={loading}><Text type="secondary">服务满意度</Text><Title level={3} style={{ marginTop: 8 }}>{rating.avg_overall.toFixed(2)} / 5</Title><Tag color="purple">累计评价 {rating.count}</Tag></Card></Col>
      </Row>

      <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
        <Col xs={24} md={8}><Card><Statistic title="受影响课程估计" value={campusImpact.teachingAffectedCourses} prefix={<BookOutlined />} /><Tag color="magenta" style={{ marginTop: 8 }}>教学保障事件：{campusImpact.teaching}</Tag></Card></Col>
        <Col xs={24} md={8}><Card><Statistic title="受影响机房估计" value={campusImpact.labAffectedRooms} prefix={<ApartmentOutlined />} /><Tag color="blue" style={{ marginTop: 8 }}>机房保障事件：{campusImpact.lab}</Tag></Card></Col>
        <Col xs={24} md={8}><Card><Statistic title="受影响活动估计" value={campusImpact.clubAffectedActivities} prefix={<TeamOutlined />} /><Tag color="purple" style={{ marginTop: 8 }}>社团保障事件：{campusImpact.club}</Tag></Card></Col>
      </Row>

      <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
        <Col xs={24} lg={14}>
          <Card title="工单分诊优先级（AI排序）" loading={loading}>
            <Table
              rowKey="key"
              dataSource={priorityRows}
              pagination={{ pageSize: 8 }}
              columns={[
                { title: '工单', render: (_: any, r: PriorityRow) => `#${r.ticket.id} ${r.ticket.title}` },
                { title: '级别', dataIndex: ['ticket', 'severity'], width: 100, render: (v: string) => <Tag color={v === 'high' ? 'red' : v === 'medium' ? 'orange' : 'blue'}>{v === 'high' ? 'P1 / 高' : v === 'medium' ? 'P2 / 中' : 'P3 / 低'}</Tag> },
                { title: '状态', dataIndex: ['ticket', 'status'], width: 180, render: (v: string) => statusCN[v] || v },
                { title: '等待时长(min)', dataIndex: 'waitMinutes', width: 120 },
                { title: '超时(min)', dataIndex: 'overdueMinutes', width: 100, render: (v: number) => (v > 0 ? <Tag color="red">{v}</Tag> : '-') },
                { title: '优先分', dataIndex: 'priorityScore', width: 90, sorter: (a, b) => a.priorityScore - b.priorityScore },
                { title: '建议动作', dataIndex: 'suggestion' },
              ]}
            />
          </Card>
        </Col>
        <Col xs={24} lg={10}>
          <Card
            title="关联优化建议执行进度"
            loading={loading}
            extra={<Button size="small" onClick={() => navigate('/optimization?status=verifying')}>查看待验证</Button>}
          >
            <Space direction="vertical" style={{ width: '100%' }}>
              <Tag color="blue">优化建议总数：{optimizationProgress.related}</Tag>
              <Tag color="processing">执行中：{optimizationProgress.doing}</Tag>
              <Tag color="purple">待验证：{optimizationProgress.verifying}</Tag>
              <Tag color="green">已完成：{optimizationProgress.done}</Tag>
              <Progress
                percent={optimizationProgress.related === 0 ? 0 : Math.round((optimizationProgress.done / optimizationProgress.related) * 100)}
                status="active"
              />
              <Text type="secondary">建议：将“待验证”项在下一班次交接时优先确认，避免课堂高峰重复告警。</Text>
            </Space>
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
        <Col xs={24} lg={12}>
          <Card title="根因线索聚合" loading={loading}>
            <Table rowKey="cause" dataSource={rootCauseStats} pagination={false} columns={[{ title: '疑似根因', dataIndex: 'cause' }, { title: '命中工单数', dataIndex: 'count', width: 120 }]} />
          </Card>
        </Col>
        <Col xs={24} lg={12}>
          <Card title="处置知识推荐（关联知识库）" loading={loading}>
            <Space direction="vertical" style={{ width: '100%' }}>
              {knowledgeSuggest.length === 0 ? <Text type="secondary">暂无命中知识条目，请先在知识库管理中补充TOP问题。</Text> : knowledgeSuggest.map((k) => (
                <Card key={k.id} size="small">
                  <Space direction="vertical" size={4} style={{ width: '100%' }}>
                    <Space><Tag color="blue">{k.category}</Tag><Text strong>{k.title}</Text></Space>
                    <Text type="secondary">{k.content}</Text>
                    <Text type="secondary">解决率：{(k.solve_rate * 100).toFixed(1)}%</Text>
                  </Space>
                </Card>
              ))}
            </Space>
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default AIDiagnosticPage;
