import React, { useEffect, useMemo, useState } from 'react';
import { Button, Card, Col, Form, Input, Row, Select, Space, Statistic, Table, Tag, Typography, message, Alert } from 'antd';
import { SearchOutlined, BookOutlined, ApartmentOutlined, TeamOutlined } from '@ant-design/icons';
import { knowledgeApi, KnowledgeItem } from '../services/api';

const { Title, Text, Paragraph } = Typography;

const categoryMap: Record<string, string> = {
  teaching: '教学保障SOP',
  lab: '机房保障SOP',
  club: '社团活动SOP',
  network: '校园网络SOP',
  general: '通用应急SOP',
};

const categoryTagColor: Record<string, string> = {
  teaching: 'magenta',
  lab: 'blue',
  club: 'purple',
  network: 'cyan',
  general: 'default',
};

const KnowledgeCenterPage: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<KnowledgeItem[]>([]);
  const [query, setQuery] = useState('');
  const demoItems = useMemo(() => (items.length > 0 ? items : [
    { id: 9001, title: '课堂投影黑屏应急SOP', keywords: '投影,黑屏,课堂', category: 'teaching', content: '先检查输入源与HDMI连接；切换备用线缆；5分钟内无法恢复则升级值班老师。', view_count: 28, solve_count: 22, solve_rate: 0.79 },
    { id: 9002, title: '机房整排无法联网排障', keywords: '机房,网络,交换机', category: 'lab', content: '先确认受影响范围；检查端口与网关连通；必要时切换备用网络。', view_count: 34, solve_count: 27, solve_rate: 0.82 },
    { id: 9003, title: '社团直播推流中断处置', keywords: '社团,直播,推流', category: 'club', content: '优先恢复主推流链路；并行启动备推流；通知活动负责人和中心值班老师。', view_count: 18, solve_count: 13, solve_rate: 0.72 },
  ] as KnowledgeItem[]), [items]);

  const load = async (q?: string) => {
    setLoading(true);
    try {
      const res = await knowledgeApi.list({ q, limit: 100 });
      setItems(res.data.items || []);
      if ((res.data.items || []).length === 0) {
        message.info('暂无真实知识库数据，已启用演示示例');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  type KnowledgeFormValues = {
    title: string;
    keywords?: string;
    category: string;
    content: string;
  };

  const create = async (values: KnowledgeFormValues) => {
    try {
      await knowledgeApi.create(values);
      message.success('校园SOP条目已创建');
      load(query || undefined);
    } catch {
      message.error('创建失败');
    }
  };

  const metrics = useMemo(() => {
    const totalViews = items.reduce((s, i) => s + (i.view_count || 0), 0);
    const totalSolve = items.reduce((s, i) => s + (i.solve_count || 0), 0);
    const avgSolveRate = items.length ? items.reduce((s, i) => s + (i.solve_rate || 0), 0) / items.length : 0;

    const byCategory = items.reduce((acc, cur) => {
      acc[cur.category] = (acc[cur.category] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return { totalViews, totalSolve, avgSolveRate, byCategory };
  }, [items]);


  return (
    <div className="fade-in">
      <Space direction="vertical" size={4} style={{ marginBottom: 12 }} className="page-header">
        <Title level={2} style={{ margin: 0 }}>校园知识中心（SOP）</Title>
        <Paragraph type="secondary" style={{ marginBottom: 0 }} className="page-subtitle">
          面向实验室 / 机房 / 社团服务沉淀标准处置流程，提升值班首响效率与自助解决率。
        </Paragraph>
      </Space>

      <Alert
        style={{ marginBottom: 12 }}
        type="info"
        showIcon
        message="使用建议：提交工单前先检索SOP，命中后可直接按步骤处置并回填结果。"
      />

      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={24} md={6}><Card><Statistic title="SOP条目总数" value={items.length} /></Card></Col>
        <Col xs={24} md={6}><Card><Statistic title="累计浏览" value={metrics.totalViews} /></Card></Col>
        <Col xs={24} md={6}><Card><Statistic title="累计解决" value={metrics.totalSolve} /></Card></Col>
        <Col xs={24} md={6}><Card><Statistic title="平均解决率" value={(metrics.avgSolveRate * 100).toFixed(1)} suffix="%" /></Card></Col>
      </Row>

      <Row gutter={[16, 16]}>
        <Col xs={24} lg={16}>
          <Card title="新增校园SOP条目" style={{ marginBottom: 16 }}>
            <Form layout="vertical" onFinish={create} initialValues={{ category: 'teaching' }}>
              <Row gutter={12}>
                <Col xs={24} md={10}>
                  <Form.Item name="title" label="标题" rules={[{ required: true }]}>
                    <Input placeholder="如：3教投影无信号应急处置" />
                  </Form.Item>
                </Col>
                <Col xs={24} md={8}>
                  <Form.Item name="keywords" label="关键词">
                    <Input placeholder="投影,HDMI,黑屏,课堂中断" />
                  </Form.Item>
                </Col>
                <Col xs={24} md={6}>
                  <Form.Item name="category" label="分类">
                    <Select
                      options={[
                        { label: '教学保障SOP', value: 'teaching' },
                        { label: '机房保障SOP', value: 'lab' },
                        { label: '社团活动SOP', value: 'club' },
                        { label: '校园网络SOP', value: 'network' },
                        { label: '通用应急SOP', value: 'general' },
                      ]}
                    />
                  </Form.Item>
                </Col>
              </Row>
              <Form.Item name="content" label="处置步骤" rules={[{ required: true }]}>
                <Input.TextArea rows={4} placeholder="填写排查步骤、升级条件、恢复判定、回滚方案" />
              </Form.Item>
              <Form.Item>
                <Button type="primary" htmlType="submit">新增SOP条目</Button>
              </Form.Item>
            </Form>
          </Card>

          <Card
            title="SOP条目列表"
            extra={
              <Space>
                <Input placeholder="搜索标题/关键词" value={query} onChange={(e) => setQuery(e.target.value)} style={{ width: 220 }} />
                <Button icon={<SearchOutlined />} onClick={() => load(query || undefined)}>搜索</Button>
              </Space>
            }
          >
            <Table
              rowKey="id"
              loading={loading}
              dataSource={items}
              columns={[
                { title: '标题', dataIndex: 'title' },
                {
                  title: '分类',
                  dataIndex: 'category',
                  width: 160,
                  render: (v: string) => <Tag color={categoryTagColor[v] || 'default'}>{categoryMap[v] || v}</Tag>,
                },
                { title: '浏览', dataIndex: 'view_count', width: 90 },
                { title: '解决', dataIndex: 'solve_count', width: 90 },
                { title: '解决率', dataIndex: 'solve_rate', width: 120, render: (v: number) => `${(v * 100).toFixed(1)}%` },
              ]}
            />
          </Card>
        </Col>

        <Col xs={24} lg={8}>
          <Card title="高频SOP热榜" style={{ marginBottom: 16 }}>
            <Space direction="vertical" style={{ width: '100%' }}>
              {demoItems
                .sort((a, b) => (b.view_count + b.solve_count) - (a.view_count + a.solve_count))
                .slice(0, 5)
                .map((item, idx) => (
                  <Card key={item.id} size="small" title={`TOP ${idx + 1} · ${item.title}`}>
                    <Space wrap>
                      <Tag color="blue">浏览 {item.view_count}</Tag>
                      <Tag color="green">解决 {item.solve_count}</Tag>
                      <Tag color="purple">解决率 {(item.solve_rate * 100).toFixed(1)}%</Tag>
                    </Space>
                  </Card>
                ))}
              {demoItems.length === 0 && <Text type="secondary">暂无数据</Text>}
            </Space>
          </Card>

          <Card title="场景覆盖分布">
            <Space direction="vertical" style={{ width: '100%' }}>
              <Tag icon={<BookOutlined />} color="magenta">教学保障：{metrics.byCategory.teaching || 0}</Tag>
              <Tag icon={<ApartmentOutlined />} color="blue">机房保障：{metrics.byCategory.lab || 0}</Tag>
              <Tag icon={<TeamOutlined />} color="purple">社团保障：{metrics.byCategory.club || 0}</Tag>
              {Object.keys(metrics.byCategory).length === 0 && <Text type="secondary">暂无分类数据</Text>}
            </Space>
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default KnowledgeCenterPage;
