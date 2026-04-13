export const getCampusTicketCategoryMeta = (category?: string) => {
  if (category === 'teaching_support') return { label: '教学保障', color: 'magenta' };
  if (category === 'lab_support') return { label: '机房保障', color: 'blue' };
  if (category === 'club_support') return { label: '社团保障', color: 'purple' };
  return { label: category || '未分类', color: 'default' };
};

export const getCampusTicketSeverityMeta = (severity?: string) => {
  if (severity === 'high') return { label: 'P1 / 高', color: 'red' };
  if (severity === 'medium') return { label: 'P2 / 中', color: 'orange' };
  return { label: 'P3 / 低', color: 'blue' };
};

export const getCampusTicketStatusMeta = (status?: string) => {
  if (status === 'pending') return { label: '待接单', color: 'gold' };
  if (status === 'assigned') return { label: '已派单（待响应）', color: 'blue' };
  if (status === 'in_progress') return { label: '处理中', color: 'processing' };
  if (status === 'waiting_acceptance') return { label: '待验收（老师/报修人）', color: 'purple' };
  if (status === 'closed') return { label: '已关闭', color: 'green' };
  return { label: status || '未知状态', color: 'default' };
};

export const getCampusSceneHint = (text: string) => {
  if (text.includes('上课') || text.includes('课堂') || text.includes('投影')) {
    return { scene: '教学保障事件', level: 'P1', escalate: '现场值班 → 中心值班老师' };
  }
  if (text.includes('机房') || text.includes('网络') || text.includes('服务器')) {
    return { scene: '机房保障事件', level: 'P1/P2', escalate: '学生助理 → 值班老师 → 平台主管老师' };
  }
  if (text.includes('社团') || text.includes('活动') || text.includes('路演')) {
    return { scene: '社团活动保障事件', level: 'P2', escalate: '社团技术负责人 → 中心值班老师' };
  }
  return { scene: '待识别', level: '待评估', escalate: '按标准值班链路升级' };
};

export const campusTicketCategoryOptions = [
  { label: '教学保障（课程中断）', value: 'teaching_support' },
  { label: '机房保障（设备/环境）', value: 'lab_support' },
  { label: '社团活动保障', value: 'club_support' },
];

export const campusTicketSeverityOptions = [
  { label: 'P1 / 高', value: 'high' },
  { label: 'P2 / 中', value: 'medium' },
  { label: 'P3 / 低', value: 'low' },
];

export const campusTicketStatusFilterOptions = [
  { label: '全部状态', value: 'all' },
  { label: '待接单', value: 'pending' },
  { label: '已派单（待响应）', value: 'assigned' },
  { label: '处理中', value: 'in_progress' },
  { label: '待验收', value: 'waiting_acceptance' },
  { label: '已关闭', value: 'closed' },
];
