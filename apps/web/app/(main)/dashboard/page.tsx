'use client';

import { useState } from 'react';
import {
  BarChart3, Users, MessageSquareText, AlertTriangle,
  TrendingUp, TrendingDown, Calendar, FileText,
  ArrowUpRight, ArrowDownRight, CheckCircle2, Clock, AlertCircle
} from 'lucide-react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, Legend
} from 'recharts';
import { cn } from '@/lib/utils';

// ─── Types ────────────────────────────────────────────────────────────────────

interface MetricCard {
  label: string;
  value: number;
  unit: string;
  change: string;
  up: boolean;
  icon: React.ComponentType<any>;
  color: string;
  bg: string;
}

interface TrendPoint {
  month: string;
  cumulative: number;
  monthly: number;
}

interface StageItem {
  name: string;
  value: number;
  color: string;
}

interface MilestoneItem {
  id: string;
  projectNo: string;
  projectTitle: string;
  name: string;
  date: string;
  status: 'Completed' | 'InProgress' | 'NotStarted';
}

interface ProjectRow {
  projectNo: string;
  title: string;
  owner: string;
  startDate: string;
  endDate: string;
  progress: number;
  riskLevel: string;
  enrolled: number;
  planned: number;
}

interface NotificationItem {
  id: string;
  title: string;
  content: string;
  time: string;
  type: string;
}

// ─── Mock Data (empty by default, API-ready) ──────────────────────────────────

const metricsData: MetricCard[] = [
  { label: '活跃项目', value: 0, unit: '个', change: '-', up: true, icon: BarChart3, color: 'text-blue-600', bg: 'bg-blue-50' },
  { label: '累计入组', value: 0, unit: '人', change: '-', up: true, icon: Users, color: 'text-green-600', bg: 'bg-green-50' },
  { label: '待复核Query', value: 0, unit: '条', change: '-', up: false, icon: MessageSquareText, color: 'text-orange-600', bg: 'bg-orange-50' },
  { label: 'SAE', value: 0, unit: '例', change: '-', up: false, icon: AlertTriangle, color: 'text-red-600', bg: 'bg-red-50' },
];

// ─── Status helpers ───────────────────────────────────────────────────────────

const riskColorMap: Record<string, string> = {
  Low: 'bg-green-100 text-green-700', Medium: 'bg-yellow-100 text-yellow-700',
  High: 'bg-orange-100 text-orange-700', Critical: 'bg-red-100 text-red-700',
};

const statusIconMap: Record<string, React.ComponentType<any>> = {
  Completed: CheckCircle2, InProgress: Clock, NotStarted: AlertCircle,
};

// ─── Empty State Component ────────────────────────────────────────────────────

function EmptyState({ icon: Icon, title, description }: { icon: React.ComponentType<any>; title: string; description: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <Icon size={40} className="text-gray-300 mb-3" />
      <p className="text-sm font-medium text-gray-500">{title}</p>
      <p className="text-xs text-gray-400 mt-1">{description}</p>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function DashboardPage() {
  const [showCumulative, setShowCumulative] = useState(true);
  const [enrollmentTrend] = useState<TrendPoint[]>([]);
  const [stageData] = useState<StageItem[]>([]);
  const [milestones] = useState<MilestoneItem[]>([]);
  const [topProjects] = useState<ProjectRow[]>([]);
  const [notifications] = useState<NotificationItem[]>([]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">工作台</h1>
          <p className="text-sm text-gray-500 mt-1">欢迎回来</p>
        </div>
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <Calendar size={16} />
          <span>{new Date().toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' })}</span>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {metricsData.map((metric, i) => (
          <div key={i} className="bg-white rounded-xl border border-gray-200 p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm text-gray-500">{metric.label}</span>
              <div className={cn('w-9 h-9 rounded-lg flex items-center justify-center', metric.bg)}>
                <metric.icon size={18} className={metric.color} />
              </div>
            </div>
            <div className="flex items-end gap-2">
              <span className="text-2xl font-bold text-gray-900">{metric.value.toLocaleString()}</span>
              <span className="text-sm text-gray-500 mb-0.5">{metric.unit}</span>
            </div>
            <div className={cn('flex items-center gap-1 mt-2 text-xs', metric.change.startsWith('+') ? 'text-green-600' : 'text-gray-400')}>
              <span>{metric.change}</span>
              <span className="text-gray-400 ml-1">较上月</span>
            </div>
          </div>
        ))}
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Enrollment Trend */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-900">受试者入组趋势</h3>
            <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-0.5">
              <button onClick={() => setShowCumulative(true)} className={cn('px-3 py-1 text-xs rounded-md transition-colors', showCumulative ? 'bg-white shadow text-gray-900' : 'text-gray-500')}>累计</button>
              <button onClick={() => setShowCumulative(false)} className={cn('px-3 py-1 text-xs rounded-md transition-colors', !showCumulative ? 'bg-white shadow text-gray-900' : 'text-gray-500')}>月增</button>
            </div>
          </div>
          {enrollmentTrend.length > 0 ? (
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={enrollmentTrend}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
                <XAxis dataKey="month" tick={{ fontSize: 12, fill: '#94A3B8' }} />
                <YAxis tick={{ fontSize: 12, fill: '#94A3B8' }} />
                <Tooltip />
                <Line type="monotone" dataKey={showCumulative ? 'cumulative' : 'monthly'} stroke="#2563EB" strokeWidth={2} dot={{ r: 4, fill: '#2563EB' }} />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <EmptyState icon={TrendingUp} title="暂无入组数据" description="创建项目并录入受试者后将在此显示入组趋势" />
          )}
        </div>

        {/* Stage Distribution */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="font-semibold text-gray-900 mb-4">项目阶段分布</h3>
          {stageData.length > 0 ? (
            <>
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie data={stageData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={4} dataKey="value">
                    {stageData.map((entry, i) => (<Cell key={i} fill={entry.color} />))}
                  </Pie>
                  <Legend layout="vertical" align="right" verticalAlign="middle" iconType="circle" iconSize={8} formatter={(value) => <span className="text-xs text-gray-600">{value}</span>} />
                </PieChart>
              </ResponsiveContainer>
              <div className="grid grid-cols-2 gap-2 mt-2">
                {stageData.map((s) => (
                  <div key={s.name} className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: s.color }} />
                    <span className="text-xs text-gray-500">{s.name}</span>
                    <span className="text-xs font-medium text-gray-900 ml-auto">{s.value}</span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <EmptyState icon={BarChart3} title="暂无项目" description="创建项目后将在此显示阶段分布" />
          )}
        </div>
      </div>

      {/* Milestones + Notifications */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Milestones */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-900">项目里程碑</h3>
          </div>
          {milestones.length > 0 ? (
            <div className="relative">
              <div className="absolute left-[15px] top-2 bottom-2 w-0.5 bg-gray-100" />
              <div className="space-y-4">
                {milestones.map((m) => {
                  const Icon = statusIconMap[m.status] || Clock;
                  const isCompleted = m.status === 'Completed';
                  return (
                    <div key={m.id} className="flex gap-4 relative">
                      <div className={cn('relative z-10 w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0', isCompleted ? 'bg-green-100' : m.status === 'InProgress' ? 'bg-blue-100' : 'bg-gray-100')}>
                        <Icon size={14} className={cn(isCompleted ? 'text-green-600' : m.status === 'InProgress' ? 'text-blue-600' : 'text-gray-400')} />
                      </div>
                      <div className="min-w-0 pb-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-medium text-gray-900">{m.name}</span>
                          <span className={cn('text-xs px-1.5 py-0.5 rounded', isCompleted ? 'bg-green-50 text-green-600' : m.status === 'InProgress' ? 'bg-blue-50 text-blue-600' : 'bg-gray-50 text-gray-500')}>
                            {m.status === 'Completed' ? '已完成' : m.status === 'InProgress' ? '进行中' : '未开始'}
                          </span>
                        </div>
                        <p className="text-xs text-gray-400 mt-0.5">{m.projectNo} · {m.projectTitle} · {m.date}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <EmptyState icon={Clock} title="暂无里程碑" description="为项目配置里程碑后将在此显示进度" />
          )}
        </div>

        {/* Notifications */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="font-semibold text-gray-900 mb-4">通知提醒</h3>
          {notifications.length > 0 ? (
            <div className="space-y-3">
              {notifications.map((n) => (
                <div key={n.id} className="flex gap-3 p-2.5 rounded-lg hover:bg-gray-50 cursor-pointer transition-colors">
                  <div className={cn('w-2 h-2 rounded-full mt-1.5 flex-shrink-0', n.type === 'QueryAssigned' && 'bg-orange-400', n.type === 'SaeReportDue' && 'bg-red-400', n.type === 'VisitOverdue' && 'bg-yellow-400', n.type === 'MilestoneDue' && 'bg-blue-400')} />
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{n.title}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{n.content}</p>
                    <p className="text-xs text-gray-400 mt-1">{n.time}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState icon={AlertCircle} title="暂无通知" description="系统通知将在此显示" />
          )}
        </div>
      </div>

      {/* Top Projects */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-gray-900">重点项目进度</h3>
        </div>
        {topProjects.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left text-xs font-medium text-gray-500 pb-3 pr-4">项目编号</th>
                  <th className="text-left text-xs font-medium text-gray-500 pb-3 pr-4">项目名称</th>
                  <th className="text-left text-xs font-medium text-gray-500 pb-3 pr-4">负责人</th>
                  <th className="text-left text-xs font-medium text-gray-500 pb-3 pr-4">起止时间</th>
                  <th className="text-left text-xs font-medium text-gray-500 pb-3 pr-4">进度</th>
                  <th className="text-left text-xs font-medium text-gray-500 pb-3 pr-4">风险</th>
                  <th className="text-left text-xs font-medium text-gray-500 pb-3">入组</th>
                </tr>
              </thead>
              <tbody>
                {topProjects.map((p) => (
                  <tr key={p.projectNo} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
                    <td className="py-3 pr-4"><span className="text-sm font-medium text-gray-900">{p.projectNo}</span></td>
                    <td className="py-3 pr-4"><span className="text-sm text-gray-700 line-clamp-1 max-w-56">{p.title}</span></td>
                    <td className="py-3 pr-4"><span className="text-sm text-gray-600">{p.owner}</span></td>
                    <td className="py-3 pr-4"><span className="text-xs text-gray-500">{p.startDate} ~ {p.endDate}</span></td>
                    <td className="py-3 pr-4">
                      <div className="flex items-center gap-2 min-w-[120px]">
                        <div className="w-20 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                          <div className={cn('h-full rounded-full', p.progress >= 80 ? 'bg-green-500' : p.progress >= 50 ? 'bg-blue-500' : p.progress >= 30 ? 'bg-yellow-500' : 'bg-gray-400')} style={{ width: `${p.progress}%` }} />
                        </div>
                        <span className="text-xs font-medium text-gray-600">{p.progress}%</span>
                      </div>
                    </td>
                    <td className="py-3 pr-4"><span className={cn('text-xs px-2 py-0.5 rounded-full font-medium', riskColorMap[p.riskLevel])}>{p.riskLevel === 'Low' ? '低' : p.riskLevel === 'Medium' ? '中' : p.riskLevel === 'High' ? '高' : '严重'}</span></td>
                    <td className="py-3"><span className="text-sm text-gray-600">{p.enrolled}/{p.planned}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState icon={BarChart3} title="暂无项目" description="点击右上角新建项目开始管理临床研究" />
        )}
      </div>
    </div>
  );
}
