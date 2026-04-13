import React, { useEffect, useMemo, useState } from 'react';
import { Button, Card, Col, Form, Input, InputNumber, Popconfirm, Row, Select, Space, Statistic, Switch, Table, Tag, Typography, message } from 'antd';
import { dutyApi, DutyShiftItem } from '../services/api';

const { Title, Text, Paragraph } = Typography;

const roleLabel: Record<string, string> = {
  teacher_on_duty: '值班老师',
  student_assistant: '学生助理',
  club_tech_lead: '社团技术负责人',
};

const DutySchedulePage: React.FC = () => {
  const [shifts, setShifts] = useState<DutyShiftItem[]>([]);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const res = await dutyApi.listShifts();
      setShifts(res.data.items || []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const createShift = async (values: any) => {
    try {
      await dutyApi.createShift(values);
      message.success('校园值班排班已创建');
      load();
    } catch {
      message.error('创建失败，请检查输入');
    }
  };

  const removeShift = async (id: number) => {
    try {
      await dutyApi.deleteShift(id);
      message.success('排班已删除');
      load();
    } catch {
      message.error('删除失败');
    }
  };

  const metrics = useMemo(() => {
    const activeCount = shifts.filter((s) => s.is_active).length;
    const roles = shifts.reduce((acc, cur) => {
      acc[cur.role] = (acc[cur.role] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    return { activeCount, roles };
  }, [shifts]);

  return (
    <div className="fade-in">
      <Space direction="vertical" size={4} style={{ marginBottom: 12 }} className="page-header">
        <Title level={2} style={{ margin: 0 }}>校园值班排班中心</Title>
        <Paragraph type="secondary" style={{ marginBottom: 0 }} className="page-subtitle">
          面向实验室 / 机房 / 社团服务，配置值班老师、学生助理、社团技术负责人，支撑自动派单与交接协作。
        </Paragraph>
      </Space>

      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={24} md={8}><Card><Statistic title="排班总数" value={shifts.length} /></Card></Col>
        <Col xs={24} md={8}><Card><Statistic title="当前在岗" value={metrics.activeCount} /></Card></Col>
        <Col xs={24} md={8}><Card><Statistic title="角色种类" value={Object.keys(metrics.roles).length} /></Card></Col>
      </Row>

      <Row gutter={[16, 16]}>
        <Col xs={24} lg={16}>
          <Card title="新增值班排班" style={{ marginBottom: 16 }}>
            <Form
              layout="vertical"
              onFinish={createShift}
              initialValues={{ role: 'student_assistant', is_active: true, start_time: '09:00', end_time: '17:00' }}
            >
              <Row gutter={12}>
                <Col xs={24} md={6}>
                  <Form.Item name="user_id" label="值班员ID" rules={[{ required: true, message: '请输入值班员ID' }]}>
                    <InputNumber placeholder="如 1001" min={1} style={{ width: '100%' }} />
                  </Form.Item>
                </Col>
                <Col xs={24} md={6}>
                  <Form.Item name="role" label="角色">
                    <Select
                      options={[
                        { label: '值班老师', value: 'teacher_on_duty' },
                        { label: '学生助理', value: 'student_assistant' },
                        { label: '社团技术负责人', value: 'club_tech_lead' },
                      ]}
                    />
                  </Form.Item>
                </Col>
                <Col xs={24} md={5}>
                  <Form.Item name="start_time" label="开始时间" rules={[{ required: true }]}>
                    <Select options={Array.from({ length: 24 }).map((_, h) => ({ label: `${String(h).padStart(2, '0')}:00`, value: `${String(h).padStart(2, '0')}:00` }))} />
                  </Form.Item>
                </Col>
                <Col xs={24} md={5}>
                  <Form.Item name="end_time" label="结束时间" rules={[{ required: true }]}>
                    <Select options={Array.from({ length: 24 }).map((_, h) => ({ label: `${String(h).padStart(2, '0')}:00`, value: `${String(h).padStart(2, '0')}:00` }))} />
                  </Form.Item>
                </Col>
                <Col xs={24} md={2}>
                  <Form.Item name="is_active" label="启用" valuePropName="checked">
                    <Switch />
                  </Form.Item>
                </Col>
              </Row>

              <Row gutter={12}>
                <Col xs={24} md={12}>
                  <Form.Item name="campus_area" label="负责区域（可选）">
                    <Input placeholder="如：3教A区 / 机房B / 社团活动中心" />
                  </Form.Item>
                </Col>
                <Col xs={24} md={12}>
                  <Form.Item name="handover_note" label="交接备注（可选）">
                    <Input placeholder="如：重点关注晚间社团路演保障" />
                  </Form.Item>
                </Col>
              </Row>

              <Form.Item>
                <Button type="primary" htmlType="submit">新增排班</Button>
              </Form.Item>
            </Form>
          </Card>

          <Card title="排班列表（支持交接）">
            <Table
              rowKey="id"
              loading={loading}
              dataSource={shifts}
              columns={[
                { title: 'ID', dataIndex: 'id', width: 70 },
                { title: '值班员ID', dataIndex: 'user_id', width: 120 },
                {
                  title: '角色',
                  dataIndex: 'role',
                  width: 170,
                  render: (v: string) => <Tag color="blue">{roleLabel[v] || v}</Tag>,
                },
                { title: '开始', dataIndex: 'start_time', width: 100 },
                { title: '结束', dataIndex: 'end_time', width: 100 },
                {
                  title: '状态',
                  dataIndex: 'is_active',
                  width: 120,
                  render: (v: boolean) => (v ? <Tag color="green">在岗</Tag> : <Tag>离岗</Tag>),
                },
                {
                  title: '操作',
                  render: (_: any, row: DutyShiftItem) => (
                    <Space>
                      <Popconfirm title="确认删除该排班？" onConfirm={() => removeShift(row.id)}>
                        <Button size="small" danger>删除</Button>
                      </Popconfirm>
                    </Space>
                  ),
                },
              ]}
            />
          </Card>
        </Col>

        <Col xs={24} lg={8}>
          <Card title="校园排班策略" style={{ marginBottom: 16 }}>
            <Space direction="vertical" size={8}>
              <Text>1. 课程高峰时段优先保障“值班老师 + 学生助理”双在岗</Text>
              <Text>2. 重大活动前后至少保留 15 分钟交接窗口</Text>
              <Text>3. 课程中断类工单直接升级中心值班老师</Text>
              <Text>4. 社团活动保障由社团技术负责人联动处置</Text>
            </Space>
          </Card>

          <Card title="角色分布">
            <Space direction="vertical" style={{ width: '100%' }}>
              {Object.entries(metrics.roles).map(([role, count]) => (
                <div key={role} style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Text>{roleLabel[role] || role}</Text>
                  <Tag>{count}</Tag>
                </div>
              ))}
              {Object.keys(metrics.roles).length === 0 && <Text type="secondary">暂无排班数据</Text>}
            </Space>
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default DutySchedulePage;
