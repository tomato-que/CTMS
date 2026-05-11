// Mock data for development when API is not available

export const mockDashboardOverview = {
  activeProjects: 12,
  totalSubjects: 1284,
  pendingQueries: 45,
  saeCount: 3,
};

export const mockEnrollmentTrend = [
  { month: '2024-11', cumulative: 920, monthly: 102 },
  { month: '2024-12', cumulative: 1038, monthly: 118 },
  { month: '2025-01', cumulative: 1120, monthly: 82 },
  { month: '2025-02', cumulative: 1190, monthly: 70 },
  { month: '2025-03', cumulative: 1245, monthly: 55 },
  { month: '2025-04', cumulative: 1284, monthly: 39 },
];

export const mockStageDistribution = [
  { status: 'Draft', label: '草稿', count: 1 },
  { status: 'PendingApproval', label: '待审批', count: 1 },
  { status: 'Active', label: '进行中', count: 9 },
  { status: 'Completed', label: '已完成', count: 1 },
  { status: 'Suspended', label: '暂停', count: 0 },
];

export const mockMilestones = [
  { id: '1', projectNo: 'PMS-2024-001', projectTitle: '瑞格非尼治疗晚期肝癌研究', name: '数据清理', plannedDate: '2025-05-15', actualDate: null, status: 'InProgress' },
  { id: '2', projectNo: 'PMS-2024-004', projectTitle: 'CAR-T细胞治疗研究', name: '中期评估', plannedDate: '2025-05-20', actualDate: null, status: 'InProgress' },
  { id: '3', projectNo: 'PMS-2024-002', projectTitle: '培美曲塞肺癌研究', name: '数据库锁定', plannedDate: '2025-05-01', actualDate: '2025-04-28', status: 'Completed' },
  { id: '4', projectNo: 'PMS-2024-006', projectTitle: '阿帕替尼胃癌研究', name: '中期评估', plannedDate: '2025-06-01', actualDate: null, status: 'NotStarted' },
  { id: '5', projectNo: 'PMS-2024-008', projectTitle: 'mRNA疫苗加强针研究', name: '首例入组', plannedDate: '2025-04-15', actualDate: '2025-04-20', status: 'Completed' },
];

export const mockProjects = [
  { id: '1', projectNo: 'PMS-2024-001', title: '瑞格非尼治疗晚期肝细胞癌的多中心临床研究', projectType: 'GCP', phase: 'PhaseIII', status: 'Active', riskLevel: 'Medium', progressPercent: 72, plannedEnrollment: 200, actualEnrollment: 178, startDate: '2024-01-15', endDate: '2025-06-30', owner: { realName: '张经理' }, leadSite: { name: '北京协和医院' } },
  { id: '2', projectNo: 'PMS-2024-002', title: '培美曲塞联合顺铂一线治疗非小细胞肺癌的疗效观察', projectType: 'GCP', phase: 'PhaseII', status: 'Active', riskLevel: 'Low', progressPercent: 88, plannedEnrollment: 150, actualEnrollment: 145, startDate: '2024-02-01', endDate: '2025-03-31', owner: { realName: '张经理' }, leadSite: { name: '复旦大学附属华山医院' } },
  { id: '3', projectNo: 'PMS-2024-003', title: '奥希替尼辅助治疗EGFR突变阳性NSCLC的真实世界研究', projectType: 'PMS', phase: 'PhaseIV', status: 'Active', riskLevel: 'Low', progressPercent: 55, plannedEnrollment: 500, actualEnrollment: 320, startDate: '2024-03-01', endDate: '2026-02-28', owner: { realName: '张经理' }, leadSite: { name: '中山大学附属第一医院' } },
  { id: '4', projectNo: 'PMS-2024-004', title: 'CAR-T细胞治疗复发难治性B细胞淋巴瘤的IIT研究', projectType: 'IIT', phase: 'PhaseI', status: 'Active', riskLevel: 'High', progressPercent: 45, plannedEnrollment: 30, actualEnrollment: 18, startDate: '2024-04-01', endDate: '2025-09-30', owner: { realName: '张经理' }, leadSite: { name: '四川大学华西医院' } },
  { id: '5', projectNo: 'PMS-2024-005', title: '糖尿病肾病早期筛查生物标志物的注册登记研究', projectType: 'Registry', phase: 'PreClinical', status: 'Active', riskLevel: 'Low', progressPercent: 38, plannedEnrollment: 1000, actualEnrollment: 420, startDate: '2024-05-01', endDate: '2026-04-30', owner: { realName: '张经理' }, leadSite: { name: '浙江大学医学院附属第一医院' } },
  { id: '6', projectNo: 'PMS-2024-006', title: '阿帕替尼联合卡瑞利珠单抗治疗晚期胃癌的II期研究', projectType: 'GCP', phase: 'PhaseII', status: 'Active', riskLevel: 'Medium', progressPercent: 65, plannedEnrollment: 80, actualEnrollment: 62, startDate: '2024-06-01', endDate: '2025-08-31', owner: { realName: '张经理' }, leadSite: { name: '武汉同济医院' } },
  { id: '7', projectNo: 'PMS-2024-007', title: '雷珠单抗治疗湿性年龄相关性黄斑变性的多中心临床研究', projectType: 'GCP', phase: 'PhaseIII', status: 'Active', riskLevel: 'Low', progressPercent: 40, plannedEnrollment: 120, actualEnrollment: 55, startDate: '2024-07-01', endDate: '2025-12-31', owner: { realName: '张经理' }, leadSite: { name: '北京协和医院' } },
  { id: '8', projectNo: 'PMS-2024-008', title: '新型冠状病毒mRNA疫苗加强针免疫原性研究', projectType: 'IIT', phase: 'PhaseIII', status: 'Active', riskLevel: 'Critical', progressPercent: 15, plannedEnrollment: 300, actualEnrollment: 28, startDate: '2024-08-01', endDate: '2026-01-31', owner: { realName: '张经理' }, leadSite: { name: '复旦大学附属华山医院' } },
];
