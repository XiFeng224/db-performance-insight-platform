import React, { useEffect, useState } from 'react';
import { Card, List, Tag, Statistic, Row, Col } from 'antd';
import { ThunderboltOutlined, ClockCircleOutlined, RiseOutlined } from '@ant-design/icons';
import { slowQueryApi, SlowQuery } from '../services/api';

export const TopQueries: React.FC = () => {
  const [topQueries, setTopQueries] = useState<SlowQuery[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchTopQueries();
  }, []);

  const fetchTopQueries = async () => {
    setLoading(true);
    try {
      const response = await slowQueryApi.list({ limit: 10 });
      const queries = response.data;
      // 按执行时间排序，取前5
      const sorted = [...queries].sort((a, b) => b.execution_time - a.execution_time).slice(0, 5);
      setTopQueries(sorted);
    } catch (error) {
      console.error('Failed to fetch top queries:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card
      title={
        <span style={{ fontSize: '16px', fontWeight: 'bold' }}>
          <RiseOutlined style={{ marginRight: 8, color: '#ff4d4f' }} />
          Top 5 慢查询
        </span>
      }
      loading={loading}
      style={{ borderRadius: 8 }}
    >
      <List
        dataSource={topQueries}
        renderItem={(query, index) => (
          <List.Item
            style={{
              padding: '12px',
              marginBottom: 8,
              borderRadius: 6,
              background: index === 0 ? '#fff1f0' : '#fafafa',
              border: index === 0 ? '2px solid #ff4d4f' : '1px solid #f0f0f0'
            }}
          >
            <List.Item.Meta
              avatar={
                <div style={{
                  width: 32,
                  height: 32,
                  borderRadius: '50%',
                  background: index === 0 ? '#ff4d4f' : index === 1 ? '#fa8c16' : '#1890ff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'white',
                  fontWeight: 'bold'
                }}>
                  {index + 1}
                </div>
              }
              title={
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Tag color={index === 0 ? 'red' : index === 1 ? 'orange' : 'blue'}>
                    #{index + 1}
                  </Tag>
                  <span style={{ 
                    fontFamily: 'monospace',
                    fontSize: '12px',
                    maxWidth: '400px',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap'
                  }}>
                    {query.sql_fingerprint}
                  </span>
                </div>
              }
              description={
                <Row gutter={16} style={{ marginTop: 8 }}>
                  <Col span={8}>
                    <Statistic
                      title="执行时间"
                      value={query.execution_time}
                      suffix="秒"
                      prefix={<ClockCircleOutlined />}
                      valueStyle={{ fontSize: '14px', color: '#ff4d4f' }}
                      precision={3}
                    />
                  </Col>
                  <Col span={8}>
                    <Statistic
                      title="扫描行数"
                      value={query.rows_examined}
                      prefix={<ThunderboltOutlined />}
                      valueStyle={{ fontSize: '14px' }}
                    />
                  </Col>
                  <Col span={8}>
                    <Tag color="blue">{query.database || 'N/A'}</Tag>
                  </Col>
                </Row>
              }
            />
          </List.Item>
        )}
      />
    </Card>
  );
};
