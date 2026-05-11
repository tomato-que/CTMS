'use client';

import { useState } from 'react';
import { useAppStore } from '@/lib/store';
import { Bell, Search, User, LogOut, Menu } from 'lucide-react';
import { cn } from '@/lib/utils';

export function Header() {
  const { user, logout, toggleSidebar } = useAppStore();
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);

  return (
    <header className="sticky top-0 z-30 h-16 bg-white border-b border-gray-200 flex items-center justify-between px-4 lg:px-6">
      {/* Left */}
      <div className="flex items-center gap-4">
        <button
          onClick={toggleSidebar}
          className="p-2 rounded-lg hover:bg-gray-100 lg:hidden"
        >
          <Menu size={20} />
        </button>
        <div className="hidden sm:flex items-center gap-2 px-3 py-2 bg-gray-50 rounded-lg border border-gray-200 w-64">
          <Search size={16} className="text-gray-400" />
          <input
            type="text"
            placeholder="搜索项目、受试者..."
            className="bg-transparent border-none outline-none text-sm text-gray-600 w-full placeholder:text-gray-400"
          />
          <kbd className="hidden lg:inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-gray-200 text-xs text-gray-500">
            ⌘K
          </kbd>
        </div>
      </div>

      {/* Right */}
      <div className="flex items-center gap-2">
        {/* Notifications */}
        <div className="relative">
          <button
            onClick={() => setShowNotifications(!showNotifications)}
            className="relative p-2 rounded-lg hover:bg-gray-100"
          >
            <Bell size={20} className="text-gray-500" />
            <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full" />
          </button>

          {showNotifications && (
            <div className="absolute right-0 top-12 w-80 bg-white rounded-xl shadow-lg border border-gray-200 p-4 z-50">
              <h3 className="font-semibold text-sm text-gray-900 mb-3">通知</h3>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {[
                  { title: 'Query指派提醒', desc: '新的数据质疑已分配给您', time: '5分钟前', type: 'query' },
                  { title: 'SAE上报提醒', desc: '24小时初次上报即将到期', time: '30分钟前', type: 'sae' },
                  { title: '访视超窗预警', desc: '受试者SUB-001访视已超窗', time: '1小时前', type: 'visit' },
                  { title: '里程碑到期', desc: '项目中期评估7天后到期', time: '2小时前', type: 'milestone' },
                ].map((n, i) => (
                  <div key={i} className="flex gap-3 p-2 rounded-lg hover:bg-gray-50 cursor-pointer">
                    <div className={cn(
                      'w-2 h-2 rounded-full mt-1.5 flex-shrink-0',
                      n.type === 'query' && 'bg-orange-500',
                      n.type === 'sae' && 'bg-red-500',
                      n.type === 'visit' && 'bg-yellow-500',
                      n.type === 'milestone' && 'bg-blue-500',
                    )} />
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-900">{n.title}</p>
                      <p className="text-xs text-gray-500 truncate">{n.desc}</p>
                      <p className="text-xs text-gray-400 mt-0.5">{n.time}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* User menu */}
        <div className="relative">
          <button
            onClick={() => setShowUserMenu(!showUserMenu)}
            className="flex items-center gap-2 p-2 rounded-lg hover:bg-gray-100"
          >
            <div className="w-8 h-8 rounded-full bg-primary-100 flex items-center justify-center">
              <User size={16} className="text-primary-600" />
            </div>
            <span className="hidden sm:block text-sm font-medium text-gray-700">
              {user?.realName || '管理员'}
            </span>
          </button>

          {showUserMenu && (
            <div className="absolute right-0 top-12 w-48 bg-white rounded-xl shadow-lg border border-gray-200 py-1 z-50">
              <div className="px-4 py-2 border-b border-gray-100">
                <p className="text-sm font-medium text-gray-900">{user?.realName}</p>
                <p className="text-xs text-gray-500">{user?.role?.name}</p>
              </div>
              <button
                className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                onClick={() => setShowUserMenu(false)}
              >
                个人设置 (待开放)
              </button>
              <button
                onClick={logout}
                className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
              >
                <LogOut size={14} />
                退出登录
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
