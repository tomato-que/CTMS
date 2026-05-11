'use client';

import { useState } from 'react';
import { Search, Filter, Plus, Eye, BarChart3, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

const projectList = [
  { id: '1', projectNo: 'PMS-2024-001', title: '瑞格非尼治疗晚期肝细胞癌的多中心临床研究', type: 'GCP', phase: 'III期', status: 'Active', riskLevel: 'Medium', progress: 72, planned: 200, actual: 178, startDate: '2024-01-15', endDate: '2025-06-30', owner: '张经理', leadSite: '北京协和医院' },
  { id: '2', projectNo: 'PMS-2024-002', title: '培美曲塞联合顺铂一线治疗非小细胞肺癌的疗效观察', type: 'GCP', phase: 'II期', status: 'Active', riskLevel: 'Low', progress: 88, planned: 150, actual: 145, startDate: '2024-02-01', endDate: '2025-03-31', owner: '张经理', leadSite: '复旦大学附属华山医院' },
  { id: '3', projectNo: 'PMS-2024-003', title: '奥希替尼辅助治疗EGFR突变阳性NSCLC的真实世界研究', type: 'PMS', phase: 'IV期', status: 'Active', riskLevel: 'Low', progress: 55, planned: 500, actual: 320, startDate: '2024-03-01', endDate: '2026-02-28', owner: '张经理', leadSite: '中山大学附属第一医院' },
  { id: '4', projectNo: 'PMS-2024-004', title: 'CAR-T细胞治疗复发难治性B细胞淋巴瘤的IIT研究', type: 'IIT', phase: 'I期', status: 'Active', riskLevel: 'High', progress: 45, planned: 30, actual: 18, startDate: '2024-04-01', endDate: '2025-09-30', owner: '张经理', leadSite: '四川大学华西医院' },
  { id: '5', projectNo: 'PMS-2024-005', title: '糖尿病肾病早期筛查生物标志物的注册登记研究', type: 'Registry', phase: '-', status: 'Active', riskLevel: 'Low', progress: 38, planned: 1000, actual: 420, startDate: '2024-05-01', endDate: '2026-04-30', owner: '张经理', leadSite: '浙江大学医学院附属第一医院' },
  { id: '6', projectNo: 'PMS-2024-006', title: '阿帕替尼联合卡瑞利珠单抗治疗晚期胃癌的II期研究', type: 'GCP', phase: 'II期', status: 'Active', riskLevel: 'Medium', progress: 65, planned: 80, actual: 62, startDate: '2024-06-01', endDate: '2025-08-31', owner: '张经理', leadSite: '武汉同济医院' },
  { id: '7', projectNo: 'PMS-2024-007', title: '雷珠单抗治疗湿性年龄相关性黄斑变性的多中心临床研究', type: 'GCP', phase: 'III期', status: 'Active', riskLevel: 'Low', progress: 40, planned: 120, actual: 55, startDate: '2024-07-01', endDate: '2025-12-31', owner: '张经理', leadSite: '北京协和医院' },
  { id: '8', projectNo: 'PMS-2024-008', title: '新型冠状病毒mRNA疫苗加强针免疫原性研究', type: 'IIT', phase: 'III期', status: 'Active', riskLevel: 'Critical', progress: 15, planned: 300, actual: 28, startDate: '2024-08-01', endDate: '2026-01-31', owner: '张经理', leadSite: '复旦大学附属华山医院' },
];

const statusColors: Record<string, string> = {
  Active: 'bg-green-100 text-green-700', Draft: 'bg-gray-100 text-gray-600',
  PendingApproval: 'bg-yellow-100 text-yellow-700', Completed: 'bg-blue-100 text-blue-700',
  Suspended: 'bg-orange-100 text-orange-700', Terminated: 'bg-red-100 text-red-700',
};

const riskColors: Record<string, string> = {
  Low: 'bg-green-100 text-green-700', Medium: 'bg-yellow-100 text-yellow-700',
  High: 'bg-orange-100 text-orange-700', Critical: 'bg-red-100 text-red-700',
};

const statusLabels: Record<string, string> = {
  Active: '进行中', Draft: '草稿', PendingApproval: '待审批',
  Completed: '已完成', Suspended: '暂停', Terminated: '已终止',
};

export default function ProjectsPage() {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [riskFilter, setRiskFilter] = useState('all');

  const filtered = projectList.filter((p) => {
    if (search && !p.title.includes(search) && !p.projectNo.includes(search)) return false;
    if (statusFilter !== 'all' && p.status !== statusFilter) return false;
    if (riskFilter !== 'all' && p.riskLevel !== riskFilter) return false;
    return true;
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">项目管理</h1>
          <p className="text-sm text-gray-500 mt-1">管理所有临床研究项目</p>
        </div>
        <button className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700">
          <Plus size={16} /> 新建项目
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2 px-3 py-2 bg-white border border-gray-200 rounded-lg w-64">
          <Search size={16} className="text-gray-400" />
          <input
            type="text" placeholder="搜索项目名称或编号..."
            value={search} onChange={(e) => setSearch(e.target.value)}
            className="bg-transparent border-none outline-none text-sm w-full"
          />
        </div>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm text-gray-600 outline-none"
        >
          <option value="all">全部状态</option>
          <option value="Active">进行中</option>
          <option value="Draft">草稿</option>
          <option value="PendingApproval">待审批</option>
          <option value="Completed">已完成</option>
        </select>
        <select value={riskFilter} onChange={(e) => setRiskFilter(e.target.value)}
          className="px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm text-gray-600 outline-none"
        >
          <option value="all">全部风险等级</option>
          <option value="Low">低风险</option>
          <option value="Medium">中风险</option>
          <option value="High">高风险</option>
          <option value="Critical">极高风险</option>
        </select>
        <span className="text-xs text-gray-400 ml-auto">{filtered.length} 个项目</span>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/50">
                <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">项目编号</th>
                <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">项目名称</th>
                <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">负责人</th>
                <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">起止时间</th>
                <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">进度</th>
                <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">状态</th>
                <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">风险</th>
                <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">入组</th>
                <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">操作</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((p) => (
                <tr key={p.id} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
                  <td className="px-4 py-3 text-sm font-medium text-gray-900">{p.projectNo}</td>
                  <td className="px-4 py-3 text-sm text-gray-700 max-w-xs truncate">{p.title}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">{p.owner}</td>
                  <td className="px-4 py-3 text-xs text-gray-500">{p.startDate}<br/>{p.endDate}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2 min-w-[100px]">
                      <div className="w-16 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div className={cn('h-full rounded-full', p.progress >= 80 ? 'bg-green-500' : p.progress >= 50 ? 'bg-blue-500' : 'bg-yellow-500')}
                          style={{ width: `${p.progress}%` }} />
                      </div>
                      <span className="text-xs text-gray-500">{p.progress}%</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium', statusColors[p.status])}>
                      {statusLabels[p.status]}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium', riskColors[p.riskLevel])}>
                      {p.riskLevel === 'Low' ? '低' : p.riskLevel === 'Medium' ? '中' : p.riskLevel === 'High' ? '高' : '严重'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">{p.actual}/{p.planned}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      <button className="p-1.5 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-600" title="查看详情">
                        <Eye size={14} />
                      </button>
                      <button className="p-1.5 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-600" title="统计分析">
                        <BarChart3 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between">
        <span className="text-sm text-gray-500">共 {filtered.length} 条记录</span>
        <div className="flex items-center gap-2">
          <button className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50" disabled>上一页</button>
          <button className="px-3 py-1.5 text-sm bg-primary-600 text-white rounded-lg">1</button>
          <button className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg hover:bg-gray-50">下一页</button>
        </div>
      </div>
    </div>
  );
}
