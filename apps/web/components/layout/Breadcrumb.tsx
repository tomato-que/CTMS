'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ChevronRight, Home } from 'lucide-react';

const pathLabels: Record<string, string> = {
  dashboard: '工作台',
  projects: '项目管理',
  subjects: '受试者全景',
  visits: '随访计划',
  config: '方案配置',
  queries: 'Query管理',
  safety: '安全性管理',
  ae: '不良事件',
  sae: '严重不良事件',
  documents: 'eTMF文档',
  reports: '报表分析',
  system: '系统管理',
  users: '用户管理',
  roles: '角色管理',
  sites: '中心管理',
  'audit-logs': '审计日志',
  statistics: '统计分析',
  progress: '项目进度',
};

export function Breadcrumb() {
  const pathname = usePathname();
  const segments = pathname.split('/').filter(Boolean);

  return (
    <nav className="flex items-center gap-1.5 text-sm text-gray-500 px-6 py-3">
      <Link href="/dashboard" className="hover:text-gray-700">
        <Home size={14} />
      </Link>
      {segments.map((seg, i) => {
        const href = '/' + segments.slice(0, i + 1).join('/');
        const label = pathLabels[seg] || seg;
        const isLast = i === segments.length - 1;

        return (
          <span key={seg} className="flex items-center gap-1.5">
            <ChevronRight size={12} />
            {isLast ? (
              <span className="text-gray-900 font-medium">{label}</span>
            ) : (
              <Link href={href} className="hover:text-gray-700">{label}</Link>
            )}
          </span>
        );
      })}
    </nav>
  );
}
