'use client';

import { useState } from 'react';
import { Search, Plus, X, Check, Loader2, AlertTriangle, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';
import api from '@/lib/api';

interface AeRow { id:string; aeNo:string; aeTerm:string; severity:string; seriousness:string; causality:string; onsetDate:string; subjectNo:string; project:string; isSae:boolean; outcome:string; }
type Sev = 'Mild'|'Moderate'|'Severe'|'LifeThreatening';
type Caus = 'Unlikely'|'Possible'|'Probable'|'Definite'|'NotAssessable';
type Outc = 'Recovered'|'Recovering'|'NotRecovered'|'RecoveredWithSequelae'|'Fatal'|'Unknown';

const initAes: AeRow[] = [
  { id:'1',aeNo:'AE-0001',aeTerm:'ALT升高',severity:'Moderate',seriousness:'NonSerious',causality:'Possible',onsetDate:'2025-04-15',subjectNo:'SUB-001-001',project:'PMS-2024-001',isSae:false,outcome:'Recovered' },
  { id:'2',aeNo:'AE-0002',aeTerm:'高血压',severity:'Severe',seriousness:'Hospitalization',causality:'Probable',onsetDate:'2025-04-20',subjectNo:'SUB-002-005',project:'PMS-2024-002',isSae:true,outcome:'Recovering' },
  { id:'3',aeNo:'AE-0003',aeTerm:'肺炎',severity:'Severe',seriousness:'LifeThreatening',causality:'Possible',onsetDate:'2025-05-01',subjectNo:'SUB-003-012',project:'PMS-2024-003',isSae:true,outcome:'NotRecovered' },
  { id:'4',aeNo:'AE-0004',aeTerm:'头痛',severity:'Mild',seriousness:'NonSerious',causality:'Unlikely',onsetDate:'2025-05-05',subjectNo:'SUB-001-010',project:'PMS-2024-001',isSae:false,outcome:'Recovered' },
];

const sevColors:Record<string,string> = { Mild:'bg-green-100 text-green-700',Moderate:'bg-yellow-100 text-yellow-700',Severe:'bg-orange-100 text-orange-700',LifeThreatening:'bg-red-100 text-red-700' };
const sevLabels:Record<string,string> = { Mild:'轻度',Moderate:'中度',Severe:'重度',LifeThreatening:'危及生命' };
const causLabels:Record<string,string> = { Unrelated:'无关',Unlikely:'可能无关',Possible:'可能有关',Probable:'很可能有关',Definite:'确定有关',NotAssessable:'无法评估' };
const outcLabels:Record<string,string> = { Recovered:'已恢复',Recovering:'恢复中',NotRecovered:'未恢复',RecoveredWithSequelae:'有后遗症',Fatal:'死亡',Unknown:'未知' };

export default function AEPage() {
  const [aes, setAes] = useState<AeRow[]>(initAes);
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{type:'success'|'error',msg:string}|null>(null);
  const [form, setForm] = useState({
    aeTerm:'',severity:'Mild' as Sev,causality:'Possible' as Caus,onsetDate:'',outcome:'Recovered' as Outc,
    subjectNo:'',project:'',isSae:false,seriousness:'NonSerious',
  });
  const [errors, setErrors] = useState<Record<string,string>>({});

  const showToast = (type:'success'|'error',msg:string) => { setToast({type,msg}); setTimeout(()=>setToast(null),3000); };

  const openNew = () => { setForm({aeTerm:'',severity:'Mild',causality:'Possible',onsetDate:'',outcome:'Recovered',subjectNo:'',project:'',isSae:false,seriousness:'NonSerious'}); setErrors({}); setModalOpen(true); };

  const validate = ():boolean => {
    const e:Record<string,string> = {};
    if(!form.aeTerm.trim()) e.aeTerm='AE术语不能为空';
    if(!form.onsetDate) e.onsetDate='发生日期不能为空';
    if(!form.subjectNo.trim()) e.subjectNo='受试者编号不能为空';
    if(!form.project.trim()) e.project='项目不能为空';
    setErrors(e);
    return Object.keys(e).length===0;
  };

  const handleSave = async () => {
    if(!validate()) return;
    setSaving(true);
    try {
      const res:any = await api.post('/aes', {
        studyId:form.project, subjectId:form.subjectNo, aeNumber:'AE-'+Date.now().toString(36).toUpperCase(),
        aeTerm:form.aeTerm, severityGrade:form.severity==='Mild'?1:form.severity==='Moderate'?2:form.severity==='Severe'?3:4,
        causality:form.causality, onsetDate:form.onsetDate, outcome:form.outcome,
        isSerious:form.isSae?1:0, status:'REPORTED',
      });
      if(res.code===0) {
        const newAe: AeRow = { id:Date.now().toString(),aeNo:'AE-'+Date.now().toString(36).toUpperCase(),
          aeTerm:form.aeTerm,severity:form.severity,seriousness:form.isSae?'Serious':'NonSerious',
          causality:form.causality,onsetDate:form.onsetDate,subjectNo:form.subjectNo,
          project:form.project,isSae:form.isSae,outcome:form.outcome };
        setAes(prev => [newAe, ...prev]);
        setModalOpen(false);
        showToast('success','AE记录创建成功');
      } else { showToast('error',res.message||'创建失败'); }
    } catch { showToast('error','创建失败，请检查网络'); }
    finally { setSaving(false); }
  };

  const filtered = aes.filter(a => {
    if(search && !a.aeNo.toLowerCase().includes(search.toLowerCase()) && !a.aeTerm.includes(search) && !a.subjectNo.includes(search)) return false;
    return true;
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold text-gray-900">不良事件 AE</h1><p className="text-sm text-gray-500 mt-1">不良事件登记与管理</p></div>
        <button onClick={openNew} className="flex items-center gap-2 px-4 py-2.5 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 active:scale-[0.98] transition-all">
          <Plus size={16} /> 新增 AE
        </button>
      </div>

      {toast && (
        <div className={cn('fixed top-20 right-6 z-[100] px-4 py-3 rounded-lg shadow-lg text-sm font-medium', toast.type==='success'?'bg-green-600 text-white':'bg-red-600 text-white')}>
          {toast.type==='success'?<Check size={14} className="inline mr-1"/>:<X size={14} className="inline mr-1"/>}{toast.msg}
        </div>
      )}

      {/* Filters */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2 px-3 py-2 bg-white border border-gray-200 rounded-lg w-64">
          <Search size={16} className="text-gray-400"/>
          <input type="text" placeholder="搜索AE编号/术语/受试者..." value={search} onChange={e=>setSearch(e.target.value)} className="bg-transparent border-none outline-none text-sm w-full"/>
        </div>
        <div className="flex bg-gray-100 rounded-lg p-0.5">
          {['全部','AE','SAE'].map((t,i)=>(<button key={t} className={cn('px-3 py-1 text-xs rounded-md transition-colors font-medium', i===0?'bg-white shadow text-gray-900':'text-gray-500')}>{t}</button>))}
        </div>
        <span className="text-xs text-gray-400 ml-auto">{filtered.length} 条记录</span>
      </div>

      {filtered.length===0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-16 text-center">
          <AlertTriangle size={32} className="text-gray-300 mx-auto mb-3"/>
          <p className="text-gray-400 text-sm">暂无不良事件记录</p>
          <button onClick={openNew} className="mt-3 text-primary-600 text-sm hover:underline">立即登记一条AE</button>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead><tr className="border-b border-gray-100 bg-gray-50/50">
                <th className="text-left text-xs font-medium text-gray-500 px-4 py-3 w-[110px]">AE编号</th>
                <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">AE术语</th>
                <th className="text-left text-xs font-medium text-gray-500 px-4 py-3 w-[90px]">严重程度</th>
                <th className="text-left text-xs font-medium text-gray-500 px-4 py-3 w-[60px]">SAE</th>
                <th className="text-left text-xs font-medium text-gray-500 px-4 py-3 w-[100px]">相关性</th>
                <th className="text-left text-xs font-medium text-gray-500 px-4 py-3 w-[110px]">发生日期</th>
                <th className="text-left text-xs font-medium text-gray-500 px-4 py-3 w-[90px]">转归</th>
                <th className="text-left text-xs font-medium text-gray-500 px-4 py-3 w-[120px]">受试者</th>
                <th className="text-left text-xs font-medium text-gray-500 px-4 py-3 w-[140px]">项目</th>
              </tr></thead>
              <tbody>
                {filtered.map((ae) => (
                  <tr key={ae.id} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
                    <td className="px-4 py-3 text-sm font-medium text-primary-600">{ae.aeNo}</td>
                    <td className="px-4 py-3 text-sm text-gray-700">{ae.aeTerm}</td>
                    <td className="px-4 py-3"><span className={cn('text-xs px-2 py-0.5 rounded-full font-medium',sevColors[ae.severity])}>{sevLabels[ae.severity]}</span></td>
                    <td className="px-4 py-3">{ae.isSae?<span className="text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-700 font-medium">是</span>:<span className="text-xs text-gray-400">否</span>}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{causLabels[ae.causality]||ae.causality}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{ae.onsetDate}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{outcLabels[ae.outcome]||ae.outcome}</td>
                    <td className="px-4 py-3 text-sm text-primary-600">{ae.subjectNo}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{ae.project}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="px-4 py-3 border-t border-gray-100 text-sm text-gray-500">共 {filtered.length} 条记录</div>
        </div>
      )}

      {/* New AE Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={()=>setModalOpen(false)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto" onClick={e=>e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h2 className="text-lg font-semibold text-gray-900">新增不良事件</h2>
              <button onClick={()=>setModalOpen(false)} className="p-1.5 rounded-lg hover:bg-gray-100"><X size={18}/></button>
            </div>
            <form onSubmit={e=>{e.preventDefault();handleSave();}} className="px-6 py-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">AE术语 <span className="text-red-500">*</span></label>
                <input value={form.aeTerm} onChange={e=>setForm({...form,aeTerm:e.target.value})} placeholder="如: 高血压、ALT升高、头痛"
                  className={cn('w-full px-3 py-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary-500', errors.aeTerm?'border-red-300':'border-gray-200')}/>
                {errors.aeTerm&&<p className="text-xs text-red-500 mt-1">{errors.aeTerm}</p>}
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">严重程度</label>
                  <select value={form.severity} onChange={e=>setForm({...form,severity:e.target.value as Sev})} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary-500">
                    {Object.entries(sevLabels).map(([k,v])=><option key={k} value={k}>{v}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">与研究药物关系</label>
                  <select value={form.causality} onChange={e=>setForm({...form,causality:e.target.value as Caus})} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary-500">
                    {Object.entries(causLabels).map(([k,v])=><option key={k} value={k}>{v}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">发生日期 <span className="text-red-500">*</span></label>
                  <input type="date" value={form.onsetDate} onChange={e=>setForm({...form,onsetDate:e.target.value})}
                    className={cn('w-full px-3 py-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary-500', errors.onsetDate?'border-red-300':'border-gray-200')}/>
                  {errors.onsetDate&&<p className="text-xs text-red-500 mt-1">{errors.onsetDate}</p>}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">转归</label>
                  <select value={form.outcome} onChange={e=>setForm({...form,outcome:e.target.value as Outc})} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary-500">
                    {Object.entries(outcLabels).map(([k,v])=><option key={k} value={k}>{v}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">受试者编号 <span className="text-red-500">*</span></label>
                  <input value={form.subjectNo} onChange={e=>setForm({...form,subjectNo:e.target.value})} placeholder="如: SUB-001-001"
                    className={cn('w-full px-3 py-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary-500', errors.subjectNo?'border-red-300':'border-gray-200')}/>
                  {errors.subjectNo&&<p className="text-xs text-red-500 mt-1">{errors.subjectNo}</p>}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">关联项目 <span className="text-red-500">*</span></label>
                  <input value={form.project} onChange={e=>setForm({...form,project:e.target.value})} placeholder="如: PMS-2024-001"
                    className={cn('w-full px-3 py-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary-500', errors.project?'border-red-300':'border-gray-200')}/>
                  {errors.project&&<p className="text-xs text-red-500 mt-1">{errors.project}</p>}
                </div>
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={form.isSae} onChange={e=>setForm({...form,isSae:e.target.checked})} className="w-4 h-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"/>
                <span className="text-sm text-gray-700">标记为 SAE（严重不良事件）</span>
              </label>
              {form.isSae && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-start gap-2">
                  <Clock size={16} className="text-red-500 mt-0.5"/>
                  <div><p className="text-sm font-medium text-red-700">SAE 需在 24 小时内上报</p><p className="text-xs text-red-600 mt-0.5">请确保填写 SAE 详细叙事并提交审批</p></div>
                </div>
              )}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-100">
                <button type="button" onClick={()=>setModalOpen(false)} className="px-4 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50">取消</button>
                <button type="submit" disabled={saving}
                  className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 disabled:opacity-50">
                  {saving&&<Loader2 size={14} className="animate-spin"/>}{saving?'保存中...':'保存'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
