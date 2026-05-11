'use client';

import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Shield, Loader2, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';
import api from '@/lib/api';

const aColors:Record<string,string>={LOGIN:'bg-blue-100 text-blue-700',CREATE:'bg-green-100 text-green-700',UPDATE:'bg-yellow-100 text-yellow-700',DELETE:'bg-red-100 text-red-700',STATE_CHANGE:'bg-purple-100 text-purple-700',SENSITIVE_ACCESS:'bg-orange-100 text-orange-700',EXPORT:'bg-teal-100 text-teal-700',AI_CONFIRMATION:'bg-pink-100 text-pink-700',APPROVAL:'bg-indigo-100 text-indigo-700'};
const aLabels:Record<string,string>={LOGIN:'登录',CREATE:'创建',UPDATE:'更新',DELETE:'删除',STATE_CHANGE:'状态变更',SENSITIVE_ACCESS:'敏感访问',EXPORT:'导出',AI_CONFIRMATION:'AI确认',APPROVAL:'审批'};

export default function AuditLogsPage() {
  const [page,setPage]=useState(1);
  const {data:logs,isLoading}=useQuery({queryKey:['audit-logs',page],queryFn:()=>api.get(`/audit-logs?page=${page}&size=50`).then((r:any)=>r.data||[]),staleTime:10000});

  const fmt=(t:string)=>{if(!t)return'-';try{return new Date(t).toLocaleString('zh-CN',{timeZone:'Asia/Shanghai'})}catch{return t}};

  return(<div className="space-y-6">
    <div><h1 className="text-2xl font-bold text-gray-900">审计日志</h1><p className="text-sm text-gray-500 mt-1">所有关键操作的审计追踪记录（不可删除不可修改）</p></div>
    <div className="flex items-center gap-4 text-xs text-gray-400"><span><Clock size={12} className="inline mr-1"/>时区: Asia/Shanghai (UTC+8)</span><span><Shield size={12} className="inline mr-1"/>保留: 在线3年</span></div>
    {isLoading?<div className="flex justify-center py-16"><Loader2 size={24} className="animate-spin text-gray-400"/></div>
    :(logs||[]).length===0?<div className="bg-white rounded-xl border border-gray-200 p-16 text-center"><Shield size={32} className="text-gray-300 mx-auto mb-3"/><p className="text-gray-400 text-sm">暂无审计日志</p></div>
    :(<div className="bg-white rounded-xl border border-gray-200 overflow-hidden"><div className="overflow-x-auto"><table className="w-full">
      <thead><tr className="border-b border-gray-100 bg-gray-50/50"><th className="text-left text-xs font-medium text-gray-500 px-4 py-3">操作</th><th className="text-left text-xs font-medium text-gray-500 px-4 py-3">实体</th><th className="text-left text-xs font-medium text-gray-500 px-4 py-3">操作人</th><th className="text-left text-xs font-medium text-gray-500 px-4 py-3">IP</th><th className="text-left text-xs font-medium text-gray-500 px-4 py-3">时间</th></tr></thead>
      <tbody>{(logs||[]).map((l:any)=>(<tr key={l.id} className="border-b border-gray-50 hover:bg-gray-50/50"><td className="px-4 py-3"><span className={cn('text-xs px-2 py-0.5 rounded-full font-medium',aColors[l.operationType]||'bg-gray-100 text-gray-600')}>{aLabels[l.operationType]||l.operationType}</span></td><td className="px-4 py-3 text-sm text-gray-600">{l.targetEntity}{l.targetId?` #${l.targetId.slice(0,8)}...`:''}</td><td className="px-4 py-3 text-sm text-gray-700">{l.userRole?l.userRole.replace('ROLE_',''):'-'}</td><td className="px-4 py-3 text-sm text-gray-500 font-mono">{l.ipAddress||'-'}</td><td className="px-4 py-3 text-sm text-gray-500">{fmt(l.createdAt)}</td></tr>))}</tbody></table></div>
      <div className="px-4 py-3 border-t border-gray-100 flex items-center justify-between text-sm text-gray-500"><span>共 {(logs||[]).length} 条</span><div className="flex items-center gap-2"><button onClick={()=>setPage(p=>Math.max(1,p-1))} disabled={page===1} className="px-3 py-1 border border-gray-200 rounded text-sm hover:bg-gray-50 disabled:opacity-30">上一页</button><span className="text-xs">第{page}页</span><button onClick={()=>setPage(p=>p+1)} disabled={(logs||[]).length<50} className="px-3 py-1 border border-gray-200 rounded text-sm hover:bg-gray-50 disabled:opacity-30">下一页</button></div></div></div>)}
  </div>);
}
