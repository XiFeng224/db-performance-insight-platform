import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Alert, Avatar, Button, Card, Col, Progress, Row, Space, Statistic, Tag, Timeline, Typography } from 'antd';
import {
  AlertOutlined,
  ClockCircleOutlined,
  FileSearchOutlined,
  RocketOutlined,
  SafetyCertificateOutlined,
  StarOutlined,
  ToolOutlined,
  BookOutlined,
  ApartmentOutlined,
  TeamOutlined,
  ThunderboltOutlined,
} from '@ant-design/icons';
import { TicketItem, ticketsApi, TicketRatingSummary } from '../services/api';

const { Title, Paragraph, Text } = Typography;

const HomePortal: React.FC = () => {
  const navigate = useNavigate();
  const [ratingSummary, setRatingSummary] = useState<TicketRatingSummary>({
    count: 0,
    avg_response_speed: 0,
    avg_service_attitude: 0,
    avg_overall: 0,
  });
  const [tickets, setTickets] = useState<TicketItem[]>([]);

  useEffect(() => {
    (async () => {
      try {
        const [summaryRes, ticketsRes] = await Promise.all([
          ticketsApi.ratingSummary(),
          ticketsApi.list({ limit: 300 }),
        ]);
        setRatingSummary(summaryRes.data);
        setTickets(ticketsRes.data.items || []);
      } catch {
        // ignore dashboard bootstrap failures
      }
    })();
  }, []);

  const metrics = useMemo(() => {
    const statusSummary = { pending: 0, waiting: 0, closed: 0, high: 0 };
    const categorySummary = { teaching: 0, lab: 0, club: 0 };

    tickets.forEach((t) => {
      if (['pending', 'assigned', 'in_progress'].includes(t.status)) statusSummary.pending += 1;
      if (t.status === 'waiting_acceptance') statusSummary.waiting += 1;
      if (t.status === 'closed') statusSummary.closed += 1;
      if (t.severity === 'high' && t.status !== 'closed') statusSummary.high += 1;

      if (t.category === 'teaching_support') categorySummary.teaching += 1;
      else if (t.category === 'lab_support') categorySummary.lab += 1;
      else if (t.category === 'club_support') categorySummary.club += 1;
    });

    const closeRate = tickets.length > 0 ? Math.round((statusSummary.closed / tickets.length) * 100) : 0;
    return { ...statusSummary, ...categorySummary, closeRate };
  }, [tickets]);

  return (
    <div className="fade-in">
      <Card
        style={{
          marginBottom: 16,
          background: 'linear-gradient(120deg, #0f172a 0%, #1e293b 36%, #1d4ed8 100%)',
          border: '1px solid #1e40af',
          color: '#f8fafc',
        }}
      >
        <Space direction="vertical" size={10} style={{ width: '100%' }}>
          <Space align="center" wrap>
            <Avatar size={44} style={{ backgroundColor: '#2563eb' }} icon={<SafetyCertificateOutlined />} />
            <div>
              <Title level={2} style={{ margin: 0 }}>智值守 - 校园实验室智能应急协作平台</Title>
              <Text style={{ color: '#cbd5e1' }}>Smart Campus Emergency Collaboration Platform</Text>
            </div>
          </Space>
          <Paragraph style={{ marginBottom: 0, color: '#e2e8f0' }}>
            面向实验室 / 机房 / 社团服务，围绕 <b>快速受理</b>、<b>标准处置</b>、<b>应急升级</b>、<b>闭环复盘</b> 建立统一入口。
          </Paragraph>
          <Space wrap>
            <Tag icon={<BookOutlined />} color="magenta">教学保障</Tag>
            <Tag icon={<ApartmentOutlined />} color="blue">机房保障</Tag>
            <Tag icon={<TeamOutlined />} color="purple">社团活动保障</Tag>
            <Tag icon={<ThunderboltOutlined />} color="red">应急联动</Tag>
          </Space>
        </Space>
      </Card>

      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={24} md={6}>
          <Card>
            <Statistic title="待处理工单" value={metrics.pending} prefix={<AlertOutlined />} />
            <Tag color={metrics.pending > 8 ? 'red' : 'orange'} style={{ marginTop: 8 }}>{metrics.pending > 8 ? '高负载' : '可控'}</Tag>
          </Card>
        </Col>
        <Col xs={24} md={6}>
          <Card>
            <Statistic title="待验收工单" value={metrics.waiting} prefix={<ClockCircleOutlined />} />
            <Tag color="purple" style={{ marginTop: 8 }}>需老师/报修人确认</Tag>
          </Card>
        </Col>
        <Col xs={24} md={6}>
          <Card>
            <Statistic title="高优先级进行中" value={metrics.high} prefix={<RocketOutlined />} />
            <Tag color={metrics.high > 0 ? 'red' : 'green'} style={{ marginTop: 8 }}>{metrics.high > 0 ? '优先保障' : '正常'}</Tag>
          </Card>
        </Col>
        <Col xs={24} md={6}>
          <Card>
            <Statistic title="闭环率" value={metrics.closeRate} suffix="%" prefix={<ToolOutlined />} />
            <Progress percent={metrics.closeRate} size="small" strokeColor="#6366f1" />
          </Card>
        </Col>
      </Row>

      <Card style={{ marginBottom: 16 }}>
        <Space wrap>
          <Tag icon={<BookOutlined />} color="magenta">教学相关工单：{metrics.teaching}</Tag>
          <Tag icon={<ApartmentOutlined />} color="blue">机房相关工单：{metrics.lab}</Tag>
          <Tag icon={<TeamOutlined />} color="purple">社团活动工单：{metrics.club}</Tag>
        </Space>
      </Card>

      <Row gutter={[16, 16]}>
        <Col xs={24} lg={16}>
          <Card title="值班统一入口" style={{ marginBottom: 16 }}>
            <Space wrap>
              <Button type="primary" onClick={() => navigate('/ticket-submit')}>快速报障（师生/社团）</Button>
              <Button type="primary" onClick={() => navigate('/ticket-center')}>工单调度中心</Button>
              <Button onClick={() => navigate('/ticket-board')}>工单看板</Button>
              <Button onClick={() => navigate('/alerts')}>告警作战台</Button>
              <Button onClick={() => navigate('/ops-center')}>机房运维中心</Button>
              <Button onClick={() => navigate('/duty-schedule')}>值班排班中心</Button>
              <Button icon={<FileSearchOutlined />} onClick={() => navigate('/ai-assistant')}>智值守AI指挥助手</Button>
              <Button onClick={() => navigate('/comparison')}>复盘中心</Button>
              <Button onClick={() => navigate('/knowledge-center')}>校园SOP知识中心</Button>
            </Space>
          </Card>

          <Card title="校园应急时间线">
            <Timeline
              items={[
                { color: 'red', children: '09:10 3教402课堂投影黑屏，教师提交紧急报障' },
                { color: 'blue', children: '09:12 学生助理接单并按SOP排查，中心值班老师同步关注' },
                { color: 'green', children: '09:18 设备切换恢复课堂显示，转待验收' },
                { color: 'purple', children: '09:25 教师验收通过，工单闭环并进入复盘清单' },
              ]}
            />
          </Card>
        </Col>

        <Col xs={24} lg={8}>
          <Card title="服务质量画像" style={{ marginBottom: 16 }}>
            <Statistic title="综合满意度" value={ratingSummary.avg_overall} suffix="/5" precision={2} prefix={<StarOutlined />} />
            <div style={{ marginTop: 12 }}>
              <Text type="secondary">响应速度：{ratingSummary.avg_response_speed.toFixed(2)} / 5</Text>
              <br />
              <Text type="secondary">服务态度：{ratingSummary.avg_service_attitude.toFixed(2)} / 5</Text>
            </div>
            <Tag color="purple" style={{ marginTop: 10 }}>累计评价 {ratingSummary.count} 条</Tag>
          </Card>

          <Alert
            type={metrics.high > 0 ? 'error' : 'success'}
            showIcon
            message={metrics.high > 0 ? `当前有 ${metrics.high} 条高优先级工单` : '当前无高优先级未关闭工单'}
            description={metrics.high > 0 ? '建议优先保障正在授课教室与进行中的社团活动。' : '可按计划处理普通优先级任务。'}
          />
        </Col>
      </Row>
    </div>
  );
};

export default HomePortal;
