'use client';

import { useQuery } from '@tanstack/react-query';
import { BarChart3, Users, MessageSquareText, AlertTriangle, TrendingUp, Calendar, FileText, Activity } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';
import { cn } from '@/lib/utils';
import api from '@/lib/api';
import Link from 'next/link';

const quickLinks = [
  { href: '/projects', label: '项目管理', desc: '查看与管理临床研究', color: 'bg-indigo-50 text-indigo-600 hover:bg-indigo-100' },
  { href: '/subjects', label: '受试者全景', desc: '受试者管理与跟踪', color: 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100' },
  { href: '/queries', label: 'Query管理', desc: '数据质疑处理', color: 'bg-amber-50 text-amber-600 hover:bg-amber-100' },
  { href: '/safety/ae', label: 'AE/SAE', desc: '安全事件管理', color: 'bg-red-50 text-red-600 hover:bg-red-100' },
  { href: '/documents', label: 'eTMF文档', desc: '试验主文件管理', color: 'bg-purple-50 text-purple-600 hover:bg-purple-100' },
  { href: '/reports', label: '报表分析', desc: '数据分析与统计', color: 'bg-blue-50 text-blue-600 hover:bg-blue-100' },
];

export default function DashboardPage() {
  const { data: studies, isLoading } = useQuery({ queryKey: ['studies'], queryFn: () => api.get('/studies?size=50').then((r:any)=>r.data||[]) });
  const { data: reportData } = useQuery({ queryKey: ['rpt-summary'], queryFn: () => api.get('/reports/dashboard').then((r:any)=>r.data||{}) });
  const s = reportData?.summary || {};

  const statCards = [
    { label: '项目总数', value: s.totalStudies || studies?.length || 0, icon: BarChart3, gradient: 'stat-card-indigo', color: 'text-indigo-600', bg: 'bg-indigo-50' },
    { label: '进行中', value: s.activeStudies || 0, icon: TrendingUp, gradient: 'stat-card-green', color: 'text-emerald-600', bg: 'bg-emerald-50' },
    { label: '受试者总数', value: s.totalSubjects || 0, icon: Users, gradient: 'stat-card-purple', color: 'text-purple-600', bg: 'bg-purple-50' },
    { label: '本月新增受试者', value: s.subjectsThisMonth || 0, icon: Activity, gradient: 'stat-card-teal', color: 'text-teal-600', bg: 'bg-teal-50' },
    { label: '待处理Query', value: s.pendingQueries || 0, icon: MessageSquareText, gradient: 'stat-card-orange', color: 'text-amber-600', bg: 'bg-amber-50' },
    { label: '未关闭AE', value: s.openAes || 0, icon: AlertTriangle, gradient: 'stat-card-red', color: 'text-red-600', bg: 'bg-red-50' },
    { label: '逾期访视', value: s.overdueVisits || 0, icon: Calendar, gradient: 'stat-card-pink', color: 'text-pink-600', bg: 'bg-pink-50' },
    { label: 'eTMF完成率', value: (s.etmfCompletionRate || 0) + '%', icon: FileText, gradient: 'stat-card-blue', color: 'text-blue-600', bg: 'bg-blue-50' },
  ];

  const trend = (reportData?.enrollmentTrend || []).map((m:any) => ({ month: m.month, cnt: Number(m.cnt) }));
  const centers = (reportData?.centerRanking || []).map((m:any) => ({ name: m.centerName || '未知', cnt: Number(m.cnt) }));

  if (isLoading) return <div className="loading-container"><div className="w-8 h-8 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" /></div>;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Welcome */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-indigo-600 via-indigo-700 to-purple-700 p-8 text-white">
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -translate-y-1/3 translate-x-1/4" />
        <div className="absolute bottom-0 left-1/2 w-48 h-48 bg-white/5 rounded-full translate-y-1/3" />
        <div className="relative">
          <h1 className="text-2xl font-bold tracking-tight">临床研究管理系统</h1>
          <p className="text-indigo-200 mt-1.5 text-sm">欢迎回来，{new Date().toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' })}</p>
        </div>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
        {statCards.map((card, i) => (
          <div key={i} className={cn('stat-card', card.gradient, 'p-5')}>
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-medium text-gray-500">{card.label}</span>
              <div className={cn('w-9 h-9 rounded-xl flex items-center justify-center', card.bg)}>
                <card.icon size={16} className={card.color} />
              </div>
            </div>
            <div className="text-2xl font-bold text-gray-900 tracking-tight">{card.value}</div>
          </div>
        ))}
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="card p-5">
          <h3 className="font-semibold text-gray-900 mb-4 text-sm">受试者入组趋势</h3>
          {trend.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-gray-400">
              <TrendingUp size={32} className="mb-2" /><p className="text-xs">暂无入组数据</p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={trend}>
                <defs><linearGradient id="lineGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#4F46E5" stopOpacity={0.3} /><stop offset="100%" stopColor="#4F46E5" stopOpacity={0} /></linearGradient></defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#94A3B8' }} axisLine={{ stroke: '#E2E8F0' }} />
                <YAxis tick={{ fontSize: 11, fill: '#94A3B8' }} axisLine={{ stroke: '#E2E8F0' }} />
                <Tooltip contentStyle={{ borderRadius: 12, border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.08)' }} />
                <Line type="monotone" dataKey="cnt" stroke="#4F46E5" strokeWidth={2.5} dot={{ r: 3, fill: '#4F46E5', strokeWidth: 0 }} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
        <div className="card p-5">
          <h3 className="font-semibold text-gray-900 mb-4 text-sm">各中心入组排行</h3>
          {centers.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-gray-400">
              <BarChart3 size={32} className="mb-2" /><p className="text-xs">暂无中心数据</p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={centers} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
                <XAxis type="number" tick={{ fontSize: 11, fill: '#94A3B8' }} />
                <YAxis type="category" dataKey="name" width={100} tick={{ fontSize: 11, fill: '#64748B' }} />
                <Tooltip contentStyle={{ borderRadius: 12, border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.08)' }} />
                <Bar dataKey="cnt" fill="#4F46E5" radius={[0, 6, 6, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Quick Links */}
      <div className="card p-5">
        <h3 className="font-semibold text-gray-900 mb-3 text-sm">快捷入口</h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {quickLinks.map((link) => (
            <Link key={link.href} href={link.href}
              className={cn('rounded-xl p-4 transition-all duration-200 hover:scale-[1.02]', link.color)}>
              <p className="text-sm font-semibold">{link.label}</p>
              <p className="text-xs mt-1 opacity-70">{link.desc}</p>
            </Link>
          ))}
        </div>
      </div>

      {/* Recent Projects */}
      <div className="card overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
          <h3 className="font-semibold text-sm text-gray-900">近期项目</h3>
          <Link href="/projects" className="text-xs text-indigo-600 hover:underline font-medium">查看全部</Link>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="table-header">
              <tr><th>项目编号</th><th>项目名称</th><th className="w-20">分期</th><th className="w-20">状态</th><th className="w-20">计划入组</th></tr>
            </thead>
            <tbody>
              {(studies || []).slice(0, 5).map((s: any) => (
                <tr key={s.id} className="table-row">
                  <td className="table-cell font-medium text-gray-900">{s.studyCode}</td>
                  <td className="table-cell text-gray-700 max-w-xs truncate">{s.title}</td>
                  <td className="table-cell text-gray-600">{s.phase}</td>
                  <td className="table-cell">
                    <span className={cn('badge', s.status === 'ENROLLING' ? 'badge-success' : s.status === 'DRAFT' ? 'badge-gray' : s.status === 'STARTUP' ? 'badge-info' : 'badge-purple')}>
                      {s.status === 'ENROLLING' ? '入组中' : s.status === 'DRAFT' ? '草稿' : s.status === 'STARTUP' ? '启动中' : s.status}
                    </span>
                  </td>
                  <td className="table-cell text-gray-600">{s.plannedSubjects || '-'}</td>
                </tr>
              ))}
              {(studies || []).length === 0 && <tr><td colSpan={5} className="text-center py-12 text-gray-400 text-sm">暂无项目</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
