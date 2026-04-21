import React, { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Button, Card, Checkbox, DatePicker, Empty, List, Modal, Select, Space, Spin, Tag, Typography, message } from 'antd';
import { BarChartOutlined, FileTextOutlined, ThunderboltOutlined } from '@ant-design/icons';
import dayjs, { Dayjs } from 'dayjs';
import { optimizationApi, OptimizationSuggestion, ticketsApi } from '../services/api';

const { Text } = Typography;

interface PlanState {
  owner: string;
  dueDate?: string;
  execStatus: 'todo' | 'doing' | 'verifying' | 'done';
}

const priorityMeta = (priority: string) => {
  if (priority === 'high') return { color: 'red', label: 'P1 / 高' };
  if (priority === 'medium') return { color: 'orange', label: 'P2 / 中' };
  return { color: 'blue', label: 'P3 / 低' };
};

const suggestionTypeLabel = (type: string) => {
  if (type === 'index_recommendation') return '索引优化建议';
  if (type === 'full_table_scan') return '全表扫描治理';
  return '通用性能优化';
};

const getSuggestionTypeIcon = (type: string) => {
  if (type === 'index_recommendation') return <ThunderboltOutlined />;
  if (type === 'full_table_scan') return <FileTextOutlined />;
  return <BarChartOutlined />;
};

const statusMeta: Record<PlanState['execStatus'], { label: string; color: string }> = {
  todo: { label: '待执行', color: 'default' },
  doing: { label: '执行中', color: 'processing' },
  verifying: { label: '待验证', color: 'purple' },
  done: { label: '已完成', color: 'green' },
};

const ownerOptions = [
  { label: '机房DBA值班', value: '机房DBA值班' },
  { label: '后端值班工程师', value: '后端值班工程师' },
  { label: '中心值班老师', value: '中心值班老师' },
];

export const OptimizationPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const [suggestions, setSuggestions] = useState<OptimizationSuggestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [planMap, setPlanMap] = useState<Record<number, PlanState>>({});
  const [priorityFilter, setPriorityFilter] = useState<'all' | 'high' | 'medium' | 'low'>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | PlanState['execStatus']>('all');
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [bulkProcessing, setBulkProcessing] = useState(false);

  const fetchSuggestions = async () => {
    setLoading(true);
    try {
      const response = await optimizationApi.getTop();
      const nextSuggestions = response?.data?.suggestions ?? [];
      setSuggestions(nextSuggestions);
      setPlanMap((prev) => {
        const next = { ...prev };
        nextSuggestions.forEach((s: OptimizationSuggestion) => {
          next[s.id] = {
            owner: s.owner || next[s.id]?.owner || (s.priority === 'high' ? '机房DBA值班' : '后端值班工程师'),
            dueDate: s.due_date || next[s.id]?.dueDate,
            execStatus: (s.exec_status as PlanState['execStatus']) || next[s.id]?.execStatus || 'todo',
          };
        });
        return next;
      });
    } catch {
      message.error('获取优化建议失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const statusParam = searchParams.get('status');
    if (statusParam === 'todo' || statusParam === 'doing' || statusParam === 'verifying' || statusParam === 'done') {
      setStatusFilter(statusParam);
    }
    fetchSuggestions();
  }, [searchParams]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchSuggestions();
    setRefreshing(false);
  };

  const handleIgnoreSuggestion = (suggestionId: number) => {
    message.success(`已忽略建议 #${suggestionId}`);
    setSuggestions((prev) => prev.filter((s) => s.id !== suggestionId));
    setSelectedIds((prev) => prev.filter((id) => id !== suggestionId));
  };

  const updatePlan = async (id: number, patch: Partial<PlanState>) => {
    const prevValue = planMap[id] || { owner: '后端值班工程师', execStatus: 'todo' as const };
    const nextValue = {
      owner: patch.owner ?? prevValue.owner,
      dueDate: patch.dueDate ?? prevValue.dueDate,
      execStatus: patch.execStatus ?? prevValue.execStatus,
    };

    setPlanMap((prev) => ({ ...prev, [id]: nextValue }));

    try {
      await optimizationApi.updatePlan(id, {
        owner: nextValue.owner,
        due_date: nextValue.dueDate,
        exec_status: nextValue.execStatus,
      });
    } catch {
      message.error('执行计划保存失败，已回滚');
      setPlanMap((prev) => ({ ...prev, [id]: prevValue }));
    }
  };

  const handleCreateTicket = async (s: OptimizationSuggestion) => {
    const plan = planMap[s.id];
    try {
      const res = await ticketsApi.create({
        title: `优化执行：${suggestionTypeLabel(s.suggestion_type)}`,
        description: [
          s.description,
          '',
          `建议ID: ${s.id}`,
          `负责人: ${plan?.owner || '后端值班工程师'}`,
          `执行状态: ${statusMeta[plan?.execStatus || 'todo'].label}`,
          `预计完成: ${plan?.dueDate || '未设置'}`,
          `预期收益: 降低慢查询与连接压力，提升课堂与机房服务稳定性。`,
          `风险提示: ${s.priority === 'high' ? '建议在非授课高峰时段执行，并预留回滚窗口。' : '可在值班窗口执行，执行前需完成变更通报。'}`,
          s.sql_statement ? `\n建议DDL:\n${s.sql_statement}` : '',
        ].join('\n'),
        category: 'lab_support',
        severity: s.priority === 'high' ? 'high' : s.priority === 'medium' ? 'medium' : 'low',
        location: '核心数据库集群',
      });
      message.success(`已转工单 #${res.data.ticket.id}`);
    } catch {
      message.error('转工单失败');
    }
  };

  const summary = useMemo(() => {
    const highPriorityCount = suggestions.filter((s) => s.priority === 'high').length;
    const doingCount = suggestions.filter((s) => planMap[s.id]?.execStatus === 'doing').length;
    const doneCount = suggestions.filter((s) => planMap[s.id]?.execStatus === 'done').length;
    const verifyingCount = suggestions.filter((s) => planMap[s.id]?.execStatus === 'verifying').length;
    return { total: suggestions.length, highPriorityCount, doingCount, doneCount, verifyingCount };
  }, [suggestions, planMap]);

  const filteredSuggestions = useMemo(() => {
    return suggestions.filter((s) => {
      const passPriority = priorityFilter === 'all' || s.priority === priorityFilter;
      const execStatus = planMap[s.id]?.execStatus || 'todo';
      const passStatus = statusFilter === 'all' || execStatus === statusFilter;
      return passPriority && passStatus;
    });
  }, [suggestions, planMap, priorityFilter, statusFilter]);

  const filteredIds = useMemo(() => filteredSuggestions.map((s) => s.id), [filteredSuggestions]);
  const allSelected = filteredIds.length > 0 && filteredIds.every((id) => selectedIds.includes(id));

  const toggleSelectAll = () => {
    if (allSelected) {
      setSelectedIds((prev) => prev.filter((id) => !filteredIds.includes(id)));
    } else {
      setSelectedIds((prev) => Array.from(new Set([...prev, ...filteredIds])));
    }
  };

  const bulkUpdatePlan = async (patch: Partial<PlanState>) => {
    if (selectedIds.length === 0) {
      message.info('请先选择要批量操作的建议');
      return;
    }

    const prevSnapshot = { ...planMap };
    const nextMap = { ...planMap };
    selectedIds.forEach((id) => {
      const prevValue = nextMap[id] || { owner: '后端值班工程师', execStatus: 'todo' as const };
      nextMap[id] = {
        owner: patch.owner ?? prevValue.owner,
        dueDate: patch.dueDate ?? prevValue.dueDate,
        execStatus: patch.execStatus ?? prevValue.execStatus,
      };
    });
    setPlanMap(nextMap);

    try {
      await Promise.all(
        selectedIds.map((id) =>
          optimizationApi.updatePlan(id, {
            owner: nextMap[id].owner,
            due_date: nextMap[id].dueDate,
            exec_status: nextMap[id].execStatus,
          })
        )
      );
      message.success('批量更新成功');
    } catch {
      message.error('批量更新失败，已回滚');
      setPlanMap(prevSnapshot);
    }
  };

  const bulkCreateTickets = async () => {
    if (selectedIds.length === 0) {
      message.info('请先选择要转工单的建议');
      return;
    }

    Modal.confirm({
      title: '确认批量转工单？',
      content: `将为 ${selectedIds.length} 条建议创建工单，并建议将状态调整为“执行中”。`,
      okText: '确认',
      cancelText: '取消',
      onOk: async () => {
        const selected = suggestions.filter((s) => selectedIds.includes(s.id));
        setBulkProcessing(true);
        let success = 0;
        let failed = 0;
        const failedIds: number[] = [];

        try {
          for (let i = 0; i < selected.length; i += 1) {
            const s = selected[i];
            message.loading({ content: `批量转工单进行中：${i + 1}/${selected.length}`, key: 'bulk-ticket', duration: 0 });
            try {
              const plan = planMap[s.id];
              await ticketsApi.create({
                title: `优化执行：${suggestionTypeLabel(s.suggestion_type)}`,
                description: [
                  s.description,
                  '',
                  `建议ID: ${s.id}`,
                  `负责人: ${plan?.owner || '后端值班工程师'}`,
                  `执行状态: ${statusMeta[plan?.execStatus || 'todo'].label}`,
                  `预计完成: ${plan?.dueDate || '未设置'}`,
                  `预期收益: 降低慢查询与连接压力，提升课堂与机房服务稳定性。`,
                  `风险提示: ${s.priority === 'high' ? '建议在非授课高峰时段执行，并预留回滚窗口。' : '可在值班窗口执行，执行前需完成变更通报。'}`,
                  s.sql_statement ? `\n建议DDL:\n${s.sql_statement}` : '',
                ].join('\n'),
                category: 'lab_support',
                severity: s.priority === 'high' ? 'high' : s.priority === 'medium' ? 'medium' : 'low',
                location: '核心数据库集群',
              });
              success += 1;
            } catch {
              failed += 1;
              failedIds.push(s.id);
            }
          }

          if (success > 0) {
            await bulkUpdatePlan({ execStatus: 'doing' });
          }
          message.destroy('bulk-ticket');
          if (failed === 0) {
            message.success(`批量转工单完成：成功 ${success} 条`);
          } else {
            Modal.warning({
              title: '批量转工单部分失败',
              content: `成功 ${success} 条，失败 ${failed} 条。失败建议ID：${failedIds.join(', ')}`,
            });
          }
        } finally {
          setBulkProcessing(false);
          message.destroy('bulk-ticket');
        }
      },
    });
  };

  if (loading) {
    return <Spin size="large" style={{ display: 'block', textAlign: 'center', padding: 40 }} />;
  }

  return (
    <div className="fade-in">
      <Card
        title={
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <BarChartOutlined style={{ fontSize: 20, color: '#1890ff' }} />
              <span style={{ fontSize: 18, fontWeight: 700 }}>校园优化建议中心</span>
            </div>
            <Button type="primary" onClick={handleRefresh} loading={refreshing}>刷新建议</Button>
          </div>
        }
      >
        <Space wrap style={{ marginBottom: 16 }}>
          <Tag color="blue">总建议：{summary.total}</Tag>
          <Tag color="red">P1建议：{summary.highPriorityCount}</Tag>
          <Tag color="processing">执行中：{summary.doingCount}</Tag>
          <Tag color="purple">待验证：{summary.verifyingCount}</Tag>
          <Tag color="green">已完成：{summary.doneCount}</Tag>
        </Space>

        <Space wrap style={{ marginBottom: 16 }}>
          <Select
            style={{ width: 180 }}
            value={priorityFilter}
            onChange={(v) => setPriorityFilter(v)}
            options={[
              { label: '全部优先级', value: 'all' },
              { label: 'P1 / 高', value: 'high' },
              { label: 'P2 / 中', value: 'medium' },
              { label: 'P3 / 低', value: 'low' },
            ]}
          />
          <Select
            style={{ width: 180 }}
            value={statusFilter}
            onChange={(v) => setStatusFilter(v)}
            options={[
              { label: '全部状态', value: 'all' },
              { label: '待执行', value: 'todo' },
              { label: '执行中', value: 'doing' },
              { label: '待验证', value: 'verifying' },
              { label: '已完成', value: 'done' },
            ]}
          />
          <Checkbox checked={allSelected} onChange={toggleSelectAll}>全选当前筛选</Checkbox>
          <Tag color="geekblue">已选 {selectedIds.length} 条</Tag>
        </Space>

        <Space wrap style={{ marginBottom: 16 }}>
          <Select
            style={{ width: 220 }}
            placeholder="批量改负责人"
            options={ownerOptions}
            onChange={(owner) => bulkUpdatePlan({ owner })}
          />
          <Select
            style={{ width: 200 }}
            placeholder="批量改状态"
            options={[
              { label: '待执行', value: 'todo' },
              { label: '执行中', value: 'doing' },
              { label: '待验证', value: 'verifying' },
              { label: '已完成', value: 'done' },
            ]}
            onChange={(execStatus) => bulkUpdatePlan({ execStatus })}
          />
          <Button onClick={bulkCreateTickets} loading={bulkProcessing} disabled={bulkProcessing}>批量转工单</Button>
        </Space>

        <List
          itemLayout="vertical"
          dataSource={filteredSuggestions}
          locale={{ emptyText: <Empty description="暂无优化建议，请先从慢查询中生成建议" /> }}
          renderItem={(s) => {
            const plan = planMap[s.id] || { owner: '后端值班工程师', execStatus: 'todo' as const };
            const priority = priorityMeta(s.priority);
            const status = statusMeta[plan.execStatus];
            const gain = `${Math.max(10, Math.round((s.impact_score || 0) * 100))}% 性能提升预期`;
            const risk = s.priority === 'high'
              ? '高风险：建议在非授课高峰执行，并准备回滚。'
              : s.priority === 'medium'
                ? '中风险：建议值班老师在场确认后执行。'
                : '低风险：可按常规发布窗口执行。';

            return (
              <List.Item
                key={s.id}
                actions={[
                  <Button size="small" key="ticket" onClick={() => handleCreateTicket(s)}>转工单执行</Button>,
                  <Button size="small" key="ignore" onClick={() => handleIgnoreSuggestion(s.id)}>忽略</Button>,
                ]}
              >
                <Card
                  variant="outlined"
                  style={{ border: s.priority === 'high' ? '2px solid #ff4d4f' : undefined }}
                  extra={
                    <Space direction="vertical" size={4} style={{ alignItems: 'flex-end' }}>
                      <Tag color={priority.color}>{priority.label}</Tag>
                      <Tag color={status.color}>{status.label}</Tag>
                    </Space>
                  }
                >
                  <Space direction="vertical" size={8} style={{ width: '100%' }}>
                    <Space>
                      <Checkbox
                        checked={selectedIds.includes(s.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedIds((prev) => Array.from(new Set([...prev, s.id])));
                          } else {
                            setSelectedIds((prev) => prev.filter((id) => id !== s.id));
                          }
                        }}
                      />
                      <span style={{ color: '#1890ff', fontSize: 18 }}>{getSuggestionTypeIcon(s.suggestion_type)}</span>
                      <Text strong>{suggestionTypeLabel(s.suggestion_type)}</Text>
                    </Space>

                    <Text>{s.description}</Text>

                    <Space wrap>
                      <Tag color="green">预期收益：{gain}</Tag>
                      <Tag color={s.priority === 'high' ? 'volcano' : 'orange'}>风险提示：{risk}</Tag>
                    </Space>

                    <Space wrap>
                      <Text type="secondary">责任人：</Text>
                      <Select
                        size="small"
                        style={{ width: 180 }}
                        value={plan.owner}
                        options={ownerOptions}
                        onChange={(owner) => updatePlan(s.id, { owner })}
                      />

                      <Text type="secondary">预计完成：</Text>
                      <DatePicker
                        size="small"
                        value={plan.dueDate ? dayjs(plan.dueDate) : undefined}
                        onChange={(d: Dayjs | null) => updatePlan(s.id, { dueDate: d ? d.format('YYYY-MM-DD') : undefined })}
                      />

                      <Select
                        size="small"
                        style={{ width: 140 }}
                        value={plan.execStatus}
                        options={[
                          { label: '待执行', value: 'todo' },
                          { label: '执行中', value: 'doing' },
                          { label: '待验证', value: 'verifying' },
                          { label: '已完成', value: 'done' },
                        ]}
                        onChange={(execStatus) => updatePlan(s.id, { execStatus })}
                      />
                    </Space>

                    {s.sql_statement && (
                      <div style={{ padding: 12, background: '#f5f5f5', borderRadius: 6 }}>
                        <Text strong style={{ display: 'block', marginBottom: 6 }}>建议执行DDL</Text>
                        <pre style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{s.sql_statement}</pre>
                      </div>
                    )}

                    <Text type="secondary">生成时间：{new Date(s.created_at).toLocaleString('zh-CN')}</Text>
                  </Space>
                </Card>
              </List.Item>
            );
          }}
        />
      </Card>
    </div>
  );
};
