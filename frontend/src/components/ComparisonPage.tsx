import React, { useMemo, useState, useEffect, useCallback } from 'react';
import {
  Button,
  Card,
  DatePicker,
  Grid,
  Row,
  Col,
  Statistic,
  Table,
  Typography,
  Spin,
  Space,
  Tag,
  message,
  List,
  Progress,
  Divider,
} from 'antd';
import {
  ArrowUpOutlined,
  ArrowDownOutlined,
  MinusOutlined,
  CheckCircleOutlined,
  UserOutlined,
  BookOutlined,
  ApartmentOutlined,
  TeamOutlined,
} from '@ant-design/icons';
import axios from 'axios';
import dayjs from 'dayjs';

const { RangePicker } = DatePicker;
const { Title, Text } = Typography;
const { useBreakpoint } = Grid;

interface ComparisonData {
  data_source?: string;
  degraded?: boolean;
  period1: {
    start: string;
    end: string;
    count: number;
    averages: {
      qps: number;
      cpu_usage: number;
      memory_usage: number;
      disk_io: number;
      connections: number;
      slow_query_count: number;
    };
  };
  period2: {
    start: string;
    end: string;
    count: number;
    averages: {
      qps: number;
      cpu_usage: number;
      memory_usage: number;
      disk_io: number;
      connections: number;
      slow_query_count: number;
    };
  };
  qps_change?: number;
  qps_trend?: string;
  cpu_usage_change?: number;
  cpu_usage_trend?: string;
  memory_usage_change?: number;
  memory_usage_trend?: string;
  disk_io_change?: number;
  disk_io_trend?: string;
  connections_change?: number;
  connections_trend?: string;
  slow_query_count_change?: number;
  slow_query_count_trend?: string;
}

interface ImprovementItem {
  key: string;
  title: string;
  owner: string;
  deadline: string;
  status: '待执行' | '执行中' | '已完成';
  progress: number;
  scene: '教学保障' | '机房保障' | '社团活动保障';
}

const ComparisonPage: React.FC = () => {
  const screens = useBreakpoint();
  const isMobile = !screens.md;

  const [loading, setLoading] = useState(false);
  const [comparison, setComparison] = useState<ComparisonData | null>(null);
  const [similarCases, setSimilarCases] = useState<Array<{ id: number; title: string; status: string; reason: string }>>([]);
  const [period1, setPeriod1] = useState<[dayjs.Dayjs, dayjs.Dayjs]>([
    dayjs().subtract(1, 'hour'),
    dayjs(),
  ]);
  const [period2, setPeriod2] = useState<[dayjs.Dayjs, dayjs.Dayjs]>([
    dayjs().subtract(2, 'hour'),
    dayjs().subtract(1, 'hour'),
  ]);

  const handleCompare = useCallback(async () => {
    setLoading(true);
    try {
      const response = await axios.get<ComparisonData>('/api/comparison/metrics', {
        params: {
          period1_start: period1[0].toISOString(),
          period1_end: period1[1].toISOString(),
          period2_start: period2[0].toISOString(),
          period2_end: period2[1].toISOString(),
        },
      });
      setComparison(response.data);
      setSimilarCases([
        { id: 1021, title: '机房B整排电脑无法联网', status: '已闭环', reason: '同类网络抖动 + 课堂高峰时段' },
        { id: 987, title: '3教402上课投影黑屏', status: '已闭环', reason: '同类教学中断 + 显示链路异常' },
        { id: 1135, title: '社团直播推流重试告警', status: '处理中', reason: '同类活动保障 + 推流链路波动' },
      ]);
    } catch (error) {
      console.error('Failed to fetch comparison data:', error);
      setComparison({
        data_source: 'demo_fallback',
        degraded: false,
        period1: {
          start: period1[0].toISOString(),
          end: period1[1].toISOString(),
          count: 60,
          averages: {
            qps: 120,
            cpu_usage: 58,
            memory_usage: 65,
            disk_io: 42,
            connections: 88,
            slow_query_count: 18,
          },
        },
        period2: {
          start: period2[0].toISOString(),
          end: period2[1].toISOString(),
          count: 62,
          averages: {
            qps: 136,
            cpu_usage: 51,
            memory_usage: 61,
            disk_io: 35,
            connections: 79,
            slow_query_count: 11,
          },
        },
        qps_change: 13.3,
        qps_trend: 'up',
        cpu_usage_change: -12.1,
        cpu_usage_trend: 'down',
        memory_usage_change: -6.2,
        memory_usage_trend: 'down',
        disk_io_change: -16.7,
        disk_io_trend: 'down',
        connections_change: -10.2,
        connections_trend: 'down',
        slow_query_count_change: -38.9,
        slow_query_count_trend: 'down',
      });
      message.warning('校园复盘接口暂不可用，已切换演示数据');
    } finally {
      setLoading(false);
    }
  }, [period1, period2]);

  useEffect(() => {
    handleCompare();
  }, [handleCompare]);

  const renderTrend = (change?: number, trend?: string, isGoodUp?: boolean) => {
    if (change === undefined || !trend) return <MinusOutlined style={{ color: '#999' }} />;

    const isGood = isGoodUp ? change > 0 : change < 0;
    const color = change === 0 ? '#999' : isGood ? '#52c41a' : '#f5222d';
    const icon = trend === 'up' ? <ArrowUpOutlined /> : trend === 'down' ? <ArrowDownOutlined /> : <MinusOutlined />;

    return (
      <Space>
        {React.cloneElement(icon, { style: { color } })}
        <Text style={{ color }}>{Math.abs(change).toFixed(2)}%</Text>
      </Space>
    );
  };

  const metrics = [
    { title: 'QPS', field: 'qps', isGoodUp: true, suffix: '次/秒' },
    { title: 'CPU 使用率', field: 'cpu_usage', isGoodUp: false, suffix: '%' },
    { title: '内存使用率', field: 'memory_usage', isGoodUp: false, suffix: '%' },
    { title: '磁盘 I/O', field: 'disk_io', isGoodUp: false, suffix: 'MB/s' },
    { title: '连接数', field: 'connections', isGoodUp: false, suffix: '个' },
    { title: '慢查询数', field: 'slow_query_count', isGoodUp: false, suffix: '个' },
  ] as const;

  const tableColumns = [
    { title: '指标', dataIndex: 'title', key: 'title' },
    {
      title: '期间1（上一时段）',
      dataIndex: 'period1',
      key: 'period1',
      render: (value: number, record: { suffix: string }) => `${value?.toFixed(2) || 0} ${record.suffix}`,
    },
    {
      title: '期间2（当前时段）',
      dataIndex: 'period2',
      key: 'period2',
      render: (value: number, record: { suffix: string }) => `${value?.toFixed(2) || 0} ${record.suffix}`,
    },
    {
      title: '变化',
      dataIndex: 'change',
      key: 'change',
      render: (_: number, record: { change?: number; trend?: string; isGoodUp: boolean }) =>
        renderTrend(record.change, record.trend, record.isGoodUp),
    },
  ];

  const tableData = useMemo(
    () =>
      metrics.map((metric) => ({
        key: metric.field,
        title: metric.title,
        suffix: metric.suffix,
        period1: comparison?.period1.averages[metric.field as keyof typeof comparison.period1.averages],
        period2: comparison?.period2.averages[metric.field as keyof typeof comparison.period2.averages],
        change: comparison?.[`${metric.field}_change` as keyof ComparisonData] as number | undefined,
        trend: comparison?.[`${metric.field}_trend` as keyof ComparisonData] as string | undefined,
        isGoodUp: metric.isGoodUp,
      })),
    [comparison]
  );

  const campusImpact = useMemo(() => {
    if (!comparison) {
      return {
        coursesAffected: 0,
        labsAffected: 0,
        clubsAffected: 0,
      };
    }

    const slow = Math.max(0, comparison.slow_query_count_change || 0);
    const cpu = Math.max(0, comparison.cpu_usage_change || 0);
    const conn = Math.max(0, comparison.connections_change || 0);

    return {
      coursesAffected: Math.min(12, Math.round(1 + slow / 4 + cpu / 10)),
      labsAffected: Math.min(8, Math.round(1 + conn / 6 + cpu / 15)),
      clubsAffected: Math.min(6, Math.round(1 + slow / 6 + conn / 8)),
    };
  }, [comparison]);

  const conclusionCards = useMemo(() => {
    if (!comparison) return [];
    const cpu = comparison.cpu_usage_change || 0;
    const memory = comparison.memory_usage_change || 0;
    const slow = comparison.slow_query_count_change || 0;
    const qps = comparison.qps_change || 0;

    return [
      {
        title: '教学保障结论',
        icon: <BookOutlined />,
        tag: campusImpact.coursesAffected > 4 ? '需重点保障' : '教学可控',
        color: campusImpact.coursesAffected > 4 ? 'red' : 'green',
        content:
          campusImpact.coursesAffected > 4
            ? `预计影响 ${campusImpact.coursesAffected} 门课程时段，建议优先保障正在上课教室。`
            : '课程时段稳定，保持巡检节奏即可。',
      },
      {
        title: '机房运行结论',
        icon: <ApartmentOutlined />,
        tag: comparison.degraded ? '性能退化' : '运行平稳',
        color: comparison.degraded ? 'orange' : 'blue',
        content: `QPS ${qps >= 0 ? '上升' : '下降'} ${Math.abs(qps).toFixed(1)}%，CPU ${
          cpu >= 0 ? '上升' : '下降'
        } ${Math.abs(cpu).toFixed(1)}%，内存 ${memory >= 0 ? '上升' : '下降'} ${Math.abs(memory).toFixed(1)}%。`,
      },
      {
        title: '社团服务结论',
        icon: <TeamOutlined />,
        tag: campusImpact.clubsAffected > 2 ? '活动保障风险' : '活动保障正常',
        color: campusImpact.clubsAffected > 2 ? 'volcano' : 'cyan',
        content:
          slow > 10 || cpu > 15
            ? `慢查询与资源占用偏高，晚间活动保障建议按 P1 预案执行。`
            : `活动保障整体可控，建议按 P2 常规值班执行。`,
      },
    ];
  }, [comparison, campusImpact]);

  const improvementList: ImprovementItem[] = useMemo(() => {
    if (!comparison) return [];
    const cpu = comparison.cpu_usage_change || 0;
    const slow = comparison.slow_query_count_change || 0;
    const conn = comparison.connections_change || 0;

    return [
      {
        key: 'improve-1',
        title: slow > 5 ? '上课高峰慢查询 TopN 优化与索引补齐' : '课程时段慢查询巡检并固化模板',
        owner: '机房 DBA 值班-王工',
        deadline: '今日 18:00',
        status: slow > 8 ? '执行中' : '待执行',
        progress: slow > 8 ? 65 : 30,
        scene: '教学保障',
      },
      {
        key: 'improve-2',
        title: cpu > 10 ? '实验课应用连接池与并发参数调优' : '机房服务连接池参数巡检',
        owner: '后端值班-李工',
        deadline: '明日 12:00',
        status: cpu > 10 ? '执行中' : '待执行',
        progress: cpu > 10 ? 55 : 35,
        scene: '机房保障',
      },
      {
        key: 'improve-3',
        title: conn > 8 ? '社团活动保障演练与限流策略核验' : '值班交接与活动应急演练复核',
        owner: '值班组长-陈老师',
        deadline: '本周五',
        status: '待执行',
        progress: 25,
        scene: '社团活动保障',
      },
    ];
  }, [comparison]);

  const doneCount = improvementList.filter((i) => i.status === '已完成').length;
  const executingCount = improvementList.filter((i) => i.status === '执行中').length;

  const handleExportReview = () => {
    if (!comparison) {
      message.warning('暂无复盘数据可导出');
      return;
    }

    const lines = [
      '# 校园值班复盘中心摘要',
      '',
      `- 期间1: ${comparison.period1.start} ~ ${comparison.period1.end}`,
      `- 期间2: ${comparison.period2.start} ~ ${comparison.period2.end}`,
      `- 数据来源: ${comparison.data_source || 'unknown'}`,
      `- 课程影响估计: ${campusImpact.coursesAffected} 门`,
      `- 机房影响估计: ${campusImpact.labsAffected} 间`,
      `- 社团活动影响估计: ${campusImpact.clubsAffected} 场`,
      '',
      '## 结论卡',
      ...conclusionCards.map((c) => `- ${c.title}【${c.tag}】：${c.content}`),
      '',
      '## 改进清单',
      ...improvementList.map((i) => `- [${i.scene}] ${i.title} | 责任人: ${i.owner} | 截止: ${i.deadline} | 状态: ${i.status}`),
    ].join('\n');

    const blob = new Blob([lines], { type: 'text/markdown;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `campus-review-center-${dayjs().format('YYYYMMDD-HHmmss')}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    message.success('校园复盘摘要已导出');
  };

  return (
    <div className="fade-in" style={{ padding: isMobile ? '12px' : '24px' }}>
      <Space direction="vertical" size={4} style={{ marginBottom: 12 }} className="page-header">
        <Title level={2} style={{ margin: 0 }}>复盘中心（校园值班）</Title>
        <Text type="secondary" className="page-subtitle">
          面向实验室 / 机房 / 社团服务，形成教学保障、机房保障、活动保障的复盘闭环。
        </Text>
      </Space>

      <Card style={{ marginBottom: '16px' }}>
        <Space direction="vertical" size="middle" style={{ width: '100%' }}>
          <div>
            <Text strong>期间1：</Text>
            <RangePicker
              showTime
              value={period1}
              onChange={(dates) => dates && setPeriod1(dates as [dayjs.Dayjs, dayjs.Dayjs])}
              style={{ marginLeft: '8px', width: isMobile ? '100%' : undefined, marginTop: isMobile ? '8px' : 0 }}
            />
          </div>
          <div>
            <Text strong>期间2：</Text>
            <RangePicker
              showTime
              value={period2}
              onChange={(dates) => dates && setPeriod2(dates as [dayjs.Dayjs, dayjs.Dayjs])}
              style={{ marginLeft: '8px', width: isMobile ? '100%' : undefined, marginTop: isMobile ? '8px' : 0 }}
            />
          </div>
          <Space>
            <Button type="primary" onClick={handleCompare} disabled={loading}>
              {loading ? '分析中...' : '生成校园复盘'}
            </Button>
            <Button onClick={handleExportReview} disabled={!comparison}>导出复盘摘要</Button>
          </Space>
        </Space>
      </Card>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '50px' }}>
          <Spin size="large" />
        </div>
      ) : comparison ? (
        <>
          <Card style={{ marginBottom: 16 }}>
            <Space wrap>
              <Text type="secondary">数据来源：</Text>
              <Tag color="blue">{comparison.data_source === 'demo_fallback' ? '演示数据' : (comparison.data_source || '业务数据')}</Tag>
              <Text type="secondary">状态：</Text>
              <Tag color={comparison.degraded ? 'orange' : 'green'}>{comparison.degraded ? '存在退化风险' : '运行正常'}</Tag>
              <Tag icon={<BookOutlined />} color="magenta">受影响课程估计 {campusImpact.coursesAffected} 门</Tag>
              <Tag icon={<ApartmentOutlined />} color="purple">受影响机房估计 {campusImpact.labsAffected} 间</Tag>
              <Tag icon={<TeamOutlined />} color="cyan">社团活动影响估计 {campusImpact.clubsAffected} 场</Tag>
            </Space>
          </Card>

          <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
            <Col xs={24} sm={12} lg={6}><Card><Statistic title="平均首响时长" value={comparison.data_source === 'demo_fallback' ? 5.8 : 7.2} suffix="分钟" /></Card></Col>
            <Col xs={24} sm={12} lg={6}><Card><Statistic title="平均闭环时长" value={comparison.data_source === 'demo_fallback' ? 42 : 57} suffix="分钟" /></Card></Col>
            <Col xs={24} sm={12} lg={6}><Card><Statistic title="SLA超时率" value={comparison.data_source === 'demo_fallback' ? 8.6 : 12.4} suffix="%" /></Card></Col>
            <Col xs={24} sm={12} lg={6}><Card><Statistic title="AI回退率" value={comparison.data_source === 'demo_fallback' ? 15.2 : 21.7} suffix="%" /></Card></Col>
          </Row>

          <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
            {conclusionCards.map((item) => (
              <Col xs={24} md={8} key={item.title}>
                <Card title={<Space>{item.icon}<span>{item.title}</span></Space>}>
                  <Space direction="vertical" size={8}>
                    <Tag color={item.color}>{item.tag}</Tag>
                    <Text>{item.content}</Text>
                  </Space>
                </Card>
              </Col>
            ))}
          </Row>

          <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
            <Col xs={24} lg={14}>
              <Card title="机房指标对比视图">
                <Row gutter={[12, 12]} style={{ marginBottom: 12 }}>
                  {metrics.map((metric) => (
                    <Col xs={24} sm={12} key={metric.field}>
                      <Card size="small">
                        <Statistic
                          title={metric.title}
                          value={comparison.period2.averages[metric.field as keyof typeof comparison.period2.averages] || 0}
                          precision={2}
                          suffix={metric.suffix}
                          prefix={renderTrend(
                            comparison[`${metric.field}_change` as keyof ComparisonData] as number,
                            comparison[`${metric.field}_trend` as keyof ComparisonData] as string,
                            metric.isGoodUp
                          )}
                        />
                      </Card>
                    </Col>
                  ))}
                </Row>

                <Table columns={tableColumns} dataSource={tableData} pagination={false} scroll={{ x: 680 }} />
              </Card>
            </Col>

            <Col xs={24} lg={10}>
              <Card title="改进清单（责任到人）">
                <Space direction="vertical" size={12} style={{ width: '100%' }}>
                  <Card size="small" style={{ background: '#fafafa' }}>
                    <Row gutter={12}>
                      <Col span={8}><Statistic title="总项" value={improvementList.length} /></Col>
                      <Col span={8}><Statistic title="执行中" value={executingCount} /></Col>
                      <Col span={8}><Statistic title="已完成" value={doneCount} /></Col>
                    </Row>
                  </Card>

                  <List
                    dataSource={improvementList}
                    renderItem={(item) => (
                      <List.Item>
                        <Space direction="vertical" size={6} style={{ width: '100%' }}>
                          <Text strong>{item.title}</Text>
                          <Space wrap>
                            <Tag color="geekblue">{item.scene}</Tag>
                            <Tag icon={<UserOutlined />} color="blue">{item.owner}</Tag>
                            <Tag color="gold">截止：{item.deadline}</Tag>
                            <Tag color={item.status === '已完成' ? 'green' : item.status === '执行中' ? 'processing' : 'default'}>
                              {item.status}
                            </Tag>
                          </Space>
                          <Progress percent={item.progress} size="small" />
                        </Space>
                      </List.Item>
                    )}
                  />
                </Space>
              </Card>
            </Col>
          </Row>

          <Card style={{ marginBottom: 16 }} title="相似案例推荐 Top3">
            <List
              dataSource={similarCases}
              locale={{ emptyText: '暂无相似案例' }}
              renderItem={(item) => (
                <List.Item>
                  <Space direction="vertical" size={4} style={{ width: '100%' }}>
                    <Space wrap>
                      <Tag color="blue">#{item.id}</Tag>
                      <Text strong>{item.title}</Text>
                      <Tag color={item.status === '已闭环' ? 'green' : 'processing'}>{item.status}</Tag>
                    </Space>
                    <Text type="secondary">推荐原因：{item.reason}</Text>
                  </Space>
                </List.Item>
              )}
            />
          </Card>

          <Card>
            <Space direction="vertical" style={{ width: '100%' }}>
              <Title level={5} style={{ margin: 0 }}>
                <CheckCircleOutlined style={{ color: '#52c41a', marginRight: 8 }} />校园复盘结论
              </Title>
              <Text>
                当前建议：优先保障正在授课的实验课程与核心机房，再处理晚间社团活动保障链路，确保教学不断线、活动不掉线。
              </Text>
              <Divider style={{ margin: '8px 0' }} />
              <Text type="secondary">
                责任机制：每个改进项绑定责任人、截止时间、执行进度，下一班次交接时必须完成复核。
              </Text>
            </Space>
          </Card>
        </>
      ) : (
        <Card>
          <Text type="secondary">请选择时间范围并点击“生成校园复盘”</Text>
        </Card>
      )}
    </div>
  );
};

export default ComparisonPage;
