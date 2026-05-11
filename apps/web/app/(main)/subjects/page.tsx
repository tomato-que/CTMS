'use client';

import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Search, Loader2, Users } from 'lucide-react';
import { cn } from '@/lib/utils';
import api from '@/lib/api';

const statusLabels:Record<string,string>={ LEAD:'潜在',PRESCREENED:'预筛',CONSENTED:'已知情',SCREENED:'已筛选',ENROLLED:'已入组',IN_FOLLOWUP:'随访中',COMPLETED:'已完成',WITHDRAWN:'已退出',LOST:'失访' };
const statusColors:Record<string,string>={ ENROLLED:'bg-green-100 text-green-700',IN_FOLLOWUP:'bg-blue-100 text-blue-700',COMPLETED:'bg-teal-100 text-teal-700',WITHDRAWN:'bg-orange-100 text-orange-700',LOST:'bg-red-100 text-red-700',LEAD:'bg-gray-100 text-gray-600',PRESCREENED:'bg-purple-100 text-purple-700',CONSENTED:'bg-indigo-100 text-indigo-700',SCREENED:'bg-yellow-100 text-yellow-700' };

export default function SubjectsPage() {
  const router = useRouter();
  const [search, setSearch] = useState('');
  const { data: subjects, isLoading } = useQuery({ queryKey: ['subjects'], queryFn: () => api.get('/subjects?size=200').then((r:any)=>r.data||[]) });

  const filtered = (subjects||[]).filter((s:any) => !search || s.subjectNumber?.includes(search) || s.realName?.includes(search));

  return (
    <div className="space-y-6">
      <div><h1 className="text-2xl font-bold text-gray-900">受试者全景</h1><p className="text-sm text-gray-500 mt-1">管理所有研究受试者</p></div>

      <div className="flex items-center gap-2 px-3 py-2 bg-white border border-gray-200 rounded-lg w-72">
        <Search size={16} className="text-gray-400 flex-shrink-0"/>
        <input type="text" placeholder="搜索受试者编号..." value={search} onChange={e=>setSearch(e.target.value)} className="bg-transparent border-none outline-none text-sm w-full"/>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16"><Loader2 size={24} className="animate-spin text-gray-400"/></div>
      ) : filtered.length===0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-16 text-center">
          <Users size={32} className="text-gray-300 mx-auto mb-3"/>
          <p className="text-gray-400 text-sm">{search?'没有匹配的受试者':'暂无受试者'}</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto"><table className="w-full">
            <thead><tr className="border-b border-gray-100 bg-gray-50/50">
              <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">受试者编号</th>
              <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">姓名</th>
              <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">性别</th>
              <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">入组日期</th>
              <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">状态</th>
            </tr></thead>
            <tbody>
              {filtered.map((s:any)=>(
                <tr key={s.id} onClick={()=>router.push(`/subjects/${s.id}`)} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors cursor-pointer">
                  <td className="px-4 py-3 text-sm font-medium text-primary-600">{s.subjectNumber}</td>
                  <td className="px-4 py-3 text-sm text-gray-700">{s.realName||'***'}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">{s.gender==='MALE'?'男':s.gender==='FEMALE'?'女':s.gender||'-'}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">{s.enrollmentDate||'-'}</td>
                  <td className="px-4 py-3"><span className={cn('text-xs px-2 py-0.5 rounded-full font-medium',statusColors[s.status])}>{statusLabels[s.status]||s.status}</span></td>
                </tr>
              ))}
            </tbody>
          </table></div>
          <div className="px-4 py-3 border-t border-gray-100 text-sm text-gray-500">共 {filtered.length} 名受试者</div>
        </div>
      )}
    </div>
  );
}
