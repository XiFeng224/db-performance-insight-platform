import React, { useEffect, useMemo, useState } from 'react';
import { Alert, Button, Card, Col, Divider, Form, Input, Row, Select, Space, Steps, Tabs, Tag, Typography, message } from 'antd';
import { BulbOutlined, FileTextOutlined, RobotOutlined, NotificationOutlined, ThunderboltOutlined } from '@ant-design/icons';
import { assistantApi, ticketsApi } from '../services/api';
import { getCampusSceneHint, getCampusTicketSeverityMeta } from '../utils/campusMeta';

const { TextArea } = Input;
const { Title, Text, Paragraph } = Typography;

const AIAssistantPage: React.FC = () => {
  const [chatInput, setChatInput] = useState('');
  const [chatAnswer, setChatAnswer] = useState('');
  const [chatSource, setChatSource] = useState('');
  const [chatRefs, setChatRefs] = useState<any[]>([]);
  const [loadingChat, setLoadingChat] = useState(false);

  const [intakeText, setIntakeText] = useState('');
  const [intakeMode, setIntakeMode] = useState<'auto' | 'rule' | 'llm'>('auto');
  const [draft, setDraft] = useState<any>(null);
  const [ruleDraft, setRuleDraft] = useState<any>(null);
  const [loadingIntake, setLoadingIntake] = useState(false);

  const [handover, setHandover] = useState('');
  const [loadingHandover, setLoadingHandover] = useState(false);
  const [stats, setStats] = useState<{ count: number; avg_latency_ms: number; fallback_rate: number } | null>(null);

  const sceneHint = useMemo(() => {
    const text = `${chatInput} ${intakeText}`;
    return getCampusSceneHint(text);
  }, [chatInput, intakeText]);

  const loadStats = async () => {
    try {
      const res = await assistantApi.stats();
      setStats(res.data);
    } catch {
      setStats(null);
    }
  };

  useEffect(() => {
    loadStats();
  }, []);

  const handleChat = async () => {
    if (!chatInput.trim()) return;
    setLoadingChat(true);
    try {
      const res = await assistantApi.chat(chatInput);
      setChatAnswer(res.data.answer || '');
      setChatSource(res.data.source || '');
      setChatRefs(res.data.references || []);
      loadStats();
    } finally {
      setLoadingChat(false);
    }
  };

  const handleIntake = async () => {
    if (!intakeText.trim()) return;
    setLoadingIntake(true);
    try {
      const [res, ruleRes] = await Promise.all([
        assistantApi.intake(intakeText, intakeMode),
        assistantApi.intake(intakeText, 'rule'),
      ]);
      setDraft(res.data);
      setRuleDraft(ruleRes.data);
      loadStats();
    } finally {
      setLoadingIntake(false);
    }
  };

  const submitDraftTicket = async () => {
    if (!draft) return;
    await ticketsApi.create({
      title: draft.title,
      description: draft.description,
      category: draft.category,
      severity: draft.severity,
      location: draft.location,
    });
    message.success('已根据AI受理结果创建工单');
  };

  const copyNotifyTemplate = async () => {
    const text = [
      '【校园值班通报】',
      `事件场景：${sceneHint.scene}`,
      `建议分级：${sceneHint.level}`,
      `升级链路：${sceneHint.escalate}`,
      '当前状态：已接单处理中，请相关老师/同学保持通讯畅通。',
    ].join('\n');

    try {
      await navigator.clipboard.writeText(text);
      message.success('通报模板已复制');
    } catch {
      message.info('浏览器未授权复制，请手动复制下方模板');
    }
  };

  const handleHandover = async (values: any) => {
    setLoadingHandover(true);
    try {
      const unresolved = (values.unresolved || '').split('\n').map((s: string) => s.trim()).filter(Boolean);
      const incidents = (values.incidents || '').split('\n').map((s: string) => s.trim()).filter(Boolean);
      const res = await assistantApi.handoverSummary({
        shift_name: values.shift_name,
        unresolved_tickets: unresolved,
        incidents,
      });
      setHandover(res.data.summary || '');
    } finally {
      setLoadingHandover(false);
    }
  };

  return (
    <div className="fade-in">
      <Space direction="vertical" size={4} style={{ marginBottom: 12 }} className="page-header">
        <Title level={2} style={{ margin: 0 }}>智值守 AI 指挥助手</Title>
        <Paragraph type="secondary" style={{ marginBottom: 0 }} className="page-subtitle">
          面向实验室 / 机房 / 社团服务，提供事件分级、处置建议、升级链路与通报模板。
        </Paragraph>
      </Space>

      <Card style={{ marginBottom: 12 }}>
        <Space wrap>
          <Tag color="magenta">场景：{sceneHint.scene}</Tag>
          <Tag color="red">建议分级：{sceneHint.level}</Tag>
          <Tag color="blue">升级：{sceneHint.escalate}</Tag>
          <Button size="small" icon={<NotificationOutlined />} onClick={copyNotifyTemplate}>复制通报模板</Button>
        </Space>
        {stats && (
          <Space wrap style={{ marginTop: 10 }}>
            <Tag color="green">AI调用数：{stats.count}</Tag>
            <Tag color="processing">平均延迟：{stats.avg_latency_ms}ms</Tag>
            <Tag color={stats.fallback_rate > 0.3 ? 'orange' : 'blue'}>回退率：{(stats.fallback_rate * 100).toFixed(1)}%</Tag>
          </Space>
        )}
      </Card>

      <Card style={{ marginBottom: 16 }}>
        <Steps
          size="small"
          items={[
            { title: '智能问答', description: '定位SOP与应急路径' },
            { title: '智能受理', description: '自动分级并生成工单草稿' },
            { title: '交接摘要', description: '沉淀班次交接与复盘要点' },
          ]}
        />
      </Card>

      <Tabs
        items={[
          {
            key: 'chat',
            label: '校园事件问答',
            children: (
              <Row gutter={[16, 16]}>
                <Col xs={24} lg={16}>
                  <Card title={<Space><RobotOutlined />问答输入</Space>}>
                    <Space direction="vertical" style={{ width: '100%' }}>
                      <TextArea rows={5} value={chatInput} onChange={(e) => setChatInput(e.target.value)} placeholder="例如：3教402上课中投影黑屏，如何快速恢复？" />
                      <Button type="primary" onClick={handleChat} loading={loadingChat}>开始问答</Button>

                      {chatAnswer && (
                        <Card size="small" title="AI回答结果">
                          <Space wrap style={{ marginBottom: 8 }}>
                            <Tag color={
                              chatSource === 'qwen' || chatSource === 'qwen_with_kb' ? 'green' :
                              chatSource === 'knowledge_base' ? 'blue' : 'orange'
                            }>
                              {chatSource === 'qwen_with_kb' ? '千问增强（知识库优先）' :
                               chatSource === 'qwen' ? '千问回答' :
                               chatSource === 'knowledge_base' ? '知识库直答' : '规则兜底'}
                            </Tag>
                          </Space>
                          <pre style={{ whiteSpace: 'pre-wrap', margin: 0 }}>{chatAnswer}</pre>
                          {chatRefs.length > 0 && (
                            <>
                              <Divider style={{ margin: '12px 0' }} />
                              <Text type="secondary">命中校园知识库：</Text>
                              <div style={{ marginTop: 8 }}>
                                <Space wrap>
                                  {chatRefs.map((r) => <Tag key={r.id} color="blue">{r.title}</Tag>)}
                                </Space>
                              </div>
                            </>
                          )}
                        </Card>
                      )}
                    </Space>
                  </Card>
                </Col>
                <Col xs={24} lg={8}>
                  <Card title={<Space><BulbOutlined />处置建议</Space>}>
                    <Space direction="vertical" size={8}>
                      <Text>• 输入“地点 + 现象 + 影响范围”，建议更精准</Text>
                      <Text>• 优先级统一：P1=high，P2=medium，P3=low</Text>
                      <Text>• 如影响授课，按 P1 直接升级中心值班老师</Text>
                      <Text>• 社团活动故障需同步活动负责人与值班老师</Text>
                    </Space>
                  </Card>
                </Col>
              </Row>
            ),
          },
          {
            key: 'intake',
            label: '工单智能受理',
            children: (
              <Row gutter={[16, 16]}>
                <Col xs={24} lg={16}>
                  <Card title="自然语言转工单草稿">
                    <Space direction="vertical" style={{ width: '100%' }}>
                      <TextArea rows={5} value={intakeText} onChange={(e) => setIntakeText(e.target.value)} placeholder="例如：机房B整排电脑无法联网，影响第3-4节实验课" />
                      <Space wrap>
                        <Select
                          value={intakeMode}
                          style={{ width: 220 }}
                          onChange={(v) => setIntakeMode(v)}
                          options={[
                            { label: '自动模式（推荐）', value: 'auto' },
                            { label: '规则模式（稳态）', value: 'rule' },
                            { label: 'AI增强模式（演示）', value: 'llm' },
                          ]}
                        />
                        <Button type="primary" onClick={handleIntake} loading={loadingIntake}>生成工单草稿</Button>
                      </Space>

                      {draft && (
                        <Card size="small" title="受理草稿（可直接创建）">
                          <p><b>标题：</b>{draft.title}</p>
                          <p><b>类型：</b><Tag>{draft.category}</Tag></p>
                          <p><b>级别：</b><Tag color={getCampusTicketSeverityMeta(draft.severity).color}>{getCampusTicketSeverityMeta(draft.severity).label}</Tag></p>
                          <p><b>地点：</b>{draft.location || '-'}</p>
                          <p><b>引擎来源：</b>
                            <Tag color={draft.engine === 'qwen' ? 'green' : 'blue'} style={{ marginLeft: 8 }}>
                              {draft.engine === 'qwen' ? '千问增强' : '规则引擎'}
                            </Tag>
                            {draft.fallback && <Tag color="orange">AI失败已回退</Tag>}
                          </p>
                          <p><b>处置建议：</b></p>
                          <ul>
                            {(draft.recommendation || []).map((x: string, idx: number) => <li key={idx}>{x}</li>)}
                          </ul>

                          {ruleDraft && (
                            <Card size="small" style={{ marginBottom: 8 }} title="规则 vs 当前模式 对比">
                              <Space direction="vertical" size={6} style={{ width: '100%' }}>
                                <Text>规则模式：<Tag color="blue">{ruleDraft.category}</Tag> / <Tag color={getCampusTicketSeverityMeta(ruleDraft.severity).color}>{getCampusTicketSeverityMeta(ruleDraft.severity).label}</Tag></Text>
                                <Text>当前模式：<Tag color="green">{draft.category}</Tag> / <Tag color={getCampusTicketSeverityMeta(draft.severity).color}>{getCampusTicketSeverityMeta(draft.severity).label}</Tag></Text>
                                <Text type="secondary">可用于答辩说明：AI是否提升了分类/分级准确性与建议完整度。</Text>
                              </Space>
                            </Card>
                          )}

                          <Button type="primary" onClick={submitDraftTicket}>一键创建工单</Button>
                        </Card>
                      )}
                    </Space>
                  </Card>
                </Col>
                <Col xs={24} lg={8}>
                  <Alert type="info" showIcon icon={<ThunderboltOutlined />} message="受理规则" description="自动识别课堂中断关键词，优先建议高等级响应与升级。" />
                </Col>
              </Row>
            ),
          },
          {
            key: 'handover',
            label: '交接摘要',
            children: (
              <Row gutter={[16, 16]}>
                <Col xs={24} lg={16}>
                  <Card title={<Space><FileTextOutlined />值班交接助手</Space>}>
                    <Form layout="vertical" onFinish={handleHandover} initialValues={{ shift_name: '晚班' }}>
                      <Row gutter={16}>
                        <Col xs={24} md={8}>
                          <Form.Item name="shift_name" label="班次名称">
                            <Input placeholder="如：白班/晚班" />
                          </Form.Item>
                        </Col>
                      </Row>
                      <Form.Item name="unresolved" label="未完成工单（每行一条）">
                        <TextArea rows={4} placeholder="#12 3教402投影仪无信号\n#15 机房B共享盘不可用" />
                      </Form.Item>
                      <Form.Item name="incidents" label="异常事件（每行一条）">
                        <TextArea rows={4} placeholder="晚高峰网络抖动\n社团路演直播编码器重启" />
                      </Form.Item>
                      <Form.Item>
                        <Button type="primary" htmlType="submit" loading={loadingHandover}>生成交接摘要</Button>
                      </Form.Item>
                    </Form>

                    {handover && (
                      <Card size="small" title="交接摘要结果">
                        <pre style={{ whiteSpace: 'pre-wrap', margin: 0 }}>{handover}</pre>
                      </Card>
                    )}
                  </Card>
                </Col>
                <Col xs={24} lg={8}>
                  <Alert type="success" showIcon message="交接规范" description="必须包含：未闭环事项、风险提醒、下一班优先动作。" />
                </Col>
              </Row>
            ),
          },
        ]}
      />
    </div>
  );
};

export default AIAssistantPage;
