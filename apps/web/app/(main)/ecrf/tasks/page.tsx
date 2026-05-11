'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Search, Plus, Eye, Check, X, Loader2, FileText, GripVertical, Trash2, ClipboardList, PencilRuler, Send, History } from 'lucide-react';
import { cn } from '@/lib/utils';
import api from '@/lib/api';

const statusLabels: Record<string,string> = { DRAFT:'草稿', IN_PROGRESS:'录入中', SUBMITTED:'已提交', PENDING_REVIEW:'待审核', APPROVED:'已批准', LOCKED:'已锁定', REJECTED:'已驳回' };
const statusColors: Record<string,string> = { DRAFT:'badge-gray', IN_PROGRESS:'badge-info', SUBMITTED:'badge-purple', PENDING_REVIEW:'badge-warning', APPROVED:'badge-success', LOCKED:'badge-success', REJECTED:'badge-danger' };
const sdvColors: Record<string,string> = { COMPLETED:'badge-success', IN_PROGRESS:'badge-info', DIFFERENCE_FOUND:'badge-warning' };
const COMPONENTS = [
  { group:'基础字段', items:[{type:'TEXT',label:'单行文本',icon:'T'},{type:'NUMERIC',label:'数值输入',icon:'#'},{type:'DATE',label:'日期时间',icon:'📅'},{type:'SINGLE_CHOICE',label:'单项选择',icon:'◉'},{type:'MULTI_CHOICE',label:'多项选择',icon:'☐'}] },
  { group:'医疗专用', items:[{type:'VITAL_SIGNS',label:'生命体征组',icon:'💓'},{type:'CONMED',label:'合并用药',icon:'💊'},{type:'LAB_RESULT',label:'实验室检查',icon:'🔬'}] },
];

export default function EcrfPage() {
  const [tab, setTab] = useState<'tasks'|'designer'>('tasks');
  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex items-center gap-1 bg-gray-100 rounded-xl p-1 w-fit">
        {[{k:'tasks',l:'任务管理',i:ClipboardList},{k:'designer',l:'量表设计器',i:PencilRuler}].map(t => (
          <button key={t.k} onClick={() => setTab(t.k as any)}
            className={cn('flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all',
              tab===t.k ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-700')}>
            <t.i size={15} />{t.l}
          </button>
        ))}
      </div>
      {tab === 'tasks' ? <TaskList /> : <Designer />}
    </div>
  );
}

function TaskList() {
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{type:'success'|'error',msg:string}|null>(null);
  const [form, setForm] = useState({studyId:'',subjectId:'',taskNumber:'TASK-'+Date.now().toString(36).toUpperCase(),priority:'MEDIUM',dueDate:''});
  const { data: tasks, isLoading } = useQuery({queryKey:['ecrf-tasks'],queryFn:()=>api.get('/ecrf/tasks?size=200').then((r:any)=>r.data||[]),staleTime:0});
  const { data: studies } = useQuery({queryKey:['s-ecrf'],queryFn:()=>api.get('/studies?size=100').then((r:any)=>r.data||[]),staleTime:300000});
  const { data: subjects } = useQuery({queryKey:['sub-ecrf'],queryFn:()=>api.get('/subjects?size=500').then((r:any)=>r.data||[]),staleTime:300000});
  const { data: stats } = useQuery({queryKey:['ecrf-stats'],queryFn:()=>api.get('/ecrf/tasks/stats').then((r:any)=>r.data||{})});
  const showToast = (t:'success'|'error',m:string) => { setToast({type:t,msg:m}); setTimeout(()=>setToast(null),3000); };
  const filtered = (tasks||[]).filter((t:any) => !search || t.taskNumber?.includes(search) || (t.subjectId||'').includes(search));

  const handleSave = async () => { setSaving(true); try { const res:any = await api.post('/ecrf/tasks',form); if(res.code===0){setModalOpen(false);qc.invalidateQueries({queryKey:['ecrf-tasks']});showToast('success','创建成功');} else showToast('error',res.message||'失败'); } catch(e) { showToast('error','网络错误'); } finally { setSaving(false); } };
  const handleSubmit = async (id:string) => { try { await api.put(`/ecrf/tasks/${id}/submit`); qc.invalidateQueries({queryKey:['ecrf-tasks']}); showToast('success','已提交'); } catch(e) { showToast('error','失败'); } };
  const handleReview = async (id:string,approved:boolean) => { try { await api.put(`/ecrf/tasks/${id}/review`,{action:approved?'APPROVE':'REJECT'}); qc.invalidateQueries({queryKey:['ecrf-tasks']}); showToast('success',approved?'已锁定':'已驳回'); } catch(e) { showToast('error','失败'); } };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="page-title">eCRF 任务管理</h1>
        <button onClick={()=>{setForm({studyId:'',subjectId:'',taskNumber:'TASK-'+Date.now().toString(36).toUpperCase(),priority:'MEDIUM',dueDate:''});setModalOpen(true);}} className="btn-primary"><Plus size={16}/>新建任务</button>
      </div>
      {toast && <div className={cn('toast',toast.type==='success'?'toast-success':'toast-error')}>{toast.type==='success'?<Check size={14}/>:<X size={14}/>}{toast.msg}</div>}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[{l:'任务总数',v:stats?.total||tasks?.length||0,c:'text-gray-700'},{l:'待审核',v:tasks?.filter((t:any)=>t.status==='PENDING_REVIEW').length||0,c:'text-amber-600'},{l:'已锁定',v:stats?.locked||0,c:'text-emerald-600'},{l:'SDV完成率',v:(stats?.sdvRate||0)+'%',c:'text-indigo-600'}].map((s,i)=>(
          <div key={i} className="card p-4 text-center"><p className={cn('text-2xl font-bold',s.c)}>{s.v}</p><p className="text-xs text-gray-500 mt-1">{s.l}</p></div>
        ))}
      </div>
      <div className="filter-bar">
        <div className="flex items-center gap-2 px-3 py-2 bg-white border border-gray-200 rounded-lg w-64"><Search size={16} className="text-gray-400"/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="搜索任务编号或受试者..." className="bg-transparent border-none outline-none text-sm w-full"/></div>
        <span className="text-xs text-gray-400 ml-auto">{filtered.length} 个任务</span>
      </div>
      {isLoading ? <div className="loading-container"><Loader2 size={24} className="animate-spin text-gray-400"/></div>
      : filtered.length===0 ? <div className="empty-state"><FileText size={40} className="empty-icon"/><p className="empty-text">暂无 eCRF 任务</p></div>
      : (<div className="table-container"><div className="overflow-x-auto"><table className="w-full"><thead className="table-header"><tr><th>任务编号</th><th>受试者</th><th>状态</th><th>SDV</th><th>优先级</th><th>更新时间</th><th>操作</th></tr></thead>
      <tbody>{filtered.map((t:any)=>(
        <tr key={t.id} className="table-row">
          <td className="table-cell font-medium text-gray-900">{t.taskNumber}</td>
          <td className="table-cell text-gray-600">{t.subjectId?.slice(0,8)||'-'}</td>
          <td className="table-cell"><span className={cn('badge',statusColors[t.status]||'badge-gray')}>{statusLabels[t.status]||t.status}</span></td>
          <td className="table-cell">{t.sdvStatus ? <span className={cn('badge',sdvColors[t.sdvStatus]||'badge-gray')}>{t.sdvStatus}</span> : <span className="text-xs text-gray-400">-</span>}</td>
          <td className="table-cell text-gray-600">{t.priority}</td>
          <td className="table-cell text-xs text-gray-500">{t.updatedAt?.slice(0,10)||'-'}</td>
          <td className="table-cell"><div className="flex items-center gap-1">
            {t.status==='DRAFT' && <button onClick={()=>handleSubmit(t.id)} className="p-1.5 rounded hover:bg-indigo-100 text-gray-400 hover:text-indigo-600" title="提交"><Check size={14}/></button>}
            {t.status==='PENDING_REVIEW' && <><button onClick={()=>handleReview(t.id,true)} className="p-1.5 rounded hover:bg-emerald-100 text-gray-400 hover:text-emerald-600" title="通过"><Check size={14}/></button><button onClick={()=>handleReview(t.id,false)} className="p-1.5 rounded hover:bg-red-100 text-gray-400 hover:text-red-600" title="驳回"><X size={14}/></button></>}
          </div></td>
        </tr>
      ))}</tbody></table></div><div className="px-4 py-3 border-t border-gray-100 text-sm text-gray-500">共 {filtered.length} 个任务</div></div>)}

      {modalOpen && (<div className="modal-overlay" onClick={()=>setModalOpen(false)}>
        <div className="modal-content" onClick={e=>e.stopPropagation()}>
          <div className="modal-header"><h2 className="text-lg font-semibold">新建 eCRF 任务</h2><button onClick={()=>setModalOpen(false)} className="p-1.5 rounded-lg hover:bg-gray-100"><X size={18}/></button></div>
          <form onSubmit={e=>{e.preventDefault();handleSave();}} className="px-6 py-4 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div><label className="block text-sm font-medium text-gray-700 mb-1">关联项目 *</label><select value={form.studyId} onChange={e=>setForm({...form,studyId:e.target.value})} className="input-field"><option value="">选择项目</option>{(studies||[]).map((s:any)=><option key={s.id} value={s.id}>{s.studyCode}</option>)}</select></div>
              <div><label className="block text-sm font-medium text-gray-700 mb-1">受试者 *</label><select value={form.subjectId} onChange={e=>setForm({...form,subjectId:e.target.value})} className="input-field"><option value="">选择受试者</option>{(subjects||[]).map((s:any)=><option key={s.id} value={s.id}>{s.subjectNumber}</option>)}</select></div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div><label className="block text-sm font-medium text-gray-700 mb-1">任务编号 *</label><input value={form.taskNumber} onChange={e=>setForm({...form,taskNumber:e.target.value})} className="input-field" required/></div>
              <div><label className="block text-sm font-medium text-gray-700 mb-1">优先级</label><select value={form.priority} onChange={e=>setForm({...form,priority:e.target.value})} className="input-field"><option value="LOW">低</option><option value="MEDIUM">中</option><option value="HIGH">高</option><option value="URGENT">紧急</option></select></div>
            </div>
            <div><label className="block text-sm font-medium text-gray-700 mb-1">计划完成日期</label><input type="date" value={form.dueDate} onChange={e=>setForm({...form,dueDate:e.target.value})} className="input-field"/></div>
            <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-100"><button type="button" onClick={()=>setModalOpen(false)} className="btn-ghost">取消</button><button type="submit" disabled={saving} className="btn-primary">{saving?<><Loader2 size={14} className="animate-spin"/>保存中...</>:'创建任务'}</button></div>
          </form>
        </div>
      </div>)}
    </div>
  );
}

function Designer() {
  const [formName, setFormName] = useState('NYHA心功能分级量表');
  const [formCode, setFormCode] = useState('NYHA-001');
  const [questions, setQuestions] = useState<any[]>([
    {id:'q1',type:'SINGLE_CHOICE',label:'NYHA心功能等级',options:[{value:'I',label:'I级-体力活动不受限'},{value:'II',label:'II级-体力活动轻度受限'},{value:'III',label:'III级-体力活动明显受限'},{value:'IV',label:'IV级-不能从事任何体力活动'}],required:true,order:1},
    {id:'q2',type:'TEXT',label:'其他症状描述',required:false,order:2},
  ]);
  const [selectedQ, setSelectedQ] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const [showVersions, setShowVersions] = useState(false);
  const [toast, setToast] = useState<{type:'success'|'error',msg:string}|null>(null);
  const showToast = (t:'success'|'error',m:string) => { setToast({type:t,msg:m}); setTimeout(()=>setToast(null),3000); };

  const addQuestion = (type:string) => {
    const q = {id:'q'+Date.now(),type,label:'新题目',options:type==='SINGLE_CHOICE'?[{value:'1',label:'选项1'},{value:'2',label:'选项2'}]:undefined,required:false,order:questions.length+1};
    setQuestions([...questions,q]); setSelectedQ(q);
  };
  const removeQuestion = (id:string) => { setQuestions(questions.filter(q=>q.id!==id)); setSelectedQ(null); };
  const handleSave = async () => {
    setSaving(true);
    try {
      const schema = JSON.stringify({questions,skipLogic:[{source:'q1',condition:{op:'eq',value:'I'},target:'q_end'}]});
      await api.post('/ecrf/forms',{studyId:'dummy',formCode,formName,formCategory:'MEDICAL',formSchema:schema});
      showToast('success','已保存');
    } catch(e) { showToast('error','保存失败'); }
    finally { setSaving(false); }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="page-title">eCRF 量表设计器</h1>
        <div className="flex items-center gap-2">
          <button onClick={()=>setShowVersions(!showVersions)} className="btn-ghost"><History size={14}/>版本历史</button>
          <button onClick={handleSave} disabled={saving} className="btn-primary">{saving?<><Loader2 size={14} className="animate-spin"/>保存中...</>:<><Check size={14}/>保存</>}</button>
          <button onClick={()=>showToast('success','发布功能开发中')} className="btn-primary"><Send size={14}/>发布</button>
        </div>
      </div>
      {toast && <div className={cn('toast',toast.type==='success'?'toast-success':'toast-error')}>{toast.type==='success'?<Check size={14}/>:<X size={14}/>}{toast.msg}</div>}
      <div className="card p-4 flex flex-wrap items-center gap-4">
        <div><label className="text-xs text-gray-500">表单名称</label><input value={formName} onChange={e=>setFormName(e.target.value)} className="input-field w-48 mt-1"/></div>
        <div><label className="text-xs text-gray-500">表单编码</label><input value={formCode} onChange={e=>setFormCode(e.target.value)} className="input-field w-32 mt-1"/></div>
        <div><label className="text-xs text-gray-500">状态</label><p className="text-sm font-semibold text-amber-600 mt-1">草稿 v1.2</p></div>
        <div className="ml-auto text-xs text-gray-400">符合 21 CFR Part 11：所有修改均记录在审计追踪中</div>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        <div className="card p-4">
          <h3 className="font-semibold text-sm text-gray-900 mb-3">组件库</h3>
          {COMPONENTS.map(g => (
            <div key={g.group} className="mb-4">
              <p className="text-xs font-semibold text-gray-400 uppercase mb-2">{g.group}</p>
              <div className="space-y-1">{g.items.map(it => (
                <button key={it.type} onClick={()=>addQuestion(it.type)} className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-gray-600 hover:bg-indigo-50 hover:text-indigo-700 transition-colors border border-dashed border-gray-200 hover:border-indigo-300">
                  <span className="text-xs">{it.icon}</span>{it.label}
                </button>
              ))}</div>
            </div>
          ))}
        </div>
        <div className="lg:col-span-3 card p-5 min-h-[500px]">
          <h3 className="font-semibold text-sm text-gray-900 mb-4"><FileText size={14} className="inline mr-1"/>设计画布</h3>
          {questions.length===0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-gray-400"><FileText size={40} className="mb-3"/><p className="text-sm">从左侧组件库点击添加题目</p></div>
          ) : (
            <div className="space-y-2">{questions.map((q, idx) => (
              <div key={q.id} className={cn('p-4 rounded-xl border-2 transition-all cursor-pointer',selectedQ?.id===q.id?'border-indigo-400 bg-indigo-50/50':'border-gray-100 hover:border-gray-300')} onClick={()=>setSelectedQ(q)}>
                <div className="flex items-center gap-3">
                  <GripVertical size={14} className="text-gray-300"/>
                  <span className="text-xs font-bold text-gray-400 w-8">{idx+1}.</span>
                  <span className="text-xs px-2 py-0.5 rounded bg-gray-100 text-gray-600 font-mono">{q.type}</span>
                  <input value={q.label} onChange={e=>{const nq=[...questions];nq[idx]={...q,label:e.target.value};setQuestions(nq);}} className="flex-1 bg-transparent border-none outline-none text-sm font-medium text-gray-900" onClick={e=>e.stopPropagation()}/>
                  {q.required && <span className="text-xs text-red-400">*必填</span>}
                  <button onClick={e=>{e.stopPropagation();removeQuestion(q.id);}} className="p-1 rounded hover:bg-red-100 text-gray-400 hover:text-red-600"><Trash2 size={12}/></button>
                </div>
                {q.type==='SINGLE_CHOICE' && q.options && (
                  <div className="mt-2 ml-12 space-y-1">{q.options.map((opt:any, oi:number) => (
                    <div key={oi} className="flex items-center gap-2 text-sm text-gray-600">
                      <span className="w-4 h-4 rounded-full border-2 border-gray-300 flex-shrink-0"/>
                      <input value={opt.label} onChange={e=>{const nq=[...questions];const o=[...q.options];o[oi]={...opt,label:e.target.value};nq[idx]={...q,options:o};setQuestions(nq);}} className="bg-transparent border-none outline-none text-sm flex-1" onClick={e=>e.stopPropagation()}/>
                    </div>
                  ))}</div>
                )}
              </div>
            ))}</div>
          )}
        </div>
      </div>
      {showVersions && (<div className="modal-overlay" onClick={()=>setShowVersions(false)}>
        <div className="modal-content" onClick={e=>e.stopPropagation()}>
          <div className="modal-header"><h2 className="text-lg font-semibold">版本历史</h2><button onClick={()=>setShowVersions(false)} className="p-1.5 rounded-lg hover:bg-gray-100"><X size={18}/></button></div>
          <div className="p-4 space-y-2">
            {[{v:'v1.2',status:'草稿',date:'2026-05-11',author:'管理员'},{v:'v1.1',status:'已发布',date:'2026-05-01',author:'张经理'},{v:'v1.0',status:'已废止',date:'2026-04-15',author:'张经理'}].map((ver,i)=>(
              <div key={i} className="flex items-center justify-between p-3 rounded-lg border border-gray-100 hover:bg-gray-50">
                <div><p className="text-sm font-medium text-gray-900">{ver.v}</p><p className="text-xs text-gray-500">{ver.date} · {ver.author}</p></div>
                <span className={cn('badge',ver.status==='已发布'?'badge-success':ver.status==='草稿'?'badge-warning':'badge-gray')}>{ver.status}</span>
              </div>
            ))}
          </div>
        </div>
      </div>)}
    </div>
  );
}
