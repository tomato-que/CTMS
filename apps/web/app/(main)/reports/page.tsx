'use client';

import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { RotateCcw, Download, BarChart3, Users, MessageSquareText, AlertTriangle, Calendar, FileText, Loader2, TrendingUp } from 'lucide-react';
import { cn } from '@/lib/utils';
import api from '@/lib/api';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell, Legend } from 'recharts';

const COLORS = ['#2563EB','#10B981','#F59E0B','#EF4444','#8B5CF6','#EC4899','#06B6D4','#84CC16'];
const SEV_COLORS: Record<number,string> = {1:'#10B981',2:'#F59E0B',3:'#EF4444',4:'#7C3AED',5:'#1F2937'};
const SEV_LABELS: Record<number,string> = {1:'1级-轻度',2:'2级-中度',3:'3级-重度',4:'4级-危及生命',5:'5级-死亡'};
const Q_COLORS: Record<string,string> = {OPEN:'#EF4444',ANSWERED:'#F59E0B',CLOSED:'#10B981'};
const Q_LABELS: Record<string,string> = {OPEN:'待处理',ANSWERED:'已回复',CLOSED:'已关闭'};

function EmptyChart({icon:Icon,text}:{icon:any;text:string}) {
  return <div className="flex flex-col items-center justify-center py-10 text-gray-400"><Icon size={28}/><p className="text-xs mt-2">{text}</p></div>;
}

function ChartCard({title,children}:{title:string;children:React.ReactNode}) {
  return <div className="bg-white rounded-xl border border-gray-200 p-5"><h3 className="font-semibold text-sm text-gray-900 mb-4">{title}</h3>{children}</div>;
}

export default function ReportsPage() {
  const [studyId, setStudyId] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [exporting, setExporting] = useState(false);

  const params = new URLSearchParams();
  if (studyId) params.set('studyId', studyId);
  if (startDate) params.set('startDate', startDate);
  if (endDate) params.set('endDate', endDate);
  const qs = params.toString();
  const url = '/reports/dashboard' + (qs ? '?' + qs : '');
  const detUrl = '/reports/detail' + (qs ? '?' + qs : '');

  const { data: dash, isLoading: lDash, isError: eDash, error: dashErr } = useQuery({
    queryKey: ['rpt-dash', qs],
    queryFn: () => api.get(url).then((r: any) => r.data || {}),
    retry: 1,
  });

  const { data: detail, isLoading: lDet } = useQuery({
    queryKey: ['rpt-det', qs],
    queryFn: () => api.get(detUrl).then((r: any) => r.data || []),
    retry: 1,
  });

  const handleExport = async () => {
    setExporting(true);
    try {
      const expUrl = '/reports/export' + (qs ? '?' + qs : '');
      const blob = await api.get(expUrl, { responseType: 'blob' });
      const objUrl = window.URL.createObjectURL(new Blob([blob]));
      const a = document.createElement('a');
      a.href = objUrl;
      a.download = 'ctms_report_' + new Date().toISOString().slice(0, 10) + '.csv';
      a.click();
      window.URL.revokeObjectURL(objUrl);
    } catch (e) {
      console.error('Export failed:', e);
    } finally {
      setExporting(false);
    }
  };

  const s = dash?.summary || {};
  const cards = [
    { l: '项目总数', v: s.totalStudies || 0, i: BarChart3, c: 'text-blue-600', b: 'bg-blue-50' },
    { l: '进行中', v: s.activeStudies || 0, i: TrendingUp, c: 'text-green-600', b: 'bg-green-50' },
    { l: '受试者总数', v: s.totalSubjects || 0, i: Users, c: 'text-indigo-600', b: 'bg-indigo-50' },
    { l: '本月新增', v: s.subjectsThisMonth || 0, i: Users, c: 'text-teal-600', b: 'bg-teal-50' },
    { l: '待处理Query', v: s.pendingQueries || 0, i: MessageSquareText, c: 'text-orange-600', b: 'bg-orange-50' },
    { l: '未关闭AE', v: s.openAes || 0, i: AlertTriangle, c: 'text-red-600', b: 'bg-red-50' },
    { l: '逾期访视', v: s.overdueVisits || 0, i: Calendar, c: 'text-pink-600', b: 'bg-pink-50' },
    { l: 'eTMF完成率', v: (s.etmfCompletionRate || 0) + '%', i: FileText, c: 'text-emerald-600', b: 'bg-emerald-50' },
  ];

  const trend = (dash?.enrollmentTrend || []).map((m: any) => ({ month: m.month, cnt: Number(m.cnt) }));
  const centers = (dash?.centerRanking || []).map((m: any) => ({ name: m.centerName || '未知', cnt: Number(m.cnt) }));
  const qDist = (dash?.queryDistribution || []).map((m: any) => ({ name: Q_LABELS[m.status] || m.status, value: Number(m.cnt), status: m.status }));
  const aeDist = (dash?.aeDistribution || []).map((m: any) => ({ name: SEV_LABELS[Number(m.severity)] || '未知', value: Number(m.cnt), severity: Number(m.severity) }));

  if (eDash) {
    return (
      <div className="flex flex-col items-center justify-center py-20 space-y-3">
        <AlertTriangle size={40} className="text-red-400" />
        <p className="text-red-500 font-medium">报表加载失败</p>
        <p className="text-sm text-gray-400">{(dashErr as any)?.message || '请检查后端服务是否正常运行'}</p>
        <button onClick={() => window.location.reload()} className="mt-3 px-4 py-2 bg-primary-600 text-white rounded-lg text-sm">重新加载</button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">报表分析</h1>
          <p className="text-sm text-gray-500 mt-1">临床研究数据统计与分析</p>
        </div>
        <button onClick={handleExport} disabled={exporting}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 disabled:opacity-50 shadow-sm">
          {exporting ? <><Loader2 size={14} className="animate-spin" />导出中...</> : <><Download size={16} />导出 Excel</>}
        </button>
      </div>

      {/* Filter Bar */}
      <div className="flex flex-wrap items-center gap-3 bg-white rounded-xl border border-gray-200 p-4">
        <select value={studyId} onChange={e => setStudyId(e.target.value)}
          className="px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary-500">
          <option value="">全部项目</option>
          {(dash?.studyList || []).map((s: any) => <option key={s.id} value={s.id}>{s.studyCode}</option>)}
        </select>
        <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)}
          className="px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none" />
        <span className="text-gray-400 text-sm">至</span>
        <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)}
          className="px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none" />
        <button onClick={() => { setStudyId(''); setStartDate(''); setEndDate(''); }}
          className="inline-flex items-center gap-1.5 px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50">
          <RotateCcw size={14} />重置
        </button>
      </div>

      {/* Stat Cards */}
      {lDash ? (
        <div className="flex justify-center py-12"><Loader2 size={28} className="animate-spin text-gray-400" /></div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {cards.map((c, i) => (
            <div key={i} className="bg-white rounded-xl border border-gray-200 p-4 hover:shadow-sm transition-shadow">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-gray-500">{c.l}</span>
                <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center', c.b)}>
                  <c.i size={14} className={c.c} />
                </div>
              </div>
              <span className={cn('text-2xl font-bold', c.c.replace('bg-', 'text-').replace('-50', ''))}>{c.v}</span>
            </div>
          ))}
        </div>
      )}

      {/* Charts Row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ChartCard title="受试者入组趋势">
          {lDash ? <Loader2 size={20} className="animate-spin mx-auto" /> :
            trend.length === 0 ? <EmptyChart icon={TrendingUp} text="暂无入组数据" /> :
              <ResponsiveContainer width="100%" height={260}>
                <LineChart data={trend}><CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" /><XAxis dataKey="month" tick={{ fontSize: 11 }} /><YAxis tick={{ fontSize: 11 }} /><Tooltip /><Line type="monotone" dataKey="cnt" stroke="#2563EB" strokeWidth={2} dot={{ r: 3 }} /></LineChart>
              </ResponsiveContainer>}
        </ChartCard>
        <ChartCard title="各中心入组排行">
          {lDash ? <Loader2 size={20} className="animate-spin mx-auto" /> :
            centers.length === 0 ? <EmptyChart icon={BarChart3} text="暂无中心数据" /> :
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={centers} layout="vertical"><CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" /><XAxis type="number" tick={{ fontSize: 11 }} /><YAxis type="category" dataKey="name" width={100} tick={{ fontSize: 11 }} /><Tooltip /><Bar dataKey="cnt" fill="#2563EB" radius={[0, 4, 4, 0]} /></BarChart>
              </ResponsiveContainer>}
        </ChartCard>
      </div>

      {/* Charts Row 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <ChartCard title="Query 状态分布">
          {qDist.length === 0 ? <EmptyChart icon={MessageSquareText} text="暂无Query" /> :
            <ResponsiveContainer width="100%" height={220}>
              <PieChart><Pie data={qDist} cx="50%" cy="50%" innerRadius={45} outerRadius={80} dataKey="value" paddingAngle={3}>
                {qDist.map((e: any, i: number) => <Cell key={i} fill={Q_COLORS[e.status] || COLORS[i % COLORS.length]} />)}
              </Pie><Tooltip /><Legend /></PieChart>
            </ResponsiveContainer>}
        </ChartCard>
        <ChartCard title="AE 严重程度分布">
          {aeDist.length === 0 ? <EmptyChart icon={AlertTriangle} text="暂无AE" /> :
            <ResponsiveContainer width="100%" height={220}>
              <PieChart><Pie data={aeDist} cx="50%" cy="50%" innerRadius={45} outerRadius={80} dataKey="value" paddingAngle={3}>
                {aeDist.map((e: any, i: number) => <Cell key={i} fill={SEV_COLORS[e.severity] || COLORS[i % COLORS.length]} />)}
              </Pie><Tooltip /><Legend /></PieChart>
            </ResponsiveContainer>}
        </ChartCard>
        <ChartCard title="eTMF 分类统计">
          {lDash ? <Loader2 size={20} className="animate-spin mx-auto" /> :
            <div className="space-y-2 max-h-[220px] overflow-y-auto">
              {(dash?.etmfStats || []).map((it: any, i: number) => (
                <div key={i} className="flex items-center justify-between text-xs">
                  <span className="text-gray-600 truncate max-w-[160px]">{it.category || '未分类'}</span>
                  <span className="text-gray-400">{it.status}</span>
                  <span className="font-medium">{it.cnt}</span>
                </div>
              ))}
              {(dash?.etmfStats || []).length === 0 && <EmptyChart icon={FileText} text="暂无文档" />}
            </div>}
        </ChartCard>
      </div>

      {/* Detail Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-100">
          <h3 className="font-semibold text-sm text-gray-900">明细统计</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/50">
                <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">项目编号</th>
                <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">项目名称</th>
                <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">状态</th>
                <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">受试者</th>
                <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">Query</th>
                <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">AE</th>
                <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">逾期访视</th>
                <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">eTMF完成率</th>
              </tr>
            </thead>
            <tbody>
              {lDet ? (
                <tr><td colSpan={8} className="text-center py-12"><Loader2 size={20} className="animate-spin mx-auto text-gray-400" /></td></tr>
              ) : (detail || []).length === 0 ? (
                <tr><td colSpan={8} className="text-center py-12 text-gray-400 text-sm">暂无统计数据</td></tr>
              ) : (detail || []).map((row: any, i: number) => (
                <tr key={i} className="border-b border-gray-50 hover:bg-gray-50/50">
                  <td className="px-4 py-3 text-sm font-medium text-gray-900">{row.studyCode}</td>
                  <td className="px-4 py-3 text-sm text-gray-700 max-w-[220px] truncate">{row.studyTitle}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">{row.studyStatus}</td>
                  <td className="px-4 py-3 text-sm font-medium">{row.subjectCount || 0}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">{row.queryCount || 0}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">{row.aeCount || 0}</td>
                  <td className="px-4 py-3 text-sm text-red-600">{row.overdueVisitCount || 0}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2 w-28">
                      <div className="flex-1 h-1.5 bg-gray-100 rounded-full">
                        <div className="h-full bg-green-500 rounded-full transition-all" style={{ width: Math.min(100, row.etmfCompletionRate || 0) + '%' }} />
                      </div>
                      <span className="text-xs text-gray-600 w-10">{row.etmfCompletionRate || 0}%</span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="px-4 py-3 border-t border-gray-100 text-sm text-gray-500">共 {(detail || []).length} 条记录</div>
      </div>
    </div>
  );
}
