'use client';

const roles = [
  { code: 'Admin', name: '系统管理员', description: '拥有全部权限', userCount: 1 },
  { code: 'PM', name: '项目经理', description: '负责项目进度、风险、里程碑、中心协调', userCount: 1 },
  { code: 'CRA', name: '临床监查员', description: '负责中心监查、Query发起与关闭、SDV核查', userCount: 2 },
  { code: 'DM', name: '数据管理员', description: '负责数据质疑、数据清理、统计核查', userCount: 1 },
  { code: 'PI', name: '主要研究者', description: '负责本中心受试者、随访和安全事件', userCount: 1 },
  { code: 'SubI', name: '分研究者', description: '协助PI执行研究', userCount: 1 },
  { code: 'SiteAdmin', name: '机构管理员', description: '负责中心信息、伦理文件和递交状态维护', userCount: 1 },
];

export default function RolesPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">角色管理</h1>
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50/50">
              <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">角色编码</th>
              <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">角色名称</th>
              <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">描述</th>
              <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">用户数</th>
            </tr>
          </thead>
          <tbody>
            {roles.map((r) => (
              <tr key={r.code} className="border-b border-gray-50 hover:bg-gray-50/50">
                <td className="px-4 py-3 text-sm font-mono text-gray-600">{r.code}</td>
                <td className="px-4 py-3 text-sm font-medium text-gray-900">{r.name}</td>
                <td className="px-4 py-3 text-sm text-gray-600">{r.description}</td>
                <td className="px-4 py-3 text-sm text-gray-600">{r.userCount}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
