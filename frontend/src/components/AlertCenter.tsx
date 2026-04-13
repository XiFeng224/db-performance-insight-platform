import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert as AntAlert,
  Badge,
  Button,
  Card,
  Col,
  Drawer,
  Empty,
  List,
  Progress,
  Row,
  Segmented,
  Space,
  Statistic,
  Tag,
  Timeline,
  Typography,
  message,
} from 'antd';
import {
  BellOutlined,
  CheckOutlined,
  CloseOutlined,
  FireOutlined,
  WarningOutlined,
  UserOutlined,
  FieldTimeOutlined,
  ArrowRightOutlined,
  BookOutlined,
  ApartmentOutlined,
  TeamOutlined,
} from '@ant-design/icons';
import { alertsApi, Alert } from '../services/api';

const { Title, Text } = Typography;

interface AlertCenterProps {
  compact?: boolean;
}

const escalationPathMap: Record<string, string[]> = {
  critical: ['现场值班（学生助理）', '中心值班（老师）', '平台主管老师'],
  warning: ['现场值班（学生助理）', '中心值班（老师）'],
  info: ['现场值班（学生助理）'],
};

const dutyAssignees = [
  { name: '陈老师', role: '中心值班老师', shift: '08:00 - 16:00', phone: '分机 8001', status: '在线' },
  { name: '李同学', role: '机房学生助理', shift: '08:00 - 20:00', phone: '分机 8012', status: '在线' },
  { name: '王同学', role: '社团技术负责人', shift: '12:00 - 24:00', phone: '分机 8036', status: '巡检中' },
];

const severityText = (severity: string) => {
  if (severity === 'critical') return '严重';
  if (severity === 'warning') return '警告';
  if (severity === 'info') return '信息';
  return severity;
};

const getSeverityColor = (severity: string) => {
  if (severity === 'critical') return 'red';
  if (severity === 'warning') return 'orange';
  if (severity === 'info') return 'blue';
  return 'default';
};

const getCampusEventType = (alert: Alert) => {
  const text = `${alert.title} ${alert.message}`.toLowerCase();
  if (text.includes('class') || text.includes('课程') || text.includes('教学')) {
    return { label: '教学保障事件', color: 'magenta', icon: <BookOutlined /> };
  }
  if (text.includes('lab') || text.includes('机房') || text.includes('实验室')) {
    return { label: '机房保障事件', color: 'purple', icon: <ApartmentOutlined /> };
  }
  return { label: '社团活动保障事件', color: 'cyan', icon: <TeamOutlined /> };
};

const getHandlingProgress = (alert: Alert) => {
  const diffMinutes = Math.max(1, Math.floor((Date.now() - new Date(alert.created_at).getTime()) / 60000));
  if (alert.severity === 'critical') {
    if (diffMinutes <= 5) return 25;
    if (diffMinutes <= 15) return 55;
    if (diffMinutes <= 30) return 75;
    return 92;
  }
  if (alert.severity === 'warning') {
    if (diffMinutes <= 10) return 30;
    if (diffMinutes <= 25) return 60;
    return 85;
  }
  return 70;
};

const buildDemoAlerts = (): Alert[] => {
  const now = Date.now();
  return [
    {
      id: 9001,
      title: '3教402课堂投影链路告警',
      message: '课堂进行中出现黑屏，影响当前授课，请优先保障教学连续性。',
      severity: 'critical',
      current_value: 1,
      threshold_value: 0,
      created_at: new Date(now - 6 * 60 * 1000).toISOString(),
    },
    {
      id: 9002,
      title: '机房B交换机端口异常波动',
      message: '连续检测到丢包与重传，疑似端口抖动，建议切换备用链路。',
      severity: 'warning',
      current_value: 18,
      threshold_value: 8,
      created_at: new Date(now - 14 * 60 * 1000).toISOString(),
    },
    {
      id: 9003,
      title: '社团直播推流重试次数升高',
      message: '晚间活动推流链路重试次数超过基线，建议提前演练备链路。',
      severity: 'info',
      current_value: 7,
      threshold_value: 5,
      created_at: new Date(now - 22 * 60 * 1000).toISOString(),
    },
  ];
};

export const AlertCenter: React.FC<AlertCenterProps> = ({ compact = false }) => {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(false);
  const [severityFilter, setSeverityFilter] = useState<string>('all');
  const [selectedAlert, setSelectedAlert] = useState<Alert | null>(null);

  const fetchAlerts = async () => {
    setLoading(true);
    try {
      const response = await alertsApi.getActive();
      const serverAlerts = response.data || [];
      const demoMode = localStorage.getItem('campus_demo_mode') === '1';
      if (demoMode) {
        setAlerts(buildDemoAlerts());
      } else {
        setAlerts(serverAlerts.length > 0 ? serverAlerts : buildDemoAlerts());
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAlerts();
    const interval = setInterval(fetchAlerts, 10000);
    return () => clearInterval(interval);
  }, []);

  const handleResolve = async (alertId: number) => {
    try {
      await alertsApi.resolve(alertId);
      message.success('事件已接单并进入处置闭环');
      fetchAlerts();
    } catch {
      message.error('操作失败');
    }
  };

  const handleDismiss = async (alertId: number) => {
    try {
      await alertsApi.dismiss(alertId);
      message.success('事件已转派/忽略');
      fetchAlerts();
    } catch {
      message.error('操作失败');
    }
  };

  if (compact) {
    const criticalCount = alerts.filter((a) => a.severity === 'critical').length;
    const warningCount = alerts.filter((a) => a.severity === 'warning').length;
    return (
      <Badge count={criticalCount + warningCount} size="small">
        <BellOutlined style={{ fontSize: 18, cursor: 'pointer' }} />
      </Badge>
    );
  }

  const criticalCount = alerts.filter((a) => a.severity === 'critical').length;
  const warningCount = alerts.filter((a) => a.severity === 'warning').length;
  const infoCount = alerts.filter((a) => a.severity === 'info').length;

  const filteredAlerts = useMemo(
    () => alerts.filter((a) => severityFilter === 'all' || a.severity === severityFilter),
    [alerts, severityFilter]
  );

  return (
    <div className="fade-in">
      <Space direction="vertical" size={4} style={{ marginBottom: 12 }} className="page-header">
        <Title level={2} style={{ margin: 0 }}>告警作战台（校园值班）</Title>
        <Text type="secondary" className="page-subtitle">
          面向实验室 / 机房 / 社团服务的事件响应：升级路径、处置进度、值班接单人全链路可视化。
        </Text>
      </Space>

      <Row gutter={[16, 16]} style={{ marginBottom: 12 }}>
        <Col xs={24} md={6}><Card><Statistic title="严重事件" value={criticalCount} valueStyle={{ color: '#dc2626' }} prefix={<FireOutlined />} /></Card></Col>
        <Col xs={24} md={6}><Card><Statistic title="警告事件" value={warningCount} valueStyle={{ color: '#ea580c' }} prefix={<WarningOutlined />} /></Card></Col>
        <Col xs={24} md={6}><Card><Statistic title="信息事件" value={infoCount} valueStyle={{ color: '#2563eb' }} prefix={<BellOutlined />} /></Card></Col>
        <Col xs={24} md={6}><Card><Statistic title="值班在线" value={dutyAssignees.length} prefix={<UserOutlined />} /></Card></Col>
      </Row>

      <Row gutter={[16, 16]} style={{ marginBottom: 12 }}>
        <Col xs={24} lg={16}>
          <Card
            loading={loading}
            extra={<Button onClick={fetchAlerts}>刷新</Button>}
            title={<Space><BellOutlined /><span>校园事件队列</span><Badge count={alerts.length} showZero /></Space>}
          >
            {criticalCount > 0 && (
              <AntAlert
                type="error"
                showIcon
                style={{ marginBottom: 12 }}
                message={`当前存在 ${criticalCount} 条严重事件，请优先保障课堂与机房稳定。`}
              />
            )}

            <div style={{ marginBottom: 12 }}>
              <Segmented
                value={severityFilter}
                onChange={(v) => setSeverityFilter(String(v))}
                options={[
                  { label: `全部(${alerts.length})`, value: 'all' },
                  { label: `严重(${criticalCount})`, value: 'critical' },
                  { label: `警告(${warningCount})`, value: 'warning' },
                  { label: `信息(${infoCount})`, value: 'info' },
                ]}
              />
            </div>

            {filteredAlerts.length === 0 ? (
              <Empty description="当前筛选下暂无事件" />
            ) : (
              <List
                dataSource={filteredAlerts}
                renderItem={(alert) => {
                  const progress = getHandlingProgress(alert);
                  const assignee = dutyAssignees[alert.id % dutyAssignees.length];
                  const escalationPath = escalationPathMap[alert.severity] || escalationPathMap.warning;
                  const eventType = getCampusEventType(alert);

                  return (
                    <List.Item
                      style={{
                        padding: '14px',
                        marginBottom: 10,
                        borderRadius: 10,
                        border: `1px solid ${
                          alert.severity === 'critical' ? '#fecaca' : alert.severity === 'warning' ? '#fed7aa' : '#bfdbfe'
                        }`,
                        background: alert.severity === 'critical' ? '#fff1f2' : alert.severity === 'warning' ? '#fff7ed' : '#eff6ff',
                      }}
                      actions={[
                        <Button size="small" type="primary" icon={<CheckOutlined />} onClick={() => handleResolve(alert.id)}>接单处置</Button>,
                        <Button
                          size="small"
                          icon={<ArrowRightOutlined />}
                          onClick={async () => {
                            try {
                              const res = await alertsApi.toTicket(alert.id);
                              const ticketId = (res.data as any)?.ticket?.id;
                              message.success(ticketId ? `已转工单 #${ticketId}` : '已转工单');
                              fetchAlerts();
                            } catch {
                              message.error('告警转工单失败');
                            }
                          }}
                        >
                          一键转工单
                        </Button>,
                        <Button size="small" icon={<CloseOutlined />} onClick={() => handleDismiss(alert.id)}>转派/忽略</Button>,
                        <Button size="small" onClick={() => setSelectedAlert(alert)}>详情</Button>,
                      ]}
                    >
                      <List.Item.Meta
                        title={
                          <Space wrap>
                            <Text strong>{alert.title}</Text>
                            <Tag color={getSeverityColor(alert.severity)}>{severityText(alert.severity)}</Tag>
                            <Tag icon={eventType.icon} color={eventType.color}>{eventType.label}</Tag>
                            <Tag icon={<UserOutlined />} color="blue">接单人：{assignee.name}</Tag>
                          </Space>
                        }
                        description={
                          <Space direction="vertical" size={6} style={{ width: '100%' }}>
                            <Text>{alert.message}</Text>
                            <Text type="secondary">
                              当前值：{alert.current_value} / 阈值：{alert.threshold_value}
                              {' '}·{' '}
                              {new Date(alert.created_at).toLocaleString('zh-CN')}
                            </Text>

                            <div>
                              <Text type="secondary"><FieldTimeOutlined /> 处置进度</Text>
                              <Progress
                                percent={progress}
                                size="small"
                                status={progress >= 90 ? 'success' : 'active'}
                                strokeColor={alert.severity === 'critical' ? '#ef4444' : '#1677ff'}
                              />
                            </div>

                            <Space wrap>
                              <Text type="secondary">升级路径：</Text>
                              {escalationPath.map((node, idx) => (
                                <Space key={`${alert.id}-${node}`} size={4}>
                                  <Tag>{node}</Tag>
                                  {idx < escalationPath.length - 1 && <ArrowRightOutlined style={{ color: '#999' }} />}
                                </Space>
                              ))}
                            </Space>
                          </Space>
                        }
                      />
                    </List.Item>
                  );
                }}
              />
            )}
          </Card>
        </Col>

        <Col xs={24} lg={8}>
          <Card title="值班接单人">
            <Row gutter={[10, 10]}>
              {dutyAssignees.map((item) => (
                <Col xs={24} sm={12} lg={24} key={item.name}>
                  <Card
                    size="small"
                    style={{
                      borderRadius: 10,
                      border: '1px solid #e5e7eb',
                      background: '#fbfdff',
                    }}
                    bodyStyle={{ padding: '10px 12px' }}
                  >
                    <Space direction="vertical" size={4} style={{ width: '100%' }}>
                      <Space wrap>
                        <Tag color="blue" icon={<UserOutlined />} style={{ margin: 0 }}>{item.name}</Tag>
                        <Tag color="purple" style={{ margin: 0 }}>{item.role}</Tag>
                        <Tag color={item.status === '在线' ? 'green' : 'gold'} style={{ margin: 0 }}>{item.status}</Tag>
                      </Space>
                      <Text type="secondary">班次：{item.shift}</Text>
                      <Text type="secondary">联系方式：{item.phone}</Text>
                    </Space>
                  </Card>
                </Col>
              ))}
            </Row>

            <Card size="small" style={{ marginTop: 12, background: '#fafafa' }} title="校园升级策略提醒">
              <Timeline
                items={[
                  { color: 'red', children: '课堂中断/机房离线：5 分钟内接单，15 分钟内升级中心值班老师' },
                  { color: 'orange', children: '实验环境异常：15 分钟内处置，如持续波动升级平台主管老师' },
                  { color: 'blue', children: '社团活动保障告警：纳入观察队列，交接时统一复核' },
                ]}
              />
            </Card>
          </Card>
        </Col>
      </Row>

      <Drawer
        title={selectedAlert ? `事件详情 #${selectedAlert.id}` : '事件详情'}
        open={!!selectedAlert}
        onClose={() => setSelectedAlert(null)}
        width={520}
      >
        {selectedAlert && (
          <Space direction="vertical" style={{ width: '100%' }}>
            <Card size="small" title="基础信息">
              <p><b>标题：</b>{selectedAlert.title}</p>
              <p><b>级别：</b>{severityText(selectedAlert.severity)}</p>
              <p><b>事件类型：</b>{getCampusEventType(selectedAlert).label}</p>
              <p><b>触发时间：</b>{new Date(selectedAlert.created_at).toLocaleString('zh-CN')}</p>
              <p><b>描述：</b>{selectedAlert.message}</p>
              <p><b>升级路径：</b>{(escalationPathMap[selectedAlert.severity] || escalationPathMap.warning).join(' → ')}</p>
            </Card>
            <Card size="small" title="值班建议（校园场景）">
              <p>1. 先确认影响范围（课堂 / 实验室 / 社团活动现场）</p>
              <p>2. 若影响教学进程，立即电话通知中心值班老师并升级</p>
              <p>3. 处置过程同步记录到工单时间线，交接班必须复盘</p>
            </Card>
          </Space>
        )}
      </Drawer>
    </div>
  );
};
