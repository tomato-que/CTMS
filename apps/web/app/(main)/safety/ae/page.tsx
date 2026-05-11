'use client';

import { useState } from 'react';
import { Search } from 'lucide-react';
import { cn } from '@/lib/utils';

const aeList = [
  { id: '1', aeNo: 'AE-0001', aeTerm: 'ALT升高', severity: 'Moderate', seriousness: 'NonSerious', causality: 'Possible', onsetDate: '2025-04-15', subjectNo: 'SUB-001-001', project: 'PMS-2024-001', isSae: false, outcome: 'Recovered' },
  { id: '2', aeNo: 'AE-0002', aeTerm: '高血压', severity: 'Severe', seriousness: 'Hospitalization', causality: 'Probable', onsetDate: '2025-04-20', subjectNo: 'SUB-002-005', project: 'PMS-2024-002', isSae: true, outcome: 'Recovering', saeDeadline: '2025-04-21' },
  { id: '3', aeNo: 'AE-0003', aeTerm: '肺炎', severity: 'Severe', seriousness: 'LifeThreatening', causality: 'Possible', onsetDate: '2025-05-01', subjectNo: 'SUB-003-012', project: 'PMS-2024-003', isSae: true, outcome: 'NotRecovered', saeDeadline: '2025-05-02' },
  { id: '4', aeNo: 'AE-0004', aeTerm: '头痛', severity: 'Mild', seriousness: 'NonSerious', causality: 'Unlikely', onsetDate: '2025-05-05', subjectNo: 'SUB-001-010', project: 'PMS-2024-001', isSae: false, outcome: 'Recovered' },
  { id: '5', aeNo: 'AE-0005', aeTerm: '皮疹', severity: 'Mild', seriousness: 'NonSerious', causality: 'Probable', onsetDate: '2025-05-08', subjectNo: 'SUB-002-015', project: 'PMS-2024-002', isSae: false, outcome: 'Recovering' },
];

const severityColors: Record<string, string> = { Mild: 'bg-green-100 text-green-700', Moderate: 'bg-yellow-100 text-yellow-700', Severe: 'bg-orange-100 text-orange-700', LifeThreatening: 'bg-red-100 text-red-700' };
const causalityLabels: Record<string, string> = { Unrelated: '无关', Unlikely: '可能无关', Possible: '可能有关', Probable: '很可能有关', Definite: '确定有关' };
const outcomeLabels: Record<string, string> = { Recovered: '已恢复', Recovering: '恢复中', NotRecovered: '未恢复', RecoveredWithSequelae: '有后遗症', Fatal: '死亡', Unknown: '未知' };

export default function AEPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">不良事件 AE</h1>
          <p className="text-sm text-gray-500 mt-1">不良事件登记与管理</p>
        </div>
        <button className="px-4 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700">
          + 新增AE
        </button>
      </div>

      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2 px-3 py-2 bg-white border border-gray-200 rounded-lg w-64">
          <Search size={16} className="text-gray-400" />
          <input type="text" placeholder="搜索AE..." className="bg-transparent border-none outline-none text-sm w-full" />
        </div>
        <div className="flex bg-gray-100 rounded-lg p-0.5">
          <button className="px-3 py-1 text-xs bg-white shadow rounded-md font-medium">全部</button>
          <button className="px-3 py-1 text-xs text-gray-500 rounded-md">AE</button>
          <button className="px-3 py-1 text-xs text-gray-500 rounded-md">SAE</button>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/50">
                <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">AE编号</th>
                <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">AE术语</th>
                <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">严重程度</th>
                <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">SAE</th>
                <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">相关性</th>
                <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">发生日期</th>
                <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">转归</th>
                <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">受试者</th>
                <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">项目</th>
              </tr>
            </thead>
            <tbody>
              {aeList.map((ae) => (
                <tr key={ae.id} className="border-b border-gray-50 hover:bg-gray-50/50">
                  <td className="px-4 py-3 text-sm font-medium text-primary-600">{ae.aeNo}</td>
                  <td className="px-4 py-3 text-sm text-gray-700">{ae.aeTerm}</td>
                  <td className="px-4 py-3">
                    <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium', severityColors[ae.severity])}>
                      {ae.severity === 'Mild' ? '轻度' : ae.severity === 'Moderate' ? '中度' : ae.severity === 'Severe' ? '重度' : '危及生命'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {ae.isSae ? <span className="text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-700 font-medium">是</span>
                      : <span className="text-xs text-gray-400">否</span>}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">{causalityLabels[ae.causality]}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">{ae.onsetDate}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">{outcomeLabels[ae.outcome]}</td>
                  <td className="px-4 py-3 text-sm text-primary-600">{ae.subjectNo}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">{ae.project}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
