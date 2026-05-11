'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Save } from 'lucide-react';
import api from '@/lib/api';

export default function NewProjectPage() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ studyCode: '', title: '', phase: 'PHASE_III', therapeuticArea: '', indication: '', plannedSites: 0, plannedSubjects: 0 });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res: any = await api.post('/studies', form);
      if (res.code === 0) {
        router.push('/projects');
      }
    } catch (err) {
      console.error('Failed to create project:', err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center gap-4">
        <button onClick={() => router.back()} className="p-2 rounded-lg hover:bg-gray-100">
          <ArrowLeft size={18} />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">新建项目</h1>
          <p className="text-sm text-gray-500">创建新的临床研究项目</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">项目编号 *</label>
            <input type="text" required placeholder="如: CTMS-2026-001" value={form.studyCode}
              onChange={(e) => setForm({ ...form, studyCode: e.target.value })}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">研究分期 *</label>
            <select value={form.phase} onChange={(e) => setForm({ ...form, phase: e.target.value })}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm">
              <option value="PHASE_I">I期</option><option value="PHASE_II">II期</option>
              <option value="PHASE_III">III期</option><option value="PHASE_IV">IV期</option>
              <option value="BE">BE</option><option value="OTHER">其他</option>
            </select>
          </div>
          <div className="col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">项目标题 *</label>
            <input type="text" required placeholder="如: XX药物联合XX治疗XX的多中心临床研究" value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">治疗领域</label>
            <input type="text" placeholder="如: 肿瘤" value={form.therapeuticArea}
              onChange={(e) => setForm({ ...form, therapeuticArea: e.target.value })}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">适应症</label>
            <input type="text" placeholder="如: 非小细胞肺癌" value={form.indication}
              onChange={(e) => setForm({ ...form, indication: e.target.value })}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">计划中心数</label>
            <input type="number" value={form.plannedSites || ''}
              onChange={(e) => setForm({ ...form, plannedSites: parseInt(e.target.value) || 0 })}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">计划入组数</label>
            <input type="number" value={form.plannedSubjects || ''}
              onChange={(e) => setForm({ ...form, plannedSubjects: parseInt(e.target.value) || 0 })}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" />
          </div>
        </div>

        <div className="flex items-center gap-3 pt-4 border-t border-gray-100">
          <button type="submit" disabled={saving}
            className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 disabled:opacity-50">
            <Save size={16} /> {saving ? '保存中...' : '保存项目'}
          </button>
          <button type="button" onClick={() => router.back()}
            className="px-4 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50">
            取消
          </button>
        </div>
      </form>
    </div>
  );
}
