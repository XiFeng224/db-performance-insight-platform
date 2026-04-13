import React from 'react';
import { Card, Row, Col, Statistic, Tag } from 'antd';
import { 
  ThunderboltOutlined, 
  ClockCircleOutlined,
  RiseOutlined
} from '@ant-design/icons';
import { SlowQueryStats } from '../services/api';

interface StatsPanelProps {
  stats: SlowQueryStats | null;
  loading?: boolean;
}

export const StatsPanel: React.FC<StatsPanelProps> = ({ stats, loading = false }) => {
  if (!stats) return null;

  const total = stats.total ?? (stats as any).total_count ?? 0;
  const avgTime = stats.avg_execution_time ?? 0;
  const maxTime = stats.max_execution_time ?? 0;
  const byDb = stats.by_database ?? {};

  return (
    <Card 
      title="慢查询统计" 
      loading={loading}
      style={{ marginTop: 16 }}
    >
      <Row gutter={[16, 16]}>
        <Col xs={24} sm={12} md={6}>
          <Statistic
            title="总慢查询数"
            value={total}
            prefix={<ThunderboltOutlined />}
            valueStyle={{ color: '#cf1322' }}
          />
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Statistic
            title="平均执行时间"
            value={avgTime}
            suffix="秒"
            prefix={<ClockCircleOutlined />}
            valueStyle={{ color: '#fa8c16' }}
            precision={3}
          />
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Statistic
            title="最大执行时间"
            value={maxTime}
            suffix="秒"
            prefix={<RiseOutlined />}
            valueStyle={{ color: '#ff4d4f' }}
            precision={3}
          />
        </Col>
        <Col xs={24} sm={12} md={6}>
          <div>
            <div style={{ marginBottom: 8, color: '#666' }}>按数据库分布</div>
            <div>
              {Object.entries(byDb).map(([db, count]) => (
                <Tag key={db} color="blue" style={{ marginBottom: 4 }}>
                  {db}: {count}
                </Tag>
              ))}
            </div>
          </div>
        </Col>
      </Row>
    </Card>
  );
};
