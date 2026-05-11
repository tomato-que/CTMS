'use client';

import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Calendar, FileText, Shield, Edit } from 'lucide-react';
import Link from 'next/link';

export default function SubjectDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const tabs = [
    { key: 'overview', label: '基本信息', icon: FileText },
    { key: 'visits', label: '访视记录', icon: Calendar },
    { key: 'aes', label: '不良事件', icon: Shield },
    { key: 'queries', label: 'Query', icon: Edit },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <button onClick={() => router.back()} className="p-2 rounded-lg hover:bg-gray-100">
          <ArrowLeft size={18} />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">受试者 #{id}</h1>
          <p className="text-sm text-gray-500">受试者详细信息与访视记录</p>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: '状态', value: '研究中', color: 'text-green-600' },
          { label: '中心', value: '北京协和医院', color: 'text-gray-900' },
          { label: '入组日期', value: '2024-03-15', color: 'text-gray-900' },
          { label: '当前访视', value: 'V3', color: 'text-gray-900' },
        ].map((item, i) => (
          <div key={i} className="bg-white rounded-xl border border-gray-200 p-4">
            <p className="text-xs text-gray-500">{item.label}</p>
            <p className={`text-lg font-bold mt-1 ${item.color}`}>{item.value}</p>
          </div>
        ))}
      </div>

      <div className="flex gap-2 border-b border-gray-200 pb-2">
        {tabs.map((tab) => (
          <button key={tab.key}
            className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-primary-600 transition-colors">
            <tab.icon size={14} className="inline mr-1" />{tab.label}
          </button>
        ))}
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-6 text-center text-gray-400">
        受试者 ID: {id} — 详细访视数据加载中...
      </div>
    </div>
  );
}
