import React, { useCallback, useEffect } from 'react';
import { Alert, Button, Card, Col, Form, Input, InputNumber, Row, Select, Switch, Tag, Typography, message } from 'antd';
import { SaveOutlined, SettingOutlined } from '@ant-design/icons';
import { configApi } from '../services/api';

const { Title, Text } = Typography;

export const SettingsPage: React.FC = () => {
  const [form] = Form.useForm();
  const [loading, setLoading] = React.useState(false);
  const [fetching, setFetching] = React.useState(true);

  const fetchConfig = useCallback(async () => {
    setFetching(true);
    try {
      const response = await configApi.get();
      const data = response.data as any;
      const corsOrigins = Array.isArray(data.cors_origins)
        ? data.cors_origins.join(', ')
        : (data.cors_origins ?? '');
      form.setFieldsValue({
        mysqlHost: data.mysql_host,
        mysqlPort: data.mysql_port,
        mysqlUser: data.mysql_user,
        mysqlPassword: data.mysql_password,
        mysqlDatabase: data.mysql_database,
        prometheusEnabled: data.prometheus_enabled,
        prometheusUrl: data.prometheus_url,
        slowQueryThreshold: data.slow_query_threshold,
        debugMode: data.debug,
        corsOrigins: corsOrigins || 'http://localhost:3000,http://localhost:5173',

        forceP1ForClassBreak: true,
        autoEscalateMinutes: 5,
        notifyTeacherGroup: true,
        notifyLabGroup: true,
        notifyClubGroup: true,
        notifyTemplate: '【校园值班通报】{scene}，级别{level}，地点{location}，当前状态：处理中。',
        classPeakWindow: '08:00-18:00',
        examWeekMode: false,
        eventPeakMode: true,
      });
    } catch {
      message.error('获取配置失败');
    } finally {
      setFetching(false);
    }
  }, [form]);

  useEffect(() => {
    fetchConfig();
  }, [fetchConfig]);

  const onFinish = async (values: any) => {
    setLoading(true);
    try {
      const corsOriginsStr = values.corsOrigins ?? '';
      const cors_origins = corsOriginsStr
        ? corsOriginsStr.split(',').map((s: string) => s.trim()).filter(Boolean)
        : ['http://localhost:3000', 'http://localhost:5173'];
      const configData = {
        mysql_host: values.mysqlHost,
        mysql_port: values.mysqlPort,
        mysql_user: values.mysqlUser,
        mysql_password: values.mysqlPassword,
        mysql_database: values.mysqlDatabase,
        prometheus_enabled: values.prometheusEnabled,
        prometheus_url: values.prometheusUrl,
        slow_query_threshold: values.slowQueryThreshold,
        debug: values.debugMode,
        cors_origins,
      };
      await configApi.update(configData);
      message.success('配置保存成功（值班策略配置已在前端记录）');
    } catch {
      message.error('配置保存失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fade-in" style={{ padding: '24px' }}>
      <SpaceHeader />

      <Alert
        type="warning"
        showIcon
        style={{ marginBottom: 16 }}
        message="配置变更提示"
        description="建议在课间或低峰时段修改关键参数。变更后请在值班群通报，并保留审计记录。"
      />

      <Card loading={fetching} title={<TitleBar />}>
        <Form
          form={form}
          layout="vertical"
          onFinish={onFinish}
          initialValues={{
            mysqlHost: 'localhost',
            mysqlPort: 3306,
            mysqlUser: 'root',
            mysqlPassword: 'password',
            mysqlDatabase: 'test',
            prometheusEnabled: true,
            prometheusUrl: 'http://localhost:9090',
            slowQueryThreshold: 1.0,
            debugMode: true,
            corsOrigins: 'http://localhost:3000,http://localhost:5173',

            forceP1ForClassBreak: true,
            autoEscalateMinutes: 5,
            notifyTeacherGroup: true,
            notifyLabGroup: true,
            notifyClubGroup: true,
            notifyTemplate: '【校园值班通报】{scene}，级别{level}，地点{location}，当前状态：处理中。',
            classPeakWindow: '08:00-18:00',
            examWeekMode: false,
            eventPeakMode: true,
          }}
        >
          <Card title="值班策略设置" style={{ marginBottom: 16 }}>
            <Row gutter={12}>
              <Col xs={24} md={12}>
                <Form.Item name="forceP1ForClassBreak" label="课堂中断强制 P1" valuePropName="checked">
                  <Switch />
                </Form.Item>
              </Col>
              <Col xs={24} md={12}>
                <Form.Item name="autoEscalateMinutes" label="自动升级阈值（分钟）">
                  <InputNumber min={1} max={60} style={{ width: '100%' }} />
                </Form.Item>
              </Col>
            </Row>
            <Text type="secondary">建议：课堂中断 5 分钟未响应自动升级中心值班老师。</Text>
          </Card>

          <Card title="通知策略设置" style={{ marginBottom: 16 }}>
            <Row gutter={12}>
              <Col xs={24} md={8}>
                <Form.Item name="notifyTeacherGroup" label="通知老师群" valuePropName="checked"><Switch /></Form.Item>
              </Col>
              <Col xs={24} md={8}>
                <Form.Item name="notifyLabGroup" label="通知机房群" valuePropName="checked"><Switch /></Form.Item>
              </Col>
              <Col xs={24} md={8}>
                <Form.Item name="notifyClubGroup" label="通知社团群" valuePropName="checked"><Switch /></Form.Item>
              </Col>
            </Row>
            <Form.Item name="notifyTemplate" label="统一通报模板">
              <Input.TextArea rows={3} />
            </Form.Item>
          </Card>

          <Card title="时段策略设置" style={{ marginBottom: 16 }}>
            <Row gutter={12}>
              <Col xs={24} md={8}>
                <Form.Item name="classPeakWindow" label="上课时段">
                  <Select options={[{ label: '08:00-18:00', value: '08:00-18:00' }, { label: '08:00-22:00', value: '08:00-22:00' }]} />
                </Form.Item>
              </Col>
              <Col xs={24} md={8}>
                <Form.Item name="examWeekMode" label="考试周模式" valuePropName="checked"><Switch /></Form.Item>
              </Col>
              <Col xs={24} md={8}>
                <Form.Item name="eventPeakMode" label="活动高峰模式" valuePropName="checked"><Switch /></Form.Item>
              </Col>
            </Row>
            <SpaceTags />
          </Card>

          <Card title="基础连接配置" style={{ marginBottom: 16 }}>
            <Row gutter={12}>
              <Col xs={24} md={8}><Form.Item name="mysqlHost" label="MySQL 主机" rules={[{ required: true }]}><Input /></Form.Item></Col>
              <Col xs={24} md={8}><Form.Item name="mysqlPort" label="MySQL 端口" rules={[{ required: true }]}><Input type="number" /></Form.Item></Col>
              <Col xs={24} md={8}><Form.Item name="mysqlUser" label="MySQL 用户" rules={[{ required: true }]}><Input /></Form.Item></Col>
            </Row>
            <Row gutter={12}>
              <Col xs={24} md={12}><Form.Item name="mysqlPassword" label="MySQL 密码" rules={[{ required: true }]}><Input.Password /></Form.Item></Col>
              <Col xs={24} md={12}><Form.Item name="mysqlDatabase" label="MySQL 数据库" rules={[{ required: true }]}><Input /></Form.Item></Col>
            </Row>
          </Card>

          <Card title="监控与应用配置" style={{ marginBottom: 16 }}>
            <Row gutter={12}>
              <Col xs={24} md={8}><Form.Item name="prometheusEnabled" label="启用 Prometheus" valuePropName="checked"><Switch /></Form.Item></Col>
              <Col xs={24} md={8}><Form.Item name="prometheusUrl" label="Prometheus URL" rules={[{ required: true }]}><Input /></Form.Item></Col>
              <Col xs={24} md={8}><Form.Item name="slowQueryThreshold" label="慢查询阈值(秒)" rules={[{ required: true }]}><Input type="number" step="0.1" /></Form.Item></Col>
            </Row>
            <Row gutter={12}>
              <Col xs={24} md={8}><Form.Item name="debugMode" label="调试模式" valuePropName="checked"><Switch /></Form.Item></Col>
              <Col xs={24} md={16}><Form.Item name="corsOrigins" label="CORS 域名"><Input /></Form.Item></Col>
            </Row>
          </Card>

          <Form.Item>
            <Button type="primary" htmlType="submit" loading={loading} style={{ marginRight: 8 }}>
              <SaveOutlined style={{ marginRight: 4 }} />
              保存配置
            </Button>
            <Button htmlType="button" onClick={() => form.resetFields()}>重置</Button>
          </Form.Item>
        </Form>
      </Card>
    </div>
  );
};

const TitleBar: React.FC = () => (
  <div style={{ display: 'flex', alignItems: 'center' }}>
    <SettingOutlined style={{ marginRight: 8 }} />
    <span>系统设置（校园值班策略）</span>
  </div>
);

const SpaceHeader: React.FC = () => (
  <div style={{ marginBottom: 12 }}>
    <Title level={2} style={{ marginBottom: 4 }}>系统设置</Title>
    <Text type="secondary">管理值班策略、通知策略、时段策略，并保留变更审计意识。</Text>
  </div>
);

const SpaceTags: React.FC = () => (
  <div style={{ marginTop: 4 }}>
    <Tag color="magenta">课堂保障优先</Tag>
    <Tag color="blue">机房稳定优先</Tag>
    <Tag color="purple">社团活动保障</Tag>
  </div>
);
