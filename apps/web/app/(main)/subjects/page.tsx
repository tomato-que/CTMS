'use client';

import { useState } from 'react';
import { Search, Filter } from 'lucide-react';
import { cn } from '@/lib/utils';

const subjectList = [
  { id: '1', subjectNo: 'SUB-001-001', screeningNo: 'SCR-001-001', randomNo: 'RAND-00001', initials: '张三', gender: 'Male', birthYear: 1965, site: '北京协和医院', project: 'PMS-2024-001', status: 'Active', currentVisit: 'V3', enrollmentDate: '2024-03-15' },
  { id: '2', subjectNo: 'SUB-001-002', screeningNo: 'SCR-001-002', randomNo: 'RAND-00002', initials: '李四', gender: 'Female', birthYear: 1972, site: '北京协和医院', project: 'PMS-2024-001', status: 'Completed', currentVisit: 'EOS', enrollmentDate: '2024-03-20' },
  { id: '3', subjectNo: 'SUB-002-001', screeningNo: 'SCR-002-001', randomNo: 'RAND-00003', initials: '王五', gender: 'Male', birthYear: 1980, site: '复旦大学附属华山医院', project: 'PMS-2024-002', status: 'Active', currentVisit: 'V5', enrollmentDate: '2024-04-10' },
  { id: '4', subjectNo: 'SUB-002-002', screeningNo: 'SCR-002-002', randomNo: 'RAND-00004', initials: '赵六', gender: 'Female', birthYear: 1958, site: '复旦大学附属华山医院', project: 'PMS-2024-002', status: 'Withdrawn', currentVisit: '-', enrollmentDate: '2024-04-15' },
  { id: '5', subjectNo: 'SUB-003-001', screeningNo: 'SCR-003-001', randomNo: 'RAND-00005', initials: '孙七', gender: 'Male', birthYear: 1990, site: '中山大学附属第一医院', project: 'PMS-2024-003', status: 'Active', currentVisit: 'V2', enrollmentDate: '2024-05-01' },
];

const statusColors: Record<string, string> = {
  Screening: 'bg-purple-100 text-purple-700', Enrolled: 'bg-blue-100 text-blue-700',
  Active: 'bg-green-100 text-green-700', Completed: 'bg-teal-100 text-teal-700',
  Withdrawn: 'bg-orange-100 text-orange-700', LostToFollowUp: 'bg-red-100 text-red-700',
};

const statusLabels: Record<string, string> = {
  Screening: '筛选中', Enrolled: '已入组', Active: '研究中',
  Completed: '已完成', Withdrawn: '已退出', LostToFollowUp: '失访',
};

export default function SubjectsPage() {
  const [search, setSearch] = useState('');

  const filtered = subjectList.filter((s) => {
    if (search && !s.subjectNo.includes(search) && !s.initials.includes(search)) return false;
    return true;
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">受试者全景</h1>
          <p className="text-sm text-gray-500 mt-1">管理所有研究受试者</p>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2 px-3 py-2 bg-white border border-gray-200 rounded-lg w-64">
          <Search size={16} className="text-gray-400" />
          <input type="text" placeholder="搜索受试者编号..." value={search} onChange={(e) => setSearch(e.target.value)}
            className="bg-transparent border-none outline-none text-sm w-full" />
        </div>
        <button className="flex items-center gap-1.5 px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50">
          <Filter size={14} /> 筛选
        </button>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/50">
                <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">受试者编号</th>
                <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">筛选号</th>
                <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">随机号</th>
                <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">缩写</th>
                <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">性别</th>
                <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">出生年</th>
                <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">中心</th>
                <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">入组日期</th>
                <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">当前访视</th>
                <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">状态</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((s) => (
                <tr key={s.id} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
                  <td className="px-4 py-3 text-sm font-medium text-primary-600">{s.subjectNo}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">{s.screeningNo}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">{s.randomNo}</td>
                  <td className="px-4 py-3 text-sm text-gray-700">{s.initials}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">{s.gender === 'Male' ? '男' : '女'}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">{s.birthYear}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">{s.site}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">{s.enrollmentDate}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">{s.currentVisit}</td>
                  <td className="px-4 py-3">
                    <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium', statusColors[s.status])}>
                      {statusLabels[s.status]}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
