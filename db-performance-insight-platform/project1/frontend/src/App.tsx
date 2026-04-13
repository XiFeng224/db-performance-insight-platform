import React, { useEffect, useMemo, useState } from 'react';
import { Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import { Badge, Button, Grid, Layout, Menu, Modal, Space, Tag, Typography } from 'antd';
import { optimizationApi, ticketsApi } from './services/api';
import { DashboardOutlined, ThunderboltOutlined, BarChartOutlined, SettingOutlined, BellOutlined, LineChartOutlined, QuestionCircleOutlined, RocketOutlined, ApartmentOutlined, HomeOutlined, FormOutlined, InboxOutlined, ScheduleOutlined, AppstoreOutlined, BookOutlined } from '@ant-design/icons';
import HomePortal from './components/HomePortal';
import { Dashboard } from './components/Dashboard';
import { SlowQueryList } from './components/SlowQueryList';
import { OptimizationPage } from './components/OptimizationPage';
import { AlertCenter } from './components/AlertCenter';
import { SettingsPage } from './components/SettingsPage';
import { ErrorBoundary } from './components/ErrorBoundary';
import ComparisonPage from './components/ComparisonPage';
import AIAssistantPage from './components/AIAssistantPage';
import OpsCenterPage from './components/OpsCenterPage';
import TicketSubmitPage from './components/TicketSubmitPage';
import TicketCenterPage from './components/TicketCenterPage';
import DutySchedulePage from './components/DutySchedulePage';
import TicketBoardPage from './components/TicketBoardPage';
import KnowledgeCenterPage from './components/KnowledgeCenterPage';

const { Header, Content, Sider } = Layout;
const { useBreakpoint } = Grid;
const { Text } = Typography;

const menuItems = [
  { key: '/', icon: <HomeOutlined />, label: '平台首页' },
  { key: '/ticket-submit', icon: <FormOutlined />, label: '工单提交' },
  { key: '/ticket-center', icon: <InboxOutlined />, label: '工单中心' },
  { key: '/ticket-board', icon: <AppstoreOutlined />, label: '用户进度看板' },
  { key: '/duty-schedule', icon: <ScheduleOutlined />, label: '值班排班管理' },
  { key: '/knowledge-center', icon: <BookOutlined />, label: '知识库管理' },
  { key: '/alerts', icon: <BellOutlined />, label: '告警响应中心' },
  { key: '/ops-center', icon: <ApartmentOutlined />, label: '应急协作中心' },
  { key: '/ai-assistant', icon: <RocketOutlined />, label: 'AI值班助手' },
  { key: '/comparison', icon: <LineChartOutlined />, label: '复盘与历史对比' },
  { key: '/dashboard', icon: <DashboardOutlined />, label: '监控大屏' },
  { key: '/slow-queries', icon: <ThunderboltOutlined />, label: '数据库诊断(扩展)' },
  { key: '/optimization', icon: <BarChartOutlined />, label: '优化建议(扩展)' },
  { key: '/settings', icon: <SettingOutlined />, label: '系统设置' },
];

const App: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const currentPath = location.pathname;
  const screens = useBreakpoint();
  const isMobile = !screens.lg;
  const [collapsed, setCollapsed] = useState(isMobile);
  const [guideOpen, setGuideOpen] = useState(false);
  const [topSummary, setTopSummary] = useState({ total: 0, p1: 0, pending: 0, optVerifying: 0 });

  useEffect(() => {
    setCollapsed(isMobile);
  }, [isMobile]);

  useEffect(() => {
    const shouldShow = localStorage.getItem('campus-oncall-guide-dismissed') !== '1';
    if (shouldShow) {
      setGuideOpen(true);
    }
  }, []);

  useEffect(() => {
    const loadTopSummary = async () => {
      try {
        const [ticketRes, optRes] = await Promise.all([
          ticketsApi.list({ limit: 200 }),
          optimizationApi.getTop(200),
        ]);
        const items = ticketRes.data.items || [];
        const opts = optRes.data.suggestions || [];
        setTopSummary({
          total: items.length,
          p1: items.filter((t) => t.severity === 'high' && t.status !== 'closed').length,
          pending: items.filter((t) => t.status !== 'closed').length,
          optVerifying: opts.filter((s: any) => s.exec_status === 'verifying').length,
        });
      } catch {
        setTopSummary({ total: 0, p1: 0, pending: 0, optVerifying: 0 });
      }
    };
    loadTopSummary();
  }, [currentPath]);

  const guideSteps = useMemo(
    () => [
      '先进入告警响应中心，确认告警等级与影响范围',
      '在应急协作中心生成Runbook，按步骤执行处置',
      '通过AI值班助手进行智能问答、受理分诊和交接摘要生成',
      '在操作留痕中确认处理过程，支持导出与交接',
      '最后进入复盘与历史对比，验证指标是否恢复',
    ],
    []
  );

  const handleCloseGuide = (dontShowAgain: boolean) => {
    if (dontShowAgain) {
      localStorage.setItem('campus-oncall-guide-dismissed', '1');
    }
    setGuideOpen(false);
  };

  return (
    <ErrorBoundary>
      <Layout style={{ minHeight: '100vh', background: 'transparent' }}>
        <Header 
          style={{ 
            display: 'flex', 
            alignItems: 'center', 
            background: 'linear-gradient(120deg, #4f46e5 0%, #6366f1 50%, #7c3aed 100%)',
            boxShadow: '0 6px 20px rgba(79,70,229,0.25)',
            padding: isMobile ? '0 12px' : '0 24px',
            position: 'sticky',
            top: 0,
            zIndex: 1000,
            backdropFilter: 'blur(6px)'
          }}
        >
          <div
            style={{
              color: 'white',
              fontSize: isMobile ? '16px' : '20px',
              fontWeight: 'bold',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              width: '100%',
              gap: '12px',
            }}
          >
            <Space size={isMobile ? 8 : 12}>
              <span
                style={{
                  background: 'rgba(255,255,255,0.2)',
                  padding: isMobile ? '6px 10px' : '8px 12px',
                  borderRadius: '8px',
                  fontSize: isMobile ? '14px' : '16px',
                }}
              >
                ⚡
              </span>
              <span style={{ whiteSpace: 'nowrap' }}>校园实验室智能值班与应急协作平台</span>
            </Space>
            <Space size={10}>
              {!isMobile && (
                <Space size={8}>
                  <Tag color="processing" style={{ border: 'none' }}>
                    值班状态：在线
                  </Tag>
                  <Tag color="blue">未闭环：{topSummary.pending}</Tag>
                  <Tag color="red">P1进行中：{topSummary.p1}</Tag>
                  <Tag color="purple">总工单：{topSummary.total}</Tag>
                  <Tag color="orange">优化待验证：{topSummary.optVerifying}</Tag>
                </Space>
              )}
              <Badge status="processing" text={!isMobile ? '实时同步' : ''} />
              <Button
                type="text"
                icon={<QuestionCircleOutlined />}
                onClick={() => setGuideOpen(true)}
                style={{ color: 'white' }}
              >
                {!isMobile && '新手引导'}
              </Button>
            </Space>
          </div>
        </Header>
        <Layout style={{ background: 'transparent' }}>
          <Sider 
            width={236}
            collapsedWidth={isMobile ? 0 : 88}
            collapsed={collapsed}
            onCollapse={setCollapsed}
            breakpoint="lg"
            trigger={null}
            style={{ 
              background: '#ffffffcc',
              backdropFilter: 'blur(8px)',
              boxShadow: '6px 0 22px rgba(79,70,229,0.12)',
              borderRadius: '0 14px 14px 0',
              marginTop: '16px',
              marginBottom: '16px',
              overflow: 'hidden',
              border: '1px solid #e5e7eb',
            }}
          >
            <Menu
              mode="inline"
              selectedKeys={[currentPath]}
              style={{ 
                height: '100%', 
                borderRight: 0,
                padding: '16px 0'
              }}
              items={menuItems}
              onClick={({ key }) => navigate(key)}
            />
          </Sider>
          <Layout style={{ padding: isMobile ? '12px' : '16px 24px 24px', background: 'transparent' }}>
            <Content
              style={{
                padding: isMobile ? 12 : 24,
                margin: 0,
                minHeight: 280,
                background: '#ffffffd9',
                borderRadius: 14,
                border: '1px solid #e5e7eb',
                boxShadow: '0 10px 30px rgba(79,70,229,0.08)',
                backdropFilter: 'blur(6px)',
              }}
              className="fade-in"
            >
              <ErrorBoundary>
                <Routes>
                  <Route path="/" element={<HomePortal />} />
                  <Route path="/dashboard" element={<Dashboard />} />
                  <Route path="/slow-queries" element={<SlowQueryList />} />
                  <Route path="/comparison" element={<ComparisonPage />} />
                  <Route path="/optimization" element={<OptimizationPage />} />
                  <Route path="/ai-assistant" element={<AIAssistantPage />} />
                  <Route path="/ops-center" element={<OpsCenterPage />} />
                  <Route path="/ticket-submit" element={<TicketSubmitPage />} />
                  <Route path="/ticket-center" element={<TicketCenterPage />} />
                  <Route path="/ticket-board" element={<TicketBoardPage />} />
                  <Route path="/duty-schedule" element={<DutySchedulePage />} />
                  <Route path="/knowledge-center" element={<KnowledgeCenterPage />} />
                  <Route path="/alerts" element={<AlertCenter />} />
                  <Route path="/settings" element={<SettingsPage />} />
                  <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
              </ErrorBoundary>
            </Content>
          </Layout>
        </Layout>
        <Modal
          title="新手引导"
          open={guideOpen}
          onCancel={() => handleCloseGuide(false)}
          footer={[
            <Button key="skip" onClick={() => handleCloseGuide(false)}>
              稍后再看
            </Button>,
            <Button key="never" onClick={() => handleCloseGuide(true)}>
              不再提示
            </Button>,
            <Button
              key="start"
              type="primary"
              onClick={() => {
                navigate('/');
                handleCloseGuide(false);
              }}
            >
              开始体验
            </Button>,
          ]}
        >
          <Space direction="vertical" size={8}>
            {guideSteps.map((step, index) => (
              <Text key={step}>
                {index + 1}. {step}
              </Text>
            ))}
          </Space>
        </Modal>
      </Layout>
    </ErrorBoundary>
  );
};

export default App;
