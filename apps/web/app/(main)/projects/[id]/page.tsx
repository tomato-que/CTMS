'use client';

import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Edit, Users, FileText, Shield, BarChart3 } from 'lucide-react';
import Link from 'next/link';

const mockProject = {
  id: '1', projectNo: 'PMS-2024-001', title: '瑞格非尼治疗晚期肝细胞癌的多中心临床研究',
  type: 'GCP', phase: 'III期', status: 'Active', riskLevel: 'Medium',
  progress: 72, planned: 200, actual: 178, startDate: '2024-01-15', endDate: '2025-06-30',
  owner: '张经理', leadSite: '北京协和医院', croName: '昆泰医药', indication: '肝细胞癌',
};

const tabs = [
  { key: 'overview', label: '项目概览', icon: BarChart3 },
  { key: 'sites', label: '中心管理', icon: Users },
  { key: 'subjects', label: '受试者', icon: Users },
  { key: 'documents', label: '文档', icon: FileText },
  { key: 'safety', label: '安全性', icon: Shield },
  { key: 'queries', label: 'Query', icon: Edit },
];

export default function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <button onClick={() => router.back()} className="p-2 rounded-lg hover:bg-gray-100">
          <ArrowLeft size={18} />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{mockProject.projectNo}</h1>
          <p className="text-sm text-gray-500">{mockProject.title}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-xs text-gray-500">项目状态</p>
          <p className="text-lg font-bold text-green-600 mt-1">进行中</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-xs text-gray-500">牵头中心</p>
          <p className="text-lg font-bold text-gray-900 mt-1">{mockProject.leadSite}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-xs text-gray-500">入组进度</p>
          <p className="text-lg font-bold text-gray-900 mt-1">{mockProject.actual}/{mockProject.planned}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-xs text-gray-500">风险等级</p>
          <p className="text-lg font-bold text-orange-600 mt-1">中风险</p>
        </div>
      </div>

      <div className="flex gap-2 border-b border-gray-200 pb-2">
        {tabs.map((tab) => (
          <button key={tab.key}
            className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-primary-600 hover:border-b-2 hover:border-primary-600 transition-colors">
            <tab.icon size={14} className="inline mr-1" />{tab.label}
          </button>
        ))}
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-6 text-center text-gray-400">
        项目 ID: {id} — 详细数据加载中...
      </div>
    </div>
  );
}
