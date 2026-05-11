# CTMS/PMS 平台 REST API 设计文档 (Round 3)

> **版本**: 3.0  
> **日期**: 2026-05-11  
> **作者**: Java Backend Tech Lead  
> **技术栈**: Java 21 + Spring Boot 3 + Spring Web MVC + Springdoc OpenAPI + MyBatis Plus  

---

## 目录

1. [通用规范](#1-通用规范)
2. [Module 1: 试验管理 Study Management](#2-module-1-试验管理-study-management)
3. [Module 2: 中心与研究者管理 Site & Investigator Management](#3-module-2-中心与研究者管理-site--investigator-management)
4. [Module 3: 受试者管理 Subject Management](#4-module-3-受试者管理-subject-management)
5. [Module 4: 访视管理 Visit Management](#5-module-4-访视管理-visit-management)
6. [Module 5: 监查管理 Monitoring](#6-module-5-监查管理-monitoring)
7. [Module 6: 质量管理 Quality Management](#7-module-6-质量管理-quality-management)
8. [Module 7: 安全性管理 Safety](#8-module-7-安全性管理-safety)
9. [Module 8: 文档管理 Document Management](#9-module-8-文档管理-document-management)
10. [Module 9: 财务管理 Finance](#10-module-9-财务管理-finance)
11. [Module 10: 通知与消息 Notification & Messaging](#11-module-10-通知与消息-notification--messaging)
12. [Module 11: 仪表盘与报表 Dashboard & Reports](#12-module-11-仪表盘与报表-dashboard--reports)
13. [Module 12: 系统管理 System Administration](#13-module-12-系统管理-system-administration)
14. [Module 13: 集成 Integration](#14-module-13-集成-integration)
15. [Module 14: OCR与AI回调 OCR & AI Callback](#15-module-14-ocr与ai回调-ocr--ai-callback)
16. [OpenAPI Schema 详细示例](#16-openapi-schema-详细示例)
17. [统一错误码设计](#17-统一错误码设计)
18. [Webhook/回调设计](#18-webhook回调设计)
19. [文件上传流程](#19-文件上传流程)
20. [异步任务轮询模式](#20-异步任务轮询模式)
21. [批量导入设计](#21-批量导入设计)
22. [限流策略](#22-限流策略)

---

## 1. 通用规范

### 1.1 统一响应格式

所有API返回统一响应体 `ApiResponse<T>`：

```json
{
  "code": 200,
  "message": "操作成功",
  "data": {},
  "traceId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "timestamp": "2026-05-11T10:30:00.000+08:00"
}
```

| 字段 | 类型 | 说明 |
|------|------|------|
| code | Integer | 业务状态码，200 表示成功 |
| message | String | 提示信息 |
| data | T (泛型) | 响应数据，可为 null |
| traceId | String | 分布式链路追踪ID |
| timestamp | OffsetDateTime | 响应时间戳 |

### 1.2 分页请求/响应

**请求** `PageRequest`:

```json
{
  "page": 1,
  "size": 20,
  "sort": "createdAt",
  "order": "desc"
}
```

| 字段 | 类型 | 必填 | 默认值 | 说明 |
|------|------|------|--------|------|
| page | Integer | 否 | 1 | 页码，从1开始 |
| size | Integer | 否 | 20 | 每页条数，最大100 |
| sort | String | 否 | "createdAt" | 排序字段 |
| order | String | 否 | "desc" | 排序方向：asc/desc |

**响应** `PageResponse<T>`:

```json
{
  "code": 200,
  "message": "操作成功",
  "data": {
    "content": [],
    "totalElements": 150,
    "totalPages": 8,
    "page": 1,
    "size": 20
  },
  "traceId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "timestamp": "2026-05-11T10:30:00.000+08:00"
}
```

### 1.3 通用请求头

| Header | 类型 | 必填 | 说明 |
|--------|------|------|------|
| Authorization | String | 是 | JWT Bearer Token，格式：`Bearer <token>` |
| Content-Type | String | 是 | `application/json`（文件上传除外） |
| Idempotency-Key | String | 否* | 幂等键，所有写操作(POST/PUT/PATCH/DELETE)必填 |
| X-Trace-Id | String | 否 | 分布式追踪ID，不传则服务端自动生成 |
| Accept-Language | String | 否 | 国际化语言，默认 zh-CN |

### 1.4 日期时间格式

- 所有日期时间字段使用 ISO 8601 格式
- 包含时区信息：`2026-05-11T10:30:00.000+08:00`
- 纯日期字段使用：`2026-05-11`

### 1.5 枚举值约定

- 所有枚举值使用大写蛇形命名：`DRAFT`, `ENROLLING`, `LOCKED`
- 前端展示可映射为中文，后端仅存储英文枚举值

---

## 2. Module 1: 试验管理 Study Management

### 2.1 StudyController - 试验管理

**Base Path**: `/api/v1/studies`

| # | Method | Path | Description | Request Body/Params | Response | Auth | Audit | Idempotent |
|---|--------|------|-------------|---------------------|----------|------|-------|------------|
| 1 | POST | `/api/v1/studies` | 创建新试验 | StudyCreateDTO | ApiResponse\<StudyVO\> | @PreAuthorize("hasRole('PM') or hasRole('ADMIN')") | @Auditable("CREATE_STUDY") | 是 |
| 2 | PUT | `/api/v1/studies/{id}` | 更新试验信息 | StudyUpdateDTO | ApiResponse\<StudyVO\> | @PreAuthorize("hasRole('PM') or hasRole('ADMIN')") | @Auditable("UPDATE_STUDY") | 是 |
| 3 | GET | `/api/v1/studies/{id}` | 获取试验详情 | id (path) | ApiResponse\<StudyDetailVO\> | @PreAuthorize("hasAnyRole('PM','CRA','DM','ADMIN')") | - | - |
| 4 | GET | `/api/v1/studies` | 试验列表（分页+筛选） | PageRequest, StudyFilterDTO (query params) | ApiResponse\<PageResponse\<StudyVO\>\> | @PreAuthorize("isAuthenticated()") | - | - |
| 5 | DELETE | `/api/v1/studies/{id}` | 删除试验（软删除） | id (path) | ApiResponse\<Void\> | @PreAuthorize("hasRole('ADMIN')") | @Auditable("DELETE_STUDY") | 是 |
| 6 | PUT | `/api/v1/studies/{id}/status` | 试验状态转换 | StudyStatusTransitionDTO | ApiResponse\<StudyVO\> | @PreAuthorize("hasRole('PM') or hasRole('ADMIN')") | @Auditable("STUDY_STATUS_CHANGE") | 是 |
| 7 | POST | `/api/v1/studies/{id}/sites` | 添加中心到试验 | StudySiteAssignDTO | ApiResponse\<StudySiteVO\> | @PreAuthorize("hasRole('PM') or hasRole('ADMIN')") | @Auditable("STUDY_ADD_SITE") | 是 |
| 8 | DELETE | `/api/v1/studies/{studyId}/sites/{siteId}` | 从试验移除中心 | studyId, siteId (path) | ApiResponse\<Void\> | @PreAuthorize("hasRole('PM') or hasRole('ADMIN')") | @Auditable("STUDY_REMOVE_SITE") | 是 |
| 9 | GET | `/api/v1/studies/{id}/sites` | 获取试验关联中心列表 | id (path), PageRequest | ApiResponse\<PageResponse\<StudySiteVO\>\> | @PreAuthorize("isAuthenticated()") | - | - |
| 10 | GET | `/api/v1/studies/{id}/dashboard` | 试验仪表盘统计 | id (path) | ApiResponse\<StudyDashboardVO\> | @PreAuthorize("isAuthenticated()") | - | - |
| 11 | GET | `/api/v1/studies/{id}/timeline` | 试验时间线/里程碑 | id (path) | ApiResponse\<List\<MilestoneVO\>\> | @PreAuthorize("isAuthenticated()") | - | - |
| 12 | POST | `/api/v1/studies/{id}/milestones` | 创建试验里程碑 | MilestoneCreateDTO | ApiResponse\<MilestoneVO\> | @PreAuthorize("hasRole('PM') or hasRole('ADMIN')") | @Auditable("CREATE_MILESTONE") | 是 |
| 13 | PUT | `/api/v1/studies/{studyId}/milestones/{milestoneId}` | 更新里程碑 | MilestoneUpdateDTO | ApiResponse\<MilestoneVO\> | @PreAuthorize("hasRole('PM') or hasRole('ADMIN')") | @Auditable("UPDATE_MILESTONE") | 是 |
| 14 | DELETE | `/api/v1/studies/{studyId}/milestones/{milestoneId}` | 删除里程碑 | studyId, milestoneId (path) | ApiResponse\<Void\> | @PreAuthorize("hasRole('PM') or hasRole('ADMIN')") | @Auditable("DELETE_MILESTONE") | 是 |
| 15 | GET | `/api/v1/studies/{id}/tasks` | 试验任务列表 | id (path), PageRequest, TaskFilterDTO | ApiResponse\<PageResponse\<TaskVO\>\> | @PreAuthorize("isAuthenticated()") | - | - |
| 16 | POST | `/api/v1/studies/{id}/tasks` | 创建试验任务 | TaskCreateDTO | ApiResponse\<TaskVO\> | @PreAuthorize("hasRole('PM') or hasRole('ADMIN')") | @Auditable("CREATE_TASK") | 是 |
| 17 | PUT | `/api/v1/studies/{studyId}/tasks/{taskId}` | 更新任务 | TaskUpdateDTO | ApiResponse\<TaskVO\> | @PreAuthorize("hasRole('PM') or hasRole('ADMIN')") | @Auditable("UPDATE_TASK") | 是 |
| 18 | PUT | `/api/v1/studies/{studyId}/tasks/{taskId}/status` | 任务状态更新 | TaskStatusUpdateDTO | ApiResponse\<TaskVO\> | @PreAuthorize("isAuthenticated()") | @Auditable("TASK_STATUS_CHANGE") | 是 |
| 19 | GET | `/api/v1/studies/{id}/protocols` | 方案版本列表 | id (path), PageRequest | ApiResponse\<PageResponse\<ProtocolVersionVO\>\> | @PreAuthorize("isAuthenticated()") | - | - |
| 20 | POST | `/api/v1/studies/{id}/protocols` | 创建方案版本 | ProtocolVersionCreateDTO | ApiResponse\<ProtocolVersionVO\> | @PreAuthorize("hasRole('PM') or hasRole('ADMIN')") | @Auditable("CREATE_PROTOCOL_VERSION") | 是 |
| 21 | PUT | `/api/v1/studies/{studyId}/protocols/{protocolId}/activate` | 激活方案版本 | studyId, protocolId (path) | ApiResponse\<ProtocolVersionVO\> | @PreAuthorize("hasRole('PM') or hasRole('ADMIN')") | @Auditable("ACTIVATE_PROTOCOL") | 是 |
| 22 | GET | `/api/v1/studies/{id}/enrollment-stats` | 入组统计 | id (path) | ApiResponse\<EnrollmentStatsVO\> | @PreAuthorize("isAuthenticated()") | - | - |
| 23 | POST | `/api/v1/studies/{id}/export` | 导出试验数据（异步） | ExportRequestDTO | ApiResponse\<AsyncTaskVO\> | @PreAuthorize("hasRole('PM') or hasRole('ADMIN')") | @Auditable("EXPORT_STUDY") | 是 |

### 2.2 试验状态机

```
DRAFT -> STARTUP -> ENROLLING -> FOLLOWUP -> LOCKED -> ARCHIVED
  |        |          |           |         |
CANCELLED (可从任意状态进入)
```

### 2.3 StudyFilterDTO 筛选字段

| 字段 | 类型 | 说明 |
|------|------|------|
| keyword | String | 试验编号/名称模糊搜索 |
| phase | String | 试验阶段：PHASE_I, PHASE_II, PHASE_III, PHASE_IV |
| status | String | 试验状态 |
| indication | String | 适应症 |
| sponsorId | Long | 申办方ID |
| croId | Long | CRO ID |
| startDateFrom | LocalDate | 计划开始日期-起 |
| startDateTo | LocalDate | 计划开始日期-止 |
| actualStartDateFrom | LocalDate | 实际开始日期-起 |
| actualStartDateTo | LocalDate | 实际开始日期-止 |
| therapeuticArea | String | 治疗领域 |
| studyType | String | 试验类型：INTERVENTIONAL, OBSERVATIONAL, REGISTRY |

### 2.4 核心DTO定义

**StudyCreateDTO:**
```json
{
  "protocolNumber": "PRO-2026-001",
  "title": "一项评估XXX药物治疗XXX的III期临床试验",
  "shortTitle": "XXX-III期",
  "phase": "PHASE_III",
  "indication": "非小细胞肺癌",
  "therapeuticArea": "ONCOLOGY",
  "studyType": "INTERVENTIONAL",
  "sponsorId": 1001,
  "croId": 2001,
  "plannedStartDate": "2026-07-01",
  "plannedEndDate": "2028-12-31",
  "plannedEnrollment": 480,
  "targetCountries": ["CN","US","JP"],
  "blindingType": "DOUBLE_BLIND",
  "randomizationRatio": "1:1",
  "description": "试验描述..."
}
```

**StudyStatusTransitionDTO:**
```json
{
  "targetStatus": "ENROLLING",
  "effectiveDate": "2026-07-01",
  "reason": "所有前置条件已满足，准备开始入组",
  "attachments": []
}
```

---

## 3. Module 2: 中心与研究者管理 Site & Investigator Management

### 3.1 SiteController - 中心管理

**Base Path**: `/api/v1/sites`

| # | Method | Path | Description | Request Body/Params | Response | Auth | Audit | Idempotent |
|---|--------|------|-------------|---------------------|----------|------|-------|------------|
| 1 | POST | `/api/v1/sites` | 创建中心 | SiteCreateDTO | ApiResponse\<SiteVO\> | @PreAuthorize("hasRole('PM') or hasRole('ADMIN')") | @Auditable("CREATE_SITE") | 是 |
| 2 | PUT | `/api/v1/sites/{id}` | 更新中心信息 | SiteUpdateDTO | ApiResponse\<SiteVO\> | @PreAuthorize("hasRole('PM') or hasRole('ADMIN')") | @Auditable("UPDATE_SITE") | 是 |
| 3 | GET | `/api/v1/sites/{id}` | 获取中心详情 | id (path) | ApiResponse\<SiteDetailVO\> | @PreAuthorize("isAuthenticated()") | - | - |
| 4 | GET | `/api/v1/sites` | 中心列表（分页+筛选） | PageRequest, SiteFilterDTO | ApiResponse\<PageResponse\<SiteVO\>\> | @PreAuthorize("isAuthenticated()") | - | - |
| 5 | DELETE | `/api/v1/sites/{id}` | 删除中心（软删除） | id (path) | ApiResponse\<Void\> | @PreAuthorize("hasRole('ADMIN')") | @Auditable("DELETE_SITE") | 是 |
| 6 | PUT | `/api/v1/sites/{id}/status` | 中心状态转换 | SiteStatusTransitionDTO | ApiResponse\<SiteVO\> | @PreAuthorize("hasRole('PM') or hasRole('ADMIN')") | @Auditable("SITE_STATUS_CHANGE") | 是 |
| 7 | GET | `/api/v1/sites/{id}/activation-checklist` | 获取中心启动清单 | id (path) | ApiResponse\<List\<ChecklistItemVO\>\> | @PreAuthorize("isAuthenticated()") | - | - |
| 8 | PUT | `/api/v1/sites/{id}/activation-checklist/{itemId}` | 更新启动清单项 | ChecklistItemUpdateDTO | ApiResponse\<ChecklistItemVO\> | @PreAuthorize("hasRole('CRA') or hasRole('PM')") | @Auditable("CHECKLIST_UPDATE") | 是 |
| 9 | PUT | `/api/v1/sites/{id}/activation-checklist/submit` | 提交启动清单审核 | id (path) | ApiResponse\<Void\> | @PreAuthorize("hasRole('CRA') or hasRole('PM')") | @Auditable("CHECKLIST_SUBMIT") | 是 |
| 10 | PUT | `/api/v1/sites/{id}/activation-checklist/approve` | 审批启动清单 | id (path), ApprovalDTO | ApiResponse\<Void\> | @PreAuthorize("hasRole('PM')") | @Auditable("CHECKLIST_APPROVE") | 是 |
| 11 | GET | `/api/v1/sites/{id}/studies` | 获取中心参与的试验列表 | id (path), PageRequest | ApiResponse\<PageResponse\<StudyVO\>\> | @PreAuthorize("isAuthenticated()") | - | - |
| 12 | GET | `/api/v1/sites/{id}/investigators` | 获取中心的研究者列表 | id (path), PageRequest | ApiResponse\<PageResponse\<SiteInvestigatorVO\>\> | @PreAuthorize("isAuthenticated()") | - | - |
| 13 | POST | `/api/v1/sites/{id}/investigators` | 为中心分配研究者 | SiteInvestigatorAssignDTO | ApiResponse\<SiteInvestigatorVO\> | @PreAuthorize("hasRole('PM') or hasRole('ADMIN')") | @Auditable("ASSIGN_INVESTIGATOR") | 是 |
| 14 | PUT | `/api/v1/sites/{siteId}/investigators/{investigatorId}/role` | 更新研究者角色 | SiteInvestigatorRoleDTO | ApiResponse\<SiteInvestigatorVO\> | @PreAuthorize("hasRole('PM') or hasRole('ADMIN')") | @Auditable("UPDATE_INVESTIGATOR_ROLE") | 是 |
| 15 | DELETE | `/api/v1/sites/{siteId}/investigators/{investigatorId}` | 移除中心的研究者 | siteId, investigatorId (path) | ApiResponse\<Void\> | @PreAuthorize("hasRole('PM') or hasRole('ADMIN')") | @Auditable("REMOVE_INVESTIGATOR") | 是 |

### 3.2 InvestigatorController - 研究者管理

**Base Path**: `/api/v1/investigators`

| # | Method | Path | Description | Request Body/Params | Response | Auth | Audit | Idempotent |
|---|--------|------|-------------|---------------------|----------|------|-------|------------|
| 1 | POST | `/api/v1/investigators` | 创建研究者 | InvestigatorCreateDTO | ApiResponse\<InvestigatorVO\> | @PreAuthorize("hasRole('PM') or hasRole('ADMIN')") | @Auditable("CREATE_INVESTIGATOR") | 是 |
| 2 | PUT | `/api/v1/investigators/{id}` | 更新研究者信息 | InvestigatorUpdateDTO | ApiResponse\<InvestigatorVO\> | @PreAuthorize("hasRole('PM') or hasRole('ADMIN')") | @Auditable("UPDATE_INVESTIGATOR") | 是 |
| 3 | GET | `/api/v1/investigators/{id}` | 获取研究者详情 | id (path) | ApiResponse\<InvestigatorDetailVO\> | @PreAuthorize("isAuthenticated()") | - | - |
| 4 | GET | `/api/v1/investigators` | 研究者列表（分页+筛选） | PageRequest, InvestigatorFilterDTO | ApiResponse\<PageResponse\<InvestigatorVO\>\> | @PreAuthorize("isAuthenticated()") | - | - |
| 5 | DELETE | `/api/v1/investigators/{id}` | 删除研究者（软删除） | id (path) | ApiResponse\<Void\> | @PreAuthorize("hasRole('ADMIN')") | @Auditable("DELETE_INVESTIGATOR") | 是 |
| 6 | GET | `/api/v1/investigators/{id}/qualifications` | 获取研究者资质文件 | id (path) | ApiResponse\<List\<QualificationVO\>\> | @PreAuthorize("isAuthenticated()") | - | - |
| 7 | POST | `/api/v1/investigators/{id}/qualifications` | 上传研究者资质文件 | MultipartFile (form-data), type | ApiResponse\<QualificationVO\> | @PreAuthorize("hasRole('PM') or hasRole('ADMIN')") | @Auditable("UPLOAD_QUALIFICATION") | 是 |
| 8 | DELETE | `/api/v1/investigators/{investigatorId}/qualifications/{qualificationId}` | 删除资质文件 | investigatorId, qualificationId (path) | ApiResponse\<Void\> | @PreAuthorize("hasRole('ADMIN')") | @Auditable("DELETE_QUALIFICATION") | 是 |
| 9 | POST | `/api/v1/investigators/{id}/gcp-training` | 记录GCP培训 | GcpTrainingCreateDTO | ApiResponse\<GcpTrainingVO\> | @PreAuthorize("hasRole('PM') or hasRole('ADMIN')") | @Auditable("GCP_TRAINING") | 是 |
| 10 | GET | `/api/v1/investigators/{id}/sites` | 获取研究者关联的中心 | id (path), PageRequest | ApiResponse\<PageResponse\<SiteVO\>\> | @PreAuthorize("isAuthenticated()") | - | - |

### 3.3 中心状态机

```
FEASIBILITY -> SITE_SELECTION_VISIT -> REGULATORY_SUBMISSION -> SITE_INITIATION -> ACTIVATED -> ENROLLING
                                                                                                   |
                                                                                              ENROLLMENT_COMPLETE -> CLOSE_OUT -> CLOSED
                                                                                                   |
                                                                                              TERMINATED (可从任意激活状态进入)
```

### 3.4 研究者角色枚举

| 值 | 说明 |
|----|------|
| PRINCIPAL_INVESTIGATOR | 主要研究者 (PI) |
| SUB_INVESTIGATOR | 副研究者 (Sub-I) |
| STUDY_COORDINATOR | 研究协调员 (SC) |
| STUDY_NURSE | 研究护士 |
| PHARMACIST | 药剂师 |
| LAB_TECHNICIAN | 实验室技术员 |

### 3.5 SiteFilterDTO 筛选字段

| 字段 | 类型 | 说明 |
|------|------|------|
| keyword | String | 中心名称/编号模糊搜索 |
| status | String | 中心状态 |
| country | String | 国家代码 |
| province | String | 省份 |
| city | String | 城市 |
| studyId | Long | 关联试验ID |
| institutionType | String | 机构类型：HOSPITAL, CLINIC, RESEARCH_CENTER |

---

## 4. Module 3: 受试者管理 Subject Management

### 4.1 SubjectController - 受试者管理

**Base Path**: `/api/v1/subjects`

| # | Method | Path | Description | Request Body/Params | Response | Auth | Audit | Idempotent |
|---|--------|------|-------------|---------------------|----------|------|-------|------------|
| 1 | POST | `/api/v1/subjects` | 创建受试者记录 | SubjectCreateDTO | ApiResponse\<SubjectVO\> | @PreAuthorize("hasAnyRole('CRA','CRC','PI','DM')") | @Auditable("CREATE_SUBJECT") | 是 |
| 2 | GET | `/api/v1/subjects/{id}` | 获取受试者详情（脱敏） | id (path) | ApiResponse\<SubjectVO\> | @PreAuthorize("isAuthenticated()") | - | - |
| 3 | GET | `/api/v1/subjects/{id}/pii` | 获取受试者PII信息（脱敏控制） | id (path), accessReason (query) | ApiResponse\<SubjectPiiVO\> | @PreAuthorize("hasAnyRole('PI','DM')") | @Auditable("ACCESS_PII") | - |
| 4 | PUT | `/api/v1/subjects/{id}` | 更新受试者信息 | SubjectUpdateDTO | ApiResponse\<SubjectVO\> | @PreAuthorize("hasAnyRole('CRA','CRC','PI','DM')") | @Auditable("UPDATE_SUBJECT") | 是 |
| 5 | GET | `/api/v1/subjects` | 受试者列表（分页+筛选） | PageRequest, SubjectFilterDTO | ApiResponse\<PageResponse\<SubjectVO\>\> | @PreAuthorize("isAuthenticated()") | - | - |
| 6 | PUT | `/api/v1/subjects/{id}/screen` | 筛选受试者 | ScreeningDTO | ApiResponse\<SubjectVO\> | @PreAuthorize("hasAnyRole('CRA','CRC','PI')") | @Auditable("SCREEN_SUBJECT") | 是 |
| 7 | PUT | `/api/v1/subjects/{id}/enroll` | 入组受试者 | EnrollmentDTO | ApiResponse\<SubjectVO\> | @PreAuthorize("hasAnyRole('CRA','CRC','PI')") | @Auditable("ENROLL_SUBJECT") | 是 |
| 8 | POST | `/api/v1/subjects/{id}/randomize` | 随机化受试者 | RandomizationDTO | ApiResponse\<RandomizationResultVO\> | @PreAuthorize("hasAnyRole('PI','DM')") | @Auditable("RANDOMIZE_SUBJECT") | 是 |
| 9 | PUT | `/api/v1/subjects/{id}/withdraw` | 退出试验 | WithdrawalDTO | ApiResponse\<SubjectVO\> | @PreAuthorize("hasAnyRole('CRA','PI','DM')") | @Auditable("WITHDRAW_SUBJECT") | 是 |
| 10 | PUT | `/api/v1/subjects/{id}/status` | 受试者状态转换 | SubjectStatusTransitionDTO | ApiResponse\<SubjectVO\> | @PreAuthorize("hasAnyRole('CRA','CRC','PI','DM')") | @Auditable("SUBJECT_STATUS_CHANGE") | 是 |
| 11 | GET | `/api/v1/subjects/{id}/visits` | 受试者访视记录 | id (path), PageRequest | ApiResponse\<PageResponse\<SubjectVisitVO\>\> | @PreAuthorize("isAuthenticated()") | - | - |
| 12 | GET | `/api/v1/subjects/{id}/aes` | 受试者不良事件 | id (path), PageRequest | ApiResponse\<PageResponse\<AeVO\>\> | @PreAuthorize("isAuthenticated()") | - | - |
| 13 | GET | `/api/v1/subjects/{id}/medications` | 受试者合并用药 | id (path), PageRequest | ApiResponse\<PageResponse\<ConcomitantMedicationVO\>\> | @PreAuthorize("isAuthenticated()") | - | - |
| 14 | POST | `/api/v1/subjects/{id}/eligibility-check` | 受试者合格性检查 | EligibilityCheckDTO | ApiResponse\<EligibilityResultVO\> | @PreAuthorize("hasAnyRole('CRA','CRC','PI')") | - | 是 |
| 15 | GET | `/api/v1/subjects/{id}/stratification` | 获取受试者分层因素 | id (path) | ApiResponse\<StratificationVO\> | @PreAuthorize("hasAnyRole('PI','DM')") | - | - |
| 16 | PUT | `/api/v1/subjects/{id}/stratification` | 更新受试者分层因素 | StratificationUpdateDTO | ApiResponse\<StratificationVO\> | @PreAuthorize("hasAnyRole('PI','DM')") | @Auditable("UPDATE_STRATIFICATION") | 是 |
| 17 | PUT | `/api/v1/subjects/{id}/unblind` | 紧急揭盲 | UnblindRequestDTO | ApiResponse\<UnblindResultVO\> | @PreAuthorize("hasRole('PI')") | @Auditable("EMERGENCY_UNBLIND") | 是 |
| 18 | GET | `/api/v1/subjects/{id}/audit-trail` | 受试者审计轨迹 | id (path), PageRequest | ApiResponse\<PageResponse\<AuditLogVO\>\> | @PreAuthorize("hasRole('DM') or hasRole('ADMIN')") | - | - |
| 19 | GET | `/api/v1/subjects/{id}/query-history` | 受试者质疑历史 | id (path), PageRequest | ApiResponse\<PageResponse\<QueryVO\>\> | @PreAuthorize("isAuthenticated()") | - | - |
| 20 | POST | `/api/v1/subjects/batch-import` | 批量导入受试者（异步） | MultipartFile (form-data), studyId | ApiResponse\<AsyncTaskVO\> | @PreAuthorize("hasRole('DM') or hasRole('ADMIN')") | @Auditable("BATCH_IMPORT_SUBJECT") | 是 |
| 21 | GET | `/api/v1/subjects/batch-import/{taskId}/result` | 获取批量导入结果 | taskId (path) | ApiResponse\<BatchImportResultVO\> | @PreAuthorize("hasRole('DM') or hasRole('ADMIN')") | - | - |
| 22 | POST | `/api/v1/subjects/batch-import/{taskId}/confirm` | 确认批量导入 | taskId (path) | ApiResponse\<Void\> | @PreAuthorize("hasRole('DM') or hasRole('ADMIN')") | @Auditable("CONFIRM_BATCH_IMPORT") | 是 |
| 23 | GET | `/api/v1/subjects/{id}/icf` | 知情同意书状态 | id (path) | ApiResponse\<ICFStatusVO\> | @PreAuthorize("isAuthenticated()") | - | - |
| 24 | PUT | `/api/v1/subjects/{id}/icf` | 更新知情同意书 | ICFUpdateDTO | ApiResponse\<ICFStatusVO\> | @PreAuthorize("hasAnyRole('CRA','CRC','PI')") | @Auditable("UPDATE_ICF") | 是 |
| 25 | GET | `/api/v1/subjects/{id}/randomization-eligibility` | 检查随机化资格 | id (path) | ApiResponse\<EligibilityCheckResultVO\> | @PreAuthorize("hasAnyRole('PI','DM')") | - | - |
| 26 | PUT | `/api/v1/subjects/{id}/mask` | 设置数据脱敏标记 | MaskToggleDTO | ApiResponse\<SubjectVO\> | @PreAuthorize("hasRole('DM')") | @Auditable("TOGGLE_MASK") | 是 |

### 4.2 受试者状态机

```
PRE_SCREENING -> SCREENING -> SCREEN_FAILED
                  |
              ENROLLED -> RANDOMIZED -> ACTIVE -> COMPLETED
                  |           |          |
              WITHDRAWN  WITHDRAWN  WITHDRAWN
                  |           |          |
              LOST_TO_FOLLOWUP (任意激活状态)
```

### 4.3 SubjectFilterDTO 筛选字段

| 字段 | 类型 | 说明 |
|------|------|------|
| keyword | String | 受试者编号/缩写模糊搜索 |
| studyId | Long | 试验ID（必填） |
| siteId | Long | 中心ID |
| status | String | 受试者状态 |
| screeningDateFrom | LocalDate | 筛选日期-起 |
| screeningDateTo | LocalDate | 筛选日期-止 |
| enrollmentDateFrom | LocalDate | 入组日期-起 |
| enrollmentDateTo | LocalDate | 入组日期-止 |
| randomizationGroup | String | 随机分组 |
| ageFrom | Integer | 年龄-起 |
| ageTo | Integer | 年龄-止 |
| gender | String | 性别：MALE, FEMALE |
| masked | Boolean | 是否脱敏显示：true=脱敏, false=真实 |

### 4.4 PII 脱敏规则

| 字段 | 脱敏规则 | 示例 |
|------|----------|------|
| name | 保留姓，名用**替代 | 张** |
| idCardNo | 保留前3后4位 | 310\*\*\*\*1234 |
| phone | 保留前3后4位 | 138\*\*\*\*5678 |
| address | 仅显示省份城市 | 上海市浦东新区\*\*\* |
| dob | 仅显示年份 | 1985-\*\*-\*\* |
| medicalRecordNo | 完全脱敏 | \*\*\*\* |

---

## 5. Module 4: 访视管理 Visit Management

### 5.1 VisitController - 访视管理

**Base Path**: `/api/v1/visits`

| # | Method | Path | Description | Request Body/Params | Response | Auth | Audit | Idempotent |
|---|--------|------|-------------|---------------------|----------|------|-------|------------|
| 1 | GET | `/api/v1/visits` | 访视列表（分页+筛选） | PageRequest, VisitFilterDTO | ApiResponse\<PageResponse\<VisitVO\>\> | @PreAuthorize("isAuthenticated()") | - | - |
| 2 | GET | `/api/v1/visits/{id}` | 获取访视详情 | id (path) | ApiResponse\<VisitDetailVO\> | @PreAuthorize("isAuthenticated()") | - | - |
| 3 | PUT | `/api/v1/visits/{id}/status` | 更新访视状态 | VisitStatusUpdateDTO | ApiResponse\<VisitVO\> | @PreAuthorize("hasAnyRole('CRA','CRC','PI')") | @Auditable("VISIT_STATUS_CHANGE") | 是 |
| 4 | POST | `/api/v1/visits/{id}/data` | 提交访视表单数据 | VisitDataSubmitDTO | ApiResponse\<VisitDataVO\> | @PreAuthorize("hasAnyRole('CRA','CRC','PI')") | @Auditable("SUBMIT_VISIT_DATA") | 是 |
| 5 | GET | `/api/v1/visits/{id}/data` | 获取访视表单数据 | id (path) | ApiResponse\<VisitDataVO\> | @PreAuthorize("isAuthenticated()") | - | - |
| 6 | PUT | `/api/v1/visits/{id}/freeze` | 冻结访视数据 | FreezeDTO | ApiResponse\<VisitVO\> | @PreAuthorize("hasRole('DM')") | @Auditable("FREEZE_VISIT") | 是 |
| 7 | PUT | `/api/v1/visits/{id}/unfreeze` | 解冻访视数据 | UnfreezeDTO | ApiResponse\<VisitVO\> | @PreAuthorize("hasRole('DM')") | @Auditable("UNFREEZE_VISIT") | 是 |
| 8 | GET | `/api/v1/visits/{id}/queries` | 访视关联质疑 | id (path), PageRequest | ApiResponse\<PageResponse\<QueryVO\>\> | @PreAuthorize("isAuthenticated()") | - | - |
| 9 | GET | `/api/v1/visits/{id}/sdv-status` | 访视SDV状态 | id (path) | ApiResponse\<SdvStatusVO\> | @PreAuthorize("isAuthenticated()") | - | - |
| 10 | POST | `/api/v1/visits/generate-schedule` | 生成受试者访视计划 | VisitScheduleGenerateDTO | ApiResponse\<List\<VisitVO\>\> | @PreAuthorize("hasRole('DM') or hasRole('PM')") | @Auditable("GENERATE_VISIT_SCHEDULE") | 是 |
| 11 | GET | `/api/v1/visits/subject/{subjectId}` | 获取受试者所有访视 | subjectId (path), PageRequest | ApiResponse\<PageResponse\<VisitVO\>\> | @PreAuthorize("isAuthenticated()") | - | - |
| 12 | PUT | `/api/v1/visits/{id}/reschedule` | 重新排程访视 | VisitRescheduleDTO | ApiResponse\<VisitVO\> | @PreAuthorize("hasAnyRole('CRA','CRC')") | @Auditable("RESCHEDULE_VISIT") | 是 |
| 13 | GET | `/api/v1/visits/overdue` | 逾期访视列表 | PageRequest, OverdueVisitFilterDTO | ApiResponse\<PageResponse\<VisitVO\>\> | @PreAuthorize("isAuthenticated()") | - | - |
| 14 | POST | `/api/v1/visits/{id}/skip` | 跳过访视 | VisitSkipDTO | ApiResponse\<VisitVO\> | @PreAuthorize("hasAnyRole('CRA','CRC','PI')") | @Auditable("SKIP_VISIT") | 是 |

### 5.2 VisitTemplateController - 访视模板管理

**Base Path**: `/api/v1/visit-templates`

| # | Method | Path | Description | Request Body/Params | Response | Auth | Audit | Idempotent |
|---|--------|------|-------------|---------------------|----------|------|-------|------------|
| 1 | POST | `/api/v1/visit-templates` | 创建访视模板 | VisitTemplateCreateDTO | ApiResponse\<VisitTemplateVO\> | @PreAuthorize("hasRole('DM') or hasRole('ADMIN')") | @Auditable("CREATE_VISIT_TEMPLATE") | 是 |
| 2 | PUT | `/api/v1/visit-templates/{id}` | 更新访视模板 | VisitTemplateUpdateDTO | ApiResponse\<VisitTemplateVO\> | @PreAuthorize("hasRole('DM') or hasRole('ADMIN')") | @Auditable("UPDATE_VISIT_TEMPLATE") | 是 |
| 3 | GET | `/api/v1/visit-templates` | 访视模板列表 | PageRequest, studyId (query) | ApiResponse\<PageResponse\<VisitTemplateVO\>\> | @PreAuthorize("isAuthenticated()") | - | - |
| 4 | GET | `/api/v1/visit-templates/{id}` | 获取访视模板详情 | id (path) | ApiResponse\<VisitTemplateDetailVO\> | @PreAuthorize("isAuthenticated()") | - | - |
| 5 | DELETE | `/api/v1/visit-templates/{id}` | 删除访视模板 | id (path) | ApiResponse\<Void\> | @PreAuthorize("hasRole('ADMIN')") | @Auditable("DELETE_VISIT_TEMPLATE") | 是 |
| 6 | POST | `/api/v1/visit-templates/{id}/copy` | 复制访视模板 | id (path), targetStudyId (query) | ApiResponse\<VisitTemplateVO\> | @PreAuthorize("hasRole('DM')") | @Auditable("COPY_VISIT_TEMPLATE") | 是 |
| 7 | POST | `/api/v1/visit-templates/{id}/forms` | 为模板添加表单 | FormAssignDTO | ApiResponse\<VisitTemplateVO\> | @PreAuthorize("hasRole('DM')") | @Auditable("ADD_FORM_TO_TEMPLATE") | 是 |
| 8 | DELETE | `/api/v1/visit-templates/{templateId}/forms/{formId}` | 从模板移除表单 | templateId, formId (path) | ApiResponse\<Void\> | @PreAuthorize("hasRole('DM')") | @Auditable("REMOVE_FORM_FROM_TEMPLATE") | 是 |

### 5.3 ObservationController - 观察项管理

**Base Path**: `/api/v1/observations`

| # | Method | Path | Description | Request Body/Params | Response | Auth | Audit | Idempotent |
|---|--------|------|-------------|---------------------|----------|------|-------|------------|
| 1 | POST | `/api/v1/observations` | 创建/更新观察值 | ObservationSaveDTO | ApiResponse\<ObservationVO\> | @PreAuthorize("hasAnyRole('CRA','CRC','PI')") | @Auditable("SAVE_OBSERVATION") | 是 |
| 2 | GET | `/api/v1/observations/{id}` | 获取观察值详情 | id (path) | ApiResponse\<ObservationVO\> | @PreAuthorize("isAuthenticated()") | - | - |
| 3 | POST | `/api/v1/observations/batch` | 批量保存观察值 | List\<ObservationSaveDTO\> | ApiResponse\<List\<ObservationVO\>\> | @PreAuthorize("hasAnyRole('CRA','CRC','PI')") | @Auditable("BATCH_SAVE_OBSERVATIONS") | 是 |
| 4 | GET | `/api/v1/observations/visit/{visitId}` | 获取访视所有观察值 | visitId (path) | ApiResponse\<List\<ObservationVO\>\> | @PreAuthorize("isAuthenticated()") | - | - |

### 5.4 QuestionnaireController - 问卷管理

**Base Path**: `/api/v1/questionnaires`

| # | Method | Path | Description | Request Body/Params | Response | Auth | Audit | Idempotent |
|---|--------|------|-------------|---------------------|----------|------|-------|------------|
| 1 | POST | `/api/v1/questionnaires` | 创建问卷定义 | QuestionnaireCreateDTO | ApiResponse\<QuestionnaireVO\> | @PreAuthorize("hasRole('DM') or hasRole('ADMIN')") | @Auditable("CREATE_QUESTIONNAIRE") | 是 |
| 2 | PUT | `/api/v1/questionnaires/{id}` | 更新问卷定义 | QuestionnaireUpdateDTO | ApiResponse\<QuestionnaireVO\> | @PreAuthorize("hasRole('DM') or hasRole('ADMIN')") | @Auditable("UPDATE_QUESTIONNAIRE") | 是 |
| 3 | GET | `/api/v1/questionnaires` | 问卷列表 | PageRequest, studyId (query) | ApiResponse\<PageResponse\<QuestionnaireVO\>\> | @PreAuthorize("isAuthenticated()") | - | - |
| 4 | GET | `/api/v1/questionnaires/{id}` | 获取问卷详情（含题目） | id (path) | ApiResponse\<QuestionnaireDetailVO\> | @PreAuthorize("isAuthenticated()") | - | - |
| 5 | DELETE | `/api/v1/questionnaires/{id}` | 删除问卷 | id (path) | ApiResponse\<Void\> | @PreAuthorize("hasRole('ADMIN')") | @Auditable("DELETE_QUESTIONNAIRE") | 是 |
| 6 | PUT | `/api/v1/questionnaires/{id}/activate` | 激活问卷版本 | id (path) | ApiResponse\<QuestionnaireVO\> | @PreAuthorize("hasRole('DM')") | @Auditable("ACTIVATE_QUESTIONNAIRE") | 是 |

### 5.5 QuestionnaireResponseController - 问卷作答管理

**Base Path**: `/api/v1/questionnaire-responses`

| # | Method | Path | Description | Request Body/Params | Response | Auth | Audit | Idempotent |
|---|--------|------|-------------|---------------------|----------|------|-------|------------|
| 1 | POST | `/api/v1/questionnaire-responses` | 提交问卷作答 | QuestionnaireResponseSubmitDTO | ApiResponse\<QuestionnaireResponseVO\> | @PreAuthorize("hasAnyRole('CRA','CRC','PI')") | @Auditable("SUBMIT_QUESTIONNAIRE") | 是 |
| 2 | GET | `/api/v1/questionnaire-responses/{id}` | 获取问卷作答详情 | id (path) | ApiResponse\<QuestionnaireResponseVO\> | @PreAuthorize("isAuthenticated()") | - | - |
| 3 | GET | `/api/v1/questionnaire-responses/subject/{subjectId}` | 获取受试者所有问卷作答 | subjectId (path), PageRequest | ApiResponse\<PageResponse\<QuestionnaireResponseVO\>\> | @PreAuthorize("isAuthenticated()") | - | - |
| 4 | GET | `/api/v1/questionnaire-responses/visit/{visitId}` | 获取访视关联问卷作答 | visitId (path) | ApiResponse\<List\<QuestionnaireResponseVO\>\> | @PreAuthorize("isAuthenticated()") | - | - |
| 5 | PUT | `/api/v1/questionnaire-responses/{id}` | 更新问卷作答 | QuestionnaireResponseUpdateDTO | ApiResponse\<QuestionnaireResponseVO\> | @PreAuthorize("hasAnyRole('CRA','CRC','PI')") | @Auditable("UPDATE_QUESTIONNAIRE_RESPONSE") | 是 |

---

## 6. Module 5: 监查管理 Monitoring

### 6.1 MonitoringController - 监查管理

**Base Path**: `/api/v1/monitoring`

| # | Method | Path | Description | Request Body/Params | Response | Auth | Audit | Idempotent |
|---|--------|------|-------------|---------------------|----------|------|-------|------------|
| 1 | POST | `/api/v1/monitoring/plans` | 创建监查计划 | MonitoringPlanCreateDTO | ApiResponse\<MonitoringPlanVO\> | @PreAuthorize("hasRole('PM') or hasRole('ADMIN')") | @Auditable("CREATE_MONITORING_PLAN") | 是 |
| 2 | PUT | `/api/v1/monitoring/plans/{id}` | 更新监查计划 | MonitoringPlanUpdateDTO | ApiResponse\<MonitoringPlanVO\> | @PreAuthorize("hasRole('PM')") | @Auditable("UPDATE_MONITORING_PLAN") | 是 |
| 3 | GET | `/api/v1/monitoring/plans` | 监查计划列表 | PageRequest, studyId (query) | ApiResponse\<PageResponse\<MonitoringPlanVO\>\> | @PreAuthorize("isAuthenticated()") | - | - |
| 4 | GET | `/api/v1/monitoring/plans/{id}` | 获取监查计划详情 | id (path) | ApiResponse\<MonitoringPlanDetailVO\> | @PreAuthorize("isAuthenticated()") | - | - |
| 5 | POST | `/api/v1/monitoring/visits` | 创建监查访视 | MonitoringVisitCreateDTO | ApiResponse\<MonitoringVisitVO\> | @PreAuthorize("hasAnyRole('CRA','PM')") | @Auditable("CREATE_MONITORING_VISIT") | 是 |
| 6 | PUT | `/api/v1/monitoring/visits/{id}` | 更新监查访视 | MonitoringVisitUpdateDTO | ApiResponse\<MonitoringVisitVO\> | @PreAuthorize("hasAnyRole('CRA','PM')") | @Auditable("UPDATE_MONITORING_VISIT") | 是 |
| 7 | GET | `/api/v1/monitoring/visits` | 监查访视列表 | PageRequest, MonitoringVisitFilterDTO | ApiResponse\<PageResponse\<MonitoringVisitVO\>\> | @PreAuthorize("isAuthenticated()") | - | - |
| 8 | GET | `/api/v1/monitoring/visits/{id}` | 监查访视详情 | id (path) | ApiResponse\<MonitoringVisitDetailVO\> | @PreAuthorize("isAuthenticated()") | - | - |
| 9 | PUT | `/api/v1/monitoring/visits/{id}/status` | 更新监查访视状态 | MonitoringVisitStatusDTO | ApiResponse\<MonitoringVisitVO\> | @PreAuthorize("hasAnyRole('CRA','PM')") | @Auditable("MONITORING_VISIT_STATUS") | 是 |
| 10 | POST | `/api/v1/monitoring/visits/{id}/report` | 生成/提交监查报告 | MonitoringReportDTO | ApiResponse\<MonitoringReportVO\> | @PreAuthorize("hasRole('CRA')") | @Auditable("SUBMIT_MONITORING_REPORT") | 是 |
| 11 | GET | `/api/v1/monitoring/visits/{visitId}/report` | 获取监查报告 | visitId (path) | ApiResponse\<MonitoringReportVO\> | @PreAuthorize("isAuthenticated()") | - | - |
| 12 | PUT | `/api/v1/monitoring/visits/{visitId}/report/approve` | 审批监查报告 | ApprovalDTO | ApiResponse\<MonitoringReportVO\> | @PreAuthorize("hasRole('PM')") | @Auditable("APPROVE_MONITORING_REPORT") | 是 |
| 13 | PUT | `/api/v1/monitoring/sdv/{subjectId}/visits/{visitId}` | 更新SDV状态 | SdvStatusUpdateDTO | ApiResponse\<SdvStatusVO\> | @PreAuthorize("hasRole('CRA')") | @Auditable("UPDATE_SDV") | 是 |
| 14 | POST | `/api/v1/monitoring/sdv/batch` | 批量SDV | BatchSdvDTO | ApiResponse\<BatchSdvResultVO\> | @PreAuthorize("hasRole('CRA')") | @Auditable("BATCH_SDV") | 是 |
| 15 | POST | `/api/v1/monitoring/action-items` | 创建行动项 | ActionItemCreateDTO | ApiResponse\<ActionItemVO\> | @PreAuthorize("hasAnyRole('CRA','PM')") | @Auditable("CREATE_ACTION_ITEM") | 是 |
| 16 | PUT | `/api/v1/monitoring/action-items/{id}` | 更新行动项 | ActionItemUpdateDTO | ApiResponse\<ActionItemVO\> | @PreAuthorize("hasAnyRole('CRA','PM')") | @Auditable("UPDATE_ACTION_ITEM") | 是 |
| 17 | PUT | `/api/v1/monitoring/action-items/{id}/status` | 行动项状态更新 | ActionItemStatusDTO | ApiResponse\<ActionItemVO\> | @PreAuthorize("hasAnyRole('CRA','PM')") | @Auditable("ACTION_ITEM_STATUS") | 是 |
| 18 | GET | `/api/v1/monitoring/action-items` | 行动项列表 | PageRequest, ActionItemFilterDTO | ApiResponse\<PageResponse\<ActionItemVO\>\> | @PreAuthorize("isAuthenticated()") | - | - |
| 19 | POST | `/api/v1/monitoring/findings` | 创建监查发现 | FindingCreateDTO | ApiResponse\<FindingVO\> | @PreAuthorize("hasRole('CRA')") | @Auditable("CREATE_FINDING") | 是 |
| 20 | PUT | `/api/v1/monitoring/findings/{id}` | 更新监查发现 | FindingUpdateDTO | ApiResponse\<FindingVO\> | @PreAuthorize("hasRole('CRA')") | @Auditable("UPDATE_FINDING") | 是 |
| 21 | GET | `/api/v1/monitoring/findings` | 监查发现列表 | PageRequest, FindingFilterDTO | ApiResponse\<PageResponse\<FindingVO\>\> | @PreAuthorize("isAuthenticated()") | - | - |
| 22 | GET | `/api/v1/monitoring/cra-dashboard` | CRA工作面板 | siteId (query), studyId (query) | ApiResponse\<CraDashboardVO\> | @PreAuthorize("hasRole('CRA')") | - | - |

### 6.2 监查访视类型枚举

| 值 | 说明 |
|----|------|
| SIV | 中心启动访视 (Site Initiation Visit) |
| IMV | 中期监查访视 (Interim Monitoring Visit) |
| COV | 中心关闭访视 (Close-out Visit) |
| FUV | 跟进访视 (Follow-up Visit) |
| REMOTE | 远程监查 |
| PRE_STUDY | 试验前访视 |

### 6.3 SDV状态枚举

| 值 | 说明 |
|----|------|
| NOT_STARTED | 未开始 |
| IN_PROGRESS | 进行中 |
| COMPLETED | 已完成 |
| NOT_REQUIRED | 无需SDV |
| DISCREPANCY_FOUND | 发现差异 |

---

## 7. Module 6: 质量管理 Quality Management

### 7.1 QueryController - 质疑管理

**Base Path**: `/api/v1/queries`

| # | Method | Path | Description | Request Body/Params | Response | Auth | Audit | Idempotent |
|---|--------|------|-------------|---------------------|----------|------|-------|------------|
| 1 | POST | `/api/v1/queries` | 创建质疑 | QueryCreateDTO | ApiResponse\<QueryVO\> | @PreAuthorize("hasAnyRole('CRA','DM','CRC')") | @Auditable("CREATE_QUERY") | 是 |
| 2 | GET | `/api/v1/queries/{id}` | 获取质疑详情 | id (path) | ApiResponse\<QueryDetailVO\> | @PreAuthorize("isAuthenticated()") | - | - |
| 3 | GET | `/api/v1/queries` | 质疑列表（分页+筛选） | PageRequest, QueryFilterDTO | ApiResponse\<PageResponse\<QueryVO\>\> | @PreAuthorize("isAuthenticated()") | - | - |
| 4 | PUT | `/api/v1/queries/{id}` | 更新质疑信息 | QueryUpdateDTO | ApiResponse\<QueryVO\> | @PreAuthorize("hasAnyRole('CRA','DM')") | @Auditable("UPDATE_QUERY") | 是 |
| 5 | PUT | `/api/v1/queries/{id}/status` | 质疑状态转换 | QueryStatusTransitionDTO | ApiResponse\<QueryVO\> | @PreAuthorize("hasAnyRole('CRA','DM','CRC')") | @Auditable("QUERY_STATUS_CHANGE") | 是 |
| 6 | POST | `/api/v1/queries/{id}/respond` | 回复质疑 | QueryResponseDTO | ApiResponse\<QueryVO\> | @PreAuthorize("hasAnyRole('CRA','DM','CRC')") | @Auditable("RESPOND_QUERY") | 是 |
| 7 | POST | `/api/v1/queries/{id}/reopen` | 重新打开质疑 | QueryReopenDTO | ApiResponse\<QueryVO\> | @PreAuthorize("hasAnyRole('CRA','DM')") | @Auditable("REOPEN_QUERY") | 是 |
| 8 | GET | `/api/v1/queries/aging-report` | 质疑时效报表 | studyId (query), siteId (query) | ApiResponse\<QueryAgingReportVO\> | @PreAuthorize("hasAnyRole('PM','DM','CRA')") | - | - |
| 9 | POST | `/api/v1/queries/batch` | 批量创建质疑 | BatchQueryCreateDTO | ApiResponse\<BatchQueryResultVO\> | @PreAuthorize("hasAnyRole('CRA','DM')") | @Auditable("BATCH_CREATE_QUERY") | 是 |
| 10 | PUT | `/api/v1/queries/batch-close` | 批量关闭质疑 | BatchQueryCloseDTO | ApiResponse\<BatchQueryResultVO\> | @PreAuthorize("hasAnyRole('CRA','DM')") | @Auditable("BATCH_CLOSE_QUERY") | 是 |

### 7.2 IssueController - 问题管理

**Base Path**: `/api/v1/issues`

| # | Method | Path | Description | Request Body/Params | Response | Auth | Audit | Idempotent |
|---|--------|------|-------------|---------------------|----------|------|-------|------------|
| 1 | POST | `/api/v1/issues` | 创建问题 | IssueCreateDTO | ApiResponse\<IssueVO\> | @PreAuthorize("isAuthenticated()") | @Auditable("CREATE_ISSUE") | 是 |
| 2 | GET | `/api/v1/issues/{id}` | 获取问题详情 | id (path) | ApiResponse\<IssueDetailVO\> | @PreAuthorize("isAuthenticated()") | - | - |
| 3 | GET | `/api/v1/issues` | 问题列表（分页+筛选） | PageRequest, IssueFilterDTO | ApiResponse\<PageResponse\<IssueVO\>\> | @PreAuthorize("isAuthenticated()") | - | - |
| 4 | PUT | `/api/v1/issues/{id}` | 更新问题信息 | IssueUpdateDTO | ApiResponse\<IssueVO\> | @PreAuthorize("isAuthenticated()") | @Auditable("UPDATE_ISSUE") | 是 |
| 5 | PUT | `/api/v1/issues/{id}/status` | 问题状态转换 | IssueStatusTransitionDTO | ApiResponse\<IssueVO\> | @PreAuthorize("hasAnyRole('PM','DM','CRA')") | @Auditable("ISSUE_STATUS_CHANGE") | 是 |
| 6 | PUT | `/api/v1/issues/{id}/assign` | 分配问题处理人 | IssueAssignDTO | ApiResponse\<IssueVO\> | @PreAuthorize("hasAnyRole('PM','DM')") | @Auditable("ASSIGN_ISSUE") | 是 |
| 7 | POST | `/api/v1/issues/{id}/escalate` | 升级问题 | IssueEscalateDTO | ApiResponse\<IssueVO\> | @PreAuthorize("hasAnyRole('PM','DM','CRA')") | @Auditable("ESCALATE_ISSUE") | 是 |

### 7.3 DeviationController - 方案偏离管理

**Base Path**: `/api/v1/deviations`

| # | Method | Path | Description | Request Body/Params | Response | Auth | Audit | Idempotent |
|---|--------|------|-------------|---------------------|----------|------|-------|------------|
| 1 | POST | `/api/v1/deviations` | 创建方案偏离 | DeviationCreateDTO | ApiResponse\<DeviationVO\> | @PreAuthorize("hasAnyRole('CRA','CRC','PI')") | @Auditable("CREATE_DEVIATION") | 是 |
| 2 | GET | `/api/v1/deviations/{id}` | 获取方案偏离详情 | id (path) | ApiResponse\<DeviationDetailVO\> | @PreAuthorize("isAuthenticated()") | - | - |
| 3 | GET | `/api/v1/deviations` | 方案偏离列表（分页+筛选） | PageRequest, DeviationFilterDTO | ApiResponse\<PageResponse\<DeviationVO\>\> | @PreAuthorize("isAuthenticated()") | - | - |
| 4 | PUT | `/api/v1/deviations/{id}` | 更新方案偏离 | DeviationUpdateDTO | ApiResponse\<DeviationVO\> | @PreAuthorize("hasAnyRole('CRA','PM','DM')") | @Auditable("UPDATE_DEVIATION") | 是 |
| 5 | PUT | `/api/v1/deviations/{id}/assess` | 评估方案偏离（严重程度/是否上报） | DeviationAssessmentDTO | ApiResponse\<DeviationVO\> | @PreAuthorize("hasAnyRole('PM','DM')") | @Auditable("ASSESS_DEVIATION") | 是 |
| 6 | PUT | `/api/v1/deviations/{id}/status` | 方案偏离状态更新 | DeviationStatusDTO | ApiResponse\<DeviationVO\> | @PreAuthorize("hasAnyRole('PM','DM')") | @Auditable("DEVIATION_STATUS_CHANGE") | 是 |

### 7.4 CapaController - CAPA管理

**Base Path**: `/api/v1/capas`

| # | Method | Path | Description | Request Body/Params | Response | Auth | Audit | Idempotent |
|---|--------|------|-------------|---------------------|----------|------|-------|------------|
| 1 | POST | `/api/v1/capas` | 创建CAPA | CapaCreateDTO | ApiResponse\<CapaVO\> | @PreAuthorize("hasAnyRole('PM','DM','QA')") | @Auditable("CREATE_CAPA") | 是 |
| 2 | GET | `/api/v1/capas/{id}` | 获取CAPA详情 | id (path) | ApiResponse\<CapaDetailVO\> | @PreAuthorize("isAuthenticated()") | - | - |
| 3 | GET | `/api/v1/capas` | CAPA列表（分页+筛选） | PageRequest, CapaFilterDTO | ApiResponse\<PageResponse\<CapaVO\>\> | @PreAuthorize("isAuthenticated()") | - | - |
| 4 | PUT | `/api/v1/capas/{id}` | 更新CAPA | CapaUpdateDTO | ApiResponse\<CapaVO\> | @PreAuthorize("hasAnyRole('PM','DM','QA')") | @Auditable("UPDATE_CAPA") | 是 |
| 5 | PUT | `/api/v1/capas/{id}/approve` | 审批CAPA | CapaApprovalDTO | ApiResponse\<CapaVO\> | @PreAuthorize("hasAnyRole('PM','QA')") | @Auditable("APPROVE_CAPA") | 是 |
| 6 | PUT | `/api/v1/capas/{id}/status` | CAPA状态转换 | CapaStatusTransitionDTO | ApiResponse\<CapaVO\> | @PreAuthorize("hasAnyRole('PM','DM','QA')") | @Auditable("CAPA_STATUS_CHANGE") | 是 |
| 7 | PUT | `/api/v1/capas/{id}/effectiveness-check` | CAPA有效性检查 | CapaEffectivenessDTO | ApiResponse\<CapaVO\> | @PreAuthorize("hasAnyRole('PM','QA')") | @Auditable("CAPA_EFFECTIVENESS_CHECK") | 是 |

### 7.5 状态机汇总

**质疑状态机:**
```
OPEN -> IN_REVIEW -> RESPONDED -> ANSWERED -> CLOSED
  |        |           |                       ^
CANCELLED (可从 OPEN/IN_REVIEW 进入)
  |
REOPENED -> IN_REVIEW -> ...
```

**问题状态机:**
```
OPEN -> IN_PROGRESS -> RESOLVED -> CLOSED
  |        |            |
CANCELLED (可从 OPEN/IN_PROGRESS 进入)
  |        |
ESCALATED -> IN_PROGRESS -> ...
```

**CAPA状态机:**
```
DRAFT -> SUBMITTED -> APPROVED -> IN_PROGRESS -> IMPLEMENTED -> EFFECTIVENESS_CHECK -> CLOSED
  |        |            |            |             |                |
REJECTED (从 SUBMITTED 进入审批拒绝)
```

---

## 8. Module 7: 安全性管理 Safety

### 8.1 AeController - 不良事件管理

**Base Path**: `/api/v1/aes`

| # | Method | Path | Description | Request Body/Params | Response | Auth | Audit | Idempotent |
|---|--------|------|-------------|---------------------|----------|------|-------|------------|
| 1 | POST | `/api/v1/aes` | 创建不良事件 | AeCreateDTO | ApiResponse<AeVO> | @PreAuthorize("hasAnyRole('CRA','CRC','PI')") | @Auditable("CREATE_AE") | 是 |
| 2 | GET | `/api/v1/aes/{id}` | 获取AE详情 | id (path) | ApiResponse<AeDetailVO> | @PreAuthorize("isAuthenticated()") | - | - |
| 3 | GET | `/api/v1/aes` | AE列表（分页+筛选） | PageRequest, AeFilterDTO | ApiResponse<PageResponse<AeVO>> | @PreAuthorize("isAuthenticated()") | - | - |
| 4 | PUT | `/api/v1/aes/{id}` | 更新AE信息 | AeUpdateDTO | ApiResponse<AeVO> | @PreAuthorize("hasAnyRole('CRA','CRC','PI')") | @Auditable("UPDATE_AE") | 是 |
| 5 | PUT | `/api/v1/aes/{id}/status` | AE状态更新 | AeStatusUpdateDTO | ApiResponse<AeVO> | @PreAuthorize("hasAnyRole('CRA','PI','DS')") | @Auditable("AE_STATUS_CHANGE") | 是 |
| 6 | POST | `/api/v1/aes/{id}/escalate-to-sae` | AE升级为SAE | AeEscalateToSaeDTO | ApiResponse<SaeVO> | @PreAuthorize("hasAnyRole('CRA','PI')") | @Auditable("AE_ESCALATE_TO_SAE") | 是 |
| 7 | PUT | `/api/v1/aes/{id}/meddra-code` | 设置MedDRA编码 | MeddraCodingDTO | ApiResponse<AeVO> | @PreAuthorize("hasAnyRole('DS','DM')") | @Auditable("MEDDRA_CODING") | 是 |
| 8 | GET | `/api/v1/aes/{id}/meddra-suggestions` | MedDRA编码建议 | id (path) | ApiResponse<List<MeddraSuggestionVO>> | @PreAuthorize("hasAnyRole('DS','DM')") | - | - |
| 9 | POST | `/api/v1/aes/{id}/narrative` | 添加AE叙述 | NarrativeCreateDTO | ApiResponse<AeNarrativeVO> | @PreAuthorize("hasAnyRole('CRA','CRC','PI')") | @Auditable("ADD_AE_NARRATIVE") | 是 |
| 10 | PUT | `/api/v1/aes/{aeId}/narrative/{narrativeId}` | 更新叙述 | NarrativeUpdateDTO | ApiResponse<AeNarrativeVO> | @PreAuthorize("hasAnyRole('CRA','CRC','PI')") | @Auditable("UPDATE_AE_NARRATIVE") | 是 |
| 11 | GET | `/api/v1/aes/{id}/timeline` | AE时间线 | id (path) | ApiResponse<List<AeTimelineEventVO>> | @PreAuthorize("isAuthenticated()") | - | - |
| 12 | GET | `/api/v1/aes/summary` | AE汇总（按试验/中心） | studyId (query), siteId (query) | ApiResponse<AeSummaryVO> | @PreAuthorize("isAuthenticated()") | - | - |

### 8.2 SaeController - 严重不良事件管理

**Base Path**: `/api/v1/saes`

| # | Method | Path | Description | Request Body/Params | Response | Auth | Audit | Idempotent |
|---|--------|------|-------------|---------------------|----------|------|-------|------------|
| 1 | GET | `/api/v1/saes/{id}` | 获取SAE详情 | id (path) | ApiResponse<SaeDetailVO> | @PreAuthorize("isAuthenticated()") | - | - |
| 2 | GET | `/api/v1/saes` | SAE列表（分页+筛选） | PageRequest, SaeFilterDTO | ApiResponse<PageResponse<SaeVO>> | @PreAuthorize("isAuthenticated()") | - | - |
| 3 | PUT | `/api/v1/saes/{id}` | 更新SAE信息 | SaeUpdateDTO | ApiResponse<SaeVO> | @PreAuthorize("hasAnyRole('CRA','PI','DS')") | @Auditable("UPDATE_SAE") | 是 |
| 4 | POST | `/api/v1/saes/{id}/escalate` | SAE上报工作流 | SaeEscalateDTO | ApiResponse<SaeWorkflowVO> | @PreAuthorize("hasAnyRole('CRA','PI','DS')") | @Auditable("SAE_ESCALATE") | 是 |
| 5 | PUT | `/api/v1/saes/{id}/regulatory-status` | 更新法规递交状态 | RegulatoryStatusUpdateDTO | ApiResponse<RegulatorySubmissionVO> | @PreAuthorize("hasAnyRole('DS','PM')") | @Auditable("REGULATORY_STATUS_UPDATE") | 是 |
| 6 | GET | `/api/v1/saes/{id}/regulatory-submissions` | SAE的法规递交记录 | id (path) | ApiResponse<List<RegulatorySubmissionVO>> | @PreAuthorize("isAuthenticated()") | - | - |
| 7 | POST | `/api/v1/saes/{id}/regulatory-submissions` | 创建法规递交记录 | RegulatorySubmissionCreateDTO | ApiResponse<RegulatorySubmissionVO> | @PreAuthorize("hasAnyRole('DS','PM')") | @Auditable("CREATE_REGULATORY_SUBMISSION") | 是 |
| 8 | GET | `/api/v1/saes/{id}/followup-reports` | SAE随访报告 | id (path) | ApiResponse<List<SaeFollowupReportVO>> | @PreAuthorize("isAuthenticated()") | - | - |
| 9 | POST | `/api/v1/saes/{id}/followup-reports` | 创建SAE随访报告 | SaeFollowupReportCreateDTO | ApiResponse<SaeFollowupReportVO> | @PreAuthorize("hasAnyRole('CRA','PI','DS')") | @Auditable("CREATE_FOLLOWUP_REPORT") | 是 |
| 10 | GET | `/api/v1/saes/{id}/narrative` | SAE叙述 | id (path) | ApiResponse<SaeNarrativeVO> | @PreAuthorize("isAuthenticated()") | - | - |
| 11 | PUT | `/api/v1/saes/{id}/narrative` | 更新SAE叙述 | SaeNarrativeUpdateDTO | ApiResponse<SaeNarrativeVO> | @PreAuthorize("hasAnyRole('CRA','PI','DS')") | @Auditable("UPDATE_SAE_NARRATIVE") | 是 |
| 12 | GET | `/api/v1/saes/{id}/expedited-report` | 生成加速报告预览 | id (path) | ApiResponse<ExpeditedReportVO> | @PreAuthorize("hasAnyRole('DS','PM')") | - | - |
| 13 | PUT | `/api/v1/saes/{id}/unblind` | SAE紧急揭盲 | UnblindRequestDTO | ApiResponse<UnblindResultVO> | @PreAuthorize("hasRole('PI')") | @Auditable("SAE_EMERGENCY_UNBLIND") | 是 |
| 14 | PUT | `/api/v1/saes/{id}/outcome` | 记录SAE结局 | SaeOutcomeDTO | ApiResponse<SaeVO> | @PreAuthorize("hasAnyRole('CRA','PI','DS')") | @Auditable("UPDATE_SAE_OUTCOME") | 是 |

### 8.3 SAE上报时限要求（7天/15天）

| 类型 | 时限 | 说明 |
|------|------|------|
| 致死或危及生命 | 7日历天 | 首次报告必须在上报人获知后7天内提交 |
| 其他SAE | 15日历天 | 首次报告必须在上报人获知后15天内提交 |
| 随访报告 | 根据事件进展 | 根据事件结局情况及时提交 |

### 8.4 SAE严重程度标准 (Seriousness Criteria)

| 枚举值 | 说明 |
|--------|------|
| DEATH | 导致死亡 |
| LIFE_THREATENING | 危及生命 |
| HOSPITALIZATION | 导致住院或延长住院时间 |
| DISABILITY | 导致永久或显著残疾/功能丧失 |
| CONGENITAL_ANOMALY | 导致先天畸形/出生缺陷 |
| MEDICALLY_IMPORTANT | 其他重要医学事件 |

### 8.5 AE严重程度等级 (Severity Grade)

| 等级 | 值 | 说明 |
|------|----|------|
| Grade 1 | MILD | 轻度：无症状或轻微症状，仅临床或实验室检查可发现 |
| Grade 2 | MODERATE | 中度：需要最小、局部或非侵入性干预 |
| Grade 3 | SEVERE | 重度：医学上重要但不会立即危及生命 |
| Grade 4 | LIFE_THREATENING | 危及生命：需要紧急干预 |
| Grade 5 | DEATH | 导致死亡 |

### 8.6 AE与试验药物的关系判定

| 枚举值 | 说明 |
|--------|------|
| DEFINITELY_RELATED | 肯定有关 |
| PROBABLY_RELATED | 很可能有关 |
| POSSIBLY_RELATED | 可能有关 |
| UNLIKELY_RELATED | 可能无关 |
| NOT_RELATED | 肯定无关 |

---

## 9. Module 8: 文档管理 Document Management

### 9.1 DocumentController - 文档管理

**Base Path**: `/api/v1/documents`

| # | Method | Path | Description | Request Body/Params | Response | Auth | Audit | Idempotent |
|---|--------|------|-------------|---------------------|----------|------|-------|------------|
| 1 | POST | `/api/v1/documents` | 创建文档元数据 | DocumentCreateDTO | ApiResponse<DocumentVO> | @PreAuthorize("isAuthenticated()") | @Auditable("CREATE_DOCUMENT") | 是 |
| 2 | GET | `/api/v1/documents/{id}` | 获取文档详情 | id (path) | ApiResponse<DocumentDetailVO> | @PreAuthorize("isAuthenticated()") | - | - |
| 3 | GET | `/api/v1/documents` | 文档列表（分页+筛选） | PageRequest, DocumentFilterDTO | ApiResponse<PageResponse<DocumentVO>> | @PreAuthorize("isAuthenticated()") | - | - |
| 4 | PUT | `/api/v1/documents/{id}` | 更新文档元数据 | DocumentUpdateDTO | ApiResponse<DocumentVO> | @PreAuthorize("isAuthenticated()") | @Auditable("UPDATE_DOCUMENT") | 是 |
| 5 | DELETE | `/api/v1/documents/{id}` | 删除文档（软删除） | id (path) | ApiResponse<Void> | @PreAuthorize("hasRole('ADMIN')") | @Auditable("DELETE_DOCUMENT") | 是 |
| 6 | GET | `/api/v1/documents/{id}/versions` | 文档版本列表 | id (path) | ApiResponse<List<DocumentVersionVO>> | @PreAuthorize("isAuthenticated()") | - | - |
| 7 | POST | `/api/v1/documents/{id}/versions` | 创建新版本 | DocumentVersionCreateDTO | ApiResponse<DocumentVersionVO> | @PreAuthorize("isAuthenticated()") | @Auditable("CREATE_DOCUMENT_VERSION") | 是 |
| 8 | PUT | `/api/v1/documents/{docId}/versions/{versionId}/activate` | 激活文档版本 | docId, versionId (path) | ApiResponse<DocumentVersionVO> | @PreAuthorize("hasAnyRole('PM','DM','ADMIN')") | @Auditable("ACTIVATE_DOCUMENT_VERSION") | 是 |
| 9 | PUT | `/api/v1/documents/{id}/submit` | 提交文档审批 | SubmitForApprovalDTO | ApiResponse<DocumentVO> | @PreAuthorize("isAuthenticated()") | @Auditable("SUBMIT_DOC_FOR_APPROVAL") | 是 |
| 10 | PUT | `/api/v1/documents/{id}/approve` | 审批文档 | DocumentApprovalDTO | ApiResponse<DocumentVO> | @PreAuthorize("hasAnyRole('PM','DM','ADMIN')") | @Auditable("APPROVE_DOCUMENT") | 是 |
| 11 | PUT | `/api/v1/documents/{id}/reject` | 驳回文档 | DocumentRejectionDTO | ApiResponse<DocumentVO> | @PreAuthorize("hasAnyRole('PM','DM','ADMIN')") | @Auditable("REJECT_DOCUMENT") | 是 |
| 12 | GET | `/api/v1/documents/{id}/audit-trail` | 文档审计轨迹 | id (path), PageRequest | ApiResponse<PageResponse<AuditLogVO>> | @PreAuthorize("isAuthenticated()") | - | - |
| 13 | GET | `/api/v1/documents/tmf-index` | TMF索引列表 | studyId (query), PageRequest | ApiResponse<PageResponse<TmfIndexVO>> | @PreAuthorize("isAuthenticated()") | - | - |
| 14 | GET | `/api/v1/documents/tmf-index/{id}/completeness` | TMF完整性检查 | id (path) | ApiResponse<TmfCompletenessVO> | @PreAuthorize("isAuthenticated()") | - | - |
| 15 | GET | `/api/v1/documents/tmf-index/export` | 导出TMF索引（异步） | studyId (query) | ApiResponse<AsyncTaskVO> | @PreAuthorize("hasRole('DM') or hasRole('PM')") | @Auditable("EXPORT_TMF_INDEX") | - |

### 9.2 FileController - 文件操作

**Base Path**: `/api/v1/files`

| # | Method | Path | Description | Request Body/Params | Response | Auth | Audit | Idempotent |
|---|--------|------|-------------|---------------------|----------|------|-------|------------|
| 1 | POST | `/api/v1/files/upload-url` | 获取文件上传预签名URL | FileUploadUrlRequestDTO | ApiResponse<FileUploadUrlVO> | @PreAuthorize("isAuthenticated()") | - | - |
| 2 | POST | `/api/v1/files/upload-confirm` | 确认文件上传完成 | FileUploadConfirmDTO | ApiResponse<FileVO> | @PreAuthorize("isAuthenticated()") | @Auditable("CONFIRM_FILE_UPLOAD") | 是 |
| 3 | POST | `/api/v1/files/download-url` | 获取文件下载预签名URL | FileDownloadUrlRequestDTO | ApiResponse<FileDownloadUrlVO> | @PreAuthorize("isAuthenticated()") | @Auditable("ACCESS_FILE_DOWNLOAD") | - |
| 4 | DELETE | `/api/v1/files/{id}` | 删除文件 | id (path) | ApiResponse<Void> | @PreAuthorize("hasRole('ADMIN')") | @Auditable("DELETE_FILE") | 是 |
| 5 | GET | `/api/v1/files/{id}/info` | 获取文件元信息 | id (path) | ApiResponse<FileVO> | @PreAuthorize("isAuthenticated()") | - | - |
| 6 | GET | `/api/v1/files/{id}/preview-url` | 获取文件预览URL | id (path), expireMinutes (query) | ApiResponse<FilePreviewUrlVO> | @PreAuthorize("isAuthenticated()") | - | - |
| 7 | POST | `/api/v1/files/{id}/ocr` | 触发文件OCR处理 | id (path) | ApiResponse<AsyncTaskVO> | @PreAuthorize("isAuthenticated()") | @Auditable("TRIGGER_OCR") | 是 |
| 8 | GET | `/api/v1/files/{id}/ocr-result` | 获取OCR结果 | id (path) | ApiResponse<OcrResultVO> | @PreAuthorize("isAuthenticated()") | - | - |

### 9.3 TMF (Trial Master File) 索引结构

TMF索引区域 (Zone):

| Zone | 说明 | 典型文档 |
|------|------|----------|
| ZONE_01 | 试验启动前文档 | 方案、研究者手册、知情同意书模板 |
| ZONE_02 | 中心管理文档 | 中心选择报告、中心合同、启动报告 |
| ZONE_03 | 试验管理文档 | 监查计划、监查报告、沟通记录 |
| ZONE_04 | 安全性文档 | SAE报告、DSUR、安全性更新报告 |
| ZONE_05 | 统计与数据管理文档 | DMP、DVP、数据库锁定记录 |
| ZONE_06 | 质量管理文档 | 稽查报告、CAPA记录、质量审计 |
| ZONE_07 | 试验结束文档 | 中心关闭报告、临床试验报告 |

---

## 10. Module 9: 财务管理 Finance

### 10.1 BudgetController - 预算管理

**Base Path**: `/api/v1/budgets`

| # | Method | Path | Description | Request Body/Params | Response | Auth | Audit | Idempotent |
|---|--------|------|-------------|---------------------|----------|------|-------|------------|
| 1 | POST | `/api/v1/budgets` | 创建预算 | BudgetCreateDTO | ApiResponse<BudgetVO> | @PreAuthorize("hasAnyRole('PM','FINANCE','ADMIN')") | @Auditable("CREATE_BUDGET") | 是 |
| 2 | GET | `/api/v1/budgets/{id}` | 获取预算详情 | id (path) | ApiResponse<BudgetDetailVO> | @PreAuthorize("hasAnyRole('PM','FINANCE','ADMIN')") | - | - |
| 3 | GET | `/api/v1/budgets` | 预算列表（分页+筛选） | PageRequest, BudgetFilterDTO | ApiResponse<PageResponse<BudgetVO>> | @PreAuthorize("hasAnyRole('PM','FINANCE','ADMIN')") | - | - |
| 4 | PUT | `/api/v1/budgets/{id}` | 更新预算 | BudgetUpdateDTO | ApiResponse<BudgetVO> | @PreAuthorize("hasAnyRole('PM','FINANCE','ADMIN')") | @Auditable("UPDATE_BUDGET") | 是 |
| 5 | PUT | `/api/v1/budgets/{id}/approve` | 审批预算 | BudgetApprovalDTO | ApiResponse<BudgetVO> | @PreAuthorize("hasAnyRole('PM','FINANCE')") | @Auditable("APPROVE_BUDGET") | 是 |
| 6 | GET | `/api/v1/budgets/{id}/actual-vs-planned` | 预算vs实际对比 | id (path) | ApiResponse<BudgetComparisonVO> | @PreAuthorize("hasAnyRole('PM','FINANCE','ADMIN')") | - | - |

### 10.2 ContractController - 合同管理

**Base Path**: `/api/v1/contracts`

| # | Method | Path | Description | Request Body/Params | Response | Auth | Audit | Idempotent |
|---|--------|------|-------------|---------------------|----------|------|-------|------------|
| 1 | POST | `/api/v1/contracts` | 创建合同 | ContractCreateDTO | ApiResponse<ContractVO> | @PreAuthorize("hasAnyRole('PM','FINANCE','ADMIN')") | @Auditable("CREATE_CONTRACT") | 是 |
| 2 | GET | `/api/v1/contracts/{id}` | 获取合同详情 | id (path) | ApiResponse<ContractDetailVO> | @PreAuthorize("hasAnyRole('PM','FINANCE','ADMIN')") | - | - |
| 3 | GET | `/api/v1/contracts` | 合同列表（分页+筛选） | PageRequest, ContractFilterDTO | ApiResponse<PageResponse<ContractVO>> | @PreAuthorize("hasAnyRole('PM','FINANCE','ADMIN')") | - | - |
| 4 | PUT | `/api/v1/contracts/{id}` | 更新合同 | ContractUpdateDTO | ApiResponse<ContractVO> | @PreAuthorize("hasAnyRole('PM','FINANCE','ADMIN')") | @Auditable("UPDATE_CONTRACT") | 是 |
| 5 | PUT | `/api/v1/contracts/{id}/submit` | 提交合同审批 | id (path) | ApiResponse<ContractVO> | @PreAuthorize("hasAnyRole('PM','FINANCE')") | @Auditable("SUBMIT_CONTRACT") | 是 |
| 6 | PUT | `/api/v1/contracts/{id}/approve` | 审批合同 | ContractApprovalDTO | ApiResponse<ContractVO> | @PreAuthorize("hasRole('FINANCE') or hasRole('ADMIN')") | @Auditable("APPROVE_CONTRACT") | 是 |
| 7 | GET | `/api/v1/contracts/{id}/milestones` | 合同里程碑/付款节点 | id (path) | ApiResponse<List<ContractMilestoneVO>> | @PreAuthorize("hasAnyRole('PM','FINANCE','ADMIN')") | - | - |

### 10.3 PaymentController - 付款管理

**Base Path**: `/api/v1/payments`

| # | Method | Path | Description | Request Body/Params | Response | Auth | Audit | Idempotent |
|---|--------|------|-------------|---------------------|----------|------|-------|------------|
| 1 | POST | `/api/v1/payments` | 创建付款申请 | PaymentCreateDTO | ApiResponse<PaymentVO> | @PreAuthorize("hasAnyRole('PM','FINANCE','ADMIN')") | @Auditable("CREATE_PAYMENT") | 是 |
| 2 | GET | `/api/v1/payments/{id}` | 获取付款详情 | id (path) | ApiResponse<PaymentDetailVO> | @PreAuthorize("hasAnyRole('PM','FINANCE','ADMIN')") | - | - |
| 3 | GET | `/api/v1/payments` | 付款列表（分页+筛选） | PageRequest, PaymentFilterDTO | ApiResponse<PageResponse<PaymentVO>> | @PreAuthorize("hasAnyRole('PM','FINANCE','ADMIN')") | - | - |
| 4 | PUT | `/api/v1/payments/{id}/approve` | 审批付款 | PaymentApprovalDTO | ApiResponse<PaymentVO> | @PreAuthorize("hasRole('FINANCE') or hasRole('ADMIN')") | @Auditable("APPROVE_PAYMENT") | 是 |
| 5 | PUT | `/api/v1/payments/{id}/status` | 更新付款状态（已付款/已到账） | PaymentStatusDTO | ApiResponse<PaymentVO> | @PreAuthorize("hasRole('FINANCE') or hasRole('ADMIN')") | @Auditable("UPDATE_PAYMENT_STATUS") | 是 |
| 6 | GET | `/api/v1/payments/summary` | 付款汇总 | studyId (query), startDate, endDate | ApiResponse<PaymentSummaryVO> | @PreAuthorize("hasAnyRole('PM','FINANCE','ADMIN')") | - | - |

### 10.4 ReimbursementController - 报销管理

**Base Path**: `/api/v1/reimbursements`

| # | Method | Path | Description | Request Body/Params | Response | Auth | Audit | Idempotent |
|---|--------|------|-------------|---------------------|----------|------|-------|------------|
| 1 | POST | `/api/v1/reimbursements` | 创建报销申请 | ReimbursementCreateDTO | ApiResponse<ReimbursementVO> | @PreAuthorize("isAuthenticated()") | @Auditable("CREATE_REIMBURSEMENT") | 是 |
| 2 | GET | `/api/v1/reimbursements/{id}` | 获取报销详情 | id (path) | ApiResponse<ReimbursementDetailVO> | @PreAuthorize("isAuthenticated()") | - | - |
| 3 | GET | `/api/v1/reimbursements` | 报销列表（分页+筛选） | PageRequest, ReimbursementFilterDTO | ApiResponse<PageResponse<ReimbursementVO>> | @PreAuthorize("isAuthenticated()") | - | - |
| 4 | PUT | `/api/v1/reimbursements/{id}` | 更新报销申请 | ReimbursementUpdateDTO | ApiResponse<ReimbursementVO> | @PreAuthorize("isAuthenticated()") | @Auditable("UPDATE_REIMBURSEMENT") | 是 |
| 5 | PUT | `/api/v1/reimbursements/{id}/submit` | 提交报销审批 | id (path) | ApiResponse<ReimbursementVO> | @PreAuthorize("isAuthenticated()") | @Auditable("SUBMIT_REIMBURSEMENT") | 是 |
| 6 | PUT | `/api/v1/reimbursements/{id}/approve` | 审批报销 | ReimbursementApprovalDTO | ApiResponse<ReimbursementVO> | @PreAuthorize("hasRole('FINANCE') or hasRole('ADMIN')") | @Auditable("APPROVE_REIMBURSEMENT") | 是 |

### 10.5 InvoiceController - 发票管理

**Base Path**: `/api/v1/invoices`

| # | Method | Path | Description | Request Body/Params | Response | Auth | Audit | Idempotent |
|---|--------|------|-------------|---------------------|----------|------|-------|------------|
| 1 | POST | `/api/v1/invoices` | 创建发票记录 | InvoiceCreateDTO | ApiResponse<InvoiceVO> | @PreAuthorize("hasRole('FINANCE') or hasRole('ADMIN')") | @Auditable("CREATE_INVOICE") | 是 |
| 2 | GET | `/api/v1/invoices/{id}` | 获取发票详情 | id (path) | ApiResponse<InvoiceDetailVO> | @PreAuthorize("hasAnyRole('PM','FINANCE','ADMIN')") | - | - |
| 3 | GET | `/api/v1/invoices` | 发票列表（分页+筛选） | PageRequest, InvoiceFilterDTO | ApiResponse<PageResponse<InvoiceVO>> | @PreAuthorize("hasAnyRole('PM','FINANCE','ADMIN')") | - | - |
| 4 | GET | `/api/v1/invoices/reconciliation-report` | 对账报表 | studyId (query), startDate, endDate | ApiResponse<ReconciliationReportVO> | @PreAuthorize("hasRole('FINANCE') or hasRole('ADMIN')") | - | - |
| 5 | PUT | `/api/v1/invoices/{id}/status` | 更新发票状态 | InvoiceStatusDTO | ApiResponse<InvoiceVO> | @PreAuthorize("hasRole('FINANCE') or hasRole('ADMIN')") | @Auditable("UPDATE_INVOICE_STATUS") | 是 |

### 10.6 财务模块审批流程

```
DRAFT -> SUBMITTED -> UNDER_REVIEW -> APPROVED / REJECTED
                           |
                      PENDING_INFO (待补充资料)
```

### 10.7 货币与税率

| 字段 | 类型 | 说明 |
|------|------|------|
| currencyCode | String | ISO 4217 货币代码：CNY, USD, EUR, JPY |
| taxRate | BigDecimal | 税率，如 0.13 表示 13% |
| taxType | String | 税种：VAT（增值税）, NONE（免税） |
| exchangeRate | BigDecimal | 汇率（相对于系统基准货币） |

---

## 11. Module 10: 通知与消息 Notification & Messaging

### 11.1 NotificationController - 通知管理

**Base Path**: `/api/v1/notifications`

| # | Method | Path | Description | Request Body/Params | Response | Auth | Audit | Idempotent |
|---|--------|------|-------------|---------------------|----------|------|-------|------------|
| 1 | GET | `/api/v1/notifications` | 通知列表（分页） | PageRequest, NotificationFilterDTO | ApiResponse<PageResponse<NotificationVO>> | @PreAuthorize("isAuthenticated()") | - | - |
| 2 | GET | `/api/v1/notifications/unread-count` | 未读通知数 | - | ApiResponse<UnreadCountVO> | @PreAuthorize("isAuthenticated()") | - | - |
| 3 | PUT | `/api/v1/notifications/{id}/read` | 标记单条已读 | id (path) | ApiResponse<Void> | @PreAuthorize("isAuthenticated()") | - | 是 |
| 4 | PUT | `/api/v1/notifications/read-all` | 标记全部已读 | NotificationReadAllDTO (可选type过滤) | ApiResponse<Void> | @PreAuthorize("isAuthenticated()") | - | 是 |
| 5 | GET | `/api/v1/notifications/todos` | 待办列表（分页） | PageRequest, TodoFilterDTO | ApiResponse<PageResponse<TodoVO>> | @PreAuthorize("isAuthenticated()") | - | - |
| 6 | PUT | `/api/v1/notifications/todos/{id}/status` | 更新待办状态 | TodoStatusUpdateDTO | ApiResponse<TodoVO> | @PreAuthorize("isAuthenticated()") | @Auditable("UPDATE_TODO_STATUS") | 是 |
| 7 | GET | `/api/v1/notifications/todos/count` | 待办数量统计 | - | ApiResponse<TodoCountVO> | @PreAuthorize("isAuthenticated()") | - | - |
| 8 | POST | `/api/v1/notifications/reports/trigger` | 触发报表生成 | ReportTriggerDTO | ApiResponse<AsyncTaskVO> | @PreAuthorize("isAuthenticated()") | @Auditable("TRIGGER_REPORT") | 是 |
| 9 | GET | `/api/v1/notifications/reports/{taskId}/status` | 查询报表生成状态 | taskId (path) | ApiResponse<ReportTaskStatusVO> | @PreAuthorize("isAuthenticated()") | - | - |
| 10 | POST | `/api/v1/notifications/send` | 发送自定义通知（管理员） | NotificationSendDTO | ApiResponse<Void> | @PreAuthorize("hasRole('ADMIN')") | @Auditable("SEND_NOTIFICATION") | 是 |
| 11 | GET | `/api/v1/notifications/preferences` | 获取通知偏好设置 | - | ApiResponse<NotificationPreferenceVO> | @PreAuthorize("isAuthenticated()") | - | - |
| 12 | PUT | `/api/v1/notifications/preferences` | 更新通知偏好设置 | NotificationPreferenceUpdateDTO | ApiResponse<NotificationPreferenceVO> | @PreAuthorize("isAuthenticated()") | - | 是 |

### 11.2 通知类型枚举

| 值 | 渠道 | 说明 |
|----|------|------|
| SYSTEM | In-App | 系统通知 |
| STUDY_UPDATE | In-App + Email | 试验更新 |
| TASK_ASSIGNED | In-App + Email | 任务分配 |
| TASK_DUE | In-App + Email | 任务到期提醒 |
| AE_ALERT | In-App + Email + SMS | AE警报 |
| SAE_ALERT | In-App + Email + SMS | SAE警报（高优先级） |
| QUERY_ASSIGNED | In-App | 质疑分配 |
| QUERY_OVERDUE | In-App + Email | 质疑逾期提醒 |
| MONITORING_VISIT | In-App + Email | 监查访视提醒 |
| DOCUMENT_APPROVAL | In-App + Email | 文档审批 |
| PAYMENT_APPROVAL | In-App + Email | 付款审批 |
| MILESTONE_DUE | In-App + Email | 里程碑到期 |
| ENROLLMENT_MILESTONE | In-App + Email | 入组里程碑 |
| DEVIATION_ALERT | In-App + Email | 偏离警报 |
| CONTRACT_EXPIRY | In-App + Email | 合同到期提醒 |
| CUSTOM | In-App + Email | 自定义通知 |

### 11.3 通知优先级

| 优先级 | 值 | 说明 |
|--------|----|------|
| LOW | 1 | 一般信息通知 |
| NORMAL | 2 | 普通通知（默认） |
| HIGH | 3 | 需要关注 |
| URGENT | 4 | 紧急，需要立即处理（如SAE警报） |

---

## 12. Module 11: 仪表盘与报表 Dashboard & Reports

### 12.1 DashboardController - 仪表盘

**Base Path**: `/api/v1/dashboard`

| # | Method | Path | Description | Request Body/Params | Response | Auth | Audit | Idempotent |
|---|--------|------|-------------|---------------------|----------|------|-------|------------|
| 1 | GET | `/api/v1/dashboard/pm-workspace` | PM工作台数据 | studyId (query) | ApiResponse<PmWorkspaceVO> | @PreAuthorize("hasRole('PM')") | - | - |
| 2 | GET | `/api/v1/dashboard/cra-workspace` | CRA工作台数据 | siteId (query), studyId (query) | ApiResponse<CraWorkspaceVO> | @PreAuthorize("hasRole('CRA')") | - | - |
| 3 | GET | `/api/v1/dashboard/dm-workspace` | DM工作台数据 | studyId (query) | ApiResponse<DmWorkspaceVO> | @PreAuthorize("hasRole('DM')") | - | - |
| 4 | GET | `/api/v1/dashboard/pi-workspace` | PI工作台数据 | siteId (query), studyId (query) | ApiResponse<PiWorkspaceVO> | @PreAuthorize("hasRole('PI')") | - | - |
| 5 | GET | `/api/v1/dashboard/enrollment-trend` | 入组趋势图数据 | studyId, startDate, endDate, granularity | ApiResponse<EnrollmentTrendVO> | @PreAuthorize("isAuthenticated()") | - | - |
| 6 | GET | `/api/v1/dashboard/site-performance` | 中心绩效对比 | studyId (query), startDate, endDate | ApiResponse<SitePerformanceVO> | @PreAuthorize("isAuthenticated()") | - | - |
| 7 | GET | `/api/v1/dashboard/query-aging` | 质疑时效分析 | studyId (query), siteId (query) | ApiResponse<QueryAgingChartVO> | @PreAuthorize("isAuthenticated()") | - | - |
| 8 | GET | `/api/v1/dashboard/safety-summary` | 安全性汇总 | studyId (query) | ApiResponse<SafetySummaryVO> | @PreAuthorize("isAuthenticated()") | - | - |
| 9 | GET | `/api/v1/dashboard/risk-heatmap` | 风险热力图 | studyId (query) | ApiResponse<RiskHeatmapVO> | @PreAuthorize("isAuthenticated()") | - | - |
| 10 | GET | `/api/v1/dashboard/enrollment-prediction` | 入组预测 | studyId (query), predictionMonths (query) | ApiResponse<EnrollmentPredictionVO> | @PreAuthorize("hasAnyRole('PM','DM')") | - | - |
| 11 | GET | `/api/v1/dashboard/data-quality` | 数据质量仪表盘 | studyId (query), siteId (query) | ApiResponse<DataQualityVO> | @PreAuthorize("hasAnyRole('PM','DM','CRA')") | - | - |
| 12 | GET | `/api/v1/dashboard/overdue-tasks` | 逾期任务统计 | studyId (query), siteId (query) | ApiResponse<OverdueTasksVO> | @PreAuthorize("isAuthenticated()") | - | - |
| 13 | GET | `/api/v1/dashboard/financial-overview` | 财务概览 | studyId (query) | ApiResponse<FinancialOverviewVO> | @PreAuthorize("hasAnyRole('PM','FINANCE','ADMIN')") | - | - |
| 14 | GET | `/api/v1/dashboard/study-milestones` | 试验里程碑进度 | studyId (query) | ApiResponse<StudyMilestoneProgressVO> | @PreAuthorize("isAuthenticated()") | - | - |
| 15 | GET | `/api/v1/dashboard/subject-retention` | 受试者留存率 | studyId (query) | ApiResponse<SubjectRetentionVO> | @PreAuthorize("isAuthenticated()") | - | - |

### 12.2 ReportController - 报表管理

**Base Path**: `/api/v1/reports`

| # | Method | Path | Description | Request Body/Params | Response | Auth | Audit | Idempotent |
|---|--------|------|-------------|---------------------|----------|------|-------|------------|
| 1 | GET | `/api/v1/reports` | 报表模板列表 | PageRequest, ReportFilterDTO | ApiResponse<PageResponse<ReportTemplateVO>> | @PreAuthorize("isAuthenticated()") | - | - |
| 2 | GET | `/api/v1/reports/{id}` | 获取报表模板详情 | id (path) | ApiResponse<ReportTemplateDetailVO> | @PreAuthorize("isAuthenticated()") | - | - |
| 3 | POST | `/api/v1/reports/exports` | 触发报表导出（异步） | ExportTriggerDTO | ApiResponse<AsyncTaskVO> | @PreAuthorize("isAuthenticated()") | @Auditable("TRIGGER_EXPORT") | 是 |
| 4 | GET | `/api/v1/reports/exports/{taskId}/status` | 查询导出任务状态 | taskId (path) | ApiResponse<ExportTaskStatusVO> | @PreAuthorize("isAuthenticated()") | - | - |
| 5 | GET | `/api/v1/reports/exports/{taskId}/download` | 下载导出文件 | taskId (path) | ApiResponse<FileDownloadUrlVO> | @PreAuthorize("isAuthenticated()") | @Auditable("DOWNLOAD_EXPORT") | - |
| 6 | GET | `/api/v1/reports/exports/history` | 导出历史记录 | PageRequest, studyId (query) | ApiResponse<PageResponse<ExportHistoryVO>> | @PreAuthorize("isAuthenticated()") | - | - |
| 7 | GET | `/api/v1/reports/scheduled` | 定时报表任务列表 | PageRequest | ApiResponse<PageResponse<ScheduledReportVO>> | @PreAuthorize("hasAnyRole('PM','DM','ADMIN')") | - | - |
| 8 | POST | `/api/v1/reports/scheduled` | 创建定时报表任务 | ScheduledReportCreateDTO | ApiResponse<ScheduledReportVO> | @PreAuthorize("hasAnyRole('PM','DM','ADMIN')") | @Auditable("CREATE_SCHEDULED_REPORT") | 是 |
| 9 | DELETE | `/api/v1/reports/scheduled/{id}` | 删除定时报表任务 | id (path) | ApiResponse<Void> | @PreAuthorize("hasAnyRole('PM','DM','ADMIN')") | @Auditable("DELETE_SCHEDULED_REPORT") | 是 |
| 10 | PUT | `/api/v1/reports/scheduled/{id}/toggle` | 启用/停用定时报表 | id (path) | ApiResponse<ScheduledReportVO> | @PreAuthorize("hasAnyRole('PM','DM','ADMIN')") | @Auditable("TOGGLE_SCHEDULED_REPORT") | 是 |

### 12.3 报表类型枚举

| 值 | 说明 | 输出格式 |
|----|------|----------|
| ENROLLMENT_REPORT | 入组报告 | XLSX, PDF |
| SITE_PERFORMANCE_REPORT | 中心绩效报告 | XLSX, PDF |
| QUERY_AGING_REPORT | 质疑时效报告 | XLSX |
| SAFETY_SUMMARY_REPORT | 安全性汇总报告 | PDF |
| AE_LISTING | AE列表 | XLSX, CSV |
| SAE_LISTING | SAE列表 | XLSX, CSV |
| DEVIATION_REPORT | 偏离报告 | XLSX, PDF |
| MONITORING_REPORT | 监查报告 | PDF |
| FINANCIAL_REPORT | 财务报告 | XLSX, PDF |
| TMF_COMPLETENESS_REPORT | TMF完整性报告 | XLSX, PDF |
| AUDIT_TRAIL_REPORT | 审计轨迹报告 | CSV |
| DATA_QUALITY_REPORT | 数据质量报告 | XLSX, PDF |
| CUSTOM_REPORT | 自定义报表 | XLSX, PDF, CSV |

### 12.4 图表数据粒度枚举

| 值 | 说明 |
|----|------|
| DAILY | 按天 |
| WEEKLY | 按周 |
| MONTHLY | 按月 |
| QUARTERLY | 按季度 |
| YEARLY | 按年 |

---

## 13. Module 12: 系统管理 System Administration

### 13.1 UserController - 用户管理

**Base Path**: `/api/v1/users`

| # | Method | Path | Description | Request Body/Params | Response | Auth | Audit | Idempotent |
|---|--------|------|-------------|---------------------|----------|------|-------|------------|
| 1 | POST | `/api/v1/users` | 创建用户 | UserCreateDTO | ApiResponse<UserVO> | @PreAuthorize("hasRole('ADMIN')") | @Auditable("CREATE_USER") | 是 |
| 2 | GET | `/api/v1/users/{id}` | 获取用户详情 | id (path) | ApiResponse<UserDetailVO> | @PreAuthorize("hasRole('ADMIN')") | - | - |
| 3 | GET | `/api/v1/users` | 用户列表（分页+筛选） | PageRequest, UserFilterDTO | ApiResponse<PageResponse<UserVO>> | @PreAuthorize("hasRole('ADMIN')") | - | - |
| 4 | PUT | `/api/v1/users/{id}` | 更新用户信息 | UserUpdateDTO | ApiResponse<UserVO> | @PreAuthorize("hasRole('ADMIN')") | @Auditable("UPDATE_USER") | 是 |
| 5 | PUT | `/api/v1/users/{id}/status` | 启用/停用用户 | UserStatusDTO | ApiResponse<UserVO> | @PreAuthorize("hasRole('ADMIN')") | @Auditable("CHANGE_USER_STATUS") | 是 |
| 6 | PUT | `/api/v1/users/{id}/password` | 重置用户密码 | ResetPasswordDTO | ApiResponse<Void> | @PreAuthorize("hasRole('ADMIN')") | @Auditable("RESET_PASSWORD") | 是 |
| 7 | POST | `/api/v1/users/{id}/roles` | 为用户分配角色 | UserRoleAssignDTO | ApiResponse<UserVO> | @PreAuthorize("hasRole('ADMIN')") | @Auditable("ASSIGN_USER_ROLE") | 是 |
| 8 | GET | `/api/v1/users/me` | 获取当前用户信息 | - | ApiResponse<CurrentUserVO> | @PreAuthorize("isAuthenticated()") | - | - |
| 9 | PUT | `/api/v1/users/me/profile` | 更新个人资料 | ProfileUpdateDTO | ApiResponse<CurrentUserVO> | @PreAuthorize("isAuthenticated()") | @Auditable("UPDATE_PROFILE") | 是 |
| 10 | PUT | `/api/v1/users/me/password` | 修改个人密码 | ChangePasswordDTO | ApiResponse<Void> | @PreAuthorize("isAuthenticated()") | @Auditable("CHANGE_PASSWORD") | 是 |

### 13.2 RoleController - 角色管理

**Base Path**: `/api/v1/roles`

| # | Method | Path | Description | Request Body/Params | Response | Auth | Audit | Idempotent |
|---|--------|------|-------------|---------------------|----------|------|-------|------------|
| 1 | POST | `/api/v1/roles` | 创建角色 | RoleCreateDTO | ApiResponse<RoleVO> | @PreAuthorize("hasRole('ADMIN')") | @Auditable("CREATE_ROLE") | 是 |
| 2 | GET | `/api/v1/roles/{id}` | 获取角色详情（含权限） | id (path) | ApiResponse<RoleDetailVO> | @PreAuthorize("hasRole('ADMIN')") | - | - |
| 3 | GET | `/api/v1/roles` | 角色列表 | PageRequest | ApiResponse<PageResponse<RoleVO>> | @PreAuthorize("hasRole('ADMIN')") | - | - |
| 4 | PUT | `/api/v1/roles/{id}` | 更新角色 | RoleUpdateDTO | ApiResponse<RoleVO> | @PreAuthorize("hasRole('ADMIN')") | @Auditable("UPDATE_ROLE") | 是 |
| 5 | DELETE | `/api/v1/roles/{id}` | 删除角色 | id (path) | ApiResponse<Void> | @PreAuthorize("hasRole('ADMIN')") | @Auditable("DELETE_ROLE") | 是 |
| 6 | GET | `/api/v1/roles/permissions/tree` | 权限树列表 | - | ApiResponse<List<PermissionTreeNodeVO>> | @PreAuthorize("hasRole('ADMIN')") | - | - |

### 13.3 DictController - 数据字典管理

**Base Path**: `/api/v1/dict`

| # | Method | Path | Description | Request Body/Params | Response | Auth | Audit | Idempotent |
|---|--------|------|-------------|---------------------|----------|------|-------|------------|
| 1 | GET | `/api/v1/dict/types` | 字典类型列表 | PageRequest | ApiResponse<PageResponse<DictTypeVO>> | @PreAuthorize("isAuthenticated()") | - | - |
| 2 | POST | `/api/v1/dict/types` | 创建字典类型 | DictTypeCreateDTO | ApiResponse<DictTypeVO> | @PreAuthorize("hasRole('ADMIN')") | @Auditable("CREATE_DICT_TYPE") | 是 |
| 3 | GET | `/api/v1/dict/types/{typeCode}/items` | 获取字典项列表 | typeCode (path) | ApiResponse<List<DictItemVO>> | @PreAuthorize("isAuthenticated()") | - | - |
| 4 | POST | `/api/v1/dict/types/{typeCode}/items` | 创建字典项 | DictItemCreateDTO | ApiResponse<DictItemVO> | @PreAuthorize("hasRole('ADMIN')") | @Auditable("CREATE_DICT_ITEM") | 是 |
| 5 | PUT | `/api/v1/dict/types/{typeCode}/items/{id}` | 更新字典项 | DictItemUpdateDTO | ApiResponse<DictItemVO> | @PreAuthorize("hasRole('ADMIN')") | @Auditable("UPDATE_DICT_ITEM") | 是 |
| 6 | DELETE | `/api/v1/dict/types/{typeCode}/items/{id}` | 删除字典项 | typeCode, id (path) | ApiResponse<Void> | @PreAuthorize("hasRole('ADMIN')") | @Auditable("DELETE_DICT_ITEM") | 是 |
| 7 | PUT | `/api/v1/dict/cache/refresh` | 刷新字典缓存 | - | ApiResponse<Void> | @PreAuthorize("hasRole('ADMIN')") | @Auditable("REFRESH_DICT_CACHE") | 是 |

### 13.4 SystemController - 系统设置

**Base Path**: `/api/v1/system`

| # | Method | Path | Description | Request Body/Params | Response | Auth | Audit | Idempotent |
|---|--------|------|-------------|---------------------|----------|------|-------|------------|
| 1 | GET | `/api/v1/system/configs` | 系统配置列表 | PageRequest, ConfigFilterDTO | ApiResponse<PageResponse<SystemConfigVO>> | @PreAuthorize("hasRole('ADMIN')") | - | - |
| 2 | GET | `/api/v1/system/configs/{key}` | 获取配置项 | key (path) | ApiResponse<SystemConfigVO> | @PreAuthorize("hasRole('ADMIN')") | - | - |
| 3 | PUT | `/api/v1/system/configs/{key}` | 更新配置项 | SystemConfigUpdateDTO | ApiResponse<SystemConfigVO> | @PreAuthorize("hasRole('ADMIN')") | @Auditable("UPDATE_SYSTEM_CONFIG") | 是 |
| 4 | POST | `/api/v1/system/configs/cache/refresh` | 刷新配置缓存 | - | ApiResponse<Void> | @PreAuthorize("hasRole('ADMIN')") | @Auditable("REFRESH_CONFIG_CACHE") | 是 |
| 5 | GET | `/api/v1/system/health` | 系统健康检查 | - | ApiResponse<HealthCheckVO> | @PreAuthorize("isAuthenticated()") | - | - |
| 6 | GET | `/api/v1/system/metrics` | 系统运行指标 | - | ApiResponse<SystemMetricsVO> | @PreAuthorize("hasRole('ADMIN')") | - | - |
| 7 | GET | `/api/v1/system/version` | 系统版本信息 | - | ApiResponse<SystemVersionVO> | @PreAuthorize("isAuthenticated()") | - | - |

### 13.5 AuditLogController - 审计日志

**Base Path**: `/api/v1/audit-logs`

| # | Method | Path | Description | Request Body/Params | Response | Auth | Audit | Idempotent |
|---|--------|------|-------------|---------------------|----------|------|-------|------------|
| 1 | GET | `/api/v1/audit-logs` | 审计日志列表（分页+筛选） | PageRequest, AuditLogFilterDTO | ApiResponse<PageResponse<AuditLogVO>> | @PreAuthorize("hasRole('ADMIN') or hasRole('QA')") | - | - |
| 2 | GET | `/api/v1/audit-logs/{id}` | 审计日志详情 | id (path) | ApiResponse<AuditLogDetailVO> | @PreAuthorize("hasRole('ADMIN') or hasRole('QA')") | - | - |
| 3 | GET | `/api/v1/audit-logs/export` | 导出审计日志（异步） | AuditLogExportDTO | ApiResponse<AsyncTaskVO> | @PreAuthorize("hasRole('ADMIN') or hasRole('QA')") | @Auditable("EXPORT_AUDIT_LOG") | - |
| 4 | GET | `/api/v1/audit-logs/statistics` | 审计日志统计 | startDate, endDate, module (query) | ApiResponse<AuditLogStatisticsVO> | @PreAuthorize("hasRole('ADMIN') or hasRole('QA')") | - | - |

### 13.6 审计日志筛选字段

| 字段 | 类型 | 说明 |
|------|------|------|
| userId | Long | 操作用户ID |
| username | String | 操作用户名 |
| module | String | 操作模块 |
| action | String | 操作类型 |
| targetType | String | 目标类型 |
| targetId | String | 目标ID |
| startTime | OffsetDateTime | 开始时间 |
| endTime | OffsetDateTime | 结束时间 |
| ipAddress | String | 操作IP |
| result | String | 操作结果：SUCCESS, FAILURE |
| traceId | String | 分布式追踪ID |

### 13.7 预置角色与权限矩阵

| 角色 | 编码 | 典型权限范围 |
|------|------|-------------|
| 系统管理员 | ADMIN | 全部权限 |
| 项目经理 | PM | 试验管理、中心管理、预算管理、团队管理 |
| 临床监查员 | CRA | 中心访视、SDV、质疑发起、监查报告 |
| 数据管理员 | DM | 数据清理、质疑管理、冻结/解冻、锁库 |
| 药物安全专员 | DS | AE/SAE管理、MedDRA编码、法规递交 |
| 主要研究者 | PI | 受试者管理、AE评估、揭盲、电子签名 |
| 研究协调员 | CRC | 受试者管理、数据录入、质疑回复 |
| 质量保证 | QA | 稽查、CAPA、偏离评估 |
| 财务 | FINANCE | 预算、合同、付款、发票 |
| 申办方 | SPONSOR | 只读访问、报表查看 |
| 系统集成 | SYSTEM | API集成、Webhook回调 |

---

## 14. Module 13: 集成 Integration

### 14.1 IntegrationController - 集成管理

**Base Path**: `/api/v1/integration`

| # | Method | Path | Description | Request Body/Params | Response | Auth | Audit | Idempotent |
|---|--------|------|-------------|---------------------|----------|------|-------|------------|
| 1 | GET | `/api/v1/integration/tasks` | 集成任务列表 | PageRequest, IntegrationTaskFilterDTO | ApiResponse<PageResponse<IntegrationTaskVO>> | @PreAuthorize("hasRole('ADMIN')") | - | - |
| 2 | GET | `/api/v1/integration/tasks/{id}` | 集成任务详情 | id (path) | ApiResponse<IntegrationTaskDetailVO> | @PreAuthorize("hasRole('ADMIN')") | - | - |
| 3 | PUT | `/api/v1/integration/tasks/{id}/retry` | 重试集成任务 | id (path) | ApiResponse<IntegrationTaskVO> | @PreAuthorize("hasRole('ADMIN')") | @Auditable("RETRY_INTEGRATION_TASK") | 是 |
| 4 | PUT | `/api/v1/integration/tasks/{id}/terminate` | 终止集成任务 | id (path) | ApiResponse<IntegrationTaskVO> | @PreAuthorize("hasRole('ADMIN')") | @Auditable("TERMINATE_INTEGRATION_TASK") | 是 |
| 5 | GET | `/api/v1/integration/patient-index/search` | 患者索引搜索 | PatientIndexSearchDTO (query params) | ApiResponse<PageResponse<PatientIndexVO>> | @PreAuthorize("isAuthenticated()") | - | - |
| 6 | GET | `/api/v1/integration/patient-index/{id}` | 患者索引详情 | id (path) | ApiResponse<PatientIndexDetailVO> | @PreAuthorize("isAuthenticated()") | - | - |
| 7 | POST | `/api/v1/integration/reconciliation/trigger` | 触发数据对账 | ReconciliationTriggerDTO | ApiResponse<AsyncTaskVO> | @PreAuthorize("hasRole('ADMIN') or hasRole('DM')") | @Auditable("TRIGGER_RECONCILIATION") | 是 |
| 8 | GET | `/api/v1/integration/reconciliation/{taskId}/status` | 对账任务状态 | taskId (path) | ApiResponse<ReconciliationTaskStatusVO> | @PreAuthorize("hasRole('ADMIN') or hasRole('DM')") | - | - |
| 9 | GET | `/api/v1/integration/reconciliation/{taskId}/report` | 对账报告 | taskId (path) | ApiResponse<ReconciliationReportVO> | @PreAuthorize("hasRole('ADMIN') or hasRole('DM')") | - | - |
| 10 | POST | `/api/v1/integration/external-systems` | 注册外部系统 | ExternalSystemRegisterDTO | ApiResponse<ExternalSystemVO> | @PreAuthorize("hasRole('ADMIN')") | @Auditable("REGISTER_EXTERNAL_SYSTEM") | 是 |
| 11 | GET | `/api/v1/integration/external-systems` | 外部系统列表 | PageRequest | ApiResponse<PageResponse<ExternalSystemVO>> | @PreAuthorize("hasRole('ADMIN')") | - | - |
| 12 | PUT | `/api/v1/integration/external-systems/{id}` | 更新外部系统配置 | ExternalSystemUpdateDTO | ApiResponse<ExternalSystemVO> | @PreAuthorize("hasRole('ADMIN')") | @Auditable("UPDATE_EXTERNAL_SYSTEM") | 是 |
| 13 | POST | `/api/v1/integration/external-systems/{id}/test-connection` | 测试连接 | id (path) | ApiResponse<ConnectionTestResultVO> | @PreAuthorize("hasRole('ADMIN')") | @Auditable("TEST_EXTERNAL_CONNECTION") | 是 |
| 14 | GET | `/api/v1/integration/external-systems/{id}/logs` | 外部系统调用日志 | id (path), PageRequest | ApiResponse<PageResponse<ExternalCallLogVO>> | @PreAuthorize("hasRole('ADMIN')") | - | - |
| 15 | POST | `/api/v1/integration/data-mapping` | 创建数据映射规则 | DataMappingCreateDTO | ApiResponse<DataMappingVO> | @PreAuthorize("hasRole('ADMIN') or hasRole('DM')") | @Auditable("CREATE_DATA_MAPPING") | 是 |
| 16 | GET | `/api/v1/integration/data-mapping` | 数据映射规则列表 | PageRequest, systemId (query) | ApiResponse<PageResponse<DataMappingVO>> | @PreAuthorize("hasRole('ADMIN') or hasRole('DM')") | - | - |
| 17 | PUT | `/api/v1/integration/data-mapping/{id}` | 更新数据映射规则 | DataMappingUpdateDTO | ApiResponse<DataMappingVO> | @PreAuthorize("hasRole('ADMIN') or hasRole('DM')") | @Auditable("UPDATE_DATA_MAPPING") | 是 |
| 18 | DELETE | `/api/v1/integration/data-mapping/{id}` | 删除数据映射规则 | id (path) | ApiResponse<Void> | @PreAuthorize("hasRole('ADMIN')") | @Auditable("DELETE_DATA_MAPPING") | 是 |

### 14.2 集成任务类型枚举

| 值 | 说明 | 方向 |
|----|------|------|
| EDC_DATA_IMPORT | EDC数据导入 | INBOUND |
| EDC_DATA_EXPORT | EDC数据导出 | OUTBOUND |
| EMR_DATA_SYNC | EMR数据同步 | INBOUND |
| MEDDRA_CODING_SYNC | MedDRA编码同步 | INBOUND |
| WHODRUG_CODING_SYNC | WHO Drug编码同步 | INBOUND |
| LAB_DATA_IMPORT | 实验室数据导入 | INBOUND |
| IRT_SYNC | IRT(随机化系统)同步 | BIDIRECTIONAL |
| CTMS_SYNC | CTMS系统同步 | BIDIRECTIONAL |
| REGULATORY_SUBMIT | 法规递交 | OUTBOUND |
| PATIENT_INDEX_SYNC | 患者索引同步 | BIDIRECTIONAL |
| FINANCE_SYSTEM_SYNC | 财务系统同步 | OUTBOUND |
| EC_SUBMISSION | 伦理委员会递交 | OUTBOUND |
| EMR_ELIGIBILITY_CHECK | EMR合格性预筛 | INBOUND |

### 14.3 外部系统类型枚举

| 值 | 说明 |
|----|------|
| EDC | 电子数据采集系统（如Medidata Rave, Veeva CDMS） |
| IRT | 交互式应答技术系统（如4G Clinical, Suvoda） |
| CTMS | 临床试验管理系统 |
| EMR | 电子病历系统 |
| LIMS | 实验室信息管理系统 |
| PHARMACOVIGILANCE | 药物警戒系统（如Argus, ArisGlobal） |
| DOCUMENT_MANAGEMENT | 文档管理系统（如Veeva Vault） |
| FINANCE_SYSTEM | 财务系统（如SAP, Oracle） |
| EC_SYSTEM | 伦理委员会系统 |
| REGULATORY_SUBMISSION | 法规递交系统（如eCTD） |

### 14.4 集成认证方式

| 方式 | 说明 |
|------|------|
| API_KEY | API密钥认证（Header: X-Api-Key） |
| OAUTH2_CLIENT_CREDENTIALS | OAuth2客户端凭证模式 |
| JWT_ASSERTION | JWT断言认证 |
| BASIC_AUTH | HTTP Basic认证（仅限内网） |
| MTLS | 双向TLS证书认证 |
| AWS_IAM | AWS IAM签名认证（S3等） |

### 14.5 PatientIndexSearchDTO

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| emrSystemId | Long | 是 | 来源EMR系统ID |
| name | String | 否 | 患者姓名（模糊搜索） |
| medicalRecordNo | String | 否 | 病历号 |
| idCardNo | String | 否 | 身份证号（需PII权限） |
| phone | String | 否 | 电话号码（需PII权限） |
| dobFrom | LocalDate | 否 | 出生日期-起 |
| dobTo | LocalDate | 否 | 出生日期-止 |
| gender | String | 否 | MALE, FEMALE |
| diagnosisCode | String | 否 | 诊断编码（ICD-10） |

---

## 15. Module 14: OCR与AI回调 OCR & AI Callback

### 15.1 OcrController - OCR管理

**Base Path**: `/api/v1/ocr`

| # | Method | Path | Description | Request Body/Params | Response | Auth | Audit | Idempotent |
|---|--------|------|-------------|---------------------|----------|------|-------|------------|
| 1 | POST | `/api/v1/ocr/jobs` | 创建OCR识别任务 | OcrJobCreateDTO | ApiResponse<AsyncTaskVO> | @PreAuthorize("isAuthenticated()") | @Auditable("CREATE_OCR_JOB") | 是 |
| 2 | GET | `/api/v1/ocr/jobs` | OCR任务列表（分页+筛选） | PageRequest, OcrJobFilterDTO | ApiResponse<PageResponse<OcrJobVO>> | @PreAuthorize("isAuthenticated()") | - | - |
| 3 | GET | `/api/v1/ocr/jobs/{id}` | OCR任务状态 | id (path) | ApiResponse<OcrJobStatusVO> | @PreAuthorize("isAuthenticated()") | - | - |
| 4 | GET | `/api/v1/ocr/jobs/{id}/result` | 获取OCR结果 | id (path) | ApiResponse<OcrResultVO> | @PreAuthorize("isAuthenticated()") | - | - |
| 5 | PUT | `/api/v1/ocr/jobs/{id}/confirm` | 人工确认OCR结果 | OcrConfirmDTO | ApiResponse<OcrResultVO> | @PreAuthorize("hasAnyRole('CRA','CRC','DM')") | @Auditable("CONFIRM_OCR_RESULT") | 是 |
| 6 | PUT | `/api/v1/ocr/jobs/{id}/reject` | 驳回OCR结果 | OcrRejectDTO | ApiResponse<OcrResultVO> | @PreAuthorize("hasAnyRole('CRA','CRC','DM')") | @Auditable("REJECT_OCR_RESULT") | 是 |
| 7 | POST | `/api/v1/ocr/callback` | AI OCR回调接口（外部AI服务调用） | OcrCallbackDTO | ApiResponse<Void> | @PreAuthorize("hasRole('SYSTEM') or #oauth2.hasScope('ocr:callback')") | @Auditable("OCR_CALLBACK") | 是 |
| 8 | GET | `/api/v1/ocr/jobs/{id}/revisions` | OCR修正历史 | id (path), PageRequest | ApiResponse<PageResponse<OcrRevisionVO>> | @PreAuthorize("isAuthenticated()") | - | - |
| 9 | GET | `/api/v1/ocr/templates` | OCR识别模板列表 | PageRequest, docType (query) | ApiResponse<PageResponse<OcrTemplateVO>> | @PreAuthorize("isAuthenticated()") | - | - |
| 10 | POST | `/api/v1/ocr/templates` | 创建OCR识别模板 | OcrTemplateCreateDTO | ApiResponse<OcrTemplateVO> | @PreAuthorize("hasRole('ADMIN') or hasRole('DM')") | @Auditable("CREATE_OCR_TEMPLATE") | 是 |
| 11 | PUT | `/api/v1/ocr/templates/{id}` | 更新OCR识别模板 | OcrTemplateUpdateDTO | ApiResponse<OcrTemplateVO> | @PreAuthorize("hasRole('ADMIN') or hasRole('DM')") | @Auditable("UPDATE_OCR_TEMPLATE") | 是 |
| 12 | DELETE | `/api/v1/ocr/templates/{id}` | 删除OCR识别模板 | id (path) | ApiResponse<Void> | @PreAuthorize("hasRole('ADMIN')") | @Auditable("DELETE_OCR_TEMPLATE") | 是 |

### 15.2 AIController - AI功能

**Base Path**: `/api/v1/ai`

| # | Method | Path | Description | Request Body/Params | Response | Auth | Audit | Idempotent |
|---|--------|------|-------------|---------------------|----------|------|-------|------------|
| 1 | POST | `/api/v1/ai/copilot/query` | AI助手查询 | AiCopilotQueryDTO | ApiResponse<AiCopilotResponseVO> | @PreAuthorize("isAuthenticated()") | - | 是 |
| 2 | GET | `/api/v1/ai/copilot/history` | AI助手对话历史 | PageRequest | ApiResponse<PageResponse<AiConversationVO>> | @PreAuthorize("isAuthenticated()") | - | - |
| 3 | DELETE | `/api/v1/ai/copilot/history/{conversationId}` | 删除对话历史 | conversationId (path) | ApiResponse<Void> | @PreAuthorize("isAuthenticated()") | @Auditable("DELETE_AI_CONVERSATION") | 是 |
| 4 | GET | `/api/v1/ai/reviews/{id}` | AI审查结果详情 | id (path) | ApiResponse<AiReviewResultVO> | @PreAuthorize("isAuthenticated()") | - | - |
| 5 | PUT | `/api/v1/ai/reviews/{id}/accept` | 接受AI审查建议 | id (path) | ApiResponse<AiReviewResultVO> | @PreAuthorize("hasAnyRole('CRA','DM','DS')") | @Auditable("ACCEPT_AI_REVIEW") | 是 |
| 6 | PUT | `/api/v1/ai/reviews/{id}/reject` | 驳回AI审查建议 | AiReviewRejectDTO | ApiResponse<AiReviewResultVO> | @PreAuthorize("hasAnyRole('CRA','DM','DS')") | @Auditable("REJECT_AI_REVIEW") | 是 |
| 7 | POST | `/api/v1/ai/meddra/auto-code` | MedDRA自动编码 | MeddraAutoCodeDTO | ApiResponse<MeddraAutoCodeResultVO> | @PreAuthorize("hasAnyRole('DS','DM')") | - | 是 |
| 8 | POST | `/api/v1/ai/medical-review` | AI医学审查 | MedicalReviewRequestDTO | ApiResponse<AsyncTaskVO> | @PreAuthorize("hasAnyRole('DS','DM')") | @Auditable("AI_MEDICAL_REVIEW") | 是 |
| 9 | GET | `/api/v1/ai/copilot/suggestions` | AI输入建议（上下文感知） | contextType (query), contextId (query) | ApiResponse<AiSuggestionVO> | @PreAuthorize("isAuthenticated()") | - | - |
| 10 | POST | `/api/v1/ai/narrative/generate` | AI生成叙述草稿 | NarrativeGenerateDTO | ApiResponse<NarrativeGenerateResultVO> | @PreAuthorize("hasAnyRole('CRA','DS')") | - | 是 |
| 11 | POST | `/api/v1/ai/data-quality/scan` | AI数据质量扫描 | DataQualityScanDTO | ApiResponse<AsyncTaskVO> | @PreAuthorize("hasAnyRole('DM')") | @Auditable("AI_DATA_QUALITY_SCAN") | 是 |
| 12 | GET | `/api/v1/ai/data-quality/scan/{taskId}/result` | AI扫描结果 | taskId (path) | ApiResponse<DataQualityScanResultVO> | @PreAuthorize("hasAnyRole('DM')") | - | - |
| 13 | POST | `/api/v1/ai/medical-coding/suggest` | AI辅助医学编码建议 | MedicalCodingSuggestDTO | ApiResponse<MedicalCodingSuggestVO> | @PreAuthorize("hasAnyRole('DS','DM')") | - | 是 |

### 15.3 OCR文档类型枚举

| 值 | 说明 |
|----|------|
| MEDICAL_RECORD | 病历 |
| LAB_REPORT | 检验报告 |
| PATHOLOGY_REPORT | 病理报告 |
| IMAGING_REPORT | 影像报告 |
| PRESCRIPTION | 处方 |
| INFORMED_CONSENT | 知情同意书 |
| AE_FORM | AE报告表 |
| SAE_FORM | SAE报告表 |
| MEDICATION_LOG | 用药日志 |
| DISCHARGE_SUMMARY | 出院小结 |
| CUSTOM | 自定义文档 |

### 15.4 OCR任务状态枚举

| 值 | 说明 |
|----|------|
| PENDING | 等待处理 |
| PROCESSING | 处理中 |
| COMPLETED | 已完成 |
| PENDING_CONFIRMATION | 等待人工确认 |
| CONFIRMED | 已确认 |
| REJECTED | 已驳回 |
| FAILED | 处理失败 |
| CANCELLED | 已取消 |

---


## 16. OpenAPI Schema 详细示例

以下提供10个最关键API端点的完整OpenAPI Schema定义，包含请求体、响应体和可能的错误码。

### 16.1 PUT /api/v1/subjects/{id}/status - 受试者状态转换

**业务说明**: 受试者状态流转遵循状态机规则，转换时需要校验前置条件（如：必须完成筛选才能入组）。

<details>
<summary>完整 OpenAPI Schema</summary>

```yaml
/api/v1/subjects/{id}/status:
  put:
    tags:
      - Subject Management
    summary: 受试者状态转换
    description: 根据受试者状态机规则执行状态转换，系统自动校验转换合法性
    operationId: updateSubjectStatus
    parameters:
      - name: id
        in: path
        required: true
        schema:
          type: integer
          format: int64
        description: 受试者ID
        example: 10086
      - name: Idempotency-Key
        in: header
        required: true
        schema:
          type: string
          format: uuid
        example: "550e8400-e29b-41d4-a716-446655440000"
      - name: X-Trace-Id
        in: header
        required: false
        schema:
          type: string
        example: "trace-abc-123"
    requestBody:
      required: true
      content:
        application/json:
          schema:
            $ref: '#/components/schemas/SubjectStatusTransitionDTO'
          examples:
            enroll:
              summary: 入组操作
              value:
                targetStatus: "ENROLLED"
                effectiveDate: "2026-05-11T09:00:00.000+08:00"
                reason: "受试者签署ICF并完成筛选评估，符合入排标准"
                icfSignedDate: "2026-05-10"
                icfVersion: "2.0"
            withdraw:
              summary: 退出操作
              value:
                targetStatus: "WITHDRAWN"
                effectiveDate: "2026-05-11T10:00:00.000+08:00"
                reason: "受试者自愿退出试验"
                withdrawalReason: "SUBJECT_DECISION"
                withdrawalDetail: "因个人原因无法继续参与访视安排"
    responses:
      '200':
        description: 状态转换成功
        content:
          application/json:
            schema:
              allOf:
                - $ref: '#/components/schemas/ApiResponse'
                - type: object
                  properties:
                    data:
                      $ref: '#/components/schemas/SubjectVO'
            example:
              code: 200
              message: "受试者状态更新成功"
              data:
                id: 10086
                subjectNumber: "SUB-2026-00042"
                studyId: 1001
                siteId: 2001
                status: "ENROLLED"
                previousStatus: "SCREENING"
                screeningDate: "2026-04-15"
                enrollmentDate: "2026-05-11"
                updatedAt: "2026-05-11T09:00:01.000+08:00"
                updatedBy: "张医生"
              traceId: "trace-abc-123"
              timestamp: "2026-05-11T09:00:01.000+08:00"
      '400':
        description: 请求参数校验失败
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/ApiResponse'
            examples:
              invalid_transition:
                summary: 非法状态转换
                value:
                  code: 40001
                  message: "非法的状态转换：不允许从 RANDOMIZED 转换到 SCREENING"
                  data: null
                  traceId: "trace-abc-123"
                  timestamp: "2026-05-11T09:00:01.000+08:00"
              missing_icf:
                summary: 缺少ICF信息
                value:
                  code: 40002
                  message: "入组操作需要提供知情同意书签署日期和版本"
                  data: null
                  traceId: "trace-abc-123"
                  timestamp: "2026-05-11T09:00:01.000+08:00"
      '404':
        description: 受试者不存在
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/ApiResponse'
            example:
              code: 40401
              message: "受试者不存在: id=10086"
              data: null
              traceId: "trace-abc-123"
              timestamp: "2026-05-11T09:00:01.000+08:00"
      '409':
        description: 业务冲突（如状态已被其他操作变更）
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/ApiResponse'
            example:
              code: 40901
              message: "状态冲突：受试者当前状态为 ENROLLED，目标状态为 SCREENING，可能已被其他用户修改"
              data:
                currentStatus: "ENROLLED"
                lastModifiedAt: "2026-05-11T08:59:50.000+08:00"
                lastModifiedBy: "李医生"
              traceId: "trace-abc-123"
              timestamp: "2026-05-11T09:00:01.000+08:00"
      '422':
        description: 业务规则校验失败（不满足状态转换前置条件）
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/ApiResponse'
            example:
              code: 42201
              message: "不满足入组条件：受试者未通过合格性检查或未签署知情同意书"
              data:
                unmetConditions:
                  - "ICF_NOT_SIGNED"
                  - "INCLUSION_CRITERIA_NOT_MET"
                detail: "合格性检查结果: 3项入选标准未满足, 知情同意书状态: NOT_SIGNED"
              traceId: "trace-abc-123"
              timestamp: "2026-05-11T09:00:01.000+08:00"

components:
  schemas:
    SubjectStatusTransitionDTO:
      type: object
      required:
        - targetStatus
        - effectiveDate
      properties:
        targetStatus:
          type: string
          description: 目标状态编码
          enum:
            - SCREENING
            - SCREEN_FAILED
            - ENROLLED
            - RANDOMIZED
            - ACTIVE
            - COMPLETED
            - WITHDRAWN
            - LOST_TO_FOLLOWUP
          example: "ENROLLED"
        effectiveDate:
          type: string
          format: date-time
          description: 状态生效日期时间
          example: "2026-05-11T09:00:00.000+08:00"
        reason:
          type: string
          maxLength: 2000
          description: 状态变更原因
          example: "受试者签署ICF并完成筛选评估，符合入排标准"
        icfSignedDate:
          type: string
          format: date
          description: 知情同意书签署日期（入组时必填）
          example: "2026-05-10"
        icfVersion:
          type: string
          maxLength: 20
          description: 知情同意书版本号（入组时必填）
          example: "2.0"
        withdrawalReason:
          type: string
          description: 退出原因编码（退出时必填）
          enum:
            - SUBJECT_DECISION
            - ADVERSE_EVENT
            - DEATH
            - LOST_TO_FOLLOWUP
            - PROTOCOL_DEVIATION
            - INVESTIGATOR_DECISION
            - SPONSOR_DECISION
            - OTHER
        withdrawalDetail:
          type: string
          maxLength: 2000
          description: 退出详细说明
    SubjectVO:
      type: object
      properties:
        id:
          type: integer
          format: int64
        subjectNumber:
          type: string
          description: 受试者编号
        studyId:
          type: integer
          format: int64
        siteId:
          type: integer
          format: int64
        status:
          type: string
        previousStatus:
          type: string
        screeningDate:
          type: string
          format: date
        enrollmentDate:
          type: string
          format: date
        updatedAt:
          type: string
          format: date-time
        updatedBy:
          type: string
```

</details>

---

### 16.2 POST /api/v1/aes/{id}/escalate-to-sae - AE升级为SAE

**业务说明**: 当AE满足严重性标准（Seriousness Criteria）时，研究人员可将AE升级为SAE，系统自动创建SAE记录并触发上报工作流。

<details>
<summary>完整 OpenAPI Schema</summary>

```yaml
/api/v1/aes/{id}/escalate-to-sae:
  post:
    tags:
      - Safety
    summary: AE升级为SAE
    description: >
      将不良事件升级为严重不良事件。系统将：
      1. 校验AE当前状态允许升级
      2. 自动创建SAE记录并关联原始AE
      3. 根据严重程度触发相应时限提醒
      4. 自动发送通知给DS/PM/PI
    operationId: escalateAeToSae
    parameters:
      - name: id
        in: path
        required: true
        schema:
          type: integer
          format: int64
        description: AE ID
      - name: Idempotency-Key
        in: header
        required: true
        schema:
          type: string
          format: uuid
    requestBody:
      required: true
      content:
        application/json:
          schema:
            $ref: '#/components/schemas/AeEscalateToSaeDTO'
          example:
            seriousnessCriteria:
              - LIFE_THREATENING
              - HOSPITALIZATION
            becameSeriousDate: "2026-05-10T14:30:00.000+08:00"
            escalationReason: "受试者因AE导致住院治疗，符合SAE标准"
            reporterId: 10001
            isInitialReport: true
            expeditedReportRequired: true
            regulatoryAuthorities:
              - NMPA
              - FDA
    responses:
      '200':
        description: AE成功升级为SAE
        content:
          application/json:
            schema:
              allOf:
                - $ref: '#/components/schemas/ApiResponse'
                - type: object
                  properties:
                    data:
                      $ref: '#/components/schemas/SaeVO'
            example:
              code: 200
              message: "AE已成功升级为SAE，系统将自动触发上报工作流"
              data:
                id: 20001
                saeNumber: "SAE-2026-00156"
                sourceAeId: 5001
                subjectId: 10086
                studyId: 1001
                siteId: 2001
                status: "OPEN"
                seriousnessCriteria:
                  - LIFE_THREATENING
                  - HOSPITALIZATION
                becameSeriousDate: "2026-05-10T14:30:00.000+08:00"
                reportingDeadline: "2026-05-17T23:59:59.000+08:00"
                daysRemaining: 7
                expeditedReportRequired: true
                regulatoryAuthorities:
                  - NMPA
                  - FDA
                workflowStatus: "INITIAL_REPORT_PENDING"
                createdAt: "2026-05-11T10:00:00.000+08:00"
              traceId: "trace-abc-123"
              timestamp: "2026-05-11T10:00:00.000+08:00"
      '400':
        description: 请求参数校验失败
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/ApiResponse'
            examples:
              missing_criteria:
                value:
                  code: 40003
                  message: "升级SAE必须指定至少一项严重性标准(seriousnessCriteria)"
              already_sae:
                value:
                  code: 40004
                  message: "该AE已经升级为SAE，SAE编号: SAE-2026-00155"
      '404':
        description: AE不存在
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/ApiResponse'
            example:
              code: 40402
              message: "AE不存在: id=5001"

components:
  schemas:
    AeEscalateToSaeDTO:
      type: object
      required:
        - seriousnessCriteria
        - becameSeriousDate
        - reporterId
      properties:
        seriousnessCriteria:
          type: array
          minItems: 1
          items:
            type: string
            enum:
              - DEATH
              - LIFE_THREATENING
              - HOSPITALIZATION
              - DISABILITY
              - CONGENITAL_ANOMALY
              - MEDICALLY_IMPORTANT
          description: SAE严重性标准（至少一项）
          example: ["LIFE_THREATENING", "HOSPITALIZATION"]
        becameSeriousDate:
          type: string
          format: date-time
          description: AE满足严重性标准的日期时间
          example: "2026-05-10T14:30:00.000+08:00"
        escalationReason:
          type: string
          maxLength: 2000
          description: 升级原因说明
        reporterId:
          type: integer
          format: int64
          description: 上报人用户ID
        isInitialReport:
          type: boolean
          default: true
          description: 是否为初次报告
        expeditedReportRequired:
          type: boolean
          default: false
          description: 是否需要加速报告
        regulatoryAuthorities:
          type: array
          items:
            type: string
          description: 需要递交的监管机构列表
          example: ["NMPA", "FDA", "EMA"]
    SaeVO:
      type: object
      properties:
        id:
          type: integer
          format: int64
        saeNumber:
          type: string
          description: SAE编号
        sourceAeId:
          type: integer
          format: int64
          description: 来源AE ID
        subjectId:
          type: integer
          format: int64
        studyId:
          type: integer
          format: int64
        siteId:
          type: integer
          format: int64
        status:
          type: string
          enum: [OPEN, UNDER_INVESTIGATION, FOLLOWUP, RESOLVED, CLOSED]
        seriousnessCriteria:
          type: array
          items:
            type: string
        becameSeriousDate:
          type: string
          format: date-time
        reportingDeadline:
          type: string
          format: date-time
          description: 法规上报截止时间（7天或15天时限）
        daysRemaining:
          type: integer
          description: 距上报截止剩余天数（负数表示已逾期）
        expeditedReportRequired:
          type: boolean
        regulatoryAuthorities:
          type: array
          items:
            type: string
        workflowStatus:
          type: string
          enum:
            - INITIAL_REPORT_PENDING
            - INITIAL_REPORT_SUBMITTED
            - FOLLOWUP_REPORT_PENDING
            - FOLLOWUP_REPORT_SUBMITTED
            - FINAL_REPORT_SUBMITTED
```

</details>

---

### 16.3 POST /api/v1/subjects/{id}/randomize - 受试者随机化

**业务说明**: 对已入组的受试者执行随机分组操作。系统调用IRT服务或本地随机化算法，返回分组结果。支持分层随机（按中心、年龄组、疾病严重程度等分层因素）。

<details>
<summary>完整 OpenAPI Schema</summary>

```yaml
/api/v1/subjects/{id}/randomize:
  post:
    tags:
      - Subject Management
    summary: 受试者随机化
    description: >
      对受试者执行随机分组。前置条件：
      1. 受试者状态为 ENROLLED
      2. 已签署知情同意书
      3. 已通过合格性检查
      4. 分层因素已确认
    operationId: randomizeSubject
    parameters:
      - name: id
        in: path
        required: true
        schema:
          type: integer
          format: int64
        description: 受试者ID
      - name: Idempotency-Key
        in: header
        required: true
        schema:
          type: string
          format: uuid
        description: >
          幂等键。同一受试者的随机化请求必须唯一：
          如果重复提交相同Idempotency-Key，系统返回已有的随机化结果
    requestBody:
      required: true
      content:
        application/json:
          schema:
            $ref: '#/components/schemas/RandomizationDTO'
          example:
            stratificationFactors:
              siteId: 2001
              ageGroup: "18-65"
              diseaseSeverity: "MODERATE"
              priorTreatment: "NO"
            randomizationMethod: "CENTRAL_IRT"
            confirmStratification: true
    responses:
      '200':
        description: 随机化成功
        content:
          application/json:
            schema:
              allOf:
                - $ref: '#/components/schemas/ApiResponse'
                - type: object
                  properties:
                    data:
                      $ref: '#/components/schemas/RandomizationResultVO'
            example:
              code: 200
              message: "随机化成功"
              data:
                subjectId: 10086
                randomizationNumber: "RAND-2026-0042"
                treatmentGroup: "TREATMENT_ARM_A"
                treatmentGroupLabel: "试验药物XXX 300mg QD"
                isBlinded: true
                blindedGroupCode: "GRP-001"
                randomizationDate: "2026-05-11T10:15:00.000+08:00"
                randomizationMethod: "CENTRAL_IRT"
                stratificationFactors:
                  siteId: 2001
                  ageGroup: "18-65"
                  diseaseSeverity: "MODERATE"
                  priorTreatment: "NO"
                kitNumber: "KIT-A-0021"
                kitExpiryDate: "2027-06-30"
              traceId: "trace-abc-123"
              timestamp: "2026-05-11T10:15:00.000+08:00"
      '400':
        description: 校验失败
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/ApiResponse'
            examples:
              not_eligible:
                value:
                  code: 42202
                  message: "受试者不满足随机化条件：当前状态为 SCREENING，需要 ENROLLED"
              stratification_mismatch:
                value:
                  code: 42203
                  message: "分层因素与系统记录不一致，请确认后重新提交"
                  data:
                    systemFactors:
                      diseaseSeverity: "SEVERE"
                    submittedFactors:
                      diseaseSeverity: "MODERATE"
      '409':
        description: 受试者已完成随机化
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/ApiResponse'
            example:
              code: 40903
              message: "该受试者已完成随机化"
              data:
                randomizationNumber: "RAND-2026-0042"
                treatmentGroup: "TREATMENT_ARM_A"
                randomizationDate: "2026-05-11T10:15:00.000+08:00"
              traceId: "trace-abc-123"
              timestamp: "2026-05-11T10:15:00.000+08:00"
      '502':
        description: IRT服务调用失败
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/ApiResponse'
            example:
              code: 50201
              message: "IRT随机化服务调用失败，请稍后重试"
              data:
                irtSystemName: "Suvoda IRT"
                errorDetail: "Connection timeout after 30s"
                retryAfterSeconds: 60
              traceId: "trace-abc-123"
              timestamp: "2026-05-11T10:15:30.000+08:00"

components:
  schemas:
    RandomizationDTO:
      type: object
      required:
        - randomizationMethod
        - confirmStratification
      properties:
        stratificationFactors:
          type: object
          description: 分层因素键值对，必须与方案定义的分层因素匹配
          additionalProperties: true
          example:
            siteId: 2001
            ageGroup: "18-65"
            diseaseSeverity: "MODERATE"
            priorTreatment: "NO"
        randomizationMethod:
          type: string
          enum:
            - CENTRAL_IRT
            - LOCAL_ALGORITHM
          description: 随机化方法
          example: "CENTRAL_IRT"
        confirmStratification:
          type: boolean
          description: 确认分层因素无误
          example: true
        notes:
          type: string
          maxLength: 500
          description: 备注
    RandomizationResultVO:
      type: object
      properties:
        subjectId:
          type: integer
          format: int64
        randomizationNumber:
          type: string
          description: 随机化编号
        treatmentGroup:
          type: string
          description: 治疗分组编码
        treatmentGroupLabel:
          type: string
          description: 治疗分组标签（揭盲后可见）
        isBlinded:
          type: boolean
          description: 当前用户是否处于盲态
        blindedGroupCode:
          type: string
          description: 盲态分组代码
        randomizationDate:
          type: string
          format: date-time
        randomizationMethod:
          type: string
        stratificationFactors:
          type: object
          additionalProperties: true
        kitNumber:
          type: string
          description: 药物试剂盒编号
        kitExpiryDate:
          type: string
          format: date
          description: 试剂盒有效期
```

</details>

---

### 16.4 PUT /api/v1/studies/{id}/status - 试验状态转换

**业务说明**: 试验状态转换是平台最核心的工作流之一。状态变更会触发级联操作：通知所有关联中心、更新里程碑、触发合规检查等。

<details>
<summary>完整 OpenAPI Schema</summary>

```yaml
/api/v1/studies/{id}/status:
  put:
    tags:
      - Study Management
    summary: 试验状态转换
    description: >
      执行试验状态转换。系统自动校验转换合法性并触发级联操作：
      - ENROLLING -> FOLLOWUP: 关闭中心入组窗口
      - FOLLOWUP -> LOCKED: 冻结所有中心数据录入
      - LOCKED -> ARCHIVED: 归档所有试验数据
    operationId: updateStudyStatus
    parameters:
      - name: id
        in: path
        required: true
        schema:
          type: integer
          format: int64
      - name: Idempotency-Key
        in: header
        required: true
        schema:
          type: string
          format: uuid
    requestBody:
      required: true
      content:
        application/json:
          schema:
            $ref: '#/components/schemas/StudyStatusTransitionDTO'
          examples:
            lock:
              summary: 锁定试验
              value:
                targetStatus: "LOCKED"
                effectiveDate: "2026-05-11"
                reason: "所有受试者已完成末次访视，数据清理完成，准备数据库锁定"
                confirmDataClean: true
                confirmAllQueriesResolved: true
                notifyAllSites: true
            archive:
              summary: 归档试验
              value:
                targetStatus: "ARCHIVED"
                effectiveDate: "2026-05-11"
                reason: "数据库已锁定，临床试验报告已完成，归档试验"
                archiveLocation: "/TMF/STUDY-001/ARCHIVE"
    responses:
      '200':
        description: 状态转换成功
        content:
          application/json:
            schema:
              allOf:
                - $ref: '#/components/schemas/ApiResponse'
                - type: object
                  properties:
                    data:
                      $ref: '#/components/schemas/StudyVO'
            example:
              code: 200
              message: "试验状态已更新为 LOCKED，所有中心数据录入已冻结"
              data:
                id: 1001
                protocolNumber: "PRO-2026-001"
                status: "LOCKED"
                previousStatus: "FOLLOWUP"
                statusChangedAt: "2026-05-11T11:00:00.000+08:00"
                statusChangedBy: "项目经理-王"
                cascadedActions:
                  - "所有中心入组已停止"
                  - "所有中心数据录入已冻结"
                  - "未关闭质疑数量: 3, 已发送提醒"
                  - "未完成SDV访视数: 5, 已通知CRA"
              traceId: "trace-abc-123"
              timestamp: "2026-05-11T11:00:00.000+08:00"
      '422':
        description: 业务校验失败
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/ApiResponse'
            examples:
              unresolved_queries:
                value:
                  code: 42204
                  message: "无法锁定试验：存在 23 条未关闭的质疑"
                  data:
                    openQueryCount: 23
                    openQueryBySite:
                      - siteId: 2001
                        siteName: "北京协和医院"
                        openQueries: 12
                      - siteId: 2002
                        siteName: "上海瑞金医院"
                        openQueries: 11
                    action: "请先解决所有未关闭的质疑，或使用强制锁定选项"
              active_enrollment:
                value:
                  code: 42205
                  message: "无法锁定试验：中心 2003 仍处于入组状态"
                  data:
                    activeEnrollingSites:
                      - siteId: 2003
                        siteName: "广州中山大学附属第一医院"
                        status: "ENROLLING"

components:
  schemas:
    StudyStatusTransitionDTO:
      type: object
      required:
        - targetStatus
        - effectiveDate
        - reason
      properties:
        targetStatus:
          type: string
          enum: [STARTUP, ENROLLING, FOLLOWUP, LOCKED, ARCHIVED, CANCELLED]
          description: 目标状态
        effectiveDate:
          type: string
          format: date
          description: 生效日期
        reason:
          type: string
          maxLength: 2000
          description: 状态变更原因
        confirmDataClean:
          type: boolean
          description: 确认数据已清理（LOCKED时必填）
        confirmAllQueriesResolved:
          type: boolean
          description: 确认所有质疑已解决（LOCKED时必填）
        notifyAllSites:
          type: boolean
          default: true
          description: 是否通知所有中心
        forceLock:
          type: boolean
          default: false
          description: 强制锁定（跳过部分校验，需要ADMIN角色+额外审批）
        forceLockReason:
          type: string
          maxLength: 2000
          description: 强制锁定原因（forceLock=true时必填）
        archiveLocation:
          type: string
          maxLength: 500
          description: 归档位置（ARCHIVED时填写）
```

</details>

---

### 16.5 POST /api/v1/files/upload-url - 获取预签名上传URL

**业务说明**: 文件上传采用服务端生成预签名URL模式，客户端直接上传到对象存储（S3/MinIO），完成后回调服务端确认。

<details>
<summary>完整 OpenAPI Schema</summary>

```yaml
/api/v1/files/upload-url:
  post:
    tags:
      - File Management
    summary: 获取文件上传预签名URL
    description: >
      生成预签名上传URL，客户端使用该URL直接上传文件到对象存储。
      预签名URL有效期默认为15分钟，上传完成后需调用 /api/v1/files/upload-confirm 确认。
    operationId: generateUploadUrl
    parameters:
      - name: X-Trace-Id
        in: header
        required: false
        schema:
          type: string
    requestBody:
      required: true
      content:
        application/json:
          schema:
            $ref: '#/components/schemas/FileUploadUrlRequestDTO'
          example:
            fileName: "lab-report-subject-10086-visit-3.pdf"
            fileSize: 2048576
            contentType: "application/pdf"
            checksumSha256: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
            documentType: "LAB_REPORT"
            targetEntityType: "SUBJECT"
            targetEntityId: 10086
            metadata:
              visitId: 3001
              labTestDate: "2026-05-10"
              labName: "中心实验室"
    responses:
      '200':
        description: 预签名URL生成成功
        content:
          application/json:
            schema:
              allOf:
                - $ref: '#/components/schemas/ApiResponse'
                - type: object
                  properties:
                    data:
                      $ref: '#/components/schemas/FileUploadUrlVO'
            example:
              code: 200
              message: "预签名上传URL生成成功"
              data:
                fileId: "file-uuid-a1b2c3d4"
                uploadUrl: "https://storage.ctms.com/uploads/file-uuid-a1b2c3d4?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Credential=...&X-Amz-Signature=..."
                uploadMethod: "PUT"
                uploadHeaders:
                  Content-Type: "application/pdf"
                  x-amz-meta-checksum-sha256: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
                expiresAt: "2026-05-11T10:30:00.000+08:00"
                maxFileSize: 104857600
              traceId: "trace-abc-123"
              timestamp: "2026-05-11T10:15:00.000+08:00"
      '400':
        description: 参数校验失败
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/ApiResponse'
            examples:
              file_too_large:
                value:
                  code: 40005
                  message: "文件大小超过限制：当前204857600 bytes，最大允许 104857600 bytes"
              invalid_type:
                value:
                  code: 40006
                  message: "不支持的文件类型：application/x-msdownload，仅允许 PDF/PNG/JPG/DICOM/DOCX/XLSX"

components:
  schemas:
    FileUploadUrlRequestDTO:
      type: object
      required:
        - fileName
        - fileSize
        - contentType
        - documentType
        - targetEntityType
        - targetEntityId
      properties:
        fileName:
          type: string
          maxLength: 255
          description: 原始文件名
          example: "lab-report-subject-10086-visit-3.pdf"
        fileSize:
          type: integer
          format: int64
          minimum: 1
          maximum: 104857600
          description: 文件大小（bytes），最大100MB
          example: 2048576
        contentType:
          type: string
          description: MIME类型
          example: "application/pdf"
        checksumSha256:
          type: string
          pattern: '^[a-fA-F0-9]{64}$'
          description: 文件SHA256校验和（用于完整性校验）
        documentType:
          type: string
          enum:
            - MEDICAL_RECORD
            - LAB_REPORT
            - PATHOLOGY_REPORT
            - IMAGING_REPORT
            - PRESCRIPTION
            - INFORMED_CONSENT
            - AE_FORM
            - SAE_FORM
            - MEDICATION_LOG
            - DISCHARGE_SUMMARY
            - SITE_CONTRACT
            - BUDGET_DOCUMENT
            - MONITORING_REPORT
            - REGULATORY_DOCUMENT
            - OTHER
          description: 文档类型
        targetEntityType:
          type: string
          enum:
            - STUDY
            - SITE
            - SUBJECT
            - AE
            - SAE
            - VISIT
            - MONITORING_VISIT
            - CONTRACT
            - BUDGET
            - REIMBURSEMENT
          description: 关联实体类型
        targetEntityId:
          type: integer
          format: int64
          description: 关联实体ID
        metadata:
          type: object
          additionalProperties: true
          description: 自定义元数据键值对
          example:
            visitId: 3001
            labTestDate: "2026-05-10"
    FileUploadUrlVO:
      type: object
      properties:
        fileId:
          type: string
          format: uuid
          description: 服务端生成的文件唯一标识
        uploadUrl:
          type: string
          format: uri
          description: 预签名上传URL
        uploadMethod:
          type: string
          enum: [PUT]
          description: HTTP上传方法
        uploadHeaders:
          type: object
          additionalProperties:
            type: string
          description: 上传时需要携带的Header
        expiresAt:
          type: string
          format: date-time
          description: 预签名URL过期时间
        maxFileSize:
          type: integer
          format: int64
          description: 最大允许文件大小(bytes)
```

</details>

---

### 16.6 POST /api/v1/ocr/callback - AI OCR回调

**业务说明**: 外部AI服务完成OCR识别后，通过此回调接口将结果推送给CTMS平台。回调接口需要签名验证。

<details>
<summary>完整 OpenAPI Schema</summary>

```yaml
/api/v1/ocr/callback:
  post:
    tags:
      - OCR & AI
    summary: AI OCR服务回调
    description: >
      AI服务完成OCR识别后回调此接口提交结果。
      安全要求：
      1. 请求头必须携带签名：X-Callback-Signature = HMAC-SHA256(payload, sharedSecret)
      2. 请求头必须携带时间戳：X-Callback-Timestamp（防重放，5分钟内有效）
      3. 携带callbackToken进行额外验证
    operationId: ocrCallback
    security:
      - ApiKeyAuth: []
      - CallbackSignature: []
    parameters:
      - name: X-Callback-Signature
        in: header
        required: true
        schema:
          type: string
        description: HMAC-SHA256签名
      - name: X-Callback-Timestamp
        in: header
        required: true
        schema:
          type: integer
          format: int64
        description: Unix毫秒时间戳
      - name: Idempotency-Key
        in: header
        required: true
        schema:
          type: string
    requestBody:
      required: true
      content:
        application/json:
          schema:
            $ref: '#/components/schemas/OcrCallbackDTO'
          example:
            jobId: "ocr-job-abc-12345"
            status: "COMPLETED"
            callbackToken: "verification-token-xyz-789"
            results:
              - fieldCode: "patient_name"
                fieldLabel: "患者姓名"
                value: "张三"
                confidence: 0.98
                boundingBox:
                  x: 120
                  "y": 85
                  width: 200
                  height: 30
                  page: 1
                rawText: "张三"
                needsReview: false
              - fieldCode: "diagnosis"
                fieldLabel: "诊断"
                value: "原发性非小细胞肺癌（腺癌）T2N1M0 IIB期"
                confidence: 0.76
                boundingBox:
                  x: 150
                  "y": 320
                  width: 500
                  height: 40
                  page: 1
                rawText: "原发性非小细胞肺癌(腺癌)T2N1M0 IIB期"
                needsReview: true
                reviewReason: "confidence低于阈值(0.80)，且诊断编码需人工确认"
            metadata:
              pagesProcessed: 5
              overallConfidence: 0.87
              processingTimeMs: 4200
              ocrEngineVersion: "med-ocr-v3.2.1"
              errorPages: []
            warnings:
              - "第3页底部图像模糊，可能影响识别准确度"
    responses:
      '200':
        description: 回调接收成功
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/ApiResponse'
            example:
              code: 200
              message: "OCR回调处理成功"
              data:
                jobId: "ocr-job-abc-12345"
                status: "PENDING_CONFIRMATION"
                needsHumanReview: true
                reviewRequiredFields:
                  - fieldCode: "diagnosis"
                    reason: "置信度 0.76 低于审核阈值 0.80"
              traceId: "trace-abc-123"
              timestamp: "2026-05-11T10:20:00.000+08:00"
      '401':
        description: 签名验证失败
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/ApiResponse'
            example:
              code: 40101
              message: "回调签名验证失败"
              traceId: "trace-abc-123"
              timestamp: "2026-05-11T10:20:00.000+08:00"
      '400':
        description: 回调Token验证失败或任务状态不正确
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/ApiResponse'
            examples:
              invalid_token:
                value:
                  code: 40007
                  message: "回调Token无效或已过期"
              invalid_job_status:
                value:
                  code: 40008
                  message: "OCR任务状态(PENDING)不允许接收回调，当前仅 PROCESSING 状态可接收"

components:
  schemas:
    OcrCallbackDTO:
      type: object
      required:
        - jobId
        - status
        - callbackToken
      properties:
        jobId:
          type: string
          description: OCR任务ID
        status:
          type: string
          enum: [COMPLETED, PARTIALLY_COMPLETED, FAILED]
          description: 识别状态
        callbackToken:
          type: string
          description: 系统生成的回调验证Token
        results:
          type: array
          items:
            $ref: '#/components/schemas/OcrFieldResult'
          description: 字段识别结果列表
        metadata:
          type: object
          properties:
            pagesProcessed:
              type: integer
            overallConfidence:
              type: number
              format: float
              minimum: 0
              maximum: 1
            processingTimeMs:
              type: integer
            ocrEngineVersion:
              type: string
            errorPages:
              type: array
              items:
                type: integer
          description: 处理元数据
        warnings:
          type: array
          items:
            type: string
          description: 警告信息列表
    OcrFieldResult:
      type: object
      required:
        - fieldCode
        - value
        - confidence
      properties:
        fieldCode:
          type: string
          description: 字段编码（与OCR模板定义一致）
        fieldLabel:
          type: string
          description: 字段显示名称
        value:
          type: string
          description: 识别结果值
        confidence:
          type: number
          format: float
          minimum: 0
          maximum: 1
          description: 置信度（0-1）
        boundingBox:
          type: object
          properties:
            x:
              type: integer
            "y":
              type: integer
            width:
              type: integer
            height:
              type: integer
            page:
              type: integer
          description: 字段在文档中的位置
        rawText:
          type: string
          description: OCR原始文本
        needsReview:
          type: boolean
          description: 是否需要人工审核
        reviewReason:
          type: string
          description: 需要审核的原因
        normalizedValue:
          type: string
          description: 标准化后的值（如日期格式化为ISO 8601）
```

</details>

---

### 16.7 POST /api/v1/saes/{id}/escalate - SAE上报工作流

**业务说明**: 触发SAE的正式上报工作流。系统根据SAE的严重性标准、发生地区自动确定需要递交的监管机构和时限要求。

<details>
<summary>完整 OpenAPI Schema</summary>

```yaml
/api/v1/saes/{id}/escalate:
  post:
    tags:
      - Safety
    summary: SAE上报工作流触发
    description: >
      触发SAE上报工作流，系统将：
      1. 根据严重性标准确定上报时限（7天/15天）
      2. 根据试验开展国家确定监管机构
      3. 生成上报表单草稿
      4. 发送通知给DS/PM/申办方
      5. 启动时限监控定时任务
    operationId: escalateSae
    parameters:
      - name: id
        in: path
        required: true
        schema:
          type: integer
          format: int64
      - name: Idempotency-Key
        in: header
        required: true
        schema:
          type: string
          format: uuid
    requestBody:
      required: true
      content:
        application/json:
          schema:
            $ref: '#/components/schemas/SaeEscalateDTO'
          example:
            reportType: "INITIAL"
            reporterId: 10001
            reporterRole: "PI"
            awareDate: "2026-05-10T14:30:00.000+08:00"
            narrativeSummary: "受试者于2026年5月9日出现呼吸困难...（详细叙述）"
            causalityAssessment: "PROBABLY_RELATED"
            expectedness: "UNEXPECTED"
            isSuspectedAdverseReaction: true
            blinderAware: false
            notifyStakeholders:
              - "DS"
              - "PM"
              - "SPONSOR_SAFETY"
              - "REGULATORY_AFFAIRS"
            regulatoryAuthorities:
              - authorityCode: "NMPA"
                submissionMethod: "E2B_R3"
                submissionDeadline: "2026-05-17"
              - authorityCode: "FDA"
                submissionMethod: "E2B_R3"
                submissionDeadline: "2026-05-17"
            attachments:
              - fileId: "file-uuid-001"
                description: "住院病历"
              - fileId: "file-uuid-002"
                description: "实验室检查报告"
    responses:
      '200':
        description: SAE上报工作流已启动
        content:
          application/json:
            schema:
              allOf:
                - $ref: '#/components/schemas/ApiResponse'
                - type: object
                  properties:
                    data:
                      $ref: '#/components/schemas/SaeWorkflowVO'
            example:
              code: 200
              message: "SAE上报工作流已启动，需在 7 天内完成初次上报"
              data:
                saeId: 20001
                workflowId: "WF-SAE-2026-00156"
                status: "INITIAL_REPORT_IN_PROGRESS"
                reportingDeadline: "2026-05-17T23:59:59.000+08:00"
                daysRemaining: 7
                isOverdue: false
                regulatorySubmissions:
                  - authority: "NMPA"
                    status: "PENDING"
                    method: "E2B_R3"
                    deadline: "2026-05-17"
                  - authority: "FDA"
                    status: "PENDING"
                    method: "E2B_R3"
                    deadline: "2026-05-17"
                notifications:
                  - recipient: "药物安全专员-李"
                    channel: "EMAIL+SMS"
                    sentAt: "2026-05-11T10:30:00.000+08:00"
                  - recipient: "PM-王"
                    channel: "EMAIL"
                    sentAt: "2026-05-11T10:30:00.000+08:00"
                nextSteps:
                  - "完成SAE叙述撰写"
                  - "完成CIOMS-I表单填写"
                  - "提交NMPA E2B R3 报告"
                  - "提交FDA E2B R3 报告"
              traceId: "trace-abc-123"
              timestamp: "2026-05-11T10:30:00.000+08:00"
      '422':
        description: 业务校验失败
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/ApiResponse'
            example:
              code: 42206
              message: "SAE上报需要完成严重性标准评估和因果关系判定"
              data:
                missingFields:
                  - "causalityAssessment"
                  - "expectedness"

components:
  schemas:
    SaeEscalateDTO:
      type: object
      required:
        - reportType
        - reporterId
        - awareDate
        - narrativeSummary
        - causalityAssessment
        - expectedness
      properties:
        reportType:
          type: string
          enum: [INITIAL, FOLLOWUP, FINAL]
          description: 报告类型
        reporterId:
          type: integer
          format: int64
          description: 上报人ID
        reporterRole:
          type: string
          enum: [PI, SUB_I, CRA, DS]
          description: 上报人角色
        awareDate:
          type: string
          format: date-time
          description: 获知SAE日期（计算上报时限的基准日期）
        narrativeSummary:
          type: string
          maxLength: 10000
          description: SAE叙述摘要
        causalityAssessment:
          type: string
          enum:
            - DEFINITELY_RELATED
            - PROBABLY_RELATED
            - POSSIBLY_RELATED
            - UNLIKELY_RELATED
            - NOT_RELATED
          description: 与研究药物的因果关系判定
        expectedness:
          type: string
          enum: [EXPECTED, UNEXPECTED]
          description: 是否预期事件（参照研究者手册IB）
        isSuspectedAdverseReaction:
          type: boolean
          description: 是否为可疑且非预期严重不良反应（SUSAR）
        blinderAware:
          type: boolean
          default: false
          description: 是否需要揭盲才能上报
        notifyStakeholders:
          type: array
          items:
            type: string
            enum: [DS, PM, SPONSOR_SAFETY, REGULATORY_AFFAIRS, EC, SITE_PI]
          description: 需要通知的相关方
        regulatoryAuthorities:
          type: array
          items:
            type: object
            properties:
              authorityCode:
                type: string
              submissionMethod:
                type: string
                enum: [E2B_R2, E2B_R3, CIOMS_I, PAPER_FORM, CUSTOM]
              submissionDeadline:
                type: string
                format: date
          description: 需要递交的监管机构及方式
        attachments:
          type: array
          items:
            type: object
            properties:
              fileId:
                type: string
                format: uuid
              description:
                type: string
          description: 附件列表
    SaeWorkflowVO:
      type: object
      properties:
        saeId:
          type: integer
          format: int64
        workflowId:
          type: string
          description: 工作流实例ID
        status:
          type: string
          enum:
            - INITIAL_REPORT_IN_PROGRESS
            - INITIAL_REPORT_SUBMITTED
            - FOLLOWUP_REPORT_IN_PROGRESS
            - FOLLOWUP_REPORT_SUBMITTED
            - FINAL_REPORT_SUBMITTED
            - CLOSED
        reportingDeadline:
          type: string
          format: date-time
        daysRemaining:
          type: integer
        isOverdue:
          type: boolean
        regulatorySubmissions:
          type: array
          items:
            type: object
            properties:
              authority:
                type: string
              status:
                type: string
                enum: [PENDING, IN_PROGRESS, SUBMITTED, ACKNOWLEDGED, REJECTED]
              method:
                type: string
              deadline:
                type: string
                format: date
        notifications:
          type: array
          items:
            type: object
            properties:
              recipient:
                type: string
              channel:
                type: string
              sentAt:
                type: string
                format: date-time
        nextSteps:
          type: array
          items:
            type: string
```

</details>

---

### 16.8 POST /api/v1/exports - 触发异步导出

**业务说明**: 所有导出操作均为异步模式。用户触发导出后立即返回任务ID，通过轮询获取导出进度和结果。

<details>
<summary>完整 OpenAPI Schema</summary>

```yaml
/api/v1/exports:
  post:
    tags:
      - Export & Reports
    summary: 触发异步数据导出
    description: >
      触发异步导出任务。导出类型包括：AE列表、SAE列表、受试者数据、质疑列表等。
      导出完成后通过 notification 或轮询 /api/v1/exports/{taskId}/status 获取结果。
    operationId: triggerExport
    parameters:
      - name: Idempotency-Key
        in: header
        required: true
        schema:
          type: string
          format: uuid
    requestBody:
      required: true
      content:
        application/json:
          schema:
            $ref: '#/components/schemas/ExportRequestDTO'
          example:
            exportType: "SUBJECT_DATA_EXPORT"
            format: "XLSX"
            studyId: 1001
            siteIds: [2001, 2002]
            filters:
              status: ["ENROLLED", "RANDOMIZED", "ACTIVE", "COMPLETED"]
              enrollmentDateFrom: "2025-01-01"
              enrollmentDateTo: "2026-05-01"
            columns:
              - "subjectNumber"
              - "siteName"
              - "status"
              - "enrollmentDate"
              - "randomizationDate"
              - "treatmentGroup"
              - "age"
              - "gender"
              - "visitsCompleted"
              - "aeCount"
              - "saeCount"
            includePii: false
            includeAuditTrail: false
            splitBySite: true
            watermark: true
            notificationChannels: ["EMAIL", "IN_APP"]
    responses:
      '200':
        description: 导出任务已创建
        content:
          application/json:
            schema:
              allOf:
                - $ref: '#/components/schemas/ApiResponse'
                - type: object
                  properties:
                    data:
                      $ref: '#/components/schemas/AsyncTaskVO'
            example:
              code: 200
              message: "导出任务已创建"
              data:
                taskId: "export-task-abc-123"
                taskType: "EXPORT"
                status: "PENDING"
                estimatedCompletionTime: "2026-05-11T10:32:00.000+08:00"
                pollingEndpoint: "/api/v1/exports/export-task-abc-123/status"
                pollingIntervalSeconds: 5
              traceId: "trace-abc-123"
              timestamp: "2026-05-11T10:30:00.000+08:00"
      '429':
        description: 导出任务过多，请稍后再试
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/ApiResponse'
            example:
              code: 42901
              message: "导出任务并发限制：当前用户有 3 个导出任务正在处理中，请等待完成后再提交新的导出请求"
              data:
                activeExportTasks: 3
                maxConcurrentExports: 3
                retryAfterSeconds: 60

components:
  schemas:
    ExportRequestDTO:
      type: object
      required:
        - exportType
        - format
        - studyId
      properties:
        exportType:
          type: string
          enum:
            - SUBJECT_DATA_EXPORT
            - AE_LISTING_EXPORT
            - SAE_LISTING_EXPORT
            - QUERY_LISTING_EXPORT
            - DEVIATION_LISTING_EXPORT
            - SITE_PERFORMANCE_EXPORT
            - MONITORING_REPORT_EXPORT
            - FINANCIAL_REPORT_EXPORT
            - AUDIT_TRAIL_EXPORT
            - TMF_INDEX_EXPORT
            - CUSTOM_REPORT_EXPORT
          description: 导出类型
        format:
          type: string
          enum: [XLSX, CSV, PDF]
          description: 导出文件格式
        studyId:
          type: integer
          format: int64
          description: 试验ID
        siteIds:
          type: array
          items:
            type: integer
            format: int64
          description: 中心ID列表（为空则导出所有中心）
        filters:
          type: object
          additionalProperties: true
          description: 动态筛选条件，根据导出类型不同支持不同字段
        columns:
          type: array
          items:
            type: string
          description: 需要导出的列（为空则导出所有默认列）
        includePii:
          type: boolean
          default: false
          description: 是否包含PII数据（需要特殊权限）
        includeAuditTrail:
          type: boolean
          default: false
          description: 是否包含审计轨迹
        splitBySite:
          type: boolean
          default: false
          description: 是否按中心拆分为多个文件
        watermark:
          type: boolean
          default: true
          description: 是否添加水印
        notificationChannels:
          type: array
          items:
            type: string
            enum: [EMAIL, IN_APP]
          description: 导出完成后的通知渠道
    AsyncTaskVO:
      type: object
      properties:
        taskId:
          type: string
          description: 异步任务ID
        taskType:
          type: string
          enum: [EXPORT, IMPORT, OCR, REPORT_GENERATION, RECONCILIATION, AI_REVIEW, BATCH_OPERATION]
        status:
          type: string
          enum: [PENDING, PROCESSING, COMPLETED, FAILED, CANCELLED]
        progress:
          type: integer
          minimum: 0
          maximum: 100
          description: 进度百分比
        estimatedCompletionTime:
          type: string
          format: date-time
        pollingEndpoint:
          type: string
          description: 轮询状态接口路径
        pollingIntervalSeconds:
          type: integer
          description: 建议轮询间隔（秒）
        resultDownloadUrl:
          type: string
          description: 导出结果下载URL（COMPLETED状态时）
        errorMessage:
          type: string
          description: 错误信息（FAILED状态时）
```

</details>

---

### 16.9 GET /api/v1/dashboard/pm-workspace - PM工作台

**业务说明**: PM工作台是项目经理的核心数据聚合页面，整合试验概览、入组进度、中心状态、质量指标、预算使用等多维度数据。

<details>
<summary>完整 OpenAPI Schema</summary>

```yaml
/api/v1/dashboard/pm-workspace:
  get:
    tags:
      - Dashboard
    summary: PM工作台数据
    description: >
      获取项目经理工作台的聚合数据，包含：
      - 试验概览（总数、进行中、入组中）
      - 入组统计（计划、已筛选、已入组、脱落等）
      - 中心概览（激活率、入组率、平均启动天数）
      - 质量指标（质疑数、逾期数、平均解决天数）
      - 安全性概览（AE/SAE数量、上报逾期）
      - 预算概览（预算总额、已花费、剩余）
      - 风险告警列表
      - 近期里程碑
    operationId: getPmWorkspace
    parameters:
      - name: studyId
        in: query
        required: false
        schema:
          type: integer
          format: int64
        description: 试验ID（不传则返回当前PM负责的所有试验聚合数据）
    responses:
      '200':
        description: 返回PM工作台数据
        content:
          application/json:
            schema:
              allOf:
                - $ref: '#/components/schemas/ApiResponse'
                - type: object
                  properties:
                    data:
                      $ref: '#/components/schemas/PmWorkspaceVO'
            example:
              code: 200
              message: "操作成功"
              data:
                studyOverview:
                  totalStudies: 12
                  activeStudies: 8
                  enrollingStudies: 5
                  completedStudies: 2
                enrollmentStats:
                  planned: 480
                  screened: 210
                  screenFailed: 32
                  enrolled: 156
                  randomized: 142
                  completed: 45
                  withdrawn: 8
                  lostToFollowup: 3
                  enrollmentRate: 3.2
                  enrollmentRateUnit: "WEEKLY"
                  estimatedCompletionDate: "2027-08-15"
                  screenFailureRate: 0.152
                siteOverview:
                  totalSites: 35
                  activatedSites: 28
                  enrollingSites: 22
                  closedSites: 4
                  averageActivationDays: 45.3
                  topEnrollingSite:
                    siteId: 2001
                    siteName: "北京协和医院"
                    enrolledSubjects: 45
                  lowestEnrollingSite:
                    siteId: 2005
                    siteName: "某市中心医院"
                    enrolledSubjects: 2
                qualityMetrics:
                  openQueries: 67
                  overdueQueries: 12
                  averageResolutionDays: 5.3
                  queryAging30Days: 8
                  queryAging60Days: 3
                  queryAging90PlusDays: 1
                  sdvCompletionRate: 0.72
                safetyOverview:
                  totalAes: 234
                  totalSaes: 15
                  saesOverdueReporting: 1
                  susarCount: 3
                budgetOverview:
                  totalBudget: 15000000.00
                  currencyCode: "CNY"
                  totalSpent: 8750000.00
                  totalRemaining: 6250000.00
                  spentPercentage: 0.583
                  overBudgetSites: []
                riskAlerts:
                  - alertType: "LOW_ENROLLMENT"
                    severity: "WARNING"
                    siteId: 2005
                    siteName: "某市中心医院"
                    message: "入组率远低于预期（当前2例，目标20例，剩余入组窗口45天）"
                    createdAt: "2026-05-11T08:00:00.000+08:00"
                  - alertType: "SAE_OVERDUE"
                    severity: "CRITICAL"
                    saeId: 20001
                    message: "SAE上报已逾期1天，请立即处理"
                    createdAt: "2026-05-10T00:00:00.000+08:00"
                  - alertType: "SITE_NOT_ACTIVATED"
                    severity: "WARNING"
                    siteId: 2008
                    siteName: "某市人民医院"
                    message: "中心选定已超过90天，仍未完成启动"
                    createdAt: "2026-05-09T00:00:00.000+08:00"
                upcomingMilestones:
                  - milestoneName: "完成50%入组"
                    targetDate: "2026-06-15"
                    progress: 0.325
                    daysRemaining: 35
                    status: "AT_RISK"
                  - milestoneName: "数据库锁定"
                    targetDate: "2027-03-01"
                    progress: 0.0
                    daysRemaining: 294
                    status: "ON_TRACK"
              traceId: "trace-abc-123"
              timestamp: "2026-05-11T10:30:00.000+08:00"

components:
  schemas:
    PmWorkspaceVO:
      type: object
      properties:
        studyOverview:
          type: object
          properties:
            totalStudies:
              type: integer
            activeStudies:
              type: integer
            enrollingStudies:
              type: integer
            completedStudies:
              type: integer
        enrollmentStats:
          type: object
          properties:
            planned:
              type: integer
            screened:
              type: integer
            screenFailed:
              type: integer
            enrolled:
              type: integer
            randomized:
              type: integer
            completed:
              type: integer
            withdrawn:
              type: integer
            lostToFollowup:
              type: integer
            enrollmentRate:
              type: number
              format: float
            enrollmentRateUnit:
              type: string
              enum: [DAILY, WEEKLY, MONTHLY]
            estimatedCompletionDate:
              type: string
              format: date
            screenFailureRate:
              type: number
              format: float
        siteOverview:
          type: object
          properties:
            totalSites:
              type: integer
            activatedSites:
              type: integer
            enrollingSites:
              type: integer
            closedSites:
              type: integer
            averageActivationDays:
              type: number
              format: float
            topEnrollingSite:
              $ref: '#/components/schemas/SiteBriefVO'
            lowestEnrollingSite:
              $ref: '#/components/schemas/SiteBriefVO'
        qualityMetrics:
          type: object
          properties:
            openQueries:
              type: integer
            overdueQueries:
              type: integer
            averageResolutionDays:
              type: number
              format: float
            queryAging30Days:
              type: integer
            queryAging60Days:
              type: integer
            queryAging90PlusDays:
              type: integer
            sdvCompletionRate:
              type: number
              format: float
        safetyOverview:
          type: object
          properties:
            totalAes:
              type: integer
            totalSaes:
              type: integer
            saesOverdueReporting:
              type: integer
            susarCount:
              type: integer
        budgetOverview:
          type: object
          properties:
            totalBudget:
              type: number
            currencyCode:
              type: string
            totalSpent:
              type: number
            totalRemaining:
              type: number
            spentPercentage:
              type: number
              format: float
            overBudgetSites:
              type: array
              items:
                $ref: '#/components/schemas/SiteBriefVO'
        riskAlerts:
          type: array
          items:
            type: object
            properties:
              alertType:
                type: string
              severity:
                type: string
                enum: [INFO, WARNING, CRITICAL]
              siteId:
                type: integer
                format: int64
              siteName:
                type: string
              message:
                type: string
              createdAt:
                type: string
                format: date-time
        upcomingMilestones:
          type: array
          items:
            type: object
            properties:
              milestoneName:
                type: string
              targetDate:
                type: string
                format: date
              progress:
                type: number
                format: float
              daysRemaining:
                type: integer
              status:
                type: string
                enum: [ON_TRACK, AT_RISK, DELAYED, COMPLETED]
    SiteBriefVO:
      type: object
      properties:
        siteId:
          type: integer
          format: int64
        siteName:
          type: string
        enrolledSubjects:
          type: integer
```

</details>

---

### 16.10 POST /api/v1/queries - 创建数据质疑

**业务说明**: 数据质疑是临床试验数据质量管理核心流程。质疑可针对受试者数据、访视数据、观察值等发起。

<details>
<summary>完整 OpenAPI Schema</summary>

```yaml
/api/v1/queries:
  post:
    tags:
      - Quality Management
    summary: 创建数据质疑
    description: >
      创建一条数据质疑。质疑可关联受试者、访视或具体观察值。
      系统自动分配质疑编号，并通知相关责任人。
    operationId: createQuery
    parameters:
      - name: Idempotency-Key
        in: header
        required: true
        schema:
          type: string
          format: uuid
    requestBody:
      required: true
      content:
        application/json:
          schema:
            $ref: '#/components/schemas/QueryCreateDTO'
          example:
            studyId: 1001
            siteId: 2001
            subjectId: 10086
            visitId: 3001
            queryType: "DATA_VALUE"
            priority: "HIGH"
            category: "OUT_OF_RANGE"
            sourceField: "labResult.hemoglobin"
            sourceValue: "25.0"
            sourceUnit: "g/dL"
            expectedRange: "12.0-17.5 g/dL"
            description: "血红蛋白值 25.0 g/dL 超出正常值范围 12.0-17.5 g/dL，请确认数值是否正确。是否需要复测？"
            suggestedCorrection: "请核实原始检验报告，如为录入错误请更正"
            assignedTo: 10002
            dueDate: "2026-05-18"
            references:
              - type: "FILE"
                fileId: "file-uuid-001"
                description: "检验报告原件"
            autoCloseConditions:
              autoCloseOnResponse: false
              requirePiReview: true
    responses:
      '200':
        description: 质疑创建成功
        content:
          application/json:
            schema:
              allOf:
                - $ref: '#/components/schemas/ApiResponse'
                - type: object
                  properties:
                    data:
                      $ref: '#/components/schemas/QueryVO'
            example:
              code: 200
              message: "质疑创建成功"
              data:
                id: 8001
                queryNumber: "QRY-2026-00842"
                studyId: 1001
                siteId: 2001
                subjectId: 10086
                visitId: 3001
                status: "OPEN"
                queryType: "DATA_VALUE"
                priority: "HIGH"
                category: "OUT_OF_RANGE"
                description: "血红蛋白值 25.0 g/dL 超出正常值范围..."
                createdBy: "CRA-张"
                createdAt: "2026-05-11T10:30:00.000+08:00"
                assignedTo: "CRC-赵"
                dueDate: "2026-05-18"
                statusHistory:
                  - status: "OPEN"
                    changedBy: "CRA-张"
                    changedAt: "2026-05-11T10:30:00.000+08:00"
                    comment: "质疑创建"
              traceId: "trace-abc-123"
              timestamp: "2026-05-11T10:30:00.000+08:00"
      '400':
        description: 参数校验失败
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/ApiResponse'
            example:
              code: 40009
              message: "质疑必须关联至少一个目标实体（subjectId/visitId/observationId）"

components:
  schemas:
    QueryCreateDTO:
      type: object
      required:
        - studyId
        - siteId
        - queryType
        - category
        - description
      properties:
        studyId:
          type: integer
          format: int64
        siteId:
          type: integer
          format: int64
        subjectId:
          type: integer
          format: int64
          description: 关联受试者
        visitId:
          type: integer
          format: int64
          description: 关联访视
        observationId:
          type: integer
          format: int64
          description: 关联观察值
        queryType:
          type: string
          enum:
            - DATA_VALUE
            - MISSING_DATA
            - DATA_CLARIFICATION
            - PROTOCOL_DEVIATION
            - LOGICAL_INCONSISTENCY
            - DUPLICATE_DATA
            - OTHER
          description: 质疑类型
        priority:
          type: string
          enum: [LOW, MEDIUM, HIGH, CRITICAL]
          default: MEDIUM
          description: 优先级
        category:
          type: string
          enum:
            - OUT_OF_RANGE
            - MISSING_VALUE
            - INCONSISTENT_DATA
            - ILLEGIBLE_DATA
            - PROTOCOL_NONCOMPLIANCE
            - OTHER
          description: 质疑分类
        sourceField:
          type: string
          description: 源数据字段路径
          example: "labResult.hemoglobin"
        sourceValue:
          type: string
          description: 当前记录值
        sourceUnit:
          type: string
          description: 单位
        expectedRange:
          type: string
          description: 预期值范围
        description:
          type: string
          maxLength: 5000
          description: 质疑详细描述
        suggestedCorrection:
          type: string
          maxLength: 2000
          description: 建议更正
        assignedTo:
          type: integer
          format: int64
          description: 分配给指定用户处理
        dueDate:
          type: string
          format: date
          description: 期望解决日期
        references:
          type: array
          items:
            type: object
            properties:
              type:
                type: string
                enum: [FILE, URL, DATA_REFERENCE]
              fileId:
                type: string
                format: uuid
              url:
                type: string
                format: uri
              description:
                type: string
          description: 参考依据
        autoCloseConditions:
          type: object
          properties:
            autoCloseOnResponse:
              type: boolean
              default: false
            requirePiReview:
              type: boolean
              default: false
          description: 自动关闭条件
    QueryVO:
      type: object
      properties:
        id:
          type: integer
          format: int64
        queryNumber:
          type: string
        studyId:
          type: integer
          format: int64
        siteId:
          type: integer
          format: int64
        subjectId:
          type: integer
          format: int64
        visitId:
          type: integer
          format: int64
        status:
          type: string
          enum: [OPEN, IN_REVIEW, RESPONDED, ANSWERED, CLOSED, CANCELLED, REOPENED]
        queryType:
          type: string
        priority:
          type: string
        category:
          type: string
        description:
          type: string
        createdBy:
          type: string
        createdAt:
          type: string
          format: date-time
        assignedTo:
          type: string
        dueDate:
          type: string
          format: date
        statusHistory:
          type: array
          items:
            type: object
            properties:
              status:
                type: string
              changedBy:
                type: string
              changedAt:
                type: string
                format: date-time
              comment:
                type: string
```

</details>

---


## 17. 统一错误码设计

### 17.1 ErrorCode 枚举（服务端定义）

所有错误码采用5位数字格式：`模块码(2位) + 错误类型(1位) + 序号(2位)`

```java
public enum ErrorCode {
    // ==================== 通用错误 (00) ====================
    SUCCESS(200, "操作成功"),
    BAD_REQUEST(40000, "请求参数错误"),
    VALIDATION_FAILED(40001, "参数校验失败: {0}"),
    MISSING_REQUIRED_PARAM(40002, "缺少必填参数: {0}"),
    INVALID_ENUM_VALUE(40003, "非法的枚举值: {0}"),
    INVALID_DATE_RANGE(40004, "日期范围无效: {0} ~ {1}"),
    INVALID_FILE_TYPE(40005, "不支持的文件类型: {0}"),
    FILE_SIZE_EXCEEDED(40006, "文件大小超出限制: {0} bytes > {1} bytes"),
    INVALID_FORMAT(40007, "格式无效: {0}"),
    DUPLICATE_REQUEST(40008, "重复请求（Idempotency-Key 已使用）"),

    UNAUTHORIZED(40100, "未认证，请先登录"),
    TOKEN_EXPIRED(40101, "Token已过期，请重新登录"),
    TOKEN_INVALID(40102, "Token无效或已被撤销"),
    CALLBACK_SIGNATURE_INVALID(40103, "回调签名验证失败"),
    INSUFFICIENT_PERMISSIONS(40300, "权限不足"),
    ACCOUNT_DISABLED(40301, "账户已被停用"),

    NOT_FOUND(40400, "资源不存在: {0}"),
    STUDY_NOT_FOUND(40401, "试验不存在: id={0}"),
    SITE_NOT_FOUND(40402, "中心不存在: id={0}"),
    SUBJECT_NOT_FOUND(40403, "受试者不存在: id={0}"),
    VISIT_NOT_FOUND(40404, "访视不存在: id={0}"),
    AE_NOT_FOUND(40405, "不良事件不存在: id={0}"),
    SAE_NOT_FOUND(40406, "严重不良事件不存在: id={0}"),
    QUERY_NOT_FOUND(40407, "质疑不存在: id={0}"),
    DOCUMENT_NOT_FOUND(40408, "文档不存在: id={0}"),
    USER_NOT_FOUND(40409, "用户不存在: id={0}"),
    FILE_NOT_FOUND(40410, "文件不存在: id={0}"),
    TASK_NOT_FOUND(40411, "异步任务不存在: taskId={0}"),

    METHOD_NOT_ALLOWED(40500, "不支持的HTTP方法"),
    CONFLICT(40900, "资源冲突: {0}"),
    VERSION_CONFLICT(40901, "版本冲突：数据已被其他用户修改，请刷新后重试"),
    STATUS_CONFLICT(40902, "状态冲突：当前状态为 {0}，不允许执行此操作"),
    DUPLICATE_RECORD(40903, "重复记录: {0} 已存在"),

    PRECONDITION_FAILED(41200, "前置条件不满足"),
    IDEMPOTENCY_KEY_MISSING(41201, "写操作需要提供 Idempotency-Key 请求头"),

    UNPROCESSABLE_ENTITY(42200, "业务校验失败"),
    INVALID_STATUS_TRANSITION(42201, "非法的状态转换: {0} -> {1}"),
    ENROLLMENT_NOT_ALLOWED(42202, "不满足入组条件: {0}"),
    RANDOMIZATION_NOT_ALLOWED(42203, "不满足随机化条件: {0}"),
    STUDY_LOCK_PRECONDITION_FAILED(42204, "锁定试验前置条件不满足: {0}"),
    SAE_ESCALATION_REQUIREMENT(42205, "SAE上报信息不完整: {0}"),
    ICF_NOT_SIGNED(42206, "知情同意书未签署"),
    ELIGIBILITY_NOT_MET(42207, "合格性标准未满足"),
    FREEZE_NOT_ALLOWED(42208, "冻结操作不允许: 存在未解决的质疑"),
    DATA_OUT_OF_RANGE(42209, "数据超出允许范围: {0}"),
    STRATIFICATION_MISMATCH(42210, "分层因素与系统记录不一致"),

    TOO_MANY_REQUESTS(42900, "请求过于频繁，请稍后重试"),
    EXPORT_CONCURRENCY_LIMIT(42901, "导出任务并发限制: 当前 {0} 个任务, 最大 {1} 个"),

    INTERNAL_ERROR(50000, "系统内部错误"),
    SERVICE_UNAVAILABLE(50300, "服务暂时不可用"),
    EXTERNAL_SERVICE_ERROR(50200, "外部服务调用失败: {0}"),
    IRT_SERVICE_ERROR(50201, "IRT随机化服务异常: {0}"),
    OCR_SERVICE_ERROR(50202, "OCR服务异常: {0}"),
    AI_SERVICE_ERROR(50203, "AI服务异常: {0}"),
    FILE_STORAGE_ERROR(50204, "文件存储服务异常: {0}"),
    NOTIFICATION_SERVICE_ERROR(50205, "通知服务异常: {0}"),

    GATEWAY_TIMEOUT(50400, "外部服务调用超时: {0}"),

    // ==================== 业务错误 (10-99 模块) ====================
    // 受试者管理 (10)
    SUBJECT_ALREADY_RANDOMIZED(41001, "受试者已完成随机化"),
    SUBJECT_NOT_ENROLLED(41002, "受试者未入组"),
    EMERGENCY_UNBLIND_RECORDED(41003, "紧急揭盲已记录，需要填写揭盲原因"),
    PII_ACCESS_DENIED(41004, "PII数据访问被拒绝: 缺少权限或未填写访问原因"),

    // 安全性管理 (20)
    AE_ALREADY_ESCALATED(42001, "该AE已升级为SAE: SAE-{0}"),
    SAE_REPORTING_DEADLINE_EXCEEDED(42002, "SAE上报已超时: 截止日期 {0}"),
    MEDDRA_CODE_REQUIRED(42003, "SAE关闭前需要完成MedDRA编码"),
    NARRATIVE_REQUIRED(42004, "SAE上报需要完成叙述"),
    REGULATORY_SUBMISSION_REQUIRED(42005, "法规递交未完成: {0}"),

    // 文档管理 (30)
    DOCUMENT_VERSION_CONFLICT(43001, "文档版本冲突"),
    DOCUMENT_APPROVAL_REQUIRED(43002, "文档需要审批后方可激活"),
    FILE_UPLOAD_NOT_CONFIRMED(43003, "文件上传未确认: fileId={0}"),
    TMF_INCOMPLETE(43004, "TMF完整性不足: 缺失 {0} 个必需文档"),

    // 质量管理 (40)
    QUERY_ALREADY_CLOSED(44001, "质疑已关闭，无法操作"),
    QUERY_RESPONSE_REQUIRED(44002, "需要先回复质疑"),
    ISSUE_ESCALATION_LIMIT(44003, "问题升级次数已达上限"),
    CAPA_APPROVAL_REQUIRED(44004, "CAPA需要审批"),
    DEVIATION_CRITICAL(44005, "严重方案偏离: 需要48小时内完成评估"),

    // 监查管理 (50)
    MONITORING_VISIT_OVERDUE(45001, "监查访视已逾期"),
    SDV_REQUIRED(45002, "需要先完成SDV"),
    MONITORING_REPORT_APPROVAL_REQUIRED(45003, "监查报告需要PM审批"),

    // 财务管理 (60)
    BUDGET_OVERSPENT(46001, "预算超支: 已花费 {0}, 预算总额 {1}"),
    CONTRACT_NOT_APPROVED(46002, "合同未审批"),
    PAYMENT_APPROVAL_REQUIRED(46003, "付款需要审批"),
    INVOICE_MISMATCH(46004, "发票金额与合同不一致"),

    // 集成 (70)
    INTEGRATION_TASK_FAILED(47001, "集成任务失败: {0}"),
    RECONCILIATION_MISMATCH(47002, "数据对账发现 {0} 条不一致记录"),
    EXTERNAL_SYSTEM_UNREACHABLE(47003, "外部系统不可达: {0}"),
    DATA_MAPPING_INVALID(47004, "数据映射规则无效: {0}"),

    // 试验管理 (80)
    STUDY_ALREADY_LOCKED(48001, "试验已锁定，不允许修改"),
    STUDY_ALREADY_ARCHIVED(48002, "试验已归档，不允许修改"),
    PROTOCOL_VERSION_EXISTS(48003, "方案版本号已存在: {0}"),
    MILESTONE_OVERDUE(48004, "里程碑已逾期: {0}, 计划日期: {1}"),
    SITE_ALREADY_ASSIGNED(48005, "中心已关联到此试验"),
    ;

    private final int code;
    private final String messagePattern;

    ErrorCode(int code, String messagePattern) {
        this.code = code;
        this.messagePattern = messagePattern;
    }

    public int getCode() { return code; }
    public String getMessagePattern() { return messagePattern; }

    /**
     * 格式化错误消息，替换占位符 {0}, {1}, ...
     */
    public String format(Object... args) {
        String result = messagePattern;
        for (int i = 0; i < args.length; i++) {
            result = result.replace("{" + i + "}", String.valueOf(args[i]));
        }
        return result;
    }
}
```

### 17.2 错误码分类

| 模块码 | 模块名称 | 错误码范围 |
|--------|----------|------------|
| 00 | 通用/系统 | 40000-40999, 50000-50400 |
| 10 | 受试者管理 | 41001-41099 |
| 20 | 安全性管理 | 42001-42099 |
| 30 | 文档管理 | 43001-43099 |
| 40 | 质量管理 | 44001-44099 |
| 50 | 监查管理 | 45001-45099 |
| 60 | 财务管理 | 46001-46099 |
| 70 | 集成 | 47001-47099 |
| 80 | 试验管理 | 48001-48099 |

### 17.3 HTTP状态码映射

| HTTP Status | 对应场景 |
|-------------|----------|
| 200 | 请求成功 |
| 201 | 资源创建成功 |
| 204 | 删除成功（无返回体） |
| 400 | 请求参数校验失败、格式错误 |
| 401 | 未认证、Token过期/无效 |
| 403 | 权限不足 |
| 404 | 资源不存在 |
| 405 | HTTP方法不支持 |
| 409 | 资源冲突、版本冲突 |
| 412 | 前置条件不满足（如缺少Idempotency-Key） |
| 422 | 业务规则校验失败（Unprocessable Entity） |
| 429 | 请求频率限制 |
| 500 | 服务器内部错误 |
| 502 | 外部服务调用失败 |
| 503 | 服务不可用 |
| 504 | 外部服务调用超时 |

### 17.4 错误响应示例

```json
{
  "code": 42201,
  "message": "非法的状态转换: RANDOMIZED -> SCREENING",
  "data": {
    "currentStatus": "RANDOMIZED",
    "targetStatus": "SCREENING",
    "allowedTransitions": ["ACTIVE", "COMPLETED", "WITHDRAWN"]
  },
  "traceId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "timestamp": "2026-05-11T10:30:00.000+08:00"
}
```

### 17.5 全局异常处理器

```java
@RestControllerAdvice
public class GlobalExceptionHandler {

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ApiResponse<Void> handleValidation(MethodArgumentNotValidException ex) {
        String detail = ex.getBindingResult().getFieldErrors().stream()
            .map(e -> e.getField() + ": " + e.getDefaultMessage())
            .collect(Collectors.joining("; "));
        return ApiResponse.error(ErrorCode.VALIDATION_FAILED.format(detail));
    }

    @ExceptionHandler(BusinessException.class)
    public ApiResponse<Void> handleBusiness(BusinessException ex) {
        return ApiResponse.error(ex.getErrorCode().getCode(), ex.getMessage());
    }

    @ExceptionHandler(InvalidStatusTransitionException.class)
    public ApiResponse<Void> handleStatusTransition(InvalidStatusTransitionException ex) {
        return ApiResponse.error(
            ErrorCode.INVALID_STATUS_TRANSITION.getCode(),
            ErrorCode.INVALID_STATUS_TRANSITION.format(
                ex.getCurrentStatus(), ex.getTargetStatus()
            )
        );
    }

    @ExceptionHandler(IdempotencyKeyMissingException.class)
    public ApiResponse<Void> handleMissingIdempotencyKey() {
        return ApiResponse.error(ErrorCode.IDEMPOTENCY_KEY_MISSING);
    }

    @ExceptionHandler(AccessDeniedException.class)
    public ApiResponse<Void> handleAccessDenied() {
        return ApiResponse.error(ErrorCode.INSUFFICIENT_PERMISSIONS);
    }

    @ExceptionHandler(Exception.class)
    public ApiResponse<Void> handleUnknown(Exception ex) {
        log.error("未处理异常", ex);
        return ApiResponse.error(ErrorCode.INTERNAL_ERROR);
    }
}
```

---

## 18. Webhook/回调设计

### 18.1 Webhook注册机制

外部系统可注册Webhook以接收CTMS平台的事件通知。

**注册接口**: `POST /api/v1/integration/webhooks`

```json
{
  "name": "SAE Alert Webhook for PV System",
  "url": "https://pv.example.com/api/v1/webhooks/sae-alert",
  "events": ["SAE_CREATED", "SAE_ESCALATED", "SAE_REGULATORY_SUBMITTED"],
  "secret": "whsec_a1b2c3d4e5f6g7h8i9j0",
  "retryConfig": {
    "maxRetries": 3,
    "retryIntervalSeconds": 60,
    "backoffMultiplier": 2.0
  },
  "headers": {
    "X-Custom-Header": "custom-value"
  },
  "enabled": true,
  "description": "推送到Argus药物警戒系统"
}
```

### 18.2 Webhook事件类型

| 事件类型 | 触发时机 | 载荷包含 |
|----------|----------|----------|
| STUDY_STATUS_CHANGED | 试验状态变更 | studyId, oldStatus, newStatus, changedBy |
| SITE_STATUS_CHANGED | 中心状态变更 | siteId, studyId, oldStatus, newStatus |
| SITE_ACTIVATED | 中心启动完成 | siteId, studyId, activatedAt |
| SUBJECT_ENROLLED | 受试者入组 | subjectId, studyId, siteId, enrolledAt |
| SUBJECT_RANDOMIZED | 受试者随机化 | subjectId, treatmentGroup, randomizationNumber |
| SUBJECT_WITHDRAWN | 受试者退出 | subjectId, withdrawalReason |
| SUBJECT_COMPLETED | 受试者完成 | subjectId, completedAt |
| VISIT_DATA_SUBMITTED | 访视数据提交 | visitId, subjectId, formCount |
| VISIT_DATA_FROZEN | 访视数据冻结 | visitId, subjectId, frozenBy |
| AE_CREATED | AE创建 | aeId, subjectId, severity |
| AE_ESCALATED_TO_SAE | AE升级为SAE | aeId, saeId, seriousnessCriteria |
| SAE_CREATED | SAE创建 | saeId, subjectId, seriousnessCriteria |
| SAE_ESCALATED | SAE上报触发 | saeId, workflowId, reportingDeadline |
| SAE_REGULATORY_SUBMITTED | SAE法规递交完成 | saeId, authority, submissionId |
| QUERY_CREATED | 质疑创建 | queryId, subjectId, visitId |
| QUERY_RESPONDED | 质疑回复 | queryId, respondedBy |
| QUERY_CLOSED | 质疑关闭 | queryId, closedBy |
| DEVIATION_CREATED | 方案偏离创建 | deviationId, subjectId, severity |
| DEVIATION_ASSESSED | 方案偏离评估 | deviationId, assessmentResult |
| CAPA_CREATED | CAPA创建 | capaId, sourceIssueId |
| CAPA_APPROVED | CAPA审批 | capaId, approvedBy |
| MONITORING_VISIT_SCHEDULED | 监查访视排程 | monitoringVisitId, siteId, scheduledDate |
| MONITORING_REPORT_SUBMITTED | 监查报告提交 | monitoringVisitId, reportId |
| DOCUMENT_APPROVED | 文档审批通过 | documentId, versionId, approvedBy |
| DOCUMENT_REJECTED | 文档审批驳回 | documentId, versionId, rejectedBy |
| MILESTONE_COMPLETED | 里程碑完成 | milestoneId, studyId, completedAt |
| MILESTONE_OVERDUE | 里程碑逾期 | milestoneId, studyId, dueDate |
| PAYMENT_APPROVED | 付款审批通过 | paymentId, amount, currencyCode |
| CONTRACT_EXPIRING | 合同即将到期 | contractId, expiryDate, daysRemaining |
| DATA_RECONCILIATION_COMPLETED | 数据对账完成 | reconciliationTaskId, mismatchCount |
| EXPORT_COMPLETED | 导出任务完成 | exportTaskId, downloadUrl, expiresAt |
| OCR_COMPLETED | OCR处理完成 | ocrJobId, fileId, needsHumanReview |
| AI_REVIEW_COMPLETED | AI审查完成 | reviewId, entityType, entityId |

### 18.3 Webhook签名验证

所有Webhook请求携带3个安全Header：

| Header | 说明 |
|--------|------|
| X-Webhook-Signature | HMAC-SHA256签名，格式：`t=timestamp,v1=signature` |
| X-Webhook-Timestamp | Unix秒级时间戳 |
| X-Webhook-Event | 事件类型 |

**签名算法:**
```
signedPayload = timestamp + "." + jsonBody
signature = HMAC-SHA256(sharedSecret, signedPayload)
X-Webhook-Signature = "t=" + timestamp + ",v1=" + signature
```

### 18.4 Webhook重试策略

| 配置项 | 默认值 | 说明 |
|--------|--------|------|
| maxRetries | 3 | 最大重试次数 |
| retryIntervalSeconds | 60 | 初始重试间隔 |
| backoffMultiplier | 2.0 | 退避倍数（60s -> 120s -> 240s） |
| timeoutSeconds | 10 | 单次请求超时时间 |
| successHttpCodes | [200, 201, 204] | 视为成功的HTTP状态码 |
| disableAfterFailures | 10 | 连续失败N次后自动停用 |

### 18.5 OCR/AI回调认证

AI服务回调使用API Key + 签名双重认证：

```
POST /api/v1/ocr/callback
Headers:
  Authorization: Bearer <API_KEY>
  X-Callback-Signature: HMAC-SHA256(payload, sharedSecret)
  X-Callback-Timestamp: 1699999999000
  Idempotency-Key: uuid-v4
```

---

## 19. 文件上传流程

### 19.1 完整文件上传时序

```
Client                  CTMS Server              Object Storage (S3/MinIO)
  |                         |                            |
  |--(1) POST /files/upload-url ------------------------>|
  |     FileUploadUrlRequestDTO                           |
  |                         |                            |
  |<-(2) ApiResponse<FileUploadUrlVO> -------------------|
  |     { fileId, uploadUrl, uploadMethod, headers }      |
  |                         |                            |
  |--(3) PUT {uploadUrl} ------------------------------->|
  |     (with uploadHeaders)                              |
  |                         |                            |
  |<-(4) HTTP 200 OK ------------------------------------|
  |                         |                            |
  |--(5) POST /files/upload-confirm ------------------->|
  |     FileUploadConfirmDTO                              |
  |                         |                            |
  |                         |--(6) Verify file integrity--|
  |                         |    (SHA256 checksum check)  |
  |                         |--(7) Virus scan ----------|
  |                         |--(8) Create File record ---|
  |                         |                            |
  |<-(9) ApiResponse<FileVO> ---------------------------|
  |                         |                            |
```

### 19.2 上传完整流程说明

1. **获取预签名URL** (`POST /api/v1/files/upload-url`)
   - 客户端提供文件名、大小、类型、SHA256校验和
   - 服务端校验文件类型是否允许、大小是否超限
   - 服务端生成预签名PUT URL（有效期15分钟）
   - 返回URL和必需的上传Header

2. **客户端直接上传** (`PUT {uploadUrl}`)
   - 客户端使用预签名URL直接上传文件到对象存储
   - 携带Content-Type和x-amz-meta-checksum-sha256头
   - 此步骤不经过CTMS服务器

3. **确认上传完成** (`POST /api/v1/files/upload-confirm`)
   - 客户端通知服务端上传已完成
   - 服务端校验文件是否存在、大小是否匹配、SHA256是否一致
   - 服务端执行病毒扫描（如已配置）
   - 服务端创建File数据库记录，状态设为 ACTIVE
   - 返回文件元信息

4. **后续可选操作**
   - OCR识别：`POST /api/v1/files/{fileId}/ocr`
   - 获取预览URL：`GET /api/v1/files/{fileId}/preview-url`
   - 获取下载URL：`POST /api/v1/files/download-url`

### 19.3 文件状态枚举

| 状态 | 说明 |
|------|------|
| PENDING_UPLOAD | 已生成上传URL，等待客户端上传 |
| UPLOADING | 客户端正在上传 |
| UPLOADED | 上传完成，等待服务端确认 |
| ACTIVE | 确认完成，可正常使用 |
| PROCESSING | 处理中（如OCR、病毒扫描） |
| ARCHIVED | 已归档（关联实体删除后） |
| DELETED | 已删除 |
| FAILED | 上传或处理失败 |

### 19.4 支持的文件类型

| MIME Type | 扩展名 | 最大大小 | 说明 |
|-----------|--------|----------|------|
| application/pdf | .pdf | 100MB | PDF文档 |
| image/png | .png | 50MB | PNG图片 |
| image/jpeg | .jpg, .jpeg | 50MB | JPEG图片 |
| application/dicom | .dcm | 200MB | DICOM医学影像 |
| application/vnd.openxmlformats-officedocument.spreadsheetml.sheet | .xlsx | 50MB | Excel文件 |
| application/vnd.openxmlformats-officedocument.wordprocessingml.document | .docx | 50MB | Word文件 |
| text/csv | .csv | 50MB | CSV文件 |
| application/zip | .zip | 200MB | ZIP压缩包 |
| application/xml | .xml | 20MB | XML文件（如E2B报告） |

### 19.5 存储路径规范

```
{bucket}/{environment}/{entityType}/{entityId}/{fileId}/{fileId}.{ext}

示例:
ctms-prod/subject/10086/file-uuid-abc/file-uuid-abc.pdf
ctms-prod/sae/20001/file-uuid-xyz/file-uuid-xyz.xml
```

---

## 20. 异步任务轮询模式

### 20.1 异步任务类型

| 任务类型 | 说明 | 预估耗时 |
|----------|------|----------|
| EXPORT | 数据导出 | 10秒-5分钟 |
| IMPORT | 数据导入 | 30秒-30分钟 |
| OCR | OCR识别 | 30秒-5分钟 |
| REPORT_GENERATION | 报表生成 | 30秒-10分钟 |
| RECONCILIATION | 数据对账 | 1分钟-30分钟 |
| AI_REVIEW | AI审查 | 30秒-5分钟 |
| BATCH_OPERATION | 批量操作 | 10秒-10分钟 |

### 20.2 异步任务状态机

```
PENDING -> PROCESSING -> COMPLETED
  |           |             |
  |           |          FAILED (含错误信息)
  |           |
  |        CANCELLED (用户取消)
  |
CANCELLED (用户取消)
```

### 20.3 任务轮询模式

**步骤1: 触发异步任务**

```
POST /api/v1/reports/exports
Request:
{
  "exportType": "SUBJECT_DATA_EXPORT",
  "format": "XLSX",
  "studyId": 1001
}
Response (HTTP 200):
{
  "code": 200,
  "data": {
    "taskId": "task-abc-12345",
    "taskType": "EXPORT",
    "status": "PENDING",
    "estimatedCompletionTime": "2026-05-11T10:35:00.000+08:00",
    "pollingEndpoint": "/api/v1/reports/exports/task-abc-12345/status",
    "pollingIntervalSeconds": 5
  }
}
```

**步骤2: 轮询任务状态**

```
GET /api/v1/reports/exports/task-abc-12345/status
Response (HTTP 200):
{
  "code": 200,
  "data": {
    "taskId": "task-abc-12345",
    "status": "PROCESSING",
    "progress": 45,
    "progressMessage": "正在处理中心数据: 2001 北京协和医院 (3/5)",
    "estimatedCompletionTime": "2026-05-11T10:35:00.000+08:00"
  }
}
```

**步骤3: 获取完成结果**

```
GET /api/v1/reports/exports/task-abc-12345/status
Response (HTTP 200):
{
  "code": 200,
  "data": {
    "taskId": "task-abc-12345",
    "status": "COMPLETED",
    "progress": 100,
    "result": {
      "downloadUrl": "https://storage.ctms.com/exports/task-abc-12345/subject-data-export.xlsx?X-Amz-...",
      "fileName": "subject-data-export-20260511.xlsx",
      "fileSize": 2048576,
      "expiresAt": "2026-05-11T11:35:00.000+08:00",
      "rowCount": 156,
      "generatedAt": "2026-05-11T10:34:30.000+08:00"
    }
  }
}
```

### 20.4 轮询最佳实践

```javascript
// 前端轮询示例
async function pollTaskStatus(taskId, endpoint, intervalMs = 5000) {
  while (true) {
    const response = await fetch(endpoint + '/' + taskId + '/status');
    const result = await response.json();

    if (result.data.status === 'COMPLETED') {
      return result.data.result;
    }

    if (result.data.status === 'FAILED') {
      throw new Error(result.data.errorMessage);
    }

    if (result.data.status === 'CANCELLED') {
      throw new Error('任务被取消');
    }

    // 显示进度
    updateProgress(result.data.progress, result.data.progressMessage);

    // 等待建议间隔后再轮询
    await new Promise(resolve => setTimeout(resolve, intervalMs));
  }
}
```

### 20.5 后端异步任务实现模式

```java
@Service
public class ExportTaskService {

    @Async("exportTaskExecutor")
    public void executeExport(String taskId, ExportRequestDTO request) {
        try {
            // 1. 更新任务状态为 PROCESSING
            updateTaskStatus(taskId, AsyncTaskStatus.PROCESSING);

            // 2. 执行导出逻辑（支持进度回调）
            ExportResult result = exportEngine.export(request, progress -> {
                updateTaskProgress(taskId, progress.getPercentage(),
                    progress.getMessage());
            });

            // 3. 上传到对象存储
            String downloadUrl = fileStorage.upload(
                result.getFileName(),
                result.getData(),
                result.getContentType()
            );

            // 4. 更新任务状态为 COMPLETED
            completeTask(taskId, downloadUrl, result);

            // 5. 发送通知
            notificationService.notifyTaskCompleted(request.getUserId(), taskId);

        } catch (Exception e) {
            log.error("导出任务失败: taskId={}", taskId, e);
            failTask(taskId, e.getMessage());
        }
    }
}
```

---

## 21. 批量导入设计

### 21.1 批量导入流程

```
用户                 CTMS Server              异步处理器
 |                      |                         |
 |-(1) POST /subjects/batch-import -------------->|
 |    (multipart/form-data: file + studyId)        |
 |                      |--(2) Validate file ------|
 |                      |--(3) Create async task --|
 |<-(4) AsyncTaskVO -------------------------------|
 |                      |                         |
 |                      |--(5) Parse Excel/CSV --->|
 |                      |                         |--(6) Row-by-row validation
 |                      |                         |--(7) Check duplicates
 |                      |                         |--(8) Check references
 |                      |                         |--(9) Generate preview
 |                      |<-(10) Task COMPLETED ----|
 |                         (with preview result)   |
 |                                                 |
 |-(11) GET /subjects/batch-import/{taskId}/result->|
 |<-(12) BatchImportResultVO ----------------------|
 |                                                 |
 |-(13) POST /subjects/batch-import/{taskId}/confirm->|
 |                      |--(14) Validate ----------|
 |                      |--(15) Create async task for actual import --->|
 |                      |                         |--(16) Batch insert rows
 |                      |                         |--(17) Post-import actions
 |<-(18) AsyncTaskVO (for actual import) ---------|
 |                                                 |
 |-(19) Poll import status ------------------------>|
 |<-(20) Import completed -------------------------|
```

### 21.2 批量导入请求

```
POST /api/v1/subjects/batch-import
Content-Type: multipart/form-data

Parts:
  - file: Excel/CSV file
  - studyId: 1001 (Long)
  - siteId: 2001 (Long, optional)
  - importMode: "VALIDATE_ONLY" / "VALIDATE_AND_IMPORT" / "UPSERT" (String)
  - duplicateHandling: "SKIP" / "OVERWRITE" / "ERROR" (String)
```

### 21.3 批量导入结果结构

```json
{
  "taskId": "import-task-abc-123",
  "status": "PENDING_CONFIRMATION",
  "summary": {
    "totalRows": 150,
    "validRows": 142,
    "errorRows": 5,
    "warningRows": 3,
    "duplicateRows": 2,
    "newRows": 140
  },
  "errors": [
    {
      "row": 15,
      "field": "birthDate",
      "value": "2050-13-45",
      "message": "日期格式无效，期望 yyyy-MM-dd"
    },
    {
      "row": 23,
      "field": "screeningDate",
      "value": "2020-01-01",
      "message": "筛选日期早于试验开始日期 2025-01-01"
    }
  ],
  "warnings": [
    {
      "row": 8,
      "field": "age",
      "value": "85",
      "message": "年龄 85 岁在通常试验范围之外，请确认"
    }
  ],
  "duplicates": [
    {
      "row": 42,
      "existingSubjectNumber": "SUB-2026-00001",
      "existingSubjectId": 10001,
      "matchFields": ["medicalRecordNo"]
    }
  ],
  "preview": {
    "firstTenRows": [],
    "columnMapping": {
      "A": "subjectNumber",
      "B": "name",
      "C": "gender",
      "D": "birthDate",
      "E": "screeningDate"
    }
  },
  "downloadErrorReportUrl": "https://storage.ctms.com/imports/task-abc-123/error-report.xlsx"
}
```

### 21.4 支持的批量导入场景

| 实体 | 导入接口 | 支持的文件格式 | 最大行数 |
|------|----------|----------------|----------|
| 受试者 | POST /api/v1/subjects/batch-import | XLSX, CSV | 5000 |
| 中心 | POST /api/v1/sites/batch-import | XLSX, CSV | 1000 |
| 研究者 | POST /api/v1/investigators/batch-import | XLSX, CSV | 1000 |
| 观察值 | POST /api/v1/observations/batch-import | XLSX, CSV | 10000 |
| AE | POST /api/v1/aes/batch-import | XLSX, CSV | 2000 |
| 合并用药 | POST /api/v1/concomitant-medications/batch-import | XLSX, CSV | 5000 |
| 访视数据 | POST /api/v1/visit-data/batch-import | XLSX, CSV | 10000 |
| 字典项 | POST /api/v1/dict/import | XLSX | 5000 |

### 21.5 批量导入Excel模板规范

- **Sheet 1**: 数据行（第一行为列头）
- **Sheet 2**: 列说明（可选，包含字段说明、必填标记、枚举值等）
- **必填列**: 表头加 `*` 前缀标记，如 `*subjectNumber`
- **枚举列**: 使用下拉验证（Data Validation）
- **日期列**: 统一格式 `yyyy-MM-dd`
- **时间列**: 统一格式 `yyyy-MM-dd HH:mm:ss`
- **错误报告**: 在原始文件右侧追加错误列（`_error_` 前缀）

---

## 22. 限流策略

### 22.1 限流层级

```
网络层 (WAF/API Gateway)
  |
  +-- 全局限流: 整个平台 10,000 请求/秒
  |
  +-- IP级别限流: 单个IP 100 请求/秒
       |
       +-- 用户级别限流: 单个用户 50 请求/秒
            |
            +-- 接口级别限流: 特定接口差异化限制
                 |
                 +-- 租户级别限流: 特定申办方/组织
```

### 22.2 接口级别限流配置

| 接口模式 | 限制 | 时间窗口 | 说明 |
|----------|------|----------|------|
| /api/v1/auth/login | 5次 | 1分钟 | 登录接口防暴力破解 |
| /api/v1/auth/login | 20次 | 1小时 | 登录接口IP级别 |
| /api/v1/files/upload-url | 50次 | 1分钟 | 文件上传URL生成 |
| /api/v1/files/download-url | 100次 | 1分钟 | 文件下载URL生成 |
| POST /api/v1/subjects/batch-import | 5次 | 10分钟 | 批量导入 |
| POST /api/v1/*/export | 3次 | 1分钟 | 异步导出（并发任务数） |
| GET /api/v1/dashboard/* | 30次 | 1分钟 | 仪表盘查询（数据密集） |
| POST /api/v1/ocr/jobs | 20次 | 1分钟 | OCR任务创建 |
| POST /api/v1/ai/copilot/query | 30次 | 1分钟 | AI助手查询 |
| POST /api/v1/ocr/callback | 无限制 | - | AI回调（不限制） |
| GET /api/v1/dict/types/*/items | 200次 | 1分钟 | 字典查询（高频） |
| 其他GET接口 | 200次 | 1分钟 | 默认读限流 |
| 其他POST/PUT/DELETE | 60次 | 1分钟 | 默认写限流 |

### 22.3 限流响应

```http
HTTP/1.1 429 Too Many Requests
X-RateLimit-Limit: 50
X-RateLimit-Remaining: 0
X-RateLimit-Reset: 1699999960
Retry-After: 12
Content-Type: application/json

{
  "code": 42900,
  "message": "请求过于频繁，请稍后重试",
  "data": {
    "limit": 50,
    "remaining": 0,
    "resetAt": "2026-05-11T10:30:12.000+08:00",
    "retryAfterSeconds": 12,
    "windowSeconds": 60
  },
  "traceId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "timestamp": "2026-05-11T10:30:00.000+08:00"
}
```

### 22.4 限流实现方案

```java
@Component
public class RateLimitInterceptor implements HandlerInterceptor {

    private final RedissonClient redissonClient;

    @Override
    public boolean preHandle(HttpServletRequest request,
                            HttpServletResponse response,
                            Object handler) throws Exception {

        // 获取限流配置
        RateLimitConfig config = getRateLimitConfig(request);
        if (config == null) {
            return true; // 无限流配置
        }

        // 构建限流Key
        String key = buildRateLimitKey(request, config);
        long windowSeconds = config.getWindowSeconds();
        long limit = config.getLimit();

        // Redis 滑动窗口限流
        RRateLimiter limiter = redissonClient.getRateLimiter(key);
        limiter.trySetRate(RateType.OVERALL, limit,
            Duration.ofSeconds(windowSeconds));

        if (limiter.tryAcquire()) {
            // 设置响应头
            response.setHeader("X-RateLimit-Limit", String.valueOf(limit));
            return true;
        } else {
            // 限流触发
            response.setStatus(429);
            response.setHeader("Retry-After",
                String.valueOf(windowSeconds));
            response.setContentType("application/json;charset=UTF-8");

            ApiResponse<Void> errorResp = ApiResponse.error(
                ErrorCode.TOO_MANY_REQUESTS
            );
            response.getWriter().write(
                objectMapper.writeValueAsString(errorResp)
            );
            return false;
        }
    }

    private String buildRateLimitKey(HttpServletRequest request,
                                      RateLimitConfig config) {
        // key格式: ratelimit:{userId}:{pathPattern}
        String userId = SecurityUtils.getCurrentUserId();
        String path = request.getRequestURI();
        return String.format("ratelimit:%s:%s", userId,
            config.getKeyPattern());
    }
}
```

### 22.5 分布式限流配置（application.yml）

```yaml
app:
  rate-limit:
    enabled: true
    default-read-limit: 200
    default-write-limit: 60
    default-window-seconds: 60
    rules:
      - pathPattern: "/api/v1/auth/login"
        methods: POST
        limit: 5
        windowSeconds: 60
        type: IP
      - pathPattern: "/api/v1/auth/login"
        methods: POST
        limit: 20
        windowSeconds: 3600
        type: IP
      - pathPattern: "/api/v1/files/upload-url"
        methods: POST
        limit: 50
        windowSeconds: 60
      - pathPattern: "/api/v1/dashboard/**"
        methods: GET
        limit: 30
        windowSeconds: 60
      - pathPattern: "/api/v1/*/export"
        methods: POST
        limit: 3
        windowSeconds: 60
      - pathPattern: "/api/v1/ocr/callback"
        methods: POST
        limit: 0
        windowSeconds: 1
        unlimited: true
```

### 22.6 令牌桶 vs 滑动窗口

| 方案 | 优点 | 缺点 | 适用场景 |
|------|------|------|----------|
| 令牌桶 (Token Bucket) | 允许短时突发流量 | 实现稍复杂 | API网关层级 |
| 滑动窗口 (Sliding Window) | 精确控制、实现简单 | 不允许突发 | 接口级别精确限流 |
| 固定窗口 (Fixed Window) | 最简单 | 边界突发问题 | 不推荐（已使用滑动窗口替代） |

本平台使用 **滑动窗口**（基于Redis Sorted Set）作为默认算法，登录接口额外叠加 **令牌桶** 用于防暴力破解。

---

## 附录A: API端点统计总表

| 模块 | Controller | 端点数 | Base Path |
|------|------------|--------|-----------|
| 试验管理 | StudyController | 23 | /api/v1/studies |
| 中心管理 | SiteController | 15 | /api/v1/sites |
| 研究者管理 | InvestigatorController | 10 | /api/v1/investigators |
| 受试者管理 | SubjectController | 26 | /api/v1/subjects |
| 访视管理 | VisitController | 14 | /api/v1/visits |
| 访视模板 | VisitTemplateController | 8 | /api/v1/visit-templates |
| 观察项 | ObservationController | 4 | /api/v1/observations |
| 问卷 | QuestionnaireController | 6 | /api/v1/questionnaires |
| 问卷作答 | QuestionnaireResponseController | 5 | /api/v1/questionnaire-responses |
| 监查管理 | MonitoringController | 22 | /api/v1/monitoring |
| 质疑管理 | QueryController | 10 | /api/v1/queries |
| 问题管理 | IssueController | 7 | /api/v1/issues |
| 方案偏离 | DeviationController | 6 | /api/v1/deviations |
| CAPA | CapaController | 7 | /api/v1/capas |
| 不良事件 | AeController | 12 | /api/v1/aes |
| 严重不良事件 | SaeController | 14 | /api/v1/saes |
| 文档管理 | DocumentController | 15 | /api/v1/documents |
| 文件操作 | FileController | 8 | /api/v1/files |
| 预算管理 | BudgetController | 6 | /api/v1/budgets |
| 合同管理 | ContractController | 7 | /api/v1/contracts |
| 付款管理 | PaymentController | 6 | /api/v1/payments |
| 报销管理 | ReimbursementController | 6 | /api/v1/reimbursements |
| 发票管理 | InvoiceController | 5 | /api/v1/invoices |
| 通知管理 | NotificationController | 12 | /api/v1/notifications |
| 仪表盘 | DashboardController | 15 | /api/v1/dashboard |
| 报表管理 | ReportController | 10 | /api/v1/reports |
| 用户管理 | UserController | 10 | /api/v1/users |
| 角色管理 | RoleController | 6 | /api/v1/roles |
| 字典管理 | DictController | 7 | /api/v1/dict |
| 系统设置 | SystemController | 7 | /api/v1/system |
| 审计日志 | AuditLogController | 4 | /api/v1/audit-logs |
| 集成管理 | IntegrationController | 18 | /api/v1/integration |
| OCR管理 | OcrController | 12 | /api/v1/ocr |
| AI功能 | AIController | 13 | /api/v1/ai |
| **合计** | **35 Controllers** | **365** | - |

---

## 附录B: 关键状态机汇总

### B.1 试验状态
```
DRAFT -> STARTUP -> ENROLLING -> FOLLOWUP -> LOCKED -> ARCHIVED
  |        |          |           |         |
  +--------+----------+-----------+---------+--> CANCELLED
```

### B.2 中心状态
```
FEASIBILITY -> SITE_SELECTION_VISIT -> REGULATORY_SUBMISSION
  -> SITE_INITIATION -> ACTIVATED -> ENROLLING
  -> ENROLLMENT_COMPLETE -> CLOSE_OUT -> CLOSED

  任意激活状态 -> TERMINATED
```

### B.3 受试者状态
```
PRE_SCREENING -> SCREENING -> SCREEN_FAILED
                  |
              ENROLLED -> RANDOMIZED -> ACTIVE -> COMPLETED
                  |           |          |
              WITHDRAWN  WITHDRAWN  WITHDRAWN
                  |           |          |
              LOST_TO_FOLLOWUP (任意激活状态)
```

### B.4 访视状态
```
SCHEDULED -> IN_PROGRESS -> COMPLETED
  |             |              |
  |         MISSED         FROZEN
  |             |
  +-------- SKIPPED
```

### B.5 质疑状态
```
OPEN -> IN_REVIEW -> RESPONDED -> ANSWERED -> CLOSED
  |        |           |
  +--------+-----------+--> CANCELLED
                             |
                          REOPENED -> IN_REVIEW -> ...
```

### B.6 AE状态
```
OPEN -> UNDER_INVESTIGATION -> FOLLOWUP -> RESOLVED -> CLOSED
                                     |
                                  UPGRADED_TO_SAE (触发SAE创建工作流)
```

### B.7 SAE状态
```
OPEN -> UNDER_INVESTIGATION -> FOLLOWUP -> RESOLVED -> CLOSED
  |
  +--> REGULATORY_SUBMISSION_IN_PROGRESS -> SUBMITTED -> CLOSED
```

### B.8 文档状态
```
DRAFT -> SUBMITTED -> UNDER_REVIEW -> APPROVED / REJECTED
  |                      |
  |                  PENDING_INFO
  +--> OBSOLETE (文件过时)
```

### B.9 异步任务状态
```
PENDING -> PROCESSING -> COMPLETED
              |             |
          CANCELLED      FAILED
```

---

## 附录C: 安全设计要点

### C.1 认证与授权

- JWT Token有效期：Access Token 2小时，Refresh Token 7天
- 密码策略：最少8位，包含大小写字母、数字、特殊字符
- 登录失败锁定：连续5次失败锁定15分钟
- 闲置会话超时：30分钟自动过期
- 并发会话限制：同一账号最多3个并发会话

### C.2 数据安全

- PII数据：加密存储（AES-256-GCM），列级加密
- 数据传输：TLS 1.3（不允许降级）
- 数据库连接：TLS 1.2+
- API签名：HMAC-SHA256回调验证
- 审计日志：不可篡改（append-only，写入后禁止删除/修改）
- 敏感操作二次认证：揭盲、批量导出PII、数据库锁定

### C.3 合规性

- 21 CFR Part 11: 电子签名、审计轨迹
- GCP E6(R2): 数据完整性、可溯源
- GDPR: PII数据脱敏、数据删除权
- HIPAA: 受保护健康信息保护
- 个人信息保护法: 数据本地化、跨境传输管控

### C.4 渗透防护

- SQL注入防护：MyBatis Plus参数化查询
- XSS防护：输出编码 + CSP头
- CSRF防护：SameSite Cookie + CSRF Token
- 文件上传安全：类型白名单、病毒扫描、大小限制
- API限流：防止DDoS
- 日志脱敏：敏感字段（密码、Token、身份证号）自动脱敏

---

> **文档结束** - CTMS/PMS 平台 REST API 设计文档 (Round 3)
> **总端点数**: 365
> **Controllers**: 35
> **错误码**: 80+
> **技术栈**: Java 21 + Spring Boot 3 + Spring Web MVC + Springdoc OpenAPI + MyBatis Plus
