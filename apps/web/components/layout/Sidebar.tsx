'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { useAppStore } from '@/lib/store';
import {
  LayoutDashboard, FolderKanban, Users, CalendarCheck,
  MessageSquareText, ShieldAlert, FolderOpen, BarChart3,
  Settings, ChevronLeft, ChevronRight, UserCog, Shield, Building2, ScrollText,
  ClipboardList, PencilRuler
} from 'lucide-react';

const mainItems = [
  { href: '/dashboard', label: '工作台', icon: LayoutDashboard },
  { href: '/projects', label: '项目管理', icon: FolderKanban },
  { href: '/subjects', label: '受试者全景', icon: Users },
  { href: '/visits/config', label: '随访计划', icon: CalendarCheck },
  { href: '/queries', label: 'Query管理', icon: MessageSquareText },
  { href: '/safety/ae', label: 'AE/SAE', icon: ShieldAlert },
  { href: '/documents', label: 'eTMF文档', icon: FolderOpen },
  { href: '/ecrf/tasks', label: 'eCRF管理', icon: ClipboardList },
  { href: '/reports', label: '报表分析', icon: BarChart3 },
];

const systemItems = [
  { href: '/system/users', label: '用户管理', icon: UserCog },
  { href: '/system/roles', label: '角色管理', icon: Shield },
  { href: '/system/sites', label: '中心管理', icon: Building2 },
  { href: '/system/audit-logs', label: '审计日志', icon: ScrollText },
];

export function Sidebar() {
  const pathname = usePathname();
  const { sidebarOpen } = useAppStore();

  return (
    <aside className={cn(
      'fixed left-0 top-0 z-40 h-screen bg-white border-r border-gray-100 transition-all duration-300 ease-in-out shadow-sm',
      sidebarOpen ? 'w-60' : 'w-16'
    )}>
      {/* Logo */}
      <div className="flex items-center h-16 px-4 border-b border-gray-100">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-600 to-purple-600 flex items-center justify-center flex-shrink-0 shadow-md shadow-indigo-200">
            <span className="text-white font-bold text-sm tracking-tight">CT</span>
          </div>
          {sidebarOpen && (
            <span className="font-bold text-gray-900 truncate text-base tracking-tight">CTMS</span>
          )}
        </div>
      </div>

      {/* Nav */}
      <nav className="p-3 space-y-4 overflow-y-auto" style={{ height: 'calc(100vh - 4rem)' }}>
        {/* Main menu */}
        <div>
          {sidebarOpen && <p className="px-3 mb-2 text-xs font-semibold text-gray-400 uppercase tracking-wider">主菜单</p>}
          <div className="space-y-0.5">
            {mainItems.map((item) => {
              const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
              return (
                <Link key={item.href} href={item.href}
                  className={cn(
                    'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200',
                    isActive
                      ? 'bg-indigo-50 text-indigo-700 shadow-sm'
                      : 'text-gray-500 hover:bg-gray-50 hover:text-gray-900'
                  )}
                  title={!sidebarOpen ? item.label : undefined}>
                  <item.icon size={20} className={cn('flex-shrink-0', isActive ? 'text-indigo-600' : 'text-gray-400')} />
                  {sidebarOpen && <span className="truncate">{item.label}</span>}
                </Link>
              );
            })}
          </div>
        </div>

        {/* System menu */}
        <div>
          {sidebarOpen && <p className="px-3 mb-2 text-xs font-semibold text-gray-400 uppercase tracking-wider">系统管理</p>}
          <div className="space-y-0.5">
            {systemItems.map((item) => {
              const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
              return (
                <Link key={item.href} href={item.href}
                  className={cn(
                    'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200',
                    isActive
                      ? 'bg-indigo-50 text-indigo-700 shadow-sm'
                      : 'text-gray-500 hover:bg-gray-50 hover:text-gray-900'
                  )}
                  title={!sidebarOpen ? item.label : undefined}>
                  <item.icon size={20} className={cn('flex-shrink-0', isActive ? 'text-indigo-600' : 'text-gray-400')} />
                  {sidebarOpen && <span className="truncate">{item.label}</span>}
                </Link>
              );
            })}
          </div>
        </div>
      </nav>
    </aside>
  );
}
