'use client';

const auditLogs = [
  { action: 'LOGIN', entityType: 'Auth', entityId: 'user-001', user: 'admin', ip: '192.168.1.1', createdAt: '2025-05-10 09:00:00' },
  { action: 'CREATE', entityType: 'Project', entityId: 'project-012', user: 'pm_zhang', ip: '192.168.1.2', createdAt: '2025-05-10 08:45:00' },
  { action: 'UPDATE', entityType: 'Subject', entityId: 'subject-128', user: 'cra_li', ip: '192.168.1.3', createdAt: '2025-05-10 08:30:00' },
  { action: 'REPLY', entityType: 'Query', entityId: 'query-025', user: 'pi_chen', ip: '192.168.1.4', createdAt: '2025-05-10 08:15:00' },
  { action: 'CLOSE', entityType: 'Query', entityId: 'query-020', user: 'dm_zhao', ip: '192.168.1.5', createdAt: '2025-05-10 08:00:00' },
  { action: 'UPLOAD', entityType: 'Document', entityId: 'doc-040', user: 'siteadmin_wu', ip: '192.168.1.6', createdAt: '2025-05-09 17:30:00' },
  { action: 'EXPORT', entityType: 'Report', entityId: 'report-005', user: 'pm_zhang', ip: '192.168.1.2', createdAt: '2025-05-09 16:00:00' },
  { action: 'UPDATE', entityType: 'AdverseEvent', entityId: 'ae-003', user: 'subi_liu', ip: '192.168.1.7', createdAt: '2025-05-09 15:00:00' },
];

const actionColors: Record<string, string> = {
  LOGIN: 'bg-blue-100 text-blue-700', CREATE: 'bg-green-100 text-green-700',
  UPDATE: 'bg-yellow-100 text-yellow-700', DELETE: 'bg-red-100 text-red-700',
  REPLY: 'bg-purple-100 text-purple-700', CLOSE: 'bg-gray-100 text-gray-700',
  UPLOAD: 'bg-teal-100 text-teal-700', EXPORT: 'bg-orange-100 text-orange-700',
};

export default function AuditLogsPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">审计日志</h1>
      <p className="text-sm text-gray-500">所有关键操作的审计追踪记录</p>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50/50">
              <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">操作</th>
              <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">实体类型</th>
              <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">实体ID</th>
              <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">操作人</th>
              <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">IP地址</th>
              <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">操作时间</th>
            </tr>
          </thead>
          <tbody>
            {auditLogs.map((log, i) => (
              <tr key={i} className="border-b border-gray-50 hover:bg-gray-50/50">
                <td className="px-4 py-3">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${actionColors[log.action] || 'bg-gray-100 text-gray-600'}`}>{log.action}</span>
                </td>
                <td className="px-4 py-3 text-sm text-gray-600">{log.entityType}</td>
                <td className="px-4 py-3 text-sm text-gray-500 font-mono">{log.entityId}</td>
                <td className="px-4 py-3 text-sm text-gray-700">{log.user}</td>
                <td className="px-4 py-3 text-sm text-gray-500 font-mono">{log.ip}</td>
                <td className="px-4 py-3 text-sm text-gray-500">{log.createdAt}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="text-center text-sm text-gray-400">共 200 条审计日志</div>
    </div>
  );
}
