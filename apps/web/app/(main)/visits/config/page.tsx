'use client';

export default function VisitsConfigPage() {
  const visitTemplates = [
    { name: '筛选/基线期', offsetDays: 0, windowBefore: 0, windowAfter: 7, items: ['知情同意书签署', '入排标准评估', '生命体征检查', '体格检查', '实验室检查', '心电图', '随机分组'] },
    { name: '第1周访视', offsetDays: 7, windowBefore: 2, windowAfter: 2, items: ['生命体征检查', '合并用药记录', '不良事件评估', '实验室检查'] },
    { name: '第1月访视', offsetDays: 30, windowBefore: 7, windowAfter: 7, items: ['生命体征检查', '体格检查', '合并用药记录', '不良事件评估', '实验室检查', '问卷评估'] },
    { name: '第3月访视', offsetDays: 90, windowBefore: 7, windowAfter: 7, items: ['生命体征检查', '体格检查', '合并用药记录', '不良事件评估', '实验室检查', '心电图', '影像学检查', '问卷评估'] },
    { name: '第6月访视', offsetDays: 180, windowBefore: 14, windowAfter: 14, items: ['生命体征检查', '体格检查', '合并用药记录', '不良事件评估', '实验室检查', '心电图', '影像学检查', '问卷评估', '疗效评估'] },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">随访计划配置</h1>
          <p className="text-sm text-gray-500 mt-1">管理访视模板与受试者随访计划</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {visitTemplates.map((tpl, idx) => (
          <div key={idx} className="bg-white rounded-xl border border-gray-200 p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-gray-900">{tpl.name}</h3>
              <span className="text-xs text-gray-500">
                Day {tpl.offsetDays > 0 ? `+${tpl.offsetDays}` : tpl.offsetDays}
              </span>
            </div>
            <div className="flex items-center gap-2 mb-3">
              <span className="text-xs px-2 py-0.5 bg-blue-50 text-blue-600 rounded">窗口: {tpl.windowBefore > 0 ? `-${tpl.windowBefore}d` : '当天'} ~ +{tpl.windowAfter}d</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {tpl.items.map((item, i) => (
                <span key={i} className="text-xs px-2 py-1 bg-gray-50 text-gray-600 rounded-md border border-gray-100">{item}</span>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
