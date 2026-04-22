import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Button, Card, Col, Descriptions, Drawer, Empty, Input, Row, Select, Space, Switch, Table, Tag, Typography, Statistic, Progress, Checkbox, message } from 'antd';
import { ApartmentOutlined, BookOutlined, TeamOutlined } from '@ant-design/icons';
import { opsApi, OpsActionLogItem, OpsInstance, RunbookResult } from '../services/api';

const { Title, Text } = Typography;

type TimeRange = '1h' | '24h' | '7d' | 'all';

const OpsCenterPage: React.FC = () => {
  const [instances, setInstances] = useState<OpsInstance[]>([]);
  const [runbook, setRunbook] = useState<RunbookResult | null>(null);
  const [incidentType, setIncidentType] = useState('classroom_outage');
  const [severity, setSeverity] = useState('medium');
  const [loading, setLoading] = useState(false);
  const [stepDone, setStepDone] = useState<Record<number, boolean>>({});

  const [logs, setLogs] = useState<OpsActionLogItem[]>([]);
  const [actionFilter, setActionFilter] = useState('all');
  const [instanceFilter, setInstanceFilter] = useState('all');
  const [timeRange, setTimeRange] = useState<TimeRange>('24h');
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [selectedLog, setSelectedLog] = useState<OpsActionLogItem | null>(null);
  const [searchKeyword, setSearchKeyword] = useState('');
  const [sceneScope, setSceneScope] = useState('单实验室');
  const [sceneLocation, setSceneLocation] = useState('3-02');

  const incidentTemplates: Record<string, { severity: 'high' | 'medium' | 'low'; note: string }> = {
    classroom_outage: {
      severity: 'high',
      note: '课堂中断模板：优先保障授课连续性，5分钟内到场，15分钟内升级中心值班老师',
    },
    lab_offline: {
      severity: 'high',
      note: '机房离线模板：先确认影响范围与交换机状态，必要时切换备用网络',
    },
    club_event_incident: {
      severity: 'medium',
      note: '社团活动模板：保障直播链路优先，主备推流并行检查',
    },
    slow_query_burst: {
      severity: 'medium',
      note: '慢查询激增模板：先限流热点接口，再排查Top SQL并执行索引优化',
    },
  };

  const loadInstances = useCallback(async () => {
    const res = await opsApi.instances();
    setInstances(res.data.instances || []);
  }, []);

  const loadLogs = useCallback(async () => {
    const res = await opsApi.listActionLogs(100, {
      action: actionFilter,
      instance: instanceFilter,
      timeRange,
    });
    setLogs(res.data.items || []);
  }, [actionFilter, instanceFilter, timeRange]);

  useEffect(() => {
    loadInstances();
    loadLogs();
  }, [actionFilter, instanceFilter, timeRange, loadLogs, loadInstances]);

  useEffect(() => {
    if (!autoRefresh) return;
    const timer = window.setInterval(() => {
      loadLogs();
    }, 10000);
    return () => window.clearInterval(timer);
  }, [autoRefresh, actionFilter, instanceFilter, timeRange, loadLogs]);

  const appendLog = async (action: string, result: string, instance?: string) => {
    try {
      await opsApi.createActionLog(action, result, instance);
    } finally {
      await loadLogs();
    }
  };

  const handleRunbook = async () => {
    setLoading(true);
    try {
      const res = await opsApi.generateRunbook(incidentType, severity);
      setRunbook(res.data || null);
      setStepDone({});
      await appendLog('generate_runbook', `incident=${incidentType},severity=${severity}`, instanceFilter === 'all' ? undefined : instanceFilter);
    } catch {
      await appendLog('generate_runbook', 'failed', instanceFilter === 'all' ? undefined : instanceFilter);
    } finally {
      setLoading(false);
    }
  };

  const actionOptions = useMemo(() => Array.from(new Set(logs.map((l) => l.action))), [logs]);
  const instanceOptions = useMemo(() => Array.from(new Set(logs.map((l) => l.instance || '-'))), [logs]);
  const onlineCount = useMemo(() => instances.filter((i) => i.status === 'online').length, [instances]);

  const runbookPercent = useMemo(() => {
    if (!runbook) return 0;
    return Math.round((Object.values(stepDone).filter(Boolean).length / Math.max(1, runbook.runbook.steps.length)) * 100);
  }, [runbook, stepDone]);

  const filteredLogs = useMemo(() => {
    const kw = searchKeyword.trim().toLowerCase();
    if (!kw) return logs;
    return logs.filter((l) => {
      const text = `${l.action} ${l.instance || ''} ${l.result} ${l.time}`.toLowerCase();
      return text.includes(kw);
    });
  }, [logs, searchKeyword]);

  const campusOpsSummary = useMemo(() => {
    const total = Math.max(1, instances.length);
    const onlineRate = Math.round((onlineCount / total) * 100);
    const classConflictRisk = onlineRate < 90 ? 'high' : onlineRate < 96 ? 'medium' : 'low';

    return {
      onlineRate,
      classConflictRisk,
      impactedLabs: Math.max(0, instances.length - onlineCount),
      clubEventRisk: classConflictRisk === 'high' ? 'high' : classConflictRisk === 'medium' ? 'medium' : 'low',
    };
  }, [instances.length, onlineCount]);

  useEffect(() => {
    if (runbook && runbookPercent === 100) {
      message.success('处置步骤已全部完成，可进入校园复盘阶段');
    }
  }, [runbookPercent, runbook]);

  return (
    <div className="fade-in">
      <Space direction="vertical" size={4} style={{ marginBottom: 12 }} className="page-header">
        <Title level={2} style={{ margin: 0 }}>机房运维中心（校园应急）</Title>
        <Text type="secondary" className="page-subtitle">聚焦楼栋机房保障、授课冲突预警、社团活动保障的应急协作与留痕</Text>
      </Space>

      <Alert
        style={{ marginBottom: 12 }}
        type={campusOpsSummary.classConflictRisk === 'high' ? 'error' : campusOpsSummary.classConflictRisk === 'medium' ? 'warning' : 'info'}
        showIcon
        message={`授课冲突风险：${campusOpsSummary.classConflictRisk === 'high' ? '高' : campusOpsSummary.classConflictRisk === 'medium' ? '中' : '低'}`}
        description={`当前机房在线率：${campusOpsSummary.onlineRate}%，离线机房估计 ${campusOpsSummary.impactedLabs} 间。`}
      />

      <Row gutter={[16, 16]} style={{ marginTop: 8, marginBottom: 8 }}>
        <Col xs={24} md={8}>
          <Card size="small">
            <Statistic title="机房实例总数" value={instances.length} prefix={<ApartmentOutlined />} />
          </Card>
        </Col>
        <Col xs={24} md={8}>
          <Card size="small">
            <Statistic title="在线实例" value={onlineCount} valueStyle={{ color: '#16a34a' }} />
          </Card>
        </Col>
        <Col xs={24} md={8}>
          <Card size="small">
            <Statistic title="24h应急动作" value={logs.length} valueStyle={{ color: '#4f46e5' }} />
          </Card>
        </Col>
      </Row>

      <Card style={{ marginBottom: 12 }}>
        <Space wrap>
          <Tag icon={<BookOutlined />} color="magenta">授课冲突风险：{campusOpsSummary.classConflictRisk === 'high' ? '高' : campusOpsSummary.classConflictRisk === 'medium' ? '中' : '低'}</Tag>
          <Tag icon={<ApartmentOutlined />} color="blue">机房在线率：{campusOpsSummary.onlineRate}%</Tag>
          <Tag icon={<TeamOutlined />} color="purple">社团活动保障风险：{campusOpsSummary.clubEventRisk}</Tag>
        </Space>
      </Card>

      <Row gutter={[16, 16]}>
        <Col xs={24} lg={12}>
          <Card title="楼栋机房实例列表">
            <Table
              size="small"
              rowKey="instance_id"
              pagination={false}
              scroll={{ y: 280 }}
              dataSource={instances}
              columns={[
                { title: '实例', dataIndex: 'name' },
                { title: '楼栋/环境', dataIndex: 'env', render: (v: string) => <Tag>{v || '-'}</Tag> },
                { title: '状态', dataIndex: 'status', render: (v: string) => <Tag color={v === 'online' ? 'green' : 'orange'}>{v === 'online' ? '在线' : '异常'}</Tag> },
                { title: '连接数', dataIndex: 'connections' },
              ]}
            />
          </Card>
        </Col>

        <Col xs={24} lg={12}>
          <Card title="校园应急处置剧本" loading={loading}>
            <Space direction="vertical" style={{ width: '100%' }} size={12}>
              <Space wrap>
                <Select
                  value={incidentType}
                  style={{ width: 240 }}
                  onChange={setIncidentType}
                  options={[
                    { label: '课堂中断（核心）', value: 'classroom_outage' },
                    { label: '机房离线/异常', value: 'lab_offline' },
                    { label: '社团活动保障异常', value: 'club_event_incident' },
                    { label: '慢查询激增', value: 'slow_query_burst' },
                  ]}
                />
                <Button
                  onClick={() => {
                    const tpl = incidentTemplates[incidentType];
                    if (!tpl) return;
                    setSeverity(tpl.severity);
                    message.info(`已应用模板：${tpl.note}`);
                  }}
                >
                  一键套用模板
                </Button>
                <Select
                  value={severity}
                  style={{ width: 140 }}
                  onChange={setSeverity}
                  options={[{ label: '高', value: 'high' }, { label: '中', value: 'medium' }, { label: '低', value: 'low' }]}
                />
                <Input
                  value={sceneLocation}
                  onChange={(e) => setSceneLocation(e.target.value)}
                  placeholder="输入故障位置，如3-02"
                  style={{ width: 200 }}
                />
                <Select
                  value={sceneScope}
                  onChange={setSceneScope}
                  style={{ width: 150 }}
                  options={[{ label: '单实验室', value: '单实验室' }, { label: '单楼栋', value: '单楼栋' }, { label: '跨楼栋', value: '跨楼栋' }]}
                />
                <Button type="primary" onClick={handleRunbook}>生成应急剧本</Button>
                {runbook && (
                  <Button
                    onClick={async () => {
                      const text = [
                        `# ${runbook.runbook.title}`,
                        `- 事件类型: ${incidentType}`,
                        `- 严重级别: ${severity}`,
                        `- 影响范围: ${sceneScope}`,
                        `- 故障位置: ${sceneLocation || '-'}`,
                        `- 当前完成率: ${runbookPercent}%`,
                        '',
                        '## 处置步骤',
                        ...runbook.runbook.steps.map((s, i) => `${i + 1}. ${s}`),
                      ].join('\n');
                      try {
                        await navigator.clipboard.writeText(text);
                        message.success('应急剧本已复制到剪贴板');
                      } catch {
                        message.warning('复制失败，请手动复制');
                      }
                    }}
                  >
                    复制剧本
                  </Button>
                )}
              </Space>

              {runbook && (
                <>
                  <Alert showIcon type="info" message={`${runbook.runbook.title}（单步时限 <= ${runbook.sla_guard.max_step_minutes} 分钟）`} />
                  <Alert
                    showIcon
                    type={severity === 'high' ? 'error' : 'warning'}
                    message="30分钟风险扩散预测"
                    description={`若${sceneLocation || '当前区域'} 在30分钟内未完成处置，风险可能由${sceneScope}扩展至相邻教学/机房区域，建议立即执行升级链路并同步中心值班老师。`}
                  />
                  <Space style={{ width: '100%', justifyContent: 'space-between' }}>
                    <Progress
                      percent={runbookPercent}
                      size="small"
                      status={runbookPercent === 100 ? 'success' : 'active'}
                      style={{ flex: 1, marginRight: 12 }}
                    />
                    <Space>
                      <Button size="small" onClick={() => setStepDone({})}>清空勾选</Button>
                      <Button
                        size="small"
                        onClick={async () => {
                          const allDone: Record<number, boolean> = {};
                          runbook.runbook.steps.forEach((_, idx) => {
                            allDone[idx] = true;
                          });
                          setStepDone(allDone);
                          await appendLog('runbook_mark_all_done', `incident=${incidentType},severity=${severity}`, instanceFilter === 'all' ? undefined : instanceFilter);
                        }}
                      >
                        全部完成
                      </Button>
                    </Space>
                  </Space>

                  <Table
                    size="small"
                    pagination={false}
                    scroll={{ y: 220 }}
                    dataSource={runbook.runbook.steps.map((s, idx) => ({ key: idx, step: `步骤${idx + 1}`, content: s }))}
                    columns={[
                      {
                        title: '完成',
                        dataIndex: 'key',
                        width: 70,
                        render: (k: number) => (
                          <Checkbox
                            checked={!!stepDone[k]}
                            onChange={(e) => setStepDone((prev) => ({ ...prev, [k]: e.target.checked }))}
                          />
                        ),
                      },
                      { title: '步骤', dataIndex: 'step', width: 90 },
                      { title: '内容', dataIndex: 'content' },
                    ]}
                  />
                </>
              )}
            </Space>
          </Card>
        </Col>
      </Row>

      <Card title="操作留痕与复盘" style={{ marginTop: 16 }}>
        <div style={{ position: 'sticky', top: 0, zIndex: 2, background: '#fff', paddingBottom: 10 }}>
          <Space wrap style={{ marginBottom: 12 }}>
            <Select
              value={actionFilter}
              style={{ width: 200 }}
              onChange={setActionFilter}
              options={[{ label: '全部动作', value: 'all' }, ...actionOptions.map((a) => ({ label: a, value: a }))]}
            />
            <Select
              value={instanceFilter}
              style={{ width: 220 }}
              onChange={setInstanceFilter}
              options={[{ label: '全部实例', value: 'all' }, ...instanceOptions.map((i) => ({ label: i, value: i }))]}
            />
            <Select
              value={timeRange}
              style={{ width: 140 }}
              onChange={(v) => setTimeRange(v as TimeRange)}
              options={[{ label: '1小时', value: '1h' }, { label: '24小时', value: '24h' }, { label: '7天', value: '7d' }, { label: '全部', value: 'all' }]}
            />
            <Input
              allowClear
              placeholder="搜索动作/实例/结果"
              value={searchKeyword}
              onChange={(e) => setSearchKeyword(e.target.value)}
              style={{ width: 220 }}
            />
            <Space>
              <Switch checked={autoRefresh} onChange={setAutoRefresh} />
              <Text type="secondary">自动刷新(10s)</Text>
            </Space>
          </Space>
        </div>

        <Table
          size="small"
          pagination={{ pageSize: 8, showSizeChanger: false }}
          locale={{ emptyText: <Empty description="当前筛选条件下暂无操作日志" /> }}
          dataSource={filteredLogs.map((l, idx) => ({ key: `${l.time}-${idx}`, ...l }))}
          onRow={(record) => ({ onClick: () => setSelectedLog(record as OpsActionLogItem) })}
          columns={[
            { title: '时间', dataIndex: 'time', width: 190 },
            { title: '动作', dataIndex: 'action', width: 180 },
            { title: '实例', dataIndex: 'instance', render: (v: string) => v || '-' },
            { title: '结果', dataIndex: 'result' },
          ]}
        />
      </Card>

      <Drawer title="日志详情" open={!!selectedLog} onClose={() => setSelectedLog(null)} width={520}>
        {selectedLog && (
          <Descriptions bordered size="small" column={1}>
            <Descriptions.Item label="时间">{selectedLog.time}</Descriptions.Item>
            <Descriptions.Item label="动作">{selectedLog.action}</Descriptions.Item>
            <Descriptions.Item label="实例">{selectedLog.instance || '-'}</Descriptions.Item>
            <Descriptions.Item label="结果">{selectedLog.result}</Descriptions.Item>
          </Descriptions>
        )}
      </Drawer>
    </div>
  );
};

export default OpsCenterPage;
