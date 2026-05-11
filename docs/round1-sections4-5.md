# 临床研究项目运营管理平台 (PMS/CTMS) — Round 1 设计文档
## 第二部分：数据模型总览 · 技术架构总览

---

# 四、数据模型总览 (Data Model Overview)

## 4.1 核心实体分组 (Core Entity Grouping)

本节将 36 个核心实体按业务域分为 8 组，并说明每组内部及跨组关系。

### 4.1.1 组织与项目 (Organization & Study) — 5 实体

| 实体 | 英文名 | 用途 | 类型 |
|------|--------|------|------|
| Organization | organizations | 申办方/CRO/SMO/中心机构/供应商等组织主体 | 主数据 |
| Study | studies | 临床研究/试验项目主记录 | 主数据 |
| ProtocolVersion | protocol_versions | 方案的多版本管理（含版本号、生效日期、审批状态） | 主数据 |
| StudyMilestone | study_milestones | 项目里程碑（FPI、LPO、DBL、CSR 等） | 主数据 |
| StudyTask | study_tasks | 项目任务清单（如"提交机构立项"、"取得伦理批件"） | 交易数据 |

**组内关系：**
- Organization 1:N Study（申办方/Sponsor；CRO；各参与中心）
- Study 1:N ProtocolVersion（一个研究可以有多个方案版本）
- Study 1:N StudyMilestone
- Study 1:N StudyTask

**跨组关系：**
- Study → Site（多对多，通过 study_site 中间表）
- Study → Subject（一个研究下有多名受试者）
- Study → Budget / Contract / Payment

---

### 4.1.2 中心与研究者 (Site & Investigator) — 2 实体

| 实体 | 英文名 | 用途 | 类型 |
|------|--------|------|------|
| Site | sites | 研究中心/临床试验机构（如某三甲医院呼吸科） | 主数据 |
| Investigator | investigators | 研究者个人档案（含资质、GCP 培训记录） | 主数据 |

**组内关系：**
- Site 1:N Investigator（一个中心有多名研究者，含 PI/Sub-I）
- Site N:M Study（通过 study_site 关联）

**跨组关系：**
- Site → Subject（受试者归属于特定中心）
- Site → Visit / Monitoring（中心是监查和访视的执行地）
- Site → Budget / Contract / Payment

---

### 4.1.3 受试者与知情同意 (Subject & Consent) — 6 实体

| 实体 | 英文名 | 用途 | 类型 |
|------|--------|------|------|
| Screening | screenings | 筛选记录（预筛→知情→筛选期评估） | 交易数据 |
| Subject | subjects | 受试者主记录（含随机号、分层因子、状态） | 混合型：ID 为主数据，状态与事件为交易数据 |
| Enrollment | enrollments | 入组记录（含入组日期、随机结果、分层信息） | 交易数据 |
| ConsentTemplate | consent_templates | 知情同意书模板（机构/伦理审核版） | 主数据 |
| ConsentVersion | consent_versions | 知情同意书版本（含文件 hash、生效日期） | 主数据 |
| ConsentRecord | consent_records | 受试者签署记录（含时间戳、IP、电子签名） | 交易数据 |

**组内关系：**
- Subject 1:1 Screening（一对一筛选流程）
- Subject 1:1 Enrollment（一对一入组）
- Subject 1:N ConsentRecord（每次知情同意一个签署记录）
- ConsentTemplate 1:N ConsentVersion
- ConsentVersion 1:N ConsentRecord

**跨组关系：**
- Subject → Site（属于哪个中心）
- Subject → Study（属于哪个研究）
- Subject → Visit（受试者有多条访视）
- Subject → AE / SAE（安全性事件）

---

### 4.1.4 访视与数据采集 (Visit & Data Collection) — 6 实体

| 实体 | 英文名 | 用途 | 类型 |
|------|--------|------|------|
| VisitTemplate | visit_templates | 访视计划模板（筛选、基线、治疗期、随访期访视） | 主数据 |
| Visit | visits | 受试者实际访视记录 | 交易数据 |
| Questionnaire | questionnaires | 问卷/量表定义（如 QLQ-C30、EQ-5D-5L） | 主数据 |
| QuestionnaireResponse | questionnaire_responses | 受试者填写的问卷应答 | 交易数据 |
| Observation | observations | 临床观察/测量值（生命体征、实验室值、体检发现） | 交易数据 |
| DiagnosticReport | diagnostic_reports | 诊断报告（影像、病理、心电图等），含 OCR 结构化结果 | 交易数据 |

**组内关系：**
- VisitTemplate 1:N Visit（模板生成实际访视计划）
- Visit 1:N QuestionnaireResponse（一次访视可填写多份问卷）
- Visit 1:N Observation（一次访视采集多项测量值）
- Visit 1:N DiagnosticReport（一次访视关联多项报告）

**跨组关系：**
- Visit → Subject（归属于某受试者）
- Observation / DiagnosticReport → OCRJob（OCR 识别来源）
- DiagnosticReport → FileObject（原始报告文件）

---

### 4.1.5 质量与安全 (Quality & Safety) — 6 实体

| 实体 | 英文名 | 用途 | 类型 |
|------|--------|------|------|
| Issue | issues | 问题/事件管理（通用问题跟踪） | 交易数据 |
| Query | queries | 数据质疑（SDV/SDR/数据管理中发现问题） | 交易数据 |
| ProtocolDeviation | protocol_deviations | 方案偏离记录 | 交易数据 |
| CAPA | capas | 纠正与预防措施 | 交易数据 |
| AE | aes | 不良事件（含 CTCAE 分级、与研究药物关系判断） | 交易数据 |
| SAE | saes | 严重不良事件（含上报时限、升级路径） | 交易数据 |

**组内关系：**
- Query → Issue（Query 是 Issue 的子类型/特殊化，可单独或合并处理）
- Query → Subject（指向特定受试者）
- Issue → CAPA（Issue 可触发 CAPA）
- ProtocolDeviation → CAPA（严重偏离可触发 CAPA）
- AE → SAE（AE 满足严重性标准时升级为 SAE）
- AE → Subject / Visit（归属受试者和特定访视）

**跨组关系：**
- Query → Visit / Observation（针对特定数据点）
- Issue → Study / Site（归属于项目和中心）

---

### 4.1.6 财务 (Finance) — 5 实体

| 实体 | 英文名 | 用途 | 类型 |
|------|--------|------|------|
| Budget | budgets | 项目预算（分中心预算、总预算） | 主数据 |
| Contract | contracts | 合同（中心合同、供应商合同、CRO 合同） | 主数据 |
| Invoice | invoices | 发票（中心开票、供应商开票） | 交易数据 |
| Payment | payments | 付款记录（中心付款、患者补贴发放） | 交易数据 |
| Reimbursement | reimbursements | 患者报销记录（交通、住宿补贴等） | 交易数据 |

**组内关系：**
- Budget → Contract → Invoice → Payment（预算→合同→开票→付款链路）
- Reimbursement → Subject（归属受试者）
- Reimbursement → Visit（关联特定访视）

**跨组关系：**
- Budget / Contract / Payment → Study / Site
- Reimbursement → Subject

---

### 4.1.7 文件与 AI (Files & AI) — 2 实体

| 实体 | 英文名 | 用途 | 类型 |
|------|--------|------|------|
| FileObject | file_objects | 文件/附件元数据（含存储路径、hash、版本） | 混合型 |
| OCRJob | ocr_jobs | OCR 识别任务（含输入文件、模型版本、置信度、输出 JSONB） | 交易数据 |

**组内关系：**
- OCRJob → FileObject（OCR 任务处理的源文件）

**跨组关系：**
- FileObject → Study / Site / Subject / Visit 等（多态关联，通过 file_belong 字段）
- OCRJob → DiagnosticReport / Observation（OCR 结果回写）
- FileObject ↔ 几乎所有业务实体（文档附件）

---

### 4.1.8 系统与集成 (System & Integration) — 4 实体

| 实体 | 英文名 | 用途 | 类型 |
|------|--------|------|------|
| AuditLog | audit_logs | 审计日志（所有关键操作、敏感访问的不可变记录） | 系统数据 |
| Notification | notifications | 通知消息（站内信、待办、提醒） | 交易数据 |
| IntegrationTask | integration_tasks | 数据集成同步任务（HIS/LIS/EDC 对接的执行记录） | 交易数据 |
| RiskSignal | risk_signals | 风险信号（自动检测的风险指标，含严重级别、置信度） | 交易数据 |

**组内关系：**
- RiskSignal → Study / Site / Subject（风险归属）
- Notification → User（消息接收者）
- IntegrationTask → 外部系统接口适配器

**跨组关系：**
- AuditLog 覆盖所有实体（全局审计）
- Notification 来源于各个业务模块（待办事项、审批通知、系统告警）

---

## 4.2 实体关系总览 (Entity Relationship Overview)

### 4.2.1 以 Study 为中心的 ER 总览

```
                        ┌──────────────────────┐
                        │    Organization       │ (Sponsor, CRO, SiteOrg, Vendor...)
                        └──────────┬───────────┘
                                   │ 1:N (sponsor_id, cro_id)
                        ┌──────────▼───────────┐
                        │       Study           │ ◄── 中心实体
                        │  study_id (PK, UUID)  │
                        │  protocol_id          │
                        │  sponsor_org_id (FK)  │
                        │  status               │
                        │  phase                │
                        │  therapeutic_area     │
                        └──┬────┬────┬────┬────┘
                           │    │    │    │
              ┌────────────┘    │    │    └──────────────┐
              ▼                 │    ▼                    ▼
   ┌──────────────────┐        │  ┌────────────┐  ┌──────────────┐
   │  ProtocolVersion │        │  │   Budget    │  │StudyMilestone│
   └──────────────────┘        │  └────────────┘  └──────────────┘
                               │
              ┌────────────────┼────────────────┐
              ▼                ▼                 ▼
   ┌──────────────────┐  ┌──────────────┐  ┌──────────────┐
   │   study_site     │  │   Subject    │  │   Document   │
   │ (Study N:M Site) │  │ (per study)  │  │  (FileObject) │
   └────────┬─────────┘  └──────┬───────┘  └──────────────┘
            │                   │
   ┌────────▼─────────┐  ┌──────▼──────────────────┐
   │      Site        │  │   Visit / AE / SAE      │
   │  site_id (PK)    │  │   Query / PD / Consent  │
   │  status          │  │   Enrollment / Screening│
   └────────┬─────────┘  └─────────────────────────┘
            │
   ┌────────▼─────────┐
   │  Investigator    │
   │  (PI, Sub-I)     │
   └──────────────────┘
```

核心关系链：
1. **Study → Site → Subject → Visit → Observation**（从项目到数据点的完整路径）
2. **Subject → AE → SAE**（安全性上报升级链路）
3. **Study → Contract → Invoice → Payment**（财务执行链路）
4. **Subject → ConsentRecord**（知情同意生命周期）

### 4.2.2 主数据与交易数据划分

#### 主数据 (Master Data)

特点是：创建后长期稳定，变更频率低，变更需审批或审计。通常不直接在业务操作中频繁修改。

| 实体 | 生命周期 | 变更审批 |
|------|----------|----------|
| Organization | 持续存在，信息更新较少 | 管理员操作 + 审计 |
| Site | Candidate → Active → Closed | 需 PM 审批 |
| Investigator | 持续存在，定期更新资质 | 管理员 + 审计 |
| Study | Draft → Startup → Enrolling → Followup → Locked → Archived | 状态变更需审批 |
| ProtocolVersion | 版本递增，旧版本只读 | 需审批 |
| VisitTemplate | 研究启动时定义，归档后只读 | 需 PM/PI 审批 |
| Questionnaire | 研究启动时定义，归档后只读 | 需审批 |
| ConsentTemplate | 版本化管理，新版本需伦理审批 | 需审批 |
| Budget | 可调整，每个版本的变更需审批 | 需 Sponsor/PM 审批 |

#### 交易数据 (Transaction Data)

特点是：随业务操作不断产生，频繁增改，有明确的状态机流转，通常不可物理删除。

| 实体 | 产生时机 | 最终状态 |
|------|----------|----------|
| Screening | 受试者进入筛选 | Completed / Failed |
| Subject | 知情同意后创建 | Completed / Withdrawn / Lost |
| Enrollment | 筛选成功后 | Enrolled |
| Visit | 按访视计划生成 | Completed / Missed |
| QuestionnaireResponse | 受试者/CRC 填写 | Submitted / Verified |
| Observation | 访视中采集 | Verified / Locked |
| DiagnosticReport | 上传/采集后 | Confirmed / Reviewed |
| AE | 获知不良事件后 | Resolved / Recovered |
| SAE | AE 升级后 | Closed |
| Query | SDV/SDR 发现问题 | Closed |
| Payment | 审批通过后 | Paid |
| AuditLog | 任何操作触发 | N/A（不可变） |

---

## 4.3 敏感数据识别 (Sensitive Data Identification)

### 4.3.1 敏感数据分级

| 级别 | 名称 | 定义 | 示例 |
|------|------|------|------|
| S0 | Public | 可公开信息 | 研究公示编号 (NCTxxxxx)、公开方案标题 |
| S1 | Internal | 内部运营数据 | 内部项目代号、组织架构、非敏感的统计数字 |
| S2 | Confidential | 商业机密/研究机密 | 方案全文、未公开结果数据、随机序列、预算细节 |
| S3 | Restricted | 受限访问数据 | 研究者个人联系信息、受试者姓名 |
| S4 | PII | 个人身份信息 | 身份证号、手机号、住址、银行卡号、生物特征 |
| S5 | PHI | 受保护健康信息 | 诊断信息、基因数据、实验室结果、影像报告、AE 详情 |

### 4.3.2 各实体敏感字段清单

| 实体 | 敏感字段 | 敏感级别 | 处理方式 |
|------|----------|----------|----------|
| Subject | real_name, id_number, phone, address, medical_history | S4/S5 | 加密存储 + 字段级脱敏 + 访问审计 |
| Subject | randomization_code, stratification_factors | S2 | 加密存储 + 严格权限控制 |
| Investigator | phone, email, license_number | S3 | 字段级脱敏 |
| AE | event_detail, causality_assessment | S5 | JSONB 加密 + 访问审计 |
| SAE | narrative, medical_review | S5 | 加密存储 + 审批流控制 |
| DiagnosticReport | report_content, ocr_result | S5 | 文件加密 + MinIO 服务端加密 |
| Observation | value, result | S5 | 访问审计（非加密，因需查询统计） |
| FileObject | storage_path | S2 | MinIO SSE + presigned URL |
| ConsentRecord | signature_image, ip_address | S4 | 加密存储 + 仅 PI/Auditor 可访问 |
| Budget | total_amount, line_items | S2 | 字段级脱敏 (Finance 角色除外) |
| Payment | bank_account, amount | S4/S2 | 银行账号加密，金额脱敏 |
| AuditLog | (全部) | S1 | 分区存储，只读，不可删除 |

### 4.3.3 数据库级加密策略

- **传输加密 (TLS 1.3)**：所有数据库连接、服务间通信
- **存储加密**：PostgreSQL pgcrypto 扩展或应用层 AES-256-GCM 加密 S4/S5 字段
- **文件加密**：MinIO Server-Side Encryption (SSE-S3)
- **备份加密**：pg_dump 密文存储
- **密钥管理**：生产环境使用 Kubernetes Secrets + HashiCorp Vault（V2+）

---

## 4.4 审计要求 (Audit Requirements)

### 4.4.1 需要审计的操作类型

| 操作类型 | 描述 | 审计粒度 | 示例 |
|----------|------|----------|------|
| STATE_CHANGE | 任何业务实体的状态变更 | before/after 快照 | subject.status: enrolled → withdrawn |
| SENSITIVE_ACCESS | 访问含 S3+ 级别数据 | 访问者 + 被访问字段 + 时间 | 查看受试者身份证号 |
| EXPORT | 任何数据导出操作 | 导出范围、条数、格式、审批单号 | 导出中心 AE 列表 |
| DOWNLOAD | 文件下载 | 文件 ID + hash + 下载者 | 下载受试者 CT 报告 |
| DELETE | 任何软删除操作 | 删除对象 + 原因 | 软删除某中心 |
| PERMISSION_CHANGE | 权限/角色变更 | before/after + 操作者 | 授权某 CRA 访问新中心 |
| AI_CONFIRMATION | AI 结果的人工确认/驳回 | OCRJob ID + 操作者 + 决策 | CRC 确认 OCR 提取的血常规值 |
| APPROVAL | 审批操作（通过/驳回） | 审批节点 + 意见 + 时间戳 | PI 审批 SAE 上报 |
| LOGIN | 用户登录/登出 | IP + 设备 + 时间 | 异常 IP 登录告警 |
| CONFIG_CHANGE | 系统配置变更 | 配置项 + before/after | 修改字典项、研究参数 |

### 4.4.2 审计日志核心字段

| 字段 | 类型 | 说明 |
|------|------|------|
| audit_id | UUID PK | 审计记录主键 |
| trace_id | VARCHAR(64) | 全链路追踪 ID |
| user_id | UUID FK | 操作用户 |
| user_role | VARCHAR(50) | 操作时的角色 |
| operation_type | ENUM | STATE_CHANGE / SENSITIVE_ACCESS / EXPORT / ... |
| target_entity | VARCHAR(100) | 操作目标实体类型，如 "Subject" |
| target_id | UUID | 操作目标实体 ID |
| target_field | VARCHAR(200) | 操作目标字段（字段级审计） |
| before_value | JSONB | 操作前值（脱敏存储） |
| after_value | JSONB | 操作后值（脱敏存储） |
| operation_detail | JSONB | 额外上下文信息 |
| ip_address | INET | 客户端 IP |
| user_agent | TEXT | 客户端 UA |
| created_at | TIMESTAMPTZ | 操作时间（UTC，不可变，无 updated_at） |

### 4.4.3 审计日志存储策略

- 独立表 `audit_logs`，按月分区 (PARTITION BY RANGE on created_at)
- 不可物理删除，不可修改
- 保留期：在线 3 年，归档至对象存储 (archive bucket) 后在线清理
- OpenSearch 同步索引用于快速检索和稽查
- S3/S4 级别审计记录加密存储 before_value/after_value

---

## 4.5 OpenSearch 索引规划 (OpenSearch Index Planning)

| 索引名称 | 同步来源 | 用途 | 预计体积 |
|----------|----------|------|----------|
| idx_file_content | FileObject (解析后的文本) | 文档全文检索、SOP 搜索 | 大 |
| idx_ocr_result | OCRJob | OCR 提取文本的全文检索 | 大 |
| idx_subject | Subject（脱敏字段） | 受试者检索（去标识化搜索） | 中 |
| idx_query | Query | Query 文本内容搜索 + 相似 Query 推荐 | 中 |
| idx_sae | SAE | SAE 描述搜索、安全性信号检测 | 中 |
| idx_ae | AE | AE 描述搜索 | 中 |
| idx_audit_log | AuditLog | 审计记录快速检索、稽查用 | 大 |
| idx_knowledge_base | SOP 文档、培训材料 | AI RAG 知识库检索 | 中 |
| idx_patient_education | 患者宣教材料 | 患者端知识搜索 | 小 |
| idx_protocol | ProtocolVersion (解析后) | 方案内容检索 | 小 |

所有索引均不包含 S4/S5 明文数据。敏感字段仅存储已脱敏/masked 版本。

---

## 4.6 AI/RAG 数据源 (AI/RAG Data Sources)

| 数据源 | AI 用途 | 数据流向 | 留痕要求 |
|--------|---------|----------|----------|
| ProtocolVersion (解析后) | PM/CRA Copilot 问答知识库 | Java API → OpenSearch → AI Service | 引用方案版本号 + 段落位置 |
| SOP 文档 (FileObject, 已解析) | Copilot 问答、流程自动化建议 | Java API → OpenSearch → AI Service | 引用 SOP 编号 + 版本 |
| Query 历史 | 智能 Query 建议、相似 Query 检索 | Java API → OpenSearch → AI Service | 引用 Query ID |
| AE/SAE 历史 | 安全性信号检测、风险评分模型 | Java API → AI Service (离线) | 模型版本 + 输入摘要 |
| Enrollment 数据 (去标识化) | 入组预测模型 | Java API → AI Service (离线) | 模型版本 + 特征变量 |
| OCR 历史 + 人工确认结果 | OCR 模型微调、模板学习 | AI Service → 模型训练管线 (离线) | 模型版本 + 训练数据版本 |
| 患者宣教材料 | 患者端 AI 问答 | Java API → OpenSearch → AI Service | 引用材料 ID + 版本 |
| Notification 模板 | 待办智能聚合、周报自动生成 | Java API → AI Service | 模板版本 |

---

# 五、技术架构总览 (Technical Architecture Overview)

## 5.1 Java 主业务后端架构

### 5.1.1 分层架构

```
┌──────────────────────────────────────────────────────────────────┐
│                    [Client: Admin Web / Patient MiniApp / 3rd Party]│
└──────────────────────────────┬───────────────────────────────────┘
                               │ HTTPS / WSS
┌──────────────────────────────▼───────────────────────────────────┐
│                     Spring Boot 3 API Layer                        │
│  ┌─────────────┐ ┌──────────────┐ ┌──────────────┐               │
│  │ REST Controllers│ │ Webhook Controllers│ │ SSE/WebSocket   │  │
│  │ (Spring MVC)   │ │ (Callback)      │ │ Controllers    │       │
│  └───────┬─────────┘ └──────┬───────┘ └──────┬───────┘           │
│          │                  │                 │                    │
│  ┌───────▼──────────────────▼─────────────────▼───────┐           │
│  │              Interceptor / Filter Chain              │           │
│  │  - JWT Authentication Filter                         │           │
│  │  - Audit Logging Interceptor                         │           │
│  │  - Data Scope Interceptor (MyBatis Plus)             │           │
│  │  - Rate Limiting                                     │           │
│  │  - TraceId Propagation                               │           │
│  └──────────────────┬──────────────────────────────────┘           │
│                     │                                              │
│  ┌──────────────────▼──────────────────────────────────┐          │
│  │                  Service Layer                        │          │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐             │          │
│  │  │ StudyService│ │SubjectService│ │SafetyService│ ... │         │
│  │  └─────┬─────┘ └─────┬─────┘ └─────┬─────┘             │          │
│  │        │              │              │                   │          │
│  │  ┌─────▼──────────────▼──────────────▼─────┐            │          │
│  │  │         Domain Services                   │            │          │
│  │  │  - StateMachineService                     │            │          │
│  │  │  - WorkflowService (Flowable)              │            │          │
│  │  │  - AuditService                             │            │          │
│  │  │  - NotificationService                      │            │          │
│  │  │  - FileService                               │            │          │
│  │  │  - MessageProducer (RabbitMQ)                │            │          │
│  │  └────────────────────────────────────────────┘            │          │
│  └──────────────────┬──────────────────────────────────┘          │
│                     │                                              │
│  ┌──────────────────▼──────────────────────────────────┐          │
│  │              Repository / Mapper Layer               │          │
│  │  ┌────────────────┐  ┌──────────────────────────┐   │          │
│  │  │ MyBatis Plus    │  │  XML Mappers              │   │          │
│  │  │ (Simple CRUD)   │  │  (Complex queries, joins, │   │          │
│  │  │                  │  │   reports, aggregations)  │   │          │
│  │  └────────────────┘  └──────────────────────────┘   │          │
│  └──────────────────┬──────────────────────────────────┘          │
└─────────────────────┼─────────────────────────────────────────────┘
                      │
         ┌────────────┼────────────┬────────────┬────────────┐
         ▼            ▼            ▼            ▼            ▼
   ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐
   │PostgreSQL│ │  Redis   │ │RabbitMQ  │ │  MinIO   │ │OpenSearch│
   └──────────┘ └──────────┘ └──────────┘ └──────────┘ └──────────┘
                      │
         ┌────────────▼────────────┐
         │     Flowable Engine     │
         │   (embedded in API)     │
         └─────────────────────────┘
```

### 5.1.2 Java 包结构

```
com.ctms
├── CtmsApplication.java                    # Spring Boot 入口
├── config
│   ├── SecurityConfig.java                 # Spring Security 配置
│   ├── MybatisPlusConfig.java              # MyBatis Plus 配置（分页插件、乐观锁、逻辑删除）
│   ├── OpenApiConfig.java                  # Springdoc OpenAPI 配置
│   ├── RabbitMqConfig.java                 # RabbitMQ 队列/交换机声明
│   ├── RedisConfig.java                    # Redis 序列化与连接配置
│   ├── FlowableConfig.java                 # Flowable 引擎配置
│   ├── AsyncConfig.java                    # @Async 线程池配置
│   └── WebMvcConfig.java                   # CORS、拦截器注册
├── security
│   ├── JwtTokenProvider.java               # JWT 生成与验证
│   ├── JwtAuthenticationFilter.java        # JWT 过滤器
│   ├── CurrentUser.java                    # @CurrentUser 注解 + resolver
│   ├── UserPrincipal.java                  # 安全上下文用户主体
│   ├── PermissionEvaluator.java            # 自定义权限表达式
│   └── AbacPolicyEngine.java               # ABAC 策略评估引擎
├── audit
│   ├── AuditLogAspect.java                 # @Auditable 注解的 AOP 切面
│   ├── AuditLogService.java                # 审计日志写入服务
│   ├── AuditLogEntity.java                 # 审计日志实体
│   └── SensitiveFieldMasker.java           # 敏感字段脱敏处理器
├── common
│   ├── ApiResponse.java                    # 统一响应结构
│   ├── ErrorCode.java                      # 统一错误码枚举
│   ├── BaseEntity.java                     # 实体基类（审计字段）
│   ├── GlobalExceptionHandler.java         # 全局异常处理
│   ├── PageRequest.java                    # 分页请求
│   ├── PageResponse.java                   # 分页响应
│   └── TraceIdFilter.java                  # TraceId 生成与透传
├── enums
│   ├── StudyStatus.java
│   ├── SiteStatus.java
│   ├── SubjectStatus.java
│   ├── VisitStatus.java
│   ├── ConsentStatus.java
│   ├── IssueStatus.java
│   ├── SaeStatus.java
│   ├── OperationType.java
│   └── SensitivityLevel.java
├── entity
│   ├── Study.java
│   ├── Site.java
│   ├── Subject.java
│   ├── Visit.java
│   ├── Ae.java
│   ├── Sae.java
│   ├── Query.java
│   ├── ... (36 entities)
│   └── AuditLog.java
├── dto
│   ├── request
│   │   ├── study
│   │   │   ├── StudyCreateRequest.java
│   │   │   ├── StudyUpdateRequest.java
│   │   │   └── StudyQueryRequest.java
│   │   └── ... (per module)
│   └── response
│       ├── study
│       │   ├── StudyDetailResponse.java
│       │   └── StudyListResponse.java
│       └── ... (per module)
├── mapper
│   ├── StudyMapper.java                    # MyBatis Plus BaseMapper
│   ├── SubjectMapper.java
│   └── ... (per entity)
├── service
│   ├── study
│   │   ├── StudyService.java
│   │   ├── StudyStateMachine.java
│   │   └── StudyMilestoneService.java
│   ├── subject
│   │   ├── SubjectService.java
│   │   ├── SubjectStateMachine.java
│   │   ├── ScreeningService.java
│   │   └── EnrollmentService.java
│   ├── site
│   │   ├── SiteService.java
│   │   └── SiteStateMachine.java
│   ├── visit
│   │   ├── VisitService.java
│   │   └── VisitStateMachine.java
│   ├── safety
│   │   ├── AeService.java
│   │   ├── SaeService.java
│   │   └── SaeEscalationWorkflow.java
│   ├── quality
│   │   ├── QueryService.java
│   │   ├── IssueService.java
│   │   ├── ProtocolDeviationService.java
│   │   └── CapaService.java
│   ├── document
│   │   ├── FileService.java
│   │   ├── ConsentService.java
│   │   └── DocumentService.java
│   ├── finance
│   │   ├── BudgetService.java
│   │   ├── ContractService.java
│   │   ├── InvoiceService.java
│   │   ├── PaymentService.java
│   │   └── ReimbursementService.java
│   ├── integration
│   │   ├── IntegrationTaskService.java
│   │   ├── PatientIndexService.java
│   │   ├── FhirMappingService.java
│   │   ├── ReconciliationService.java
│   │   └── adapter
│   │       ├── HisAdapter.java
│   │       ├── LisAdapter.java
│   │       ├── PacsAdapter.java
│   │       ├── EmrAdapter.java
│   │       ├── EdcAdapter.java
│   │       └── EtmfAdapter.java
│   ├── notification
│   │   ├── NotificationService.java
│   │   ├── TodoService.java
│   │   └── ReportGenerationService.java
│   └── ai
│       ├── OcrJobService.java
│       ├── OcrCallbackService.java
│       ├── AiResultReviewService.java
│       └── AiCopilotService.java
├── controller
│   ├── StudyController.java
│   ├── SubjectController.java
│   ├── SiteController.java
│   ├── VisitController.java
│   ├── AeController.java
│   ├── SaeController.java
│   ├── QueryController.java
│   ├── IssueController.java
│   ├── FileController.java
│   ├── OcrController.java
│   ├── FinanceController.java
│   ├── ReportController.java
│   ├── NotificationController.java
│   ├── AuditLogController.java
│   ├── IntegrationController.java
│   └── SystemConfigController.java
├── workflow
│   ├── delegate
│   │   ├── SaeEscalationDelegate.java
│   │   ├── CapaApprovalDelegate.java
│   │   └── PaymentApprovalDelegate.java
│   └── listener
│       ├── WorkflowAuditListener.java
│       └── SlaTimeoutListener.java
└── integration
    ├── message
    │   ├── OcrTaskProducer.java
    │   ├── WebhookProducer.java
    │   ├── ExportTaskProducer.java
    │   └── IntegrationSyncProducer.java
    └── consumer
        ├── OcrResultConsumer.java
        ├── FileScanResultConsumer.java
        └── IntegrationTaskConsumer.java
```

### 5.1.3 技术组件清单

| 组件 | 用途 | 配置要点 |
|------|------|----------|
| Spring Boot 3 | 应用框架 | Java 21, Virtual Threads（可选） |
| Spring Web MVC | REST API | 统一异常处理、拦截器链 |
| Spring Security | 认证鉴权 | JWT + RBAC + ABAC |
| Spring Validation | 请求校验 | DTO 层 @Valid 校验 |
| Springdoc OpenAPI | API 文档 | 自动生成 /v3/api-docs |
| MyBatis Plus | ORM | BaseMapper + XML Mapper |
| MapStruct | 对象映射 | Entity ↔ DTO 转换 |
| Lombok | 代码简化 | @Data, @Builder, @Slf4j |
| Flyway | 数据库迁移 | 版本化 SQL 迁移脚本 |
| Flowable | 工作流引擎 | 嵌入式部署 |
| RabbitMQ | 消息队列 | 异步任务、事件驱动 |
| Redis | 缓存/分布式锁 | Redisson 客户端 |
| OpenSearch | 全文检索 | Spring Data OpenSearch |
| MinIO | 对象存储 | 预签名 URL 上传 |
| OpenTelemetry | 可观测性 | Java Agent 自动埋点 |
| Micrometer | Metrics | Prometheus 端点 |
| Awaitility | 异步测试 | 集成测试用 |
| Testcontainers | 集成测试 | Docker 化的依赖测试 |

---

## 5.2 Python AI/OCR 微服务架构

### 5.2.1 服务定位

AI Service 是独立部署的 Python FastAPI 微服务，**不直接访问主数据库**，不直接修改业务状态。所有输入来自 RabbitMQ 消息或 Java API 的 HTTP 调用，所有输出通过 HTTP 回调或 RabbitMQ 消息返回 Java 主业务后端。

### 5.2.2 模块架构

```
┌─────────────────────────────────────────────────────────────────┐
│                    FastAPI Application                           │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │                   API Layer (Routers)                     │    │
│  │  POST /ocr/parse        - OCR 解析入口                    │    │
│  │  POST /ocr/batch        - 批量 OCR                        │    │
│  │  POST /extract/fields   - 结构化字段提取                   │    │
│  │  POST /qa/ask           - 知识库问答                       │    │
│  │  POST /summary/generate - 自动摘要生成                    │    │
│  │  POST /risk/score       - 风险评分                        │    │
│  │  POST /predict/enrollment - 入组预测                      │    │
│  │  GET  /health           - 健康检查                        │    │
│  │  GET  /model/version    - 模型版本信息                     │    │
│  └─────────────────────────┬───────────────────────────────┘    │
│                            │                                     │
│  ┌─────────────────────────▼───────────────────────────────┐    │
│  │                   Service Layer                           │    │
│  │  ┌──────────────┐  ┌───────────────┐  ┌──────────────┐  │    │
│  │  │ OcrService   │  │ExtractionSvc │  │  QaService    │  │    │
│  │  └──────┬───────┘  └───────┬───────┘  └──────┬───────┘  │    │
│  │  ┌──────▼───────┐  ┌───────▼───────┐  ┌──────▼───────┐  │    │
│  │  │SummarySvc   │  │  RiskScoring  │  │EnrollPredict │  │    │
│  │  └──────────────┘  └───────────────┘  └──────────────┘  │    │
│  └─────────────────────────┬───────────────────────────────┘    │
│                            │                                     │
│  ┌─────────────────────────▼───────────────────────────────┐    │
│  │                   Engine Layer                            │    │
│  │  ┌──────────────────┐  ┌───────────────────────────┐    │    │
│  │  │ PaddleOCR Engine │  │ Model Adapter (可切换)     │    │    │
│  │  │ - detection      │  │ - OpenAI-compatible API    │    │    │
│  │  │ - recognition     │  │ - Local HF transformers    │    │    │
│  │  │ - table parsing   │  │ - vLLM / TGI              │    │    │
│  │  └──────────────────┘  └───────────────────────────┘    │    │
│  │  ┌──────────────────┐  ┌───────────────────────────┐    │    │
│  │  │PaddleX Pipeline  │  │ Embedding / Reranker       │    │    │
│  │  │ - doc structure   │  │ - sentence-transformers    │    │    │
│  │  │ - key-value extr  │  │ - text-embedding-3         │    │    │
│  │  │ - table extraction│  │ - bge-reranker-v2          │    │    │
│  │  └──────────────────┘  └───────────────────────────┘    │    │
│  └─────────────────────────┬───────────────────────────────┘    │
│                            │                                     │
│  ┌─────────────────────────▼───────────────────────────────┐    │
│  │                   Model Registry                          │    │
│  │  Tracks: model_name, version, prompt_version, deployed_at│    │
│  │  Stored in: models/metadata.json + DB (audit)            │    │
│  └─────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────┘
```

### 5.2.3 AI Service 包结构

```
ai-service/
├── main.py                      # FastAPI 应用入口
├── config.py                    # 配置管理 (Pydantic Settings)
├── routers/
│   ├── ocr.py                   # OCR 解析路由
│   ├── extraction.py            # 结构化提取路由
│   ├── qa.py                    # 知识库问答路由
│   ├── summary.py               # 自动摘要路由
│   ├── risk.py                  # 风险评分路由
│   └── prediction.py            # 入组预测路由
├── services/
│   ├── ocr_service.py           # OCR 业务逻辑
│   ├── extraction_service.py    # 结构化提取逻辑
│   ├── qa_service.py            # RAG 问答逻辑
│   ├── summary_service.py       # 摘要生成逻辑
│   ├── risk_service.py          # 风险评分逻辑
│   └── prediction_service.py    # 入组预测逻辑
├── engines/
│   ├── paddle_ocr.py            # PaddleOCR 封装
│   ├── paddle_x.py              # PaddleX Pipeline 封装
│   ├── llm_adapter.py           # 大模型统一适配层
│   ├── embedding.py             # 文本向量化
│   └── reranker.py              # 重排序
├── models/
│   ├── ocr_result.py            # OCR 结果 Pydantic 模型
│   ├── extraction_result.py     # 结构化提取结果
│   ├── qa_result.py             # 问答结果
│   ├── risk_result.py           # 风险评分结果
│   └── callback.py              # 回调 Java API 的数据模型
├── callback/
│   ├── client.py                # HTTP 客户端（回调 Java API）
│   └── retry.py                 # 回调重试逻辑
├── model_registry/
│   ├── registry.py              # 模型版本注册
│   └── metadata.json            # 模型版本元数据
├── utils/
│   ├── unit_normalizer.py       # 医学单位标准化
│   ├── confidence.py            # 置信度计算
│   └── text_cleaner.py          # 文本清洗
├── tests/
└── Dockerfile
```

### 5.2.4 AI 安全边界

```
┌─────────────────────────────────────────────────────────────────┐
│                      AI Service 安全边界                          │
│                                                                  │
│  AI Service 可以:                                                 │
│  ✅ 接收 OCR 任务，返回候选结构化结果                              │
│  ✅ 根据置信度评分标记 HIGH / MEDIUM / LOW                       │
│  ✅ 从 OpenSearch 检索知识库，生成问答回复                        │
│  ✅ 生成风险评分和入组预测（作为参考信息）                          │
│  ✅ 生成周报/摘要草案                                             │
│  ✅ 建议可能的 Query 分类                                         │
│                                                                  │
│  AI Service 不得:                                                 │
│  ❌ 直接写入 PostgreSQL 主库（无数据库连接凭据）                    │
│  ❌ 直接修改任何业务实体的状态                                     │
│  ❌ 直接关闭 Query / Issue / SAE                                 │
│  ❌ 直接签署电子知情同意                                          │
│  ❌ 直接执行揭盲操作                                              │
│  ❌ 在无人确认的情况下将 OCR 结果作为 Final 值                     │
│  ❌ 向患者端直接返回未经人工审核的医疗建议                          │
│                                                                  │
│  所有 AI 输出必须:                                                │
│  🔒 标注置信度分数                                                │
│  🔒 引用数据来源（文档 ID、段落 ID）                               │
│  🔒 记录模型版本和 prompt 版本                                     │
│  🔒 经人工确认后才能生效                                          │
│  🔒 所有确认/驳回操作进入审计日志                                   │
└─────────────────────────────────────────────────────────────────┘
```

---

## 5.3 前端架构

### 5.3.1 Admin Web (Next.js + Ant Design)

```
apps/admin-web/
├── next.config.ts
├── tsconfig.json
├── package.json
├── app/
│   ├── layout.tsx                    # 根布局 (Ant Design ConfigProvider + AuthProvider)
│   ├── page.tsx                      # 默认重定向到 /workspace
│   ├── login/
│   │   └── page.tsx                  # 登录页
│   ├── (dashboard)/                   # 需要认证的路由组
│   │   ├── layout.tsx                # Ant Design Pro 风格布局 (Sidebar + Header)
│   │   ├── workspace/
│   │   │   └── page.tsx              # PM/CRA/CRC/PI/Sponsor 工作台
│   │   ├── portfolio/
│   │   │   ├── page.tsx              # 项目组合管理
│   │   │   └── [studyId]/
│   │   │       ├── page.tsx          # 项目详情总览
│   │   │       ├── protocol/
│   │   │       ├── sites/
│   │   │       │   └── [siteId]/
│   │   │       ├── subjects/
│   │   │       │   └── [subjectId]/
│   │   │       ├── visits/
│   │   │       ├── monitoring/
│   │   │       ├── quality/
│   │   │       │   ├── queries/
│   │   │       │   ├── issues/
│   │   │       │   ├── deviations/
│   │   │       │   └── capas/
│   │   │       ├── safety/
│   │   │       │   ├── aes/
│   │   │       │   └── saes/
│   │   │       ├── documents/
│   │   │       ├── finance/
│   │   │       └── reports/
│   │   ├── subjects/                 # 全局受试者列表
│   │   ├── monitoring/
│   │   ├── documents/
│   │   ├── reports/
│   │   │   ├── analytics/
│   │   │   └── risk-heatmap/
│   │   ├── audit-logs/
│   │   └── settings/
│   │       ├── users/
│   │       ├── roles/
│   │       ├── dictionaries/
│   │       ├── templates/
│   │       └── system/
│   └── api/                          # Next.js API Routes (BFF 层)
│       └── [...path]/
│           └── route.ts              # 代理到 Java API
├── components/
│   ├── layout/
│   │   ├── Sidebar.tsx
│   │   ├── Header.tsx
│   │   └── ProLayout.tsx
│   ├── workspace/
│   │   ├── EnrollmentChart.tsx
│   │   ├── StudyPhaseDistribution.tsx
│   │   ├── KeyProjectTracking.tsx
│   │   ├── MyTodos.tsx
│   │   └── RiskAlertCards.tsx
│   ├── study/
│   │   ├── StudyForm.tsx
│   │   ├── StudyStatusTag.tsx
│   │   └── MilestoneTimeline.tsx
│   ├── subject/
│   │   ├── SubjectTable.tsx
│   │   ├── SubjectDetailTabs.tsx
│   │   ├── VisitTimeline.tsx
│   │   └── MaskedField.tsx          # 脱敏字段显示组件
│   ├── safety/
│   │   ├── AeForm.tsx
│   │   ├── SaeForm.tsx
│   │   └── SafetySummaryTable.tsx
│   ├── quality/
│   │   ├── QueryForm.tsx
│   │   └── IssueBoard.tsx
│   ├── document/
│   │   ├── FileUploader.tsx
│   │   ├── FilePreview.tsx
│   │   └── DocumentTree.tsx
│   ├── finance/
│   │   ├── BudgetTable.tsx
│   │   └── PaymentTimeline.tsx
│   ├── approval/
│   │   ├── ApprovalActions.tsx
│   │   └── ApprovalHistory.tsx
│   ├── auth/
│   │   ├── Access.tsx               # 权限控制包装组件
│   │   └── RouteGuard.tsx
│   └── shared/
│       ├── DataTable.tsx
│       ├── StatusBadge.tsx
│       └── PageHeader.tsx
├── hooks/
│   ├── useAuth.ts
│   ├── usePermission.ts
│   ├── useStudy.ts
│   ├── useSubject.ts
│   └── useApiMutation.ts
├── lib/
│   ├── api-client.ts                # Axios/Fetch 封装，自动注入 JWT + traceId
│   ├── permissions.ts               # 前端权限常量与判断函数
│   └── validators.ts                # Zod schema
└── types/
    ├── study.ts
    ├── subject.ts
    ├── safety.ts
    └── ... (DTO types)
```

**技术要点：**
- Ant Design Pro 风格布局（侧边栏 + 顶栏 + 面包屑）
- React Query (`@tanstack/react-query`) 管理服务端状态
- Zod 前端表单校验（与后端 DTO 校验对齐）
- BFF 层：Next.js API Routes 代理 Java API，处理 token 刷新、traceId 注入
- 权限组件 `<Access permission="subject:viewPii">` 控制敏感按钮/字段渲染
- ECharts 或 AntV 用于图表（入组趋势、风险热力图）

### 5.3.2 Patient MiniApp (Taro + React)

```
apps/patient-miniapp/
├── src/
│   ├── app.tsx                       # 应用入口
│   ├── app.config.ts                 # 全局配置 (pages, tabBar, window)
│   ├── app.scss
│   ├── pages/
│   │   ├── index/                    # 首页 (底部 Tab 1)
│   │   ├── calendar/                 # 访视日历 (Tab 2)
│   │   ├── upload/                   # 报告上传 (Tab 3)
│   │   ├── messages/                 # 消息中心 (Tab 4)
│   │   └── mine/                     # 我的 (Tab 5)
│   ├── sub-pages/
│   │   ├── recruitment/             # 招募与预筛
│   │   ├── econsent/                # eConsent 签署
│   │   ├── caregiver/               # 监护人授权
│   │   ├── questionnaire/           # 问卷填写
│   │   ├── observation/             # 居家指标记录
│   │   ├── ae-report/               # AE/不适自报
│   │   ├── medication/              # 用药记录
│   │   ├── consultation/            # 在线咨询
│   │   ├── reimbursement/           # 报销进度
│   │   ├── education/               # 宣教资料
│   │   ├── privacy/                 # 隐私中心
│   │   └── ocr-confirm/             # OCR 结果确认
│   ├── components/
│   │   ├── VisitCalendar.tsx
│   │   ├── QuestionnaireForm.tsx
│   │   ├── FilePicker.tsx
│   │   ├── OcrResultCard.tsx
│   │   ├── ConsentViewer.tsx
│   │   └── AuthGuard.tsx
│   ├── hooks/
│   │   ├── useUpload.ts
│   │   ├── useOcrPolling.ts
│   │   └── useUserAuth.ts
│   └── utils/
│       ├── wx-api.ts                # 微信 API 封装
│       └── api-client.ts
├── project.config.json
└── tsconfig.json
```

**技术要点：**
- Taro 3 跨平台框架，主要目标平台为 WeChat Mini Program
- 底部 5 个 Tab：首页、日历、上传、消息、我的
- 微信原生能力：文件选择 (wx.chooseMessageFile)、拍照 (wx.chooseImage)、订阅消息推送
- OCR 上传流程：选择文件 → 获取预签名 URL → 直传 MinIO → 通知后端 → 轮询 OCR 状态 → 确认结果
- 离线缓存：关键数据（访视日历、问卷草稿）本地存储

---

## 5.4 数据架构

### 5.4.1 数据库总体设计

```
┌─────────────────────────────────────────────────────────────────┐
│                    PostgreSQL (Primary)                           │
│                                                                  │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐           │
│  │Schema: ctms   │  │Schema: audit │  │Schema: config│           │
│  │ (核心业务表)  │  │ (审计日志)    │  │ (系统配置)    │           │
│  │               │  │               │  │               │           │
│  │ organizations │  │ audit_logs   │  │ sys_config    │           │
│  │ studies       │  │ access_logs  │  │ sys_dict      │           │
│  │ sites         │  │               │  │ sys_template  │           │
│  │ subjects      │  │               │  │ sys_menu      │           │
│  │ visits        │  │               │  │ sys_role      │           │
│  │ aes           │  │               │  │ sys_permission│           │
│  │ saes          │  │               │  │ sys_user      │           │
│  │ queries       │  │               │  │               │           │
│  │ ...           │  │               │  │               │           │
│  └──────────────┘  └──────────────┘  └──────────────┘           │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │              Flyway Migration                             │   │
│  │  V001__init_schema.sql                                    │   │
│  │  V002__add_study_site.sql                                 │   │
│  │  ...                                                       │   │
│  └──────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘

PostgreSQL 特性使用:
- UUIDv7 主键（时间有序，索引友好）
- JSONB 扩展字段 (visit.form_data, questionnaire.response_data, ocr_job.result_json)
- 行级安全 (Row Level Security) - 预留，可基于 subject.site_id 或 user context 配置
- 分区表 (audit_logs, integration_tasks 按月分区)
- 部分索引 (partial index) 优化软删除查询
- 物化视图 (materialized views) 用于统计报表 (每小时刷新)
```

### 5.4.2 主键策略

采用 **UUIDv7**（时间有序 UUID）：

| 对比维度 | UUIDv4 随机 | 自增 ID | Snowflake | UUIDv7 |
|----------|-------------|---------|-----------|--------|
| 全局唯一 | ✅ | ❌ (单库) | ✅ (需 workerId) | ✅ |
| 索引友好 | ❌ (随机IO) | ✅ | ✅ (时间有序) | ✅ (时间有序) |
| 安全性 (不暴露记录数) | ✅ | ❌ | ❌ | ✅ |
| 多中心协同 | ✅ | ❌ | 需协调 | ✅ |
| 数据库原生支持 | ✅ | ✅ | ❌ | PostgreSQL 需扩展 |

选择 UUIDv7 理由：
1. 多中心部署场景下无冲突风险
2. API 暴露 ID 时不泄露业务量级
3. B-tree 索引性能接近自增 ID（前 48 位时间戳有序）
4. 不需要 Snowflake 的 workerId 分配协调

### 5.4.3 数据分区策略

| 表 | 分区键 | 分区粒度 | 保留策略 |
|----|--------|----------|----------|
| audit_logs | created_at | 月 | 在线 3 年 → archive bucket → 删除 |
| access_logs | created_at | 月 | 在线 1 年 → archive bucket → 删除 |
| integration_tasks | created_at | 月 | 在线 6 月 → 压缩 → archive |

### 5.4.4 读写分离（V2 考虑）

```
┌──────────────┐     ┌──────────────┐
│   API (Write)│────▶│  Primary PG  │
└──────────────┘     └──────┬───────┘
                            │ Streaming Replication
┌──────────────┐     ┌──────▼───────┐
│   API (Read) │────▶│  Replica PG  │ (报表查询、Dashboard)
└──────────────┘     └──────────────┘
```

一期不需要读写分离，在 V2 高并发时引入。一期通过在 Service 层区分读写数据源预留扩展点。

---

## 5.5 集成架构

### 5.5.1 集成总览

```
┌─────────────────────────────────────────────────────────────────┐
│                     CTMS/PMS Integration Hub                      │
│                                                                  │
│  ┌──────────────────────┐     ┌──────────────────────────────┐  │
│  │   External Systems    │     │     Integration Layer         │  │
│  │                        │     │                               │  │
│  │  ┌──────┐ ┌──────┐   │     │  ┌────────────────────────┐  │  │
│  │  │ HIS  │ │ LIS  │   │◄───►│  │   Adapter Framework     │  │  │
│  │  └──────┘ └──────┘   │     │  │  - HisAdapter            │  │  │
│  │  ┌──────┐ ┌──────┐   │     │  │  - LisAdapter            │  │  │
│  │  │ PACS │ │ EMR  │   │     │  │  - PacsAdapter           │  │  │
│  │  └──────┘ └──────┘   │     │  │  - EmrAdapter            │  │  │
│  │  ┌──────┐ ┌──────┐   │     │  │  - EdcAdapter            │  │  │
│  │  │ EDC  │ │eTMF  │   │     │  │  - EtmfAdapter           │  │  │
│  │  └──────┘ └──────┘   │     │  └───────────┬────────────┘  │  │
│  └──────────────────────┘     │               │                │  │
│                               │  ┌────────────▼───────────┐   │  │
│                               │  │  Canonical Data Model   │   │  │
│                               │  │  (内部统一数据模型)      │   │  │
│                               │  └────────────┬───────────┘   │  │
│                               │               │                │  │
│                               │  ┌────────────▼───────────┐   │  │
│                               │  │  FHIR Mapping Layer     │   │  │
│                               │  │  (FHIR 风格资源映射)    │   │  │
│                               │  └────────────┬───────────┘   │  │
│                               │               │                │  │
│                               │  ┌────────────▼───────────┐   │  │
│                               │  │  Event Bus (RabbitMQ)   │   │  │
│                               │  │  - integration.sync.*   │   │  │
│                               │  │  - integration.recon.*  │   │  │
│                               │  └────────────────────────┘   │  │
│                               └──────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

### 5.5.2 内部 Canonical Data Model

核心实体映射（CDM → 外部系统）：

| CDM 实体 | 说明 | HIS | LIS | PACS | EMR | EDC | eTMF |
|----------|------|-----|-----|------|-----|-----|------|
| Patient | 患者基本信息（脱敏） | ✅ | ✅ | ✅ | ✅ | — | — |
| Encounter | 就诊/住院记录 | ✅ | — | — | ✅ | — | — |
| Observation | 临床测量值 | ✅ | ✅ | — | ✅ | ✅ | — |
| DiagnosticReport | 诊断报告 | — | ✅ | ✅ | — | — | — |
| MedicationStatement | 用药记录 | ✅ | — | — | ✅ | — | — |
| AdverseEvent | 不良事件 | — | — | — | — | ✅ | — |
| DocumentReference | 文档引用 | — | — | — | — | — | ✅ |
| StudySubject | 研究受试者映射 | — | — | — | — | ✅ | — |

### 5.5.3 FHIR 风格映射策略

一期 **不自建完整 FHIR Server**，但采用 FHIR 资源风格作为内部数据交换格式：

- `Patient` → FHIR Patient (仅 demographic，不含 PII 明文)
- `Observation` → FHIR Observation (valueQuantity, referenceRange, interpretation)
- `DiagnosticReport` → FHIR DiagnosticReport (conclusion, finding, presentedForm)
- `MedicationStatement` → FHIR MedicationStatement
- `AdverseEvent` → FHIR AdverseEvent

**映射方式：** 在每个 Adapter 内部实现 `toCdm()` 和 `fromCdm()` 方法，使用 MapStruct / 手动映射进行转换。一期无需完整的 FHIR JSON/Bundle 序列化，但保留扩展点。

### 5.5.4 集成任务状态机

```
          ┌─────────┐
          │ pending │ ◄── 新建集成任务
          └────┬─────┘
               │
          ┌────▼─────┐
          │ queued   │ ◄── 已投递到 RabbitMQ
          └────┬─────┘
               │
          ┌────▼─────┐
          │processing│ ◄── Consumer 正在处理
          └─┬───┬───┬┘
            │   │   │
      ┌─────┘   │   └──────┐
      ▼         ▼          ▼
  ┌───────┐ ┌────────┐ ┌────────┐
  │completed│ │ failed │ │retrying│ ◄── 自动重试 (< maxRetries)
  └───────┘ └───┬────┘ └───┬────┘
                │          │
           ┌────▼────┐    │ (重试耗尽)
           │manual   │    │
           │review   │◄───┘
           └───┬─────┘
               │
          ┌────▼─────┐
          │ resolved │ (人工处理完成/跳过)
          └──────────┘
```

### 5.5.5 对账与补偿机制

- **对账类型：**
  - 受试者人数对账（CTMS vs EDC vs Site Report）
  - 访视完成数对账
  - SAE 数量对账
  - 付款金额对账（CTMS vs Finance System）
- **对账频率：** 每日自动 + 按需手动触发
- **差异处理：** 差异数 → IntegrationTask (差异记录) → 人工确认 → 修正或标记为 "accepted_difference"
- **幂等性：** 所有集成任务通过 `(source_system, source_id, entity_type)` 三元组唯一约束保障幂等

---

## 5.6 文件架构

### 5.6.1 MinIO Bucket 分层

```
┌─────────────────────────────────────────────┐
│                  MinIO                       │
│                                              │
│  ┌──────────────┐  ┌──────────────┐         │
│  │   raw/       │  │  processed/  │         │
│  │  (原始文件)  │  │  (处理后文件)│         │
│  │              │  │              │         │
│  │  /upload/    │  │  /ocr/       │         │
│  │  /consent/   │  │  /watermark/ │         │
│  │  /source/    │  │  /export/    │         │
│  └──────────────┘  └──────────────┘         │
│                                              │
│  ┌──────────────┐  ┌──────────────┐         │
│  │  archive/    │  │   temp/      │         │
│  │  (归档文件)  │  │  (临时文件)  │         │
│  │              │  │              │         │
│  │  /study/     │  │  /import/    │         │
│  │  /subject/   │  │  /preview/   │         │
│  └──────────────┘  └──────────────┘         │
└─────────────────────────────────────────────┘
```

### 5.6.2 文件上传完整流程

```
Client                    API                      MinIO              Worker
  │                        │                         │                  │
  │ 1. POST /files/upload-url                       │                  │
  │  (filename, mime, size)                         │                  │
  │ ──────────────────────►│                         │                  │
  │                        │ 2. Validate MIME/size   │                  │
  │                        │ 3. Generate presigned URL                  │
  │ 4. Return: {uploadUrl, │                         │                  │
  │    fileId, expiresIn}  │                         │                  │
  │ ◄──────────────────────│                         │                  │
  │                        │                         │                  │
  │ 5. PUT file to uploadUrl (direct to MinIO)       │                  │
  │ ──────────────────────────────────────────────►│                  │
  │ ◄──────────────────────────────────────────────│                  │
  │                        │                         │                  │
  │ 6. POST /files/{id}/confirm                     │                  │
  │ ──────────────────────►│                         │                  │
  │                        │ 7. Verify file hash     │                  │
  │                        │ 8. Update FileObject    │                  │
  │                        │    status = UPLOADED    │                  │
  │                        │ 9. Enqueue scan task ──────────────────►│
  │                        │                         │   10. MIME re-check
  │                        │                         │   11. Hash verify
  │                        │                         │   12. Virus scan (placeholder)
  │                        │                         │   13. Thumbnail gen
  │ 14. Return: fileId + status                     │                  │
  │ ◄──────────────────────│                         │                  │
```

### 5.6.3 文件安全控制

| 控制措施 | 说明 |
|----------|------|
| MIME 白名单 | 仅允许 PDF, JPG, PNG, DICOM, DOCX, XLSX, ZIP |
| 文件大小限制 | 单文件 ≤ 50MB（报告类），≤ 200MB（DICOM） |
| Hash 校验 | 上传完成后 SHA-256 校验 |
| 病毒扫描 | 预留 ClamAV 集成接口 |
| 预签名 URL | 有效期 15 分钟，一次性使用 |
| 下载水印 | 下载时动态添加用户名+时间戳水印 |
| 访问审计 | 所有文件下载/预览记录审计日志 |
| 生命周期 | raw: 7天 → processed; archive: 永久保留（合规要求） |

---

## 5.7 异步任务架构

### 5.7.1 RabbitMQ 队列设计

```
Exchange: ctms.tasks.direct (Direct Exchange)

队列:
┌──────────────────────────┬──────────────────────┬──────────────┐
│ Queue Name               │ Routing Key          │ 消费者        │
├──────────────────────────┼──────────────────────┼──────────────┤
│ ctms.ocr.request         │ ocr.request          │ AI Service    │
│ ctms.ocr.result          │ ocr.result           │ Java API      │
│ ctms.file.scan           │ file.scan            │ Java Worker   │
│ ctms.file.scan.result    │ file.scan.result      │ Java API      │
│ ctms.webhook.delivery    │ webhook.delivery     │ Java Worker   │
│ ctms.export.task         │ export.task          │ Java Worker   │
│ ctms.export.result       │ export.result        │ Java API      │
│ ctms.notification.send   │ notification.send    │ Java Worker   │
│ ctms.risk.calculate      │ risk.calculate       │ AI Service    │
│ ctms.integration.sync    │ integration.sync     │ Java Worker   │
│ ctms.integration.recon   │ integration.recon    │ Java Worker   │
│ ctms.task.deadletter     │ (DLX)                │ Admin Monitor │
└──────────────────────────┴──────────────────────┴──────────────┘
```

### 5.7.2 任务消息通用结构

```json
{
  "taskId": "019abcd-...-ef01",
  "taskType": "OCR_PARSE",
  "traceId": "019abcd-...-trace01",
  "idempotencyKey": "ocr|file_019xxx|v1",
  "tenantId": "org_019xxx",
  "createdBy": "user_019xxx",
  "createdAt": "2026-05-11T10:30:00Z",
  "maxRetries": 3,
  "retryCount": 0,
  "payload": {
    // 任务特定数据
  }
}
```

### 5.7.3 重试策略

| 重试次数 | 延迟 | 策略 |
|----------|------|------|
| 1 | 30s | 瞬时故障恢复 |
| 2 | 5min | 短暂外部系统不可用 |
| 3 | 30min | 较长时间的外部故障 |
| 耗尽后 | — | 进入 DLQ，触发人工告警 |

幂等性：相同 `idempotencyKey` 的消息在已完成状态下被丢弃，防止重复处理。

---

## 5.8 工作流架构

### 5.8.1 Flowable 集成方式

Flowable 作为嵌入式引擎运行在 Java API 进程中，共享数据库连接池。

```
┌───────────────────────────────────────┐
│              Java API Process          │
│  ┌─────────────────────────────────┐  │
│  │    Flowable Engine (embedded)    │  │
│  │  - Process Runtime               │  │
│  │  - Task Service                  │  │
│  │  - History Service               │  │
│  │  - Repository Service            │  │
│  │  (uses same PostgreSQL,          │  │
│  │   separate table prefix:         │  │
│  │   act_ru_*, act_hi_*, act_re_*)  │  │
│  └─────────────────────────────────┘  │
│                                        │
│  ┌─────────────────────────────────┐  │
│  │    Business Service Layer        │  │
│  │    - WorkflowGateway (facade)    │  │
│  │    - delegates, listeners        │  │
│  └─────────────────────────────────┘  │
└───────────────────────────────────────┘
```

### 5.8.2 流程定义清单

| 流程定义 Key | 名称 | 主要节点 | SLA |
|-------------|------|---------|-----|
| sae-escalation | SAE 升级流程 | CRC 报告 → PI 评估 → PM 审核 → Sponsor 确认 → 上报 | 24h |
| capa-approval | CAPA 审批流程 | 创建 → 主管审批 → QA 评估 → 执行 → 验证关闭 | 30d |
| document-approval | 文档审批流程 | 提交 → PM 审批 → Sponsor 确认 → 归档 | 14d |
| contract-approval | 合同审批 | 草稿 → 法务 → PM → Sponsor → 签署 | 30d |
| payment-approval | 付款审批 | 申请 → PM 审批 → Finance 复核 → 支付 | 14d |
| deviation-review | PD 处理流程 | 报告 → PI 评估 → 严重度判定 → CAPA (if needed) | 7d |
| reconsent | 重新知情同意 | 触发 → 通知患者 → 签署新版本 → 确认 | 30d |
| export-approval | 数据导出审批 | 申请 → PM 审批 → 数据范围确认 → 执行导出 | 3d |

### 5.8.3 审批节点设计原则

- 每个审批节点记录：assignee, start_time, end_time, outcome (approved/rejected/returned), comment
- 支持会签（全部同意才通过）、或签（任一同意即通过）
- 条件分支基于流程变量（如 SAE.relatedness = "related" 触发加速上报分支）
- SLA 超时：定时 Job 检查超时任务，自动发送提醒通知并升级
- 流程变量：仅存储业务实体 ID（如 studyId, saeId），不存储敏感明文

---

## 5.9 部署架构

### 5.9.1 开发环境 (Docker Compose)

```
docker-compose.yml

services:
  postgres:
    image: postgres:16
    ports: ["5432:5432"]
    volumes: [pgdata:/var/lib/postgresql/data]

  redis:
    image: redis:7-alpine
    ports: ["6379:6379"]

  rabbitmq:
    image: rabbitmq:3-management-alpine
    ports: ["5672:5672", "15672:15672"]

  minio:
    image: minio/minio:latest
    ports: ["9000:9000", "9001:9001"]

  opensearch:
    image: opensearchproject/opensearch:2
    ports: ["9200:9200"]

  api:
    build: ./apps/api
    ports: ["8080:8080"]
    depends_on: [postgres, redis, rabbitmq, minio, opensearch]
    environment: ...

  ai-service:
    build: ./apps/ai-service
    ports: ["8000:8000"]
    depends_on: [rabbitmq, minio, opensearch]
    environment: ...

  admin-web:
    build: ./apps/admin-web
    ports: ["3000:3000"]
    depends_on: [api]
```

### 5.9.2 生产环境 (Kubernetes + Helm)

```
┌─────────────────────────────────────────────────────────────────┐
│                    Kubernetes Cluster                             │
│                                                                  │
│  Namespace: ctms-prod                                            │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐              │
│  │ Ingress     │  │ Cert-Manager│  │ External-DNS│              │
│  │ (nginx)     │  │ (TLS)       │  │             │              │
│  └──────┬──────┘  └─────────────┘  └─────────────┘              │
│         │                                                        │
│  ┌──────▼──────────────────────────────────────────────┐        │
│  │                   Services                            │        │
│  │                                                       │        │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐           │        │
│  │  │Admin Web │  │API (3x)  │  │AI Svc(2x)│           │        │
│  │  │ (2x)     │  │ HPA: 60% │  │ HPA: 70% │           │        │
│  │  └──────────┘  └────┬─────┘  └────┬─────┘           │        │
│  │                     │              │                   │        │
│  │  ┌──────────────────┼──────────────┼──────────┐      │        │
│  │  │          Stateful / Managed Services        │      │        │
│  │  │  PostgreSQL │ Redis │ RabbitMQ │ MinIO     │      │        │
│  │  │  (HA)       │(Sentinel)│(Cluster)│(Distributed)│   │        │
│  │  └──────────────────────────────────────────┘      │        │
│  │                                                       │        │
│  │  ┌──────────────────────────────────────────┐      │        │
│  │  │          Observability Stack               │      │        │
│  │  │  Prometheus │ Grafana │ Loki │ Tempo      │      │        │
│  │  └──────────────────────────────────────────┘      │        │
│  └──────────────────────────────────────────────────────┘        │
│                                                                  │
│  Namespace: ctms-staging (mirrors prod at smaller scale)         │
│  Namespace: ctms-dev (ephemeral, PR-based)                       │
└─────────────────────────────────────────────────────────────────┘
```

**Helm Chart 结构：**
```
deploy/helm/ctms/
├── Chart.yaml
├── values.yaml
├── values-prod.yaml
├── values-staging.yaml
├── templates/
│   ├── ingress.yaml
│   ├── api-deployment.yaml
│   ├── api-hpa.yaml
│   ├── admin-web-deployment.yaml
│   ├── ai-service-deployment.yaml
│   ├── configmap.yaml
│   ├── secrets.yaml
│   └── service.yaml
```

### 5.9.3 发布策略

| 环境 | 策略 | 审批 |
|------|------|------|
| Dev | 自动部署 (PR merge → build → deploy) | 无需审批 |
| Staging | 自动部署 (main branch merge) | 无需审批 |
| Production | 蓝绿部署 / Canary (10% → 50% → 100%) | 需 PM + Tech Lead 审批 |

---

## 5.10 可观测性架构

### 5.10.1 三大支柱

```
┌─────────────────────────────────────────────────────────────────┐
│                     Observability Stack                           │
│                                                                  │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐           │
│  │   Metrics    │  │   Logging    │  │   Tracing    │           │
│  │ (Prometheus) │  │   (Loki)     │  │  (Tempo)     │           │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘           │
│         │                 │                 │                     │
│  ┌──────▼─────────────────▼─────────────────▼───────┐           │
│  │              OpenTelemetry Collector               │           │
│  │  (OTLP receivers: gRPC + HTTP)                    │           │
│  └──────┬──────────────────────────────────────────┘           │
│         │                                                        │
│  ┌──────▼──────────────────────────────────────────┐           │
│  │              Application Layer                     │           │
│  │                                                    │           │
│  │  Java API: OpenTelemetry Java Agent (auto-instr)  │           │
│  │  AI Service: OpenTelemetry Python SDK             │           │
│  │  Admin Web: OpenTelemetry JS (browser RUM)        │           │
│  │                                                    │           │
│  │  traceId via: MDC (Java), contextvars (Python),   │           │
│  │              headers (Next.js → Java API)         │           │
│  ├────────────────────────────────────────────────────┤           │
│  │              Infrastructure Layer                   │           │
│  │  PostgreSQL Exporter, Redis Exporter,              │           │
│  │  RabbitMQ Exporter, MinIO Metrics,                │           │
│  │  Nginx Exporter, K8s Metrics Server               │           │
│  └────────────────────────────────────────────────────┘           │
└─────────────────────────────────────────────────────────────────┘
```

### 5.10.2 关键 Dashboard

| Dashboard | 粒度 | 关键指标 |
|-----------|------|----------|
| API Overview | 全局 | QPS, P50/P95/P99 latency, error rate, active connections |
| API by Endpoint | 端点级 | 各端点 QPS, latency, 4xx/5xx count |
| RabbitMQ | 队列级 | Queue depth, publish rate, consume rate, DLQ count, ack rate |
| OCR Pipeline | 任务级 | OCR request rate, avg/Max processing time, confidence distribution, retry rate |
| AI Inference | 模型级 | Inference latency, token usage, error rate, model version distribution |
| Database | 实例级 | Connection pool, slow queries (>500ms), deadlocks, replication lag |
| File Processing | Bucket级 | Upload rate, scan time, virus detection count, MIME reject count |
| Integration | Adapter级 | Sync success/failure rate, reconciliation difference count, webhook delivery rate |
| Business Metrics | 业务级 | Active studies, enrollment rate, query open rate, SAE count, visit completion rate |

### 5.10.3 告警规则

| 告警 | 条件 | 严重级别 | 通知方式 |
|------|------|----------|----------|
| API 错误率过高 | error_rate > 5% for 5min | Critical | PagerDuty |
| API P95 > 3s | P95 latency > 3s for 10min | Warning | Slack |
| RabbitMQ 积压 | queue depth > 1000 for 10min | Warning | Slack |
| DLQ 非空 | DLQ messages > 0 | Critical | PagerDuty |
| OCR 失败率过高 | ocr_failure_rate > 10% for 10min | Warning | Slack |
| 集成同步失败 | sync_failure > 0 for 3 consecutive runs | Critical | PagerDuty + Email |
| 磁盘使用率 | disk_usage > 80% | Warning | Slack |
| 证书即将过期 | tls_cert_expiry < 30 days | Warning | Email |
| SAE 上报超时 | SAE not escalated within 24h | Critical | PagerDuty + Email |
| 数据库连接池耗尽 | active_connections > 90% | Critical | PagerDuty |

---

## Round 1 结束说明

以上为 Round 1 全部内容：
1. ✅ 产品概述（定位、角色、KPI、非目标、Assumptions）
2. ✅ 信息架构（管理端/患者端导航树、角色工作台差异、跨端跳转）
3. ✅ 产品域与模块清单（36 个模块：管理端 14 + 患者端 12 + 中台 10）
4. ✅ 数据模型总览（8 组实体、ER 关系、主数据/交易数据、敏感数据、审计、OpenSearch、AI 数据源）
5. ✅ 技术架构总览（Java 后端/ Python AI / 前端 / 数据 / 集成 / 文件 / 异步任务 / 工作流 / 部署 / 可观测性）

---

**第二轮继续输出：**
- 36 个模块的详细说明（目标、子功能、交互、状态流转、字段、异常、权限、API）
- RBAC + ABAC 完整权限矩阵（已在 `round2-permissions.md` 中产出，将在第二轮整合）
- 详细的模块状态机设计