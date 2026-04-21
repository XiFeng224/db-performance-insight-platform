import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Alert, Button, Card, Col, Divider, Form, Input, Row, Select, Space, Steps, Tag, Typography, message } from 'antd';
import { ExclamationCircleOutlined, SafetyCertificateOutlined } from '@ant-design/icons';
import { knowledgeApi, KnowledgeItem, ticketsApi } from '../services/api';
import { campusTicketCategoryOptions, campusTicketSeverityOptions } from '../utils/campusMeta';

const { Title, Text, Paragraph } = Typography;

const TicketSubmitPage: React.FC = () => {
  const navigate = useNavigate();
  const [form] = Form.useForm();
  const [submitting, setSubmitting] = useState(false);
  const [knowledgeItems, setKnowledgeItems] = useState<KnowledgeItem[]>([]);
  const [impactScope, setImpactScope] = useState<'single' | 'room' | 'multi'>('single');
  const [urgencyLevel, setUrgencyLevel] = useState<'normal' | 'urgent' | 'sos'>('normal');
  const [drillMode, setDrillMode] = useState(false);
  const [matchedTips, setMatchedTips] = useState<KnowledgeItem[]>([]);

  useEffect(() => {
    const loadKnowledge = async () => {
      try {
        const res = await knowledgeApi.list({ limit: 80 });
        setKnowledgeItems(res.data.items || []);
      } catch {
        setKnowledgeItems([]);
      }
    };
    loadKnowledge();
  }, []);

  useEffect(() => {
    try {
      const title = form.getFieldValue('title') || '';
      if (!title.trim()) {
        setMatchedTips([]);
        return;
      }
      const kw = title.toLowerCase();
      const tips = knowledgeItems
        .filter((k) => {
          const text = `${k.title} ${k.keywords || ''} ${k.content}`.toLowerCase();
          return text.includes(kw) || kw.includes(k.title.toLowerCase());
        })
        .slice(0, 5);
      setMatchedTips(tips);
    } catch (error) {
      setMatchedTips([]);
    }
  }, [form, knowledgeItems]);

  const urgencyTag = useMemo(() => {
    if (urgencyLevel === 'sos') return <Tag color="red">重大故障/SOS</Tag>;
    if (urgencyLevel === 'urgent') return <Tag color="orange">紧急处理</Tag>;
    return <Tag color="blue">一般故障</Tag>;
  }, [urgencyLevel]);

  const onFinish = async (values: any) => {
    setSubmitting(true);
    try {
      const composedDescription = [
        values.description,
        `事件类型: ${values.category}`,
        `影响范围: ${impactScope === 'single' ? '单设备' : impactScope === 'room' ? '单教室/机房' : '多区域'}`,
        `紧急等级: ${urgencyLevel === 'sos' ? '重大故障' : urgencyLevel === 'urgent' ? '紧急' : '一般'}`,
        `楼栋教室/机房: ${values.location || '-'}`,
        `课程时段: ${values.course_time || '-'}`,
        `社团活动: ${values.club_event || '-'}`,
        `影响人数: ${values.affected_people || 0}`,
      ].join('\n');

      const severity = urgencyLevel === 'sos' ? 'high' : urgencyLevel === 'urgent' ? 'medium' : values.severity;

      const res = await ticketsApi.create({
        title: values.title,
        category: values.category,
        severity,
        location: values.location,
        asset_code: values.asset_code,
        description: composedDescription,
        drill_mode: drillMode,
      });
      message.success(`工单提交成功 #${res.data.ticket.id}`);
      form.resetFields();
      setImpactScope('single');
      setUrgencyLevel('normal');
    } catch {
      message.error('提交失败，请稍后重试');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fade-in">
      <Title level={2} style={{ marginBottom: 8 }}>校园报障提交中心</Title>
      <Paragraph type="secondary" style={{ marginBottom: 12 }}>
        面向实验室 / 机房 / 社团服务，支持值班联动、紧急升级与自动派单。
      </Paragraph>

      <Card style={{ marginBottom: 16 }}>
        <Steps
          size="small"
          items={[
            { title: '描述问题', description: '定位教学/机房/活动场景' },
            { title: '知识拦截', description: '优先自助恢复' },
            { title: '提交派单', description: '进入值班响应流程' },
          ]}
        />
      </Card>

      <Row gutter={[16, 16]}>
        <Col xs={24} lg={16}>
          <Card title="报修信息填写（校园场景）">
            <Form form={form} layout="vertical" onFinish={onFinish} initialValues={{ category: 'teaching_support', severity: 'medium', affected_people: 30 }}>
              <Form.Item label="问题标题" name="title" rules={[{ required: true, message: '请输入标题' }]}>
                <Input
                  placeholder="例如：3教402上课投影黑屏"
                />
              </Form.Item>

              {matchedTips.length > 0 && (
                <Alert
                  style={{ marginBottom: 12 }}
                  type="info"
                  showIcon
                  message="知识库命中建议（可先尝试自助处理）"
                  description={
                    <Space wrap>
                      {matchedTips.map((t) => (
                        <Tag
                          key={t.id}
                          color="blue"
                          style={{ cursor: 'pointer' }}
                          onClick={async () => {
                            try {
                              await knowledgeApi.markView(t.id);
                              message.info(`已查看：${t.title}`);
                            } catch {
                              message.warning('记录浏览失败');
                            }
                          }}
                        >
                          {t.title}
                        </Tag>
                      ))}
                    </Space>
                  }
                />
              )}

              <Form.Item label="问题描述" name="description" rules={[{ required: true, message: '请输入描述' }]}>
                <Input.TextArea rows={4} placeholder="请描述故障现象、影响课程/机房/活动、出现时间、已尝试措施" />
              </Form.Item>

              <Row gutter={12}>
                <Col xs={24} md={8}>
                  <Form.Item label="事件类型" name="category">
                    <Select options={campusTicketCategoryOptions} />
                  </Form.Item>
                </Col>
                <Col xs={24} md={8}>
                  <Form.Item label="严重级别" name="severity">
                    <Select options={campusTicketSeverityOptions} />
                  </Form.Item>
                </Col>
                <Col xs={24} md={8}>
                  <Form.Item label="楼栋/教室/机房" name="location">
                    <Input placeholder="如：3教402 / 机房B" />
                  </Form.Item>
                </Col>
              </Row>

              <Row gutter={12}>
                <Col xs={24} md={8}>
                  <Form.Item label="课程时段" name="course_time">
                    <Input placeholder="如：周二 3-4 节" />
                  </Form.Item>
                </Col>
                <Col xs={24} md={8}>
                  <Form.Item label="社团活动名称" name="club_event">
                    <Input placeholder="如：机器人大赛路演" />
                  </Form.Item>
                </Col>
                <Col xs={24} md={8}>
                  <Form.Item label="影响人数" name="affected_people">
                    <Input type="number" min={0} placeholder="如：45" />
                  </Form.Item>
                </Col>
              </Row>

              <Form.Item label="设备编号（可选）" name="asset_code">
                <Input placeholder="如：LAB-PC-03 / PJ-402" />
              </Form.Item>

              <Divider style={{ margin: '8px 0 16px' }} />

              <Space wrap style={{ marginBottom: 12 }}>
                <Text type="secondary">影响范围：</Text>
                <Select
                  value={impactScope}
                  onChange={(v) => setImpactScope(v)}
                  style={{ width: 180 }}
                  options={[
                    { label: '单设备', value: 'single' },
                    { label: '单教室/机房', value: 'room' },
                    { label: '多区域', value: 'multi' },
                  ]}
                />
                <Text type="secondary">紧急等级：</Text>
                <Select
                  value={urgencyLevel}
                  onChange={(v) => setUrgencyLevel(v)}
                  style={{ width: 180 }}
                  options={[
                    { label: '一般', value: 'normal' },
                    { label: '紧急', value: 'urgent' },
                    { label: '重大故障/SOS', value: 'sos' },
                  ]}
                />
                {urgencyTag}
                <Tag color={drillMode ? 'orange' : 'default'} style={{ cursor: 'pointer' }} onClick={() => setDrillMode((v) => !v)}>
                  {drillMode ? '演练模式：已开启' : '演练模式：未开启'}
                </Tag>
              </Space>

              <Form.Item>
                <Button type="primary" htmlType="submit" loading={submitting}>{drillMode ? '提交演练工单' : '提交工单并进入校园值班流程'}</Button>
              </Form.Item>
            </Form>
          </Card>
        </Col>

        <Col xs={24} lg={8}>
          <Card title="校园值班受理规则" style={{ marginBottom: 16 }}>
            <Space direction="vertical" size={8}>
              <Text>1. 课程中断类工单优先级最高</Text>
              <Text>2. 系统按当前值班老师/学生助理自动派单</Text>
              <Text>3. 接单后 5 分钟内需填写 ETA</Text>
              <Text>4. 关闭前须转“待验收”并通知报修方</Text>
            </Space>
          </Card>

          <Alert
            type={urgencyLevel === 'sos' ? 'error' : 'warning'}
            showIcon
            icon={<ExclamationCircleOutlined />}
            message={urgencyLevel === 'sos' ? '已进入重大故障模式' : '提交前提示'}
            description={
              urgencyLevel === 'sos'
                ? '建议同步电话通知中心值班老师，并说明受影响课程/活动范围。'
                : '建议附上现场照片或报错截图，提升首响效率。'
            }
            style={{ marginBottom: 16 }}
          />

          <Card title="快捷操作" extra={<SafetyCertificateOutlined />}>
            <Space direction="vertical" style={{ width: '100%' }}>
              <Button block onClick={() => navigate('/ai-assistant')}>前往AI智能受理</Button>
              <Button block onClick={() => navigate('/ticket-board')}>查看工单进度看板</Button>
            </Space>
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default TicketSubmitPage;
