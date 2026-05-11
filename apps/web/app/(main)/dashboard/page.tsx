'use client';

import { useQuery } from '@tanstack/react-query';
import { BarChart3, Users, MessageSquareText, AlertTriangle, TrendingUp, Calendar, Clock, AlertCircle, CheckCircle2 } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { cn } from '@/lib/utils';
import api from '@/lib/api';

export default function DashboardPage() {
  const { data: studies, isLoading } = useQuery({ queryKey: ['studies'], queryFn: () => api.get('/studies?size=50').then((r:any)=>r.data||[]) });
  const { data: aes } = useQuery({ queryKey: ['aes'], queryFn: () => api.get('/aes?size=200').then((r:any)=>r.data||[]) });
  const { data: queries } = useQuery({ queryKey: ['queries'], queryFn: () => api.get('/queries?size=200').then((r:any)=>r.data||[]) });
  const { data: subjects } = useQuery({ queryKey: ['subjects'], queryFn: () => api.get('/subjects?size=500').then((r:any)=>r.data||[]) });

  const activeStudies = studies?.filter((s:any)=>!['ARCHIVED','archived'].includes(s.status))?.length||0;
  const totalSubjects = subjects?.length||0;
  const openQueries = queries?.filter((q:any)=>q.status==='OPEN')?.length||0;
  const saeCount = aes?.filter((a:any)=>a.isSerious===1)?.length||0;

  const stageMap:Record<string,number> = {};
  studies?.forEach((s:any)=>{ const st=s.status||'unknown'; stageMap[st]=(stageMap[st]||0)+1; });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold text-gray-900">工作台</h1><p className="text-sm text-gray-500 mt-1">项目概览与待办</p></div>
        <div className="flex items-center gap-2 text-sm text-gray-500"><Calendar size={16}/><span>{new Date().toLocaleDateString('zh-CN',{year:'numeric',month:'long',day:'numeric',weekday:'long'})}</span></div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-20"><div className="animate-spin w-8 h-8 border-2 border-primary-600 border-t-transparent rounded-full"/></div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[{label:'活跃项目',value:activeStudies,icon:BarChart3,color:'text-blue-600',bg:'bg-blue-50'},{label:'累计受试者',value:totalSubjects,icon:Users,color:'text-green-600',bg:'bg-green-50'},{label:'待处理Query',value:openQueries,icon:MessageSquareText,color:'text-orange-600',bg:'bg-orange-50'},{label:'SAE',value:saeCount,icon:AlertTriangle,color:'text-red-600',bg:'bg-red-50'}].map((m,i)=>(
              <div key={i} className="bg-white rounded-xl border border-gray-200 p-5">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm text-gray-500">{m.label}</span>
                  <div className={cn('w-9 h-9 rounded-lg flex items-center justify-center',m.bg)}><m.icon size={18} className={m.color}/></div>
                </div>
                <span className="text-2xl font-bold text-gray-900">{m.value}</span>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="lg:col-span-2 bg-white rounded-xl border border-gray-200 p-5">
              <h3 className="font-semibold text-gray-900 mb-4">受试者入组趋势</h3>
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <TrendingUp size={32} className="text-gray-300 mb-2"/>
                <p className="text-sm text-gray-400">数据收集中，录入更多受试者后显示趋势图</p>
              </div>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <h3 className="font-semibold text-gray-900 mb-4">项目阶段分布</h3>
              {Object.keys(stageMap).length>0 ? (
                <div className="space-y-2">
                  {Object.entries(stageMap).map(([k,v])=>(<div key={k} className="flex items-center justify-between"><span className="text-sm text-gray-600">{k}</span><span className="text-sm font-medium">{v}</span></div>))}
                </div>
              ) : <div className="text-center py-6 text-gray-400 text-sm">暂无项目</div>}
            </div>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h3 className="font-semibold text-gray-900 mb-4">最近项目</h3>
            {studies&&studies.length>0 ? (
              <table className="w-full"><thead><tr className="border-b border-gray-100 text-left text-xs font-medium text-gray-500">
                <th className="pb-3 pr-4">编号</th><th className="pb-3 pr-4">标题</th><th className="pb-3 pr-4">分期</th><th className="pb-3">状态</th></tr></thead>
                <tbody>{studies.slice(0,5).map((s:any)=>(<tr key={s.id} className="border-b border-gray-50 text-sm">
                  <td className="py-3 pr-4 font-medium">{s.studyCode}</td><td className="py-3 pr-4 text-gray-600 truncate max-w-xs">{s.title}</td>
                  <td className="py-3 pr-4 text-gray-500">{s.phase}</td><td className="py-3"><span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">{s.status}</span></td></tr>))}</tbody></table>
            ) : <div className="text-center py-10 text-sm text-gray-400">暂无项目，请先创建研究项目</div>}
          </div>
        </>
      )}
    </div>
  );
}
