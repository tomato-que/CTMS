'use client';

import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Search, Loader2, MessageSquareText } from 'lucide-react';
import { cn } from '@/lib/utils';
import api from '@/lib/api';

const sColors:Record<string,string>={ OPEN:'bg-red-100 text-red-700',ANSWERED:'bg-yellow-100 text-yellow-700',CLOSED:'bg-green-100 text-green-700' };
const sLabels:Record<string,string>={ OPEN:'待处理',ANSWERED:'已回复',CLOSED:'已关闭' };

export default function QueriesPage() {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const { data: queries, isLoading } = useQuery({ queryKey: ['queries'], queryFn: () => api.get('/queries?size=200').then((r:any)=>r.data||[]) });

  const filtered = (queries||[]).filter((q:any)=>{
    if(statusFilter!=='all' && q.status!==statusFilter) return false;
    if(search && !q.description?.includes(search) && !q.subjectId?.includes(search)) return false;
    return true;
  });

  const openCount = (queries||[]).filter((q:any)=>q.status==='OPEN').length;
  const answeredCount = (queries||[]).filter((q:any)=>q.status==='ANSWERED').length;
  const closedCount = (queries||[]).filter((q:any)=>q.status==='CLOSED').length;

  return (
    <div className="space-y-6">
      <div><h1 className="text-2xl font-bold text-gray-900">Query 管理</h1><p className="text-sm text-gray-500 mt-1">数据质疑管理与处理</p></div>

      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-2 px-3 py-2 bg-white border border-gray-200 rounded-lg w-64">
          <Search size={16} className="text-gray-400 flex-shrink-0"/><input type="text" placeholder="搜索内容..." value={search} onChange={e=>setSearch(e.target.value)} className="bg-transparent border-none outline-none text-sm w-full"/>
        </div>
        <div className="flex bg-gray-100 rounded-lg p-0.5">
          {[{k:'all',v:'全部'},{k:'OPEN',v:'待处理'},{k:'ANSWERED',v:'已回复'},{k:'CLOSED',v:'已关闭'}].map((t)=>(
            <button key={t.k} onClick={()=>setStatusFilter(t.k)} className={cn('px-3 py-1 text-xs rounded-md transition-colors',statusFilter===t.k?'bg-white shadow text-gray-900 font-medium':'text-gray-500')}>{t.v}</button>))}
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[{label:'全部',value:queries?.length||0,c:'text-gray-600'},{label:'待处理',value:openCount,c:'text-red-600'},{label:'已回复',value:answeredCount,c:'text-yellow-600'},{label:'已关闭',value:closedCount,c:'text-green-600'}].map((s,i)=>(
          <div key={i} className="bg-white rounded-xl border border-gray-200 p-4 text-center"><p className={cn('text-2xl font-bold',s.c)}>{s.value}</p><p className="text-xs text-gray-500 mt-1">{s.label}</p></div>))}
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16"><Loader2 size={24} className="animate-spin text-gray-400"/></div>
      ) : filtered.length===0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-16 text-center">
          <MessageSquareText size={32} className="text-gray-300 mx-auto mb-3"/>
          <p className="text-gray-400 text-sm">暂无Query记录</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto"><table className="w-full">
            <thead><tr className="border-b border-gray-100 bg-gray-50/50">
              <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">质疑内容</th>
              <th className="text-left text-xs font-medium text-gray-500 px-4 py-3 w-[100px]">类型</th>
              <th className="text-left text-xs font-medium text-gray-500 px-4 py-3 w-[100px]">严重度</th>
              <th className="text-left text-xs font-medium text-gray-500 px-4 py-3 w-[80px]">状态</th>
              <th className="text-left text-xs font-medium text-gray-500 px-4 py-3 w-[100px]">存活天数</th>
            </tr></thead>
            <tbody>
              {filtered.map((q:any)=>(
                <tr key={q.id} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
                  <td className="px-4 py-3 text-sm text-gray-700 max-w-sm truncate">{q.description||'-'}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">{q.queryType||'-'}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">{q.severity||'-'}</td>
                  <td className="px-4 py-3"><span className={cn('text-xs px-2 py-0.5 rounded-full font-medium',sColors[q.status])}>{sLabels[q.status]||q.status}</span></td>
                  <td className="px-4 py-3 text-sm text-gray-500">{q.agingDays||0}天</td>
                </tr>
              ))}
            </tbody>
          </table></div>
          <div className="px-4 py-3 border-t border-gray-100 text-sm text-gray-500">共 {filtered.length} 条Query</div>
        </div>
      )}
    </div>
  );
}
