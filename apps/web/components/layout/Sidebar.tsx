'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { useAppStore } from '@/lib/store';
import {
  LayoutDashboard, FolderKanban, BarChart3, Users, CalendarCheck,
  MessageSquareText, ShieldAlert, FolderOpen, FileText,
  Settings, ChevronLeft, ChevronRight
} from 'lucide-react';

const menuItems = [
  { href: '/dashboard', label: '工作台', icon: LayoutDashboard },
  { href: '/projects', label: '项目管理', icon: FolderKanban },
  { href: '/subjects', label: '受试者全景', icon: Users },
  { href: '/visits/config', label: '随访计划', icon: CalendarCheck },
  { href: '/queries', label: 'Query管理', icon: MessageSquareText },
  { href: '/safety/ae', label: 'AE/SAE', icon: ShieldAlert },
  { href: '/documents', label: 'eTMF文档', icon: FolderOpen },
  { href: '/reports', label: '报表分析', icon: FileText },
  { href: '/system/users', label: '系统管理', icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();
  const { sidebarOpen, toggleSidebar } = useAppStore();

  return (
    <aside
      className={cn(
        'fixed left-0 top-0 z-40 h-screen bg-white border-r border-gray-200 transition-all duration-200',
        sidebarOpen ? 'w-60' : 'w-16'
      )}
    >
      {/* Logo */}
      <div className="flex items-center h-16 px-4 border-b border-gray-200">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-primary-600 flex items-center justify-center flex-shrink-0">
            <span className="text-white font-bold text-sm">CT</span>
          </div>
          {sidebarOpen && (
            <span className="font-semibold text-gray-900 truncate text-sm">CTMS</span>
          )}
        </div>
        <button
          onClick={toggleSidebar}
          className="ml-auto p-1 rounded-md hover:bg-gray-100 flex-shrink-0 hidden lg:block"
        >
          {sidebarOpen ? <ChevronLeft size={18} /> : <ChevronRight size={18} />}
        </button>
      </div>

      {/* Nav */}
      <nav className="p-3 space-y-1 overflow-y-auto" style={{ height: 'calc(100vh - 4rem)' }}>
        {menuItems.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                isActive
                  ? 'bg-primary-50 text-primary-700'
                  : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
              )}
              title={!sidebarOpen ? item.label : undefined}
            >
              <Icon size={20} className="flex-shrink-0" />
              {sidebarOpen && <span className="truncate">{item.label}</span>}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
