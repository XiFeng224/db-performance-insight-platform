import React, { useEffect, useMemo, useState } from 'react';
import { Alert, Button, Card, Col, Drawer, Form, Input, InputNumber, Modal, Rate, Row, Select, Space, Statistic, Table, Tag, Timeline, Typography, message } from 'antd';
import { CheckCircleOutlined, ClockCircleOutlined, SyncOutlined, BookOutlined, ApartmentOutlined, TeamOutlined } from '@ant-design/icons';
import { OptimizationSuggestion, TicketEventItem, TicketItem, optimizationApi, ticketsApi } from '../services/api';
import { campusTicketStatusFilterOptions, getCampusTicketCategoryMeta, getCampusTicketSeverityMeta, getCampusTicketStatusMeta } from '../utils/campusMeta';

const { Title, Text } = Typography;

const categoryIconMap: Record<string, React.ReactNode> = {
  teaching_support: <BookOutlined />,
  lab_support: <ApartmentOutlined />,
  club_support: <TeamOutlined />,
};

const sceneTag = (category: string) => {
  const meta = getCampusTicketCategoryMeta(category);
  return <Tag icon={categoryIconMap[category]} color={meta.color}>{meta.label}</Tag>;
};

const TicketCenterPage: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [tickets, setTickets] = useState<TicketItem[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [detailOpen, setDetailOpen] = useState(false);
  const [selected, setSelected] = useState<TicketItem | null>(null);
  const [events, setEvents] = useState<TicketEventItem[]>([]);
  const [ratingOpen, setRatingOpen] = useState(false);
  const [ratingTicket, setRatingTicket] = useState<TicketItem | null>(null);
  const [loadError, setLoadError] = useState<string>('');
  const [closeModalOpen, setCloseModalOpen] = useState(false);
  const [closingTicket, setClosingTicket] = useState<TicketItem | null>(null);
  const [optSuggestions, setOptSuggestions] = useState<OptimizationSuggestion[]>([]);

  const load = async () => {
    setLoading(true);
    setLoadError('');
    try {
      const [ticketRes, optRes] = await Promise.all([
        ticketsApi.list(statusFilter === 'all' ? undefined : { status: statusFilter }),
        optimizationApi.getTop(100),
      ]);
      setTickets(ticketRes.data.items || []);
      setOptSuggestions(optRes.data.suggestions || []);
    } catch (e: any) {
      setLoadError(e?.response?.data?.detail?.message || '工单数据加载失败，请确认后端服务已启动且 /api/tickets 可访问。');
      setTickets([]);
      setOptSuggestions([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [statusFilter]);

  const openDetail = async (record: TicketItem) => {
    setSelected(record);
    setDetailOpen(true);
    try {
      const ev = await ticketsApi.events(record.id);
      setEvents(ev.data.items || []);
    } catch {
      setEvents([]);
    }
  };

  const onAssign = async (id: number) => {
    try {
      await ticketsApi.assign(id);
      message.success('已自动派单给当前值班人员');
      load();
    } catch {
      message.error('派单失败，请检查值班排班是否配置');
    }
  };

  const onStatus = async (id: number, status: TicketItem['status']) => {
    if (status === 'closed') {
      const t = tickets.find((x) => x.id === id) || null;
      setClosingTicket(t);
      setCloseModalOpen(true);
      return;
    }

    try {
      await ticketsApi.setStatus(id, status);
      message.success(`状态更新为 ${status}`);
      load();
    } catch {
      message.error('状态更新失败，请稍后重试');
    }
  };

  const statusTag = (status: string) => {
    const { color, label } = getCampusTicketStatusMeta(status);
    return <Tag color={color}>{label}</Tag>;
  };

  const severityTag = (severity: string) => {
    const { color, label } = getCampusTicketSeverityMeta(severity);
    return <Tag color={color}>{label}</Tag>;
  };

  const onSetEta = async (id: number, mins: number) => {
    try {
      await ticketsApi.setEta(id, mins);
      message.success('ETA已更新');
      load();
    } catch {
      message.error('ETA更新失败');
    }
  };

  const processingCount = tickets.filter((t) => t.status === 'in_progress' || t.status === 'assigned').length;
  const waitingAcceptanceCount = tickets.filter((t) => t.status === 'waiting_acceptance').length;
  const closedCount = tickets.filter((t) => t.status === 'closed').length;

  const sceneSummary = useMemo(() => {
    const ret = { teaching: 0, lab: 0, club: 0 };
    tickets.forEach((t) => {
      if (t.category === 'teaching_support') ret.teaching += 1;
      else if (t.category === 'lab_support') ret.lab += 1;
      else if (t.category === 'club_support') ret.club += 1;
    });
    return ret;
  }, [tickets]);

  return (
    <div className="fade-in">
      <Title level={2}>校园工单中心</Title>
      <Text type="secondary">覆盖课程故障、机房设备异常、社团活动保障，支持值班接单与应急闭环。</Text>

      <Row gutter={[16, 16]} style={{ marginTop: 12, marginBottom: 8 }}>
        <Col xs={24} md={8}><Card><Statistic title="处理中工单" value={processingCount} prefix={<SyncOutlined />} /></Card></Col>
        <Col xs={24} md={8}><Card><Statistic title="待验收工单" value={waitingAcceptanceCount} prefix={<ClockCircleOutlined />} /></Card></Col>
        <Col xs={24} md={8}><Card><Statistic title="已关闭工单" value={closedCount} prefix={<CheckCircleOutlined />} /></Card></Col>
      </Row>

      <Card style={{ marginBottom: 12 }}>
        <Space wrap>
          <Tag icon={<BookOutlined />} color="magenta">教学保障：{sceneSummary.teaching}</Tag>
          <Tag icon={<ApartmentOutlined />} color="blue">机房保障：{sceneSummary.lab}</Tag>
          <Tag icon={<TeamOutlined />} color="purple">社团保障：{sceneSummary.club}</Tag>
        </Space>
      </Card>

      {loadError && (
        <Alert type="error" showIcon style={{ marginTop: 8, marginBottom: 8 }} message="工单中心加载异常" description={loadError} />
      )}

      <Row gutter={[16, 16]} style={{ marginTop: 8 }}>
        <Col xs={24} lg={17}>
          <Card>
            <Space style={{ marginBottom: 12 }} wrap>
              <Select
                value={statusFilter}
                onChange={setStatusFilter}
                style={{ width: 240 }}
                options={campusTicketStatusFilterOptions}
              />
              <Button onClick={load}>刷新</Button>
            </Space>

            <Table
              loading={loading}
              rowKey="id"
              dataSource={tickets}
              onRow={(r) => ({ onClick: () => openDetail(r) })}
              columns={[
                { title: '工单ID', dataIndex: 'id', width: 90 },
                { title: '标题', dataIndex: 'title' },
                { title: '场景', dataIndex: 'category', width: 140, render: (v: string) => sceneTag(v) },
                { title: '优先级', dataIndex: 'severity', width: 140, render: (v: string) => severityTag(v) },
                { title: '状态', dataIndex: 'status', width: 180, render: (v: string) => statusTag(v) },
                { title: '地点', dataIndex: 'location', width: 150 },
                {
                  title: '操作',
                  width: 380,
                  render: (_: any, r: TicketItem) => (
                    <Space wrap onClick={(e) => e.stopPropagation()}>
                      <Button size="small" onClick={() => onAssign(r.id)}>自动派单</Button>
                      <Button size="small" onClick={() => onStatus(r.id, 'in_progress')}>开始处理</Button>
                      <Button size="small" onClick={() => onStatus(r.id, 'waiting_acceptance')}>转待验收</Button>
                      <Button size="small" type="primary" onClick={() => onStatus(r.id, 'closed')}>关闭</Button>
                    </Space>
                  ),
                },
              ]}
            />
          </Card>
        </Col>

        <Col xs={24} lg={7}>
          <Card title="校园处置提示" style={{ marginBottom: 16 }}>
            <Space direction="vertical" size={8}>
              <Text>1. 课程中断类工单优先处理</Text>
              <Text>2. 接单后尽快设置 ETA 并同步老师</Text>
              <Text>3. 现场恢复后先转“待验收”</Text>
              <Text>4. 验收通过后再关闭并收集反馈</Text>
            </Space>
          </Card>
          <Card title="当日工作概览">
            <Space direction="vertical" size={8}>
              <Text>总工单：{tickets.length}</Text>
              <Text>处理中：{processingCount}</Text>
              <Text>待验收：{waitingAcceptanceCount}</Text>
              <Text>已关闭：{closedCount}</Text>
            </Space>
          </Card>
        </Col>
      </Row>

      <Drawer title={selected ? `工单详情 #${selected.id}` : '工单详情'} open={detailOpen} onClose={() => setDetailOpen(false)} width={560}>
        {selected && (
          <Space direction="vertical" style={{ width: '100%' }}>
            <Card size="small" title="工单信息">
              <p><b>标题：</b>{selected.title}</p>
              <p><b>场景：</b>{selected.category}</p>
              <p><b>描述：</b>{selected.description}</p>
              <p><b>状态：</b>{selected.status}</p>
              <p><b>地点：</b>{selected.location || '-'}</p>
            </Card>

            <Card size="small" title="设置预计到场 ETA">
              <Form layout="inline" onFinish={(v) => onSetEta(selected.id, v.eta_minutes)} initialValues={{ eta_minutes: selected.eta_minutes || 10 }}>
                <Form.Item name="eta_minutes" rules={[{ required: true }]}>
                  <InputNumber min={1} max={240} />
                </Form.Item>
                <Form.Item>
                  <Button htmlType="submit" type="primary">保存ETA</Button>
                </Form.Item>
              </Form>
            </Card>

            <Card size="small" title="处理时间线">
              <Timeline items={events.map((e) => ({ children: `${e.created_at} - [${e.event_type}] ${e.content}` }))} />
            </Card>
          </Space>
        )}
      </Drawer>

      <Modal
        title={closingTicket ? `关闭工单 #${closingTicket.id} 并回填优化建议` : '关闭工单'}
        open={closeModalOpen}
        onCancel={() => setCloseModalOpen(false)}
        footer={null}
      >
        <Form
          layout="vertical"
          onFinish={async (values) => {
            if (!closingTicket) return;
            await ticketsApi.setStatus(closingTicket.id, 'closed', {
              adopted_optimization_suggestion_id: values.suggestion_id,
              adopted_optimization_note: values.note,
            });
            message.success('工单已关闭，并已回填优化建议');
            setCloseModalOpen(false);
            setRatingTicket(closingTicket);
            setRatingOpen(true);
            load();
          }}
        >
          <Form.Item name="suggestion_id" label="采用的优化建议（可选）">
            <Select
              allowClear
              placeholder="选择已采用的优化建议"
              options={optSuggestions.map((s) => ({
                label: `#${s.id} ${s.description.slice(0, 36)}...`,
                value: s.id,
              }))}
            />
          </Form.Item>
          <Form.Item name="note" label="闭环备注">
            <Input.TextArea rows={3} placeholder="例如：已执行索引DDL，课堂高峰延迟恢复正常。" />
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit">确认关闭并回填</Button>
          </Form.Item>
        </Form>
      </Modal>

      <Modal title={ratingTicket ? `工单 #${ratingTicket.id} 服务评价` : '服务评价'} open={ratingOpen} onCancel={() => setRatingOpen(false)} footer={null}>
        <Form
          layout="vertical"
          onFinish={async (values) => {
            if (!ratingTicket) return;
            await ticketsApi.createRating(ratingTicket.id, values);
            message.success('评分已提交');
            setRatingOpen(false);
          }}
          initialValues={{ response_speed_score: 5, service_attitude_score: 5, comment: '' }}
        >
          <Form.Item name="response_speed_score" label="响应速度评分" rules={[{ required: true }]}><Rate /></Form.Item>
          <Form.Item name="service_attitude_score" label="服务态度评分" rules={[{ required: true }]}><Rate /></Form.Item>
          <Form.Item name="comment" label="评价备注"><Input.TextArea rows={3} placeholder="可填写本次处理建议" /></Form.Item>
          <Form.Item><Button type="primary" htmlType="submit">提交评价</Button></Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default TicketCenterPage;
