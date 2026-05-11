'use client';

const sites = [
  { siteNo: 'SITE-001', name: '北京协和医院', address: '北京市东城区', contactPerson: '李主任', contactPhone: '010-69156114', status: 'Active' },
  { siteNo: 'SITE-002', name: '复旦大学附属华山医院', address: '上海市静安区', contactPerson: '王教授', contactPhone: '021-52889999', status: 'Active' },
  { siteNo: 'SITE-003', name: '中山大学附属第一医院', address: '广州市越秀区', contactPerson: '陈主任', contactPhone: '020-87755766', status: 'Active' },
  { siteNo: 'SITE-004', name: '四川大学华西医院', address: '成都市武侯区', contactPerson: '张教授', contactPhone: '028-85422114', status: 'Active' },
  { siteNo: 'SITE-005', name: '浙江大学医学院附属第一医院', address: '杭州市上城区', contactPerson: '刘主任', contactPhone: '0571-87236114', status: 'Active' },
  { siteNo: 'SITE-006', name: '武汉同济医院', address: '武汉市硚口区', contactPerson: '周教授', contactPhone: '027-83662688', status: 'Active' },
];

export default function SitesPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">中心管理</h1>
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50/50">
              <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">中心编号</th>
              <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">中心名称</th>
              <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">地址</th>
              <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">联系人</th>
              <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">联系电话</th>
              <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">状态</th>
            </tr>
          </thead>
          <tbody>
            {sites.map((s) => (
              <tr key={s.siteNo} className="border-b border-gray-50 hover:bg-gray-50/50">
                <td className="px-4 py-3 text-sm font-medium text-gray-900">{s.siteNo}</td>
                <td className="px-4 py-3 text-sm text-gray-700">{s.name}</td>
                <td className="px-4 py-3 text-sm text-gray-600">{s.address}</td>
                <td className="px-4 py-3 text-sm text-gray-600">{s.contactPerson}</td>
                <td className="px-4 py-3 text-sm text-gray-600">{s.contactPhone}</td>
                <td className="px-4 py-3"><span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700 font-medium">正常</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
