'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Search, Plus, Eye, BarChart3, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import api from '@/lib/api';

const statusLabels:Record<string,string>={ DRAFT:'草稿',STARTUP:'启动中',ENROLLING:'入组中',FOLLOWUP:'随访中',LOCKED:'已锁定',ARCHIVED:'已归档' };
const statusColors:Record<string,string>={ DRAFT:'bg-gray-100 text-gray-600',STARTUP:'bg-blue-100 text-blue-700',ENROLLING:'bg-green-100 text-green-700',FOLLOWUP:'bg-yellow-100 text-yellow-700',LOCKED:'bg-purple-100 text-purple-700',ARCHIVED:'bg-gray-100 text-gray-500' };

export default function ProjectsPage() {
  const router = useRouter();
  const [search, setSearch] = useState('');
  const { data: studies, isLoading, isError, refetch } = useQuery({
    queryKey: ['studies'],
    queryFn: () => api.get('/studies?size=100').then((r:any)=>r.data||[]),
    staleTime: 0, // Always refetch on mount to show latest data
  });

  const filtered = (studies||[]).filter((s:any) => !search || s.studyCode?.includes(search) || s.title?.includes(search) || s.indication?.includes(search));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold text-gray-900">项目管理</h1><p className="text-sm text-gray-500 mt-1">管理所有临床研究项目</p></div>
        <button onClick={()=>router.push('/projects/new')} className="flex items-center gap-2 px-4 py-2.5 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 active:scale-[0.98] transition-all shadow-sm">
          <Plus size={16}/> 新建项目
        </button>
      </div>

      <div className="flex items-center gap-2 px-3 py-2 bg-white border border-gray-200 rounded-lg w-72">
        <Search size={16} className="text-gray-400 flex-shrink-0"/>
        <input type="text" placeholder="搜索项目编号/标题..." value={search} onChange={e=>setSearch(e.target.value)} className="bg-transparent border-none outline-none text-sm w-full"/>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16"><Loader2 size={24} className="animate-spin text-gray-400"/></div>
      ) : filtered.length===0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-16 text-center">
          <BarChart3 size={32} className="text-gray-300 mx-auto mb-3"/>
          <p className="text-gray-400 text-sm">{search?'没有匹配的项目':'暂无项目'}</p>
          {!search && <button onClick={()=>router.push('/projects/new')} className="mt-3 text-primary-600 text-sm hover:underline">创建第一个项目</button>}
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto"><table className="w-full">
            <thead><tr className="border-b border-gray-100 bg-gray-50/50">
              <th className="text-left text-xs font-medium text-gray-500 px-4 py-3 w-[130px]">项目编号</th>
              <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">项目名称</th>
              <th className="text-left text-xs font-medium text-gray-500 px-4 py-3 w-[80px]">分期</th>
              <th className="text-left text-xs font-medium text-gray-500 px-4 py-3 w-[80px]">状态</th>
              <th className="text-left text-xs font-medium text-gray-500 px-4 py-3 w-[80px]">计划中心</th>
              <th className="text-left text-xs font-medium text-gray-500 px-4 py-3 w-[80px]">计划入组</th>
              <th className="text-left text-xs font-medium text-gray-500 px-4 py-3 w-[80px]">操作</th>
            </tr></thead>
            <tbody>
              {filtered.map((s:any) => (
                <tr key={s.id} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
                  <td className="px-4 py-3 text-sm font-medium text-gray-900">{s.studyCode}</td>
                  <td className="px-4 py-3 text-sm text-gray-700 max-w-xs truncate">{s.title}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">{s.phase}</td>
                  <td className="px-4 py-3"><span className={cn('text-xs px-2 py-0.5 rounded-full font-medium',statusColors[s.status])}>{statusLabels[s.status]||s.status}</span></td>
                  <td className="px-4 py-3 text-sm text-gray-600">{s.plannedSites||'-'}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">{s.plannedSubjects||'-'}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      <button onClick={()=>router.push(`/projects/${s.id}`)} className="p-1.5 rounded hover:bg-gray-100 text-gray-400 hover:text-blue-600" title="查看详情"><Eye size={14}/></button>
                      <button onClick={()=>router.push(`/reports?p=${s.id}`)} className="p-1.5 rounded hover:bg-gray-100 text-gray-400 hover:text-green-600" title="统计分析"><BarChart3 size={14}/></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table></div>
          <div className="px-4 py-3 border-t border-gray-100 text-sm text-gray-500">共 {filtered.length} 个项目</div>
        </div>
      )}
    </div>
  );
}
