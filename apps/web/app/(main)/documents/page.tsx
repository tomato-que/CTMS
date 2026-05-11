'use client';

import { FileText, Download, Eye, Upload } from 'lucide-react';
import { cn } from '@/lib/utils';

const documentCategories = ['01_项目管理文件', '02_伦理委员会文件', '03_研究者手册', '04_方案与修订', '05_知情同意书', '06_病例报告表', '07_安全性报告', '08_统计分析计划'];

const documents = [
  { title: '项目启动会纪要', category: '01_项目管理文件', version: 'v1.0', status: 'Approved', project: 'PMS-2024-001', uploadedBy: '管理员', date: '2024-01-20' },
  { title: '伦理批准通知', category: '02_伦理委员会文件', version: 'v1.0', status: 'Approved', project: 'PMS-2024-001', uploadedBy: '吴机构管理', date: '2024-02-15' },
  { title: '研究者手册 v2.0', category: '03_研究者手册', version: 'v2.0', status: 'Submitted', project: 'PMS-2024-002', uploadedBy: '管理员', date: '2024-03-10' },
  { title: '临床研究方案修正案1', category: '04_方案与修订', version: 'v1.1', status: 'Draft', project: 'PMS-2024-003', uploadedBy: '张经理', date: '2024-04-05' },
  { title: '知情同意书 v1.2', category: '05_知情同意书', version: 'v1.2', status: 'Approved', project: 'PMS-2024-004', uploadedBy: '吴机构管理', date: '2024-05-20' },
  { title: 'SAE初次报告', category: '07_安全性报告', version: 'v1.0', status: 'Submitted', project: 'PMS-2024-001', uploadedBy: '陈主任', date: '2025-04-22' },
];

const statusColors: Record<string, string> = {
  Draft: 'bg-gray-100 text-gray-600', Submitted: 'bg-yellow-100 text-yellow-700',
  Approved: 'bg-green-100 text-green-700', Rejected: 'bg-red-100 text-red-700',
  Archived: 'bg-purple-100 text-purple-700',
};
const statusLabels: Record<string, string> = {
  Draft: '草稿', Submitted: '已递交', Approved: '已批准', Rejected: '已驳回', Archived: '已归档',
};

export default function DocumentsPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">eTMF 文档管理</h1>
          <p className="text-sm text-gray-500 mt-1">临床试验主文件管理</p>
        </div>
        <button className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700">
          <Upload size={16} /> 上传文档
        </button>
      </div>

      {/* Category Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        {documentCategories.map((cat) => (
          <div key={cat} className="bg-white rounded-xl border border-gray-200 p-4 hover:border-primary-300 cursor-pointer transition-colors">
            <FileText size={20} className="text-primary-500 mb-2" />
            <p className="text-sm font-medium text-gray-900 line-clamp-2">{cat}</p>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50/50">
              <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">文档标题</th>
              <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">分类</th>
              <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">版本</th>
              <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">递交状态</th>
              <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">项目</th>
              <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">上传人</th>
              <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">日期</th>
              <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">操作</th>
            </tr>
          </thead>
          <tbody>
            {documents.map((doc, i) => (
              <tr key={i} className="border-b border-gray-50 hover:bg-gray-50/50">
                <td className="px-4 py-3 text-sm text-gray-900">{doc.title}</td>
                <td className="px-4 py-3 text-xs text-gray-500">{doc.category}</td>
                <td className="px-4 py-3 text-sm text-gray-600">{doc.version}</td>
                <td className="px-4 py-3">
                  <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium', statusColors[doc.status])}>{statusLabels[doc.status]}</span>
                </td>
                <td className="px-4 py-3 text-sm text-gray-600">{doc.project}</td>
                <td className="px-4 py-3 text-sm text-gray-600">{doc.uploadedBy}</td>
                <td className="px-4 py-3 text-sm text-gray-500">{doc.date}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-1">
                    <button className="p-1.5 rounded hover:bg-gray-100 text-gray-400"><Eye size={14} /></button>
                    <button className="p-1.5 rounded hover:bg-gray-100 text-gray-400"><Download size={14} /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
