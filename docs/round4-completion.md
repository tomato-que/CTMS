# Round 4 补充章节

> 补充代码骨架未覆盖的：前端页面清单、安全合规详述、测试策略、路线图、风险清单

---

## 九、前端页面清单

### 9.1 管理端页面一览

| 路由 | 页面 | 目标 | 核心组件 | 关键数据API | 权限 |
|------|------|------|----------|-------------|------|
| /login | 登录页 | 用户认证 | Form, Input, Button | POST /auth/login | 公开 |
| /workspace | 角色工作台 | 根据角色展示不同指标卡片和待办 | Statistic, Chart, Table, List | GET /dashboard/{role}-workspace | 所有认证用户 |
| /portfolio | 项目组合 | PM查看所有项目列表与状态 | Table, Tag, Progress, Filter | GET /studies?page&size&status | PM/Sponsor |
| /portfolio/[studyId] | 项目详情 | Tab式项目全貌 | Tabs, Descriptions, Timeline | GET /studies/{id} | PM/CRA/CRC/PI/Sponsor |
| /portfolio/[studyId]/protocol | 方案管理 | 方案版本列表与对比 | Table, Upload, Diff | GET /studies/{id}/protocol-versions | PM/CRA/PI |
| /portfolio/[studyId]/sites | 中心列表 | 该研究下所有中心 | Table, Tag, Progress | GET /studies/{id}/sites | PM/CRA |
| /portfolio/[studyId]/sites/[siteId] | 中心详情 | 中心全貌含研究者 | Descriptions, Table, Timeline | GET /sites/{id} | PM/CRA/CRC/PI |
| /portfolio/[studyId]/subjects | 受试者列表 | 含脱敏/完整切换 | Table, Tag, Search, Toggle | GET /subjects?studyId&masked | PM/CRA/CRC/PI |
| /portfolio/[studyId]/subjects/[subjectId] | 受试者详情 | Tab式: 概览/访视/AE/Query/文档 | Tabs, Timeline, Descriptions | GET /subjects/{id} | CRA/CRC/PI(+PII) |
| /portfolio/[studyId]/subjects/[subjectId]/enrollment | 入组页 | 筛选确认/随机操作 | Form, Steps, Button | POST /subjects/{id}/enroll | CRC/PI |
| /portfolio/[studyId]/visits/config | 访视计划配置 | 访视模板管理 | Table, Drawer, Timeline | GET/POST /visit-templates | PM/CRA |
| /portfolio/[studyId]/subjects/[subjectId]/visits/[visitId] | 访视执行 | 动态表单录入 | DynamicForm, Upload, Table | GET/PUT /visits/{id} | CRC/PI |
| /portfolio/[studyId]/monitoring | 监查计划 | SIV/IMV/COV计划 | Table, Calendar, Tag | GET /monitoring?studyId | CRA/PM |
| /portfolio/[studyId]/monitoring/[visitId] | 监查报告 | 报告填写与SDV确认 | Form, Table, Checkbox | GET/PUT /monitoring/{id} | CRA |
| /portfolio/[studyId]/queries | Query列表 | 按状态/严重度过滤 | Table, Tag, Filter, Aging | GET /queries?studyId | CRA/CRC/PI |
| /portfolio/[studyId]/issues | Issue列表 | 问题跟踪看板 | Board(Kanban), Card, Modal | GET /issues?studyId | PM/CRA/CRC |
| /portfolio/[studyId]/deviations | PD列表 | 方案偏离记录 | Table, Tag(severity), Modal | GET /deviations?studyId | CRA/CRC/PI |
| /portfolio/[studyId]/capas | CAPA列表 | 纠正预防措施 | Table, Steps(progress), Timeline | GET /capas?studyId | PM/CRA/PI |
| /portfolio/[studyId]/safety/aes | AE列表 | 不良事件列表 | Table, Tag(severity/grade) | GET /aes?studyId | CRA/CRC/PI |
| /portfolio/[studyId]/safety/saes/[id] | SAE详情 | SAE全生命周期 | Descriptions, Timeline, FlowSteps | GET /saes/{id} | PM/CRA/PI/Sponsor |
| /portfolio/[studyId]/documents | 文档中心 | TMF风格树形文档 | Tree, Table, Upload, Preview | GET /documents?studyId | PM/CRA/CRC/PI |
| /approvals | 审批中心 | 待审批/已审批列表 | Table, Tabs, Modal(审批) | GET /notifications/todos | PM/PI/Sponsor/Finance |
| /portfolio/[studyId]/finance/budget | 预算页 | 预算明细与执行 | Table, Chart(bar) | GET /budgets?studyId | PM/Sponsor/Finance |
| /portfolio/[studyId]/finance/contracts | 合同页 | 合同列表与审批 | Table, Tag(status), Modal | GET /contracts?studyId | PM/Sponsor/Finance |
| /portfolio/[studyId]/finance/payments | 付款页 | 付款计划与执行 | Table, Timeline | GET /payments?studyId | PM/Finance |
| /portfolio/[studyId]/finance/reimbursements | 补贴页 | 患者报销管理 | Table, Tag, Modal | GET /reimbursements?studyId | CRC/Finance |
| /reports | 报表中心 | 统计、热力图、预测 | Chart(Bar/Line/Heatmap), DatePicker | GET /dashboard/* | PM/Sponsor |
| /audit-logs | 审计日志 | 全量审计记录检索 | Table, Filter, DateRange, Export | GET /audit-logs?filters | Admin/Auditor |
| /settings/users | 用户管理 | 用户CRUD+角色分配 | Table, Modal(Form), Transfer | GET/POST/PUT /users | Admin |
| /settings/roles | 角色管理 | 角色+权限分配 | Table, Tree(perms), Modal | GET/POST /roles | Admin |
| /settings/dictionaries | 字典管理 | 字典类型与项管理 | Table, Drawer, Tree | GET/POST /dict/* | Admin |
| /settings/templates | 模板管理 | 访视/知情/通知模板 | Table, CodeEditor, Preview | GET/POST /templates | Admin/PM |
| /settings/system | 系统参数 | 系统级配置 | Form, Switch, Input | GET/PUT /system/config | Admin |

### 9.2 患者端页面一览

| 路由 | 页面 | 目标 | 核心组件 | 数据来源API | 权限 |
|------|------|------|----------|-------------|------|
| /pages/index | 首页 | 下次访视+待办+消息 | Card, Badge, List | GET /patient/home | Patient/Caregiver |
| /sub-pages/recruitment | 招募页 | 研究列表与预筛入口 | Card, Button, Tag | GET /patient/studies | Patient |
| /sub-pages/recruitment/questionnaire | 预筛问卷 | 入排标准预检 | Form, Radio, Checkbox | POST /patient/pre-screen | Patient |
| /sub-pages/econsent | eConsent | 知情同意书查看与签署 | RichText, Canvas(签名), Button | GET/POST /patient/consent | Patient/Caregiver |
| /sub-pages/caregiver | 监护人授权 | 绑定/解绑照护者 | Form, Switch, List | GET/POST /patient/caregiver | Patient/Caregiver |
| /pages/calendar | 访视日历 | 月视图+访视标记+提醒 | Calendar, Badge, List | GET /patient/visits | Patient |
| /sub-pages/questionnaire | 问卷填写 | ePRO/eDiary | Form(Dynamic), Progress, Timer | GET/POST /patient/questionnaires | Patient/Caregiver |
| /pages/upload | 报告上传 | 拍照/选文件+OCR | Uploader, Progress, Card | POST /files/upload-url → OCR | Patient/Caregiver |
| /sub-pages/ocr-confirm | OCR确认 | 逐字段确认/修正 | Card(Fields), Input, Button | GET/PUT /ocr/{jobId} | Patient/Caregiver |
| /sub-pages/ae-report | AE自报 | 不适症状上报 | Form, DatePicker, Upload | POST /aes | Patient/Caregiver |
| /sub-pages/medication | 用药记录 | 用药日记 | Form, List, Timer | GET/POST /patient/medications | Patient/Caregiver |
| /sub-pages/consultation | 在线咨询 | 图文问答 | Chat, Input, Upload | GET/POST /patient/consultation | Patient |
| /sub-pages/reimbursement | 报销页 | 提交+查看进度 | Form, List, Tag(status), Upload | GET/POST /reimbursements | Patient |
| /sub-pages/education | 宣教资料 | 文章列表+搜索 | List, SearchBar, RichText | GET /patient/education | Patient |
| /sub-pages/privacy | 隐私中心 | 授权管理+访问记录 | List, Switch, Timeline | GET/PUT /patient/privacy | Patient |
| /pages/messages | 消息中心 | 通知列表 | List, Badge, SwipeAction | GET /notifications | Patient |
| /pages/mine | 我的 | 个人信息+设置 | List, Avatar, Cell | GET /patient/profile | Patient |

### 9.3 页面跳转关系

```
PM 工作台 → 项目组合 → 项目详情 → {中心列表, 受试者列表, 访视配置, 监查计划, Query列表, AE列表, 文档中心, 财务报表}
                                    ↓
                              中心详情 → 研究者详情
                              受试者详情 → {入组页, 访视执行, AE详情, Query详情}
```
```
患者首页 → {访视日历, 报告上传 → OCR确认, 问卷填写, AE自报, 在线咨询, 报销}
          → 消息中心 → 消息详情
          → 我的 → {隐私中心, 宣教资料, eConsent, 监护人管理}
```

---

## 十二、安全与合规（精简版）

### 12.1 三层安全模型

| 层 | 内容 | 必须/建议/增强 |
|----|------|---------------|
| 访问控制 | JWT(15min)+Refresh(8h), RBAC+ABAC, 字段脱敏, IP白名单, 登录锁定 | 必须有 |
| 审计追踪 | 全状态变更审计, 敏感访问审计, 审批电子签名, 审计日志不可变+分区 | 必须有 |
| 数据保护 | TLS1.3, AES-256-GCM字段加密, Vault密钥管理, MinIO SSE, 备份加密, 密码策略 | 必须有 |
| 患者隐私 | 授权中心, 数据访问记录, 同意撤回=停止处理, 数据删除权, 最小化采集 | 必须有 |
| GCP/ALCOA+ | 归属性/可读性/实时性/原始性/准确性/完整性/一致性/持久性/可用性 | 必须有 |
| 下载水印 | 下载时动态添加用户+时间水印 | 必须有 |
| 导出审批 | Flowable审批流 → 异步生成 → 水印输出 | 必须有 |
| SIEM集成 | Splunk/ELK兼容日志导出 | 建议有(V1) |
| MFA | TOTP/SMS双因素认证 | 建议有(V1) |
| SBOM | CycloneDX生成, 依赖扫描 | 建议有(V1) |
| 跨境数据 | GDPR充分性认定, PIPL跨境评估 | 后续增强(V2+) |
| 零信任 | 微隔离, 持续验证 | 后续增强(V2+) |

### 12.2 合规责任声明

- 本设计遵循GCP/ALCOA+原则，但不自动保证合规
- 实际合规需：法务审查 + 伦理委员会审批 + 机构SOP对齐 + 申办方要求 + 监管检查
- 未引用具体法律条款编号（因各地法规更新频繁）
- 稽查准备是系统+流程+人员共同责任
- 电子签名法律效力取决于当地法规和机构政策
- 数据出境限制需根据部署地点和适用的数据保护法规确认

---

## 十三、测试策略（精简版）

### 13.1 测试金字塔与目标

| 层级 | 工具 | 目标数量 | 覆盖率目标 |
|------|------|----------|-----------|
| 单元测试 | JUnit5+Mockito / Jest / pytest | 1000+ | Service≥80% |
| 集成测试 | SpringBootTest+Testcontainers | 200+ | 核心API全覆盖 |
| API契约测试 | Spring Cloud Contract / Pact | 100+ | 所有对外API |
| E2E测试 | Playwright (Admin) / 手动 (MiniApp) | 50+ | 关键业务路径 |
| 权限测试 | 自动化+人工审查 | 每角色10+场景 | 100%权限矩阵 |
| 审计测试 | 自动化验证 | 每操作类型 | 100%审计留痕 |
| OCR管道测试 | Golden dataset | 20+报告类型 | 字段准确率≥90% |
| 状态机测试 | 参数化测试 | 所有状态组合 | 100%合法+非法 |
| 工作流测试 | Flowable Test | 所有流程定义 | 100%路径覆盖 |
| 性能基线 | JMeter / k6 | 10个关键端点 | P95<3s(列表) P95<1s(CRUD) |

### 13.2 CI/CD 流水线

```
PR: lint → unit → SAST → dependency scan → contract tests
↓
Main: integration → E2E smoke → Docker build → container scan → deploy staging → E2E full
↓
Release: perf test → OWASP ZAP → SBOM → canary deploy → monitor → full rollout
```

### 13.3 关键测试场景

- **权限:** 每个角色验证可/不可访问每个端点，数据范围过滤，字段脱敏
- **审计:** 状态变更=审计记录，敏感访问=审计记录，审计数据不可修改
- **状态机:** 所有合法流转通过，所有非法流转拒绝，审计记录完整
- **OCR:** 已知报告样本，字段准确率≥阈值，置信度与实际准确率相关
- **工作流:** 所有Flowable流程的愉快路径+驳回路径+SLA超时处理
- **安全:** SQL注入、XSS、JWT篡改、文件MIME绕过、敏感数据泄露

---

## 十四、路线图（精简版）

### MVP (3-4月, 5-6人)

**范围:** CTMS核心闭环 + 患者基础 + AI OCR MVP

- Admin: 工作台、Study/Site/Subject基础管理、AE、Query、文档上传、RBAC
- Patient: 招募、eConsent、上传+OCR(检验报告)、访视日历、AE自报
- AI: PaddleOCR+PaddleX 检验报告识别、人工复核闭环
- Infra: Docker Compose、GitHub Actions CI/CD

**验收:** PM可创建研究追踪入组，CRC可录访视数据，Patient可上传报告看OCR结果，所有状态变更产生审计记录，OCR字段准确率≥90%

### V1 (6-8月, 10-12人)

**范围:** 全部36模块 + 完整权限 + 集成中台

- Admin: 所有14模块完整功能含Flowable审批流
- Patient: 所有12模块含监护代理、ePRO、在线咨询、隐私中心
- AI: 多文档OCR、RAG问答、Copilot、报告自动生成、入组预测、风险评分
- 集成: CDM+FHIR映射、HIS/LIS/EMR适配器(2-3家医院)、EDC适配器、对账

**验收:** 365端点全功能，OCR准确率≥93%，3家医院集成在线，100并发P95<3s

### V2 (12月+)

- 国际化(多语言、GDPR+PIPL跨境)
- 高级AI(医学影像分析、安全信号检测、方案偏离预测)
- Tele-visit视频集成
- 可穿戴设备蓝牙同步
- 完整DICOM浏览器
- 微服务提取(高负载模块独立)
- FHIR Server(HAPI FHIR)
- 多租户CRO运营
- 区块链审计链

### 一期不做

- 完整EDC系统（仅做适配器对接）
- 完完整eTMF系统（仅做文档中心+TMF结构+适配器）
- 独立FHIR Server
- 患者端独立APP（仅微信小程序）
- 在线支付/微信支付集成
- 完整CTMS+EDC+eTMF三合一（不切实际）

---

## 十五、风险清单（精简版）

| # | 风险 | 概率 | 影响 | 缓解 | 责任人 |
|---|------|------|------|------|--------|
| 1 | 功能范围蔓延 | 高 | 高 | 严格MVP边界，变更需PM+TL双重审批 | PM |
| 2 | 用户采纳率低 | 中 | 高 | 早期CRA/CRC参与设计，迭代式UX测试 | PM+UX |
| 3 | 临床流程理解偏差 | 中 | 高 | 临床顾问全程参与，每个模块需临床签字确认 | 临床顾问 |
| 4 | PIPL/GDPR合规不足 | 中 | 高 | 法务审查+DPIA+最小化数据采集 | 法务+安全 |
| 5 | 电子签名法律效力 | 中 | 中 | 咨询药监局/伦理，提供纸质备选 | 法务 |
| 6 | 医院接口不稳定 | 高 | 中 | 适配器模式隔离，重试+DLQ，每医院独立测试 | 集成 |
| 7 | 数据标准不统一 | 高 | 中 | CDM统一内部模型，FHIR映射层，逐医院协商 | 集成 |
| 8 | OCR误识别(假阴性) | 中 | 高 | 低置信度强制人工复核，所有结果人类确认后生效 | AI+CRC |
| 9 | AI给出错误建议 | 中 | 高 | RAG强制引用来源，高风险操作禁止AI自动执行 | AI+PM |
| 10 | 模型漂移 | 中 | 中 | 每月重训，A/B测试，生产监控+自动回滚 | AI |
| 11 | 权限矩阵过于复杂 | 中 | 中 | 角色模板+测试覆盖，简化授权流程 | 架构+QA |
| 12 | 大项目Dashboard慢 | 中 | 中 | 物化视图，Redis缓存，查询优化 | 后端 |
| 13 | 审批流程过多降低效率 | 中 | 中 | 审批类型分级，低风险操作免除审批 | PM |
| 14 | 医院不愿开放接口 | 高 | 高 | 纯手工录入+OCR备选，接口作为增值功能 | PM+商务 |
| 15 | 电子知情不被认可 | 中 | 高 | 提供纸质ICF备选，eConsent作为可选增强 | 临床+法务 |
| 16 | 团队Java能力不足 | 低 | 高 | 招聘时明确技术栈，核心模块由资深开发负责 | TL+HR |
| 17 | 微信小程序审核不通过 | 低 | 中 | 提前提交审核，医疗类目资质准备 | 前端+法务 |

---

## 关键假设 (Key Assumptions)

1. 医院愿意开放接口对接（非技术问题，是商务/行政问题）
2. 临床试验机构允许SaaS或私有化部署
3. 电子知情同意在法律上被认可（取决于具体国家和机构政策）
4. 微信小程序通过医院伦理和隐私审查
5. 受试者有智能手机并能使用微信
6. AI OCR准确率能在真实医院报告上达到可用水平(≥90%)
7. 数据出境限制不影响当前部署方案（中国境内部署）
8. 团队具备Java 21 / Spring Boot 3能力或愿意学习
9. 一期不建完整EDC/eTMF不会成为阻断因素
10. 申办方和CRO愿意使用统一平台
11. 至少3-5家医院愿意作为试点
12. 现有HIS/LIS厂商能够提供接口文档和对接支持
