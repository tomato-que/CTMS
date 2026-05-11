'use client';

import { Clock, AlertTriangle, CheckCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

const saeList = [
  { id: '1', aeNo: 'AE-0002', aeTerm: '高血压危象', severity: 'Severe', reportStatus: 'ReportedWithin24h', saeDeadline24h: '2025-04-21 14:00', saeDeadline7d: '2025-04-28', subjectNo: 'SUB-002-005', project: 'PMS-2024-002', reportedAt: '2025-04-20 22:30' },
  { id: '2', aeNo: 'AE-0003', aeTerm: '重症肺炎', severity: 'LifeThreatening', reportStatus: 'Pending', saeDeadline24h: '2025-05-02 08:00', saeDeadline7d: '2025-05-09', subjectNo: 'SUB-003-012', project: 'PMS-2024-003', reportedAt: null },
  { id: '3', aeNo: 'AE-0018', aeTerm: '心肌梗死', severity: 'Severe', reportStatus: 'ReportedOverdue', saeDeadline24h: '2025-03-15 16:00', saeDeadline7d: '2025-03-22', subjectNo: 'SUB-006-003', project: 'PMS-2024-006', reportedAt: '2025-03-17 09:00' },
];

const statusLabels: Record<string, string> = {
  NotRequired: '不适用', Pending: '待上报', ReportedWithin24h: '已上报(24h内)',
  ReportedOverdue: '超时上报', FollowUpReported: '已提交随访', Completed: '已完成',
};

const statusColors: Record<string, string> = {
  ReportedWithin24h: 'bg-green-100 text-green-700', Pending: 'bg-yellow-100 text-yellow-700',
  ReportedOverdue: 'bg-red-100 text-red-700', NotRequired: 'bg-gray-100 text-gray-600',
  FollowUpReported: 'bg-blue-100 text-blue-700', Completed: 'bg-teal-100 text-teal-700',
};

export default function SAEPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">SAE 管理</h1>
          <p className="text-sm text-gray-500 mt-1">严重不良事件上报与时限跟踪</p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center gap-2 text-red-600 mb-2"><AlertTriangle size={16} /><span className="text-sm font-medium">待上报</span></div>
          <p className="text-2xl font-bold text-gray-900">1</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center gap-2 text-green-600 mb-2"><CheckCircle size={16} /><span className="text-sm font-medium">已上报</span></div>
          <p className="text-2xl font-bold text-gray-900">1</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center gap-2 text-orange-600 mb-2"><Clock size={16} /><span className="text-sm font-medium">超时上报</span></div>
          <p className="text-2xl font-bold text-gray-900">1</p>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50/50">
              <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">AE编号</th>
              <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">SAE术语</th>
              <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">24h时限</th>
              <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">7d随访</th>
              <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">上报状态</th>
              <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">受试者</th>
              <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">项目</th>
            </tr>
          </thead>
          <tbody>
            {saeList.map((s) => (
              <tr key={s.id} className="border-b border-gray-50 hover:bg-gray-50/50">
                <td className="px-4 py-3 text-sm font-medium text-primary-600">{s.aeNo}</td>
                <td className="px-4 py-3 text-sm text-gray-900">{s.aeTerm}</td>
                <td className="px-4 py-3 text-xs text-gray-600">{s.saeDeadline24h}</td>
                <td className="px-4 py-3 text-xs text-gray-600">{s.saeDeadline7d}</td>
                <td className="px-4 py-3">
                  <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium', statusColors[s.reportStatus])}>{statusLabels[s.reportStatus]}</span>
                </td>
                <td className="px-4 py-3 text-sm text-primary-600">{s.subjectNo}</td>
                <td className="px-4 py-3 text-sm text-gray-600">{s.project}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
