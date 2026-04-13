import React, { useEffect, useMemo, useState } from 'react';
import { Card, Col, Row, Spin, Typography, Tag, Switch, Space, Empty } from 'antd';
import { ClockCircleOutlined, BookOutlined, ApartmentOutlined, TeamOutlined } from '@ant-design/icons';
import { TicketItem, ticketsApi } from '../services/api';
import { getCampusTicketCategoryMeta, getCampusTicketSeverityMeta } from '../utils/campusMeta';

const { Title, Text } = Typography;

const columns: Array<{ key: TicketItem['status']; title: string; color: string }> = [
  { key: 'pending', title: '待接单', color: '#f59e0b' },
  { key: 'in_progress', title: '处理中', color: '#3b82f6' },
  { key: 'waiting_acceptance', title: '待验收（老师/报修人）', color: '#8b5cf6' },
  { key: 'closed', title: '已关闭', color: '#10b981' },
];

const categoryIconMap: Record<string, React.ReactNode> = {
  teaching_support: <BookOutlined />,
  lab_support: <ApartmentOutlined />,
  club_support: <TeamOutlined />,
};

const sceneTag = (category?: string) => {
  const meta = getCampusTicketCategoryMeta(category);
  return <Tag icon={category ? categoryIconMap[category] : undefined} color={meta.color}>{meta.label}</Tag>;
};

const TicketBoardPage: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [tickets, setTickets] = useState<TicketItem[]>([]);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [nowTs, setNowTs] = useState(Date.now());

  const load = async () => {
    setLoading(true);
    try {
      const res = await ticketsApi.list({ limit: 200 });
      setTickets(res.data.items || []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    if (!autoRefresh) return;
    const timer = window.setInterval(() => {
      load();
      setNowTs(Date.now());
    }, 10000);
    return () => window.clearInterval(timer);
  }, [autoRefresh]);

  const grouped = useMemo(() => {
    const map: Record<string, TicketItem[]> = {
      pending: [],
      in_progress: [],
      waiting_acceptance: [],
      closed: [],
    };
    tickets.forEach((t) => {
      const key = t.status === 'assigned' ? 'in_progress' : t.status;
      if (map[key]) map[key].push(t);
    });
    return map;
  }, [tickets]);

  const renderTicketCard = (t: TicketItem) => {
    const dueTs = t.due_at ? new Date(t.due_at).getTime() : undefined;
    const overdue = !!dueTs && dueTs < nowTs && t.status !== 'closed';
    const severityMeta = getCampusTicketSeverityMeta(t.severity);

    return (
      <Card
        key={t.id}
        size="small"
        style={{
          marginBottom: 10,
          borderLeft: `4px solid ${overdue ? '#dc2626' : '#6366f1'}`,
          background: overdue ? '#fff7f7' : '#fff',
        }}
      >
        <Space direction="vertical" size={4} style={{ width: '100%' }}>
          <Space wrap>
            <Text strong>#{t.id}</Text>
            <Tag color={severityMeta.color}>{severityMeta.label}</Tag>
            {sceneTag(t.category)}
            {overdue && <Tag color="red">已超时</Tag>}
          </Space>
          <Text>{t.title}</Text>
          <Text type="secondary" style={{ fontSize: 12 }}>{t.location || '未标注楼栋/教室/机房'}</Text>
          {t.due_at && (
            <Text type={overdue ? 'danger' : 'secondary'} style={{ fontSize: 12 }}>
              <ClockCircleOutlined style={{ marginRight: 6 }} />
              ETA：{new Date(t.due_at).toLocaleString('zh-CN')}
            </Text>
          )}
        </Space>
      </Card>
    );
  };

  return (
    <div className="fade-in">
      <Space direction="vertical" size={4} style={{ marginBottom: 12 }} className="page-header">
        <Title level={2} style={{ margin: 0 }}>校园工单进度看板</Title>
        <Text type="secondary" className="page-subtitle">按状态分栏展示课程故障、机房异常、社团活动保障工单，快速识别卡点与超时。</Text>
      </Space>

      <Card
        style={{ marginTop: 12 }}
        extra={
          <Space>
            <Text type="secondary">自动刷新(10s)</Text>
            <Switch checked={autoRefresh} onChange={setAutoRefresh} />
            <a onClick={load}>刷新</a>
          </Space>
        }
      >
        {loading ? (
          <div style={{ padding: 40, textAlign: 'center' }}>
            <Spin />
          </div>
        ) : (
          <Row gutter={[16, 16]}>
            {columns.map((c) => (
              <Col xs={24} md={12} xl={6} key={c.key}>
                <Card
                  size="small"
                  title={
                    <Space>
                      <span style={{ width: 10, height: 10, borderRadius: '50%', background: c.color, display: 'inline-block' }} />
                      <span>{c.title}</span>
                      <Tag>{grouped[c.key].length}</Tag>
                    </Space>
                  }
                  styles={{ body: { maxHeight: 520, overflowY: 'auto' } }}
                >
                  {grouped[c.key].length === 0
                    ? <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无工单" />
                    : grouped[c.key].map(renderTicketCard)}
                </Card>
              </Col>
            ))}
          </Row>
        )}
      </Card>
    </div>
  );
};

export default TicketBoardPage;
