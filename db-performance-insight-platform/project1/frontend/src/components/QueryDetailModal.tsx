import React, { useCallback, useEffect, useState } from 'react';
import { Modal, Tabs, Card, List, Tag, Alert, Spin, Button, message } from 'antd';
import { CopyOutlined } from '@ant-design/icons';
import { ExecutionPlanVisualization } from './ExecutionPlanVisualization';
import { SQLScorer } from './SQLScorer';
import { executionPlanApi, optimizationApi, ExecutionPlanVisualization as ExecPlanViz, OptimizationSuggestion } from '../services/api';

interface QueryDetailModalProps {
  visible: boolean;
  query: any;
  onClose: () => void;
}

export const QueryDetailModal: React.FC<QueryDetailModalProps> = ({ visible, query, onClose }) => {
  const [executionPlan, setExecutionPlan] = useState<ExecPlanViz | null>(null);
  const [suggestions, setSuggestions] = useState<OptimizationSuggestion[]>([]);
  const [planIssues, setPlanIssues] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchExecutionPlan = useCallback(async () => {
    if (!query?.sql_text) return;
    setLoading(true);
    try {
      const response = await executionPlanApi.analyze(query.sql_text);
      setExecutionPlan(response.data?.visualization ?? null);
      setPlanIssues(response.data?.issues || []);
    } catch (error) {
      console.error('Failed to fetch execution plan:', error);
    } finally {
      setLoading(false);
    }
  }, [query]);

  const generateSuggestions = useCallback(async () => {
    if (!query?.id) return;
    try {
      const response = await optimizationApi.generate({
        slow_query_id: query.id,
        sql: query.sql_text ?? '',
      });
      setSuggestions(response.data?.suggestions || []);
    } catch (error) {
      console.error('Failed to generate suggestions:', error);
    }
  }, [query]);

  const fetchSuggestions = useCallback(async () => {
    if (!query?.id) return;
    try {
      const response = await optimizationApi.getSuggestions(query.id);
      const list = response.data?.suggestions || [];
      setSuggestions(list);
      if (list.length === 0) {
        await generateSuggestions();
      }
    } catch (error) {
      console.error('Failed to fetch suggestions:', error);
    }
  }, [generateSuggestions, query]);

  useEffect(() => {
    if (visible && query) {
      fetchExecutionPlan();
      fetchSuggestions();
    }
  }, [visible, query, fetchExecutionPlan, fetchSuggestions]);

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high':
        return 'red';
      case 'medium':
        return 'orange';
      case 'low':
        return 'green';
      default:
        return 'default';
    }
  };

  const tabItems = [
    {
      key: 'plan',
      label: '执行计划',
      children: loading ? (
        <Spin size="large" style={{ display: 'block', textAlign: 'center', padding: 40 }} />
      ) : (
        <>
          {planIssues.length > 0 && (
            <Alert
              message="发现潜在问题"
              description={
                <ul>
                  {planIssues.map((issue, index) => (
                    <li key={index}>
                      <Tag color={issue.severity === 'high' ? 'red' : 'orange'}>
                        {issue.severity}
                      </Tag>
                      {issue.description}
                    </li>
                  ))}
                </ul>
              }
              type="warning"
              style={{ marginBottom: 16 }}
            />
          )}
          <ExecutionPlanVisualization data={executionPlan} />
        </>
      ),
    },
    {
      key: 'suggestions',
      label: '优化建议',
      children: suggestions.length === 0 ? (
        <Alert message="暂无优化建议" type="info" />
      ) : (
        <List
          dataSource={suggestions}
          renderItem={(suggestion) => (
            <List.Item>
              <Card style={{ width: '100%' }}>
                <div style={{ marginBottom: 8 }}>
                  <Tag color={getPriorityColor(suggestion.priority)}>
                    {(suggestion.priority || '').toUpperCase()}
                  </Tag>
                  <Tag>{suggestion.suggestion_type}</Tag>
                </div>
                <p>{suggestion.description}</p>
                {suggestion.sql_statement && (
                  <div style={{ marginTop: 12, marginBottom: 8 }}>
                    <div style={{ marginBottom: 4, fontWeight: 'bold' }}>建议执行的DDL:</div>
                    <pre style={{ 
                      background: '#f5f5f5', 
                      padding: 8, 
                      borderRadius: 4, 
                      overflow: 'auto',
                      position: 'relative'
                    }}>
                      {suggestion.sql_statement}
                      <Button
                        size="small"
                        icon={<CopyOutlined />}
                        style={{ position: 'absolute', top: 4, right: 4 }}
                        onClick={() => {
                          const sql = suggestion.sql_statement;
                          if (sql && navigator.clipboard?.writeText) {
                            navigator.clipboard.writeText(sql);
                            message.success('SQL已复制到剪贴板');
                          }
                        }}
                      >
                        复制
                      </Button>
                    </pre>
                  </div>
                )}
                <div>
                  <small>影响评分: {((suggestion.impact_score ?? 0) * 100).toFixed(0)}%</small>
                </div>
              </Card>
            </List.Item>
          )}
        />
      ),
    },
    {
      key: 'scoring',
      label: '性能评分',
      children: query?.id ? <SQLScorer queryId={query.id} /> : <Alert message="无法评分" type="warning" />,
    },
    {
      key: 'metrics',
      label: '性能指标',
      children: (
        <Card>
          <List>
            <List.Item>
              <List.Item.Meta
                title="执行时间"
                description={`${Number(query?.execution_time ?? 0).toFixed(3)} 秒`}
              />
            </List.Item>
            <List.Item>
              <List.Item.Meta
                title="锁等待时间"
                description={`${Number(query?.lock_time ?? 0).toFixed(3)} 秒`}
              />
            </List.Item>
            <List.Item>
              <List.Item.Meta title="扫描行数" description={query?.rows_examined ?? '-'} />
            </List.Item>
            <List.Item>
              <List.Item.Meta title="返回行数" description={query?.rows_sent ?? '-'} />
            </List.Item>
            <List.Item>
              <List.Item.Meta title="数据库" description={query?.database ?? '-'} />
            </List.Item>
            <List.Item>
              <List.Item.Meta title="客户端 IP" description={query?.client_ip ?? '-'} />
            </List.Item>
            <List.Item>
              <List.Item.Meta
                title="执行时间"
                description={query?.timestamp ? new Date(query.timestamp).toLocaleString('zh-CN') : '-'}
              />
            </List.Item>
          </List>
        </Card>
      ),
    },
  ];

  return (
    <Modal
      title="慢查询详情"
      open={visible}
      onCancel={onClose}
      width={1200}
      footer={null}
    >
      <Card title="SQL 语句" style={{ marginBottom: 16 }}>
        <pre style={{ background: '#f5f5f5', padding: 12, borderRadius: 4, overflow: 'auto' }}>
          {query?.sql_text ?? ''}
        </pre>
      </Card>
      <Tabs defaultActiveKey="plan" items={tabItems} />
    </Modal>
  );
};
