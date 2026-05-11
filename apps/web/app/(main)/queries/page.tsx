'use client';

import { useState } from 'react';
import { Search } from 'lucide-react';
import { cn } from '@/lib/utils';

const queryList = [
  { id: '1', projectNo: 'PMS-2024-001', site: '北京协和医院', subjectNo: 'SUB-001-001', field: 'lab_value', type: 'DataError', text: '实验室检查结果超出正常范围，请核实', status: 'Open', priority: 'High', createdBy: '李监查员', assignedTo: '陈主任', createdAt: '2025-05-08' },
  { id: '2', projectNo: 'PMS-2024-001', site: '北京协和医院', subjectNo: 'SUB-001-002', field: 'conmed', type: 'MissingData', text: '合并用药记录缺失，请补充录入', status: 'Answered', priority: 'Medium', createdBy: '李监查员', assignedTo: '陈主任', createdAt: '2025-05-05' },
  { id: '3', projectNo: 'PMS-2024-002', site: '复旦大学附属华山医院', subjectNo: 'SUB-002-001', field: 'vital_signs', type: 'DataError', text: '生命体征数据与原始病历不一致', status: 'Closed', priority: 'Low', createdBy: '王监查员', assignedTo: '陈主任', createdAt: '2025-05-01' },
  { id: '4', projectNo: 'PMS-2024-003', site: '中山大学附属第一医院', subjectNo: 'SUB-003-001', field: 'ae_date', type: 'ProtocolDeviation', text: '不良事件开始日期早于知情同意签署日期', status: 'Open', priority: 'Urgent', createdBy: '赵数据管理', assignedTo: '刘副研究员', createdAt: '2025-05-10' },
  { id: '5', projectNo: 'PMS-2024-004', site: '四川大学华西医院', subjectNo: 'SUB-004-001', field: 'icf_date', type: 'MissingData', text: '知情同意书签署日期缺失', status: 'Open', priority: 'High', createdBy: '李监查员', assignedTo: '陈主任', createdAt: '2025-05-09' },
];

const statusColors: Record<string, string> = {
  Open: 'bg-red-100 text-red-700', Answered: 'bg-yellow-100 text-yellow-700',
  Closed: 'bg-green-100 text-green-700', Cancelled: 'bg-gray-100 text-gray-600',
};
const statusLabels: Record<string, string> = { Open: '待处理', Answered: '已回复', Closed: '已关闭', Cancelled: '已取消' };
const priorityColors: Record<string, string> = {
  Low: 'bg-gray-100 text-gray-600', Medium: 'bg-blue-100 text-blue-700',
  High: 'bg-orange-100 text-orange-700', Urgent: 'bg-red-100 text-red-700',
};
const priorityLabels: Record<string, string> = { Low: '低', Medium: '中', High: '高', Urgent: '紧急' };

export default function QueriesPage() {
  const [statusFilter, setStatusFilter] = useState('all');

  const filtered = queryList.filter((q) => statusFilter === 'all' || q.status === statusFilter);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Query 管理</h1>
          <p className="text-sm text-gray-500 mt-1">数据质疑管理与处理</p>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2 px-3 py-2 bg-white border border-gray-200 rounded-lg w-64">
          <Search size={16} className="text-gray-400" />
          <input type="text" placeholder="搜索Query..." className="bg-transparent border-none outline-none text-sm w-full" />
        </div>
        <div className="flex bg-gray-100 rounded-lg p-0.5">
          {['all', 'Open', 'Answered', 'Closed'].map((s) => (
            <button key={s} onClick={() => setStatusFilter(s)}
              className={cn('px-3 py-1 text-xs rounded-md transition-colors', statusFilter === s ? 'bg-white shadow text-gray-900 font-medium' : 'text-gray-500')}
            >
              {s === 'all' ? '全部' : statusLabels[s]}
            </button>
          ))}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: '全部Query', value: 50, color: 'text-gray-600' },
          { label: '待处理', value: 15, color: 'text-red-600' },
          { label: '已回复', value: 20, color: 'text-yellow-600' },
          { label: '已关闭', value: 15, color: 'text-green-600' },
        ].map((stat) => (
          <div key={stat.label} className="bg-white rounded-xl border border-gray-200 p-4 text-center">
            <p className={cn('text-2xl font-bold', stat.color)}>{stat.value}</p>
            <p className="text-xs text-gray-500 mt-1">{stat.label}</p>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/50">
                <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">项目</th>
                <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">中心</th>
                <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">受试者</th>
                <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">字段</th>
                <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">质疑内容</th>
                <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">优先级</th>
                <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">状态</th>
                <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">发起人</th>
                <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">处理人</th>
                <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">日期</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((q) => (
                <tr key={q.id} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
                  <td className="px-4 py-3 text-sm text-gray-600">{q.projectNo}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">{q.site}</td>
                  <td className="px-4 py-3 text-sm text-primary-600">{q.subjectNo}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">{q.field}</td>
                  <td className="px-4 py-3 text-sm text-gray-700 max-w-xs truncate">{q.text}</td>
                  <td className="px-4 py-3">
                    <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium', priorityColors[q.priority])}>{priorityLabels[q.priority]}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium', statusColors[q.status])}>{statusLabels[q.status]}</span>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">{q.createdBy}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">{q.assignedTo}</td>
                  <td className="px-4 py-3 text-sm text-gray-500">{q.createdAt}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
