# Round 2: 模块详细设计 — Patient MiniApp & Data Integration Hub

> **Document Type:** Module Detailed Design
> **Version:** 1.0
> **Date:** 2026-05-11
> **Tech Stack:** Java 21 + Spring Boot 3 + MyBatis Plus + Flowable | Taro + React + TypeScript (WeChat Mini Program) | Python + FastAPI + PaddleOCR/PaddleX | PostgreSQL (UUIDv7 PKs) | RabbitMQ | Redis | OpenSearch | MinIO

---

# PART A: Patient MiniApp Modules (P01-P12)

---

### P01: 招募与预筛 Recruitment & Pre-screening

**模块目标:** Provide a WeChat Mini Program entry point for potential subjects to learn about the study, self-assess eligibility through a structured pre-screening questionnaire, and have their lead automatically created in the system for CRC follow-up.

**子功能清单:**

| 序号 | 子功能 | 描述 | 关键操作 |
|------|--------|------|----------|
| P01-01 | 研究列表与搜索 | Display active recruiting studies with keyword search and filtering by disease area, location, compensation | 浏览研究列表、关键词搜索、按条件筛选、研究详情查看 |
| P01-02 | 研究详情展示 | Present study summary, inclusion/exclusion criteria (layman language), visit schedule overview, compensation info, site locations | 阅读研究简介、查看入排标准、了解访视安排、查看补偿方案 |
| P01-03 | 预筛问卷 | Adaptive questionnaire based on protocol I/E criteria; questions presented one at a time with progress bar; branching logic for skip patterns | 填写预筛问卷、自适应跳题、暂存草稿、提交问卷 |
| P01-04 | 即时资格判定 | Auto-evaluate responses against protocol eligibility rules; return one of: eligible / ineligible / need_manual_review | 即时判定、不合格原因展示、待人工审核通知 |
| P01-05 | Lead 创建 | On eligibility check pass, create Subject record with status=lead in PostgreSQL; assign to site based on patient location preference | Lead 创建、自动分配中心、通知 CRC |
| P01-06 | 扫码招募 | QR code on recruitment poster links to specific study pre-screening; clinic-based kiosk mode | 扫码进入、海报溯源统计、渠道追踪 |

**核心交互流程:**

1. Patient opens MiniApp via WeChat search or scans recruitment QR code; system logs channel_source for attribution tracking.
2. Patient browses study list (GET /api/v1/studies?status=RECRUITING), applies filters; selects a study to view detail page.
3. Patient taps "预筛自评" button; system creates a draft QuestionnaireResponse linked to a pre-screening QuestionnaireTemplate.
4. Patient answers questions one at a time; the MiniApp renders question types (single-choice, multi-choice, yes/no) using a dynamic component switch based on questionType field. Branching logic evaluated client-side against a questionRule JSON (e.g., `{"if": {"q3": "yes"}, "then": "skip_to_q6"}`).
5. On final submit, client sends complete response payload (POST /api/v1/pre-screening/evaluate); server-side evaluates eligibility by running configured RuleEngine against protocol I/E criteria stored in JSONB column `eligibility_rules` on the Study entity.
6. Rule engine returns EligibilityResult {status: ELIGIBLE | INELIGIBLE | NEED_MANUAL_REVIEW, reasons: [...], confidence: 0.95}.
7. If eligible: server creates Subject record (id=UUIDv7, status=LEAD, study_id, subject_identifier auto-generated as site_prefix + sequence), inserts AuditLog (action=SUBJECT_CREATED), publishes event to RabbitMQ exchange `pms.subject.lead.created` for CRC notification.
8. MiniApp displays result page with next steps: "我们将为您匹配最近的临床中心，研究协调员将在2个工作日内与您联系。"
9. If ineligible: display specific reasons in plain language, suggest alternative studies (GET /api/v1/studies/alternative?exclude={studyId}).
10. DMA/CRC receives notification via internal PMS system; reviews lead; can transition status to PRESCREENED after phone contact.

**核心字段:**

| 字段 | 类型 | 说明 |
|------|------|------|
| subject_id | UUID (UUIDv7) | Primary key, time-sortable |
| study_id | UUID | FK to Study |
| status | VARCHAR(50) | lead → prescreened → consented → ... |
| subject_identifier | VARCHAR(50) | Human-readable ID, e.g., "SITE01-0012" |
| channel_source | VARCHAR(100) | Acquisition channel: qr_code, search, share, poster |
| pre_screening_response_id | UUID | FK to QuestionnaireResponse |
| eligibility_result | JSONB | {status, reasons, rule_matches, evaluated_at} |
| preferred_site_id | UUID | Patient's preferred site |
| lead_score | DECIMAL(3,2) | 0.00-1.00, for prioritization |
| created_at | TIMESTAMPTZ | UTC |
| deleted_at | TIMESTAMPTZ | Soft delete |

**异常场景:**

| 场景 | 处理方式 |
|------|----------|
| 预筛过程中小程序被关闭 | 草稿已自动保存到服务器（每30秒），下次打开时提示恢复草稿 |
| 问卷模板已更新（新版本发布） | 检查 version 字段，若更新则提示重新开始，旧草稿标记为 stale |
| 同一患者重复提交预筛 | 基于 WeChat unionId 去重；如已存在 lead 或 subject，提示"您已参与过该研究" |
| 网络中断导致提交失败 | 本地缓存完整响应；网络恢复后自动重试，最多3次；超限后提示手动重试 |
| 规则引擎返回 NEED_MANUAL_REVIEW | 标记为待审核，通知 CRC 手工判断；患者端显示"我们正在审核，请耐心等待" |
| 扫码参数非法/过期 | 显示友好提示，跳转到研究列表页 |
| 并发预筛导致同一 subject 重复创建 | 数据库 unique constraint on (wechat_union_id, study_id, deleted_at) 防止重复 |

**权限/授权要求:**

- Patient (self): Can browse studies, fill pre-screening, view own eligibility result
- Caregiver (proxy): Can browse and pre-screen on behalf of patient (proxy mode, see P03)
- CRC (backend): Can view leads, trigger manual review, transition status
- Anonymous: Can browse study public info; must WeChat-login to submit pre-screening

**关联数据实体:** Subject, Study, QuestionnaireTemplate, QuestionnaireResponse, RuleEngine, AuditLog, Notification

**关联 REST API:**

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api/v1/studies | 获取可招募的研究列表（分页+筛选） |
| GET | /api/v1/studies/{studyId} | 获取研究详情（含入排标准） |
| GET | /api/v1/pre-screening/{studyId}/questionnaire | 获取预筛问卷 template |
| POST | /api/v1/pre-screening/{studyId}/draft | 保存预筛草稿 |
| POST | /api/v1/pre-screening/{studyId}/evaluate | 提交预筛并获取资格判定 |
| GET | /api/v1/subjects/{subjectId}/eligibility | 获取当前资格状态 |

---

### P02: 电子知情同意 eConsent

**模块目标:** Enable patients to review study consent documents in a multi-page, digestible format, complete a comprehension quiz, provide legally valid electronic signature, and maintain a tamper-proof consent version history with support for re-consent workflows.

**子功能清单:**

| 序号 | 子功能 | 描述 | 关键操作 |
|------|--------|------|----------|
| P02-01 | 知情同意书浏览 | Multi-page consent document rendered in scrollable MiniApp format; section navigation jump; font size adjustment; text-to-speech (optional) | 分页阅读、章节跳转、字号调节、语音朗读 |
| P02-02 | 理解度测验 | Optional/required multiple-choice quiz to confirm key points understood; configurable pass threshold; wrong answer explanation | 答题测验、错题解析、补考机制、通过确认 |
| P02-03 | 电子签名 | Canvas-based signature capture on WeChat Mini Program; signature rendered as PNG; timestamp and IP logging | 手写签名、签名预览、重新签名、撤销 |
| P02-04 | 知情同意书签署记录 | Create ConsentRecord with signature image, timestamp, IP, WeChat user info; link to specific ConsentVersion | 签署记录创建、版本绑定、审计日志 |
| P02-05 | 知情同意书版本管理 | Track ConsentVersion changes; display diff to patient on re-consent; maintain version chain | 版本历史查看、版本对比、更新通知 |
| P02-06 | 再知情通知 | Push re-consent notification when protocol amendment triggers new ConsentVersion; show what changed | 再知情推送、变更摘要、签署提醒 |
| P02-07 | 知情同意书副本下载 | Generate signed PDF copy with signature embedded; watermark with patient ID and date; share/export | PDF 生成、签名嵌入、水印、下载分享 |

**核心交互流程:**

1. CRC transitions Subject status from PRESCREENED to CONSENTED via internal system; system creates a ConsentTemplate with linked ConsentVersion (version=1.0, status=ACTIVE).
2. Patient receives WeChat template message: "请在48小时内完成知情同意书签署" with deep-link to eConsent page.
3. Patient taps notification → MiniApp opens consent document (GET /api/v1/consents/{subjectId}/current-version). MiniApp renders document pages using rich text component, with section index sidebar (collapsible).
4. Minimum reading time configured per section (e.g., 30s per section × 8 sections = 4 min); progress tracked client-side; "我已阅读" checkbox per section only activates after minimum time + scroll-to-bottom.
5. After all sections marked read, comprehension quiz (if configured) appears: N questions randomly drawn from pool; must score >= pass_threshold to proceed; failed quiz triggers wrong-answer review and retake (max 3 attempts, then lock with CRC notification).
6. Patient passes quiz → signature page. WeChat Canvas component activated; patient draws signature with finger; clear button resets canvas; confirm captures PNG to temporary file path.
7. Submit flow: POST /api/v1/consents/{subjectId}/sign with signature image (base64), device fingerprint, geo-location (if consented to share). Server-side:
   - Validates ConsentVersion is still ACTIVE
   - Checks no duplicate active ConsentRecord for this subject+version
   - Creates ConsentRecord {id, subject_id, consent_version_id, signature_image_url, signed_at, wechat_openid, ip_address, device_info}
   - Uploads signature to MinIO bucket `pms-consent-signatures/{subject_id}/{consent_record_id}.png`
   - Generates signed PDF via async job: Java calls headless browser render → saves PDF to MinIO `pms-consent-documents/{subject_id}/signed_{version}.pdf`
   - Publishes ConsentSigned event to RabbitMQ
   - Inserts AuditLog
8. After successful signing, MiniApp displays confirmation page with "下载知情同意书副本" button. PDF download via GET /api/v1/consents/{consentRecordId}/pdf → presigned MinIO URL (15 min expiry).

**Re-consent Flow:**

9. When protocol amendment creates new ConsentVersion (version=2.0, status=ACTIVE; previous version status=SUPERSEDED):
   - RabbitMQ event triggers NotificationService to send WeChat template message to all active subjects
   - Patient opens notification → re-consent page showing diff between v1.0 and v2.0 (highlighted changes in red/green text)
   - Same quiz + signature flow as above; new ConsentRecord linked to ConsentVersion v2.0
   - Subject's consent_status updated to RECONSENT_REQUIRED → ACTIVE after signing

**核心字段:**

| 字段 | 类型 | 说明 |
|------|------|------|
| consent_template_id | UUID (UUIDv7) | PK for ConsentTemplate |
| consent_version_id | UUID (UUIDv7) | PK for ConsentVersion |
| consent_record_id | UUID (UUIDv7) | PK for ConsentRecord |
| study_id | UUID | FK to Study |
| version_number | VARCHAR(20) | e.g., "1.0", "1.1", "2.0" |
| status (version) | VARCHAR(30) | draft → active → superseded / revoked |
| content_markdown | TEXT | Consent document content in Markdown |
| content_sections | JSONB | Array of {section_title, body_html, min_reading_seconds} |
| quiz_config | JSONB | {enabled, pass_threshold, max_attempts, question_pool_size, questions: [{id, text, options, correct_answer, explanation}]} |
| signature_image_url | VARCHAR(500) | MinIO presigned URL |
| signed_at | TIMESTAMPTZ | Signature timestamp (UTC) |
| signature_ip | VARCHAR(45) | IPv4 or IPv6 |
| wechat_openid | VARCHAR(128) | WeChat identifier |
| device_info | JSONB | {platform, brand, model, system, wechat_version} |
| signed_pdf_url | VARCHAR(500) | Generated signed PDF on MinIO |
| consent_status (subject) | VARCHAR(30) | draft → active → signed → reconsent_required → superseded → revoked |
| reconsent_deadline | TIMESTAMPTZ | Deadline for re-consent after notification |

**异常场景:**

| 场景 | 处理方式 |
|------|----------|
| 签名 Canvas 崩溃/白屏 | 自动检测 Canvas 2d 上下文；fallback 到上传签名照片模式 |
| 签名图片上传失败 | 本地缓存 base64；重试上传3次；仍失败则提示"请稍后重试，签名已本地保存" |
| 测验连续3次未通过 | 锁定测验，通知 CRC 安排线下知情同意；患者端显示"请等待研究人员联系" |
| 网络延迟导致重复提交签名 | 服务端乐观锁：check consent_version_id + subject_id 唯一性；重复请求返回已有 record |
| 签署完成但 PDF 生成失败 | PDF 生成异步 job 记录到 OCRJob 等同类型；失败后自动重试3次；最终失败通知 IT 运维 |
| 知情同意书版本冲突（签署中版本被撤回） | 签名提交时校验 version status=ACTIVE；若已变更则阻止并提示刷新 |
| 再知情截止时间已过未签署 | 自动将 consent_status 更新为 LAPSED；暂停相关研究活动；通知 CRC 跟进 |

**权限/授权要求:**

- Patient: Can view consent document, take quiz, sign, download own signed copy
- Caregiver: Can sign as proxy with proxy authorization (see P03); signature marked as "proxy signature"
- CRC: Can view consent status, trigger re-consent, view signed records (not signature image directly without audit reason)
- PI: Can view consent audit trail
- Data Manager: Read-only access to consent status for reconciliation

**关联数据实体:** ConsentTemplate, ConsentVersion, ConsentRecord, Subject, Study, AuditLog, FileObject, Notification

**关联 REST API:**

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api/v1/subjects/{subjectId}/consent/current | 获取当前待签署的知情同意书版本 |
| GET | /api/v1/subjects/{subjectId}/consent/versions | 获取该受试者所有知情同意书版本记录 |
| GET | /api/v1/consents/{versionId}/quiz | 获取理解度测验题目 |
| POST | /api/v1/consents/{versionId}/quiz/submit | 提交测验答案 |
| POST | /api/v1/consents/{versionId}/sign | 提交电子签名 |
| GET | /api/v1/consents/{consentRecordId}/pdf | 下载签署后的 PDF 副本 |
| GET | /api/v1/consents/{subjectId}/diff/{fromVersionId}/{toVersionId} | 获取两个版本的差异对比 |

---

### P03: 监护人/照护者代理模式 Guardian/Caregiver Proxy

**模块目标:** Enable caregivers/guardians to operate the MiniApp on behalf of incapacitated patients (minors, cognitively impaired, physically unable) with proper authorization management, traceable proxy actions, and configurable authorization scopes.

**子功能清单:**

| 序号 | 子功能 | 描述 | 关键操作 |
|------|--------|------|----------|
| P03-01 | 照护者账号绑定 | Caregiver registers and binds to patient via invitation code, identity verification, or CRC-assisted binding | 注册照护者、绑定患者、身份验证、邀请码核验 |
| P03-02 | 代理知情同意签署 | Caregiver signs consent on behalf of patient with legal guardian verification; separate signature field labeled "监护人签名" | 代理签署、监护人身份提示、双签名栏位 |
| P03-03 | 代理文件上传 | Caregiver uploads reports, photos, documents for patient; source marked as "caregiver_upload" | 代传报告、代传图片、OCR 归属标注 |
| P03-04 | 代理问卷填写 | Caregiver completes ePRO questionnaires on behalf of patient; each response annotated with proxy indicator | 代填问卷、代理标注、区分主体与代理 |
| P03-05 | 代理 AE 报告 | Caregiver reports adverse events on behalf of patient; CRC sees both reporter identity and subject | 代理报告不良事件、报告人信息记录 |
| P03-06 | 授权范围管理 | Patient (if capable) or CRC defines what caregiver can/cannot do; granular permission model | 授权设置、范围变更、到期管理、撤销授权 |
| P03-07 | 代理操作日志 | Every proxy action logged with caregiver_id, timestamp, action_type for full audit trail | 代理操作记录、操作追溯、审计报告 |

**核心交互流程:**

1. Binding Flow:
   - Patient/Caregiver enters MiniApp → "照护者代理模式" menu entry.
   - Caregiver provides patient's subject_identifier or scans patient's QR code.
   - System verifies: a) patient exists; b) caregiver is authorized for this patient; c) authorization is not expired.
   - Authorization created via CRC admin action or via patient self-authorization: POST /api/v1/caregivers/bind with {caregiver_wechat_openid, patient_subject_id, authorization_scopes, valid_from, valid_until, relationship}.
   - Two-factor: CRC receives notification to approve binding; only after approval does the proxy relationship become active.

2. Proxy Mode Activation:
   - Caregiver sees toggle in MiniApp header: "以 [患者姓名] 身份操作" switch.
   - When active, all UI headers show patient name with proxy badge; all API calls include header `X-Proxy-Subject-Id: {subject_id}`.
   - Backend validates proxy relationship on each request via interceptor: check authorization is active, scope includes requested action, patient is valid.

3. Proxy Consent Signing (P02 extension):
   - Caregiver follows same consent flow as P02.
   - Signature page shows TWO signature areas: "受试者签名区" (disabled, marked N/A) and "监护人/法定代理人签名区" (active).
   - On submit, ConsentRecord.signer_role = "LEGAL_GUARDIAN", ConsentRecord.signer_subject_id = caregiver's own subject_id (if they have one) or caregiver_id.

4. Proxy Data Annotation:
   - Every data record created via proxy mode (QuestionnaireResponse, FileObject, AdverseEvent) has:
     - `source` = "PROXY"
     - `proxy_subject_id` = caregiver_id
     - `proxy_role` = relationship type
   - Backend AuditLog records action with both actor_id (caregiver) and subject_id (patient).

5. Authorization Management:
   - Scope granularity: `scope_read` (view data), `scope_write_proxy` (fill/sign as proxy), `scope_upload` (upload files), `scope_ae_report` (report AEs), `scope_consent_sign` (sign consent), `scope_withdrawal` (request withdrawal).
   - Expiration: configurable (default 365 days); auto-expire with notification to both parties.
   - Revocation: patient (if able) or CRC can revoke via PATCH /api/v1/caregivers/{bindingId}/revoke.

**核心字段:**

| 字段 | 类型 | 说明 |
|------|------|------|
| caregiver_binding_id | UUID (UUIDv7) | PK |
| caregiver_subject_id | UUID | Caregiver's own Subject record (if also a subject) |
| caregiver_wechat_openid | VARCHAR(128) | WeChat identity of caregiver |
| patient_subject_id | UUID | FK to Subject (patient being cared for) |
| relationship | VARCHAR(50) | parent, spouse, child, legal_guardian, other |
| authorization_scopes | JSONB | Array of scope strings |
| valid_from | TIMESTAMPTZ | Authorization start date |
| valid_until | TIMESTAMPTZ | Authorization expiry date |
| status | VARCHAR(30) | pending → active → expired → revoked |
| verified_by_crc | BOOLEAN | Whether CRC verified the relationship |
| crc_user_id | UUID | CRC who approved the binding |
| legal_document_url | VARCHAR(500) | Uploaded legal proof (power of attorney, etc.) |

**异常场景:**

| 场景 | 处理方式 |
|------|----------|
| 绑定邀请码过期 | 提示"邀请码已过期，请联系研究协调员重新获取" |
| 多患者绑定冲突 | 一个照护者可绑定多个患者；但每个患者最多5个活跃照护者；超出需特殊审批 |
| 代理操作中授权到期 | 操作开始时校验，若在操作过程中过期（长表单），提交时二次校验并阻止 |
| Caregiver 尝试超越授权范围 | API 返回 403 Forbidden，记录拒绝日志，通知 CRC |
| CRC 拒绝绑定申请 | 照护者收到通知"绑定申请未被批准"，不可重复提交 |
| 患者与照护者关系变更 | 支持 update 关系类型；原 proxy 记录保留不可修改 |
| Caregiver WeChat 账号注销/换绑 | 标记 binding 为 expired；通知 CRC；所有历史 proxy 记录保留 |

**权限/授权要求:**

- Caregiver: Can view proxy binding status, switch to proxy mode, perform authorized proxy actions
- Patient (self): Can view who is authorized as proxy, revoke authorization, set scope
- CRC: Can create/approve/revoke caregiver bindings, view proxy audit log
- PI: View-only access to proxy relationships for oversight
- Data Manager: No proxy management; can see proxy data annotations in export

**关联数据实体:** CaregiverBinding, Subject, AuditLog, ConsentRecord, QuestionnaireResponse, FileObject, AdverseEvent

**关联 REST API:**

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | /api/v1/caregivers/bind | 申请照护者绑定 |
| PATCH | /api/v1/caregivers/{bindingId}/approve | CRC 批准绑定（后台 API） |
| PATCH | /api/v1/caregivers/{bindingId}/revoke | 撤销照护者授权 |
| GET | /api/v1/subjects/{subjectId}/caregivers | 获取受试者的所有照护者 |
| GET | /api/v1/caregivers/{caregiverId}/patients | 获取照护者绑定的所有患者 |
| PATCH | /api/v1/caregivers/{bindingId}/scopes | 修改授权范围 |
| GET | /api/v1/caregivers/{bindingId}/audit-log | 查看代理操作记录 |

---

### P04: 报告上传、OCR、结构化确认 Report Upload, OCR & Structured Confirmation

**模块目标:** Allow patients and caregivers to upload medical reports (lab results, examination reports, discharge summaries) via WeChat gallery/camera/file selector, have them OCR-processed by the AI service with field-level structured extraction, and enable interactive field-by-field confirmation or correction with confidence score visualization.

**子功能清单:**

| 序号 | 子功能 | 描述 | 关键操作 |
|------|--------|------|----------|
| P04-01 | 文件选择 | Three source options: WeChat album (图片), camera (拍照), WeChat file selector (微信文件, PDF) | 相册选取、拍照上传、文件选择、多图批量 |
| P04-02 | 上传与进度 | Presigned URL upload to MinIO via WeChat upload API; progress bar with cancelable transfer | 分片上传、进度条、取消上传、断点续传 |
| P04-03 | OCR 处理状态轮询 | After upload, poll AI service processing status; show real-time status badge (排队中/识别中/已完成/需确认) | 状态轮询、状态徽标、预估时间 |
| P04-04 | 结构化结果展示 | OCR results rendered as editable table (field name | recognized value | confidence | edit button) | 表格展示、字段级置信度、行内编辑 |
| P04-05 | 逐字段确认/纠错 | Tap field to edit; inline correction with keyboard/picker; corrections saved and flagged for AI feedback loop | 行内编辑、纠错提交、AI 反馈学习 |
| P04-06 | 置信度等级指示 | Color-coded confidence: green (>=0.95), yellow (0.80-0.94), red (<0.80); low-confidence fields require mandatory review | 置信度颜色、低置信强制确认、批量确认 |
| P04-07 | 批量确认 | One-tap "全部确认" for high-confidence fields only; low-confidence fields each need individual confirmation | 批量确认、低置信拦截、未确认统计 |
| P04-08 | 历史报告列表 | Chronological list of all uploaded reports with status, date, and summary tags | 报告列表、筛选、搜索、预览大图 |

**核心交互流程:**

1. File Selection:
   - Patient taps "上传报告" FAB on home screen → action sheet with 3 options: "从相册选择" "拍照" "微信文件".
   - 相册: wx.chooseMedia (count up to 9, mediaType=['image'], sizeType=['compressed']); file size limit 10MB.
   - 拍照: wx.chooseImage({sourceType: ['camera']}); auto-compress to max 2048px.
   - 微信文件: wx.chooseMessageFile({type: 'file', extension: ['pdf', 'jpg', 'jpeg', 'png']}).

2. Upload:
   - Client calls GET /api/v1/files/upload-url with {filename, content_type, file_size, source, subject_id} → server returns presigned MinIO PUT URL (15min expiry) + file_object_id.
   - Client uploads directly to MinIO via wx.request({url: presigned_url, method: 'PUT', data: fileBuffer}).
   - On upload success → POST /api/v1/files/{fileObjectId}/upload-complete → server:
     - Updates FileObject status = UPLOADED
     - Publishes FileUploadedEvent to RabbitMQ `pms.file.uploaded`
     - AI Consumer receives event → creates OCRJob record

3. OCR Processing:
   - Client polls GET /api/v1/files/{fileObjectId}/ocr-status every 3 seconds (max 120s polling).
   - AI Service (Python/FastAPI/PaddleOCR):
     - For image: PaddleOCR detects text blocks → PaddleX document structure model classifies fields (test_name, result_value, reference_range, unit, collection_date, etc.)
     - For PDF: pdf2image conversion → same OCR pipeline
     - Returns structured JSON: {fields: [{name, value, confidence, bounding_box, field_type}], raw_text, processing_time_ms, model_version, prompt_version}
   - Server stores OCR result in JSONB column on FileObject; updates OCRJob status = COMPLETED.

4. Structured Confirmation:
   - When OCR completes, MiniApp receives status update → transitions from loading spinner to results table.
   - Table columns: 指标名称 | 识别结果 | 置信度 | 操作 (edit/confirm).
   - Patient reviews each row: green confidence fields auto-show "已确认"; yellow may need edit; red requires mandatory edit (disabled confirm until touched).
   - Inline edit: tap cell → native input/picker appears; on save → field.confirmed = true, field.original_value preserved, field.confirmed_value = new value.
   - Patient taps "提交确认" → POST /api/v1/files/{fileObjectId}/confirm with {fields: [{name, original_value, confirmed_value, confidence}]}.
   - Server validates all mandatory fields confirmed; creates DiagnosticReport or Observation entities from confirmed fields; publishes ReportConfirmedEvent.
   - AI feedback: confirmed corrections stored and used to fine-tune model (anonymized data only, per privacy policy).

5. CRC Review (backend):
   - High-risk data (abnormal lab values, flagged by RuleEngine) auto-create a task for CRC review.
   - CRC can override patient's confirmed values; override recorded with reason in AuditLog.

**核心字段:**

| 字段 | 类型 | 说明 |
|------|------|------|
| file_object_id | UUID (UUIDv7) | PK |
| subject_id | UUID | FK to Subject |
| study_id | UUID | FK to Study |
| file_type | VARCHAR(20) | LAB_REPORT, IMAGING_REPORT, DISCHARGE_SUMMARY, OTHER |
| storage_bucket | VARCHAR(50) | MinIO bucket: raw, processed |
| storage_path | VARCHAR(500) | Object path in MinIO |
| original_filename | VARCHAR(255) | User's original filename |
| mime_type | VARCHAR(100) | e.g., image/jpeg, application/pdf |
| file_size_bytes | BIGINT | Size in bytes |
| upload_source | VARCHAR(20) | album, camera, wechat_file, caregiver_upload |
| proxy_upload_subject_id | UUID | If uploaded by caregiver, the caregiver's ID |
| ocr_job_id | UUID | FK to OCRJob |
| ocr_status | VARCHAR(30) | pending → queued → processing → completed → failed → human_review_needed |
| ocr_result | JSONB | Structured OCR output: {fields: [...], raw_text, model_version, prompt_version} |
| confirmed_fields | JSONB | Patient-confirmed version: {fields: [{name, original_value, confirmed_value, confidence, is_corrected}]} |
| confirmation_status | VARCHAR(30) | unconfirmed → partially_confirmed → confirmed → crc_verified |
| confirmed_at | TIMESTAMPTZ | When patient confirmed |
| confirmed_by | UUID | Subject ID of confirmer (patient or caregiver) |
| visit_id | UUID | Optional FK to Visit (which visit this report belongs to) |
| source_document_type | VARCHAR(50) | lab_report, imaging_report, ecg, prescription, discharge_note |
| tags | JSONB | Auto-generated tags: e.g., ["lab", "abnormal", "fasting"] |

**异常场景:**

| 场景 | 处理方式 |
|------|----------|
| 上传过程中断网 | 保留已上传分片；恢复后从断点续传（MinIO multipart upload）；超24h未完成自动清理 |
| 图片质量差导致 OCR 置信度全部 <0.8 | 提示"图片质量不佳，建议重新拍照上传"；不强制确认；提供"仍要确认"选项 |
| OCR 返回空结果 | 标记 ocr_status=failed；通知患者"识别失败，请联系研究协调员手动录入"；创建 CRC 人工录入任务 |
| AI 服务超时（>60s） | 降级为 human_review_needed 状态；CRC 收到异步任务通知 |
| 患者确认的值被 CRC 覆盖 | 保留完整轨迹：original → patient_confirmed → crc_overridden；每条有 timestamp + actor_id |
| 同一报告重复上传（MD5 比对） | 提示"此文件已上传过"，禁止重复；返回已有 FileObject 供查看 |
| PDF 页码过多（>50页） | 仅 OCR 前10页；剩余页提示用户"仅识别前10页，如需识别全部请联系研究协调员" |
| WeChat 文件选择器版本兼容 | 降级方案：wx.chooseImage 仅支持图片；提示使用图片上传或联系 IT |

**权限/授权要求:**

- Patient: Can upload files, view own files, confirm/correct OCR results, delete own files (within 24h of upload)
- Caregiver: Can upload files on behalf of patient with proxy_label; confirmation marked as proxy action
- CRC: Can view all uploaded files, override OCR results, manually trigger re-OCR, create manual data entries
- AI Service: System-to-system; has write access to OCRJob and FileObject via internal API
- Data Manager: Read-only; can export OCR-confirmed data
- Monitor: Can view OCR quality metrics (confidence distribution, correction rates)

**关联数据实体:** FileObject, OCRJob, DiagnosticReport, Observation, Subject, Visit, AuditLog, Notification, OCRModelVersion

**关联 REST API:**

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | /api/v1/files/upload-url | 获取 MinIO 预签名上传 URL |
| POST | /api/v1/files/{fileObjectId}/upload-complete | 通知服务器上传完成 |
| GET | /api/v1/files/{fileObjectId}/ocr-status | 轮询 OCR 处理状态 |
| GET | /api/v1/files/{fileObjectId}/ocr-result | 获取 OCR 结构化结果 |
| POST | /api/v1/files/{fileObjectId}/confirm | 提交确认/纠错后的结构化数据 |
| GET | /api/v1/subjects/{subjectId}/files | 获取受试者所有上传文件列表 |
| DELETE | /api/v1/files/{fileObjectId} | 删除文件（24h 内） |
| POST | /api/v1/files/{fileObjectId}/reprocess-ocr | CRC 触发重新 OCR |

---

### P05: ePRO / eDiary / 问卷量表 ePRO, eDiary & Questionnaires

**模块目标:** Deliver visit-linked questionnaires and patient diaries to the MiniApp with support for multi-type question rendering, offline draft saving, validation on submission, and reminder notifications for pending and overdue items.

**子功能清单:**

| 序号 | 子功能 | 描述 | 关键操作 |
|------|--------|------|----------|
| P05-01 | 按访视组织的问卷列表 | Questionnaires grouped by Visit with due dates, completion status badges, and priority indicators | 访视分组、到期日、状态徽标、排序优先 |
| P05-02 | 多题型渲染 | Dynamic component rendering for: single choice, multi choice, scale (VAS/Likert), numeric input, free text, date picker, image capture, table grid | 单选、多选、量表滑块、数值输入、文本、日期、拍照题、矩阵题 |
| P05-03 | 离线草稿保存 | Auto-save to local storage every 15s; manual save button; resume from draft on reopen | 自动保存、手动保存、恢复草稿、草稿过期 |
| P05-04 | 提交校验 | Client-side: required field check, range validation, conditional logic, consistency rules; Server-side: duplicate check, timestamp validation | 必填校验、范围校验、逻辑一致性、重复提交检测 |
| P05-05 | 完成状态追踪 | Real-time completion rate per visit; "未开始" "进行中" "已完成" badges per questionnaire | 完成统计、状态徽标、进度条 |
| P05-06 | 提醒通知 | WeChat template message for pending questionnaires; reminder escalation (T-24h, T-6h, overdue); CRC dashboard alert for persistent non-compliance | 模板消息提醒、逐级升级、逾期告警 |
| P05-07 | 问卷模板版本控制 | QuestionnaireTemplate with version number; in-progress drafts for old version auto-migrate or invalidate on new version publish | 版本号、草稿迁移、版本失效提示 |

**核心交互流程:**

1. Questionnaire Assignment:
   - When Visit status transitions to PLANNED or DUE, system auto-assigns linked questionnaires based on VisitTemplate.questionnaire_assignment_rules (JSONB: [{questionnaire_template_id, timing_relative_to_visit, completion_window_hours}]).
   - Creates QuestionnaireResponse records per questionnaire per subject.
   - Patient sees updated list on MiniApp home screen "待完成问卷" card.

2. Questionnaire List View:
   - GET /api/v1/subjects/{subjectId}/questionnaire-responses?status=PENDING,IN_PROGRESS
   - Grouped by visit: "访视2 - Day 14 (±3天)" header → list of questionnaires for that visit.
   - Each row: questionnaire name, due date, status pill (color-coded), estimated completion time.

3. Questionnaire Fill Flow:
   - Patient taps questionnaire → MiniApp loads full question template (GET /api/v1/questionnaires/{templateId}).
   - Questions array contains: question_id, question_type, question_text, options (if applicable), required, validation_rules (JSON), display_condition (conditional logic JSON), order.
   - Render loop iterates questions array; each question_type maps to dedicated component:
     - single_choice → radio group
     - multi_choice → checkbox group
     - scale_vas → slider 0-100 with anchors
     - scale_likert → 5/7-point radio with descriptors
     - numeric → number input with unit label
     - free_text → textarea with character count
     - date_picker → WeChat native date picker, constrained to allowed range
     - image_capture → "拍照" button → camera → thumbnail preview
     - table_grid → N×M matrix (e.g., concomitant medications table)
   - Conditional display: client evaluates `display_condition` JSON before rendering question; hidden questions skipped.

4. Draft Management:
   - Every 15 seconds, client serializes current answers to JSON and saves to local storage keyed by `questionnaire_response_id`.
   - On any change (answer selected/changed), update dirty flag.
   - On page close (onHide/onUnload): final save to local storage + attempt to POST draft to server.
   - On reopen: check server for draft; if newer than local, use server; else load local and prompt sync.

5. Submission:
   - Patient taps "提交" → client validation pass: check required fields populated, numeric values within range, conditional consistency.
   - Validation errors: scroll to first error, highlight field red, show error toast at top.
   - All validation passed → POST /api/v1/questionnaire-responses/{responseId}/submit with complete answers JSON.
   - Server-side:
     - Validate QuestionnaireResponse status is IN_PROGRESS or PENDING
     - Validate all required questions answered (server-side replica of client validation for security)
     - Store answers in JSONB column `answers` on QuestionnaireResponse
     - Update status = COMPLETED, completed_at = now()
     - Run DataQualityRuleEngine: check range rules, cross-form consistency, timeline rules
     - If quality violations found: create DataQualityIssue records, flag response for CRC review; if critical, immediate notification
     - Publish QuestionnaireCompletedEvent to RabbitMQ
     - If this was the last pending questionnaire for the visit, publish VisitQuestionnairesCompletedEvent

6. Reminder Engine:
   - Scheduled job (Spring @Scheduled, cron: every 6 hours) queries questionnaire_responses WHERE status IN ('PENDING', 'IN_PROGRESS') AND due_date < NOW() + INTERVAL.
   - At T-24h: send WeChat template message "您有一项问卷即将到期，请及时完成"
   - At T-6h: send second reminder with subject "问卷即将逾期"
   - At overdue + 24h: CRC notification to follow up by phone
   - At overdue + 72h: escalation to PI dashboard

**核心字段:**

| 字段 | 类型 | 说明 |
|------|------|------|
| questionnaire_template_id | UUID (UUIDv7) | PK for template |
| questionnaire_response_id | UUID (UUIDv7) | PK for subject's response instance |
| template_version | INTEGER | Version number of the questionnaire template |
| subject_id | UUID | FK to Subject |
| visit_id | UUID | FK to Visit (nullable for non-visit diaries) |
| study_id | UUID | FK to Study |
| status | VARCHAR(30) | pending → in_progress → completed → overdue → skipped |
| questions_snapshot | JSONB | Frozen copy of question template at time of assignment |
| answers | JSONB | Subject's answers: {question_id: {value, answered_at, changed_from}} |
| started_at | TIMESTAMPTZ | When patient first opened the questionnaire |
| completed_at | TIMESTAMPTZ | When final submit succeeded |
| due_date | TIMESTAMPTZ | Deadline for completion |
| completion_window_hours | INTEGER | e.g., 72 hours before/after visit |
| proxy_completed_by | UUID | If completed by caregiver, their subject_id |
| quality_issues | JSONB | Array of DataQualityIssue references |
| is_diary | BOOLEAN | True if this is a daily diary (not visit-linked) |
| diary_schedule | JSONB | For diaries: {frequency: daily, times_per_day: 2, preferred_times: ["08:00", "20:00"]} |
| reminders_sent_count | INTEGER | Number of reminders already sent |
| last_reminder_at | TIMESTAMPTZ | Timestamp of last reminder |

**异常场景:**

| 场景 | 处理方式 |
|------|----------|
| 网络中断导致提交失败 | 答案保留在本地缓存 + 已 POST 到服务器的草稿；网络恢复后提示"有未提交的问卷" |
| 问卷模板更新后草稿仍为旧版本 | 检测 template_version 不匹配；提示"问卷已更新，草稿已清理"；少数可迁移的答案保留 |
| 双重提交（网络波动） | 服务端幂等：检查 status=COMPLETED 则返回已存在记录，不报错 |
| 患者跳过必答题点击提交 | 客户端拦截，scroll to first unfilled required + toast "请完成必答题（共X题）" |
| 访视窗口外提交问卷 | 服务端根据 completion_window_hours 判断；窗口外仍接受提交但标记为 late，记录 protocol deviation |
| 量表类型问卷异常值（全部极端值） | DataQualityRuleEngine 检测到 all-min or all-max pattern，标记需 CRC 审核 |
| Diary 连续3天未完成 | 自动生成 Notification 给 CRC；CRC 可暂停该患者后续 diary 任务 |

**权限/授权要求:**

- Patient: Can view assigned questionnaires, fill, save drafts, submit, view completion history
- Caregiver: Can fill and submit on behalf with proxy annotation
- CRC: Can view all questionnaire responses, modify (with audit reason), manually mark as skipped, trigger re-assignment
- PI: Read-only view of questionnaire completion rates and quality issues
- Data Manager: Can export questionnaire data; cannot modify
- Monitor: View completion compliance metrics per site

**关联数据实体:** QuestionnaireTemplate, QuestionnaireResponse, Visit, Subject, Study, DataQualityIssue, Notification, AuditLog, RuleEngine

**关联 REST API:**

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api/v1/subjects/{subjectId}/questionnaire-responses | 获取受试者问卷列表（按状态筛选） |
| GET | /api/v1/questionnaires/{templateId} | 获取问卷模板详情（含所有题目） |
| POST | /api/v1/questionnaire-responses/{responseId}/draft | 保存草稿到服务器 |
| GET | /api/v1/questionnaire-responses/{responseId}/draft | 获取草稿（用于跨设备恢复） |
| POST | /api/v1/questionnaire-responses/{responseId}/submit | 提交完整问卷答案 |
| GET | /api/v1/subjects/{subjectId}/questionnaire-responses/completion-stats | 获取完成统计 |
| PATCH | /api/v1/questionnaire-responses/{responseId}/skip | CRC 标记问卷为跳过（带原因） |

---

### P06: 居家指标记录与设备同步 Home Health Metrics & Device Sync

**模块目标:** Allow patients to manually log vital signs and health metrics (blood pressure, blood glucose, weight, temperature) at home, optionally sync data from Bluetooth health devices, visualize trends over time with charts, and receive alerts on abnormal values.

**子功能清单:**

| 序号 | 子功能 | 描述 | 关键操作 |
|------|--------|------|----------|
| P06-01 | 手动录入 | Form-based entry for each metric type with guided input, unit selection, and timestamp logging | 血压录入、血糖录入、体重、体温、用药依从性 |
| P06-02 | Bluetooth 设备同步 (placeholder API) | API contract defined for Bluetooth LE device sync (BP monitor, glucometer, scale, thermometer); WeChat BLE API integration placeholder due to device certification requirements | BLE 扫描、设备配对、数据读取、同步状态 |
| P06-03 | 趋势图表 | Interactive charts showing metric trends over configurable time ranges (7d/30d/90d); overlay with reference ranges | 折线图、柱状图、参考范围带、时间切换 |
| P06-04 | 异常值告警 | Real-time comparison against protocol-defined thresholds; color-coded results; push notification for critical values | 异常检测、阈值对比、即时推送、分级提醒 |
| P06-05 | 数据列表与导出 | Sortable/filterable list of all readings; export as PDF/Excel for clinic visit preparation | 数据列表、排序筛选、PDF 导出、分享给医生 |
| P06-06 | 用药依从性记录 | Manual medication adherence check-in (took/missed/late) with time and reason for missed dose | 服药打卡、漏服记录、原因选择 |

**核心交互流程:**

1. Manual Entry:
   - Patient taps "记录指标" → selects metric type from quick-action grid: 血压, 血糖, 体重, 体温, 血氧.
   - Each metric type has dedicated form:
     - Blood Pressure: systolic (number pad), diastolic (number pad), heart rate (number pad), measurement position (sitting/standing/lying), arm (left/right), note (free text).
     - Blood Glucose: value (number pad), measurement type (fasting/postprandial/random), meal relation (before/after/none), time of day, note.
     - Weight: value (number pad, kg/lb toggle), measurement condition (with clothes/without clothes), note.
     - Temperature: value (number pad, Celsius/Fahrenheit toggle), measurement site (oral/axillary/ear/forehead), note.
   - Date/time picker defaults to current time but editable (for retrospective entry within 24h window).
   - Submit → POST /api/v1/subjects/{subjectId}/observations with {type, value, unit, measured_at, context_data}.

2. Trend Visualization:
   - GET /api/v1/subjects/{subjectId}/observations/trend?metric_type=blood_pressure&period=30d
   - Response includes array of {date, value components, is_abnormal}.
   - Client renders using ECharts (echarts-for-weixin):
     - BP: dual-line chart (systolic red line, diastolic blue line) with reference range bands (green zone).
     - Blood glucose: scatter plot with meal-type markers; target range shading.
     - Weight: line chart with smoothed trend line.
   - Tap data point → modal with full reading details and "编辑" / "删除" actions.

3. Abnormal Value Alerts:
   - Server-side: Observation saved → RuleEngine checks against protocol-defined thresholds stored in Study.observation_thresholds (JSONB).
   - Thresholds example: {blood_pressure: {systolic: {critical_high: 180, high: 140, low: 90}, diastolic: {critical_high: 120, high: 90, low: 60}}}.
   - If value breaches threshold: Observation record flagged is_abnormal=true, severity=HIGH|CRITICAL.
   - CRITICAL severity → immediate notification to CRC via RabbitMQ → WeChat/SMS alert (if configured) → CRC callback phone protocol.
   - MiniApp: abnormal reading highlighted red in list; trend chart shows outlier markers.
   - Patient receives template message: "您于{date}记录的{metric}值{value}异常，请关注。研究协调员将尽快联系您。"

4. Bluetooth Sync (Placeholder):
   - Patient taps "连接设备" → MiniApp scans for BLE devices via wx.openBluetoothAdapter → wx.startBluetoothDevicesDiscovery with service UUID filters.
   - Device list displayed; tap to pair (wx.createBLEConnection).
   - Service/characteristic discovery → subscribe to data characteristic → parse vendor-specific data format.
   - Received readings auto-populate observation form; patient confirms before submit.
   - NOTE: Full BLE implementation blocked by WeChat BLE API limitations and device certification; this module defines the API contract and placeholder UI. Actual device integration requires native app or certified WeChat IoT plugin.

5. Medication Adherence:
   - Diary-style daily check-in: medication name, scheduled time, actual time (or missed), reason if missed (forgot, side effects, feel better, doctor instructed to stop, out of supply, other).
   - Adherence rate calculated per medication over rolling 7-day window; displayed as progress ring.
   - Low adherence (<80%) triggers CRC notification.

**核心字段:**

| 字段 | 类型 | 说明 |
|------|------|------|
| observation_id | UUID (UUIDv7) | PK |
| subject_id | UUID | FK to Subject |
| study_id | UUID | FK to Study |
| observation_type | VARCHAR(50) | blood_pressure, blood_glucose, weight, temperature, spo2, heart_rate, medication_adherence |
| value | JSONB | Structured value: {systolic: 120, diastolic: 80} or {glucose: 5.6} |
| unit | VARCHAR(20) | mmHg, mmol/L, mg/dL, kg, lb, Celsius, Fahrenheit, % |
| measured_at | TIMESTAMPTZ | When the reading was taken (patient-reported) |
| recorded_at | TIMESTAMPTZ | Server timestamp (always now()) |
| measurement_context | JSONB | Additional context: {position: sitting, arm: left, fasting: true, meal_relation: after} |
| is_abnormal | BOOLEAN | Whether value breaches protocol threshold |
| abnormality_severity | VARCHAR(20) | NORMAL, HIGH, CRITICAL |
| source | VARCHAR(20) | manual_entry, bluetooth_sync, caregiver_entry |
| device_info | JSONB | If from device: {device_name, device_mac, manufacturer, model} |
| proxy_recorded_by | UUID | If recorded by caregiver |
| adherence_score | DECIMAL(3,2) | For medication adherence: 0.00-1.00 |
| notes | TEXT | Free text note |

**异常场景:**

| 场景 | 处理方式 |
|------|----------|
| 手动录入值明显异常（如收缩压 999） | 客户端输入限制（max=300） + 服务端范围校验；拒绝存储并提示重新输入 |
| Bluetooth 连接中断 | 显示"连接已断开"；保留已读取数据；提示重新连接或手动录入 |
| Ble 设备返回无效数据格式 | Try-catch 解析；失败后提示"无法识别设备数据格式，请手动录入" |
| 回溯录入超过24h | 允许录入但标记为 retrospective；在 trend chart 上区分显示（dashed line） |
| 同一时间点多次录入 | 允许；列表显示所有记录；趋势图取最新值；重复检测不阻止 |
| 临界值告警 CRC 未及时处理 | 系统追踪 acknowledgement；超30min未确认则升级通知到 PI |
| 离线状态下录入 | 本地 IndexedDB 缓存；恢复网络后批量同步；冲突解决：server timestamp wins |

**权限/授权要求:**

- Patient: Can record metrics, view trends, sync devices, export own data
- Caregiver: Can record metrics on behalf of patient
- CRC: Can view all patient metrics; receive abnormal alerts; acknowledge/close alerts
- PI: View aggregated trends per subject; view alert statistics
- Data Manager: Export de-identified metrics for analysis

**关联数据实体:** Observation, Subject, Study, DeviceInfo, Notification, AuditLog, RiskSignal

**关联 REST API:**

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | /api/v1/subjects/{subjectId}/observations | 创建健康指标记录 |
| GET | /api/v1/subjects/{subjectId}/observations | 获取指标记录列表（分页+筛选） |
| GET | /api/v1/subjects/{subjectId}/observations/trend | 获取趋势数据（用于图表） |
| PUT | /api/v1/observations/{observationId} | 编辑指标记录 |
| DELETE | /api/v1/observations/{observationId} | 删除指标记录（24h内） |
| GET | /api/v1/subjects/{subjectId}/observation-thresholds | 获取当前研究的阈值配置 |
| GET | /api/v1/subjects/{subjectId}/observations/export | 导出指标记录为 PDF/Excel |

---

### P07: 访视日历、访视窗、提醒 Visit Calendar, Visit Window & Reminders

**模块目标:** Provide a monthly calendar view with color-coded visit markers, clearly display visit window ranges (e.g., "Day 14, Window: -3 / +3 days"), show visit preparation checklists, and integrate WeChat subscription message reminders for upcoming and overdue visits.

**子功能清单:**

| 序号 | 子功能 | 描述 | 关键操作 |
|------|--------|------|----------|
| P07-01 | 月历视图 | Calendar component with visit date markers; dot/color indicators per visit status; tap date to see visit detail | 月历切换、日期标记、状态颜色、点击详情 |
| P07-02 | 访视窗显示 | Visual representation of visit window range; "Day 14 ± 3 days" shown as date range bar below calendar | 窗口期柱状条、开始/截止日期、倒计时标签 |
| P07-03 | 访视准备清单 | Pre-visit checklist: fasting required, bring medications, complete questionnaires, upload reports, prepare questions for doctor | 清单展示、勾选完成、未完成提醒 |
| P07-04 | 订阅消息提醒 | WeChat subscription message for upcoming visit (T-7d, T-3d, T-1d, T-morning); overdue alert (T+1d, T+3d) | 订阅授权、模板消息、多级提醒、逾期告警 |
| P07-05 | 访视完成确认 | Patient confirms visit completion; CRC also confirms from backend; status reconciliation | 到访确认、CRC 确认、状态同步 |
| P07-06 | 访视列表视图 | Alternative list view showing all visits in chronological order with status | 列表模式、时间线展示、筛选 |
| P07-07 | 研究中心信息 | Embedded site address, map navigation (WeChat Map), contact phone, office hours | 地图导航、联系电话、上班时间 |

**核心交互流程:**

1. Calendar Initialization:
   - Patient opens "访视日历" tab → MiniApp requests GET /api/v1/subjects/{subjectId}/visits?from=startOfMonth&to=endOfMonth+2months.
   - Response includes all Visit records with {visit_id, visit_template_name, planned_date, window_start_date, window_end_date, status, visit_sequence}.
   - Client renders WeChat calendar component (or custom component using WXML grid):
     - Each day cell contains up to 3 dot indicators for visits on that day.
     - Color coding: planned=blue, due=orange, overdue=red, completed=green, missed=grey, cancelled=strikethrough.

2. Visit Detail View:
   - Patient taps a date with visit marker → bottom sheet or new page showing visit details.
   - Visit window display: horizontal bar visualization.
     - Example: Visit 2 - Day 14, Window: May 20 (-3d) to May 26 (+3d), Target: May 23.
     - Progress: "距离目标日还有5天" / "窗口已开启" / "窗口将于明天关闭" / "已逾期2天".
   - Preparation checklist pre-loaded:
     - "完成访视2相关问卷 (2/3 已完成)" - links to P05 questionnaire list
     - "上传近期化验报告" - links to P04 upload
     - "空腹8小时 (访视当天)" - manual checkbox
     - "携带所有在服药物" - manual checkbox
     - "准备要咨询医生的问题" - manual checkbox + notes field

3. Reminder System:
   - Patient must first subscribe to WeChat message template. On first visit, MiniApp calls wx.requestSubscribeMessage to get authorization for specific template IDs (visit_reminder, visit_overdue).
   - Reminder Engine (server-side, Spring @Scheduled or Quartz job):
     - T-7d: if visit is PLANNED and current_date = planned_date - 7d, send template message: "您将于{date}有{visit_name}访视，请提前准备" with fields: visit_name, date, preparation_reminder.
     - T-3d: second reminder with checklist summary.
     - T-1d: final reminder with fasting instruction if applicable.
     - T-morning (8:00 AM on planned_date): same-day reminder with "今天有访视，请按时到达" + site address + map link.
     - T+1d: if status not COMPLETED, overdue reminder: "您的{visit_name}已逾期1天，请尽快预约补访".
     - T+3d: escalation notification visible in CRC dashboard.
   - Each reminder call: POST /api/v1/notifications/wechat-template-message with {template_id, touser, data, page}.

4. Visit Completion:
   - Patient: On visit day, taps "确认到访" button → posts LOCATION data (optional, to verify on-site) → POST /api/v1/visits/{visitId}/patient-checkin with {checkin_time, location}.
   - CRC: In backend, marks visit as COMPLETED after all visit activities done.
   - Dual confirmation: Visit status = COMPLETED only after BOTH patient checkin AND CRC confirmation; if only patient confirmed, status = AWAITING_CRC_CONFIRMATION.
   - If patient checkin is missing but CRC marks completed, visit marked COMPLETED with note "CRC confirmed, patient did not check in via app".

5. Missed/Cancelled Visit:
   - Patient can request visit cancellation (postpone): POST /api/v1/visits/{visitId}/reschedule-request with {reason, preferred_dates[]}. CRC receives task; can approve or propose alternative. New Visit created for new date; original visit status = RESCHEDULED.
   - If window expires with no action: status auto-transitions to MISSED; protocol deviation logged.

**核心字段:**

| 字段 | 类型 | 说明 |
|------|------|------|
| visit_id | UUID (UUIDv7) | PK |
| visit_template_id | UUID | FK to VisitTemplate (protocol-defined visit definition) |
| subject_id | UUID | FK to Subject |
| study_id | UUID | FK to Study |
| visit_sequence | INTEGER | Ordinal: 1, 2, 3, ... |
| visit_name | VARCHAR(200) | e.g., "Screening Visit", "Day 14 Follow-up" |
| planned_date | DATE | Protocol-defined target visit date |
| window_start_date | DATE | Earliest allowed date (planned_date - window_before_days) |
| window_end_date | DATE | Latest allowed date (planned_date + window_after_days) |
| window_before_days | INTEGER | e.g., 3 |
| window_after_days | INTEGER | e.g., 3 |
| actual_date | DATE | Actual date when visit occurred |
| status | VARCHAR(30) | planned → due → overdue → completed / missed / cancelled / rescheduled |
| patient_checkin_time | TIMESTAMPTZ | When patient tapped "确认到访" |
| patient_checkin_location | JSONB | {latitude, longitude, accuracy} |
| crc_confirmed_at | TIMESTAMPTZ | When CRC confirmed completion |
| checklist_items | JSONB | Frozen preparation checklist at time of assignment |
| checklist_completions | JSONB | Patient's checklist completion status: {item_id: {completed: true, completed_at: ...}} |
| questionnaires_count | INTEGER | Number of questionnaires linked to this visit |
| questionnaires_completed | INTEGER | Number completed |
| reminders_sent | JSONB | Array of {reminder_type, sent_at, template_message_id, status} |
| protocol_deviation | BOOLEAN | Whether this visit constitutes a protocol deviation |
| deviation_reason | VARCHAR(200) | e.g., "Visit outside window", "Missed visit" |
| site_location | JSONB | {address, latitude, longitude, phone, office_hours} |
| notes | TEXT | CRC notes |

**异常场景:**

| 场景 | 处理方式 |
|------|----------|
| 用户未订阅消息模板 | 首次使用时弹窗引导订阅；未订阅则仅 App 内提醒（小红点 + 首页卡片） |
| 访视窗重叠（两个访视窗口有交集） | 日历上同时显示两个标记；访视列表按创建顺序排列；不自动合并 |
| 用户跨时区（出国） | 所有时间使用 UTC 存储；提醒使用本地时间，提醒引擎根据用户当前时区调整发送时间 |
| 访视计划变更（Protocol Amendment） | 新 VisitTemplate 发布后，未来访视自动更新；已完成的访视不受影响；进行中的访视标记需重新评估窗口 |
| 用户确认到访但 CRC 发现未到访 | CRC 可驳回 checkin，设置 visit status 回退到 overdue；记录驳回原因和 AuditLog |
| 连续多次未到访 | 连续2次 missed 自动触发 RiskSignal（受试者依从性风险）；通知 PI 评估是否继续参与 |
| 消息模板推送频率限制 | WeChat 限制每周1次无交互推送；利用 patient 交互（打开 MiniApp）重置计数窗口；超额后降级为 SMS（如已授权） |

**权限/授权要求:**

- Patient: Can view calendar, confirm checkin, request reschedule, set checklist items
- Caregiver: Can view calendar, confirm checkin on behalf of patient, complete checklist
- CRC: Can view all visits, confirm/cancel/reschedule visits, override checklist
- PI: View calendar and visit compliance reports per subject
- Site Manager: View site-level visit compliance metrics

**关联数据实体:** Visit, VisitTemplate, Subject, Study, ChecklistTemplate, Notification, AuditLog, ProtocolDeviation, RiskSignal

**关联 REST API:**

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api/v1/subjects/{subjectId}/visits | 获取访视列表（分页、时间范围筛选） |
| GET | /api/v1/visits/{visitId} | 获取单个访视详情（含准备清单） |
| POST | /api/v1/visits/{visitId}/patient-checkin | 患者确认到访 |
| PATCH | /api/v1/visits/{visitId}/checklist | 更新准备清单完成状态 |
| POST | /api/v1/visits/{visitId}/reschedule-request | 申请重新安排访视 |
| GET | /api/v1/subjects/{subjectId}/visits/calendar | 获取日历视图数据 |
| POST | /api/v1/notifications/subscribe | 订阅消息模板授权 |
| GET | /api/v1/subjects/{subjectId}/visits/next | 获取下一次访视摘要 |

---

### P08: AE/不适/用药自报 Adverse Event, Symptom & Medication Self-Report

**模块目标:** Provide a simple yet structured adverse event and medication reporting interface for patients and caregivers, capturing key safety data, medication usage details, and supporting documentation (e.g., medication packaging photos), with automatic CRC notification for timely follow-up.

**子功能清单:**

| 序号 | 子功能 | 描述 | 关键操作 |
|------|--------|------|----------|
| P08-01 | 简易 AE 报告 | Structured form: symptom description, severity (mild/moderate/severe), start date, outcome, relation to study drug (patient opinion) | 症状描述、严重程度选择、开始日期、转归、相关性自评 |
| P08-02 | 用药日记 | Daily medication log: drug name, dose, frequency, time taken; support for both study drug and concomitant medications | 药品名称、剂量、频次、服药时间、合并用药记录 |
| P08-03 | 药品包装拍照 | Camera capture of medication packaging label for verification; OCR extraction of drug name and batch number | 拍照识别、药品名提取、批号识别 |
| P08-04 | 提交确认与 CRC 通知 | On submit, immediate confirmation to patient; CRC receives notification with AE severity flag; if SAE criteria met, urgent escalation | 提交确认、CRC 即时通知、SAE 紧急升级 |
| P08-05 | AE 历史列表 | Chronological list of all reported AEs with status (reported/acknowledged/under_review/resolved) and severity badges | 历史记录、状态追踪、严重度标签 |
| P08-06 | 用药提醒 | Optional medication reminder via WeChat template message at configured times | 服药时间提醒、漏服提醒 |
| P08-07 | AE 随访更新 | CRC-triggered follow-up request: patient receives notification to provide AE update (outcome, resolution date) | AE 更新、转归登记、CRC 追问 |

**核心交互流程:**

1. AE Reporting:
   - Patient taps "报告不适" from home screen or visit detail page → AE report form.
   - Step 1 - Symptom Description:
     - "您出现了什么症状/不适？" - text input with autocomplete from MedDRA LLT (lower level terms) dictionary cached in MiniApp (limited to study-relevant terms).
     - Severity: radio buttons for mild (不影响日常活动), moderate (部分影响日常活动), severe (严重影响日常活动/无法进行日常活动).
     - Start date: WeChat date picker (cannot be future date).
     - Is ongoing: toggle (yes → hide end date; no → show end date picker).
     - Action taken: multi-select (none / 自行用药 / 就医 / 住院 / 暂停研究用药 / 永久停药).
     - Outcome: radio (恢复中 / 已恢复未留后遗症 / 已恢复有后遗症 / 未恢复 / 死亡 / 未知).
   - Step 2 - Medication Relationship (if on study medication):
     - "您认为该症状与研究药物的关系是？" radio: 肯定有关 / 可能有关 / 可能无关 / 肯定无关 / 无法判断.
     - Advisory text: "此为您的个人判断，研究医生将进行专业评估。"
   - Step 3 - Concomitant Medication (optional):
     - "您是否使用了其他药物来处理此症状？" toggle → if yes → mini medication entry form (drug name, dose, start/stop date).
   - Step 4 - Supporting Info:
     - "可上传相关图片（如皮疹照片）" → optional image upload (max 3 photos).
   - Submit → POST /api/v1/subjects/{subjectId}/adverse-events with complete payload.

2. Server-side AE Processing:
   - Validate input; auto-classify AE:
     - Check SAE criteria (server-side, not visible to patient): death, life-threatening, hospitalization, disability, congenital anomaly, other important medical event.
     - If SAE → severity = SAE, trigger immediate escalation.
   - Store AdverseEvent record with status = REPORTED.
   - Map patient-reported symptom text to MedDRA LLT code via NLP matching (AI service or rule-based); store suggested_code + confidence; CRC reviews and confirms coding.
   - Publish AdverseEventReportedEvent to RabbitMQ.
   - Create Notification for responsible CRC with severity-based priority:
     - SAE: urgent (red badge, push + SMS if configured, expected response < 1 hour)
     - Severe: high (orange, expected response < 4 hours)
     - Moderate: normal (expected response < 24 hours)
     - Mild: low (review during next business day)
   - CRC acknowledges notification; AE status → ACKNOWLEDGED.

3. Medication Diary:
   - Patient taps "用药日记" → daily view with time slots.
   - Pre-populated with study medication schedule from protocol configuration; concomitant medications added by patient.
   - Each time slot: drug_name, prescribed_dose, actual_dose (editable), taken_time (tap to set), status (taken/missed/late), note.
   - Missed dose: reason selector + optional free text.
   - Weekly calendar strip at top for date navigation.
   - Submit daily: POST /api/v1/subjects/{subjectId}/medication-diary with {date, entries[]}.
   - Concomitant medication addition: "添加合并用药" button → drug name search/input, dose, unit, frequency, route, indication, start_date, ongoing toggle + end_date, photo of medication packaging (optional).

4. Medication Packaging OCR:
   - Patient taps camera icon → photo of medication box/label.
   - Upload to MinIO → OCR job (same pipeline as P04, but specialized model for drug labels).
   - Returns {drug_name, generic_name, batch_number, manufacturer, strength, expiry_date}.
   - Patient confirms extracted fields or corrects.
   - Populates medication diary entry with extracted drug name.

5. AE Follow-up:
   - CRC creates follow-up request for patient: "请更新您于{date}报告的症状{ae_term}的恢复情况".
   - Patient receives notification → taps → AE update form: outcome (dropdown), resolution_date (date picker if not ongoing), any_additional_info (free text).
   - Submit updates existing AdverseEvent record with new status update entry in `follow_up_entries` JSONB.

**核心字段:**

| 字段 | 类型 | 说明 |
|------|------|------|
| adverse_event_id | UUID (UUIDv7) | PK |
| subject_id | UUID | FK to Subject |
| study_id | UUID | FK to Study |
| visit_id | UUID | FK to Visit (optional, which visit period the AE occurred) |
| ae_term_patient | VARCHAR(500) | Patient's own words for the symptom |
| ae_term_meddra_llt | VARCHAR(200) | Suggested MedDRA LLT code (AI assisted) |
| ae_term_meddra_llt_code | VARCHAR(20) | MedDRA numeric code |
| ae_term_meddra_pt | VARCHAR(200) | MedDRA PT (after CRC review) |
| severity_patient | VARCHAR(20) | Patient-reported severity: mild, moderate, severe |
| severity_ctcae | VARCHAR(20) | CTCAE grade (after CRC/PI assessment) |
| seriousness | VARCHAR(30) | non-serious / serious (SAE) |
| sae_criteria | JSONB | Which SAE criteria met: {death, life_threatening, hospitalization, disability, congenital_anomaly, other} |
| start_date | DATE | AE onset date |
| end_date | DATE | AE resolution date (null if ongoing) |
| is_ongoing | BOOLEAN | Still ongoing |
| outcome | VARCHAR(50) | recovering, recovered_no_sequelae, recovered_with_sequelae, not_recovered, death, unknown |
| action_taken | JSONB | Array of actions: [self_medicated, visited_doctor, hospitalized, paused_study_drug, permanently_stopped] |
| causality_patient | VARCHAR(50) | Patient's causality assessment |
| causality_investigator | VARCHAR(50) | PI's causality assessment (after review) |
| concomitant_medications | JSONB | Array of {drug_name, dose, unit, route, indication, start_date, end_date} |
| follow_up_entries | JSONB | Array of {date, status_update, outcome_update, crc_notes} |
| status | VARCHAR(30) | reported → acknowledged → under_review → follow_up_needed → resolved |
| reported_by_proxy | BOOLEAN | Whether reported by caregiver |
| proxy_subject_id | UUID | If proxy-reported |
| image_urls | JSONB | Array of image URLs on MinIO |
| reported_at | TIMESTAMPTZ | When patient submitted |
| acknowledged_at | TIMESTAMPTZ | When CRC acknowledged |
| resolved_at | TIMESTAMPTZ | When resolved |

**异常场景:**

| 场景 | 处理方式 |
|------|----------|
| 患者报告症状符合潜在 SAE 标准但患者未意识 | 服务端自动检测 SAE 关键词；标记 seriousness=SERIOUS；强制升级通知 CRC/PI |
| 患者报告 AE 后长时间未得到 CRC 响应 | Response SLA tracking: SAE 1h, Severe 4h, Moderate 24h; 超时升级至 PI |
| 患者修改已提交的 AE 信息 | 患者仅可添加 follow-up update；不可修改已提交的原始信息；CRC 可编辑并留 audit trail |
| 用药日记与 AE 报告的关联缺失 | 鼓励但不强制关联；CRC 可在后台手工关联：AE ↔ MedicationDiary |
| 药品包装 OCR 识别错误 | 患者可在确认界面修改；置信度低的字段高亮；CRC 审核时可再次修正 |
| 患者频繁报告轻微头痛等 | 阈值设置为每周5次以上同症状 AE 触发重复报告检测；CRC 收到提示可合并为一条 AE |
| 离线报告 AE | 本地缓存；联网后提交；报告时间记录为患者实际报告时间（本地时间戳），非服务器接收时间 |

**权限/授权要求:**

- Patient: Can report new AEs, view own AE history, update AE outcome on CRC request, maintain medication diary
- Caregiver: Can report AEs on behalf of patient (with proxy annotation), maintain medication diary
- CRC: Can view all AEs, acknowledge, edit coding, create follow-up requests, merge duplicate AEs
- PI: Can view all AEs, perform causality assessment, sign off SAE reports
- Safety Officer / PV: Can view all SAEs, export for regulatory reporting
- Data Manager: Read-only for reconciliation; export for SDTM mapping

**关联数据实体:** AdverseEvent, MedicationDiary, Subject, Study, Visit, FileObject, OCRJob, Notification, AuditLog, SAE

**关联 REST API:**

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | /api/v1/subjects/{subjectId}/adverse-events | 创建 AE 报告 |
| GET | /api/v1/subjects/{subjectId}/adverse-events | 获取 AE 列表 |
| GET | /api/v1/adverse-events/{aeId} | 获取 AE 详情 |
| PATCH | /api/v1/adverse-events/{aeId}/follow-up | 添加 AE 随访更新 |
| POST | /api/v1/subjects/{subjectId}/medication-diary | 创建用药日记条目 |
| GET | /api/v1/subjects/{subjectId}/medication-diary | 获取用药日记（按日期范围） |
| GET | /api/v1/medication-diary/{entryId} | 获取单条用药记录 |
| PUT | /api/v1/medication-diary/{entryId} | 更新用药记录 |
| POST | /api/v1/files/{fileObjectId}/ocr/medication-label | 药品包装 OCR 识别 |
| POST | /api/v1/medication-diary/reminder | 设置用药提醒 |

---

### P09: 在线咨询 / 图文问答 / Tele-Visit Online Consultation, Text Q&A & Tele-Visit

**模块目标:** Enable secure text-based Q&A communication between patients and clinical research staff (CRC/PI), support image attachment for visual consultation, and provide tele-visit appointment booking with WeChat-native or third-party video call integration.

**子功能清单:**

| 序号 | 子功能 | 描述 | 关键操作 |
|------|--------|------|----------|
| P09-01 | 图文咨询 | Thread-based text messaging with CRC; support rich text and image attachment; conversation history with timestamps | 发送消息、图片附件、消息历史、未读计数 |
| P09-02 | 问题分类与路由 | Patient selects consultation topic (study-related, AE follow-up, visit logistics, technical support); routed to appropriate responder | 问题分类、智能路由、自动分配、转接 |
| P09-03 | 远程访视预约 | Book tele-visit appointment slot; view available CRC/PI time slots; receive confirmation and reminder | 预约日历、时段选择、确认通知、预约提醒 |
| P09-04 | 视频通话集成 | Deep-link to WeChat video call or third-party telehealth platform (e.g., Tencent TRTC); pre-call device test | 视频入口、设备检测、通话记录 |
| P09-05 | 咨询记录归档 | All exchanges automatically archived to subject record; searchable by CRC/PI for context on future interactions | 记录归档、全文搜索、联系上下文 |
| P09-06 | CRC 工作台集成 | CRC sees incoming patient messages in internal workbench; can respond, escalate to PI, or create tasks | 消息队列、回复、升级、转任务 |

**核心交互流程:**

1. Text Q&A Initiation:
   - Patient taps "在线咨询" → new conversation creation screen.
   - Required fields: consultation_topic (dropdown: 研究相关 / 不适症状咨询 / 访视安排 / 用药问题 / 报销咨询 / 技术支持 / 其他), subject (free text), priority (patient self-assessment: 一般 / 较急).
   - Optional: attach images (max 5, via gallery or camera, same upload flow as P04).
   - Submit → POST /api/v1/consultations → server creates ConsultationThread, assigns to appropriate CRC based on topic routing rules and CRC availability/load.
   - Patient sees thread UI: message bubbles (patient right-aligned, CRC left-aligned), timestamp, read status (single check = sent, double check = CRC read).

2. Messaging:
   - Patient types message → POST /api/v1/consultations/{threadId}/messages → server stores, updates thread updated_at, publishes ConsultationMessageEvent.
   - CRC receives notification in internal PMS workbench → opens conversation → messages flow bidirectionally.
   - Image messages: same presigned-URL upload pattern as P04; images displayed inline with lightbox preview on tap.
   - Read receipts: when CRC opens thread, PATCH /api/v1/consultations/{threadId}/read updates messages.read_at.

3. Tele-visit Booking:
   - Patient navigates to "远程访视预约" → views calendar of available slots (GET /api/v1/tele-visits/availability?crc_id=&date_range=).
   - Slots are configured by CRC via backend (available dates, time blocks, visit types).
   - Patient selects a slot → confirmation page with: CRC name, date, time, visit type, estimated duration, preparation requirements.
   - Confirm → POST /api/v1/tele-visits/book → creates TeleVisit record with status=BOOKED, publishes TeleVisitBookedEvent.
   - Both patient and CRC receive confirmation notification with calendar invite link.
   - Reminders at T-24h, T-1h via WeChat template message.
   - 15 min before appointment: MiniApp notification with "准备进入远程访视" button.

4. Video Call:
   - At appointment time, patient taps "进入视频通话" → routes to configured video platform:
     - Option A: wx.openVoIPChat (WeChat native VoIP, group call including patient + CRC + PI if needed).
     - Option B: Deep link to Tencent TRTC Mini Program plugin (for HIPAA-like compliance, recording capability, multi-party).
     - Option C: Third-party telehealth platform (webview embedded or external Mini Program jump).
   - Pre-call device check: camera preview, microphone test, speaker test.
   - Call metadata logged: start_time, end_time, duration, participants, recording_url (if applicable, stored in MinIO with encryption).

5. Consultation Archival:
   - All threads automatically saved as part of subject's permanent record.
   - CRC can flag important threads ("标记为重要") for easy retrieval.
   - Full-text search via OpenSearch indexing of message content (with appropriate masking per P10).
   - Thread status lifecycle: open → in_progress → resolved → closed (with optional reopen).

**核心字段:**

| 字段 | 类型 | 说明 |
|------|------|------|
| consultation_thread_id | UUID (UUIDv7) | PK |
| subject_id | UUID | FK to Subject |
| study_id | UUID | FK to Study |
| topic | VARCHAR(100) | Consultation topic category |
| subject | VARCHAR(500) | Patient's subject line |
| priority | VARCHAR(20) | low, medium, high |
| status | VARCHAR(30) | open → in_progress → resolved → closed |
| assigned_crc_user_id | UUID | CRC assigned to handle this consultation |
| last_message_at | TIMESTAMPTZ | Timestamp of most recent message |
| last_message_preview | VARCHAR(200) | Preview of last message |
| unread_count_patient | INTEGER | Unread messages for patient |
| unread_count_crc | INTEGER | Unread messages for CRC |
| is_archived | BOOLEAN | Whether archived |
| resolved_at | TIMESTAMPTZ | When marked resolved |
| resolution_summary | TEXT | CRC's summary of resolution |

| 字段 | 类型 | 说明 |
|------|------|------|
| message_id | UUID (UUIDv7) | PK |
| consultation_thread_id | UUID | FK to thread |
| sender_type | VARCHAR(20) | PATIENT, CAREGIVER, CRC, PI |
| sender_id | UUID | User/subject ID |
| message_type | VARCHAR(20) | text, image, file |
| content | TEXT | Text content (if text type) |
| image_urls | JSONB | Array of image URLs |
| sent_at | TIMESTAMPTZ | Server timestamp |
| read_at | TIMESTAMPTZ | When recipient read |

| 字段 | 类型 | 说明 |
|------|------|------|
| tele_visit_id | UUID (UUIDv7) | PK |
| subject_id | UUID | FK to Subject |
| visit_id | UUID | FK to Visit (if linked to study visit) |
| crc_user_id | UUID | FK to CRC User |
| scheduled_start | TIMESTAMPTZ | Appointment start time |
| scheduled_end | TIMESTAMPTZ | Appointment end time (estimated) |
| actual_start | TIMESTAMPTZ | Actual call start |
| actual_end | TIMESTAMPTZ | Actual call end |
| duration_seconds | INTEGER | Actual duration |
| video_platform | VARCHAR(50) | wechat_voip, tencent_trtc, third_party_name |
| video_room_id | VARCHAR(100) | Platform-specific room/session ID |
| recording_url | VARCHAR(500) | Recording storage URL |
| status | VARCHAR(30) | booked → confirmed → in_progress → completed → cancelled / no_show |
| cancellation_reason | VARCHAR(500) | If cancelled |
| preparation_notes | TEXT | CRC notes for patient preparation |

**异常场景:**

| 场景 | 处理方式 |
|------|----------|
| CRC 离线无法及时回复 | 自动回复消息："研究协调员当前不在线，我们将在工作时间（周一至周五 9:00-18:00）回复您。如有紧急情况，请联系{site_phone}。" |
| 消息发送失败（网络问题） | 本地缓存失败消息；显示发送失败图标（红色感叹号）；点击重试；最多重试3次后提示手动重试 |
| 预约时段被其他患者抢占 | 乐观锁：提交预约时检查 slot 是否仍可用；不可用则提示"此时段已被预约，请选择其他时段"并刷新可用时段 |
| 视频通话质量差/断线 | 提示"网络状况不佳"；自动切换到音频模式；断线后保留房间等待重新加入（5分钟窗口） |
| 第三方视频平台鉴权失败 | 降级到 WeChat VoIP 通话；如 VoIP 也不可用，电话联系 |
| Patient 发送不当内容 | CRC 可标记和隐藏内容；严重违规可冻结咨询功能（需 PI 审批） |
| 咨询内容涉及 AE 报告 | CRC 提示患者通过 P08 模块正式报告 AE；CRC 可基于咨询内容创建 AE 草稿 |

**权限/授权要求:**

- Patient: Can create consultation threads, send messages, upload images, book tele-visits, join video calls
- Caregiver: Can consult on behalf of patient (proxy mode)
- CRC: Can respond to all consultations, manage tele-visit schedule, flag/archive threads
- PI: Can view consultation history, participate in escalated consultations, participate in tele-visits
- Data Manager: Read-only; can export de-identified consultation data for oversight
- System Admin: Can configure video platform integration settings

**关联数据实体:** ConsultationThread, ConsultationMessage, TeleVisit, Subject, Study, User, Notification, FileObject, AuditLog

**关联 REST API:**

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | /api/v1/consultations | 创建咨询会话 |
| GET | /api/v1/consultations | 获取咨询会话列表 |
| GET | /api/v1/consultations/{threadId} | 获取会话详情（含消息列表） |
| POST | /api/v1/consultations/{threadId}/messages | 发送消息 |
| PATCH | /api/v1/consultations/{threadId}/read | 标记已读 |
| PATCH | /api/v1/consultations/{threadId}/resolve | 解决/关闭会话 |
| GET | /api/v1/tele-visits/availability | 查询可预约时段 |
| POST | /api/v1/tele-visits/book | 预约远程访视 |
| GET | /api/v1/subjects/{subjectId}/tele-visits | 获取远程访视列表 |
| PATCH | /api/v1/tele-visits/{teleVisitId}/cancel | 取消远程访视预约 |

---

### P10: 报销与补贴进度 Reimbursement & Subsidy Tracking

**模块目标:** Allow patients to submit reimbursement requests with receipt photos, track reimbursement and subsidy payment status in real-time, and view their cumulative compensation balance across study visits.

**子功能清单:**

| 序号 | 子功能 | 描述 | 关键操作 |
|------|--------|------|----------|
| P10-01 | 报销申请提交 | Form-based submission: amount, expense category, receipt photo(s), description; auto-fetch from configured visit reimbursement rules | 金额填写、类别选择、发票拍照、提交申请 |
| P10-02 | 报销状态追踪 | Visual status pipeline: submitted → under_review → approved → payment_processing → paid / rejected with reason | 状态流水线、进展推送、驳回原因展示 |
| P10-03 | 收款确认 | Patient confirms receipt of payment; system marks as paid_confirmed; reconciliation trigger | 收款确认、到账确认、银行回单上传 |
| P10-04 | 补贴余额视图 | Summary dashboard showing: total expected subsidy, received amount, pending amount, per-visit breakdown | 余额总览、分项明细、预估 vs 实际 |
| P10-05 | 报销历史 | Filterable list of all past reimbursements with amounts, status, dates | 历史列表、筛选、导出、年度汇总 |
| P10-06 | 系统自动报销 | For standard visit completion reimbursements (per protocol), auto-generate reimbursement on visit completion; patient just confirms | 自动报销、到访触发、患者确认 |

**核心交互流程:**

1. Reimbursement Submission:
   - Patient taps "报销与补贴" → dashboard view with total balance and "申请报销" button.
   - Two entry points:
     a. Manual: Patient fills form → selects reimbursement_type (交通费/检查费/其他), enters amount, attaches receipt photo(s) via camera/gallery (same upload flow as P04), adds description.
     b. Auto-generated: When CRC marks visit as COMPLETED, system auto-generates a Reimbursement record based on Study.reimbursement_rules JSONB (e.g., {visit_2: {transport: 200, meal: 50}}). Patient sees pending confirmation card: "访视2已完成，系统已生成本次补贴：交通费 ¥200 + 餐费 ¥50 = ¥250。请确认。" Patient taps "确认" or "修改" (if actual expense differs).
   - Receipt OCR: uploaded receipt image → OCR extracts amount, date, vendor_name for auto-fill validation (optional, available if AI service is configured).
   - Duplicate check: server compares MD5 hash + subject_id + date to detect duplicate receipt uploads.

2. Approval Flow (Backend, Flowable):
   - Reimbursement status: SUBMITTED → CRC reviews (verify receipt matches visit, amount within policy) → CRC_APPROVED → Finance reviews (verify compliance with financial policies) → FINANCE_APPROVED → PAYMENT_PROCESSING (finance initiates bank transfer) → PAID → PATIENT_CONFIRMED.
   - At each transition, RabbitMQ event published; MiniApp receives status update via polling or WebSocket-like notification.
   - Rejection: CRC or Finance can reject with reason → status = REJECTED, patient sees rejection reason and can resubmit with corrections.

3. Patient Status View:
   - Status pipeline visualized horizontally in MiniApp with completed steps highlighted and current step animated.
   - Each step shows timestamp of transition.
   - When status = PAID, patient sees "请确认是否已收到款项" button → taps "已收到" → status → PATIENT_CONFIRMED → reconciliation job triggered (see H08).

4. Subsidy Balance Dashboard:
   - GET /api/v1/subjects/{subjectId}/reimbursements/summary → JSON: {total_expected, total_paid, total_pending, total_rejected, per_visit_breakdown: [{visit_id, visit_name, expected, paid, pending}]}.
   - Visualized as: doughnut chart (paid vs pending vs rejected) + per-visit progress bars.
   - "预计总补贴" shown as sum of all protocol-defined visit reimbursements for completed visits + future pending.

5. Notification:
   - Status changes trigger WeChat template messages (if subscribed):
     - "您的报销申请已提交，研究协调员将进行审核。"
     - "您的报销已通过审核，预计3个工作日内到账。"
     - "您的报销款项 ¥{amount} 已汇出，请查收并确认。"
     - "您的报销申请被退回，原因：{reason}。请修改后重新提交。"

**核心字段:**

| 字段 | 类型 | 说明 |
|------|------|------|
| reimbursement_id | UUID (UUIDv7) | PK |
| subject_id | UUID | FK to Subject |
| study_id | UUID | FK to Study |
| visit_id | UUID | FK to Visit (nullable for non-visit reimbursements) |
| reimbursement_type | VARCHAR(50) | transport, examination, meal, accommodation, other, protocol_visit_subsidy |
| amount | DECIMAL(10,2) | Requested amount (CNY) |
| approved_amount | DECIMAL(10,2) | Final approved amount (may differ from requested) |
| receipt_file_ids | JSONB | Array of FileObject IDs |
| receipt_ocr_data | JSONB | OCR-extracted data from receipts |
| description | TEXT | Patient's description |
| status | VARCHAR(30) | submitted → under_review → crc_approved → finance_approved → payment_processing → paid → patient_confirmed / rejected |
| rejection_reason | TEXT | Reason for rejection |
| rejection_at | TIMESTAMPTZ | When rejected |
| rejected_by | UUID | User who rejected |
| payment_method | VARCHAR(50) | bank_transfer, wechat_pay, alipay, cash |
| payment_reference | VARCHAR(200) | Bank transaction ID, WeChat transfer ID |
| paid_amount | DECIMAL(10,2) | Actual paid amount |
| paid_at | TIMESTAMPTZ | When payment was sent |
| patient_confirmed_at | TIMESTAMPTZ | When patient confirmed receipt |
| is_auto_generated | BOOLEAN | Whether auto-generated from visit completion |
| flowable_process_instance_id | VARCHAR(64) | Flowable workflow instance ID |
| current_approver | UUID | Current user in approval chain |
| created_at | TIMESTAMPTZ | Submitted time |

**异常场景:**

| 场景 | 处理方式 |
|------|----------|
| 申请金额超过规定标准 | CRC 审核时标记；可批准低于标准金额；系统自动提示"申请金额 ¥{X} 超出标准 ¥{Y}" |
| 发票图片不清晰 | CRC 审核时退回，附带说明"请重新拍摄清晰的发票"；患者可重新上传 |
| 同一发票重复提交 | MD5 去重；提示"此发票已提交过（报销编号 {id}）" |
| 审批流程超时（CRC/FINANCE 未及时审批） | SLA 跟踪：CRC 48h、Finance 72h；超时自动升级至部门主管 |
| 患者长期未确认收款（PAID 状态 > 30d） | 自动推送3次提醒；之后标记为 PAID_UNCONFIRMED；CRC 跟进电话确认 |
| Payment 失败（银行退回） | 状态回退到 PAYMENT_PROCESSING；通知 Finance 重新支付；患者端显示"付款处理中，请耐心等待" |
| 患者退出研究后仍有未结算报销 | 退出时触发结算检查；已审批未付款的继续支付；未审批的按退出政策处理（支付/取消） |

**权限/授权要求:**

- Patient: Can submit reimbursement, view status, confirm receipt, view balance, view history
- Caregiver: Can submit on behalf of patient (with proxy)
- CRC: Can review and approve/reject reimbursement requests (up to configured limit)
- Finance: Can review and approve payment, mark as paid, manage payment methods
- PI: View reimbursement summary per subject
- Data Manager: Export reimbursement data for site payment reconciliation (H08)

**关联数据实体:** Reimbursement, Subject, Study, Visit, FileObject, Flowable Process Instance, AuditLog, Notification

**关联 REST API:**

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | /api/v1/subjects/{subjectId}/reimbursements | 创建报销申请 |
| GET | /api/v1/subjects/{subjectId}/reimbursements | 获取报销列表 |
| GET | /api/v1/reimbursements/{reimbursementId} | 获取报销详情（含审批状态） |
| PATCH | /api/v1/reimbursements/{reimbursementId}/confirm-payment | 患者确认收款 |
| GET | /api/v1/subjects/{subjectId}/reimbursements/summary | 获取补贴汇总仪表盘 |
| POST | /api/v1/reimbursements/{reimbursementId}/resubmit | 驳回后重新提交 |
| GET | /api/v1/reimbursements/{reimbursementId}/timeline | 获取审批时间线 |

---

### P11: 宣教与研究资料 Education & Study Resources

**模块目标:** Deliver study-related education materials, disease knowledge articles, medication instructions, and visit preparation guides to patients through the MiniApp, with full-text search, reading progress tracking, and content versioning aligned with protocol amendments.

**子功能清单:**

| 序号 | 子功能 | 描述 | 关键操作 |
|------|--------|------|----------|
| P11-01 | 宣教文章列表 | Categorized list of education articles (study-related, disease knowledge, medication guide, visit prep, lifestyle) | 分类列表、缩略图、阅读时长、发布时间 |
| P11-02 | 文章详情与富文本 | Rich text article rendering with images, tables, video embeds; font size adjustment; text-to-speech | 富文本渲染、字号调节、图片查看、视频播放 |
| P11-03 | 搜索功能 | Full-text search across articles; keyword highlighting; category filter | 关键词搜索、高亮、分类筛选、搜索历史 |
| P11-04 | 阅读进度追踪 | Track which articles patient has read; progress bar per category; CRC can view patient education compliance | 已读/未读标记、分类进度、CRC 合规视图 |
| P11-05 | 内容版本管理 | Articles versioned alongside protocol amendments; out-of-date content flagged; mandatory re-reading notifications | 版本号、更新标记、强制重读、变更摘要 |
| P11-06 | 推送推荐 | CRC or system recommends articles to specific subjects based on visit stage, AE, or non-compliance | 定向推送、阅读提醒、基于事件推荐 |
| P11-07 | 收藏与书签 | Patient can bookmark articles; "我的收藏" tab for quick access | 收藏、取消收藏、收藏列表 |

**核心交互流程:**

1. Article Browsing:
   - Patient taps "宣教资料" → categorized list view (default sort: newest/mandatory first).
   - Categories: "研究相关" (protocol overview, visit schedule, FAQ), "疾病知识" (condition background, treatment landscape), "用药指导" (study drug info, administration instructions, storage requirements), "访视准备" (per-visit preparation guides), "生活建议" (diet, exercise, mental health during trial).
   - Each article card: cover image, title, category badge, estimated reading time, "必读" pill (if mandatory), read status (grey dot = unread, green check = read).
   - Filter bar: category tabs + search icon.

2. Article Reading:
   - Tap article → article detail page.
   - Content rendered from article.content_html (stored as sanitized HTML on server, rendered via WXML `rich-text` component or custom markdown-to-WXML converter for better control).
   - Features: font size +/- buttons (persisted to local storage per user), text-to-speech (wx.createSelectorQuery + WebSpeech or third-party TTS plugin), image pinch-to-zoom preview.
   - Reading timer starts; server records read_started; on scroll to 100% + minimum time threshold (configurable, e.g., 60s for standard, 180s for mandatory), article marked as read.
   - Read status: POST /api/v1/education/{articleId}/read (auto-triggered when scroll depth >= 95% AND dwell time >= min_reading_time).

3. Search:
   - Patient taps search icon → search page with search bar, category filter chips, search history (local storage), hot searches.
   - Typing triggers debounced search (300ms): GET /api/v1/education/search?q={keyword}&categories={category_ids}.
   - Backend queries OpenSearch index `pms-education-articles` with fuzzy matching (fuzziness=AUTO), multi-field search (title^3, summary^2, content^1), category filter, status=published.
   - Results: relevance-sorted list with keyword highlighting (server returns hit positions; client wraps highlights in `<em class="highlight">`).

4. Content Management (Backend):
   - CRC/Study Manager creates articles in backend CMS; article has: title, summary, content (rich text editor), category, tags, cover_image, is_mandatory, min_reading_time, effective_from, effective_until, version, linked_protocol_version.
   - When new protocol amendment published: articles referencing old protocol version are flagged for review; author can update and bump version; previous version archived.
   - Mandatory re-read: if article version bumped AND is_mandatory=true AND subject has previously read old version → create EducationAssignment record for subject → notification: "研究资料已更新，请重新阅读" + deep link.

5. Targeted Push:
   - CRC views subject profile → "推送宣教" → selects article(s) + add personalized message → POST /api/v1/education/assign.
   - Event-driven auto-recommendation: when Visit status → DUE, system auto-assigns the "访视准备指南" article for that visit; when AE reported, auto-recommends "不良事件处理指南" article.

**核心字段:**

| 字段 | 类型 | 说明 |
|------|------|------|
| article_id | UUID (UUIDv7) | PK |
| study_id | UUID | FK to Study (nullable for general disease education) |
| title | VARCHAR(500) | Article title |
| summary | TEXT | Short summary/abstract |
| content_html | TEXT | Full article content in sanitized HTML |
| content_markdown | TEXT | Alternative format in Markdown |
| category | VARCHAR(50) | study_info, disease_knowledge, medication_guide, visit_prep, lifestyle |
| tags | JSONB | Array of tags for search/filter |
| cover_image_url | VARCHAR(500) | Article cover image |
| author_user_id | UUID | Author/Creator |
| is_mandatory | BOOLEAN | Required reading flag |
| min_reading_time_seconds | INTEGER | Minimum before auto-mark as read |
| read_count | INTEGER | Total read count (denormalized) |
| effective_from | TIMESTAMPTZ | When article becomes visible |
| effective_until | TIMESTAMPTZ | When article expires (null = never) |
| version | INTEGER | Content version number |
| previous_version_id | UUID | FK to previous Article version |
| linked_protocol_version | VARCHAR(50) | Associated protocol amendment version |
| status | VARCHAR(30) | draft → published → archived → superseded |
| created_at | TIMESTAMPTZ | Published time |

| 字段 | 类型 | 说明 |
|------|------|------|
| education_assignment_id | UUID (UUIDv7) | PK |
| subject_id | UUID | FK to Subject |
| article_id | UUID | FK to Article |
| assignment_type | VARCHAR(30) | mandatory, recommended, scheduled, crc_assigned |
| assigned_at | TIMESTAMPTZ | When assigned |
| read_started_at | TIMESTAMPTZ | When patient opened |
| read_completed_at | TIMESTAMPTZ | When marked as read |
| read_duration_seconds | INTEGER | Actual time spent reading |
| read_progress | DECIMAL(3,2) | Scroll depth percentage |
| is_read | BOOLEAN | Completed reading flag |
| assigned_by | UUID | User who assigned (null if system) |
| notification_sent | BOOLEAN | Whether reminder was sent |

**异常场景:**

| 场景 | 处理方式 |
|------|----------|
| 文章包含不兼容的 HTML 标签 | 服务端 HTML sanitizer (OWASP Java HTML Sanitizer) 白名单过滤；仅允许安全标签 |
| 视频内容在 MiniApp 中无法播放 | 使用 `<video>` 组件（需配置业务域名）；第三方视频平台提供小程序兼容链接；降级显示封面+跳转链接 |
| 患者从未阅读任何必读文章 | CRC dashboard 列出未读受试者；CRC 推送提醒；多次提醒后标记为依从性问题 |
| 文章内容更新后患者保留了旧版本记忆 | 版本号对照；如患者读过 v1 但 v2 已发布，显示"本文已更新"横幅 + 变更摘要 |
| 离线状态下查看文章 | 文章列表与已读文章基本 HTML 缓存于本地存储；首次阅读需联网加载完整内容 |
| 搜索无结果 | 显示"未找到相关结果" + 相关推荐（基于标签） + "试试其他关键词"提示 |
| 多语言需求（中英双语） | article 支持 locale 字段；根据患者偏好语言自动匹配；无匹配则 fallback 到默认语言 |

**权限/授权要求:**

- Patient: Can browse, search, read articles, bookmark favorites, view reading history
- Caregiver: Same as patient via proxy mode
- CRC: Can view patient reading compliance, assign articles, create/edit content
- Study Manager: Can create, edit, publish, archive articles; manage categories
- PI: View patient education compliance reports
- Content Approver: Approve articles before publish (if approval workflow enabled)

**关联数据实体:** EducationArticle, EducationAssignment, Subject, Study, OpenSearch Index, AuditLog

**关联 REST API:**

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api/v1/education/articles | 获取宣教文章列表（分页、分类筛选） |
| GET | /api/v1/education/articles/{articleId} | 获取文章详情 |
| GET | /api/v1/education/search | 搜索文章 |
| POST | /api/v1/education/articles/{articleId}/read | 标记文章为已读 |
| GET | /api/v1/education/articles/recommended | 获取推荐/必读文章 |
| GET | /api/v1/subjects/{subjectId}/education/assignments | 获取受试者宣教分配及阅读状态 |
| POST | /api/v1/subjects/{subjectId}/education/assign | CRC 为受试者分配宣教文章 |
| POST | /api/v1/education/articles/{articleId}/bookmark | 收藏文章 |
| DELETE | /api/v1/education/articles/{articleId}/bookmark | 取消收藏 |
| GET | /api/v1/education/bookmarks | 获取我的收藏 |

---

### P12: 隐私与授权中心 Privacy & Authorization Center

**模块目标:** Provide a transparent privacy control center where patients can view and manage their data sharing consents, see who has accessed their data and when, configure authorization scopes, request account deletion or study withdrawal, and access privacy policy documents.

**子功能清单:**

| 序号 | 子功能 | 描述 | 关键操作 |
|------|--------|------|----------|
| P12-01 | 数据共享授权管理 | List all active data sharing consents with scope details; toggle individual consents on/off (where permitted) | 授权列表、授权范围查看、授权开关、授权详情 |
| P12-02 | 授权范围查看/修改 | Granular control: share with primary physician, share with family, share with referring hospital, share for secondary research | 范围调整、追加授权、撤销授权 |
| P12-03 | 数据使用日志 | Who accessed my data (CRC, PI, Monitor, Auditor), what action, when, and why (purpose) | 访问日志、操作类型、访问者身份、访问目的 |
| P12-04 | 账户注销 | Request account deletion; data retention policy explanation; confirmation with cooling-off period | 注销申请、冷静期、数据处理说明、确认注销 |
| P12-05 | 退出研究申请 | Request study withdrawal; explain consequences (data already collected will be retained per regulations); confirm or cancel | 退出申请、退出后果说明、数据保留政策、确认 |
| P12-06 | 隐私政策展示 | Display current and historical privacy policies; highlight changes between versions; require acknowledgment on major updates | 隐私政策查看、版本历史、变更摘要、确认回执 |
| P12-07 | 数据下载 | Request export of personal data (data portability); async generation; notification when ready | 数据导出申请、异步生成、下载通知 |

**核心交互流程:**

1. Data Sharing Consent Management:
   - Patient opens "隐私与授权中心" from profile menu.
   - Main dashboard shows:
     - Active consents count badge.
     - "上次数据访问: {date} by {role}" quick info.
     - Quick action grid: 授权管理 / 访问日志 / 数据下载 / 隐私政策 / 注销账户 / 退出研究.
   - Consent list: each row shows {consent_purpose, scope_description, granted_at, status, toggle}.
   - Standard consents (mandatory for study participation, cannot be toggled off): "临床研究数据采集与使用 (必需)", "不良事件上报 (必需)", "研究访视数据收集 (必需)".
   - Optional consents (can be toggled on/off by patient): "数据共享给主治医生", "数据用于二次研究 (去标识化)", "接收研究结果通知", "数据共享给第三方合作机构 (去标识化)".
   - Toggle consent → PATCH /api/v1/subjects/{subjectId}/privacy-consents/{consentId} with {granted: true/false}.

2. Data Usage Log:
   - GET /api/v1/subjects/{subjectId}/data-access-log?from=&to=&page=
   - Each log entry: date_time, accessed_by_role (CRC/PI/Monitor/Auditor/System), accessed_by_name (masked for role-based display), action_type (view, export, modify, delete), data_category (demographics, labs, questionnaire, AE, consent), purpose (study_monitoring, safety_review, data_verification, quality_audit), ip_address (partially masked).
   - Patient can filter by date range and action type.
   - For each entry, patient can tap "质疑" (question) to flag suspicious/unexpected access → creates a DataAccessQuery task for DPO (Data Protection Officer) review.

3. Account Deletion:
   - Patient taps "注销账户" → information page explaining:
     - What data will be deleted (personal identifiers, contact info).
     - What data will be retained (de-identified study data per regulatory requirements, audit logs, consent records).
     - Timeline: 7-day cooling-off period; after 7 days, account deletion executed.
     - Irreversibility warning.
   - Patient confirms → POST /api/v1/subjects/{subjectId}/request-deletion → status = DELETION_REQUESTED.
   - 7-day countdown shown; patient can cancel during cooling-off period.
   - On day 7: scheduled job executes deletion → anonymizes PII, retains de-identified data + mandatory records → status = DELETED.

4. Study Withdrawal:
   - Patient taps "申请退出研究" → information page explaining:
     - "退出研究后，您将不再接受研究相关访视和干预。"
     - "已完成的数据将被保留并可能用于研究分析（去标识化），这是监管要求。"
     - "您可以随时改变主意，在数据锁定前重新加入研究。"
   - Patient confirms → POST /api/v1/subjects/{subjectId}/request-withdrawal with {reason: optional selection + free text}.
   - Creates WithdrawalRequest record; Subject status NOT immediately changed → creates task for CRC/PI.
   - CRC contacts patient for exit interview; confirms withdrawal → Subject status → WITHDRAWN.
   - Withdrawal triggers: all future visits CANCELLED, future notifications disabled, reimbursement settlement initiated (if any pending).

5. Data Export (Data Portability):
   - Patient taps "下载我的数据" → selects data categories (demographics, questionnaire responses, observations, reports, AE history, consent records) → selects format (PDF summary / CSV detailed).
   - POST /api/v1/subjects/{subjectId}/data-export-requests → server creates async export job.
   - Job generates ZIP file with selected data categories + data dictionary; stores in MinIO temp bucket (72h TTL).
   - Patient receives notification when ready → downloads via presigned URL.
   - Download event logged to DataAccessLog.

**核心字段:**

| 字段 | 类型 | 说明 |
|------|------|------|
| privacy_consent_id | UUID (UUIDv7) | PK |
| subject_id | UUID | FK to Subject |
| consent_type | VARCHAR(50) | data_sharing_physician, secondary_research, third_party, result_notification |
| consent_name | VARCHAR(200) | Human-readable name |
| consent_description | TEXT | Detailed description of what data is shared, with whom, for what purpose |
| is_mandatory | BOOLEAN | Whether this consent is required for study participation |
| granted | BOOLEAN | Current grant state |
| granted_at | TIMESTAMPTZ | When first granted |
| updated_at | TIMESTAMPTZ | When last toggled |
| expires_at | TIMESTAMPTZ | Optional expiry |

| 字段 | 类型 | 说明 |
|------|------|------|
| data_access_log_id | UUID (UUIDv7) | PK |
| subject_id | UUID | FK to Subject |
| accessed_by_user_id | UUID | FK to User |
| accessed_by_role | VARCHAR(50) | CRC, PI, Monitor, Auditor, System |
| action_type | VARCHAR(50) | view, export, modify, delete, create |
| data_category | VARCHAR(50) | demographics, consent, questionnaire, observation, ae, file, all |
| purpose | VARCHAR(200) | study_monitoring, safety_review, source_data_verification, quality_audit, system_process |
| ip_address | VARCHAR(45) | Partially masked in patient view: 192.168.XXX.XXX |
| user_agent | VARCHAR(500) | Browser/client info |
| accessed_at | TIMESTAMPTZ | Access timestamp |

| 字段 | 类型 | 说明 |
|------|------|------|
| deletion_request_id | UUID (UUIDv7) | PK |
| subject_id | UUID | FK to Subject |
| requested_at | TIMESTAMPTZ | When patient requested |
| cooling_off_until | TIMESTAMPTZ | Requested at + 7 days |
| cancelled_at | TIMESTAMPTZ | If cancelled during cooling off |
| executed_at | TIMESTAMPTZ | When deletion executed |
| status | VARCHAR(30) | requested → cancelled / executed |

| 字段 | 类型 | 说明 |
|------|------|------|
| withdrawal_request_id | UUID (UUIDv7) | PK |
| subject_id | UUID | FK to Subject |
| study_id | UUID | FK to Study |
| reason_category | VARCHAR(50) | adverse_event, personal_reason, lost_to_followup, withdrew_consent, physician_decision, other |
| reason_detail | TEXT | Free text reason |
| requested_at | TIMESTAMPTZ | When patient submitted |
| crc_contact_at | TIMESTAMPTZ | When CRC conducted exit interview |
| withdrawal_confirmed_at | TIMESTAMPTZ | When CRC confirmed withdrawal |
| status | VARCHAR(30) | requested → exit_interview → confirmed → completed |

**异常场景:**

| 场景 | 处理方式 |
|------|----------|
| 患者关闭强制授权（尝试 PATCH mandatory consent） | 服务端校验 is_mandatory=true → 返回 403: "此授权为研究参与所必需，不可关闭" |
| 注销冷静期后患者找回账号 | 账号已不可恢复；PII 已删除；仅可联系 DPO 查看保留的去标识化数据 |
| 数据导出包含大量数据导致超时 | 异步任务处理；10分钟后若未完成自动延长；超时后通知用户"数据导出失败，请联系技术支持" |
| 患者质疑数据访问日志条目 | 创建 DataAccessQuery 任务通知 DPO；DPO 48h内回复解释；回复在 MiniApp 中展示 |
| 撤回退出研究申请 | 在 CRC 确认前可撤回 → PATCH /api/v1/withdrawal-requests/{id}/cancel；已确认的撤回不可撤销 |
| 政策更新后患者未确认 | 新隐私政策发布后，首次登录需弹出确认弹窗（强制）；未确认前限制部分功能（可查看但不可新增数据） |
| 数据下载链接分享给他人 | 下载链接设置过期时间（72h）+ 绑定 WeChat openid 校验（仅原请求者可下载）+ 水印 |

**权限/授权要求:**

- Patient: Can manage consent toggles, view access log, request deletion/withdrawal/export, challenge access entries
- Caregiver: Can view but not modify patient's privacy settings (unless specifically authorized in caregiver scope for withdrawal)
- CRC: Can view consent status; process withdrawal requests; cannot modify consent
- PI: Can view withdrawal reasons for oversight; cannot delete or modify consent
- DPO (Data Protection Officer): Can view all consent, access log, deletion requests; respond to patient challenges
- Auditor: Can view access logs, consent history, deletion/withdrawal records (for compliance audit)
- System Admin: Configures retention policies, mandatory consent templates, privacy policy content

**关联数据实体:** PrivacyConsent, DataAccessLog, DeletionRequest, WithdrawalRequest, DataExportRequest, Subject, Study, AuditLog, FileObject

**关联 REST API:**

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api/v1/subjects/{subjectId}/privacy-consents | 获取所有授权状态 |
| PATCH | /api/v1/subjects/{subjectId}/privacy-consents/{consentId} | 修改授权开关 |
| GET | /api/v1/subjects/{subjectId}/data-access-log | 获取数据访问日志 |
| POST | /api/v1/data-access-log/{logId}/challenge | 质疑某条访问记录 |
| POST | /api/v1/subjects/{subjectId}/request-deletion | 申请账户注销 |
| PATCH | /api/v1/deletion-requests/{requestId}/cancel | 取消注销申请（冷静期内） |
| POST | /api/v1/subjects/{subjectId}/request-withdrawal | 申请退出研究 |
| PATCH | /api/v1/withdrawal-requests/{requestId}/cancel | 撤回退出申请 |
| POST | /api/v1/subjects/{subjectId}/data-export-requests | 请求数据导出 |
| GET | /api/v1/data-export-requests/{requestId} | 查询导出请求状态 |
| GET | /api/v1/privacy-policy | 获取当前隐私政策 |
| GET | /api/v1/privacy-policy/versions | 获取历史隐私政策版本 |
| POST | /api/v1/privacy-policy/{versionId}/acknowledge | 确认隐私政策更新 |

---

# PART B: Data & Integration Hub Modules (H01-H10)

---

### H01: 患者主索引与研究受试者 ID 映射 Patient Master Index & Subject ID Mapping

**模块目标:** Establish a cross-study Patient Master Index (PMI) that uniquely identifies individual patients across multiple clinical studies, manages the mapping between PMI IDs and study-specific Subject IDs, handles de-duplication with merge/split logic, and provides a unified patient identity service for the entire platform.

**子功能清单:**

| 序号 | 子功能 | 描述 | 关键操作 |
|------|--------|------|----------|
| H01-01 | PMI 注册与 ID 生成 | On first interaction, register patient in PMI; generate unique, persistent PMI ID (UUIDv7); link to WeChat unionId and other identifiers | PMI 注册、ID 生成、多标识符关联 |
| H01-02 | Subject ID → PMI ID 映射 | Maintain bidirectional mapping between each Subject record (study-specific) and the PMI record; one PMI can have N Subjects | 映射创建、双向查询、跨研究关联 |
| H01-03 | 去重规则引擎 | Configurable deterministic and probabilistic matching rules to identify duplicate patient records; matching on name, ID number, phone, WeChat unionId | 精确匹配、概率匹配、规则配置、分数阈值 |
| H01-04 | 合并 (Merge) 处理 | Merge duplicate PMI records when identified; cascade update all linked Subject records; preserve audit trail of merge operation | 幸存者选择、字段合并策略、级联更新、审计记录 |
| H01-05 | 拆分 (Split) 处理 | Split incorrectly merged PMI records; restore original records; reverse cascade updates | 合并回滚、记录拆分、级联恢复 |
| H01-06 | 匹配候选审核 | Present potential duplicates to Data Manager for human review; accept/reject merge suggestions | 候选列表、人工审核、接受/拒绝、反馈学习 |

**核心交互流程:**

1. PMI Registration:
   - When a new Subject (status=LEAD) is created (see P01), the system checks if this patient already has a PMI record:
     - Query PMI by WeChat unionId (from MiniApp login) → if found, link existing PMI.
     - Query PMI by deterministic match (ID number + name) → if exactly one match, link (auto-merge).
     - Query PMI by probabilistic match (name + phone + birth_date) → if match_score >= auto_merge_threshold (configurable, default 0.95), auto-link; if match_score between review_threshold (0.80) and auto_merge_threshold, create CandidateMerge for Data Manager review; if < review_threshold, create new PMI record.
   - New PMI record: {pmi_id, identifiers: [{type: wechat_union_id, value: ...}, {type: national_id, value: ...}], demographics: {name, gender, birth_date, phone, ...}, created_at}.

2. ID Mapping:
   - Mapping table: PMI_Subject_Mapping {pmi_id, subject_id, study_id, mapping_type (AUTO, MANUAL, MERGED), created_at, created_by}.
   - Query patterns:
     - "Given a subject_id, find PMI and all other studies this person is in" → GET /api/v1/pmi/by-subject/{subjectId} returns {pmi_record, linked_subjects: [{subject_id, study_id, study_name, status}]}.
     - "Given a PMI, find all subject records" → GET /api/v1/pmi/{pmiId}/subjects.
     - Cross-study duplicate check: "Is this patient already in study X?" → query PMI_Subject_Mapping WHERE pmi_id = ? AND study_id = ?.
   - CRC/PI can view cross-study participation (with access control: only studies within same organization/sponsor).

3. Deduplication Engine:
   - Scheduled job (daily, off-peak) or trigger-based (on new PMI registration).
   - Match rules configured in JSONB (pmi_match_rules on system config):
     ```
     {
       "rules": [
         {"name": "exact_wechat_unionid", "fields": ["wechat_unionid"], "match_type": "deterministic", "weight": 1.0},
         {"name": "exact_national_id", "fields": ["national_id"], "match_type": "deterministic", "weight": 1.0},
         {"name": "fuzzy_name_phone", "fields": ["name", "phone"], "match_type": "probabilistic", "weight": 0.8, "algorithm": "jaro_winkler"},
         {"name": "fuzzy_name_birthdate", "fields": ["name", "birth_date"], "match_type": "probabilistic", "weight": 0.7}
       ],
       "auto_merge_threshold": 0.95,
       "review_threshold": 0.80
     }
     ```
   - Engine runs pairwise comparison on active PMI records (optimized with blocking keys: first 3 chars of name + phone hash).
   - For each candidate pair above review_threshold: create CandidateMerge record with match_details (which rules matched, individual scores, composite score).

4. Merge Execution:
   - Auto-merge (score >= auto_merge_threshold):
     - Select survivor PMI (based on: most complete data, oldest record, most linked subjects).
     - Merge demographics: survivor fields retained; non-null fields from non-survivor merged only if survivor field is null (configurable per field).
     - Cascade: UPDATE PMI_Subject_Mapping SET pmi_id = survivor_id WHERE pmi_id = non_survivor_id.
     - Mark non-survivor PMI: status = MERGED, merged_into_pmi_id = survivor_id.
     - Insert MergeAuditLog: {operation: merge, survivor_pmi_id, merged_pmi_ids, fields_merged, executed_by, executed_at}.
     - Publish PMIMergedEvent to RabbitMQ (for downstream system notifications).
   - Manual merge: Data Manager reviews CandidateMerge, approves → executes same logic with MANUAL merge_type.

5. Split (Unmerge):
   - Data Manager identifies erroneous merge → initiates split.
   - System retrieves the MergeAuditLog from the original merge operation.
   - Reverse cascade: restore original PMI records; re-establish original PMI_Subject_Mapping links.
   - Mark original merge as REVERSED; insert new SplitAuditLog.
   - If new data has been added to survivor since merge, that data remains with survivor; only pre-merge associations are restored.

**核心字段:**

| 字段 | 类型 | 说明 |
|------|------|------|
| pmi_id | UUID (UUIDv7) | Primary key for Patient Master Index |
| identifiers | JSONB | [{type: wechat_unionid, value, is_primary}, {type: national_id, value, is_primary}, {type: passport, value}, {type: phone, value}] |
| name | VARCHAR(200) | Full name (can be masked per permissions) |
| gender | VARCHAR(10) | Male, Female, Other, Unknown |
| birth_date | DATE | Date of birth |
| primary_phone | VARCHAR(20) | Primary contact number |
| email | VARCHAR(200) | Email address |
| address | JSONB | {province, city, district, detail} |
| status | VARCHAR(30) | active → merged → deleted |
| merged_into_pmi_id | UUID | If merged, points to survivor PMI |
| pmi_version | INTEGER | Optimistic locking version |
| match_hash | VARCHAR(64) | Pre-computed hash for blocking in dedup engine |
| created_at | TIMESTAMPTZ | Registration timestamp |
| updated_at | TIMESTAMPTZ | Last update timestamp |

| 字段 | 类型 | 说明 |
|------|------|------|
| mapping_id | UUID (UUIDv7) | PK |
| pmi_id | UUID | FK to PMI |
| subject_id | UUID | FK to Subject |
| study_id | UUID | FK to Study (denormalized for query convenience) |
| mapping_type | VARCHAR(20) | AUTO, MANUAL, MERGED, SPLIT |
| created_at | TIMESTAMPTZ | When mapping was created |
| created_by | UUID | User or SYSTEM |

| 字段 | 类型 | 说明 |
|------|------|------|
| candidate_merge_id | UUID (UUIDv7) | PK |
| source_pmi_id | UUID | PMI A |
| target_pmi_id | UUID | PMI B |
| composite_score | DECIMAL(3,2) | Overall match score |
| match_details | JSONB | Per-rule scores and matched values |
| status | VARCHAR(30) | pending → approved → rejected → auto_merged |
| reviewed_by | UUID | Data Manager who reviewed |
| reviewed_at | TIMESTAMPTZ | When reviewed |
| review_decision | VARCHAR(20) | APPROVED, REJECTED |

| 字段 | 类型 | 说明 |
|------|------|------|
| merge_audit_id | UUID (UUIDv7) | PK |
| operation | VARCHAR(20) | MERGE, SPLIT |
| survivor_pmi_id | UUID | Surviving PMI after merge |
| affected_pmi_ids | JSONB | All PMI IDs involved |
| fields_merged | JSONB | Which fields were merged from which source |
| executed_by | UUID | User or SYSTEM |
| executed_at | TIMESTAMPTZ | Operation timestamp |
| reversed | BOOLEAN | Whether this merge was later split |
| reversed_by | UUID | User who split |
| reversed_at | TIMESTAMPTZ | When split |

**异常场景:**

| 场景 | 处理方式 |
|------|----------|
| 同一患者在多中心注册，中心间使用了不同身份证件 | PMI 通过 WeChat unionId 或姓名+出生日期匹配；无法自动合并时创建 CandidateMerge 人工审核 |
| 双胞胎或多胞胎匹配混淆 | 概率匹配分数在 0.85-0.95 之间（相同姓+出生日期，不同名+身份证号）；系统要求人工审核（决不自动合并双胞胎） |
| 自动合并后 CRC 发现错误合并 | Data Manager 执行 Split 操作；系统恢复原始记录；合并审计日志完整保留 |
| PMI 匹配引擎性能下降（大数据量） | 使用 blocking keys 减少 pairwise 比较；增量匹配（仅处理新增/更新的 PMI 记录）；定时全量匹配在低峰期运行 |
| 身份证号变更（如身份证换号） | 患者可在 MiniApp 申请更新证件信息；CRC 审核通过后更新；系统自动重新运行匹配引擎 |
| 同一患者在同一研究中创建了两个 Subject（操作失误） | 不通过 PMI merge 解决；由 CRC 使用 Subject merge 功能合并同一研究内的 Subject；PMI mapping 更新 |
| GDPR/个人信息保护法 — 患者要求删除 PII | PMI 进入 FORGETTEN 状态；PII 字段置 NULL 或哈希化；mapping 关系保留（de-identified）；审计日志不可删除 |

**权限/授权要求:**

- Patient: Cannot directly access PMI; interacts through P12 privacy center
- CRC: Can view cross-study participation for subjects in their site; cannot manually merge/split
- PI: Can view cross-study participation; cannot merge/split
- Data Manager: Can view CandidateMerge list; approve/reject merges; initiate splits
- System Admin: Configure matching rules, thresholds, blocking keys
- Integration: System-to-system; PMI lookup API available for authorized external systems

**关联数据实体:** PMI, PMI_Subject_Mapping, CandidateMerge, MergeAuditLog, Subject, Study

**关联 REST API:**

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api/v1/pmi/by-subject/{subjectId} | 通过 Subject ID 查询 PMI 及跨研究信息 |
| GET | /api/v1/pmi/{pmiId} | 获取 PMI 详情 |
| GET | /api/v1/pmi/{pmiId}/subjects | 获取 PMI 关联的所有 Subject |
| GET | /api/v1/pmi/search | 搜索 PMI（按姓名、证件号、手机号） |
| GET | /api/v1/pmi/candidate-merges | 获取待审核的合并候选列表 |
| POST | /api/v1/pmi/candidate-merges/{id}/approve | 批准合并 |
| POST | /api/v1/pmi/candidate-merges/{id}/reject | 拒绝合并 |
| POST | /api/v1/pmi/{pmiId}/split | 拆分错误合并的 PMI |
| GET | /api/v1/pmi/{pmiId}/merge-audit | 获取合并/拆分审计日志 |

---

### H02: HIS/LIS/PACS/EMR 接口适配 Hospital System Interface Adapters

**模块目标:** Provide a unified adapter framework for integrating with heterogeneous hospital information systems (HIS, LIS, PACS, EMR) across multiple clinical sites, transforming various communication protocols (HL7 v2, FHIR, WebService, custom API) into a canonical data model, with per-site credential management and connection health monitoring.

**子功能清单:**

| 序号 | 子功能 | 描述 | 关键操作 |
|------|--------|------|----------|
| H02-01 | 适配器工厂 | Adapter factory pattern: register adapter implementations per integration type; dynamic loading based on site configuration | 适配器注册、按类型实例化、动态加载、插件化 |
| H02-02 | HL7 v2 适配器 | Receive and parse HL7 v2.x messages (ADT, ORM, ORU, MDM); map HL7 segments to canonical model; handle ACK | HL7 解析、段映射、ACK 生成、MLLP 传输 |
| H02-03 | FHIR 适配器 | FHIR R4 client and server endpoints; support Patient, Observation, DiagnosticReport, MedicationRequest, DocumentReference resources | FHIR Client/Server、资源映射、Bundle 处理 |
| H02-04 | WebService/SOAP 适配器 | Legacy hospital system integration via SOAP WebService; WSDL parsing; XML/JSON mapping | WSDL 解析、SOAP 调用、XML 映射 |
| H02-05 | Custom API 适配器 | Generic REST adapter for hospitals with custom APIs; configurable endpoint, auth, request/response mapping via JSON template | 自定义 REST、模板化映射、认证配置 |
| H02-06 | 规范数据模型 (CDM) | Canonical Data Model definition; all external data transformed to CDM before entering PMS domain; CDM versioning | CDM 定义、数据转换、版本管理 |
| H02-07 | 站点凭据管理 | Per-site credential vault (encrypted at rest); connection parameters; certificate management; credential rotation | 凭据加密、连接配置、证书管理、轮换 |
| H02-08 | 连接健康监控 | Periodic health check per site integration; latency tracking; alert on connection failure; dashboard | 健康检查、延迟监控、故障告警、状态仪表盘 |

**核心交互流程:**

1. Adapter Configuration:
   - System Admin configures a new site integration: POST /api/v1/integration-sites with {site_id, hospital_name, integration_type (HL7V2 | FHIR | SOAP | CUSTOM_REST), connection_params JSONB, credential_ref, adapter_class}.
   - On deployment, AdapterFactory loads the adapter class (Spring bean implementing `HospitalAdapter` interface) and initializes with site-specific config.
   - Each adapter instance is scoped to one site (singleton per site, managed by Spring container).

2. HL7 v2 Adapter (Typical Flow):
   - TCP/MLLP Listener: Spring Integration (or custom Netty-based MLLP server) listens on configured port for HL7 v2 messages.
   - Message received → parsed by HAPI library (or HL7-dotnet if .NET) → produces Message object.
   - Message type routing: ADT^A01/A04/A08 (patient admit/register/update) → PatientService; ORU^R01 (observation result) → ObservationService; ORM^O01 (order) → OrderService; MDM^T02 (document) → DocumentService.
   - HL7-to-CDM Mapper: extracts relevant fields from HL7 segments (PID → demographics, OBR/OBX → lab results, etc.) → builds CDM objects (CdmPatient, CdmObservation, CdmDiagnosticReport).
   - CDM objects → domain mapping → create/update PMS entities (Subject, Observation, DiagnosticReport, FileObject).
   - ACK generation: success → ACK with AA (Application Accept); validation error → ACK with AE (Application Error) + error description.
   - All raw HL7 messages stored in MinIO `pms-hl7-archive/{site_id}/{date}/{message_control_id}.hl7` for audit and re-processing.

3. FHIR Adapter (Typical Flow):
   - FHIR Server endpoint: PMS exposes FHIR R4 RESTful API at `/fhir/r4/` (using HAPI FHIR JPA Server or custom Spring-based FHIR facade).
   - Hospital systems can push FHIR resources (POST/PUT) or PMS can pull (scheduled GET with search parameters).
   - Supported resources and mapping:
     - Patient → CdmPatient → PMI + Subject
     - Observation (lab results, vitals) → CdmObservation → Observation
     - DiagnosticReport → CdmDiagnosticReport → DiagnosticReport
     - MedicationRequest → CdmMedication → MedicationDiary
     - DocumentReference → CdmDocument → FileObject
   - FHIR-to-CDM Mapper: converts FHIR resources to CDM objects using pre-configured mapping templates.
   - CDM validation: required fields, data types, code system validation (LOINC, SNOMED, ICD-10) before persisting.
   - If PMS is the source (sending data to hospital): transform PMS entities → FHIR resources → POST to hospital FHIR server endpoint.

4. CDM Transformation Pipeline:
   - All incoming data (regardless of source protocol) enters the CDM Transformation Pipeline:
     ```
     Source Message → Protocol Parser → CDM Mapper → CDM Validator → Domain Mapper → PMS Entity
     ```
   - CDM classes: CdmPatient, CdmObservation, CdmDiagnosticReport, CdmMedication, CdmDocument, CdmEncounter (visit).
   - CDM version tracking: each CDM class has a version; mapper configurations are versioned and stored in DB (IntegrationMappingConfig JSONB).
   - Transformation logging: each step logged for troubleshooting; failed transformations captured with original message for re-processing.

5. Credential Management:
   - Credentials stored in a dedicated table (integration_credentials) with column-level encryption (PostgreSQL pgcrypto or application-level AES-256-GCM).
   - Types: basic_auth (username + encrypted password), oauth2_client_credentials (client_id, encrypted client_secret, token_url), api_key (encrypted key), tls_client_cert (cert reference to secure vault), vpn_tunnel (tunnel config reference).
   - Credential rotation: automated via scheduled job that checks expiry date; generates alert 30d/7d/1d before expiry; optional auto-renewal for OAuth 2.0 tokens.
   - Access: credentials never exposed via API in plaintext; masked in UI (e.g., "****a1b2"); access to credential management requires elevated permission.

6. Health Monitoring:
   - Each adapter implements `HealthCheckable` interface with `ping()` method → returns {status: UP|DOWN, latency_ms, last_success_at, error_message}.
   - HealthCheckScheduler: runs per configured interval (default 5 min); aggregate results on dashboard.
   - Consecutive failures: 3 consecutive DOWN → WARNING notification; 10 consecutive → CRITICAL escalation to IT Ops.
   - Metrics tracked in time-series DB (or Redis + periodic flush to PG): latency p50/p95/p99, message volume, error rate.

**核心字段:**

| 字段 | 类型 | 说明 |
|------|------|------|
| integration_site_id | UUID (UUIDv7) | PK |
| site_id | UUID | FK to Site |
| hospital_name | VARCHAR(200) | Hospital name |
| integration_type | VARCHAR(30) | HL7V2, FHIR, SOAP, CUSTOM_REST, SFTP, DICOM |
| adapter_class | VARCHAR(300) | Fully qualified Spring bean class name |
| connection_params | JSONB | {host, port, endpoint_url, timeout_ms, retry_count, tls_enabled} |
| credential_id | UUID | FK to IntegrationCredential |
| mapping_config_id | UUID | FK to IntegrationMappingConfig |
| status | VARCHAR(30) | active → inactive → maintenance → error |
| health_check_enabled | BOOLEAN | Whether periodic health check is active |
| last_health_check_at | TIMESTAMPTZ | Last health check timestamp |
| last_health_status | VARCHAR(20) | UP, DOWN, DEGRADED |
| message_volume_daily | INTEGER | Avg messages per day (rolling 30d) |

| 字段 | 类型 | 说明 |
|------|------|------|
| credential_id | UUID (UUIDv7) | PK |
| credential_name | VARCHAR(100) | Descriptive name |
| auth_type | VARCHAR(30) | basic, oauth2, api_key, tls_cert, none |
| auth_params | BYTEA | Encrypted JSON: {username, password_cipher, client_id, client_secret_cipher, token_url, api_key_cipher} |
| encryption_algorithm | VARCHAR(20) | AES-256-GCM |
| encryption_key_version | VARCHAR(20) | Key version for rotation |
| expires_at | TIMESTAMPTZ | Credential expiry |
| rotation_reminder_days | JSONB | [30, 7, 1] days before expiry for alerts |
| last_rotated_at | TIMESTAMPTZ | Last rotation timestamp |
| created_by | UUID | Creator |

| 字段 | 类型 | 说明 |
|------|------|------|
| mapping_config_id | UUID (UUIDv7) | PK |
| config_name | VARCHAR(100) | Human-readable config name |
| source_protocol | VARCHAR(30) | HL7V2, FHIR, SOAP, CUSTOM |
| source_version | VARCHAR(20) | Protocol version (e.g., "2.5.1", "R4") |
| cdm_version | VARCHAR(20) | Target CDM version |
| field_mappings | JSONB | Detailed field-to-field mapping rules |
| transformation_rules | JSONB | Data transformation logic (e.g., code system mappings, unit conversions) |
| validation_rules | JSONB | Per-field validation rules |
| is_active | BOOLEAN | Whether this mapping config is active |
| created_by | UUID | Creator |

**异常场景:**

| 场景 | 处理方式 |
|------|----------|
| HL7 消息格式错误（不符合标准） | 解析失败 → 记录错误到 Dead Letter Queue (DLQ)；原始消息存储到 MinIO；发送 NACK (AE) 给发送方；IT 运维收到告警 |
| FHIR 资源验证失败（必填字段缺失） | 返回 422 Unprocessable Entity + OperationOutcome 资源；原始请求记录到日志；不创建 CDM 对象 |
| 网络超时导致 HL7 消息丢失 | MLLP 层保证投递确认 (commit acknowledgement)；超时后发送方应重发；PMS 端使用消息去重（基于 MSH-10 Message Control ID） |
| SOAP 服务 WSDL 变更 | 健康检查检测 WSDL 签名变更；生成 DIFF 报告通知 IT；适配器保持最后已知配置运行直到被更新 |
| 凭据过期导致连接失败 | Health check 因为 401/403 → DOWN 状态；提前30天开始提醒；过期后新消息进入 DLQ 等待凭据更新后重新处理 |
| CDM 版本升级后旧版映射配置不兼容 | 映射配置带版本标签；新 CDM 版本不会影响已有的 MAPPING 配置；需 IT 管理员手工创建新版映射并切换 |
| 同一患者从两个不同系统同时推送数据 | 基于 PMI 的去重逻辑：优先采用数据完整度更高的源；冲突字段记录在 MergeAuditLog 中 |
| 高峰时段消息量超过处理能力 | 背压机制：RabbitMQ 队列缓冲；动态扩展消费者实例（Kubernetes HPA）；监控队列深度，超过阈值告警 |
| DICOM 影像文件过大 | 流式传输到 MinIO；不经过应用服务器内存；元数据提取后存 PG，影像保留在 MinIO |

**权限/授权要求:**

- System Admin: Can configure integration sites, manage credentials, activate/deactivate adapters, view health dashboard
- IT Operations: Can view health status and error logs; acknowledge alerts; restart adapter instances
- Integration Developer: Can create/update mapping configurations; test adapter with sandbox endpoint
- Data Manager: Can view data flow statistics; monitor transformation error rates
- CRC/PI: No direct access to adapter configuration; view only data that has been ingested and linked to their subjects
- Auditor: Can view integration configuration history and credential rotation audit logs

**关联数据实体:** IntegrationSite, IntegrationCredential, IntegrationMappingConfig, CDM classes (CdmPatient, CdmObservation, CdmDiagnosticReport, etc.), Subject, PMI, Observation, DiagnosticReport, FileObject, AuditLog

**关联 REST API:**

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | /api/v1/integration-sites | 注册新的集成站点 |
| GET | /api/v1/integration-sites | 获取所有集成站点列表 |
| GET | /api/v1/integration-sites/{siteId} | 获取站点集成详情 |
| PATCH | /api/v1/integration-sites/{siteId} | 更新站点集成配置 |
| POST | /api/v1/integration-sites/{siteId}/health-check | 手动触发健康检查 |
| GET | /api/v1/integration-sites/{siteId}/health-history | 查看健康检查历史 |
| POST | /api/v1/integration-credentials | 创建凭据 |
| PUT | /api/v1/integration-credentials/{credentialId} | 更新凭据（轮换） |
| GET | /api/v1/integration-mapping-configs/{configId} | 获取映射配置 |
| POST | /api/v1/integration-mapping-configs/{configId}/test | 测试映射配置（使用样例数据） |
| GET | /api/v1/integration-sites/{siteId}/dlq | 查看死信队列消息 |
| POST | /api/v1/integration-sites/{siteId}/dlq/{messageId}/reprocess | 重新处理 DLQ 消息 |
| POST | /fhir/r4/{resourceType} | FHIR 端点：创建/更新资源 |
| GET | /fhir/r4/{resourceType}/{id} | FHIR 端点：读取资源 |

---

### H03: EDC/eTMF 接口适配 EDC/eTMF Interface Adapters

**模块目标:** Provide bidirectional integration with external Electronic Data Capture (EDC) systems (e.g., Medidata Rave, Oracle InForm, Veeva CDMS) and electronic Trial Master File (eTMF) systems (e.g., Veeva Vault eTMF, Phlexglobal PhlexEview), synchronizing subject data, visit data, CRF data, and trial documents while managing API credentials, rate limits, and throttling policies.

**子功能清单:**

| 序号 | 子功能 | 描述 | 关键操作 |
|------|--------|------|----------|
| H03-01 | EDC Subject 同步 | Push subject demographics, enrollment status, and visit completion data to EDC; reconcile subject counts | Subject 推送、状态同步、ID 映射、对账 |
| H03-02 | EDC Visit/CRF 数据同步 | Sync visit dates, CRF page statuses, and clinical data between PMS and EDC; handle coding differences | 访视同步、CRF 状态同步、编码转换、差异处理 |
| H03-03 | eTMF 文档同步 | Push consent forms, SAE reports, protocol deviation documents, monitoring reports to eTMF with metadata indexing | 文档上传、元数据同步、里程碑更新 |
| H03-04 | eTMF 里程碑同步 | Sync trial milestone events (FPFV, LPLV, DBL) between PMS and eTMF; trigger alerts on milestone achievement | 里程碑推送、状态同步、里程碑告警 |
| H03-05 | API 认证管理 | Manage API keys, OAuth 2.0 tokens, client certificates for each EDC/eTMF vendor; automatic token refresh | API Key 管理、OAuth 2.0 刷新、证书轮换 |
| H03-06 | 速率限制与节流 | Implement vendor-specific rate limiting; queue-based throttling; backoff strategies for 429 responses | 速率限制、请求队列、指数退避、429 处理 |
| H03-07 | 同步状态监控 | Dashboard showing sync status per study/site; failed sync retry queue; manual sync trigger | 同步仪表盘、失败重试队列、手动触发 |

**核心交互流程:**

1. EDC Configuration:
   - System Admin configures EDC integration: POST /api/v1/edc-integrations with {study_id, edc_vendor (MEDIDATA_RAVE | ORACLE_INFORM | VEEVA_CDMS | CUSTOM), base_url, api_version, auth_type, auth_params (encrypted), rate_limit_config, field_mapping_template}.
   - EDC adapter factory loads the vendor-specific adapter bean; adapter translates between PMS domain objects and EDC-specific API contracts.

2. Subject Synchronization (PMS → EDC):
   - Trigger: Subject status transitions (ENROLLED, SCREEN_FAILED, WITHDRAWN, COMPLETED).
   - RabbitMQ listener on `pms.subject.status.changed` → EDC Sync Service picks up event.
   - Service evaluates: is this study configured for EDC sync? Is this subject's status a sync-eligible state?
   - Builds EDC-specific payload:
     - Medidata Rave: POST to `/RaveWebServices/studies/{studyOID}/subjects` with ODM XML containing SubjectData.
     - Veeva CDMS: POST to `/api/v1/studies/{studyId}/subjects` with JSON payload.
   - EDC returns subject_id (EDC internal ID); stored in mapping table `EDC_Subject_Mapping {pms_subject_id, edc_subject_id, edc_study_id}`.
   - On subsequent updates: PUT/PATCH to EDC with updated status/demographics.
   - Error handling: 4xx (validation) → log + CRC notification to fix data; 5xx → retry with exponential backoff (3 attempts, then DLQ).

3. Visit/CRF Data Sync (PMS → EDC):
   - Trigger: Visit status → COMPLETED; QuestionnaireResponse status → COMPLETED; Observation created/updated from lab import.
   - Data mapping: PMS domain objects → EDC CRF fields using configurable field_mapping_template (JSONB).
   - Supports incremental sync (only changed data) and full sync (all data for a subject).
   - CRF status codes: PMS visit COMPLETED → EDC CRF COMPLETE; PMS questionnaire COMPLETED → EDC CRF DATA_ENTERED.
   - Differential sync: compare PMS data snapshot (stored in integration_sync_log) with last synced snapshot → only send changed fields.

4. Data Pull (EDC → PMS):
   - Scheduled job (cron: configurable per study, default daily 02:00 UTC) pulls EDC data for subjects not in PMS.
   - Scenario: subjects directly entered in EDC at site (without using MiniApp pre-screening) → need to import into PMS.
   - Pulled subjects undergo PMI matching (H01) before creating PMS Subject records.
   - CRC notified of new imported subjects for verification before activating in PMS.

5. eTMF Document Sync (PMS → eTMF):
   - Trigger: ConsentRecord created (signed consent PDF), SAE report finalized, ProtocolDeviation created, MonitoringReport generated.
   - Service creates eTMF document payload with:
     - Document file (downloaded from MinIO, streamed to eTMF API)
     - Metadata: document_type (TMF reference model code), study_id, site_id, subject_id (de-identified per eTMF config), document_date, author, artifacts (study, country, site).
   - eTMF API call (vendor-specific):
     - Veeva Vault: POST `/api/v19.3/objects/documents` with multipart form data.
     - Custom: POST to configured endpoint.
   - On success: store eTMF document ID + version ID in `ETMF_Document_Mapping {pms_document_id, etmf_document_id, etmf_version_id, synced_at}`.

6. Rate Limiting & Throttling:
   - Each EDC/eTMF integration has a rate_limit_config JSONB:
     ```
     {
       "max_requests_per_second": 5,
       "max_requests_per_minute": 100,
       "max_requests_per_hour": 3000,
       "burst_size": 10,
       "retry_strategy": "exponential_backoff",
       "max_retries": 3,
       "backoff_multiplier_ms": 1000,
       "queue_capacity": 10000
     }
     ```
   - Implemented via token bucket algorithm (Redis-backed, with local fallback). Requests exceeding rate limit are queued with priority (SAE > urgent > normal).
   - 429 response handling: extract Retry-After header; pause sync for specified duration; resume.

7. Sync Monitoring:
   - Dashboard per study: subjects_synced / subjects_total, sync_status (UP_TO_DATE | SYNCING | PARTIALLY_FAILED | ERROR), last_successful_sync_at, pending_count, failed_count.
   - Per-entry sync log: IntegrationSyncLog {id, integration_type, entity_type, entity_id, direction (PMS_TO_EDC|EDC_TO_PMS), status (PENDING|SUCCESS|PERMANENT_FAILURE), attempts, last_error, created_at}.
   - Manual actions: "重新同步" (retry a specific failed sync), "强制全量同步" (full re-sync for a study), "暂停同步" (pause for maintenance).

**核心字段:**

| 字段 | 类型 | 说明 |
|------|------|------|
| edc_integration_id | UUID (UUIDv7) | PK |
| study_id | UUID | FK to Study |
| edc_vendor | VARCHAR(30) | MEDIDATA_RAVE, ORACLE_INFORM, VEEVA_CDMS, CUSTOM |
| base_url | VARCHAR(500) | EDC API base URL |
| api_version | VARCHAR(20) | API version string |
| auth_type | VARCHAR(20) | api_key, oauth2, basic |
| auth_params_encrypted | BYTEA | Encrypted auth parameters |
| rate_limit_config | JSONB | Rate limiting configuration |
| field_mapping_template | JSONB | Mapping from PMS fields to EDC CRF fields |
| sync_direction | VARCHAR(20) | BI_DIRECTIONAL, PMS_TO_EDC_ONLY, EDC_TO_PMS_ONLY |
| sync_enabled | BOOLEAN | Master switch for sync |
| auto_sync_subjects | BOOLEAN | Auto-sync on subject status change |
| auto_sync_data | BOOLEAN | Auto-sync on data entry |
| status | VARCHAR(30) | active → paused → error → disabled |

| 字段 | 类型 | 说明 |
|------|------|------|
| edc_subject_mapping_id | UUID (UUIDv7) | PK |
| pms_subject_id | UUID | FK to Subject |
| edc_subject_id | VARCHAR(100) | EDC internal subject ID |
| edc_study_id | VARCHAR(100) | EDC internal study ID |
| edc_site_id | VARCHAR(100) | EDC internal site ID |
| mapping_status | VARCHAR(30) | active → unresolved → error |
| last_synced_at | TIMESTAMPTZ | Last successful sync timestamp |
| sync_direction | VARCHAR(20) | PMS_TO_EDC, EDC_TO_PMS |

| 字段 | 类型 | 说明 |
|------|------|------|
| integration_sync_log_id | UUID (UUIDv7) | PK |
| integration_id | UUID | FK to EDC or eTMF integration |
| entity_type | VARCHAR(50) | SUBJECT, VISIT, QUESTIONNAIRE_RESPONSE, OBSERVATION, CONSENT, SAE, DOCUMENT |
| entity_id | UUID | PMS entity ID |
| direction | VARCHAR(20) | PMS_TO_EDC, EDC_TO_PMS |
| status | VARCHAR(30) | PENDING → IN_PROGRESS → SUCCESS / PERMANENT_FAILURE |
| attempt_count | INTEGER | Number of retry attempts |
| last_error_message | TEXT | Most recent error |
| last_error_at | TIMESTAMPTZ | When last error occurred |
| synced_data_snapshot | JSONB | Checksum/hash of synced data for differential sync |
| completed_at | TIMESTAMPTZ | When successfully completed |

**异常场景:**

| 场景 | 处理方式 |
|------|----------|
| EDC API 返回 401/403（凭据过期） | 自动尝试刷新 OAuth token（若已配置）；刷新失败则暂停同步，通知 IT 管理员更新凭据 |
| EDC 返回 409 Conflict（Subject 已存在） | 不视为错误；更新 EDC_Subject_Mapping 记录；日志记录 INFO 级别 |
| Rate limit 429 持续超过阈值 | 指数退避：1s, 2s, 4s, 8s, 16s... 最多等待 max_backoff_seconds (configurable, default 300s)；超时后进入 DLQ |
| eTMF 文档上传失败（文件过大） | 检查文件大小；超过单次上传限制时使用分块上传（chunked upload）；记录每个 chunk 状态 |
| EDC 字段映射不一致（PMS 有字段但 EDC 无对应 CRF） | 映射模板标记该字段为 IGNORE；记录在 FieldMappingIssue 表；CRC 可查看未同步字段报告 |
| EDC 拉取 的 Subject 在 PMS 中已存在 | 通过 PMI matching 去重；若确定是同一人则链接现有 PMS Subject；若无法确定则创建待审核标记 |
| eTMF 架构更新（TMF Reference Model 版本升级） | 文档元数据映射模板需要更新；IT 管理员收到 TMF 模型版本变更提醒；旧版本模板保持可用直到手工切换 |
| 同步过程中网络中断 | 基于 IntegrationSyncLog 的 attempt_count 重试；保证幂等（相同 entity_id + version 不重复创建） |

**权限/授权要求:**

- System Admin: Configure EDC/eTMF integrations, manage credentials, view sync dashboard, trigger manual full sync
- Data Manager: View sync status, troubleshoot failed syncs, retry individual sync entries
- CRC: View sync status for own subjects; cannot configure or trigger sync
- Sponsor/CRO Data Manager: Read-only view (if external access is configured) of sync statistics
- Auditor: View sync log history and credential rotation events

**关联数据实体:** EDCIntegration, ETMFIntegration, EDC_Subject_Mapping, ETMF_Document_Mapping, IntegrationSyncLog, Subject, Visit, QuestionnaireResponse, Observation, ConsentRecord, SAE, FileObject, AuditLog

**关联 REST API:**

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | /api/v1/edc-integrations | 配置 EDC 集成 |
| GET | /api/v1/edc-integrations | 获取 EDC 集成列表 |
| PUT | /api/v1/edc-integrations/{integrationId} | 更新 EDC 集成配置 |
| GET | /api/v1/edc-integrations/{integrationId}/sync-status | 获取同步状态概览 |
| POST | /api/v1/edc-integrations/{integrationId}/sync/subject/{subjectId} | 手动同步单个受试者 |
| POST | /api/v1/edc-integrations/{integrationId}/sync/full | 触发全量同步 |
| POST | /api/v1/edc-integrations/{integrationId}/pause | 暂停同步 |
| POST | /api/v1/edc-integrations/{integrationId}/resume | 恢复同步 |
| GET | /api/v1/edc-integrations/{integrationId}/sync-logs | 获取同步日志 |
| POST | /api/v1/edc-integrations/{integrationId}/sync-logs/{logId}/retry | 重试失败的同步记录 |
| POST | /api/v1/etmf-integrations | 配置 eTMF 集成 |
| GET | /api/v1/etmf-integrations/{integrationId}/document-sync-status | 文档同步状态 |

---

### H04: 文档与附件分层存储 Document & Attachment Tiered Storage

**模块目标:** Implement a multi-tier storage architecture on MinIO for clinical documents and attachments, with automated lifecycle policies that transition files between storage tiers (raw, processed, archive, temp) based on age, access frequency, and retention requirements, while providing storage usage monitoring and cost optimization.

**子功能清单:**

| 序号 | 子功能 | 描述 | 关键操作 |
|------|--------|------|----------|
| H04-01 | Bucket 管理 | Four logical buckets on MinIO: raw (incoming), processed (confirmed), archive (long-term retention), temp (short-lived, auto-purge) | 桶创建、桶策略、跨桶复制、配额设置 |
| H04-02 | 文件生命周期策略 | Lifecycle rules: temp objects auto-delete after 72h; raw objects transition to archive after 90d; processed objects transition after 2y | 生命周期规则、过渡策略、删除策略、版本管理 |
| H04-03 | 存储层级过渡规则 | Tier transition: HOT (frequent access, SSD-backed) → WARM (infrequent, HDD-backed) → COLD (archive, lowest cost) | 热温冷分层、过渡触发、成本优化 |
| H04-04 | 存储使用监控 | Dashboard: total storage per bucket/tier, growth rate, cost projection; alert on threshold breach | 容量仪表盘、增长预测、成本分析、阈值告警 |
| H04-05 | 文件完整性校验 | SHA-256 hash on upload and periodic verification; checksum mismatch detection and repair | 上传校验、定期校验、不一致告警、自动修复 |
| H04-06 | 文件去重 | Content-addressable storage: SHA-256 as object key; duplicate detection on upload; reference counting | 内容寻址、重复检测、引用计数、空间节省 |
| H04-07 | 合规保留策略 | Legal hold and retention lock for regulatory compliance (GCP, 21 CFR Part 11); prevent deletion during hold period | 法律保留、合规锁定、保留期限、WORM 模式 |

**核心交互流程:**

1. Bucket Architecture:
   - raw: Initial upload destination. All files from MiniApp uploads (P04), HL7 messages (H02), and incoming EDC files stored here. Object lifecycle: transition to archive after 90 days. Lifecycle policy: `auto-transition-to-archive {rule_id: raw-to-archive, filter: bucket=raw, transition_days: 90, storage_class: COLD}`.
   - processed: Confirmed/finalized documents. OCR-confirmed reports, signed consent PDFs, approved documents. Lifecycle: transition to archive after 2 years. Access: HOT tier for first 90 days (SSD-backed MinIO), then WARM tier.
   - archive: Long-term regulatory retention. Minimum retention 15 years post-study (per ICH GCP). Storage class: COLD (erasure-coded, lowest cost). Objects in archive require "unfreeze" before download (async process, SLA 12h for standard, 1h for expedited).
   - temp: Transient files. Pre-signed URL uploads in progress, export ZIP generation, preview thumbnails. Lifecycle: auto-purge after 72h (configurable per use case). No replication, no versioning.

2. File Upload Flow (Full):
   - Step 1: Client requests presigned URL → server generates MinIO presigned PUT URL in `raw` bucket with path `{study_id}/{subject_id}/{date}/{uuid}.{ext}`.
   - Step 2: After client confirms upload complete → server moves object from `raw/{path}` to `processed/{same_path}` (MinIO server-side COPY + DELETE, no data transfer through app server).
   - Step 3: SHA-256 hash computed (client sends hash in upload-complete; server verifies by reading object metadata from MinIO or calling MinIO checksum API).
   - Step 4: Hash stored in FileObject.content_hash; if duplicate hash detected → reference count incremented, physical file deduplicated.

3. Tier Transition Rules:
   - HOT tier (SSD-backed MinIO pool): objects created < 90 days ago, accessed in last 30 days. Fast random I/O for active clinical data.
   - WARM tier (HDD-backed MinIO pool or erasure-coded warm): objects 90d-2y old, or last accessed 30-180d ago.
   - COLD tier (MinIO erasure-code with high parity, lowest-cost storage): objects > 2y old, or study closed + data locked.
   - Transition engine: Spring @Scheduled job runs daily at 02:00 UTC; queries FileObject where storage_tier != computed_tier; batch-transitions in groups of 1000.
   - Manual tier change: Data Manager can request "unfreeze" for specific archived files → creates AsyncJob → notification when ready for download.

4. File Deduplication:
   - On upload, compute SHA-256. Query FileObject by content_hash AND file_size_bytes (to minimize hash collision risk).
   - If exact match found: new FileObject record created with same content_hash, new storage_path set to existing physical object path, reference_count on existing physical path incremented. No duplicate MinIO object created.
   - When FileObject soft-deleted: reference_count decremented. When reference_count reaches 0: MinIO object eligible for archive → eventual deletion per retention policy.
   - Hash collision defense: secondary quick check using first 64KB AND last 64KB bytes comparison before declaring duplicate.

5. Storage Monitoring:
   - Dashboard metrics (via MinIO Prometheus metrics endpoint + custom aggregation):
     - Total storage used per bucket (raw, processed, archive, temp)
     - Storage by tier (HOT, WARM, COLD) - stacked bar chart
     - Growth rate: daily/weekly/monthly delta in GB
     - Cost projection: (storage_GB × storage_cost_per_GB) + (API_calls × api_cost) + (egress_GB × egress_cost)
     - Top studies by storage consumption
     - Dedup savings: GB saved through deduplication (green bar showing cost avoidance)
   - Alerts: total storage > 80% quota → WARNING; > 95% → CRITICAL; cost projection > budget → WARNING.

6. Compliance Retention:
   - Objects in `processed` and `archive` buckets have retention_lock enabled (MinIO Object Lock in GOVERNANCE mode: privileged users can override with justification; COMPLIANCE mode for locked study data: no override possible, not even by root).
   - Legal hold: triggered by DPO or Legal → places indefinite retention on all objects within a study scope; prevents any deletion even after retention period.
   - Retention period: starts from study close-out date + 15 years (configurable per study to match regulatory requirements in different jurisdictions).
   - Audit: every lifecycle action (transition, delete attempt, legal hold placement/removal) logged to AuditLog.

**核心字段:**

| 字段 | 类型 | 说明 |
|------|------|------|
| storage_bucket_id | UUID (UUIDv7) | PK for bucket metadata record |
| bucket_name | VARCHAR(50) | raw, processed, archive, temp |
| storage_class | VARCHAR(20) | HOT, WARM, COLD |
| quota_gb | INTEGER | Maximum storage quota |
| current_usage_gb | DECIMAL(10,2) | Current usage (denormalized, refreshed daily) |
| lifecycle_policy | JSONB | MinIO lifecycle policy configuration |
| versioning_enabled | BOOLEAN | Whether object versioning is on |
| object_lock_enabled | BOOLEAN | Whether WORM lock is enabled |
| encryption_enabled | BOOLEAN | Always true |
| storage_cost_per_gb_month | DECIMAL(8,4) | For cost projection |

| 字段 | 类型 | 说明 |
|------|------|------|
| file_object_id | UUID (UUIDv7) | PK (extends P04 FileObject) |
| storage_bucket | VARCHAR(50) | Current bucket |
| storage_path | VARCHAR(500) | Object key in MinIO |
| storage_tier | VARCHAR(20) | HOT, WARM, COLD |
| content_hash | VARCHAR(64) | SHA-256 hex digest |
| dedup_reference_count | INTEGER | Number of FileObject records referencing this physical object |
| physical_object_id | UUID | Reference to DedupPhysicalObject |
| file_size_bytes | BIGINT | Size in bytes |
| transitioned_at | TIMESTAMPTZ | When last tier transition occurred |
| retention_until | TIMESTAMPTZ | Retention expiry date |
| legal_hold | BOOLEAN | Whether under legal hold |
| legal_hold_placed_by | UUID | DPO/Legal user |
| legal_hold_placed_at | TIMESTAMPTZ | When legal hold was applied |
| last_accessed_at | TIMESTAMPTZ | Last download time |
| access_count | INTEGER | Total number of downloads (denormalized) |
| checksum_verified_at | TIMESTAMPTZ | Last checksum verification |

**异常场景:**

| 场景 | 处理方式 |
|------|----------|
| MinIO 集群连接失败 | 应用层重试（3次，间隔2s）；超时后文件操作失败并返回 503；IT 运维收到 CRITICAL 告警 |
| 存储配额超限 | 阻止新文件上传（返回 507 Insufficient Storage）；通知 IT 运维申请扩容或清理 temp bucket |
| 校验和不匹配（数据损坏） | 标记 FileObject status=CHECKSUM_FAILED；尝试从 replica（erasure-code parity）恢复；无法恢复则通知 IT 运维 |
| 归档文件被请求下载（COLD tier） | 异步解冻任务：MinIO RESTORE Object API；标准12h，快速1h；完成后通知请求者下载 |
| 法律保留期间有人尝试删除文件 | Object Lock 阻止删除；记录删除尝试到 AuditLog；通知 DPO |
| 过渡期间文件被访问 | 过渡不影响读取；MinIO 保证读写一致性；过渡完成前对象在源 bucket 保持不变 |
| 临时文件未按时清理 | 每日清理任务扫描 temp bucket，删除 created_at > TTL 的所有对象；失败对象重试下次清理 |
| 重复文件检测性能瓶颈（大量文件） | content_hash 建有索引；增量去重（仅对新增文件的 hash 查询）；全量去重仅维护任务时执行 |

**权限/授权要求:**

- System Admin: Configure buckets, lifecycle policies, quotas; view storage dashboard; manage MinIO cluster
- Data Manager: View storage usage statistics; request archive retrieval; view dedup reports
- DPO / Legal: Place/remove legal holds; view retention compliance reports
- IT Operations: View storage health; receive storage alerts; manage capacity
- CRC/PI/Patient: No direct access to storage management; interact through file upload/download APIs (which internally use storage layer)

**关联数据实体:** FileObject, DedupPhysicalObject, StorageBucket, StorageLifecyclePolicy, LegalHold, AuditLog

**关联 REST API:**

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api/v1/storage/dashboard | 存储使用仪表盘数据 |
| GET | /api/v1/storage/buckets | 获取所有 bucket 状态 |
| GET | /api/v1/storage/buckets/{bucketName}/usage | 获取桶存储用量详情 |
| PUT | /api/v1/storage/lifecycle-policies | 更新生命周期策略 |
| POST | /api/v1/storage/files/{fileObjectId}/unfreeze | 解冻归档文件（触发热→温迁移） |
| GET | /api/v1/storage/files/{fileObjectId}/unfreeze-status | 查询解冻进度 |
| POST | /api/v1/storage/legal-hold | 设置法律保留 |
| DELETE | /api/v1/storage/legal-hold/{holdId} | 移除法律保留 |
| POST | /api/v1/storage/checksum-verify/{studyId} | 触发研究文件校验和验证 |
| GET | /api/v1/storage/dedup-stats | 获取去重统计 |

---

### H05: 事件总线 Event Bus

**模块目标:** Design and operate a robust event-driven architecture using RabbitMQ as the message broker, with well-defined exchange topology, standardized event schemas, event versioning support, and consumer group management for decoupled asynchronous communication across all PMS microservices.

**子功能清单:**

| 序号 | 子功能 | 描述 | 关键操作 |
|------|--------|------|----------|
| H05-01 | Exchange 与路由设计 | Topic exchange topology: domain-specific exchanges with routing keys for fine-grained message routing; dead letter exchanges; retry exchanges | Exchange 定义、Topic 路由、DLX/DLQ 配置、绑定管理 |
| H05-02 | 事件 Schema 定义 | Standardized event envelope with common headers (eventId, eventType, version, timestamp, source, correlationId, causationId) and domain-specific payload | Schema 定义、Envelope 标准化、JSON Schema 校验 |
| H05-03 | 事件版本管理 | Backward-compatible schema evolution; version prefix in routing key; consumer handles multiple versions; schema registry integration | 版本命名、兼容性检查、多版本消费、Schema Registry |
| H05-04 | 消费者组管理 | Competing consumer pattern for horizontal scaling; prefetch tuning; consumer concurrency configuration; consumer health monitoring | 消费者组、并发配置、预取策略、健康检查 |
| H05-05 | 消息可靠性保证 | Publisher confirms, consumer acknowledgements (manual ACK), persistent messages, retry with backoff, dead letter handling | 发布确认、消费确认、持久化、重试退避、死信处理 |
| H05-06 | 事件监控与告警 | Queue depth monitoring, consumer lag, processing rate, error rate; alert on DLQ backlog; dashboard | 队列深度、消费延迟、处理速率、错误率、DLQ 告警 |
| H05-07 | 事件重放 | Re-publish historical events from event store for debugging, reprocessing, or new consumer onboarding | 事件存储、时间范围查询、事件重放、仅用于调试 |

**核心交互流程:**

1. Exchange Topology Design:
   - Core domain exchanges (topic type):
     - `pms.subject` → routing keys: `subject.created`, `subject.status.changed.{from_status}.{to_status}`, `subject.enrolled`, `subject.withdrawn`, `subject.completed`
     - `pms.consent` → `consent.version.published`, `consent.signed`, `consent.reconsent_required`, `consent.revoked`
     - `pms.visit` → `visit.planned`, `visit.window.opened`, `visit.completed`, `visit.missed`, `visit.overdue`
     - `pms.questionnaire` → `questionnaire.assigned`, `questionnaire.response.submitted`, `questionnaire.response.overdue`
     - `pms.file` → `file.uploaded`, `file.ocr.completed`, `file.ocr.failed`, `file.confirmed`
     - `pms.observation` → `observation.created`, `observation.abnormal`, `observation.critical`
     - `pms.ae` → `ae.reported`, `ae.serious`, `ae.resolved`
     - `pms.notification` → `notification.wechat.sent`, `notification.sms.sent`, `notification.email.sent`
     - `pms.integration` → `integration.edc.sync.completed`, `integration.edc.sync.failed`, `integration.etmf.document.uploaded`
     - `pms.data-quality` → `data-quality.issue.created`, `data-quality.issue.resolved`
   - Supporting exchanges:
     - `pms.dlx` (Dead Letter Exchange): routing key `dlx.{original_exchange}.{original_routing_key}` → DLQ queues per service.
     - `pms.retry` (Retry Exchange): for delayed retry via TTL queues → back to original queue after delay.
   - All exchanges and queues declared as durable; messages published as persistent (delivery_mode=2).

2. Event Envelope Schema:
   ```json
   {
     "eventId": "uuidv7",
     "eventType": "subject.enrolled",
     "eventVersion": "1.0",
     "timestamp": "2026-05-11T10:30:00Z",
     "source": "pms-subject-service",
     "correlationId": "uuidv7",
     "causationId": "uuidv7",
     "tenantId": "study_id or org_id",
     "userId": "uuid-or-system",
     "payload": {
       "subjectId": "uuidv7",
       "studyId": "uuidv7",
       "status": "ENROLLED",
       "enrolledAt": "2026-05-11T10:30:00Z"
     },
     "metadata": {
       "schemaUrl": "https://schema.pms.internal/events/subject-enrolled-v1.0.json",
       "contentType": "application/json",
       "checksum": "sha256-hash"
     }
   }
   ```
   - All events published via Spring Cloud Stream or custom RabbitTemplate wrapper that auto-populates envelope fields.
   - JSON Schema validation on publish (optional, configurable per environment: enabled in prod, disabled in dev).

3. Event Versioning Strategy:
   - Version format: MAJOR.MINOR (e.g., 1.0, 1.1, 2.0).
   - MAJOR bump: incompatible field removal, type change, or semantic meaning change → requires new routing key suffix (e.g., `subject.enrolled.v2`).
   - MINOR bump: additive changes (new optional fields) → backward-compatible, same routing key.
   - Consumer strategy: each consumer declares which versions it supports; receives messages for all compatible versions via routing key pattern binding (e.g., `subject.enrolled` and `subject.enrolled.v2`).
   - Deprecation: old version producers emit `event.metadata.deprecatedAt` header; consumers log warning; after grace period (3 months), old version routing key binding removed.

4. Consumer Groups & Concurrency:
   - Each microservice has dedicated queue bound to relevant routing keys (e.g., `pms-notification-service.subject-queue` bound to `subject.*`).
   - Competing consumers: multiple instances of same service share a queue (RabbitMQ round-robin distribution); concurrency configured per listener (default: 5 threads per instance).
   - Prefetch count: tuned per queue (default 50 for low-latency, 10 for CPU-intensive consumers); prevents one slow consumer from starving others.
   - Consumer health: each consumer reports heartbeat to Redis (key: `consumer:{service}:{instance}:heartbeat`, TTL 30s); dashboard monitors consumer count per queue.

5. Message Reliability:
   - Publisher confirms: RabbitTemplate.setConfirmCallback → on confirm, mark as sent; on nack, log + retry or DLX.
   - Consumer ACK: manual acknowledgment mode; ACK after successful processing; NACK with requeue=false → DLX after max retry attempts.
   - Retry policy:
     - Transient errors (DB connection timeout, external API 503): NACK with requeue=true (immediate retry) up to 3 times, then NACK with requeue=false → `pms.retry` exchange → TTL queue (delay: 30s, 5min, 30min, 2h) → back to original queue.
     - Permanent errors (validation failure, 4xx): NACK with requeue=false → `pms.dlx` → DLQ for manual inspection.
   - Idempotency: consumers check eventId against `processed_events` table (PostgreSQL, partitioned by month) before processing; duplicate detection.

6. Monitoring & Alerting:
   - RabbitMQ management API metrics scraped by Prometheus:
     - Queue depth (> 10000 → WARNING, > 50000 → CRITICAL)
     - Consumer count (0 consumers for active queue → CRITICAL)
     - Message rate (publish rate, deliver rate, ack rate)
     - DLQ backlog (> 100 → WARNING, > 500 → CRITICAL)
   - Grafana dashboard: real-time exchange/queue topology map with health colors; message flow Sankey diagram.
   - Alerts routed to IT Operations via notification channel.

**核心字段:**

| 字段 | 类型 | 说明 |
|------|------|------|
| event_log_id | UUID (UUIDv7) | PK for event store |
| event_id | UUID | Unique event identifier |
| event_type | VARCHAR(200) | e.g., "subject.enrolled" |
| event_version | VARCHAR(10) | Schema version |
| exchange_name | VARCHAR(100) | RabbitMQ exchange |
| routing_key | VARCHAR(200) | RabbitMQ routing key |
| payload | JSONB | Full event payload |
| source_service | VARCHAR(100) | Originating microservice |
| correlation_id | UUID | For tracing across services |
| causation_id | UUID | Immediate parent event |
| published_at | TIMESTAMPTZ | When event was published |
| status | VARCHAR(20) | PUBLISHED, CONSUMED, FAILED, RETRYING |
| consumer_service | VARCHAR(100) | Which service consumed |
| consumed_at | TIMESTAMPTZ | When consumed |
| retry_count | INTEGER | Number of retries |

**异常场景:**

| 场景 | 处理方式 |
|------|----------|
| RabbitMQ Broker 宕机 | 应用层连接重试（Spring AMQP auto-recovery）；发布端缓存消息到 Redis/本地直到 broker 恢复；消费端等待重连 |
| 消息消费持续失败（poison message） | 达到 max_retry_count 后路由到 DLQ；IT 运维检视 DLQ 中的消息并提供手动重放或丢弃 |
| 队列积压（消费者无法跟上生产速度） | 自动扩容消费者实例（Kubernetes HPA based on queue depth）；告警通知 IT 运维；限制非关键事件的生产速率 |
| 事件 Schema 不兼容（consumer 收到无法解析的 payload） | NACK → DLQ；记录 SchemaVersionMismatch 错误；通知开发团队更新 consumer |
| 消息重复投递（网络分区后 broker 重发） | Consumer 幂等性检查（eventId in processed_events）；重复消息静默丢弃（ACK but skip processing） |
| 连接泄漏（消费者未正确关闭 channel） | Spring AMQP connection/channel 池化；泄露检测（channel > configured max）；自动回收孤儿 channel |
| 事件量激增（如批量导入产生大量事件） | Publisher 端批量发送（batching）；Consumer 端批量确认（batch ACK）；队列深度监控自动触发限流 |

**权限/授权要求:**

- System Admin: Declare exchanges/queues/bindings; configure DLX policies; view queue metrics
- IT Operations: View RabbitMQ dashboard; manage consumer instances; ack/discard DLQ messages
- Developer: View event schemas in schema registry; test event publishing in staging
- Integration: Services authenticate via RabbitMQ username/password per service; vhost isolation per environment (dev/staging/prod)

**关联数据实体:** EventLog, RabbitMQ Exchange/Queue/Binding (infrastructure), ProcessedEvent (for idempotency)

**关联 REST API (Management):**

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api/v1/events/queue-status | 获取所有队列状态概览 |
| GET | /api/v1/events/queues/{queueName}/stats | 获取单个队列统计 |
| GET | /api/v1/events/dlq | 获取死信队列消息列表 |
| POST | /api/v1/events/dlq/{messageId}/replay | 重放死信消息到原队列 |
| DELETE | /api/v1/events/dlq/{messageId} | 丢弃死信消息 |
| GET | /api/v1/events/schema-registry | 获取已注册的事件 Schema 列表 |
| POST | /api/v1/events/schema-registry | 注册新的事件 Schema |
| GET | /api/v1/events/schema-registry/{eventType} | 获取特定事件类型的所有 Schema 版本 |
| GET | /api/v1/events/event-log | 查询事件日志（按时间范围、类型筛选） |

---

### H06: 数据质量规则引擎 Data Quality Rule Engine

**模块目标:** Provide a configurable rule engine for detecting data quality issues across all clinical data domains, supporting multiple rule types (range check, logic check, cross-form consistency, timeline check), executing rules on data entry (real-time) and on schedule (batch), auto-generating queries for violations, and monitoring rule effectiveness over time.

**子功能清单:**

| 序号 | 子功能 | 描述 | 关键操作 |
|------|--------|------|----------|
| H06-01 | 规则配置管理 | CRUD for quality rules; rule types: range, logic, consistency, timeline, completeness, uniqueness; per-study or global scope | 规则创建、规则编辑、规则禁用/启用、规则模板 |
| H06-02 | 实时规则执行 | Execute rules synchronously on data entry (questionnaire submit, observation create, file confirm); immediate violation feedback | 数据录入触发、同步校验、即时告警 |
| H06-03 | 定时批量规则执行 | Scheduled execution of cross-record rules (timeline, cross-form consistency, completeness); batch processing | 定时任务、批量执行、跨记录检查 |
| H06-04 | 自动 Query 生成 | On violation detection, auto-create DataQualityIssue with query text; route to responsible CRC for resolution | Query 生成、分配 CRC、跟踪解决 |
| H06-05 | Query 工作流 | Issue lifecycle: open → acknowledged → under_review → resolved / dismissed_with_reason; resolution audit trail | 问题状态流转、争议处理、解决记录 |
| H06-06 | 规则有效性监控 | Track per-rule metrics: violation rate, false positive rate, resolution time, query response rate; flag ineffective rules | 违规率、误报率、解决时效、规则退役建议 |
| H06-07 | 规则模板库 | Pre-built rule templates for common clinical data quality checks; import/export rules across studies | 模板库、导入导出、规则复用 |

**核心交互流程:**

1. Rule Configuration:
   - Data Manager navigates to rule configuration UI → creates rule: defines rule_name, rule_type, target_entity, condition_expression, severity, scope (study_id or global).
   - Rule expression DSL (custom or using established expression language like MVEL/SpEL):
     ```
     Range Check:   observation.value.systolic BETWEEN 60 AND 250
     Logic Check:   ae.end_date IS NOT NULL AND ae.end_date < ae.start_date
     Consistency:   questionnaire.q5.answer == 'pregnant' AND subject.gender != 'Female'
     Timeline:      visit.actual_date < visit.window_start_date OR visit.actual_date > visit.window_end_date
     Completeness:  questionnaire_response.answers MISSING_KEY IN ['q1', 'q2', 'q3']
     Uniqueness:    COUNT(subject) WHERE subject.identifier == {value} > 1
     ```
   - Expression compiled and cached (with configurable TTL) for performance.
   - Rule stored as DataQualityRule record with version; changes create new version (audit history preserved).

2. Real-Time Execution:
   - Spring AOP interceptor or Event-Driven: after data save (e.g., ObservationService.save()), RuleEngine.evaluate(entity, rules) is called synchronously.
   - RuleEngine fetches applicable rules (by entity_type + study_id + status=ACTIVE) from cache (Redis, Caffeine local fallback).
   - Rules evaluated sequentially (short-circuit on first critical violation if configured).
   - Violation result: {rule_id, rule_name, severity (INFO|WARNING|ERROR|CRITICAL), violation_detail, suggested_action}.
   - If violations found:
     - Create DataQualityIssue record(s) linked to source entity.
     - Attach to entity's JSONB `quality_issues` field for quick reference.
     - Publish DataQualityIssueCreatedEvent to RabbitMQ.
     - CRITICAL violations: immediate notification to CRC dashboard + optional WeChat/SMS.
     - WARNING/ERROR: queued for CRC review during next business day.
   - Non-blocking by default: save succeeds even with violations; configurable flag `block_on_critical` blocks save for CRITICAL severity rules.

3. Batch Execution:
   - Quartz scheduled job (cron: configurable, default daily 03:00 UTC).
   - Query: all active subjects with data updated since last batch run.
   - Rule types executed in batch: cross-form consistency (compare Q1 response vs Q2 response), timeline (visit order, window adherence, AE after study completion), completeness (required forms per visit), uniqueness (duplicate records).
   - Batch processing: stream results (Spring JdbcTemplate with fetchSize) to avoid memory issues; parallel execution per study.
   - Violations from batch run are merged with existing open issues (avoid duplicates via unique constraint on rule_id + entity_id + status=OPEN).

4. Auto Query Generation & Workflow:
   - DataQualityIssue created with status=OPEN.
   - CRC assigned based on: subject's site CRC, or round-robin per study, or manual claim.
   - Notification sent to CRC: "新数据质疑: {rule_name} for subject {identifier}, visit {visit_name}."
   - CRC actions:
     - "确认并修复" (Acknowledge & Fix): CRC corrects data → creates correction record → resolves issue.
     - "争议" (Dispute): CRC believes data is correct despite rule violation → dismisses with reason → Data Manager reviews disputed issues.
     - "升级" (Escalate): CRC escalates to PI or Data Manager for adjudication.
   - Resolution tracking: each status change records timestamp, user, and comment. Issue.status life: OPEN → ACKNOWLEDGED → IN_REVIEW → RESOLVED / DISMISSED.

5. Rule Effectiveness Monitoring:
   - Metrics per rule (rolling 30-day window):
     - Violation count (total times triggered)
     - Confirmed violation rate (violations that resulted in data correction) / total violations
     - False positive rate (violations dismissed as correct) / total violations
     - Average resolution time (open → resolved)
     - CRC query response rate (acknowledged within SLA)
   - Dashboard with:
     - Top rules by violation count (bar chart)
     - Rules with highest false positive rate (flagged for review)
     - Resolution time trend (are we getting faster/slower?)
   - Automated recommendation: rules with false_positive_rate > 50% AND violation_count > 100 → recommendation to adjust threshold or retire rule.

**核心字段:**

| 字段 | 类型 | 说明 |
|------|------|------|
| data_quality_rule_id | UUID (UUIDv7) | PK |
| rule_name | VARCHAR(200) | Human-readable name |
| rule_code | VARCHAR(100) | Unique code, e.g., "OBS_BP_RANGE_001" |
| rule_type | VARCHAR(30) | RANGE, LOGIC, CONSISTENCY, TIMELINE, COMPLETENESS, UNIQUENESS |
| target_entity | VARCHAR(50) | Observation, QuestionnaireResponse, Visit, Subject, AE |
| condition_expression | TEXT | Rule expression in DSL |
| severity | VARCHAR(20) | INFO, WARNING, ERROR, CRITICAL |
| scope | VARCHAR(20) | STUDY, GLOBAL, SITE |
| study_id | UUID | FK to Study (null if global) |
| is_active | BOOLEAN | Whether rule is currently enforced |
| block_on_critical | BOOLEAN | Whether CRITICAL violations block data save |
| execution_mode | VARCHAR(20) | REALTIME, BATCH, BOTH |
| rule_version | INTEGER | Version number |
| created_by | UUID | Creator |
| effective_from | TIMESTAMPTZ | When rule becomes active |
| effective_until | TIMESTAMPTZ | When rule expires |
| metadata | JSONB | {description, references, category_tags} |

| 字段 | 类型 | 说明 |
|------|------|------|
| data_quality_issue_id | UUID (UUIDv7) | PK |
| rule_id | UUID | FK to DataQualityRule |
| rule_version | INTEGER | Version of rule at time of violation |
| entity_type | VARCHAR(50) | Type of entity with violation |
| entity_id | UUID | PK of entity with violation |
| subject_id | UUID | FK to Subject (denormalized) |
| study_id | UUID | FK to Study (denormalized) |
| visit_id | UUID | FK to Visit (optional) |
| severity | VARCHAR(20) | Inherited from rule |
| violation_detail | JSONB | {field_name, actual_value, expected_range, rule_expression_evaluated} |
| query_text | TEXT | Auto-generated query for CRC: "请确认{field_name}的值{actual_value}是否正确" |
| status | VARCHAR(30) | OPEN → ACKNOWLEDGED → IN_REVIEW → RESOLVED → VERIFIED / DISMISSED |
| assigned_to | UUID | CRC assigned to resolve |
| resolution_type | VARCHAR(30) | DATA_CORRECTED, DATA_CONFIRMED_CORRECT, RULE_DISABLED, DISMISSED |
| resolution_comment | TEXT | CRC's resolution explanation |
| resolved_by | UUID | User who resolved |
| resolved_at | TIMESTAMPTZ | When resolved |
| verified_by | UUID | Data Manager or PI who verified |
| created_at | TIMESTAMPTZ | When issue was created |

**异常场景:**

| 场景 | 处理方式 |
|------|----------|
| 规则表达式语法错误 | 保存规则时编译表达式并校验语法；语法错误阻止保存，返回具体错误位置 |
| 规则执行超时（复杂跨表查询） | 设置超时限制（realtime: 500ms, batch: 30s per rule）；超时跳过规则并记录警告；后续优化规则表达式 |
| 同一数据触发多条规则产生冲突的修复建议 | 不自动解决冲突；所有 issues 保持独立；CRC 查看所有 issues 后统一判断 |
| 规则执行期间数据被修改 | 规则引擎读取数据快照（MVCC）；基于提交时的数据状态评估；时序问题记录在 issue detail 中 |
| CRC 长期未处理 Open Issues (> 7d) | 自动升级通知（T+3d → CRC leader, T+7d → PI, T+14d → Data Manager） |
| 批量执行产生大量假阳性 | 评估规则 false_positive_rate；超过50%自动建议 Data Manager 审核和调整规则阈值 |
| 规则被删除后有未解决的关联 Issue | 规则不可硬删除（仅软删除）；已有关联 Issue 不受影响；新数据不再触发该规则 |

**权限/授权要求:**

- Data Manager: Create, edit, enable/disable, delete rules; view all issues; verify resolutions; review rule effectiveness
- CRC: View issues assigned to self; acknowledge, resolve, or dispute issues; cannot modify rules
- PI: View issues for study subjects; escalate/dispute issues
- Monitor: View issue statistics per site for SDV planning
- System Admin: Configure execution schedules; manage rule engine performance

**关联数据实体:** DataQualityRule, DataQualityIssue, Observation, QuestionnaireResponse, Visit, Subject, AE, AuditLog, Notification

**关联 REST API:**

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | /api/v1/data-quality/rules | 创建质量规则 |
| GET | /api/v1/data-quality/rules | 获取规则列表（筛选：类型、范围、状态） |
| PUT | /api/v1/data-quality/rules/{ruleId} | 更新规则 |
| PATCH | /api/v1/data-quality/rules/{ruleId}/toggle | 启用/禁用规则 |
| POST | /api/v1/data-quality/rules/{ruleId}/test | 测试规则（用历史数据验证） |
| GET | /api/v1/data-quality/issues | 获取数据质量问题列表 |
| GET | /api/v1/data-quality/issues/{issueId} | 获取问题详情 |
| PATCH | /api/v1/data-quality/issues/{issueId}/acknowledge | 确认问题 |
| POST | /api/v1/data-quality/issues/{issueId}/resolve | 解决问题 |
| POST | /api/v1/data-quality/issues/{issueId}/dispute | 质疑问题（认为数据正确） |
| GET | /api/v1/data-quality/rules/{ruleId}/effectiveness | 获取规则有效性统计 |
| POST | /api/v1/data-quality/batch-run/{studyId} | 手动触发批量规则执行 |

---

### H07: 数据导入导出 Data Import & Export

**模块目标:** Provide robust data import and export capabilities supporting multiple formats (CSV, Excel, PDF, SAS, SDTM CSV), with template-based batch import including validation and detailed error reporting, and asynchronous export with approval workflow, watermarking, and large dataset handling via pagination and streaming.

**子功能清单:**

| 序号 | 子功能 | 描述 | 关键操作 |
|------|--------|------|----------|
| H07-01 | 批量导入 (CSV/Excel) | Template-based import with header validation, row-by-row parsing, field mapping, and error collection; dry-run mode | 模板下载、文件上传、字段映射、dry-run、错误报告 |
| H07-02 | 导入验证 | Multi-stage validation: format check, data type check, reference integrity check, business rule check; detailed error per row/cell | 格式校验、类型校验、参照完整性、业务规则校验、逐行错误 |
| H07-03 | 导入错误报告 | Downloadable error report (Excel with highlighted error cells); fix errors in-place and re-upload; partial import option (skip errors) | 错误 Excel、行内修复、重新上传、部分导入 |
| H07-04 | 异步导出 | Export request → async job generation → notification when ready → download via presigned URL; approval workflow for sensitive data | 异步生成、审批流程、就绪通知、预签名下载 |
| H07-05 | 多格式导出 | Supported formats: CSV (raw data), Excel (formatted with styling), PDF (clinical report with logo/header), SAS (.sas7bdat via conversion), CSV for SDTM (CDISC-compliant) | CSV、Excel、PDF、SAS、SDTM CSV 映射 |
| H07-06 | 水印与保护 | PDF/Excel exports include watermark (user ID + timestamp + "CONFIDENTIAL"); PDF exports password-protected; Excel exports with read-only recommendation | 水印、密码保护、只读建议、审计追踪 |
| H07-07 | 大数据集处理 | Streaming for export (>100k rows); pagination for API; chunked download with re-assembly; progress indication | 流式导出、分页 API、分块下载、进度条 |

**核心交互流程:**

1. Import Template & Configuration:
   - Data Manager navigates to "导入数据" → selects import_type (Subject, Visit, Observation, QuestionnaireResponse, MedicationDiary).
   - System provides downloadable template: GET /api/v1/data-import/templates/{importType} → returns Excel (.xlsx) template with:
     - Header row with field names
     - Data validation dropdowns (for coded fields)
     - Instructions sheet (field descriptions, required fields, valid values)
     - Example row(s)
   - Alternatively, Data Manager can configure custom field mapping (for non-standard external data sources):
     - Upload CSV → system detects headers → Data Manager maps source fields to target fields via drag-and-drop UI → save mapping config for reuse.

2. Batch Import Execution:
   - Data Manager uploads filled template (or custom file) → POST /api/v1/data-import/upload with multipart/form-data {file, import_type, study_id, mapping_config_id, dry_run (boolean)}.
   - Server receives file → stores in MinIO `temp/imports/{import_job_id}/{filename}`.
   - Creates ImportJob record {status=PENDING, total_rows=0} → async processing begins.
   - Parsing phase:
     - Apache POI (Excel) or OpenCSV (CSV) reads file row by row.
     - Each row validated:
       Stage 1 (Format): correct data type (number in numeric field, date format valid, enum value in allowed list).
       Stage 2 (Reference): foreign key references exist (study_id → studies table, subject_id → subjects, visit_id → visits).
       Stage 3 (Business Rules): run DataQualityRuleEngine for imported entities (range checks, logic checks).
   - Error collection: each validation failure recorded as ImportRowError {row_number, field_name, error_message, severity (ERROR|WARNING)}.
   - Dry-run mode: stops after validation without committing; returns ImportJob with errors list only.
   - Real import mode: commits valid rows; errored rows skipped (unless `strict_mode`=true, which rolls back all on any error).
   - Progress: ImportJob.rows_processed / ImportJob.total_rows updated in real-time; client polls GET /api/v1/data-import/jobs/{jobId}/progress.

3. Error Report:
   - After import, Data Manager downloads error report: GET /api/v1/data-import/jobs/{jobId}/error-report → Excel file with:
     - Original data rows (highlighted: red = ERROR, yellow = WARNING)
     - Error column appended with error messages per row
     - Summary sheet: total rows, success count, error count, error breakdown by field
   - Data Manager fixes errors directly in the error report Excel → re-uploads for re-processing.
   - Partial import: Data Manager can accept partial import (all valid rows committed) and manually handle errored rows via UI.

4. Export Workflow:
   - Data Manager requests export: POST /api/v1/data-export/requests with {study_id, export_type, format(CSV|EXCEL|PDF|SAS|SDTM_CSV), data_scope (subject list or filters), include_columns [], filters JSONB, watermark_text, reason_for_export}.
   - Approval workflow (Flowable):
     - Export request status: DRAFT → PENDING_APPROVAL (if requires approval: sensitive data, full study export) → APPROVED / REJECTED.
     - Approval by: Data Manager lead or PI (configurable per study).
     - Automated approval for low-sensitivity exports (de-identified, aggregated, small scope).
   - On approval: ExportJob created → async processing.
     - Streaming export: JDBC ResultSet with fetchSize=1000 → Apache Commons CSV / Apache POI SXSSFWorkbook (streaming Excel) → write to MinIO temp bucket.
     - Progress tracked: export_job.rows_exported / estimated_total_rows.
   - Completion: ExportJob status=COMPLETED → notification to requester → download via GET /api/v1/data-export/requests/{requestId}/download → presigned MinIO URL (24h expiry).
   - Export audit: DataExportLog entry with requester, timestamp, export scope, row count, file hash.

5. Format-Specific Export Details:
   - CSV: Flat table; UTF-8 BOM for Excel compatibility; header row; double-quote escaping.
   - Excel: Styled workbook (header row bold + frozen pane, alternating row colors, auto-filter, column width auto-fit, data validation on key columns). Max 1,048,576 rows (Excel limit); if exceeds, split into multiple sheets.
   - PDF: Generated via Flying Saucer or iText; clinical report format with study logo, header/footer (page numbers, date), table of contents for multi-section reports, watermark overlay.
   - SAS: Generate CSV first → convert to SAS .sas7bdat using sas7bdat library (Python subprocess or Java wrapper); or provide SAS program (.sas) with DATA step + CSV import, whichever is agreed with sponsor.
   - SDTM CSV: Map PMS domain fields to CDISC SDTM domains (DM, AE, LB, VS, CM, EX, etc.) using configurable SDTM mapping template; output one CSV per SDTM domain in SDTM-compliant format.

6. Watermark & Protection:
   - Watermark text: "CONFIDENTIAL - Exported by {user_name} ({user_id}) on {timestamp} for {reason} - DO NOT DISTRIBUTE" applied as diagonal repeating pattern (opacity 10%) on PDF/Excel.
   - PDF: password protection (open password = random 12 char, displayed once to user; encrypted with AES-256).
   - Excel: Sheet/workbook protection (structure lock, not cell lock) with informational password; read-only recommendation header.
   - All export actions logged to AuditLog with file hash for traceability.

**核心字段:**

| 字段 | 类型 | 说明 |
|------|------|------|
| import_job_id | UUID (UUIDv7) | PK |
| study_id | UUID | FK to Study |
| import_type | VARCHAR(50) | SUBJECT, VISIT, OBSERVATION, QUESTIONNAIRE_RESPONSE, MEDICATION_DIARY, AE |
| file_path | VARCHAR(500) | MinIO temp path to uploaded file |
| original_filename | VARCHAR(255) | Uploaded file name |
| file_size_bytes | BIGINT | File size |
| mapping_config_id | UUID | Field mapping config (optional) |
| total_rows | INTEGER | Total data rows in file |
| rows_processed | INTEGER | Rows processed so far |
| rows_succeeded | INTEGER | Successfully imported rows |
| rows_failed | INTEGER | Failed rows |
| status | VARCHAR(30) | PENDING → PARSING → VALIDATING → IMPORTING → COMPLETED / COMPLETED_WITH_ERRORS / FAILED |
| dry_run | BOOLEAN | Whether this is a dry-run (no commit) |
| strict_mode | BOOLEAN | If true, roll back all on any error |
| error_report_path | VARCHAR(500) | MinIO path to generated error report |
| created_by | UUID | User who initiated import |
| completed_at | TIMESTAMPTZ | When import finished |

| 字段 | 类型 | 说明 |
|------|------|------|
| export_request_id | UUID (UUIDv7) | PK |
| study_id | UUID | FK to Study |
| export_type | VARCHAR(50) | SUBJECTS, VISITS, QUESTIONNAIRES, OBSERVATIONS, AES, ALL |
| format | VARCHAR(20) | CSV, EXCEL, PDF, SAS, SDTM_CSV |
| data_scope | JSONB | {subject_ids: [...], visit_ids: [...], filters: {...}} |
| include_columns | JSONB | List of columns to include |
| watermark_text | VARCHAR(500) | Custom watermark text |
| reason_for_export | TEXT | Business justification |
| requires_approval | BOOLEAN | Whether approval is needed |
| approval_status | VARCHAR(30) | NOT_REQUIRED → PENDING_APPROVAL → APPROVED → REJECTED |
| approved_by | UUID | Approver |
| approved_at | TIMESTAMPTZ | When approved |
| export_job_id | UUID | FK to ExportJob |
| status | VARCHAR(30) | DRAFT → PENDING_APPROVAL → APPROVED → PROCESSING → COMPLETED → DOWNLOADED / EXPIRED |
| download_url | VARCHAR(500) | Presigned MinIO URL |
| download_url_expires_at | TIMESTAMPTZ | URL expiry time |
| file_size_bytes | BIGINT | Generated file size |
| file_hash | VARCHAR(64) | SHA-256 of generated file |
| total_rows | INTEGER | Total exported rows |
| created_by | UUID | Requester |

**异常场景:**

| 场景 | 处理方式 |
|------|----------|
| 导入文件编码错误（非 UTF-8） | 自动检测编码（BOM、ICU4J charset detection）；尝试 UTF-8 → GBK → GB2312；失败则提示"无法识别文件编码" |
| 导入文件包含 SQL 注入/公式注入 | 所有文本字段过滤：删除 '=, +, -, @' 开头的单元格内容（CSV injection prevention）；SQL 参数化查询 |
| Excel 文件包含合并单元格或复杂格式 | 解析时忽略格式仅读值；合并单元格取左上角值，其他留空并在警告中提示 |
| 导出数据量超出内存限制 | 流式处理：SXSSFWorkbook (100 rows in memory), CSV streaming, ResultSet streaming；不加载全部数据到内存 |
| 导出任务执行时间过长（>30min） | 后台异步处理；前端显示进度条 + 预估剩余时间；完成时推送通知而非阻塞等待 |
| SDTM 导出发现编码缺失 | SDTM 导出前运行编码完整性检查；未编码项目生成清单，由 CRC 补充编码后重试导出 |
| 导出文件在下载前过期（24h未下载） | 状态标记为 EXPIRED；用户需重新请求导出；系统不自动重新生成 |
| 并发导入同一 study 导致数据冲突 | 乐观锁 per Subject 记录；导入时使用 INSERT ... ON CONFLICT (id) DO UPDATE；冲突行记录为 WARNING |

**权限/授权要求:**

- Data Manager: Initiate imports and exports; download error reports; configure import mappings; download exported files
- CRC: Initiate limited-scope exports (own subjects only); download exports they requested
- PI: Approve sensitive data export requests; view export audit log
- Sponsor/CRO Data Manager: Export de-identified data for assigned studies (if external access configured)
- System Admin: Configure export approval workflow; manage file storage quotas for imports/exports
- Monitor: Export SDV-related data subsets

**关联数据实体:** ImportJob, ImportRowError, ExportRequest, ExportJob, DataExportLog, FileObject, AuditLog, Flowable Process Instance

**关联 REST API:**

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api/v1/data-import/templates/{importType} | 下载导入模板 |
| POST | /api/v1/data-import/upload | 上传导入文件并启动导入任务 |
| GET | /api/v1/data-import/jobs | 获取导入任务列表 |
| GET | /api/v1/data-import/jobs/{jobId} | 获取导入任务详情 |
| GET | /api/v1/data-import/jobs/{jobId}/progress | 获取导入进度 |
| GET | /api/v1/data-import/jobs/{jobId}/error-report | 下载错误报告 |
| POST | /api/v1/data-export/requests | 创建导出请求 |
| GET | /api/v1/data-export/requests | 获取导出请求列表 |
| GET | /api/v1/data-export/requests/{requestId} | 获取导出请求详情 |
| POST | /api/v1/data-export/requests/{requestId}/approve | 批准导出请求 |
| POST | /api/v1/data-export/requests/{requestId}/reject | 拒绝导出请求 |
| GET | /api/v1/data-export/requests/{requestId}/download | 下载导出文件 |
| GET | /api/v1/data-export/audit-log | 获取导出审计日志 |

---

### H08: 对账与补偿任务 Reconciliation & Compensation Tasks

**模块目标:** Implement automated reconciliation between PMS data and external systems (EDC, site records, payment systems) covering subject counts, visit counts, SAE counts, and payment amounts, with configurable scheduled reconciliation, difference detection and classification, manual resolution workflows, and automatic compensation task generation for detected discrepancies.

**子功能清单:**

| 序号 | 子功能 | 描述 | 关键操作 |
|------|--------|------|----------|
| H08-01 | 对账类型配置 | Define reconciliation types: subject count, visit count, SAE count, payment amount, data completeness per visit | 对账类型、数据源定义、匹配规则、容忍度阈值 |
| H08-02 | 自动定时对账 | Daily scheduled reconciliation job comparing PMS records with EDC/site/payment records; generate reconciliation report | 每日对账、定时任务、自动比对、差异报告 |
| H08-03 | 差异检测与分类 | Auto-classify discrepancies: PMS_ONLY, EDC_ONLY, MISMATCH; sub-classify by root cause (data entry error, sync failure, timing issue) | 差异检测、差异分类、根因预判 |
| H08-04 | 手动解决工作流 | CRM/CRC reviews discrepancies; accepts PMS version or EDC version or enters correct value; resolution audit trail | 差异审核、手动修正、接受A方/B方、解决记录 |
| H08-05 | 补偿任务生成 | For each unresolved discrepancy requiring data fix, auto-generate compensation task assigned to responsible role | 任务生成、自动分配、优先级排序、截止日期 |
| H08-06 | 对账报告导出 | Generate reconciliation report per study/period; summary dashboard with trending; sponsor-ready format | 对账报告、汇总仪表盘、趋势分析、Sponsor 报告 |
| H08-07 | SLA 追踪 | Track time-to-resolution for discrepancies; escalation for overdue items; compliance percentage per study | SLA 计时、逾期升级、合规率统计 |

**核心交互流程:**

1. Reconciliation Configuration:
   - Data Manager configures reconciliation rules: POST /api/v1/reconciliation/configs with {study_id, reconciliation_type, source_a (PMS), source_b (EDC|SITE_PORTAL|PAYMENT_SYSTEM), mapping_rules JSONB, tolerance (e.g., count_mismatch: 0 tolerance, payment_mismatch: 0.01 CNY tolerance), schedule (cron expression)}.
   - Subject count reconciliation rule example:
     ```
     {
       "type": "SUBJECT_COUNT",
       "source_b": "EDC",
       "group_by": ["study_id", "site_id", "status"],
       "comparison": "COUNT(subject_id)",
       "tolerance": {"count_difference": 0}
     }
     ```
   - Visit count: GROUP BY study_id, site_id, visit_name; COMPARE COUNT(visit_id) WHERE status='COMPLETED'.
   - Payment reconciliation: SUM(reimbursement.paid_amount) GROUP BY study_id, site_id vs payment system records.

2. Scheduled Reconciliation Execution:
   - Quartz job triggers per config schedule (default: daily at 06:00 UTC).
   - Reconciliation engine:
     Step 1: Extract data from PMS (source A) → query relevant tables → aggregate per grouping rules → produce source A dataset in memory.
     Step 2: Extract data from external source (source B) via integration adapter (H02/H03) → if external system unavailable, use last cached snapshot from previous reconciliation.
     Step 3: Perform join on grouping keys (study_id + site_id + dimension).
     Step 4: Compare values; classify each row as: MATCH, PMS_ONLY (in PMS but not external), EDC_ONLY (in external but not PMS), MISMATCH (both exist but values differ).
     Step 5: Create ReconciliationResult records for non-MATCH rows.
     Step 6: Generate ReconciliationReport with summary statistics.
   - Results stored in reconciliation_tables (partitioned by study_id + month for performance).

3. Difference Classification:
   - Each discrepancy auto-classified:
     - PMS_ONLY: newly enrolled subject not yet synced to EDC → TYPE: PENDING_SYNC, AUTO_RESOLVE: after next successful sync.
     - EDC_ONLY: subject directly entered in EDC not imported to PMS → TYPE: MISSING_IMPORT, ACTION: notify CRC to import.
     - MISMATCH (count): subject withdrawn in PMS but still active in EDC → TYPE: STATUS_SYNC_FAILURE, ACTION: re-trigger EDC sync.
     - MISMATCH (payment): reimbursement amount differs → TYPE: PAYMENT_DISCREPANCY, ACTION: finance review.
   - Root cause prediction: based on historical resolution patterns; displayed as suggestion to reviewer for faster resolution.

4. Resolution Workflow:
   - CRC/Data Manager opens reconciliation dashboard → filtered by study + reconciliation_type + status.
   - For each discrepancy row: detailed view showing PMS value vs EDC value vs expected value, discrepancy classification, suggested action.
   - Resolution actions:
     - "以PMS为准" (Accept PMS as correct): PMS data is right; log justification; if EDC needs update → generate compensation task to sync to EDC.
     - "以EDC为准" (Accept EDC as correct): EDC data is right; generate compensation task to update PMS.
     - "双方修正" (Both need correction): enter correct value manually; generate tasks for both PMS and EDC updates.
     - "可接受的差异" (Acceptable difference): e.g., timing difference where data will reconcile naturally within 24h; defer and auto-close on next reconciliation.
   - Resolution stored with: resolved_by, resolved_at, resolution_type, resolution_note.

5. Compensation Task Generation:
   - For each discrepancy requiring data fix, RecompensationTaskEngine creates an IntegrationTask record:
     - task_type: EDC_SYNC, PMS_DATA_CORRECTION, PAYMENT_ADJUSTMENT, MANUAL_REVIEW
     - assigned_to: responsible user (CRC, Data Manager, Finance)
     - priority: HIGH (payment discrepancy, SAE reconciliation), MEDIUM (visit count), LOW (minor timing differences)
     - due_date: based on SLA (HIGH: 24h, MEDIUM: 72h, LOW: 7d)
   - Task appears in assignee's worklist; they execute the fix → mark task COMPLETED.
   - Next reconciliation run verifies task resolution (auto-closes or creates new discrepancy if not fixed).

6. Reporting & Trending:
   - Reconciliation dashboard: per-study card showing overall reconciliation rate (matched/total * 100), discrepancy breakdown pie chart, trend line of reconciliation rate over time.
   - Sponsor report: monthly reconciliation report (PDF) with executive summary, detailed discrepancy log, resolution status, aging analysis.
   - SLA compliance: percentage of discrepancies resolved within SLA; trend over time; site-level comparison.

**核心字段:**

| 字段 | 类型 | 说明 |
|------|------|------|
| reconciliation_config_id | UUID (UUIDv7) | PK |
| study_id | UUID | FK to Study |
| reconciliation_type | VARCHAR(50) | SUBJECT_COUNT, VISIT_COUNT, SAE_COUNT, PAYMENT_AMOUNT, DATA_COMPLETENESS |
| source_a | VARCHAR(50) | PMS (always) |
| source_b | VARCHAR(50) | EDC, SITE_PORTAL, PAYMENT_SYSTEM, EXTERNAL_REGISTRY |
| comparison_dimensions | JSONB | Grouping keys |
| comparison_metric | VARCHAR(100) | COUNT, SUM(amount), etc. |
| tolerance | JSONB | Acceptable difference threshold |
| schedule_cron | VARCHAR(50) | Cron expression for scheduled run |
| is_active | BOOLEAN | Whether auto-scheduled |
| last_run_at | TIMESTAMPTZ | Last execution time |
| last_run_status | VARCHAR(20) | SUCCESS, PARTIAL, FAILED |

| 字段 | 类型 | 说明 |
|------|------|------|
| reconciliation_report_id | UUID (UUIDv7) | PK |
| config_id | UUID | FK to ReconciliationConfig |
| study_id | UUID | FK to Study |
| report_period_start | TIMESTAMPTZ | Period start |
| report_period_end | TIMESTAMPTZ | Period end |
| total_comparisons | INTEGER | Total entities compared |
| matched_count | INTEGER | Exact matches |
| discrepancy_count | INTEGER | Total discrepancies |
| pms_only_count | INTEGER | In PMS but not external |
| external_only_count | INTEGER | In external but not PMS |
| mismatch_count | INTEGER | Both exist, values differ |
| reconciliation_rate | DECIMAL(5,2) | matched / total * 100 |
| status | VARCHAR(30) | GENERATED → UNDER_REVIEW → RESOLVED / ACCEPTED |
| generated_at | TIMESTAMPTZ | When report was generated |

| 字段 | 类型 | 说明 |
|------|------|------|
| discrepancy_id | UUID (UUIDv7) | PK |
| report_id | UUID | FK to ReconciliationReport |
| discrepancy_type | VARCHAR(30) | PMS_ONLY, EDC_ONLY, MISMATCH |
| root_cause_category | VARCHAR(50) | PENDING_SYNC, MISSING_IMPORT, STATUS_SYNC_FAILURE, DATA_ENTRY_ERROR, PAYMENT_DISCREPANCY, TIMING_ISSUE |
| dimension_key | VARCHAR(200) | Grouping key value (e.g., "Site 01") |
| pms_value | VARCHAR(500) | Value from PMS |
| external_value | VARCHAR(500) | Value from external source |
| expected_value | VARCHAR(500) | Expected correct value (initially null) |
| difference_detail | JSONB | Detailed breakdown of difference |
| status | VARCHAR(30) | OPEN → UNDER_REVIEW → RESOLVED / ACCEPTED_DIFFERENCE / DEFERRED |
| resolution_type | VARCHAR(50) | ACCEPTED_PMS, ACCEPTED_EXTERNAL, CORRECTED_BOTH, ACCEPTED_DIFFERENCE |
| resolved_by | UUID | Who resolved |
| resolved_at | TIMESTAMPTZ | When resolved |
| resolution_note | TEXT | Justification |
| compensation_task_ids | JSONB | Array of IntegrationTask IDs generated |

**异常场景:**

| 场景 | 处理方式 |
|------|----------|
| 外部系统不可达导致无法对账 | 使用上次成功对账的快照数据作为 source_b；标记 report.status=PARTIAL (source B data may be stale)；告警 IT 运维排查连接 |
| 对账结果显示巨大差异（如50%不匹配） | 标记为 ANOMALY；自动暂停该对账类型；通知 Data Manager 排查是否配置错误或数据问题 |
| 同一差异在多次对账中反复出现（未修复） | 每次对账时检查是否与上次 OPEN discrepancy 重复；重复则更新 age 字段；超过 SLA 自动升级 |
| 对账期间数据变更（Source A 被修改） | 对账开始时对 PMS 数据做快照（通过时间戳查询 AS OF reconciliation_start_time）；保证对账内部一致性 |
| 支付对账需要人工查找银行流水 | 支付差异自动创建补偿任务给 Finance；Finance 上传银行回单作为证据；系统更新差异状态 |
| 外部系统数据格式变更 | 适配层的映射配置自动版本管理；数据格式变更触发 mapping version check；不匹配则报错并暂停对账 |

**权限/授权要求:**

- Data Manager: Configure reconciliation rules; view all reports and discrepancies; resolve discrepancies; accept reports
- CRC: View discrepancies for assigned site; contribute resolution data; mark discrepancies as reviewed
- Finance: View and resolve payment-related discrepancies; upload payment evidence
- PI: View reconciliation summary reports; sign off on monthly reconciliation
- Sponsor/CRO Data Manager: View reconciliation summary (if external access configured)
- Auditor: View reconciliation history and resolution audit trails

**关联数据实体:** ReconciliationConfig, ReconciliationReport, Discrepancy, IntegrationTask, Subject, Visit, Reimbursement, SAE, AuditLog, EDCIntegration

**关联 REST API:**

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | /api/v1/reconciliation/configs | 创建对账配置 |
| GET | /api/v1/reconciliation/configs | 获取对账配置列表 |
| PUT | /api/v1/reconciliation/configs/{configId} | 更新对账配置 |
| POST | /api/v1/reconciliation/configs/{configId}/run | 手动触发对账 |
| GET | /api/v1/reconciliation/reports | 获取对账报告列表 |
| GET | /api/v1/reconciliation/reports/{reportId} | 获取对账报告详情 |
| GET | /api/v1/reconciliation/reports/{reportId}/discrepancies | 获取差异列表 |
| GET | /api/v1/reconciliation/discrepancies/{discrepancyId} | 获取差异详情 |
| POST | /api/v1/reconciliation/discrepancies/{discrepancyId}/resolve | 解决差异 |
| GET | /api/v1/reconciliation/dashboard/{studyId} | 获取对账仪表盘数据 |
| GET | /api/v1/reconciliation/reports/{reportId}/export | 导出对账报告 PDF |
| GET | /api/v1/integration-tasks | 获取补偿任务列表 |
| PATCH | /api/v1/integration-tasks/{taskId}/complete | 完成补偿任务 |

---

### H09: 审计日志与访问日志 Audit Log & Access Log

**模块目标:** Design a comprehensive, tamper-proof audit logging architecture that captures all data creation, modification, deletion, and access events across the entire platform, with monthly partitioned storage in PostgreSQL, OpenSearch indexing for real-time search and analysis, automated audit report generation, and append-only guarantees with no update/delete operations on log records.

**子功能清单:**

| 序号 | 子功能 | 描述 | 关键操作 |
|------|--------|------|----------|
| H09-01 | 审计日志捕获 | Interceptor-based capture of all API calls: who, what, when, where (IP), how (user-agent), result (success/failure), before/after values for modifications | 请求拦截、变更捕获、快照对比、异步写入 |
| H09-02 | 分区存储 | PostgreSQL declarative partitioning by month for audit_log table; automatic partition creation; partition archiving for old data | 月分区、自动创建分区、分区归档、查询优化 |
| H09-03 | OpenSearch 索引 | Dual-write to OpenSearch for real-time search, aggregation, and complex querying; index lifecycle management | 双写、全文搜索、聚合分析、索引生命周期 |
| H09-04 | 防篡改设计 | Append-only log with cryptographic chaining (SHA-256 hash chain); no UPDATE/DELETE permitted on audit tables; tamper detection | 追加写入、哈希链、篡改检测、只读权限 |
| H09-05 | 审计报告生成 | Generate compliance audit reports: user activity summary, data access per subject, modification history, anomalous access patterns | 用户活动报告、受试者访问报告、异常检测、PDF 导出 |
| H09-06 | 访问日志（P12 数据） | Separate access_log table for data-access tracking visible to patients (P12 module); derived from audit_log with masking | 访问日志、数据脱敏、患者可见、质疑处理 |
| H09-07 | 保留与清理策略 | Tiered retention: audit_log 7 years hot, then archive; access_log 3 years; compliance with China CSL/PIPL and GDPR | 热数据保留、归档策略、合规期限、自动清理 |

**核心交互流程:**

1. Audit Log Capture:
   - Spring AOP `@Around` advice on all `@RestController` methods and `@Service` methods annotated with `@Audited`.
   - Interceptor captures:
     - who: user_id (from JWT token), user_role, subject_id (if bound to session), impersonated_by (if proxy/caregiver mode).
     - what: request_method (GET/POST/PUT/PATCH/DELETE), request_path, target_entity, entity_id, action_type (CREATE, READ, UPDATE, DELETE, EXPORT, SIGN, APPROVE).
     - when: server_timestamp (UTC, set by DB: now()).
     - where: client_ip (from X-Forwarded-For header chain), geo_location (optional, if IP geo-db configured).
     - how: user_agent, api_version, request_id (trace ID).
     - result: http_status_code, success (boolean), error_message (if failure).
     - changes: for UPDATE: before_value (JSONB snapshot before change), after_value (JSONB snapshot after change), changed_fields (JSONB array of field names that actually changed).
   - AuditLog message asynchronously written via: (a) primary: PostgreSQL INSERT into `audit_log` table; (b) secondary: RabbitMQ → AuditLogConsumer → OpenSearch index.
   - Buffer/batch: high-throughput scenarios buffer audit events in memory (RingBuffer, capacity 10000) → flush to PG every 1s or when buffer half-full. On shutdown, flush remaining.

2. Partitioned Storage:
   - PostgreSQL table `audit_log` created with `PARTITION BY RANGE (created_at)`.
   - Monthly partitions: `audit_log_2026_05`, `audit_log_2026_06`, etc.
   - Partition creation automation:
     - Scheduled job (runs 1st of each month): CREATE TABLE audit_log_YYYY_MM PARTITION OF audit_log FOR VALUES FROM ('YYYY-MM-01') TO ('YYYY-MM+1-01').
     - Also creates indexes on new partition.
   - Query routing: PostgreSQL constraint exclusion routes queries with `WHERE created_at BETWEEN ...` to relevant partitions only.
   - Archive: partitions older than retention_hot_years (7y) are detached, exported to MinIO archive bucket as compressed CSV, then dropped from PG. Metadata stored in `archived_audit_partitions` table.

3. OpenSearch Indexing:
   - Index pattern: `pms-audit-log-{YYYY-MM}` (monthly rotation for index size management, aligned with partition scheme).
   - Index mapping: user_id (keyword), action_type (keyword), target_entity (keyword), entity_id (keyword), subject_id (keyword), request_path (keyword + text), changes (nested for field-level query), created_at (date).
   - AuditLogConsumer (from RabbitMQ): bulk-index batches of 500 audit log events (or every 5s, whichever first).
   - Index lifecycle management: hot phase (0-90d), warm phase (90d-2y, reduced replicas), cold phase (2y+, force merge to 1 segment, freeze), delete phase (7y+).
   - Search API: GET /api/v1/audit-logs/search → queries OpenSearch with filters, date range, full-text search on `changes`, pagination.

4. Tamper-Proof Design:
   - Append-only: audit_log table has only INSERT privileges for application user; no UPDATE/DELETE grants.
   - Hash chaining: each new audit_log entry includes `previous_entry_hash` = SHA-256(previous entry's `id + timestamp + changes_hash + previous_entry_hash`).
   - Chain stored in `audit_chain_hash` column; first entry of each partition chains back to last entry of previous partition.
   - Tamper verification job (weekly): recalculates hash chain from trusted starting point; any hash mismatch → TAMPER_DETECTED alert sent to Security Officer.
   - Root of trust: each month's audit partition summary hash is written to a separate `audit_chain_anchors` table (with additional write-once protection) and optionally published to external immutable ledger (e.g., blockchain anchoring service, or at minimum a write-once external bucket).

5. Audit Report Generation:
   - Report types (generated on-demand or scheduled):
     - User Activity Report: all actions by a specific user within date range.
     - Subject Access Report: all users who accessed a specific subject's data (used for P12 patient view).
     - Modification History: full before/after change log for a specific entity.
     - Anomalous Access Detection: unusual patterns (access outside working hours, excessive downloads, first-time access to sensitive data, geolocation anomalies).
   - Generation: POST /api/v1/audit-logs/reports → async job → query PG (for precision) or OpenSearch (for full-text) → aggregate → generate PDF with tables + charts → store in MinIO → notify requester.
   - Scheduled reports: monthly compliance report for each study → auto-generated on 1st of month → emailed to Data Manager, PI, and Sponsor (if configured).

6. Access Log Integration (P12):
   - Separate `access_log` table is a filtered, de-duplicated, and masked view of audit_log:
     - Only READ and EXPORT actions on patient-visible data categories.
     - IP addresses partially masked (last 2 octets: 192.168.XXX.XXX).
     - User names masked to role level (e.g., "研究协调员 张XX").
     - Purpose field derived from action context (e.g., "研究监查" for monitor access, "安全性审核" for SAE review).
   - Access log updated asynchronously: when audit_log entry matches access_log criteria → AuditLogConsumer additionally writes to access_log.
   - Patient queries via P12 API → reads from access_log (fast, no complex query on full audit_log).

**核心字段:**

| 字段 | 类型 | 说明 |
|------|------|------|
| audit_log_id | UUID (UUIDv7) | PK (time-sortable) |
| created_at | TIMESTAMPTZ | NOT NULL, PARTITION KEY |
| user_id | UUID | Who performed the action (nullable for system) |
| user_role | VARCHAR(50) | CRC, PI, Data_Manager, System, Patient, Caregiver |
| subject_id | UUID | FK to Subject (if action is subject-scoped) |
| study_id | UUID | FK to Study (denormalized) |
| site_id | UUID | FK to Site (denormalized) |
| request_id | UUID | Trace ID (correlates log entries across services) |
| session_id | VARCHAR(128) | User session identifier |
| action_type | VARCHAR(30) | CREATE, READ, UPDATE, DELETE, EXPORT, SIGN, APPROVE, REJECT, LOGIN, LOGOUT |
| target_entity | VARCHAR(50) | E.g., Subject, Visit, Observation, ConsentRecord, AE |
| entity_id | UUID | PK of target entity |
| http_method | VARCHAR(10) | GET, POST, PUT, PATCH, DELETE |
| request_path | VARCHAR(500) | API path (masked for sensitive query params) |
| request_body_hash | VARCHAR(64) | SHA-256 of request body (for integrity) |
| http_status_code | INTEGER | 200, 201, 400, 403, 500, etc. |
| success | BOOLEAN | Whether operation succeeded |
| error_message | TEXT | Error details if failed |
| before_value | JSONB | Snapshot before change (for UPDATE/DELETE) |
| after_value | JSONB | Snapshot after change (for CREATE/UPDATE) |
| changed_fields | JSONB | Array of field names changed: ["status", "actual_date"] |
| client_ip | VARCHAR(45) | IPv4 or IPv6 |
| user_agent | VARCHAR(500) | Browser/client info string |
| api_version | VARCHAR(10) | API version used |
| previous_entry_hash | VARCHAR(64) | Hash chain link |
| audit_chain_hash | VARCHAR(64) | SHA-256 (id + timestamp + changes_hash + previous_entry_hash) |
| partition_key | DATE | Denormalized for partition routing |

| 字段 | 类型 | 说明 |
|------|------|------|
| access_log_id | UUID (UUIDv7) | PK (for P12 patient access log view) |
| subject_id | UUID | Whose data was accessed |
| accessed_by_user_id | UUID | Who accessed |
| accessed_by_role | VARCHAR(50) | Role display (masked for patient view) |
| accessed_by_name | VARCHAR(50) | Name display (masked) |
| action_type | VARCHAR(30) | READ, EXPORT |
| data_category | VARCHAR(50) | demographics, consent, questionnaire, observation, ae, file, all |
| purpose | VARCHAR(200) | Business purpose description |
| ip_address | VARCHAR(45) | Partially masked |
| accessed_at | TIMESTAMPTZ | Access timestamp |
| patient_visible | BOOLEAN | Whether visible in P12 |
| patient_challenged | BOOLEAN | Whether patient flagged this entry |
| challenge_status | VARCHAR(30) | null, PENDING_REVIEW, RESOLVED, DISMISSED |

**异常场景:**

| 场景 | 处理方式 |
|------|----------|
| 审计日志写入失败（DB 连接断开） | 缓冲到本地文件（fallback writer）；DB 恢复后批量写入；告警通知 IT 运维 |
| 哈希链完整性检查失败 | CRITICAL 安全告警；自动隔离受影响时间段的日志分区；通知 Security Officer 调查 |
| 审计日志表达到存储容量上限 | 监控 tablespace 使用率；80% → WARNING 并自动触发旧分区归档；95% → CRITICAL 并阻止新日志写入（但仍接受缓存） |
| OpenSearch 索引写入失败 | 缓冲区缓存；指数退避重试；超时后丢弃并告警（PG 是主存储，OpenSearch 是副本） |
| 日志查询性能下降（大范围查询） | 利用 PG 分区裁剪 + OpenSearch 日期范围过滤；建议缩小查询范围；超过5s的查询返回警告 |
| 审计日志中发现可疑访问模式 | 异常检测规则引擎自动标记；创建 SecurityIncident 记录；通知 Security Officer |
| 合规审计要求提供特定时期的日志副本 | 从 PG 活跃分区 + 归档存储中提取；生成加密 ZIP；记录导出操作到审计日志 |

**权限/授权要求:**

- Security Officer: Full access to all audit logs; configure tamper detection; investigate anomalies
- Data Manager: Query audit logs for data management purposes (modification history, reconciliation support); generate audit reports
- CRC/PI: View audit logs scoped to their own subjects/sites; cannot view system-level logs
- Auditor (external): Read-only access to audit reports; can request full audit log export (with approval)
- Patient: View access_log entries for own data (P12); challenge suspicious entries
- System Admin: Manage partition creation, archive configuration, OpenSearch index management
- Application (system-to-system): INSERT-only access to audit_log; no read access

**关联数据实体:** AuditLog, AccessLog, AuditChainAnchor, ArchivedAuditPartition, AuditReport, SecurityIncident

**关联 REST API:**

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api/v1/audit-logs | 查询审计日志（分页+筛选） |
| GET | /api/v1/audit-logs/search | OpenSearch 全文搜索审计日志 |
| GET | /api/v1/audit-logs/{auditLogId} | 获取单条审计日志详情（含变更前后对比） |
| GET | /api/v1/audit-logs/subject/{subjectId} | 获取指定受试者的所有审计记录 |
| GET | /api/v1/audit-logs/entity/{entityType}/{entityId} | 获取指定实体的变更历史 |
| POST | /api/v1/audit-logs/reports | 生成审计报告 |
| GET | /api/v1/audit-logs/reports/{reportId} | 获取审计报告状态 |
| GET | /api/v1/audit-logs/reports/{reportId}/download | 下载审计报告 |
| POST | /api/v1/audit-logs/verify-chain | 手动触发哈希链完整性验证 |
| GET | /api/v1/audit-logs/anomalies | 获取异常访问检测结果 |
| GET | /api/v1/access-logs/subject/{subjectId} | (Patient/P12) 获取受试者数据访问日志 |

---

### H10: 脱敏与权限控制 Data Masking & Access Control

**模块目标:** Implement a comprehensive, multi-layered data masking framework that dynamically masks sensitive data (PII, PHI, clinical data) based on user role, data scope, and access context, with consistent masking rules applied across all interfaces including API responses, database queries, file exports, and log outputs, ensuring compliance with China PIPL, GDPR, and GCP data protection requirements.

**子功能清单:**

| 序号 | 子功能 | 描述 | 关键操作 |
|------|--------|------|----------|
| H10-01 | 动态数据脱敏 | Field-level masking rules applied at API response serialization layer based on user role + data scope; masking types: full_mask, partial_mask, hash, nullify, pseudonymize | 字段级脱敏、角色关联、脱敏类型、动态应用 |
| H10-02 | 字段级脱敏规则 | Configurable masking rules per entity field; per-role masking configuration; sensitivity classification per field (PUBLIC, INTERNAL, CONFIDENTIAL, RESTRICTED) | 规则配置、敏感度分级、角色配置、规则模板 |
| H10-03 | 导出脱敏 | Apply masking to exported files (CSV, Excel, PDF, SAS); consistent with API masking; irreversible masking for public release | 导出前脱敏、格式适配、一致性保证、公开脱敏 |
| H10-04 | API 响应脱敏 | Jackson serializer custom module intercepts JSON serialization; applies masking to annotated fields; supports nesting (JSONB fields) | Jackson 模块、注解驱动、嵌套脱敏、响应拦截 |
| H10-05 | 日志脱敏 | Logback/Log4j2 converter that masks sensitive data in log output; prevent PII leakage in application logs | 日志脱敏、Pattern 替换、PII 检测、日志级别适配 |
| H10-06 | 跨接口一致性保障 | Centralized masking rules engine ensures same field masked identically across REST API, GraphQL (if used), FHIR endpoint, export, and log outputs | 统一规则引擎、跨接口一致性、规则同步 |
| H10-07 | 脱敏审计与报告 | Track all unmasked data accesses; report on PII data exposure; support data protection impact assessment (DPIA) | 脱敏绕过记录、PII 暴露报告、DPIA 支持 |

**核心交互流程:**

1. Sensitivity Classification:
   - Each entity field annotated with sensitivity level:
     - PUBLIC: non-sensitive, visible to all (e.g., study name, visit type).
     - INTERNAL: visible to internal staff, masked for patients and external (e.g., CRC notes, internal process status).
     - CONFIDENTIAL: requires specific authorization; masked by default (e.g., subject full name, contact phone, ID number, precise address).
     - RESTRICTED: strictly limited access; fully masked unless explicit audit-justified access (e.g., full bank account number, genetic data, HIV status).
   - Classification stored in `data_field_classification` table (+ code annotations via `@Sensitivity` for compile-time safety).

2. Masking Types & Rules:
   - `full_mask`: replace entire value with "****" (e.g., bank account number).
   - `partial_mask`: show first 1-3 chars + mask rest (e.g., name: "张**", phone: "138****1234", ID: "310***********1234").
   - `hash`: display SHA-256 truncated to 8 chars as pseudonymous identifier (e.g., for de-identified data sets).
   - `nullify`: set field to null in response (e.g., genetic data for roles without authorization).
   - `pseudonymize`: replace with consistent pseudonym (so same person consistently gets same pseudonym across exports).
   - Rules configured in `masking_rules` JSONB per entity_type + field_name + role:
     ```
     {
       "Subject": {
         "name": [
           {"role": "PATIENT_SELF", "mask_type": "NONE"},
           {"role": "CAREGIVER", "mask_type": "NONE"},
           {"role": "CRC", "mask_type": "NONE"},
           {"role": "PI", "mask_type": "NONE"},
           {"role": "DATA_MANAGER", "mask_type": "PARTIAL", "config": {"visible_chars": 1, "mask_char": "*"}},
           {"role": "MONITOR", "mask_type": "PARTIAL", "config": {"visible_chars": 1}},
           {"role": "AUDITOR", "mask_type": "NONE"},
           {"role": "DEFAULT", "mask_type": "FULL"}
         ],
         "national_id": [
           {"role": "PATIENT_SELF", "mask_type": "NONE"},
           {"role": "CRC", "mask_type": "PARTIAL", "config": {"visible_prefix": 3, "visible_suffix": 4}},
           {"role": "DEFAULT", "mask_type": "FULL"}
         ]
       }
     }
     ```

3. API Response Masking:
   - Jackson module `DataMaskingModule` extends `StdSerializer<Object>` or uses `BeanSerializerModifier`.
   - For each field being serialized:
     1. Check `@Masked` annotation (or consult masking_rules config).
     2. Determine current user role from SecurityContext.
     3. Determine relationship to data: self (patient accessing own data), proxy (caregiver), study_staff (CRC/PI for study), cross_study (DM for multiple studies), external (monitor, auditor).
     4. Apply first matching rule; if no match, apply DEFAULT rule.
   - Performance: masking rules cached in Redis per (entity_type, role) key; local Caffeine cache as fallback; field-level mask decision computed once per schema per role on startup.
   - JSONB fields (dynamic content): masking applied via recursive JSON traversal; field names matched against masking rules.

4. Export Masking:
   - Before export generation (H07), export engine consults masking engine for the requester's role and data scope.
   - Masking applied during export stream processing: cell values checked against masking rules and transformed as CSV/Excel cells are written.
   - Note: export for PUBLIC release or sponsor requires stricter masking (de-identification: all PII fields hashed or removed, dates shifted per configured offset).
   - Audit: every export logs which masking rules were applied (snapshot of mask_config at time of export).

5. Log Masking:
   - Logback `MaskingPatternLayout` or `RegexReplacer` configured in logback-spring.xml.
   - Patterns detected and masked in log messages:
     - ID card: `\b\d{6}(19|20)\d{2}(0[1-9]|1[0-2])(0[1-9]|[12]\d|3[01])\d{3}[\dXx]\b` → `310***********1234`
     - Phone: `\b1[3-9]\d{9}\b` → `138****1234`
     - Email: `\b[\w.-]+@[\w.-]+\.\w+\b` → `zh***@***.com`
     - Name (Chinese): configured list of known subject names → `张**`
   - Structured logging: JSON log format also masked; MDC fields checked for PII before logging.
   - Sentinel value: if a field should NEVER appear in logs (e.g., password, token, full ID number), use `@NeverLog` annotation → LogInterceptor strips from log even before masking.

6. Consistency Guarantee:
   - Central `MaskingRuleService` used by all components: REST API serialization, Export Engine, Log Masker, FHIR Adapter, AuditLog Service (when preparing patient-visible access log).
   - Rule changes are event-sourced: `MaskingRuleUpdatedEvent` → all services refresh local caches within 60s.
   - Consistency check job (daily): select random sample of API responses + export files; verify masking is consistent across interfaces. Discrepancy logged to `MaskingConsistencyIssue` table.

**核心字段:**

| 字段 | 类型 | 说明 |
|------|------|------|
| field_classification_id | UUID (UUIDv7) | PK |
| entity_name | VARCHAR(100) | e.g., Subject, Observation, AE |
| field_path | VARCHAR(200) | e.g., name, identifiers[0].value, contact.phone |
| sensitivity_level | VARCHAR(20) | PUBLIC, INTERNAL, CONFIDENTIAL, RESTRICTED |
| data_category | VARCHAR(50) | PII (personally identifiable), PHI (protected health info), CLINICAL, ADMINISTRATIVE |
| regulatory_basis | VARCHAR(100) | PIPL, GDPR, HIPAA, GCP |
| requires_consent | BOOLEAN | Whether patient consent required for this field |
| requires_audit_on_access | BOOLEAN | Whether READ access triggers audit log |
| created_at | TIMESTAMPTZ | When classified |
| updated_at | TIMESTAMPTZ | Last update |

| 字段 | 类型 | 说明 |
|------|------|------|
| masking_rule_id | UUID (UUIDv7) | PK |
| entity_name | VARCHAR(100) | Which entity |
| field_path | VARCHAR(200) | Which field (supports wildcards: identifiers[*].value) |
| role | VARCHAR(50) | Which role this rule applies to; DEFAULT for fallback |
| mask_type | VARCHAR(20) | NONE, FULL, PARTIAL, HASH, NULLIFY, PSEUDONYMIZE |
| mask_config | JSONB | Configuration for the mask type: {visible_chars, mask_char, visible_prefix, visible_suffix, hash_algorithm, hash_truncate_length} |
| priority | INTEGER | Lower number = higher priority (0 = highest) |
| is_active | BOOLEAN | Whether currently enforced |
| effective_from | TIMESTAMPTZ | When rule became active |
| effective_until | TIMESTAMPTZ | When rule expires |
| created_by | UUID | Who created the rule |
| change_reason | TEXT | Justification for rule creation/change |

| 字段 | 类型 | 说明 |
|------|------|------|
| unmasked_access_id | UUID (UUIDv7) | PK |
| user_id | UUID | Who accessed unmasked data |
| entity_type | VARCHAR(100) | Which entity was accessed |
| entity_id | UUID | Which record |
| field_path | VARCHAR(200) | Which field was accessed unmasked |
| access_reason | TEXT | Business justification (e.g., "SAE report to regulatory authority") |
| access_approved_by | UUID | Who approved the unmasked access (if required) |
| accessed_at | TIMESTAMPTZ | When accessed |
| data_scope | VARCHAR(100) | Context: API response, Export, Audit report |

**异常场景:**

| 场景 | 处理方式 |
|------|----------|
| 两个脱敏规则对同一字段冲突（同一角色多条规则） | 按 priority 字段排序，应用第一个匹配的 active 规则；启动时检测冲突并警告 |
| API 响应序列化时发生脱敏性能瓶颈 | 规则缓存预热（启动时加载所有活跃规则）；字段级缓存（每 schema 每角色）；复杂 JSONB 字段使用路径缓存 |
| 导出数据包含不应出现的未脱敏字段 | 导出前自动运行脱敏验证器；发现未脱敏的 CONFIDENTIAL/RESTRICTED 字段 → 阻止导出并通知安全 |
| 日志脱敏规则漏网（新格式的手机号/身份证） | 定期审核日志样本；发现 PII 泄漏 → 更新正则规则；通过 ML 模型辅助检测新型 PII 模式 |
| 患者 P12 隐私中心查看到的访问日志与后台实际不符 | 访问日志生成与脱敏规则使用同一引擎；不一致检测任务每日验证 |
| 跨接口脱敏不一致（API 脱敏但 Export 未脱敏） | 一致性校验任务每日运行；发现不一致阻止 Export 并通知 Data Manager |
| 角色权限变更后缓存未及时更新 | 脱敏规则缓存使用 Redis Pub/Sub 失效通知；本地 Caffeine 缓存 TTL 60s 作为兜底 |

**权限/授权要求:**

- Security Officer: Configure sensitivity classifications; define masking rules; approve unmasked access requests; view unmasked access audit log
- Data Protection Officer (DPO): Review PII protection compliance; approve data protection policies; respond to patient data challenges
- Data Manager: View masking rule configurations (read-only unless privileged); view masking consistency reports
- System Admin: Manage caching and performance of masking engine; configure log masking patterns
- CRC/PI: No special masking privileges; receive masked data based on their role masking rules
- Patient: View own unmasked data; see masked view of anyone else; challenge in P12
- Auditor: View unmasked data with audit-justified access (logged and reported)

**关联数据实体:** DataFieldClassification, MaskingRule, UnmaskedAccessLog, MaskingConsistencyIssue, Subject, User, AuditLog

**关联 REST API:**

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api/v1/masking/classifications | 获取字段敏感度分类列表 |
| PUT | /api/v1/masking/classifications/{classificationId} | 更新字段敏感度分类 |
| GET | /api/v1/masking/rules | 获取脱敏规则列表 |
| POST | /api/v1/masking/rules | 创建脱敏规则 |
| PUT | /api/v1/masking/rules/{ruleId} | 更新脱敏规则 |
| DELETE | /api/v1/masking/rules/{ruleId} | 删除脱敏规则（软删除） |
| POST | /api/v1/masking/rules/test | 测试脱敏规则（输入样例数据，返回脱敏结果） |
| GET | /api/v1/masking/consistency-report | 获取脱敏一致性检查报告 |
| GET | /api/v1/masking/unmasked-access-log | 获取未脱敏数据访问日志 |
| POST | /api/v1/masking/unmasked-access/request | 请求临时访问未脱敏数据（需审批） |
| GET | /api/v1/masking/export-preview | 导出前预览脱敏效果 |

---

## Document Metadata

| Item | Value |
|------|-------|
| Document ID | PMS-R2-MODULES-v1.0 |
| Total Modules | 22 (12 Patient MiniApp + 10 Data & Integration Hub) |
| Total Pages | P01-P12 Patient Modules; H01-H10 Integration Modules |
| Authors | Clinical Digital Solutions Consultant + Healthcare Data Integration Architect |
| Review Status | Draft for Review |
| Next Steps | Round 3: API Contract Definition (OpenAPI 3.0), Round 4: Database DDL (Liquibase), Round 5: Deployment Architecture |

---

*End of Round 2 Module Detailed Design Document*