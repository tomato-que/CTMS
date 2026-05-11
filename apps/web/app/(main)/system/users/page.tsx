'use client';

import { cn } from '@/lib/utils';

const users = [
  { username: 'admin', realName: '系统管理员', email: 'admin@ctms.com', role: 'Admin', site: '-', status: 'Active' },
  { username: 'pm_zhang', realName: '张经理', email: 'pm_zhang@ctms.com', role: 'PM', site: '-', status: 'Active' },
  { username: 'cra_li', realName: '李监查员', email: 'cra_li@ctms.com', role: 'CRA', site: '北京协和医院', status: 'Active' },
  { username: 'cra_wang', realName: '王监查员', email: 'cra_wang@ctms.com', role: 'CRA', site: '复旦大学附属华山医院', status: 'Active' },
  { username: 'dm_zhao', realName: '赵数据管理', email: 'dm_zhao@ctms.com', role: 'DM', site: '-', status: 'Active' },
  { username: 'pi_chen', realName: '陈主任', email: 'pi_chen@ctms.com', role: 'PI', site: '北京协和医院', status: 'Active' },
  { username: 'subi_liu', realName: '刘副研究员', email: 'subi_liu@ctms.com', role: 'SubI', site: '北京协和医院', status: 'Active' },
  { username: 'siteadmin_wu', realName: '吴机构管理', email: 'siteadmin_wu@ctms.com', role: 'SiteAdmin', site: '北京协和医院', status: 'Active' },
];

const roleLabels: Record<string, string> = {
  Admin: '系统管理员', PM: '项目经理', CRA: '临床监查员', DM: '数据管理员',
  PI: '主要研究者', SubI: '分研究者', SiteAdmin: '机构管理员',
};

export default function UsersPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">用户管理</h1>
          <p className="text-sm text-gray-500 mt-1">管理所有系统用户</p>
        </div>
        <button className="px-4 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700">
          + 新建用户
        </button>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50/50">
              <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">用户名</th>
              <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">姓名</th>
              <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">邮箱</th>
              <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">角色</th>
              <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">所属中心</th>
              <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">状态</th>
              <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">操作</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.username} className="border-b border-gray-50 hover:bg-gray-50/50">
                <td className="px-4 py-3 text-sm font-medium text-gray-900">{u.username}</td>
                <td className="px-4 py-3 text-sm text-gray-700">{u.realName}</td>
                <td className="px-4 py-3 text-sm text-gray-600">{u.email}</td>
                <td className="px-4 py-3 text-sm text-gray-600">{roleLabels[u.role]}</td>
                <td className="px-4 py-3 text-sm text-gray-600">{u.site}</td>
                <td className="px-4 py-3">
                  <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700 font-medium">正常</span>
                </td>
                <td className="px-4 py-3">
                  <button className="text-xs text-primary-600 hover:underline">编辑</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
