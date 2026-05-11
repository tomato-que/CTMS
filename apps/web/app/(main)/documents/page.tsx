'use client';

import { useState, useRef } from 'react';
import { FileText, Download, Eye, Upload, X, Check, Loader2, UploadCloud, File } from 'lucide-react';
import { cn } from '@/lib/utils';
import api from '@/lib/api';

interface Document {
  title: string; category: string; version: string; status: string; project: string; uploadedBy: string; date: string; fileSize?: string;
}

const docCategories = [
  { key:'01',label:'项目管理文件' },{ key:'02',label:'伦理委员会文件' },{ key:'03',label:'研究者手册' },
  { key:'04',label:'方案与修订' },{ key:'05',label:'知情同意书' },{ key:'06',label:'病例报告表' },
  { key:'07',label:'安全性报告' },{ key:'08',label:'统计分析计划' },
];

const initDocs: Document[] = [
  { title:'项目启动会纪要',category:'01_项目管理文件',version:'v1.0',status:'Approved',project:'PMS-2024-001',uploadedBy:'管理员',date:'2024-01-20' },
  { title:'伦理批准通知',category:'02_伦理委员会文件',version:'v1.0',status:'Approved',project:'PMS-2024-001',uploadedBy:'吴机构管理',date:'2024-02-15' },
  { title:'研究者手册 v2.0',category:'03_研究者手册',version:'v2.0',status:'Submitted',project:'PMS-2024-002',uploadedBy:'管理员',date:'2024-03-10' },
];

const statusColors:Record<string,string> = { Draft:'bg-gray-100 text-gray-600',Submitted:'bg-yellow-100 text-yellow-700',Approved:'bg-green-100 text-green-700',Rejected:'bg-red-100 text-red-700',Archived:'bg-purple-100 text-purple-700' };
const statusLabels:Record<string,string> = { Draft:'草稿',Submitted:'已递交',Approved:'已批准',Rejected:'已驳回',Archived:'已归档' };

export default function DocumentsPage() {
  const [docs, setDocs] = useState<Document[]>(initDocs);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File|null>(null);
  const [uploadForm, setUploadForm] = useState({ category:'01_项目管理文件',version:'v1.0',project:'' });
  const [toast, setToast] = useState<{type:'success'|'error',msg:string}|null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const showToast = (type:'success'|'error',msg:string) => { setToast({type,msg}); setTimeout(()=>setToast(null),3000); };

  const handleFileSelect = (file:File|null) => {
    if(!file) return;
    const allowed = ['application/pdf','image/jpeg','image/png','application/vnd.openxmlformats-officedocument.wordprocessingml.document','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'];
    if(!allowed.includes(file.type)) { showToast('error','不支持的文件类型'); return; }
    if(file.size>50*1024*1024) { showToast('error','文件大小不能超过50MB'); return; }
    setSelectedFile(file);
  };

  const handleUpload = async () => {
    if(!selectedFile) { showToast('error','请先选择文件'); return; }
    setUploading(true);
    try {
      const res:any = await api.post('/files/upload-url', {
        fileName: selectedFile.name, mimeType: selectedFile.type, fileSize: selectedFile.size,
        belongEntity: 'document', documentCategory: uploadForm.category,
      });
      if(res.code===0) {
        setDocs(prev => [{
          title: selectedFile.name, category: uploadForm.category, version: uploadForm.version,
          status:'Draft', project: uploadForm.project||'新项目', uploadedBy:'当前用户', date: new Date().toISOString().slice(0,10),
          fileSize: (selectedFile.size/1024/1024).toFixed(1)+'MB',
        }, ...prev]);
        setUploadOpen(false); setSelectedFile(null);
        showToast('success','文档上传成功');
      } else { showToast('error', res.message||'上传失败'); }
    } catch { showToast('error','上传失败，请检查网络'); }
    finally { setUploading(false); }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold text-gray-900">eTMF 文档管理</h1><p className="text-sm text-gray-500 mt-1">临床试验主文件管理</p></div>
        <button onClick={()=>{setSelectedFile(null);setUploadForm({category:'01_项目管理文件',version:'v1.0',project:''});setUploadOpen(true);}}
          className="flex items-center gap-2 px-4 py-2.5 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 active:scale-[0.98] transition-all">
          <Upload size={16} /> 上传文档
        </button>
      </div>

      {toast && (
        <div className={cn('fixed top-20 right-6 z-[100] px-4 py-3 rounded-lg shadow-lg text-sm font-medium', toast.type==='success'?'bg-green-600 text-white':'bg-red-600 text-white')}>
          {toast.type==='success'?<Check size={14} className="inline mr-1"/>:<X size={14} className="inline mr-1"/>}{toast.msg}
        </div>
      )}

      {/* Category Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        {docCategories.map((cat) => (
          <div key={cat.key} className="bg-white rounded-xl border border-gray-200 p-4 hover:border-primary-300 hover:shadow-sm cursor-pointer transition-all">
            <FileText size={20} className="text-primary-500 mb-2" />
            <p className="text-sm font-medium text-gray-900 line-clamp-2">{cat.key}. {cat.label}</p>
            <p className="text-xs text-gray-400 mt-1">0 份文档</p>
          </div>
        ))}
      </div>

      {/* Document Table */}
      {docs.length===0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-16 text-center">
          <File size={32} className="text-gray-300 mx-auto mb-3"/>
          <p className="text-gray-400 text-sm">暂无文档</p>
          <button onClick={()=>setUploadOpen(true)} className="mt-3 text-primary-600 text-sm hover:underline">上传第一份文档</button>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead><tr className="border-b border-gray-100 bg-gray-50/50">
                <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">文档标题</th>
                <th className="text-left text-xs font-medium text-gray-500 px-4 py-3 w-[140px]">分类</th>
                <th className="text-left text-xs font-medium text-gray-500 px-4 py-3 w-[70px]">版本</th>
                <th className="text-left text-xs font-medium text-gray-500 px-4 py-3 w-[80px]">状态</th>
                <th className="text-left text-xs font-medium text-gray-500 px-4 py-3 w-[130px]">项目</th>
                <th className="text-left text-xs font-medium text-gray-500 px-4 py-3 w-[100px]">上传人</th>
                <th className="text-left text-xs font-medium text-gray-500 px-4 py-3 w-[100px]">日期</th>
                <th className="text-left text-xs font-medium text-gray-500 px-4 py-3 w-[100px]">操作</th>
              </tr></thead>
              <tbody>
                {docs.map((doc,i) => (
                  <tr key={i} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
                    <td className="px-4 py-3 text-sm text-gray-900 max-w-[250px] truncate" title={doc.title}>{doc.title}</td>
                    <td className="px-4 py-3 text-xs text-gray-500">{doc.category}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{doc.version}</td>
                    <td className="px-4 py-3"><span className={cn('text-xs px-2 py-0.5 rounded-full font-medium',statusColors[doc.status])}>{statusLabels[doc.status]}</span></td>
                    <td className="px-4 py-3 text-sm text-gray-600">{doc.project}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{doc.uploadedBy}</td>
                    <td className="px-4 py-3 text-sm text-gray-500">{doc.date}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <button onClick={()=>showToast('success','预览功能开发中')} title="查看" className="p-1.5 rounded hover:bg-gray-100 text-gray-400 hover:text-blue-600"><Eye size={14}/></button>
                        <button onClick={()=>showToast('success','下载已开始')} title="下载" className="p-1.5 rounded hover:bg-gray-100 text-gray-400 hover:text-green-600"><Download size={14}/></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="px-4 py-3 border-t border-gray-100 text-sm text-gray-500">共 {docs.length} 份文档</div>
        </div>
      )}

      {/* Upload Modal */}
      {uploadOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={()=>setUploadOpen(false)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md mx-4" onClick={e=>e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h2 className="text-lg font-semibold text-gray-900">上传文档</h2>
              <button onClick={()=>setUploadOpen(false)} className="p-1.5 rounded-lg hover:bg-gray-100"><X size={18}/></button>
            </div>
            <div className="px-6 py-4 space-y-4">
              {/* Drag & Drop */}
              <div onDragOver={e=>{e.preventDefault();setDragOver(true);}} onDragLeave={()=>setDragOver(false)}
                onDrop={e=>{e.preventDefault();setDragOver(false);handleFileSelect(e.dataTransfer.files[0]);}}
                onClick={()=>fileRef.current?.click()}
                className={cn('border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors', dragOver?'border-primary-400 bg-primary-50':'border-gray-300 hover:border-primary-300 hover:bg-gray-50')}>
                {selectedFile ? (
                  <div className="space-y-2">
                    <File size={32} className="text-primary-500 mx-auto"/>
                    <p className="text-sm font-medium text-gray-900">{selectedFile.name}</p>
                    <p className="text-xs text-gray-500">{(selectedFile.size/1024/1024).toFixed(2)} MB</p>
                    <button onClick={(e)=>{e.stopPropagation();setSelectedFile(null);}} className="text-xs text-red-500 hover:underline">移除文件</button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <UploadCloud size={36} className="text-gray-400 mx-auto"/>
                    <p className="text-sm text-gray-600">拖拽文件到此处，或点击选择</p>
                    <p className="text-xs text-gray-400">支持 PDF, JPG, PNG, DOCX, XLSX · 最大 50MB</p>
                  </div>
                )}
                <input ref={fileRef} type="file" className="hidden" accept=".pdf,.jpg,.jpeg,.png,.docx,.xlsx" onChange={e=>handleFileSelect(e.target.files?.[0]||null)}/>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">文档分类</label>
                <select value={uploadForm.category} onChange={e=>setUploadForm({...uploadForm,category:e.target.value})}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary-500">
                  {docCategories.map(c=><option key={c.key} value={`${c.key}_${c.label}`}>{c.key}. {c.label}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">版本号</label>
                  <input value={uploadForm.version} onChange={e=>setUploadForm({...uploadForm,version:e.target.value})}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary-500"/>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">关联项目</label>
                  <input value={uploadForm.project} onChange={e=>setUploadForm({...uploadForm,project:e.target.value})} placeholder="项目编号"
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary-500"/>
                </div>
              </div>
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-100">
                <button onClick={()=>setUploadOpen(false)} className="px-4 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50">取消</button>
                <button onClick={handleUpload} disabled={!selectedFile||uploading}
                  className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 disabled:opacity-50">
                  {uploading&&<Loader2 size={14} className="animate-spin"/>}{uploading?'上传中...':'确认上传'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
