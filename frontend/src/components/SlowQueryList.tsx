import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { Table, Card, Button, Tag, Space, message, Empty, Input, Select, Row, Col } from 'antd';
import { EyeOutlined, ThunderboltOutlined, DownloadOutlined, SearchOutlined } from '@ant-design/icons';
import { slowQueryApi, SlowQuery, exportApi, SlowQueryStats } from '../services/api';
import { QueryDetailModal } from './QueryDetailModal';
import { StatsPanel } from './StatsPanel';

const { Search } = Input;
const { Option } = Select;

export const SlowQueryList: React.FC = () => {
  const [queries, setQueries] = useState<SlowQuery[]>([]);
  const [stats, setStats] = useState<SlowQueryStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [selectedQuery, setSelectedQuery] = useState<SlowQuery | null>(null);
  const [detailVisible, setDetailVisible] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [selectedDatabase, setSelectedDatabase] = useState<string | undefined>(undefined);
  const [minExecutionTime, setMinExecutionTime] = useState<number | undefined>(undefined);

  const fetchSlowQueries = useCallback(async () => {
    setLoading(true);
    try {
      const [queriesRes, statsRes] = await Promise.all([
        slowQueryApi.list({ 
          limit: 100,
          database: selectedDatabase,
          min_execution_time: minExecutionTime
        }),
        slowQueryApi.stats()
      ]);
      const data = queriesRes.data as SlowQuery[] | { items?: SlowQuery[] };
      const list = Array.isArray(data) ? data : (data && typeof data === 'object' && 'items' in data ? data.items ?? [] : []);
      if (list.length === 0) {
        setQueries([
          {
            id: 9001,
            sql_fingerprint: 'SELECT * FROM course_attendance WHERE course_id=?',
            sql_text: 'SELECT * FROM course_attendance WHERE course_id = 2026 ORDER BY created_at DESC;',
            execution_time: 2.438,
            lock_time: 0.012,
            rows_sent: 120,
            rows_examined: 15840,
            database: 'campus_lab',
            timestamp: new Date().toISOString(),
            query_time: 2.438,
            client_ip: '10.10.1.23',
            user: 'lab_reader',
          },
          {
            id: 9002,
            sql_fingerprint: 'SELECT * FROM live_stream_logs WHERE event_id=?',
            sql_text: 'SELECT * FROM live_stream_logs WHERE event_id = 88 AND status = "retry";',
            execution_time: 1.764,
            lock_time: 0.007,
            rows_sent: 45,
            rows_examined: 9640,
            database: 'campus_activity',
            timestamp: new Date().toISOString(),
            query_time: 1.764,
            client_ip: '10.10.3.17',
            user: 'club_service',
          },
        ]);
        setStats({
          total: 2,
          avg_execution_time: 2.101,
          max_execution_time: 2.438,
          by_database: { campus_lab: 1, campus_activity: 1 },
        });
        message.info('暂未采集到慢查询，已展示演示数据');
      } else {
        setQueries(list);
        setStats(statsRes.data as SlowQueryStats);
      }
    } catch (error) {
      message.error('获取慢查询列表失败');
    } finally {
      setLoading(false);
    }
  }, [selectedDatabase, minExecutionTime]);

  useEffect(() => {
    fetchSlowQueries();
  }, [fetchSlowQueries]);

  // 获取唯一的数据库列表
  const databases = useMemo(() => {
    const dbSet = new Set<string>();
    queries.forEach(q => {
      if (q.database) dbSet.add(q.database);
    });
    return Array.from(dbSet).sort();
  }, [queries]);

  // 过滤查询
  const filteredQueries = useMemo(() => {
    if (!searchText) return queries;
    const lowerSearch = searchText.toLowerCase();
    return queries.filter(q => 
      q.sql_text?.toLowerCase().includes(lowerSearch) ||
      q.sql_fingerprint?.toLowerCase().includes(lowerSearch) ||
      q.database?.toLowerCase().includes(lowerSearch)
    );
  }, [queries, searchText]);

  const handleViewDetail = (query: SlowQuery) => {
    setSelectedQuery(query);
    setDetailVisible(true);
  };

  const handleExport = async () => {
    try {
      const response = await exportApi.slowQueriesCSV(undefined, 1000);
      const blob = new Blob([response.data], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `slow_queries_${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      message.success('导出成功');
    } catch (error) {
      message.error('导出失败');
    }
  };

  const columns = [
    {
      title: 'ID',
      dataIndex: 'id',
      key: 'id',
      width: 80,
    },
    {
      title: 'SQL 指纹',
      dataIndex: 'sql_fingerprint',
      key: 'sql_fingerprint',
      ellipsis: { showTitle: false },
      width: 200,
      render: (text: string) => (
        <span 
          title={text}
          style={{ 
            fontFamily: 'monospace',
            fontSize: '12px',
            background: '#f5f5f5',
            padding: '2px 6px',
            borderRadius: 4,
            display: 'inline-block',
            maxWidth: '100%'
          }}
        >
          {text}
        </span>
      ),
    },
    {
      title: '执行时间 (s)',
      dataIndex: 'execution_time',
      key: 'execution_time',
      width: 120,
      sorter: (a: SlowQuery, b: SlowQuery) => a.execution_time - b.execution_time,
      render: (value: number) => (
        <Tag 
          color={value > 5 ? 'red' : value > 2 ? 'orange' : 'green'}
          style={{ 
            fontSize: '13px',
            padding: '2px 8px',
            fontWeight: value > 5 ? 'bold' : 'normal'
          }}
        >
          {value.toFixed(3)}
        </Tag>
      ),
    },
    {
      title: '锁时间 (s)',
      dataIndex: 'lock_time',
      key: 'lock_time',
      width: 120,
      render: (value: number) => (value != null ? Number(value).toFixed(3) : '-'),
    },
    {
      title: '扫描行数',
      dataIndex: 'rows_examined',
      key: 'rows_examined',
      width: 100,
    },
    {
      title: '返回行数',
      dataIndex: 'rows_sent',
      key: 'rows_sent',
      width: 100,
    },
    {
      title: '数据库',
      dataIndex: 'database',
      key: 'database',
      width: 120,
    },
    {
      title: '时间',
      dataIndex: 'timestamp',
      key: 'timestamp',
      width: 180,
      render: (value: string) => (value ? new Date(value).toLocaleString('zh-CN') : '-'),
    },
    {
      title: '操作',
      key: 'action',
      width: 120,
      render: (_: any, record: SlowQuery) => (
        <Space>
          <Button
            type="link"
            icon={<EyeOutlined />}
            onClick={() => handleViewDetail(record)}
          >
            详情
          </Button>
        </Space>
      ),
    },
  ];

  return (
    <div style={{ padding: '0' }}>
      <Card
        title={
          <Space>
            <ThunderboltOutlined style={{ fontSize: '20px', color: '#1890ff' }} />
            <span style={{ fontSize: '18px', fontWeight: 'bold' }}>慢查询列表</span>
            <Tag color="blue">{filteredQueries.length} 条</Tag>
          </Space>
        }
        extra={
          <Space>
            <Button icon={<DownloadOutlined />} onClick={handleExport}>
              导出CSV
            </Button>
            <Button type="primary" onClick={fetchSlowQueries}>
              刷新
            </Button>
          </Space>
        }
        style={{ marginBottom: 16 }}
      >
        <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
          <Col xs={24} sm={12} md={8}>
            <Search
              placeholder="搜索SQL语句、指纹或数据库"
              allowClear
              enterButton={<SearchOutlined />}
              size="large"
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              style={{ width: '100%' }}
            />
          </Col>
          <Col xs={24} sm={12} md={8}>
            <Select
              placeholder="选择数据库"
              allowClear
              size="large"
              style={{ width: '100%' }}
              value={selectedDatabase}
              onChange={setSelectedDatabase}
            >
              {databases.map(db => (
                <Option key={db} value={db}>{db}</Option>
              ))}
            </Select>
          </Col>
          <Col xs={24} sm={12} md={8}>
            <Select
              placeholder="最小执行时间"
              allowClear
              size="large"
              style={{ width: '100%' }}
              value={minExecutionTime}
              onChange={setMinExecutionTime}
            >
              <Option value={1}>≥ 1秒</Option>
              <Option value={2}>≥ 2秒</Option>
              <Option value={5}>≥ 5秒</Option>
              <Option value={10}>≥ 10秒</Option>
            </Select>
          </Col>
        </Row>
        <Table
          columns={columns}
          dataSource={filteredQueries}
          rowKey="id"
          loading={loading}
          locale={{ emptyText: <Empty description="暂无慢查询记录" /> }}
          pagination={{
            pageSize: 20,
            showSizeChanger: true,
            showTotal: (total) => `共 ${total} 条记录`,
            showQuickJumper: true,
          }}
          scroll={{ x: 1200 }}
        />
      </Card>

      <StatsPanel stats={stats} loading={loading} />

      <QueryDetailModal
        visible={detailVisible}
        query={selectedQuery}
        onClose={() => setDetailVisible(false)}
      />
    </div>
  );
};
