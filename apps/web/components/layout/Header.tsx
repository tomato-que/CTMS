'use client';

import { useState } from 'react';
import { useAppStore } from '@/lib/store';
import { Bell, Search, User, LogOut, Menu, ChevronDown, UserCog, HelpCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

export function Header() {
  const { user, logout, toggleSidebar } = useAppStore();
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);

  return (
    <header className="sticky top-0 z-30 h-16 bg-white/80 backdrop-blur-md border-b border-gray-100 flex items-center justify-between px-4 lg:px-6">
      {/* Left */}
      <div className="flex items-center gap-4">
        <button onClick={toggleSidebar} className="p-2 rounded-lg hover:bg-gray-100 lg:hidden transition-colors">
          <Menu size={20} className="text-gray-500" />
        </button>
        <div className="hidden sm:flex items-center gap-2.5 px-3.5 py-2 bg-gray-50/80 rounded-xl border border-gray-200/60 w-72 transition-all focus-within:bg-white focus-within:border-indigo-200 focus-within:ring-2 focus-within:ring-indigo-500/10">
          <Search size={15} className="text-gray-400 flex-shrink-0" />
          <input type="text" placeholder="搜索项目、受试者..." className="bg-transparent border-none outline-none text-sm text-gray-600 w-full placeholder:text-gray-400" />
          <kbd className="hidden lg:inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md bg-gray-200/80 text-[10px] font-medium text-gray-500 font-mono">⌘K</kbd>
        </div>
      </div>

      {/* Right */}
      <div className="flex items-center gap-1">
        {/* Notifications */}
        <div className="relative">
          <button onClick={() => setShowNotifications(!showNotifications)}
            className="relative p-2.5 rounded-xl hover:bg-gray-100 transition-colors">
            <Bell size={18} className="text-gray-500" />
            <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full ring-2 ring-white" />
          </button>
          {showNotifications && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setShowNotifications(false)} />
              <div className="absolute right-0 top-12 w-80 bg-white rounded-2xl shadow-dropdown border border-gray-100 p-4 z-50 animate-fade-in">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-semibold text-sm text-gray-900">通知中心</h3>
                  <span className="text-xs text-indigo-600 font-medium cursor-pointer hover:underline">全部已读</span>
                </div>
                <div className="space-y-1 max-h-72 overflow-y-auto">
                  {[
                    { title: 'Query指派提醒', desc: '新的数据质疑已分配给您', time: '5分钟前', type: 'query' },
                    { title: 'SAE上报提醒', desc: '24小时初次上报即将到期', time: '30分钟前', type: 'sae' },
                    { title: '访视超窗预警', desc: '受试者SUB-001访视已超窗', time: '1小时前', type: 'visit' },
                    { title: '里程碑到期', desc: '项目中期评估7天后到期', time: '2小时前', type: 'milestone' },
                  ].map((n, i) => (
                    <div key={i} className="flex gap-3 p-2.5 rounded-xl hover:bg-gray-50 cursor-pointer transition-colors">
                      <div className={cn('w-2 h-2 rounded-full mt-1.5 flex-shrink-0',
                        n.type === 'query' && 'bg-orange-500', n.type === 'sae' && 'bg-red-500',
                        n.type === 'visit' && 'bg-yellow-500', n.type === 'milestone' && 'bg-blue-500')} />
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-900">{n.title}</p>
                        <p className="text-xs text-gray-500 truncate mt-0.5">{n.desc}</p>
                        <p className="text-xs text-gray-400 mt-1">{n.time}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>

        {/* User menu */}
        <div className="relative">
          <button onClick={() => setShowUserMenu(!showUserMenu)}
            className="flex items-center gap-2.5 p-2 rounded-xl hover:bg-gray-100 transition-colors">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center shadow-sm">
              <span className="text-white text-xs font-bold">{user?.realName?.[0] || 'A'}</span>
            </div>
            <span className="hidden sm:block text-sm font-semibold text-gray-700">{user?.realName || '管理员'}</span>
            <ChevronDown size={14} className="hidden sm:block text-gray-400" />
          </button>

          {showUserMenu && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setShowUserMenu(false)} />
              <div className="absolute right-0 top-12 w-56 bg-white rounded-2xl shadow-dropdown border border-gray-100 py-1.5 z-50 animate-fade-in">
                <div className="px-4 py-3 border-b border-gray-100">
                  <p className="text-sm font-semibold text-gray-900">{user?.realName || '管理员'}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{user?.role?.name || '系统管理员'}</p>
                </div>
                <button className="w-full text-left px-4 py-2.5 text-sm text-gray-600 hover:bg-gray-50 flex items-center gap-2.5 transition-colors">
                  <UserCog size={15} /> 个人设置
                </button>
                <button className="w-full text-left px-4 py-2.5 text-sm text-gray-600 hover:bg-gray-50 flex items-center gap-2.5 transition-colors">
                  <HelpCircle size={15} /> 帮助中心
                </button>
                <div className="border-t border-gray-100 mt-1 pt-1">
                  <button onClick={logout}
                    className="w-full text-left px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2.5 transition-colors font-medium">
                    <LogOut size={15} /> 退出登录
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
