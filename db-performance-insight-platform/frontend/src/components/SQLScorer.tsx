import React, { useCallback, useEffect, useState } from 'react';
import { Card, Progress, List, Tag, Alert, Spin, Space } from 'antd';
import { TrophyOutlined, CheckCircleOutlined, CloseCircleOutlined } from '@ant-design/icons';
import { scoringApi, SQLScoreResult } from '../services/api';

interface SQLScorerProps {
  queryId: number;
}

export const SQLScorer: React.FC<SQLScorerProps> = ({ queryId }) => {
  const [score, setScore] = useState<SQLScoreResult | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchScore = useCallback(async () => {
    setLoading(true);
    try {
      const response = await scoringApi.scoreSQL(queryId);
      setScore(response.data);
    } catch (error) {
      console.error('Failed to fetch score:', error);
    } finally {
      setLoading(false);
    }
  }, [queryId]);

  useEffect(() => {
    if (queryId) {
      fetchScore();
    }
  }, [queryId, fetchScore]);

  if (loading) {
    return <Spin size="large" style={{ display: 'block', textAlign: 'center', padding: 40 }} />;
  }

  if (!score) {
    return <Alert message="暂无评分数据" type="info" />;
  }

  const getGradeColor = (grade: string) => {
    if (grade.startsWith('A')) return '#52c41a';
    if (grade === 'B') return '#1890ff';
    if (grade === 'C') return '#faad14';
    if (grade === 'D') return '#fa8c16';
    return '#ff4d4f';
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return '#52c41a';
    if (score >= 60) return '#1890ff';
    if (score >= 40) return '#faad14';
    return '#ff4d4f';
  };

  return (
    <Card
      title={
        <Space>
          <TrophyOutlined />
          <span>SQL性能评分</span>
        </Space>
      }
    >
      <div style={{ textAlign: 'center', marginBottom: 24 }}>
        <div style={{ fontSize: 48, fontWeight: 'bold', color: getScoreColor(score.total_score) }}>
          {score.total_score}
        </div>
        <div style={{ fontSize: 24, color: getGradeColor(score.grade), marginTop: 8 }}>
          等级: {score.grade}
        </div>
        <Progress
          percent={score.total_score}
          strokeColor={getScoreColor(score.total_score)}
          format={() => `${score.total_score}/${score.max_score}`}
          style={{ marginTop: 16 }}
        />
      </div>

      <Card title="评分详情" size="small" style={{ marginBottom: 16 }}>
        <List
          dataSource={[
            { name: '执行时间', score: score.scores.execution_time, max: 40 },
            { name: '扫描效率', score: score.scores.efficiency, max: 30 },
            { name: 'SQL结构', score: score.scores.structure, max: 20 },
            { name: '执行计划', score: score.scores.execution_plan, max: 10 },
          ]}
          renderItem={(item) => (
            <List.Item>
              <div style={{ width: '100%' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span>{item.name}</span>
                  <span style={{ fontWeight: 'bold' }}>
                    {item.score}/{item.max}
                  </span>
                </div>
                <Progress
                  percent={(item.score / item.max) * 100}
                  strokeColor={getScoreColor(item.score)}
                  showInfo={false}
                  size="small"
                />
              </div>
            </List.Item>
          )}
        />
      </Card>

      {score.deductions && score.deductions.length > 0 && (
        <Card title="扣分项" size="small" style={{ marginBottom: 16 }}>
          <List
            dataSource={score.deductions}
            renderItem={(deduction) => (
              <List.Item>
                <List.Item.Meta
                  avatar={<CloseCircleOutlined style={{ color: '#ff4d4f' }} />}
                  title={
                    <Space>
                      <span>{deduction.reason}</span>
                      <Tag color="red">-{deduction.deduction}分</Tag>
                    </Space>
                  }
                  description={deduction.detail}
                />
              </List.Item>
            )}
          />
        </Card>
      )}

      {score.recommendations && score.recommendations.length > 0 && (
        <Card title="优化建议" size="small">
          <List
            dataSource={score.recommendations}
            renderItem={(rec) => (
              <List.Item>
                <List.Item.Meta
                  avatar={<CheckCircleOutlined style={{ color: '#52c41a' }} />}
                  description={rec}
                />
              </List.Item>
            )}
          />
        </Card>
      )}
    </Card>
  );
};
