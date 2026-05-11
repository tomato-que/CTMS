# 五、数据库设计 (Database Design)

> **技术栈:** PostgreSQL 16 + UUIDv7 + MyBatis Plus + JSONB + Flyway  
> **Schema:** ctms (业务) / audit (审计) / config (配置)  
> **命名规范:** 蛇形命名、表名复数、字段名下划线分隔

---

## 5.1 总体设计原则

| 原则 | 实现 |
|------|------|
| 主键策略 | UUIDv7，时间有序，B-tree 索引友好 |
| 审计字段 | 每表含 created_at / updated_at / created_by / updated_by / is_deleted / deleted_at / version |
| 软删除 | is_deleted BOOLEAN DEFAULT FALSE + deleted_at TIMESTAMPTZ，部分索引优化 |
| 乐观锁 | version INTEGER DEFAULT 0，MyBatis Plus @Version |
| 时区 | 所有时间字段 TIMESTAMPTZ，应用层统一 UTC |
| JSONB | 动态/扩展字段统一 JSONB，GIN 索引 |
| 敏感字段 | S4/S5 级 AES-256-GCM 应用层加密 |
| 分区 | audit_logs / integration_tasks / access_logs 按月分区 |
| 行级安全 | 预留 RLS (Row Level Security)，一期不启用 |

---

## 5.2 Flyway 迁移策略

```
V001__init_schema_config.sql     — sys_users, sys_roles, sys_permissions, sys_dict, sys_config
V002__init_schema_org_study.sql  — organizations, studies, study_sites, protocol_versions, study_milestones, study_tasks
V003__init_schema_site_inv.sql   — sites, investigators, site_investigators
V004__init_schema_subject.sql    — subjects, screenings, enrollments, consent_templates, consent_versions, consent_records
V005__init_schema_visit.sql      — visit_templates, visits, questionnaires, questionnaire_responses, observations, diagnostic_reports
V006__init_schema_quality.sql    — issues, queries, protocol_deviations, capas
V007__init_schema_safety.sql     — aes, saes
V008__init_schema_finance.sql    — budgets, contracts, invoices, payments, reimbursements
V009__init_schema_file_ai.sql    — file_objects, ocr_jobs
V010__init_schema_system.sql     — notifications, audit_logs, integration_tasks, risk_signals, access_logs
V011__init_seed_data.sql         — 初始角色、权限、字典数据
```

---

## 5.3 核心表结构定义

### 5.3.1 组织与项目

#### organizations

| 列 | 类型 | 约束 | 说明 |
|----|------|------|------|
| id | UUID | PK, DEFAULT uuid7() | 主键 |
| name | VARCHAR(200) | NOT NULL | 组织名称 |
| short_name | VARCHAR(50) | | 简称 |
| org_type | VARCHAR(20) | NOT NULL | SPONSOR / CRO / SMO / SITE_ORG / VENDOR / IRB / REGULATORY |
| parent_id | UUID | FK→organizations.id | 上级组织（集团架构） |
| country | VARCHAR(3) | | ISO 3166-1 alpha-3 |
| province | VARCHAR(50) | | 省/州 |
| city | VARCHAR(50) | | 市 |
| address | TEXT | | 地址 |
| contact_person | VARCHAR(100) | | 联系人 |
| contact_phone | VARCHAR(50) | S3 | 联系电话 (脱敏) |
| contact_email | VARCHAR(200) | | 联系邮箱 |
| tax_id | VARCHAR(50) | | 税号/统一社会信用代码 |
| license_number | VARCHAR(100) | | 营业执照/机构许可证号 |
| status | VARCHAR(20) | NOT NULL DEFAULT 'active' | active / inactive / suspended |
| metadata_jsonb | JSONB | | 扩展信息 |
| created_at | TIMESTAMPTZ | NOT NULL DEFAULT now() | |
| updated_at | TIMESTAMPTZ | NOT NULL DEFAULT now() | |
| created_by | UUID | FK→sys_users.id | |
| updated_by | UUID | FK→sys_users.id | |
| is_deleted | BOOLEAN | NOT NULL DEFAULT false | |
| deleted_at | TIMESTAMPTZ | | |
| version | INTEGER | NOT NULL DEFAULT 0 | 乐观锁 |

**索引:**
- `uk_organizations_name` UNIQUE (name) WHERE is_deleted = false
- `idx_organizations_org_type` (org_type) WHERE is_deleted = false
- `idx_organizations_parent_id` (parent_id)

---

#### studies

| 列 | 类型 | 约束 | 说明 |
|----|------|------|------|
| id | UUID | PK | |
| study_code | VARCHAR(50) | NOT NULL, UNIQUE | 项目内部编号 |
| title | VARCHAR(500) | NOT NULL | 研究标题 |
| short_title | VARCHAR(200) | | 简称/缩写 |
| phase | VARCHAR(20) | NOT NULL | PHASE_I / PHASE_II / PHASE_III / PHASE_IV / BE / OTHER |
| therapeutic_area | VARCHAR(100) | | 治疗领域 |
| indication | VARCHAR(200) | | 适应症 |
| sponsor_org_id | UUID | FK→organizations.id, NOT NULL | 申办方 |
| cro_org_id | UUID | FK→organizations.id | CRO（可选） |
| registration_number | VARCHAR(100) | | NCT/ChiCTR/EudraCT 号 |
| status | VARCHAR(20) | NOT NULL DEFAULT 'draft' | draft/startup/enrolling/followup/locked/archived |
| planned_sites | INTEGER | | 计划中心数 |
| planned_subjects | INTEGER | | 计划入组总数 |
| actual_start_date | DATE | | 实际启动日期 (FPI) |
| actual_end_date | DATE | | 实际结束日期 (LPO) |
| randomization_ratio | VARCHAR(20) | | 随机比例 (1:1, 2:1) |
| blinding_type | VARCHAR(20) | | OPEN / SINGLE / DOUBLE |
| metadata_jsonb | JSONB | | 扩展信息 (inclusion_summary, exclusion_summary, endpoints, etc.) |
| created_at | TIMESTAMPTZ | NOT NULL DEFAULT now() | |
| updated_at | TIMESTAMPTZ | NOT NULL DEFAULT now() | |
| created_by | UUID | FK→sys_users.id | |
| updated_by | UUID | FK→sys_users.id | |
| is_deleted | BOOLEAN | NOT NULL DEFAULT false | |
| deleted_at | TIMESTAMPTZ | | |
| version | INTEGER | NOT NULL DEFAULT 0 | |

**索引:**
- `uk_studies_code` UNIQUE (study_code) WHERE is_deleted = false
- `idx_studies_status` (status) WHERE is_deleted = false
- `idx_studies_sponsor` (sponsor_org_id)
- `idx_studies_phase` (phase)
- `idx_studies_therapeutic_area` (therapeutic_area)
- GIN ON metadata_jsonb

**状态流转:**
```
draft → startup → enrolling → followup → locked → archived
```
所有状态变更需审计。

---

#### study_sites

| 列 | 类型 | 约束 | 说明 |
|----|------|------|------|
| id | UUID | PK | |
| study_id | UUID | FK→studies.id, NOT NULL | |
| site_id | UUID | FK→sites.id, NOT NULL | |
| site_status | VARCHAR(20) | NOT NULL DEFAULT 'candidate' | candidate/selected/activating/active/paused/closed |
| planned_subjects | INTEGER | | 该中心计划入组数 |
| actual_subjects | INTEGER | DEFAULT 0 | 实际入组数 |
| activation_date | DATE | | 中心激活日期 |
| close_date | DATE | | 中心关闭日期 |
| contract_id | UUID | FK→contracts.id | 关联合同 |
| notes | TEXT | | |
| created_at | TIMESTAMPTZ | NOT NULL DEFAULT now() | |
| updated_at | TIMESTAMPTZ | NOT NULL DEFAULT now() | |
| created_by | UUID | FK→sys_users.id | |
| updated_by | UUID | FK→sys_users.id | |
| is_deleted | BOOLEAN | NOT NULL DEFAULT false | |
| deleted_at | TIMESTAMPTZ | | |
| version | INTEGER | NOT NULL DEFAULT 0 | |

**唯一约束:** `uk_study_site` UNIQUE (study_id, site_id)

---

#### protocol_versions

| 列 | 类型 | 约束 | 说明 |
|----|------|------|------|
| id | UUID | PK | |
| study_id | UUID | FK→studies.id, NOT NULL | |
| version_number | VARCHAR(20) | NOT NULL | 1.0, 2.0, 2.1 |
| version_date | DATE | NOT NULL | 版本日期 |
| status | VARCHAR(20) | NOT NULL DEFAULT 'draft' | draft/under_review/approved/effective/superseded |
| effective_date | DATE | | 生效日期 |
| file_id | UUID | FK→file_objects.id | 方案文件 |
| amendment_summary | TEXT | | 修订摘要 |
| amendment_detail_jsonb | JSONB | | 修订详细对比 |
| approved_by | UUID | FK→sys_users.id | |
| approved_at | TIMESTAMPTZ | | |
| created_at | TIMESTAMPTZ | NOT NULL DEFAULT now() | |
| updated_at | TIMESTAMPTZ | NOT NULL DEFAULT now() | |
| created_by | UUID | FK→sys_users.id | |
| updated_by | UUID | FK→sys_users.id | |
| is_deleted | BOOLEAN | NOT NULL DEFAULT false | |
| deleted_at | TIMESTAMPTZ | | |
| version | INTEGER | NOT NULL DEFAULT 0 | |

**唯一约束:** `uk_study_protocol_version` UNIQUE (study_id, version_number)

---

#### study_milestones

| 列 | 类型 | 约束 | 说明 |
|----|------|------|------|
| id | UUID | PK | |
| study_id | UUID | FK→studies.id, NOT NULL | |
| milestone_type | VARCHAR(50) | NOT NULL | FPI / LPO / DBL / CSR / ARCHIVED / CUSTOM |
| milestone_name | VARCHAR(200) | NOT NULL | |
| planned_date | DATE | | 计划日期 |
| actual_date | DATE | | 实际日期 |
| status | VARCHAR(20) | NOT NULL DEFAULT 'pending' | pending/in_progress/completed/delayed |
| depends_on_id | UUID | FK→study_milestones.id | 前置依赖里程碑 |
| notes | TEXT | | |
| created_at | TIMESTAMPTZ | NOT NULL DEFAULT now() | |
| updated_at | TIMESTAMPTZ | NOT NULL DEFAULT now() | |
| created_by | UUID | FK→sys_users.id | |
| updated_by | UUID | FK→sys_users.id | |
| is_deleted | BOOLEAN | NOT NULL DEFAULT false | |
| deleted_at | TIMESTAMPTZ | | |
| version | INTEGER | NOT NULL DEFAULT 0 | |

---

#### study_tasks

| 列 | 类型 | 约束 | 说明 |
|----|------|------|------|
| id | UUID | PK | |
| study_id | UUID | FK→studies.id, NOT NULL | |
| task_type | VARCHAR(50) | NOT NULL | SITE_FEASIBILITY / REGULATORY_SUBMIT / EC_APPROVAL / CONTRACT_SIGN / SITE_ACTIVATION / CUSTOM |
| task_name | VARCHAR(200) | NOT NULL | |
| assigned_to | UUID | FK→sys_users.id | |
| assigned_role | VARCHAR(50) | | 角色 (PM/CRA/CRC) |
| due_date | DATE | | |
| completed_at | TIMESTAMPTZ | | |
| status | VARCHAR(20) | NOT NULL DEFAULT 'pending' | pending/in_progress/completed/blocked/cancelled |
| priority | VARCHAR(10) | DEFAULT 'medium' | low/medium/high/urgent |
| notes | TEXT | | |
| created_at | TIMESTAMPTZ | NOT NULL DEFAULT now() | |
| updated_at | TIMESTAMPTZ | NOT NULL DEFAULT now() | |
| created_by | UUID | FK→sys_users.id | |
| updated_by | UUID | FK→sys_users.id | |
| is_deleted | BOOLEAN | NOT NULL DEFAULT false | |
| deleted_at | TIMESTAMPTZ | | |
| version | INTEGER | NOT NULL DEFAULT 0 | |

---

### 5.3.2 中心与研究者

#### sites

| 列 | 类型 | 约束 | 说明 |
|----|------|------|------|
| id | UUID | PK | |
| site_code | VARCHAR(50) | NOT NULL, UNIQUE | 中心编号 |
| name | VARCHAR(300) | NOT NULL | 中心名称 (如 XX医院呼吸科) |
| org_id | UUID | FK→organizations.id | 所属机构 |
| site_type | VARCHAR(20) | | HOSPITAL / CLINIC / LAB / IMAGING_CENTER |
| address | TEXT | | |
| province | VARCHAR(50) | | |
| city | VARCHAR(50) | | |
| contact_person | VARCHAR(100) | | |
| contact_phone | VARCHAR(50) | S3 | |
| contact_email | VARCHAR(200) | | |
| status | VARCHAR(20) | NOT NULL DEFAULT 'candidate' | candidate/selected/activating/active/paused/closed |
| facility_capabilities_jsonb | JSONB | | 设施能力 (科室、设备) |
| ec_name | VARCHAR(200) | | 伦理委员会名称 |
| ec_approval_date | DATE | | 伦理批件日期 |
| created_at | TIMESTAMPTZ | NOT NULL DEFAULT now() | |
| updated_at | TIMESTAMPTZ | NOT NULL DEFAULT now() | |
| created_by | UUID | FK→sys_users.id | |
| updated_by | UUID | FK→sys_users.id | |
| is_deleted | BOOLEAN | NOT NULL DEFAULT false | |
| deleted_at | TIMESTAMPTZ | | |
| version | INTEGER | NOT NULL DEFAULT 0 | |

---

#### investigators

| 列 | 类型 | 约束 | 说明 |
|----|------|------|------|
| id | UUID | PK | |
| real_name | VARCHAR(100) | NOT NULL | |
| title | VARCHAR(50) | | 职称 (主任医师/教授) |
| specialty | VARCHAR(100) | | 专业 |
| phone | VARCHAR(50) | S3 | |
| email | VARCHAR(200) | NOT NULL | |
| license_number | VARCHAR(100) | | 执业证号 |
| gcp_certificate | VARCHAR(200) | | GCP 证书编号 |
| gcp_cert_expiry | DATE | | GCP 证书过期日 |
| cv_file_id | UUID | FK→file_objects.id | 简历文件 |
| status | VARCHAR(20) | NOT NULL DEFAULT 'active' | active/inactive/suspended |
| created_at | TIMESTAMPTZ | NOT NULL DEFAULT now() | |
| updated_at | TIMESTAMPTZ | NOT NULL DEFAULT now() | |
| created_by | UUID | FK→sys_users.id | |
| updated_by | UUID | FK→sys_users.id | |
| is_deleted | BOOLEAN | NOT NULL DEFAULT false | |
| deleted_at | TIMESTAMPTZ | | |
| version | INTEGER | NOT NULL DEFAULT 0 | |

---

#### site_investigators

| 列 | 类型 | 约束 | 说明 |
|----|------|------|------|
| id | UUID | PK | |
| site_id | UUID | FK→sites.id, NOT NULL | |
| investigator_id | UUID | FK→investigators.id, NOT NULL | |
| role | VARCHAR(20) | NOT NULL | PI / SUB_I / CO_I / STUDY_NURSE / PHARMACIST |
| is_primary | BOOLEAN | DEFAULT false | 是否为主 PI |
| start_date | DATE | | |
| end_date | DATE | | |
| created_at | TIMESTAMPTZ | NOT NULL DEFAULT now() | |
| updated_at | TIMESTAMPTZ | NOT NULL DEFAULT now() | |
| created_by | UUID | FK→sys_users.id | |
| updated_by | UUID | FK→sys_users.id | |
| is_deleted | BOOLEAN | NOT NULL DEFAULT false | |
| deleted_at | TIMESTAMPTZ | | |
| version | INTEGER | NOT NULL DEFAULT 0 | |

**唯一约束:** `uk_site_investigator_role` UNIQUE (site_id, investigator_id, role)

---

### 5.3.3 受试者与知情同意

#### screenings

| 列 | 类型 | 约束 | 说明 |
|----|------|------|------|
| id | UUID | PK | |
| study_id | UUID | FK→studies.id, NOT NULL | |
| site_id | UUID | FK→sites.id, NOT NULL | |
| screening_number | VARCHAR(50) | NOT NULL | 筛选编号 |
| subject_id | UUID | FK→subjects.id | 筛选成功后关联受试者 |
| screening_date | DATE | | 筛选日期 |
| screening_status | VARCHAR(20) | NOT NULL DEFAULT 'in_progress' | in_progress/passed/failed |
| failure_reason | VARCHAR(200) | | 筛选失败原因 |
| eligibility_jsonb | JSONB | | 入排标准逐条评估 |
| created_at | TIMESTAMPTZ | NOT NULL DEFAULT now() | |
| updated_at | TIMESTAMPTZ | NOT NULL DEFAULT now() | |
| created_by | UUID | FK→sys_users.id | |
| updated_by | UUID | FK→sys_users.id | |
| is_deleted | BOOLEAN | NOT NULL DEFAULT false | |
| deleted_at | TIMESTAMPTZ | | |
| version | INTEGER | NOT NULL DEFAULT 0 | |

**唯一约束:** `uk_screening_number_per_study` UNIQUE (study_id, screening_number)

---

#### subjects

| 列 | 类型 | 约束 | 说明 |
|----|------|------|------|
| id | UUID | PK | 内部唯一 ID |
| study_id | UUID | FK→studies.id, NOT NULL | |
| site_id | UUID | FK→sites.id, NOT NULL | |
| subject_number | VARCHAR(50) | NOT NULL | 受试者编号 (中心内唯一) |
| screening_number | VARCHAR(50) | | 筛选编号 |
| randomization_number | VARCHAR(50) | | S2, 随机号 (加密存储) |
| treatment_arm | VARCHAR(50) | | 治疗组别 |
| real_name | VARCHAR(200) | S4, ENCRYPTED | 真实姓名 (加密) |
| id_number | VARCHAR(100) | S4, ENCRYPTED | 身份证号 (加密) |
| phone | VARCHAR(50) | S4, ENCRYPTED | 手机号 (加密) |
| gender | VARCHAR(10) | | MALE / FEMALE / OTHER |
| birth_date | DATE | | 出生日期 |
| enrollment_date | DATE | | 入组日期 |
| status | VARCHAR(20) | NOT NULL DEFAULT 'lead' | lead/prescreened/consented/screened/enrolled/in_followup/completed/withdrawn/lost |
| withdrawal_date | DATE | | 退出日期 |
| withdrawal_reason | VARCHAR(200) | | 退出原因 |
| demographics_jsonb | JSONB | | 人口学信息 (age_at_consent, ethnicity, education, etc.) |
| medical_history_jsonb | JSONB | S5 | 病史摘要 |
| stratification_jsonb | JSONB | | 分层因子值 |
| patient_uid | VARCHAR(100) | | 患者端微信 UnionID/OpenID |
| caregiver_uid | VARCHAR(100) | | 监护人微信 UnionID |
| created_at | TIMESTAMPTZ | NOT NULL DEFAULT now() | |
| updated_at | TIMESTAMPTZ | NOT NULL DEFAULT now() | |
| created_by | UUID | FK→sys_users.id | |
| updated_by | UUID | FK→sys_users.id | |
| is_deleted | BOOLEAN | NOT NULL DEFAULT false | |
| deleted_at | TIMESTAMPTZ | | |
| version | INTEGER | NOT NULL DEFAULT 0 | |

**唯一约束:**
- `uk_subject_per_study_site` UNIQUE (study_id, site_id, subject_number)
- `uk_subject_randomization` UNIQUE (study_id, randomization_number) WHERE randomization_number IS NOT NULL

**敏感字段 (加密):** real_name, id_number, phone (AES-256-GCM)
**JSONB 字段:** demographics_jsonb, medical_history_jsonb, stratification_jsonb

**索引:**
- `idx_subjects_study_status` (study_id, status) WHERE is_deleted = false
- `idx_subjects_site` (site_id)
- `idx_subjects_patient_uid` (patient_uid)

---

#### enrollments

| 列 | 类型 | 约束 | 说明 |
|----|------|------|------|
| id | UUID | PK | |
| subject_id | UUID | FK→subjects.id, NOT NULL, UNIQUE | |
| enrollment_date | DATE | NOT NULL | |
| randomization_date | DATE | | |
| treatment_arm | VARCHAR(50) | | 随机分组结果 |
| stratification_result_jsonb | JSONB | | 分层结果 |
| enrolled_by | UUID | FK→sys_users.id | |
| randomized_by | UUID | FK→sys_users.id | |
| created_at | TIMESTAMPTZ | NOT NULL DEFAULT now() | |
| updated_at | TIMESTAMPTZ | NOT NULL DEFAULT now() | |
| created_by | UUID | FK→sys_users.id | |
| updated_by | UUID | FK→sys_users.id | |
| is_deleted | BOOLEAN | NOT NULL DEFAULT false | |
| deleted_at | TIMESTAMPTZ | | |
| version | INTEGER | NOT NULL DEFAULT 0 | |

---

#### consent_templates

| 列 | 类型 | 约束 | 说明 |
|----|------|------|------|
| id | UUID | PK | |
| study_id | UUID | FK→studies.id, NOT NULL | |
| template_name | VARCHAR(200) | NOT NULL | 主 ICF / 生物样本 ICF / 扩展研究 ICF |
| template_type | VARCHAR(50) | | MAIN / BIO_SPECIMEN / EXTENSION / PHARMACOGENOMIC |
| content_jsonb | JSONB | | 模板内容结构 |
| created_at | TIMESTAMPTZ | NOT NULL DEFAULT now() | |
| updated_at | TIMESTAMPTZ | NOT NULL DEFAULT now() | |
| created_by | UUID | FK→sys_users.id | |
| updated_by | UUID | FK→sys_users.id | |
| is_deleted | BOOLEAN | NOT NULL DEFAULT false | |
| deleted_at | TIMESTAMPTZ | | |
| version | INTEGER | NOT NULL DEFAULT 0 | |

---

#### consent_versions

| 列 | 类型 | 约束 | 说明 |
|----|------|------|------|
| id | UUID | PK | |
| template_id | UUID | FK→consent_templates.id, NOT NULL | |
| version_number | VARCHAR(20) | NOT NULL | 1.0, 2.0 |
| version_date | DATE | NOT NULL | |
| file_id | UUID | FK→file_objects.id | 签署用 PDF 文件 |
| status | VARCHAR(20) | NOT NULL DEFAULT 'draft' | draft/active/signed/reconsent_required/superseded/revoked |
| ec_approval_date | DATE | | 伦理审批日期 |
| effective_date | DATE | | |
| amendment_summary | TEXT | | |
| created_at | TIMESTAMPTZ | NOT NULL DEFAULT now() | |
| updated_at | TIMESTAMPTZ | NOT NULL DEFAULT now() | |
| created_by | UUID | FK→sys_users.id | |
| updated_by | UUID | FK→sys_users.id | |
| is_deleted | BOOLEAN | NOT NULL DEFAULT false | |
| deleted_at | TIMESTAMPTZ | | |
| version | INTEGER | NOT NULL DEFAULT 0 | |

**唯一约束:** `uk_template_version` UNIQUE (template_id, version_number)

---

#### consent_records

| 列 | 类型 | 约束 | 说明 |
|----|------|------|------|
| id | UUID | PK | |
| subject_id | UUID | FK→subjects.id, NOT NULL | |
| consent_version_id | UUID | FK→consent_versions.id, NOT NULL | |
| signed_at | TIMESTAMPTZ | NOT NULL | 签署时间 |
| signed_by_role | VARCHAR(20) | NOT NULL | PATIENT / CAREGIVER / WITNESS |
| signature_data | TEXT | S4, ENCRYPTED | 电子签名数据 (加密) |
| ip_address | INET | S4 | 签署 IP |
| user_agent | TEXT | | UA |
| status | VARCHAR(20) | NOT NULL DEFAULT 'signed' | signed/reconsent_required/superseded/revoked |
| quiz_score | INTEGER | | 理解度测试分数 |
| quiz_retake_count | INTEGER | DEFAULT 0 | 重测次数 |
| revoked_at | TIMESTAMPTZ | | 撤销时间 |
| revoke_reason | VARCHAR(200) | | |
| created_at | TIMESTAMPTZ | NOT NULL DEFAULT now() | |
| updated_at | TIMESTAMPTZ | NOT NULL DEFAULT now() | |
| created_by | UUID | FK→sys_users.id | |
| updated_by | UUID | FK→sys_users.id | |
| is_deleted | BOOLEAN | NOT NULL DEFAULT false | |
| deleted_at | TIMESTAMPTZ | | |
| version | INTEGER | NOT NULL DEFAULT 0 | |

**索引:**
- `idx_consent_records_subject` (subject_id)
- `idx_consent_records_status` (status)

---

### 5.3.4 访视与数据采集

#### visit_templates

| 列 | 类型 | 约束 | 说明 |
|----|------|------|------|
| id | UUID | PK | |
| study_id | UUID | FK→studies.id, NOT NULL | |
| visit_name | VARCHAR(200) | NOT NULL | 访视名称 (Screening, Baseline, C1D1, etc.) |
| visit_type | VARCHAR(30) | NOT NULL | SCREENING/BASELINE/TREATMENT/FOLLOWUP/UNSCHEDULED/EOT |
| visit_order | INTEGER | NOT NULL | 访视序号 |
| window_before_days | INTEGER | | 访视窗 - 前 (天) |
| window_after_days | INTEGER | | 访视窗 - 后 (天) |
| visit_form_config_jsonb | JSONB | | 该访视的表单配置 (CRF 结构) |
| is_required | BOOLEAN | DEFAULT true | |
| created_at | TIMESTAMPTZ | NOT NULL DEFAULT now() | |
| updated_at | TIMESTAMPTZ | NOT NULL DEFAULT now() | |
| created_by | UUID | FK→sys_users.id | |
| updated_by | UUID | FK→sys_users.id | |
| is_deleted | BOOLEAN | NOT NULL DEFAULT false | |
| deleted_at | TIMESTAMPTZ | | |
| version | INTEGER | NOT NULL DEFAULT 0 | |

**唯一约束:** `uk_visit_template_order` UNIQUE (study_id, visit_order)

---

#### visits

| 列 | 类型 | 约束 | 说明 |
|----|------|------|------|
| id | UUID | PK | |
| subject_id | UUID | FK→subjects.id, NOT NULL | |
| visit_template_id | UUID | FK→visit_templates.id | |
| visit_number | INTEGER | NOT NULL | 第几次访视 |
| planned_date | DATE | | 计划日期 |
| window_start | DATE | | 窗口开始 |
| window_end | DATE | | 窗口结束 |
| actual_date | DATE | | 实际日期 |
| status | VARCHAR(20) | NOT NULL DEFAULT 'planned' | planned/due/overdue/completed/missed/cancelled |
| is_out_of_window | BOOLEAN | DEFAULT false | 是否超窗 |
| form_data_jsonb | JSONB | | 该访视所有表单数据 |
| completed_at | TIMESTAMPTZ | | |
| completed_by | UUID | FK→sys_users.id | |
| is_sdv | BOOLEAN | DEFAULT false | SDV 完成 |
| sdv_by | UUID | FK→sys_users.id | |
| sdv_at | TIMESTAMPTZ | | |
| created_at | TIMESTAMPTZ | NOT NULL DEFAULT now() | |
| updated_at | TIMESTAMPTZ | NOT NULL DEFAULT now() | |
| created_by | UUID | FK→sys_users.id | |
| updated_by | UUID | FK→sys_users.id | |
| is_deleted | BOOLEAN | NOT NULL DEFAULT false | |
| deleted_at | TIMESTAMPTZ | | |
| version | INTEGER | NOT NULL DEFAULT 0 | |

**索引:**
- `idx_visits_subject_status` (subject_id, status)
- `idx_visits_planned_date` (planned_date)
- `idx_visits_status_due` (status) WHERE status IN ('due', 'overdue')

---

#### questionnaires

| 列 | 类型 | 约束 | 说明 |
|----|------|------|------|
| id | UUID | PK | |
| study_id | UUID | FK→studies.id, NOT NULL | |
| name | VARCHAR(200) | NOT NULL | QLQ-C30, EQ-5D-5L, PHQ-9 |
| version | VARCHAR(20) | | 量表版本 |
| category | VARCHAR(50) | | PRO / CLINICIAN / OBSERVER |
| questions_jsonb | JSONB | NOT NULL | 量表题目定义 |
| scoring_rules_jsonb | JSONB | | 评分规则 |
| created_at | TIMESTAMPTZ | NOT NULL DEFAULT now() | |
| updated_at | TIMESTAMPTZ | NOT NULL DEFAULT now() | |
| created_by | UUID | FK→sys_users.id | |
| updated_by | UUID | FK→sys_users.id | |
| is_deleted | BOOLEAN | NOT NULL DEFAULT false | |
| deleted_at | TIMESTAMPTZ | | |
| version | INTEGER | NOT NULL DEFAULT 0 | |

**questions_jsonb 示例:**
```json
{
  "questions": [
    {
      "id": "q1", "type": "single_choice", "text": "Overall health status",
      "options": [{"value": 1, "label": "Very poor"}, {"value": 7, "label": "Excellent"}],
      "required": true
    }
  ]
}
```

---

#### questionnaire_responses

| 列 | 类型 | 约束 | 说明 |
|----|------|------|------|
| id | UUID | PK | |
| questionnaire_id | UUID | FK→questionnaires.id, NOT NULL | |
| subject_id | UUID | FK→subjects.id, NOT NULL | |
| visit_id | UUID | FK→visits.id | 关联访视 |
| response_data_jsonb | JSONB | NOT NULL | 应答数据 |
| score_jsonb | JSONB | | 评分结果 |
| submitted_by_role | VARCHAR(20) | | PATIENT / CRC / CAREGIVER |
| submitted_at | TIMESTAMPTZ | | |
| is_verified | BOOLEAN | DEFAULT false | |
| verified_by | UUID | FK→sys_users.id | |
| verified_at | TIMESTAMPTZ | | |
| created_at | TIMESTAMPTZ | NOT NULL DEFAULT now() | |
| updated_at | TIMESTAMPTZ | NOT NULL DEFAULT now() | |
| created_by | UUID | FK→sys_users.id | |
| updated_by | UUID | FK→sys_users.id | |
| is_deleted | BOOLEAN | NOT NULL DEFAULT false | |
| deleted_at | TIMESTAMPTZ | | |
| version | INTEGER | NOT NULL DEFAULT 0 | |

---

#### observations

| 列 | 类型 | 约束 | 说明 |
|----|------|------|------|
| id | UUID | PK | |
| subject_id | UUID | FK→subjects.id, NOT NULL | |
| visit_id | UUID | FK→visits.id | |
| observation_code | VARCHAR(100) | NOT NULL | LOINC 或内部编码 |
| observation_name | VARCHAR(200) | NOT NULL | 测量项名称 (Systolic BP, WBC) |
| value_type | VARCHAR(20) | NOT NULL | NUMERIC / TEXT / CODED / RANGE |
| value_jsonb | JSONB | NOT NULL | 值 (灵活存储) |
| unit | VARCHAR(50) | | UCUM 单位 |
| reference_range_low | NUMERIC | | |
| reference_range_high | NUMERIC | | |
| is_abnormal | BOOLEAN | | |
| abnormality_flag | VARCHAR(10) | | N / L / H / LL / HH / A |
| source | VARCHAR(30) | | MANUAL / OCR / HOSPITAL_SYNC / DEVICE |
| ocr_job_id | UUID | FK→ocr_jobs.id | OCR 来源 |
| is_verified | BOOLEAN | DEFAULT false | |
| verified_by | UUID | FK→sys_users.id | |
| created_at | TIMESTAMPTZ | NOT NULL DEFAULT now() | |
| updated_at | TIMESTAMPTZ | NOT NULL DEFAULT now() | |
| created_by | UUID | FK→sys_users.id | |
| updated_by | UUID | FK→sys_users.id | |
| is_deleted | BOOLEAN | NOT NULL DEFAULT false | |
| deleted_at | TIMESTAMPTZ | | |
| version | INTEGER | NOT NULL DEFAULT 0 | |

**value_jsonb 示例 (数值型):**
```json
{"numeric_value": 120.0, "numeric_unit": "mm[Hg]", "text_value": null}
```
**value_jsonb 示例 (编码型):**
```json
{"coded_value": "M", "coding_system": "HL7", "code_display": "Male"}
```

**索引:**
- `idx_observations_subject_visit` (subject_id, visit_id)
- `idx_observations_code` (observation_code)
- GIN ON value_jsonb

---

#### diagnostic_reports

| 列 | 类型 | 约束 | 说明 |
|----|------|------|------|
| id | UUID | PK | |
| subject_id | UUID | FK→subjects.id, NOT NULL | |
| visit_id | UUID | FK→visits.id | |
| report_type | VARCHAR(50) | NOT NULL | LAB / IMAGING / PATHOLOGY / ECG / GENETIC / OTHER |
| report_title | VARCHAR(300) | | |
| report_date | DATE | | 报告日期 |
| source_file_id | UUID | FK→file_objects.id | 原始文件 |
| structured_result_jsonb | JSONB | S5 | AI/OCR 结构化结果 |
| conclusion | TEXT | | 报告结论 |
| status | VARCHAR(20) | NOT NULL DEFAULT 'pending_review' | pending_review/in_review/confirmed/partially_confirmed/rejected |
| reviewed_by | UUID | FK→sys_users.id | |
| reviewed_at | TIMESTAMPTZ | | |
| ocr_job_id | UUID | FK→ocr_jobs.id | |
| created_at | TIMESTAMPTZ | NOT NULL DEFAULT now() | |
| updated_at | TIMESTAMPTZ | NOT NULL DEFAULT now() | |
| created_by | UUID | FK→sys_users.id | |
| updated_by | UUID | FK→sys_users.id | |
| is_deleted | BOOLEAN | NOT NULL DEFAULT false | |
| deleted_at | TIMESTAMPTZ | | |
| version | INTEGER | NOT NULL DEFAULT 0 | |

---

### 5.3.5 质量与安全

#### queries

| 列 | 类型 | 约束 | 说明 |
|----|------|------|------|
| id | UUID | PK | |
| study_id | UUID | FK→studies.id, NOT NULL | |
| site_id | UUID | FK→sites.id, NOT NULL | |
| subject_id | UUID | FK→subjects.id | |
| visit_id | UUID | FK→visits.id | |
| reference_entity | VARCHAR(50) | | observation / questionnaire_response / subject |
| reference_id | UUID | | 指向具体数据记录 |
| query_type | VARCHAR(30) | NOT NULL | DATA_ENTRY / MISSING / RANGE / LOGIC / CONSISTENCY / OTHER |
| category | VARCHAR(50) | | 分类标签 |
| description | TEXT | NOT NULL | 质疑描述 |
| response | TEXT | | CRC/PI 回复 |
| status | VARCHAR(20) | NOT NULL DEFAULT 'open' | open/answered/closed/reopened |
| severity | VARCHAR(10) | DEFAULT 'medium' | low/medium/high |
| created_by | UUID | FK→sys_users.id | (CRA) |
| answered_by | UUID | FK→sys_users.id | (CRC/PI) |
| closed_by | UUID | FK→sys_users.id | |
| aging_days | INTEGER | | 存活天数 |
| is_auto_generated | BOOLEAN | DEFAULT false | 质量规则引擎自动生成 |
| rule_id | VARCHAR(50) | | 触发规则 ID |
| created_at | TIMESTAMPTZ | NOT NULL DEFAULT now() | |
| updated_at | TIMESTAMPTZ | NOT NULL DEFAULT now() | |
| is_deleted | BOOLEAN | NOT NULL DEFAULT false | |
| deleted_at | TIMESTAMPTZ | | |
| version | INTEGER | NOT NULL DEFAULT 0 | |

**索引:**
- `idx_queries_study_status` (study_id, status)
- `idx_queries_subject` (subject_id)
- `idx_queries_aging` (aging_days) WHERE status = 'open'

---

#### issues

| 列 | 类型 | 约束 | 说明 |
|----|------|------|------|
| id | UUID | PK | |
| study_id | UUID | FK→studies.id, NOT NULL | |
| site_id | UUID | FK→sites.id | |
| issue_type | VARCHAR(50) | NOT NULL | OPERATIONAL / REGULATORY / PERSONNEL / EQUIPMENT / OTHER |
| title | VARCHAR(300) | NOT NULL | |
| description | TEXT | | |
| severity | VARCHAR(10) | NOT NULL DEFAULT 'medium' | low/medium/high/critical |
| status | VARCHAR(20) | NOT NULL DEFAULT 'open' | open/triaged/in_progress/pending_review/closed/reopened |
| assigned_to | UUID | FK→sys_users.id | |
| resolution | TEXT | | |
| root_cause | TEXT | | |
| created_at | TIMESTAMPTZ | NOT NULL DEFAULT now() | |
| updated_at | TIMESTAMPTZ | NOT NULL DEFAULT now() | |
| created_by | UUID | FK→sys_users.id | |
| updated_by | UUID | FK→sys_users.id | |
| is_deleted | BOOLEAN | NOT NULL DEFAULT false | |
| deleted_at | TIMESTAMPTZ | | |
| version | INTEGER | NOT NULL DEFAULT 0 | |

---

#### protocol_deviations

| 列 | 类型 | 约束 | 说明 |
|----|------|------|------|
| id | UUID | PK | |
| study_id | UUID | FK→studies.id, NOT NULL | |
| site_id | UUID | FK→sites.id, NOT NULL | |
| subject_id | UUID | FK→subjects.id | |
| deviation_type | VARCHAR(50) | NOT NULL | INCLUSION_EXCLUSION / VISIT_WINDOW / DOSE / PROCEDURE / CONSENT / OTHER |
| description | TEXT | NOT NULL | |
| severity | VARCHAR(10) | NOT NULL | minor/major/critical |
| impact_assessment | TEXT | | 影响评估 |
| status | VARCHAR(20) | NOT NULL DEFAULT 'reported' | reported/assessed/approved/closed |
| assessed_by | UUID | FK→sys_users.id | (PI) |
| assessed_at | TIMESTAMPTZ | | |
| capa_id | UUID | FK→capas.id | 关联 CAPA |
| created_at | TIMESTAMPTZ | NOT NULL DEFAULT now() | |
| updated_at | TIMESTAMPTZ | NOT NULL DEFAULT now() | |
| created_by | UUID | FK→sys_users.id | |
| updated_by | UUID | FK→sys_users.id | |
| is_deleted | BOOLEAN | NOT NULL DEFAULT false | |
| deleted_at | TIMESTAMPTZ | | |
| version | INTEGER | NOT NULL DEFAULT 0 | |

---

#### capas

| 列 | 类型 | 约束 | 说明 |
|----|------|------|------|
| id | UUID | PK | |
| study_id | UUID | FK→studies.id, NOT NULL | |
| site_id | UUID | FK→sites.id | |
| source_type | VARCHAR(30) | | ISSUE / PROTOCOL_DEVIATION / AUDIT_FINDING / MONITORING |
| source_id | UUID | | 来源记录 ID |
| title | VARCHAR(300) | NOT NULL | |
| root_cause | TEXT | | 根因分析 |
| action_plan | TEXT | NOT NULL | 行动计划 |
| responsible_person | UUID | FK→sys_users.id | |
| due_date | DATE | | |
| status | VARCHAR(20) | NOT NULL DEFAULT 'draft' | draft/submitted/approved/in_progress/implemented/verified/closed |
| verification_method | TEXT | | 有效性验证方法 |
| effectiveness_check_result | TEXT | | 有效性检查结果 |
| workflow_instance_id | VARCHAR(64) | | Flowable 流程实例 ID |
| created_at | TIMESTAMPTZ | NOT NULL DEFAULT now() | |
| updated_at | TIMESTAMPTZ | NOT NULL DEFAULT now() | |
| created_by | UUID | FK→sys_users.id | |
| updated_by | UUID | FK→sys_users.id | |
| is_deleted | BOOLEAN | NOT NULL DEFAULT false | |
| deleted_at | TIMESTAMPTZ | | |
| version | INTEGER | NOT NULL DEFAULT 0 | |

---

#### aes — 不良事件

| 列 | 类型 | 约束 | 说明 |
|----|------|------|------|
| id | UUID | PK | |
| study_id | UUID | FK→studies.id, NOT NULL | |
| site_id | UUID | FK→sites.id, NOT NULL | |
| subject_id | UUID | FK→subjects.id, NOT NULL | |
| ae_number | VARCHAR(50) | NOT NULL | AE 编号 |
| ae_term | VARCHAR(300) | NOT NULL | AE 术语 (Verbatim) |
| meddra_code | VARCHAR(20) | | MedDRA 编码 |
| meddra_pt | VARCHAR(200) | | MedDRA PT |
| meddra_soc | VARCHAR(200) | | MedDRA SOC |
| onset_date | DATE | NOT NULL | 发生日期 |
| end_date | DATE | | 结束日期 |
| severity_grade | INTEGER | NOT NULL | CTCAE 1-5 |
| causality | VARCHAR(20) | | RELATED / POSSIBLY / UNLIKELY / UNRELATED / NOT_ASSESSABLE |
| seriousness_criteria | JSONB | | [DEATH, LIFE_THREATENING, HOSPITALIZATION, DISABILITY, CONGENITAL_ANOMALY, OTHER] |
| is_serious | BOOLEAN | DEFAULT false | |
| outcome | VARCHAR(30) | | RECOVERED / RECOVERING / NOT_RECOVERED / FATAL / UNKNOWN |
| event_detail | TEXT | S5, ENCRYPTED | 事件详细描述 |
| treatment | TEXT | | 处理措施 |
| reported_by | UUID | FK→sys_users.id | |
| assessed_by | UUID | FK→sys_users.id | (PI) |
| sae_id | UUID | FK→saes.id | 升级为 SAE 后关联 |
| status | VARCHAR(20) | NOT NULL DEFAULT 'reported' | reported/reviewing/resolved |
| created_at | TIMESTAMPTZ | NOT NULL DEFAULT now() | |
| updated_at | TIMESTAMPTZ | NOT NULL DEFAULT now() | |
| created_by | UUID | FK→sys_users.id | |
| updated_by | UUID | FK→sys_users.id | |
| is_deleted | BOOLEAN | NOT NULL DEFAULT false | |
| deleted_at | TIMESTAMPTZ | | |
| version | INTEGER | NOT NULL DEFAULT 0 | |

---

#### saes — 严重不良事件

| 列 | 类型 | 约束 | 说明 |
|----|------|------|------|
| id | UUID | PK | |
| study_id | UUID | FK→studies.id, NOT NULL | |
| site_id | UUID | FK→sites.id, NOT NULL | |
| subject_id | UUID | FK→subjects.id, NOT NULL | |
| ae_id | UUID | FK→aes.id | 来源 AE |
| sae_number | VARCHAR(50) | NOT NULL | SAE 编号 |
| sae_term | VARCHAR(300) | NOT NULL | |
| meddra_code | VARCHAR(20) | | |
| narrative | TEXT | S5, ENCRYPTED | 叙事描述 |
| seriousness_criteria | JSONB | NOT NULL | |
| expectedness | VARCHAR(20) | | EXPECTED / UNEXPECTED |
| date_learned | DATE | NOT NULL | 获知日期 |
| expedited_report_deadline | DATE | | 加急报告截止日 |
| regulatory_submission_date | DATE | | 递交监管部门日期 |
| ec_submission_date | DATE | | 递交伦理日期 |
| status | VARCHAR(20) | NOT NULL DEFAULT 'reported' | reported/reviewing/escalated/confirmed/closed |
| is_unblinded | BOOLEAN | DEFAULT false | 是否已揭盲 |
| unblind_authorized_by | UUID | FK→sys_users.id | |
| workflow_instance_id | VARCHAR(64) | | Flowable 流程实例 ID |
| created_at | TIMESTAMPTZ | NOT NULL DEFAULT now() | |
| updated_at | TIMESTAMPTZ | NOT NULL DEFAULT now() | |
| created_by | UUID | FK→sys_users.id | |
| updated_by | UUID | FK→sys_users.id | |
| is_deleted | BOOLEAN | NOT NULL DEFAULT false | |
| deleted_at | TIMESTAMPTZ | | |
| version | INTEGER | NOT NULL DEFAULT 0 | |

---

### 5.3.6 财务

#### budgets

| 列 | 类型 | 约束 | 说明 |
|----|------|------|------|
| id | UUID | PK | |
| study_id | UUID | FK→studies.id, NOT NULL | |
| site_id | UUID | FK→sites.id | 分中心预算 (NULL=总预算) |
| budget_name | VARCHAR(200) | NOT NULL | |
| total_amount | NUMERIC(18,2) | S2 | 总金额 |
| currency | VARCHAR(3) | DEFAULT 'CNY' | |
| line_items_jsonb | JSONB | | 预算明细 |
| approved_by | UUID | FK→sys_users.id | |
| approved_at | TIMESTAMPTZ | | |
| status | VARCHAR(20) | NOT NULL DEFAULT 'draft' | draft/submitted/approved/revised |
| created_at | TIMESTAMPTZ | NOT NULL DEFAULT now() | |
| updated_at | TIMESTAMPTZ | NOT NULL DEFAULT now() | |
| created_by | UUID | FK→sys_users.id | |
| updated_by | UUID | FK→sys_users.id | |
| is_deleted | BOOLEAN | NOT NULL DEFAULT false | |
| deleted_at | TIMESTAMPTZ | | |
| version | INTEGER | NOT NULL DEFAULT 0 | |

---

#### contracts

| 列 | 类型 | 约束 | 说明 |
|----|------|------|------|
| id | UUID | PK | |
| study_id | UUID | FK→studies.id, NOT NULL | |
| site_id | UUID | FK→sites.id | |
| contract_type | VARCHAR(30) | NOT NULL | SITE / CRO / VENDOR / SPONSOR |
| contract_number | VARCHAR(100) | NOT NULL | |
| title | VARCHAR(300) | NOT NULL | |
| total_amount | NUMERIC(18,2) | S2 | |
| effective_date | DATE | | |
| expiry_date | DATE | | |
| status | VARCHAR(20) | NOT NULL DEFAULT 'draft' | draft/submitted/under_review/approved/signed/active/expired/terminated |
| signed_file_id | UUID | FK→file_objects.id | 签署版文件 |
| workflow_instance_id | VARCHAR(64) | | |
| created_at | TIMESTAMPTZ | NOT NULL DEFAULT now() | |
| updated_at | TIMESTAMPTZ | NOT NULL DEFAULT now() | |
| created_by | UUID | FK→sys_users.id | |
| updated_by | UUID | FK→sys_users.id | |
| is_deleted | BOOLEAN | NOT NULL DEFAULT false | |
| deleted_at | TIMESTAMPTZ | | |
| version | INTEGER | NOT NULL DEFAULT 0 | |

---

#### invoices

| 列 | 类型 | 约束 | 说明 |
|----|------|------|------|
| id | UUID | PK | |
| contract_id | UUID | FK→contracts.id | |
| invoice_number | VARCHAR(100) | NOT NULL | 发票号码 |
| invoice_date | DATE | NOT NULL | |
| amount | NUMERIC(18,2) | NOT NULL | |
| status | VARCHAR(20) | NOT NULL DEFAULT 'issued' | issued/submitted/verified/paid |
| file_id | UUID | FK→file_objects.id | 发票影像 |
| created_at | TIMESTAMPTZ | NOT NULL DEFAULT now() | |
| updated_at | TIMESTAMPTZ | NOT NULL DEFAULT now() | |
| created_by | UUID | FK→sys_users.id | |
| updated_by | UUID | FK→sys_users.id | |
| is_deleted | BOOLEAN | NOT NULL DEFAULT false | |
| deleted_at | TIMESTAMPTZ | | |
| version | INTEGER | NOT NULL DEFAULT 0 | |

---

#### payments

| 列 | 类型 | 约束 | 说明 |
|----|------|------|------|
| id | UUID | PK | |
| study_id | UUID | FK→studies.id, NOT NULL | |
| site_id | UUID | FK→sites.id | |
| contract_id | UUID | FK→contracts.id | |
| payment_type | VARCHAR(30) | NOT NULL | SITE_PAYMENT / PATIENT_SUBSIDY / VENDOR / OTHER |
| amount | NUMERIC(18,2) | NOT NULL | |
| currency | VARCHAR(3) | DEFAULT 'CNY' | |
| payee_name | VARCHAR(200) | | |
| bank_account | VARCHAR(100) | S4, ENCRYPTED | |
| planned_date | DATE | | |
| actual_date | DATE | | |
| status | VARCHAR(20) | NOT NULL DEFAULT 'pending' | pending/approved/processing/paid/failed |
| approval_id | VARCHAR(64) | | Flowable 审批实例 ID |
| created_at | TIMESTAMPTZ | NOT NULL DEFAULT now() | |
| updated_at | TIMESTAMPTZ | NOT NULL DEFAULT now() | |
| created_by | UUID | FK→sys_users.id | |
| updated_by | UUID | FK→sys_users.id | |
| is_deleted | BOOLEAN | NOT NULL DEFAULT false | |
| deleted_at | TIMESTAMPTZ | | |
| version | INTEGER | NOT NULL DEFAULT 0 | |

---

#### reimbursements

| 列 | 类型 | 约束 | 说明 |
|----|------|------|------|
| id | UUID | PK | |
| subject_id | UUID | FK→subjects.id, NOT NULL | |
| visit_id | UUID | FK→visits.id | |
| amount | NUMERIC(18,2) | NOT NULL | |
| category | VARCHAR(30) | | TRAVEL / ACCOMMODATION / MEAL / OTHER |
| receipt_file_id | UUID | FK→file_objects.id | 凭证文件 |
| status | VARCHAR(20) | NOT NULL DEFAULT 'submitted' | submitted/approved/paid/rejected |
| payment_id | UUID | FK→payments.id | |
| created_at | TIMESTAMPTZ | NOT NULL DEFAULT now() | |
| updated_at | TIMESTAMPTZ | NOT NULL DEFAULT now() | |
| created_by | UUID | FK→sys_users.id | |
| updated_by | UUID | FK→sys_users.id | |
| is_deleted | BOOLEAN | NOT NULL DEFAULT false | |
| deleted_at | TIMESTAMPTZ | | |
| version | INTEGER | NOT NULL DEFAULT 0 | |

---

### 5.3.7 文件与 AI

#### file_objects

| 列 | 类型 | 约束 | 说明 |
|----|------|------|------|
| id | UUID | PK | |
| original_name | VARCHAR(500) | NOT NULL | 原始文件名 |
| storage_path | VARCHAR(1000) | NOT NULL | MinIO 路径 |
| bucket_name | VARCHAR(50) | NOT NULL | raw / processed / archive / temp |
| mime_type | VARCHAR(100) | | |
| file_size | BIGINT | | 字节数 |
| file_hash | VARCHAR(64) | | SHA-256 |
| status | VARCHAR(20) | NOT NULL DEFAULT 'uploading' | uploading/uploaded/scanning/scanned/failed/quarantined |
| belong_entity | VARCHAR(50) | | study / site / subject / visit / consent 等 |
| belong_id | UUID | | 关联业务实体 ID |
| document_type | VARCHAR(50) | | PROTOCOL / ICF / IB / SOP / MONITORING_REPORT / SUBJECT_FILE / RECEIPT / OTHER |
| version_number | INTEGER | DEFAULT 1 | 文件版本号 |
| metadata_jsonb | JSONB | | 扩展元数据 |
| is_encrypted | BOOLEAN | DEFAULT false | |
| uploaded_by | UUID | FK→sys_users.id | |
| created_at | TIMESTAMPTZ | NOT NULL DEFAULT now() | |
| updated_at | TIMESTAMPTZ | NOT NULL DEFAULT now() | |
| is_deleted | BOOLEAN | NOT NULL DEFAULT false | |
| deleted_at | TIMESTAMPTZ | | |
| version | INTEGER | NOT NULL DEFAULT 0 | |

**唯一约束:** `uk_file_hash` UNIQUE (file_hash, storage_path)

---

#### ocr_jobs

| 列 | 类型 | 约束 | 说明 |
|----|------|------|------|
| id | UUID | PK | |
| file_id | UUID | FK→file_objects.id, NOT NULL | |
| ocr_type | VARCHAR(30) | NOT NULL | LAB_REPORT / IMAGING_REPORT / PRESCRIPTION / GENERAL |
| status | VARCHAR(20) | NOT NULL DEFAULT 'pending' | pending/queued/processing/completed/failed/confirmed/rejected |
| result_jsonb | JSONB | | OCR 结构化结果 |
| confidence_scores_jsonb | JSONB | | 各字段置信度 |
| input_metadata_jsonb | JSONB | | 输入参数 (文档类型、模板ID) |
| error_detail_jsonb | JSONB | | 失败详情 |
| model_name | VARCHAR(100) | | ocr-lab-report-v3 |
| model_version | VARCHAR(20) | | 3.2.1 |
| priority | INTEGER | DEFAULT 5 | 1-10 (1最高) |
| retry_count | INTEGER | DEFAULT 0 | |
| max_retries | INTEGER | DEFAULT 3 | |
| started_at | TIMESTAMPTZ | | |
| completed_at | TIMESTAMPTZ | | |
| confirmed_by | UUID | FK→sys_users.id | |
| confirmed_at | TIMESTAMPTZ | | |
| created_at | TIMESTAMPTZ | NOT NULL DEFAULT now() | |
| updated_at | TIMESTAMPTZ | NOT NULL DEFAULT now() | |
| created_by | UUID | FK→sys_users.id | |
| updated_by | UUID | FK→sys_users.id | |
| is_deleted | BOOLEAN | NOT NULL DEFAULT false | |
| deleted_at | TIMESTAMPTZ | | |
| version | INTEGER | NOT NULL DEFAULT 0 | |

**result_jsonb 示例:**
```json
{
  "document_type": "lab_report",
  "fields": [
    {
      "field_name": "WBC",
      "field_type": "numeric",
      "extracted_value": "6.5",
      "unit": "10^9/L",
      "normalized_value": 6.5,
      "normalized_unit": "10^9/L",
      "confidence_score": 0.97,
      "reference_range": "3.5-9.5",
      "reference_low": 3.5,
      "reference_high": 9.5,
      "abnormal_flag": "N",
      "correction": null,
      "final_value": null
    }
  ],
  "tables": [...]
}
```

**索引:**
- `idx_ocr_jobs_status` (status)
- `idx_ocr_jobs_file` (file_id)

---

### 5.3.8 系统

#### notifications

| 列 | 类型 | 约束 | 说明 |
|----|------|------|------|
| id | UUID | PK | |
| user_id | UUID | FK→sys_users.id, NOT NULL | |
| notification_type | VARCHAR(50) | NOT NULL | TODO / REMINDER / ALERT / INFO / APPROVAL / SYSTEM |
| title | VARCHAR(300) | NOT NULL | |
| content_jsonb | JSONB | | 内容正文 |
| is_read | BOOLEAN | DEFAULT false | |
| read_at | TIMESTAMPTZ | | |
| priority | VARCHAR(10) | DEFAULT 'medium' | low/medium/high/urgent |
| source_entity | VARCHAR(50) | | 触发来源实体 |
| source_id | UUID | | |
| action_url | VARCHAR(500) | | 点击跳转链接 |
| expires_at | TIMESTAMPTZ | | |
| external_channel | VARCHAR(20) | | WECHAT_TEMPLATE / EMAIL / SMS |
| external_sent_at | TIMESTAMPTZ | | |
| created_at | TIMESTAMPTZ | NOT NULL DEFAULT now() | |

**无软删除：通知可物理删除 (用户操作)**

---

#### audit_logs

| 列 | 类型 | 约束 | 说明 |
|----|------|------|------|
| id | UUID | PK | |
| trace_id | VARCHAR(64) | NOT NULL | 全链路追踪 ID |
| user_id | UUID | | 操作者 (可为空：系统操作) |
| user_role | VARCHAR(50) | | |
| operation_type | VARCHAR(30) | NOT NULL | STATE_CHANGE/SENSITIVE_ACCESS/EXPORT/DOWNLOAD/DELETE/PERMISSION_CHANGE/AI_CONFIRMATION/APPROVAL/LOGIN/CONFIG_CHANGE |
| target_entity | VARCHAR(100) | NOT NULL | 目标实体 (Subject, AE, etc.) |
| target_id | UUID | | |
| target_field | VARCHAR(200) | | 字段级审计 |
| before_value_jsonb | JSONB | | 操作前值 |
| after_value_jsonb | JSONB | | 操作后值 |
| operation_detail_jsonb | JSONB | | 操作上下文 |
| ip_address | INET | | |
| user_agent | TEXT | | |
| sensitivity_level | VARCHAR(5) | | S3/S4/S5 |
| created_at | TIMESTAMPTZ | NOT NULL DEFAULT now() | 仅创建时间，不可修改 |

**分区:** `PARTITION BY RANGE (created_at)` 按月分区
**索引:**
- `idx_audit_target` (target_entity, target_id, created_at DESC)
- `idx_audit_user` (user_id, created_at DESC)
- `idx_audit_type` (operation_type, created_at DESC)
- `idx_audit_trace` (trace_id)

**硬性要求:** 不可物理删除，不可修改，仅追加。

---

#### integration_tasks

| 列 | 类型 | 约束 | 说明 |
|----|------|------|------|
| id | UUID | PK | |
| task_type | VARCHAR(50) | NOT NULL | SYNC_HIS/SYNC_LIS/SYNC_EMR/SYNC_EDC/SYNC_ETMF/RECON_SUBJECT/RECON_VISIT/RECON_SAE/RECON_PAYMENT |
| source_system | VARCHAR(30) | | HIS/LIS/PACS/EMR/EDC/ETMF |
| source_id | VARCHAR(200) | | 外部系统记录 ID |
| entity_type | VARCHAR(50) | | 目标 CDM 实体 |
| idempotency_key | VARCHAR(300) | UNIQUE | source_system || source_id || entity_type |
| status | VARCHAR(20) | NOT NULL DEFAULT 'pending' | pending/queued/processing/completed/failed/retrying/manual_review/resolved/skipped |
| payload_jsonb | JSONB | | 任务载荷 |
| result_jsonb | JSONB | | 处理结果 |
| error_detail_jsonb | JSONB | | 错误详情 |
| retry_count | INTEGER | DEFAULT 0 | |
| max_retries | INTEGER | DEFAULT 3 | |
| next_retry_at | TIMESTAMPTZ | | |
| trace_id | VARCHAR(64) | | |
| completed_at | TIMESTAMPTZ | | |
| created_at | TIMESTAMPTZ | NOT NULL DEFAULT now() | |
| updated_at | TIMESTAMPTZ | NOT NULL DEFAULT now() | |

**分区:** `PARTITION BY RANGE (created_at)` 按月分区
**唯一约束:** `uk_idempotency` UNIQUE (idempotency_key)

---

#### risk_signals

| 列 | 类型 | 约束 | 说明 |
|----|------|------|------|
| id | UUID | PK | |
| study_id | UUID | FK→studies.id | |
| site_id | UUID | FK→sites.id | |
| subject_id | UUID | FK→subjects.id | |
| signal_type | VARCHAR(30) | NOT NULL | QUALITY/SAFETY/TIMELINE/OPERATIONAL/FINANCIAL |
| score | NUMERIC(5,2) | NOT NULL | 0.00-100.00 |
| level | VARCHAR(10) | NOT NULL | LOW/MEDIUM/HIGH/CRITICAL |
| signal_data_jsonb | JSONB | | 信号详情 |
| evidence_jsonb | JSONB | | 证据列表 |
| is_acknowledged | BOOLEAN | DEFAULT false | |
| acknowledged_by | UUID | FK→sys_users.id | |
| acknowledged_at | TIMESTAMPTZ | | |
| created_at | TIMESTAMPTZ | NOT NULL DEFAULT now() | |

**索引:**
- `idx_risk_signals_study` (study_id, level, created_at DESC)
- `idx_risk_signals_unack` (is_acknowledged) WHERE is_acknowledged = false

---

### 5.3.9 系统配置

#### sys_users

| 列 | 类型 | 约束 | 说明 |
|----|------|------|------|
| id | UUID | PK | |
| username | VARCHAR(50) | NOT NULL, UNIQUE | |
| password_hash | VARCHAR(200) | NOT NULL | BCrypt |
| real_name | VARCHAR(100) | NOT NULL | |
| email | VARCHAR(200) | | |
| phone | VARCHAR(50) | S3 | |
| org_id | UUID | FK→organizations.id | |
| status | VARCHAR(20) | NOT NULL DEFAULT 'active' | active/inactive/locked |
| last_login_at | TIMESTAMPTZ | | |
| last_login_ip | INET | | |
| pwd_changed_at | TIMESTAMPTZ | | |
| created_at | TIMESTAMPTZ | NOT NULL DEFAULT now() | |
| updated_at | TIMESTAMPTZ | NOT NULL DEFAULT now() | |
| is_deleted | BOOLEAN | NOT NULL DEFAULT false | |
| deleted_at | TIMESTAMPTZ | | |
| version | INTEGER | NOT NULL DEFAULT 0 | |

---

#### sys_roles

| 列 | 类型 | 约束 | 说明 |
|----|------|------|------|
| id | UUID | PK | |
| role_code | VARCHAR(50) | NOT NULL, UNIQUE | ROLE_ADMIN / ROLE_PM / ROLE_CRA / ... |
| role_name | VARCHAR(100) | NOT NULL | |
| description | VARCHAR(300) | | |
| is_system | BOOLEAN | DEFAULT false | 系统内置角色，不可删除 |
| created_at | TIMESTAMPTZ | NOT NULL DEFAULT now() | |
| updated_at | TIMESTAMPTZ | NOT NULL DEFAULT now() | |

---

#### sys_permissions

| 列 | 类型 | 约束 | 说明 |
|----|------|------|------|
| id | UUID | PK | |
| perm_code | VARCHAR(100) | NOT NULL, UNIQUE | study:create / subject:viewPii / query:close |
| perm_name | VARCHAR(200) | NOT NULL | |
| perm_type | VARCHAR(20) | NOT NULL | MENU / BUTTON / API / FIELD / EXPORT / APPROVAL |
| parent_id | UUID | FK→sys_permissions.id | |
| created_at | TIMESTAMPTZ | NOT NULL DEFAULT now() | |

---

#### sys_user_roles

| 列 | 类型 | 约束 | 说明 |
|----|------|------|------|
| id | UUID | PK | |
| user_id | UUID | FK→sys_users.id, NOT NULL | |
| role_id | UUID | FK→sys_roles.id, NOT NULL | |
| scope_type | VARCHAR(20) | | STUDY / SITE / GLOBAL |
| scope_id | UUID | | 范围 ID (study_id, site_id) |
| created_at | TIMESTAMPTZ | NOT NULL DEFAULT now() | |

**唯一约束:** `uk_user_role_scope` UNIQUE (user_id, role_id, scope_type, scope_id)

---

#### sys_role_permissions

| 列 | 类型 | 约束 | 说明 |
|----|------|------|------|
| id | UUID | PK | |
| role_id | UUID | FK→sys_roles.id, NOT NULL | |
| permission_id | UUID | FK→sys_permissions.id, NOT NULL | |
| created_at | TIMESTAMPTZ | NOT NULL DEFAULT now() | |

**唯一约束:** `uk_role_perm` UNIQUE (role_id, permission_id)

---

#### sys_dict_types

| 列 | 类型 | 约束 | 说明 |
|----|------|------|------|
| id | UUID | PK | |
| dict_code | VARCHAR(50) | NOT NULL, UNIQUE | MEDDRA / CTCAE / VISIT_TYPE / DOCUMENT_TYPE |
| dict_name | VARCHAR(100) | NOT NULL | |
| created_at | TIMESTAMPTZ | NOT NULL DEFAULT now() | |

---

#### sys_dict_items

| 列 | 类型 | 约束 | 说明 |
|----|------|------|------|
| id | UUID | PK | |
| dict_type_id | UUID | FK→sys_dict_types.id, NOT NULL | |
| item_code | VARCHAR(50) | NOT NULL | |
| item_name | VARCHAR(200) | NOT NULL | |
| sort_order | INTEGER | DEFAULT 0 | |
| parent_id | UUID | FK→sys_dict_items.id | 层级字典 |
| extra_jsonb | JSONB | | |
| is_enabled | BOOLEAN | DEFAULT true | |
| created_at | TIMESTAMPTZ | NOT NULL DEFAULT now() | |
| updated_at | TIMESTAMPTZ | NOT NULL DEFAULT now() | |

**唯一约束:** `uk_dict_item` UNIQUE (dict_type_id, item_code)

---

#### sys_config

| 列 | 类型 | 约束 | 说明 |
|----|------|------|------|
| id | UUID | PK | |
| config_key | VARCHAR(100) | NOT NULL, UNIQUE | |
| config_value | TEXT | NOT NULL | |
| config_type | VARCHAR(20) | DEFAULT 'string' | string/number/boolean/json |
| description | VARCHAR(300) | | |
| is_encrypted | BOOLEAN | DEFAULT false | 敏感配置加密存储 |
| created_at | TIMESTAMPTZ | NOT NULL DEFAULT now() | |
| updated_at | TIMESTAMPTZ | NOT NULL DEFAULT now() | |
| updated_by | UUID | FK→sys_users.id | |

---

## 5.4 索引设计总览

| 索引类型 | 适用场景 | 示例 |
|----------|----------|------|
| UNIQUE 约束 | 业务唯一性 | subjects(study_id, site_id, subject_number) |
| BTREE (FK) | 所有外键 | idx_xxx_fk ON table(fk_column) |
| BTREE (Status) | 状态查询 | idx_xxx_status ON table(status) WHERE is_deleted = false |
| Partial Index | 软删除优化 | WHERE is_deleted = false (绝大多数查询) |
| Composite Index | 多条件查询 | subjects(study_id, site_id, status) |
| GIN (JSONB) | JSONB 字段内查询 | GIN ON metadata_jsonb, result_jsonb |
| DESC Index | 时间倒序查询 | audit_logs(created_at DESC) |
| Partial Unique | 条件唯一 | WHERE randomization_number IS NOT NULL |

## 5.5 分区策略

| 表 | 分区键 | 粒度 | 保留 | 维护 |
|----|--------|------|------|------|
| audit_logs | created_at | 月 | 在线 3年 → archive 7年 → 删除 | pg_partman 自动创建 |
| integration_tasks | created_at | 月 | 在线 6月 → 压缩 2年 → 删除 | pg_partman |
| access_logs | created_at | 月 | 在线 1年 → archive 3年 → 删除 | pg_partman |

## 5.6 敏感字段加密策略

| 加密方式 | 算法 | 适用字段 | 实现 |
|----------|------|----------|------|
| 数据库应用加密 | AES-256-GCM | subjects.real_name/id_number/phone, payments.bank_account, aes.event_detail, saes.narrative, consent_records.signature_data | Java Cipher + pgcrypto |
| 密钥管理 | — | — | Dev: 环境变量; Prod: HashiCorp Vault |
| 密钥轮换 | — | — | 每 90 天，旧数据用旧密钥解密后新密钥重加密 |

## 5.7 JSONB 使用原则

- 用于结构可变字段（问卷应答、CRF 动态表单、OCR 结果）
- 用于扩展字段（不常用查询条件的附加信息）
- 用于审计快照（before/after 值）
- 不用于：主键、FK、频繁 WHERE 条件字段
- 不用于：需要单独索引的高频查询字段

---

> **下一轮：** Round 4 — 前端页面清单、工程结构、代码骨架、安全合规、测试策略、路线图、风险与假设
