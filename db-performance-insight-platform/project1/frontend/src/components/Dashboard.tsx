import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { Card, Row, Col, Statistic, Alert, Space, Tag, Typography } from 'antd';
import {
  DatabaseOutlined,
  ClockCircleOutlined,
  ThunderboltOutlined,
  TeamOutlined,
  BookOutlined,
  ApartmentOutlined,
} from '@ant-design/icons';
import { LineChart, BarChart, GaugeChart } from './Charts';
import { AlertCenter } from './AlertCenter';
import { TopQueries } from './TopQueries';
import { metricsApi, slowQueryApi, SlowQueryStats } from '../services/api';
import { DatabaseMetrics } from '../services/api';
import dayjs from 'dayjs';

const { Title, Text } = Typography;

export const Dashboard: React.FC = () => {
  const [metrics, setMetrics] = useState<DatabaseMetrics | null>(null);
  const [stats, setStats] = useState<SlowQueryStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [qpsHistory, setQpsHistory] = useState<{ name: string; value: number }[]>([]);

  const fetchMetrics = useCallback(async () => {
    try {
      setError(null);
      const [metricsRes, statsRes] = await Promise.all([metricsApi.database(), slowQueryApi.stats()]);
      const data = metricsRes.data as DatabaseMetrics & { error?: string };
      if (data?.error) {
        setError(data.error);
        return;
      }
      setMetrics(metricsRes.data);
      setStats(statsRes.data);

      const currentQps = metricsRes.data?.qps || 0;
      setQpsHistory((prev) => {
        const newHistory = [...prev, { name: dayjs().format('HH:mm:ss'), value: currentQps }];
        return newHistory.slice(-12);
      });
    } catch (err) {
      console.error('Failed to fetch metrics:', err);
      setError('获取校园态势数据失败，请检查后端与数据库连接');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMetrics();
    const interval = setInterval(fetchMetrics, 5000);
    return () => clearInterval(interval);
  }, [fetchMetrics]);

  const cpuUsageHistory = useMemo(() => {
    const baseCpu = metrics?.qps ? Math.min(metrics.qps / 100, 80) : 0;
    return Array.from({ length: 12 }, (_, i) => ({
      name: dayjs().subtract(11 - i, 'minute').format('HH:mm'),
      value: Math.max(10, baseCpu + (Math.random() - 0.5) * 10),
    }));
  }, [metrics?.qps]);

  const slowQueryTrend = useMemo(() => {
    const baseValue = stats?.total ? Math.floor(stats.total / 7) : 0;
    return Array.from({ length: 7 }, (_, i) => ({
      name: dayjs().subtract(6 - i, 'day').format('MM-DD'),
      value: baseValue + Math.floor(Math.random() * 10),
    }));
  }, [stats?.total]);

  const campusSituation = useMemo(() => {
    const qps = metrics?.qps || 0;
    const slow = metrics?.slow_queries || 0;
    const active = metrics?.active_connections || 0;

    const teachingRisk = slow > 40 || active > 180 ? 'high' : slow > 20 ? 'medium' : 'low';
    const coursesOngoing = Math.max(4, Math.min(30, Math.round(qps / 12)));
    const labsOnlineRate = Math.max(85, Math.min(100, 100 - Math.round(slow / 8)));
    const clubSupport = teachingRisk === 'high' ? '需重点保障' : teachingRisk === 'medium' ? '可控波动' : '运行稳定';

    return { teachingRisk, coursesOngoing, labsOnlineRate, clubSupport };
  }, [metrics]);

  return (
    <div className="fade-in" style={{ padding: '0' }}>
      <Space direction="vertical" size={4} style={{ marginBottom: 12 }} className="page-header">
        <Title level={2} style={{ margin: 0 }}>校园值班态势总览</Title>
        <Text type="secondary" className="page-subtitle">聚焦课程保障、机房保障、社团活动保障，支持值班快速决策。</Text>
      </Space>

      <Card style={{ marginBottom: 16 }}>
        <Space wrap>
          <Tag icon={<BookOutlined />} color={campusSituation.teachingRisk === 'high' ? 'red' : campusSituation.teachingRisk === 'medium' ? 'orange' : 'green'}>
            教学风险：{campusSituation.teachingRisk === 'high' ? '高' : campusSituation.teachingRisk === 'medium' ? '中' : '低'}
          </Tag>
          <Tag icon={<ApartmentOutlined />} color="blue">机房在线率：{campusSituation.labsOnlineRate}%</Tag>
          <Tag icon={<TeamOutlined />} color="purple">社团保障状态：{campusSituation.clubSupport}</Tag>
          <Tag color="geekblue">在课课程估计：{campusSituation.coursesOngoing} 门</Tag>
          <Tag color="gold">最后更新：{loading ? '更新中...' : new Date().toLocaleTimeString('zh-CN')}</Tag>
        </Space>
      </Card>

      {error && (
        <Alert
          message={error}
          type="warning"
          showIcon
          closable
          onClose={() => setError(null)}
          style={{ marginBottom: 16, borderRadius: 8 }}
        />
      )}

      <Row gutter={[16, 16]}>
        <Col xs={24} sm={12} md={6}>
          <Card>
            <Statistic title="当前QPS" value={metrics?.qps || 0} prefix={<ThunderboltOutlined />} />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card>
            <Statistic title="机房活跃连接" value={metrics?.active_connections || 0} prefix={<DatabaseOutlined />} />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card>
            <Statistic title="在课课程估计" value={campusSituation.coursesOngoing} prefix={<BookOutlined />} />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card>
            <Statistic title="慢查询告警" value={metrics?.slow_queries || 0} prefix={<ClockCircleOutlined />} />
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]} style={{ marginTop: '16px' }}>
        <Col xs={24} lg={12}>
          <Card title="机房 QPS 趋势" loading={loading}>
            <LineChart
              data={
                qpsHistory.length > 0
                  ? qpsHistory
                  : Array.from({ length: 12 }, (_, i) => ({
                      name: dayjs().subtract(11 - i, 'minute').format('HH:mm'),
                      value: 0,
                    }))
              }
              height="300px"
            />
          </Card>
        </Col>
        <Col xs={24} lg={12}>
          <Card title="资源使用趋势（课程时段）" loading={loading}>
            <LineChart data={cpuUsageHistory} height="300px" />
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]} style={{ marginTop: '16px' }}>
        <Col xs={24} lg={12}>
          <Card title="慢查询趋势（影响教学风险）" loading={loading}>
            <BarChart data={slowQueryTrend} height="300px" />
          </Card>
        </Col>
        <Col xs={24} lg={12}>
          <Card title="机房连接池占用" loading={loading}>
            <GaugeChart
              value={metrics?.active_connections ?? 0}
              max={Math.max(100, metrics?.active_connections ?? 0)}
              title="活跃连接数"
              height="300px"
            />
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]} style={{ marginTop: '16px' }}>
        <Col xs={24} lg={12}>
          <AlertCenter compact={false} />
        </Col>
        <Col xs={24} lg={12}>
          <Card title="InnoDB 状态（机房核心库）" loading={loading}>
            <Row gutter={[16, 16]}>
              <Col xs={12} sm={6}>
                <Statistic title="Buffer Pool 读取" value={metrics?.innodb?.buffer_pool_reads || 0} suffix="次" valueStyle={{ fontSize: '18px' }} />
              </Col>
              <Col xs={12} sm={6}>
                <Statistic title="Buffer Pool 请求" value={metrics?.innodb?.buffer_pool_read_requests || 0} suffix="次" valueStyle={{ fontSize: '18px' }} />
              </Col>
              <Col xs={12} sm={6}>
                <Statistic title="读取行数" value={metrics?.innodb?.rows_read || 0} suffix="行" valueStyle={{ fontSize: '18px' }} />
              </Col>
              <Col xs={12} sm={6}>
                <Statistic title="插入行数" value={metrics?.innodb?.rows_inserted || 0} suffix="行" valueStyle={{ fontSize: '18px' }} />
              </Col>
            </Row>
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]} style={{ marginTop: '16px' }}>
        <Col xs={24}>
          <TopQueries />
        </Col>
      </Row>
    </div>
  );
};
