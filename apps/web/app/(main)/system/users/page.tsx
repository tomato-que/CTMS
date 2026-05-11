'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Plus, X, Edit, Lock, Trash2, Check, Loader2, Search, UserPlus } from 'lucide-react';
import { cn } from '@/lib/utils';
import api from '@/lib/api';

const roleLabels:Record<string,string>={ ADMIN:'管理员',PM:'项目经理',CRA:'监查员',CRC:'协调员',PI:'研究者',SPONSOR:'申办方',AUDITOR:'审计员' };

export default function UsersPage() {
  const qc = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{type:'success'|'error',msg:string}|null>(null);
  const [form, setForm] = useState({ username:'',realName:'',email:'',password:'admin123',role:'CRC',status:'Active' });
  const [errors, setErrors] = useState<Record<string,string>>({});
  const [search, setSearch] = useState('');

  const { data: users, isLoading } = useQuery({ queryKey: ['users'], queryFn: () => api.get('/users').then((r:any)=>r.data||[]) });

  const showToast = (t:'success'|'error',m:string) => { setToast({type:t,msg:m}); setTimeout(()=>setToast(null),3000); };

  const openNew = () => { setEditingUser(null); setForm({ username:'',realName:'',email:'',password:'admin123',role:'CRC',status:'Active' }); setErrors({}); setModalOpen(true); };
  const openEdit = (u:any) => { setEditingUser(u); setForm({ username:u.username,realName:u.realName||'',email:u.email||'',password:'',role:u.status||'CRC',status:u.status||'Active' }); setErrors({}); setModalOpen(true); };

  const validate = ():boolean => {
    const e:Record<string,string> = {};
    if(!form.username.trim()) e.username='必填';
    if(!form.realName.trim()) e.realName='必填';
    if(!form.email.trim()) e.email='必填';
    else if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) e.email='格式不正确';
    if(!editingUser&&!form.password.trim()) e.password='必填';
    setErrors(e); return Object.keys(e).length===0;
  };

  const handleSave = async () => {
    if(!validate()) return;
    setSaving(true);
    try {
      let res:any;
      if(editingUser) {
        res = await api.put(`/users/${editingUser.username}`, {realName:form.realName,email:form.email,role:form.role,status:form.status, ...(form.password?{password:form.password}:{})});
      } else {
        res = await api.post('/users', {username:form.username,realName:form.realName,email:form.email,password:form.password,role:form.role,status:form.status});
      }
      if(res.code===0) { setModalOpen(false); qc.invalidateQueries({queryKey:['users']}); showToast('success',editingUser?'用户已更新':'用户已创建'); }
      else showToast('error',res.message||'操作失败');
    } catch { showToast('error','网络错误'); }
    finally { setSaving(false); }
  };

  const handleDelete = async (u:any) => {
    if(!confirm(`确定删除用户 ${u.username} 吗？`)) return;
    try { await api.delete(`/users/${u.username}`); qc.invalidateQueries({queryKey:['users']}); showToast('success','已删除'); }
    catch { showToast('error','删除失败'); }
  };

  const filtered = (users||[]).filter((u:any)=>!search||u.username?.includes(search)||u.realName?.includes(search)||u.email?.includes(search));

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div><h1 className="text-2xl font-bold text-gray-900">用户管理</h1><p className="text-sm text-gray-500 mt-1">管理系统用户与角色分配</p></div>
        <button onClick={openNew} className="inline-flex items-center gap-2 px-4 py-2.5 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 active:scale-[0.98] transition-all shadow-sm"><UserPlus size={16}/>新建用户</button>
      </div>

      {toast&&<div className={cn('fixed top-20 right-6 z-[100] px-4 py-3 rounded-lg shadow-lg text-sm font-medium',toast.type==='success'?'bg-green-600 text-white':'bg-red-600 text-white')}>{toast.type==='success'?<Check size={14} className="inline mr-1"/>:<X size={14} className="inline mr-1"/>}{toast.msg}</div>}

      <div className="flex items-center gap-2 px-3 py-2 bg-white border border-gray-200 rounded-lg w-72">
        <Search size={16} className="text-gray-400 flex-shrink-0"/><input type="text" placeholder="搜索..." value={search} onChange={e=>setSearch(e.target.value)} className="bg-transparent border-none outline-none text-sm w-full"/>
      </div>

      {isLoading?<div className="flex justify-center py-16"><Loader2 size={24} className="animate-spin text-gray-400"/></div>
      :filtered.length===0?<div className="bg-white rounded-xl border border-gray-200 p-16 text-center"><UserPlus size={32} className="text-gray-300 mx-auto mb-3"/><p className="text-gray-400 text-sm">{search?'无匹配':'暂无用户'}</p></div>
      :(<div className="bg-white rounded-xl border border-gray-200 overflow-hidden"><div className="overflow-x-auto"><table className="w-full">
        <thead><tr className="border-b border-gray-100 bg-gray-50/50">
          <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">用户名</th><th className="text-left text-xs font-medium text-gray-500 px-4 py-3">姓名</th><th className="text-left text-xs font-medium text-gray-500 px-4 py-3">邮箱</th><th className="text-left text-xs font-medium text-gray-500 px-4 py-3">角色</th><th className="text-left text-xs font-medium text-gray-500 px-4 py-3">状态</th><th className="text-left text-xs font-medium text-gray-500 px-4 py-3">操作</th></tr></thead>
        <tbody>{filtered.map((u:any)=>(
          <tr key={u.id||u.username} className="border-b border-gray-50 hover:bg-gray-50/50">
            <td className="px-4 py-3 text-sm font-medium text-gray-900">{u.username}</td><td className="px-4 py-3 text-sm text-gray-700">{u.realName||'-'}</td>
            <td className="px-4 py-3 text-sm text-gray-600 max-w-[200px] truncate">{u.email||'-'}</td>
            <td className="px-4 py-3"><span className="text-xs px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 font-medium">{roleLabels[u.status]||u.status||'未知'}</span></td>
            <td className="px-4 py-3"><span className={cn('text-xs px-2 py-0.5 rounded-full font-medium',u.status==='Inactive'?'bg-gray-100 text-gray-600':'bg-green-100 text-green-700')}>{u.status==='Inactive'?'停用':'正常'}</span></td>
            <td className="px-4 py-3"><div className="flex items-center gap-1">
              <button onClick={()=>openEdit(u)} title="编辑" className="p-1.5 rounded hover:bg-gray-100 text-gray-400 hover:text-blue-600"><Edit size={14}/></button>
              <button onClick={()=>handleDelete(u)} title="删除" className="p-1.5 rounded hover:bg-gray-100 text-gray-400 hover:text-red-600"><Trash2 size={14}/></button>
            </div></td></tr>))}</tbody></table></div>
        <div className="px-4 py-3 border-t border-gray-100 text-sm text-gray-500">共 {filtered.length} 个用户</div></div>)}

      {modalOpen&&(
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={()=>setModalOpen(false)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md mx-4" onClick={e=>e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100"><h2 className="text-lg font-semibold">{editingUser?'编辑用户':'新建用户'}</h2><button onClick={()=>setModalOpen(false)} className="p-1.5 rounded-lg hover:bg-gray-100"><X size={18}/></button></div>
            <form onSubmit={e=>{e.preventDefault();handleSave();}} className="px-6 py-4 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div><label className="block text-sm font-medium text-gray-700 mb-1">用户名<span className="text-red-500">*</span></label><input disabled={!!editingUser} value={form.username} onChange={e=>setForm({...form,username:e.target.value})} className={cn('w-full px-3 py-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary-500',editingUser?'bg-gray-50':'',errors.username?'border-red-300':'border-gray-200')}/>{errors.username&&<p className="text-xs text-red-500 mt-1">{errors.username}</p>}</div>
                <div><label className="block text-sm font-medium text-gray-700 mb-1">姓名<span className="text-red-500">*</span></label><input value={form.realName} onChange={e=>setForm({...form,realName:e.target.value})} className={cn('w-full px-3 py-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary-500',errors.realName?'border-red-300':'border-gray-200')}/>{errors.realName&&<p className="text-xs text-red-500 mt-1">{errors.realName}</p>}</div>
              </div>
              <div><label className="block text-sm font-medium text-gray-700 mb-1">邮箱<span className="text-red-500">*</span></label><input value={form.email} onChange={e=>setForm({...form,email:e.target.value})} className={cn('w-full px-3 py-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary-500',errors.email?'border-red-300':'border-gray-200')}/>{errors.email&&<p className="text-xs text-red-500 mt-1">{errors.email}</p>}</div>
              <div><label className="block text-sm font-medium text-gray-700 mb-1">密码{editingUser?' (留空不修改)':''}{!editingUser&&<span className="text-red-500">*</span>}</label><input type="password" value={form.password} onChange={e=>setForm({...form,password:e.target.value})} className={cn('w-full px-3 py-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary-500',errors.password?'border-red-300':'border-gray-200')}/>{errors.password&&<p className="text-xs text-red-500 mt-1">{errors.password}</p>}</div>
              <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
                <button type="button" onClick={()=>setModalOpen(false)} className="px-4 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50">取消</button>
                <button type="submit" disabled={saving} className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 disabled:opacity-50">{saving&&<Loader2 size={14} className="animate-spin"/>}{saving?'保存中...':'保存'}</button>
              </div>
            </form>
          </div>
        </div>)}
    </div>
  );
}
