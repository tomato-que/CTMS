# AI/OCR 设计方案 Part 1：OCR Pipeline、数据结构与安全边界

> **项目**: PMS (Patient Management System)  
> **技术栈**: Python FastAPI + PaddleOCR/PaddleX + RabbitMQ + MinIO + OpenSearch  
> **后端**: Java Spring Boot（持有全部业务状态，通过 Callback 接收 AI 结果）  
> **版本**: Round 3 - AI/OCR Design Part 1  
> **日期**: 2026-05-11

---

## 目录

1. [OCR Pipeline：完整 18 步流程](#section-1-ocr-pipeline)
2. [OCR Result 数据结构](#section-2-ocr-result-data-structure)
3. [Confidence Scoring 置信度评分体系](#section-3-confidence-scoring)
4. [Unit Standardization 单位标准化](#section-4-unit-standardization)
5. [Abnormal Value Detection 异常值检测](#section-5-abnormal-value-detection)
6. [Document Types & PaddleX Pipeline](#section-6-document-types--paddlex-pipeline)
7. [Human Review UI & Workflow 人工审核](#section-7-human-review-ui--workflow)
8. [AI Safety Boundaries 安全边界](#section-8-ai-safety-boundaries)

---

## Section 1: OCR Pipeline

### 1.0 架构总览

```
┌──────────┐    ┌─────────────┐    ┌──────────┐    ┌───────────────┐
│  Client  │───>│ Java Backend │───>│ RabbitMQ  │───>│  AI Service   │
│ (Web/App)│<───│ (SpringBoot)│<───│ (Queue)   │<───│ (FastAPI)     │
└──────────┘    └─────────────┘    └──────────┘    └───────────────┘
      │               │                                  │
      │               │         ┌──────────┐             │
      │               └────────>│  MinIO   │<────────────┘
      │                         │(Object   │
      │                         │ Storage) │
      │                         └──────────┘
      │
      v
  ┌────────┐
  │  CDN   │
  │(Presign)│
  └────────┘
```

**核心原则**:
- AI Service 不直接访问主数据库（MySQL/PostgreSQL）
- AI Service 不修改业务状态，仅通过 Callback 回传结果
- 所有 AI 输出记录：model_version, prompt_version, confidence_score, references
- 所有确认/拒绝操作均需审计

---

### 1.1 Step 1-4：客户端上传流程

#### Step 1: 客户端请求预签名 URL (Presigned URL)

| 项目 | 说明 |
|------|------|
| **触发者** | Client (Web 前端 / Mobile App) |
| **请求** | `POST /api/v1/files/presigned-url` |
| **请求体** | `{ "file_name": "lab_report_20260511.pdf", "file_size": 2457600, "content_type": "application/pdf", "study_id": "STU-2026-00045", "subject_id": "SUB-00123", "document_type": "LAB_REPORT" }` |
| **后端处理** | Java Backend 验证 study_id/subject_id 存在性，生成 `file_id` (UUID v7)，调用 MinIO SDK `presignedPutObject()` 生成预签名 URL，有效期 300 秒 |
| **输出** | `{ "file_id": "f-7a3b2c1d-...", "upload_url": "https://minio.internal/pms-uploads/...?X-Amz-...", "expires_at": "2026-05-11T10:05:00Z", "max_size_bytes": 52428800 }` |
| **错误模式** | 400: study_id 无效 / 404: subject_id 不存在 / 413: 文件超过最大大小(50MB) / 429: 上传频率限制(每用户每秒3次) |
| **重试策略** | 客户端指数退避 (1s, 2s, 4s, 8s, max 30s)，最多重试 3 次 |
| **审计点** | 记录 `{timestamp, user_id, file_id, file_name, study_id, action: "PRESIGNED_URL_REQUESTED"}` 到 audit_log |

#### Step 2: MIME 类型校验（客户端侧）

| 项目 | 说明 |
|------|------|
| **触发者** | Client |
| **校验位置** | 客户端 JavaScript/WASM（上传前）. 服务端 MinIO Bucket Policy 二次校验 |
| **允许类型** | `application/pdf`, `image/jpeg`, `image/png`, `image/tiff`, `image/dicom` (DICOM 另行处理) |
| **魔数校验** | 读取文件前 4 字节验证：PDF=`%PDF`, JPEG=`\xFF\xD8\xFF`, PNG=`\x89PNG`, TIFF=`II*\x00`/`MM\x00*` |
| **输出** | 校验通过 → 继续上传；校验失败 → 向用户显示 "不支持的文件格式" |
| **错误模式** | MIME_MISMATCH: Content-Type 与实际魔数不符 / UNSUPPORTED_TYPE: 不在允许列表中 |
| **审计点** | 记录 `{file_id, detected_mime, declared_mime, magic_bytes, result: "pass"/"fail"}` |

#### Step 3: 直接上传至 MinIO

| 项目 | 说明 |
|------|------|
| **触发者** | Client |
| **请求** | `PUT {presigned_url}` 带 `Content-Type` header 和文件二进制流 |
| **MinIO 侧** | 校验签名、过期时间、Content-Type 匹配、文件大小 |
| **输出** | HTTP 200 + ETag；文件存储于 `pms-uploads/{tenant_id}/{study_id}/{file_id}/{original_name}` |
| **错误模式** | 403: 签名过期或无效 / 413: MinIO Bucket Size Limit(50MB) / 409: 内容校验和不匹配 |
| **重试策略** | 客户端重试 2 次，每次间隔 3 秒；若仍失败，需重新申请预签名 URL（回到 Step 1） |
| **审计点** | MinIO Access Log (JSON format) 记录到 audit queue |

#### Step 4: 上传确认 Callback

| 项目 | 说明 |
|------|------|
| **触发者** | Client（上传成功后） |
| **请求** | `POST /api/v1/files/{file_id}/confirm-upload` |
| **请求体** | `{ "file_id": "f-7a3b2c1d-...", "etag": "\"d41d8cd98f00b204e9800998ecf8427e\"", "original_name": "lab_report_20260511.pdf", "uploaded_size": 2457600 }` |
| **后端处理** | 验证 ETag 匹配（调用 MinIO statObject 比对），校验 uploaded_size 与 MinIO 一致 |
| **输出** | `{ "file_id": "...", "status": "UPLOADED", "ocr_status": "PENDING" }` |
| **错误模式** | 404: file_id 不存在 / 409: ETag 不匹配（文件上传不完整或损坏）/ 422: 大小不一致 |
| **审计点** | 记录 `{timestamp, file_id, user_id, etag, size, action: "UPLOAD_CONFIRMED"}` |

---

### 1.2 Step 5-7：Java Backend 处理

#### Step 5: FileObject 创建与持久化

| 项目 | 说明 |
|------|------|
| **触发者** | 确认上传 Callback (Step 4) |
| **处理逻辑** | Java Service 层创建 `FileObject` JPA Entity |
| **Entity 字段** | `id` (UUID), `file_name`, `original_name`, `storage_path`, `content_type`, `file_size`, `etag`, `study_id`, `subject_id`, `document_type` (枚举), `uploaded_by`, `uploaded_at`, `ocr_status` (枚举: PENDING/PROCESSING/COMPLETED/FAILED), `review_status` (枚举: PENDING_REVIEW/IN_REVIEW/CONFIRMED/PARTIALLY_CONFIRMED/REJECTED), `created_at`, `updated_at` |
| **输出** | FileObject 持久化到主数据库; 返回 `file_id` |
| **错误模式** | 500: 数据库写入失败（事务回滚） |
| **审计点** | JPA Audit (`@CreatedDate`, `@LastModifiedDate`, `@CreatedBy`); audit_log 记录 `{action: "FILEOBJECT_CREATED", file_id, study_id}` |

#### Step 6: 创建 Scan Task（扫描任务）

| 项目 | 说明 |
|------|------|
| **触发者** | FileObject 创建成功后的 `@TransactionalEventListener` (AFTER_COMMIT phase) |
| **任务模型** | `ScanTask` Entity: `id`, `file_id`, `scan_type` (OCR/DICOM/VIRUS_SCAN), `status` (PENDING/QUEUED/PROCESSING/COMPLETED/FAILED), `priority` (0-10), `retry_count` (default 0), `max_retries` (default 3), `scheduled_at`, `started_at`, `completed_at`, `error_message`, `created_at` |
| **病毒扫描** | 集成 ClamAV: 若 `VIRUS_SCAN_ENABLED=true`，先排入病毒扫描队列；扫描通过后方可继续 OCR |
| **输出** | ScanTask 持久化；若为 VIRUS_SCAN，进入病毒扫描子流程 |
| **错误模式** | 病毒检测阳性 → FileObject 标记为 INFECTED/RESTRICTED，通知管理员，流程终止 |
| **审计点** | `{action: "SCAN_TASK_CREATED", file_id, scan_type, task_id}` |

#### Step 7: OCR 任务入队 RabbitMQ

| 项目 | 说明 |
|------|------|
| **触发者** | ScanTask 状态变为 QUEUED (病毒扫描通过 或 跳过) |
| **RabbitMQ 配置** | Exchange: `pms.ai.ocr` (topic); Routing Key: `ocr.{document_type}` (如 `ocr.LAB_REPORT`); Queue: `ocr.lab_report`, `ocr.imaging_report`, `ocr.pathology_report`, `ocr.generic`; 每个 Queue 有独立的 consumer concurrency 配置 |
| **消息体** | JSON: `{ "task_id": "scan-xxx", "file_id": "f-xxx", "document_type": "LAB_REPORT", "study_id": "STU-2026-00045", "subject_id": "SUB-00123", "storage_path": "pms-uploads/t-001/STU-2026-00045/f-xxx/lab_report.pdf", "callback_url": "https://java-backend.internal/api/v1/ai/ocr-callback", "callback_token": "jwt-xxx", "priority": 5, "requested_at": "2026-05-11T10:02:00Z" }` |
| **消息属性** | `persistent: true` (消息持久化到磁盘), `content_type: application/json`, `message_id: UUID`, `timestamp: now`, `expiration: 3600000` (1 小时 TTL) |
| **DLX 配置** | Dead Letter Exchange: `pms.ai.ocr.dlx`; 死信队列: `ocr.dlq`; 原队列绑定 `x-dead-letter-exchange: pms.ai.ocr.dlx`; 消息被 reject/nack 3 次后进入 DLQ |
| **输出** | 消息发布到 RabbitMQ，RabbitMQ 返回 `publish-confirm`; ScanTask 状态更新为 QUEUED |
| **错误模式** | RabbitMQ 不可达 → 重试 3 次，仍失败则 ScanTask 标记为 FAILED，写入 dead_letter 表本地兜底; 消息过期(1h) → 进入 DLQ，触发告警 |
| **审计点** | `{action: "OCR_TASK_ENQUEUED", file_id, task_id, queue_name, message_id, routing_key}` |

---

### 1.3 Step 8-13：AI Service 处理

#### Step 8: 下载文件（AI Service 侧）

| 项目 | 说明 |
|------|------|
| **触发者** | AI Service (FastAPI) 的 RabbitMQ Consumer (`ocr.lab_report` / `ocr.imaging_report` / `ocr.pathology_report` / `ocr.generic`) |
| **Consumer 配置** | `prefetch_count: 1` (每次只取一条，避免大文件 OOM); `acknowledge_mode: manual` (手动 ACK，处理成功后再 ACK) |
| **下载逻辑** | 解析消息中的 `storage_path`; 调用 MinIO Python SDK `client.fget_object(bucket, object_path, local_temp_path)` |
| **临时存储** | `/tmp/pms-ocr/{task_id}/{file_name}`; 文件处理完成后立即删除（finally 块保证） |
| **文件大小限制** | PDF ≤ 50MB，Image ≤ 20MB; 超出 → NACK 消息进入 DLQ，在 NACK 中携带 `error: "FILE_TOO_LARGE"` |
| **输入** | RabbitMQ 消息 + MinIO 文件 |
| **输出** | 本地临时文件路径 `local_file_path` |
| **错误模式** | MinIO 404: 文件已过期/删除 → NACK 消息 / 网络超时(30s) → 重试 1 次，仍失败 NACK / 磁盘空间不足(/tmp < 100MB) → NACK，通知运维 |
| **审计点** | `{action: "AI_DOWNLOAD_FILE", task_id, file_id, file_size, download_duration_ms, minio_etag}` |

#### Step 9: PaddleOCR 文字识别

| 项目 | 说明 |
|------|------|
| **触发者** | Step 8 成功 |
| **引擎版本** | PaddleOCR >= 2.7.0; 模型: PP-OCRv4 (detection + recognition) |
| **检测模型** | `PP-OCRv4_det` (DB++ 文本检测): 输入图像 → 输出文字区域坐标 `[[x1,y1], [x2,y2], [x3,y3], [x4,y4]]` |
| **识别模型** | `PP-OCRv4_rec` (SVTR_LCNet 文字识别): 输入文字区域图像 → 输出文本字符串 + 字符级置信度 |
| **分类模型** | `PP-OCRv4_cls` (文本方向分类): 0° / 180° 旋转校正 |
| **PDF 处理** | 使用 `pdf2image` (Dpi=300) 将 PDF 每页转为 PNG; 逐页 OCR |
| **批量推理** | `batch_size: 8` (GPU T4/V100 推荐配置); `use_gpu: true`; `use_mp: true` (多进程加速); `cpu_threads: 4` (CPU fallback) |
| **输出** | `ocr_raw_result`: List of `{page: int, block_id: int, text: str, confidence: float[0-1], bbox: [x1,y1,x2,y2,x3,y3,x4,y4], orientation: 0/180}` |
| **输入** | 本地临时文件路径 |
| **错误模式** | OCR_MODEL_LOAD_FAILURE: 模型文件缺失/损坏 → 退出 / GPU_OOM: batch_size 过大 → 自动降为 batch_size=1 / EMPTY_RESULT: 文档无文字区域（如纯图报告）→ 标记为 IMAGE_ONLY，跳过 OCR / CORRUPTED_PDF: PDF 无法渲染 → NACK |
| **重试策略** | GPU_OOM 自动降级重试；其他错误 NACK（最多 3 次进入 DLQ） |
| **审计点** | `{action: "OCR_RECOGNITION_COMPLETE", task_id, model: "PP-OCRv4", pages_processed, text_blocks_detected, avg_confidence, duration_ms}` |

#### Step 10: PaddleX Pipeline 结构化提取

| 项目 | 说明 |
|------|------|
| **触发者** | Step 9 成功 |
| **PaddleX 版本** | PaddleX >= 2.1.0 |
| **Pipeline 组件** | (1) Document Layout Analysis (版面分析); (2) Key-Value Pair Extraction (键值对提取); (3) Table Structure Recognition (表格结构识别); (4) Field Mapping (字段映射到 CDM) |

**Step 10a: 版面分析 (Document Layout Analysis)**

| 项目 | 说明 |
|------|------|
| **模型** | PP-DocLayout (基于 RT-DETR 的文档版面分析模型) |
| **功能** | 检测文档中的标题(Header)、段落(Paragraph)、表格(Table)、图片(Figure)、页眉页脚(Header/Footer)、列表(List)  |
| **输出** | `layout_result`: List of `{block_id, label: "header"/"paragraph"/"table"/"figure"/"list"/"header_footer", bbox: [x1,y1,x2,y2], order: reading_order_index}` |
| **阅读顺序** | 基于 y 坐标 + x 坐标排序（同 y 区间内从左到右，不同 y 区间从上到下） |

**Step 10b: 键值对提取 (Key-Value Pair Extraction)**

| 项目 | 说明 |
|------|------|
| **模型** | PP-KeyValueExtraction (基于 Prompt 的 K-V 提取模型) |
| **Prompt 示例** | `"姓名", "性别", "年龄", "检验项目", "检测结果", "参考区间", "计量单位"` (根据 document_type 动态选择 Prompt) |
| **匹配逻辑** | (1) 基于 OCR 文字在页面上的空间位置，寻找与 Key word 最近的 Value text block; (2) 基于预定义规则匹配（如"姓名"后紧跟冒号/空格后的文本）; (3) 基于版面分析中同 Table block 内的 cell 间关系 |
| **输出** | `kv_pairs`: List of `{key: str, value: str, key_bbox, value_bbox, distance_px, match_method: "spatial"/"rule"/"table_cell", confidence: float}` |

**Step 10c: 表格结构识别 (Table Structure Recognition)**

| 项目 | 说明 |
|------|------|
| **模型** | SLANet (Structure Location Alignment Network) 表格结构识别 |
| **功能** | 识别表格的行列结构、表头、单元格归属关系 |
| **输出** | `table_result`: `{rows: int, cols: int, headers: [str], cells: [{row: int, col: int, text: str, rowspan: int, colspan: int, is_header: bool, bbox, confidence}]}` |

**Step 10d: 字段映射至 CDM Observation**

| 项目 | 说明 |
|------|------|
| **映射规则** | 基于预定义的 Template-Field 映射表（JSON 配置） |
| **映射表结构** | `{template_id, document_type, field_name_cn, cdm_observation_code (LOINC/SNOMED), cdm_observation_name, value_type (numeric/text/coded/date), unit_standardization_rule, reference_range_parser, abnormal_flag_logic}` |
| **输出** | `cdm_observations`: 结构化的观察项列表（详见 Section 2） |

| **错误模式** | LAYOUT_ANALYSIS_FAILED: 版面分割异常 / KV_EXTRACTION_EMPTY: 未提取到任何键值对 / TABLE_PARSE_FAILED: 表格结构解析失败（合并单元格/无边框表格） |
| **审计点** | `{action: "PADDLEX_PIPELINE_COMPLETE", task_id, layouts_detected, kv_pairs_extracted, tables_detected, fields_mapped_to_cdm, pipeline_duration_ms}` |

#### Step 11: Unit Normalization（单位标准化）

| 项目 | 说明 |
|------|------|
| **触发者** | Step 10d 之后 |
| **逻辑** | 对每个 CDM Observation，执行单位标准化（详见 Section 4） |
| **处理步骤** | (1) 从 PaddleX 提取的文本中识别原始单位字符串; (2) 在单位映射表中查找 (原始单位, Observation Code) → 标准单位; (3) 执行数值换算（mg/dL ↔ mmol/L 等）; (4) 若单位不可识别，标记 `unit_recognized: false` |
| **输出** | 每个 Observation 新增字段：`raw_value`, `raw_unit`, `normalized_value`, `normalized_unit`, `conversion_factor`, `unit_recognized` |
| **错误模式** | UNIT_NOT_FOUND: 单位字符串不在映射表中 → `unit_recognized: false`, 不阻塞流程，留给人工审核 / CONVERSION_ERROR: 数值换算失败（非数字）→ 记录 raw_value，marked for review |
| **审计点** | `{action: "UNIT_NORMALIZED", observations_count, units_mapped, units_unknown}` |

#### Step 12: Abnormal Flag Detection（异常值检测）

| 项目 | 说明 |
|------|------|
| **触发者** | Step 11 之后 |
| **逻辑** | 对每个 CDM Observation 检测是否异常（详见 Section 5） |
| **处理步骤** | (1) 解析参考范围字符串 (如 `"3.5-5.5"`, `"<1.0"`, `">100"`); (2) 将 normalized_value 与参考范围比较; (3) 标记 abnormal_flag: NORMAL / LOW / HIGH / CRITICAL_LOW / CRITICAL_HIGH / ABNORMAL (coded values); (4) 与 study 级别的安全范围(mSafeRange)进行二次比对 |
| **Critical/Panic 阈值** | 基于预配置的"危急值表"，如：血糖 >33.3 mmol/L, 血钾 <2.5 或 >6.5 mmol/L, 血红蛋白 <60 g/L |
| **输出** | 每个 Observation 新增字段：`abnormal_flag`, `reference_range`, `reference_range_parsed`, `critical_threshold`, `breached_threshold` |
| **错误模式** | RANGE_PARSE_FAILED: 参考范围格式无法解析 → `abnormal_flag: UNCERTAIN`, 标记为人工审核 |
| **审计点** | `{action: "ABNORMAL_FLAG_DETECTED", observations_total, abnormal_count, critical_count, uncertain_count}` |

#### Step 13: Confidence Scoring & Callback（置信度评分与回调）

| 项目 | 说明 |
|------|------|
| **触发者** | Step 12 之后 |
| **置信度计算** | 多级评分（详见 Section 3）: character-level + word-level + context-level + template-matching → per-field confidence + document-level confidence |
| **置信度阈值** | HIGH (≥0.95) / MEDIUM (0.80-0.94) / LOW (<0.80) |
| **OCR Job 结果组装** | 详见 Section 2 完整 JSONB Schema |

**Callback 请求**:

```
POST {callback_url}
Authorization: Bearer {callback_token}
Content-Type: application/json
X-Request-ID: {uuid}

{
  "file_id": "f-7a3b2c1d-...",
  "task_id": "scan-xxx",
  "status": "COMPLETED",
  "model_version": "PP-OCRv4_20260401",
  "pipeline_version": "PaddleX_2.1.0_20260501",
  "prompt_version": "lab-report-v3",
  "template_id": "TPL-LAB-001",
  "template_match_confidence": 0.93,
  "result_jsonb": { ... },    // 完整结果（见 Section 2）
  "processing_metadata": {
    "started_at": "2026-05-11T10:03:00Z",
    "completed_at": "2026-05-11T10:03:45Z",
    "duration_ms": 45000,
    "pages_processed": 2,
    "model_confidence_avg": 0.91
  },
  "warnings": [
    { "field": "TEST_03", "warning": "UNIT_NOT_RECOGNIZED", "detail": "原始单位 'mg' 无法在映射表中找到" }
  ],
  "error": null
}
```

| **Callback 重试策略** | HTTP 非 2xx → 指数退避重试 (2s, 4s, 8s, 16s, max 32s)，最多 5 次; 全部失败 → 写入 dead_letter 本地表，触发告警 |
| **Callback 成功** | AI Service 发送 `basic_ack` 给 RabbitMQ 确认消费; 清理临时文件 |
| **Callback 失败处理** | NACK 消息（requeue=false），消息进入 DLQ; 同时写入本地 outbox 表，由后台 Job 周期性重试 callback |
| **审核点** | `{action: "OCR_RESULT_CALLBACK", callback_url, status, attempt_count, duration_ms}` |

---

### 1.4 Step 14-18：Java Backend 结果处理

#### Step 14: OCRJob 创建

| 项目 | 说明 |
|------|------|
| **触发者** | POST `/api/v1/ai/ocr-callback` (AI Service Callback) |
| **处理** | Java Controller 验证 `callback_token` (JWT 签名 + 有效期); 反序列化请求体为 `OcrCallbackDTO` |
| **OCRJob Entity** | `id` (UUID), `file_id` (FK→FileObject), `task_id`, `status` (PROCESSING/COMPLETED/PARTIAL/FAILED), `template_id`, `template_match_confidence`, `model_version`, `pipeline_version`, `prompt_version`, `result_jsonb` (JPA @Convert JSONB/JSON), `processing_duration_ms`, `pages_processed`, `model_confidence_avg`, `warnings` (JSON array), `error_message`, `created_at`, `completed_at` |
| **输出** | OCRJob 持久化到主数据库; FileObject.ocr_status 更新为 COMPLETED |
| **错误模式** | 400: JWT 校验失败 / 404: file_id 不存在 / 409: 该 file_id 已有 COMPLETED 状态的 OCRJob（幂等性检查，返回已有结果） |
| **审计点** | `{action: "OCR_JOB_CREATED", ocr_job_id, file_id, template_id, model_version, confidence_avg}` |

#### Step 15: DiagnosticReport / Observation 创建

| 项目 | 说明 |
|------|------|
| **触发者** | OCRJob 创建成功后的 `@TransactionalEventListener` |
| **处理逻辑** | 遍历 `result_jsonb.observations[]`，为每个 Observation 创建 `DiagnosticObservation` JPA Entity |
| **DiagnosticObservation Entity** | `id` (UUID), `diagnostic_report_id` (FK), `subject_id`, `study_id`, `file_id`, `ocr_job_id`, `observation_code` (LOINC/SNOMED), `observation_name`, `field_name` (报告中字段名), `field_type` (NUMERIC/TEXT/CODED/DATE), `raw_value`, `raw_unit`, `normalized_value`, `normalized_unit`, `reference_range`, `abnormal_flag` (NORMAL/LOW/HIGH/CRITICAL_LOW/CRITICAL_HIGH/ABNORMAL/UNCERTAIN), `confidence_score`, `review_status` (PENDING_REVIEW), `correction` (null), `final_value` (null), `is_confirmed` (false), `created_at`, `updated_at` |
| **DiagnosticReport Entity** | `id` (UUID), `subject_id`, `study_id`, `file_id`, `ocr_job_id`, `report_type`, `report_date`, `review_status` (PENDING_REVIEW), `reviewed_by`, `reviewed_at`, `confirmed_count`, `total_count`, `created_at`, `updated_at` |
| **输出** | DiagnosticReport + N 条 DiagnosticObservation 持久化 |
| **错误模式** | 事务回滚: Observation 创建失败（字段映射错误）→ 整个 Report 创建回滚 / observation_code 未知 → 仍创建，设置 `observation_code: "UNKNOWN"` 标记人工审核 |
| **审计点** | `{action: "DIAGNOSTIC_REPORT_CREATED", report_id, observations_count, normal_count, abnormal_count}` |

#### Step 16: CRC Notifier 通知

| 项目 | 说明 |
|------|------|
| **触发者** | DiagnosticReport 创建成功 |
| **通知内容** | `{ "type": "OCR_REVIEW_REQUIRED", "report_id": "dr-xxx", "subject_id": "SUB-00123", "study_id": "STU-2026-00045", "document_type": "LAB_REPORT", "observations_total": 25, "abnormal_count": 3, "critical_count": 1, "confidence_avg": 0.91, "urgency": "HIGH" }` (urgency = HIGH 当且仅当存在 CRITICAL_HIGH/CRITICAL_LOW 异常) |
| **通知渠道** | WebSocket (实时) → CRC 前端顶部通知栏; 企业微信/钉钉 (异步) → CRC 人员 IM 通知; 邮件 (异步) → crc@hospital.com (仅 urgency=HIGH) |
| **审计点** | `{action: "CRC_NOTIFICATION_SENT", report_id, channels: ["websocket","wecom"]}` |

#### Step 17: Human Review（人工审核）

详见 Section 7。

#### Step 18: Confirmation（确认流程）

| 项目 | 说明 |
|------|------|
| **触发者** | CRC 人员在前端完成审核操作 |
| **操作类型** | (1) CONFIRM_ALL: 批量确认所有 Observation; (2) CONFIRM_SINGLE: 确认单个 Observation (修改后可确认); (3) REJECT: 整体拒绝报告（要求重新上传或手动录入） |
| **状态转换** | PENDING_REVIEW → IN_REVIEW → CONFIRMED / PARTIALLY_CONFIRMED / REJECTED |
| **确认后的数据流** | 已确认的 Observation 的 `final_value` / `final_unit` 写入，`is_confirmed: true`; 后续 CRC 可基于已确认数据创建 eCRF |
| **审计点（每条 Observation 确认）** | `{action: "OBSERVATION_CONFIRMED"/"OBSERVATION_REJECTED", observation_id, reviewed_by, reviewed_at, original_value, corrected_value (if any), correction_reason (if any)}` |

---

## Section 2: OCR Result Data Structure

### 2.1 ocr_job.result_jsonb 完整 Schema

```json
{
  "$schema": "https://pms.internal/schemas/ocr-result-v3.json",
  "schema_version": "3.0.0",
  "metadata": {
    "file_id": "f-7a3b2c1d-4e5f-6a7b-8c9d-0e1f2a3b4c5d",
    "task_id": "scan-5e6f7a8b-9c0d-1e2f-3a4b-5c6d7e8f9a0b",
    "document_type": "LAB_REPORT",
    "report_type_detail": "HEMATOLOGY",
    "template_id": "TPL-LAB-001",
    "template_name": "Standard Hematology Report",
    "template_match_confidence": 0.93,
    "model_version": "PP-OCRv4_20260401",
    "pipeline_version": "PaddleX_2.1.0_20260501",
    "prompt_version": "lab-report-v3",
    "processed_at": "2026-05-11T10:03:45Z",
    "processing_duration_ms": 45000
  },
  "document_info": {
    "pages_count": 2,
    "language": "zh-CN",
    "has_images": true,
    "has_tables": true,
    "has_handwriting": false
  },
  "layout_analysis": [
    {
      "page": 1,
      "blocks": [
        {
          "block_id": "L1",
          "label": "header",
          "bbox": [50, 20, 780, 80],
          "text": "XX医院检验报告单",
          "confidence": 0.99
        },
        {
          "block_id": "L2",
          "label": "paragraph",
          "bbox": [50, 100, 400, 200],
          "text": "患者信息区域",
          "confidence": 0.98
        },
        {
          "block_id": "L3",
          "label": "table",
          "bbox": [50, 220, 780, 600],
          "text": "检验结果表格",
          "confidence": 0.99
        },
        {
          "block_id": "L4",
          "label": "header_footer",
          "bbox": [50, 620, 780, 650],
          "text": "检验医师: 张三  审核日期: 2026-05-10",
          "confidence": 0.97
        }
      ]
    }
  ],
  "patient_info": {
    "name": {
      "field_name": "姓名",
      "field_type": "text",
      "extracted_value": "张三",
      "normalized_value": "张三",
      "confidence_score": 0.99,
      "reference_range": null,
      "abnormal_flag": null,
      "correction": null,
      "final_value": null
    },
    "gender": {
      "field_name": "性别",
      "field_type": "coded",
      "extracted_value": "男",
      "normalized_value": "MALE",
      "coding_system": "HL7_AdministrativeGender",
      "confidence_score": 0.99,
      "reference_range": null,
      "abnormal_flag": null,
      "correction": null,
      "final_value": null
    },
    "age": {
      "field_name": "年龄",
      "field_type": "numeric",
      "extracted_value": "45",
      "unit": "岁",
      "normalized_value": 45,
      "confidence_score": 0.99,
      "reference_range": null,
      "abnormal_flag": null,
      "correction": null,
      "final_value": null
    },
    "patient_id": {
      "field_name": "病历号",
      "field_type": "text",
      "extracted_value": "M20260500123",
      "normalized_value": "M20260500123",
      "confidence_score": 0.98,
      "reference_range": null,
      "abnormal_flag": null,
      "correction": null,
      "final_value": null
    },
    "collection_date": {
      "field_name": "采样日期",
      "field_type": "date",
      "extracted_value": "2026-05-10",
      "normalized_value": "2026-05-10",
      "confidence_score": 0.97,
      "reference_range": null,
      "abnormal_flag": null,
      "correction": null,
      "final_value": null
    }
  },
  "observations": [
    {
      "observation_id": "OBS-001",
      "field_name": "白细胞计数",
      "field_name_en": "White Blood Cell Count",
      "field_type": "numeric",
      "cdm_observation_code": "6690-2",
      "cdm_observation_system": "LOINC",
      "cdm_observation_name": "Leukocytes [#/volume] in Blood",
      
      "extracted_value": "11.5",
      "unit": "10^9/L",
      "normalized_value": 11.5,
      "normalized_unit": "10^9/L",
      "conversion_factor": 1.0,
      "unit_recognized": true,
      
      "reference_range": "3.5-9.5",
      "reference_range_parsed": {
        "type": "range",
        "lower": 3.5,
        "upper": 9.5,
        "inclusive_lower": true,
        "inclusive_upper": true
      },
      "abnormal_flag": "HIGH",
      "critical_threshold": {
        "critical_high": 30.0,
        "critical_low": 0.5
      },
      "breached_threshold": null,
      
      "confidence_score": 0.91,
      "confidence_breakdown": {
        "character_level": 0.98,
        "word_level": 0.95,
        "context_level": 0.88,
        "template_matching": 0.93
      },
      
      "correction": null,
      "final_value": null,
      "review_status": "PENDING_REVIEW",
      
      "source_location": {
        "page": 1,
        "row": 1,
        "column": 3,
        "table_block_id": "L3",
        "bbox": [400, 280, 550, 300]
      }
    },
    {
      "observation_id": "OBS-002",
      "field_name": "红细胞计数",
      "field_name_en": "Red Blood Cell Count",
      "field_type": "numeric",
      "cdm_observation_code": "789-8",
      "cdm_observation_system": "LOINC",
      "cdm_observation_name": "Erythrocytes [#/volume] in Blood",
      
      "extracted_value": "4.2",
      "unit": "10^12/L",
      "normalized_value": 4.2,
      "normalized_unit": "10^12/L",
      "conversion_factor": 1.0,
      "unit_recognized": true,
      
      "reference_range": "4.0-5.5(Female)",
      "reference_range_parsed": {
        "type": "range_gender_specific",
        "gender": "Female",
        "lower": 4.0,
        "upper": 5.5
      },
      "abnormal_flag": "NORMAL",
      "critical_threshold": null,
      "breached_threshold": null,
      
      "confidence_score": 0.95,
      "confidence_breakdown": {
        "character_level": 0.99,
        "word_level": 0.97,
        "context_level": 0.94,
        "template_matching": 0.93
      },
      
      "correction": null,
      "final_value": null,
      "review_status": "PENDING_REVIEW",
      
      "source_location": {
        "page": 1,
        "row": 2,
        "column": 3,
        "table_block_id": "L3",
        "bbox": [400, 310, 550, 330]
      }
    },
    {
      "observation_id": "OBS-003",
      "field_name": "血红蛋白",
      "field_name_en": "Hemoglobin",
      "field_type": "numeric",
      "cdm_observation_code": "718-7",
      "cdm_observation_system": "LOINC",
      "cdm_observation_name": "Hemoglobin [Mass/volume] in Blood",
      
      "extracted_value": "95",
      "unit": "g/L",
      "normalized_value": 95,
      "normalized_unit": "g/L",
      "conversion_factor": 1.0,
      "unit_recognized": true,
      
      "reference_range": "115-150",
      "reference_range_parsed": {
        "type": "range",
        "lower": 115,
        "upper": 150,
        "inclusive_lower": true,
        "inclusive_upper": true
      },
      "abnormal_flag": "LOW",
      "critical_threshold": {
        "critical_low": 60,
        "critical_high": 200
      },
      "breached_threshold": null,
      
      "confidence_score": 0.96,
      "confidence_breakdown": {
        "character_level": 0.99,
        "word_level": 0.98,
        "context_level": 0.96,
        "template_matching": 0.93
      },
      
      "correction": null,
      "final_value": null,
      "review_status": "PENDING_REVIEW",
      
      "source_location": {
        "page": 1,
        "row": 3,
        "column": 3,
        "table_block_id": "L3",
        "bbox": [400, 340, 550, 360]
      }
    }
  ],
  "table_extractions": [
    {
      "table_id": "TABLE-001",
      "layout_block_id": "L3",
      "page": 1,
      "headers": ["检验项目", "结果", "单位", "参考区间", "异常标识"],
      "header_normalized": ["test_item", "result", "unit", "reference_range", "abnormal_flag"],
      "rows": 15,
      "columns": 5,
      "data": [
        {
          "row": 1,
          "cells": [
            {"col": 1, "text": "白细胞计数", "is_header": false, "colspan": 1, "rowspan": 1},
            {"col": 2, "text": "11.5", "is_header": false, "colspan": 1, "rowspan": 1},
            {"col": 3, "text": "10^9/L", "is_header": false, "colspan": 1, "rowspan": 1},
            {"col": 4, "text": "3.5-9.5", "is_header": false, "colspan": 1, "rowspan": 1},
            {"col": 5, "text": "↑", "is_header": false, "colspan": 1, "rowspan": 1}
          ]
        }
      ],
      "table_confidence": 0.92,
      "structure_confidence": 0.94,
      "cell_confidence_avg": 0.96
    }
  ],
  "dicom_metadata": null,
  "warnings": [],
  "errors": [],
  "processing_log": {
    "step_8_download_duration_ms": 1200,
    "step_9_ocr_duration_ms": 15000,
    "step_10_paddlex_duration_ms": 18000,
    "step_11_unit_norm_duration_ms": 800,
    "step_12_abnormal_flag_duration_ms": 500,
    "step_13_confidence_duration_ms": 300
  }
}
```

### 2.2 Per-Field 结构定义

每个提取字段（无论是 patient_info 还是 observations 中的条目）均遵循以下统一结构：

| 字段名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| `field_name` | string | Y | 报告中的原始字段名（中文/英文），如"白细胞计数" |
| `field_name_en` | string | N | 字段英文名，从 CDM mapping 获取 |
| `field_type` | enum | Y | `numeric` / `text` / `coded` / `date` |
| `extracted_value` | string | Y | OCR/pipeline 原始提取值（字符串形式，含单位后缀等） |
| `unit` | string | N | 原始单位字符串（仅 field_type=numeric 时有效） |
| `normalized_value` | number/string | Y | 标准化后的值（numeric: float, text: string, coded: code, date: ISO 8601） |
| `normalized_unit` | string | N | 标准化后的单位（仅 field_type=numeric 时有效） |
| `conversion_factor` | float | N | 从原始单位到标准单位的换算因子 |
| `unit_recognized` | boolean | N | 单位是否在映射表中找到 |
| `reference_range` | string | N | 参考范围原始文本 |
| `reference_range_parsed` | object | N | 解析后的参考范围结构体 |
| `abnormal_flag` | enum | N | `NORMAL` / `LOW` / `HIGH` / `CRITICAL_LOW` / `CRITICAL_HIGH` / `ABNORMAL` / `UNCERTAIN` |
| `critical_threshold` | object | N | 危急值阈值 `{critical_high, critical_low}` |
| `breached_threshold` | string | N | 若触发危急值，记录 breached 的阈值类型 |
| `confidence_score` | float(0-1) | Y | 该字段的综合置信度 |
| `confidence_breakdown` | object | Y | 分项置信度（character/word/context/template） |
| `coding_system` | string | N | 编码系统（仅 field_type=coded 时有效），如 HL7_AdministrativeGender、SNOMED-CT |
| `cdm_observation_code` | string | N | CDM Observation Code (LOINC/SNOMED) |
| `cdm_observation_system` | string | N | 编码系统名称 |
| `correction` | string/number | N | 人工修正值（初始 null，审核后写入） |
| `final_value` | string/number | N | 最终确认值（确认后 = normalized_value 或 correction） |
| `review_status` | enum | Y | `PENDING_REVIEW` / `IN_REVIEW` / `CONFIRMED` / `REJECTED` |
| `source_location` | object | Y | 源文件中的位置信息 `{page, row, column, table_block_id, bbox}` |

### 2.3 Table Extraction 结构

```json
{
  "table_id": "TABLE-001",
  "layout_block_id": "L3",
  "page": 1,
  "bbox": [50, 220, 780, 600],
  "caption": "血常规检验结果",
  "headers": ["检验项目", "结果", "单位", "参考区间"],
  "header_normalized": ["test_item", "result", "unit", "reference_range"],
  "rows": 20,
  "columns": 4,
  "data": [
    {
      "row": 1,
      "is_header_row": false,
      "cells": [
        {
          "col": 1,
          "text": "白细胞计数",
          "is_header": false,
          "colspan": 1,
          "rowspan": 1,
          "bbox": [60, 280, 150, 300],
          "confidence": 0.99,
          "is_merged": false
        }
      ]
    }
  ],
  "table_confidence": 0.92,
  "structure_confidence": 0.94,
  "cell_confidence_avg": 0.96,
  "merge_cells": []
}
```

### 2.4 DICOM Metadata 提取字段

当 `document_type` = `DICOM` 时，`dicom_metadata` 字段非空：

```json
{
  "dicom_metadata": {
    "patient_module": {
      "patient_name": {"tag": "(0010,0010)", "value": "ANONYMOUS", "confidence": 0.99},
      "patient_id": {"tag": "(0010,0020)", "value": "SUB-00123", "confidence": 0.99},
      "patient_birth_date": {"tag": "(0010,0030)", "value": "19810101", "confidence": 0.99},
      "patient_sex": {"tag": "(0010,0040)", "value": "M", "confidence": 0.99}
    },
    "study_module": {
      "study_instance_uid": {"tag": "(0020,000D)", "value": "1.2.840.113619.2.55.3...", "confidence": 1.0},
      "study_date": {"tag": "(0008,0020)", "value": "20260510", "confidence": 0.99},
      "study_description": {"tag": "(0008,1030)", "value": "Chest CT", "confidence": 0.98},
      "modality": {"tag": "(0008,0060)", "value": "CT", "confidence": 0.99}
    },
    "series_module": {
      "series_instance_uid": {"tag": "(0020,000E)", "value": "1.2.840.113619.2.55.3...", "confidence": 1.0},
      "series_number": {"tag": "(0020,0011)", "value": "2", "confidence": 0.99},
      "series_description": {"tag": "(0008,103E)", "value": "Lung Window", "confidence": 0.98}
    },
    "equipment_module": {
      "manufacturer": {"tag": "(0008,0070)", "value": "SIEMENS", "confidence": 0.99},
      "manufacturer_model_name": {"tag": "(0008,1090)", "value": "SOMATOM Force", "confidence": 0.99}
    }
  }
}
```

---

## Section 3: Confidence Scoring 置信度评分体系

### 3.1 多级评分架构

```
┌─────────────────────────────────────────────────────────────┐
│                  Document-Level Confidence                    │
│                  (Weighted Avg of All Fields)                 │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌─────────────────┐  ┌──────────────┐  ┌────────────────┐  │
│  │  Per-Field       │  │  Table       │  │  Patient Info  │  │
│  │  Confidence      │  │  Confidence  │  │  Confidence    │  │
│  └────────┬────────┘  └──────┬───────┘  └───────┬────────┘  │
│           │                  │                    │           │
│           └──────────────────┼────────────────────┘           │
│                              │                                │
│         ┌────────────────────┼────────────────────┐           │
│         │                    │                    │           │
│         v                    v                    v           │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐    │
│  │ Character-Level│  │ Word-Level   │  │ Context-Level    │    │
│  │ Confidence     │  │ Confidence   │  │ Confidence       │    │
│  │ (PaddleOCR)    │  │ (NLP + Dict) │  │ (Cross-Field)    │    │
│  └──────────────┘  └──────────────┘  └──────────────────┘    │
│                                                               │
│         ┌────────────────────────────────────┐                │
│         │  Template-Matching Confidence       │                │
│         │  (Layout + Field Coverage Score)    │                │
│         └────────────────────────────────────┘                │
└─────────────────────────────────────────────────────────────┘
```

### 3.2 各级评分详解

#### Level 1: Character-Level Confidence（字符级置信度）

| 项目 | 说明 |
|------|------|
| **来源** | PaddleOCR 识别模型 (`PP-OCRv4_rec`) 输出的每个字符的 softmax 概率 |
| **计算** | `char_conf = sum(per_char_probs) / num_chars` |
| **典型值** | 打印体清晰文档: 0.95-0.99; 手写/模糊: 0.60-0.85; 低分辨率扫描: 0.50-0.70 |
| **特殊处理** | 中文字符: 选取 top-1 概率; 数字: 对易混淆字符 (0/O, 1/l/I, 5/S) 使用相邻字符上下文二次校验 |

```python
def character_level_confidence(ocr_result: OcrResult) -> float:
    """
    计算字符级平均置信度
    """
    if not ocr_result.char_probs:
        return 0.0
    total_prob = sum(ocr_result.char_probs)
    return total_prob / len(ocr_result.char_probs)
```

#### Level 2: Word-Level Confidence（词级置信度）

| 项目 | 说明 |
|------|------|
| **来源** | 基于医学词典/词频的 NLP 校验 |
| **计算** | `word_conf = 0.4 * char_avg_conf + 0.3 * dict_match_score + 0.3 * context_consistency_score` |
| **dict_match_score** | 在医学词汇表（ICD-10、LOINC、SNOMED-CT、中国药典术语集）中的匹配度: 精确匹配=1.0, 编辑距离≤2且最相似=0.8, 未匹配=0.3 |
| **context_consistency_score** | 相邻字段的一致性（如：性别与参考范围的性别一致性；检验项目与单位的合理配对） |

```python
def word_level_confidence(text: str, field_name: str, 
                          medical_dict: MedicalDictionary,
                          context: Dict[str, Any]) -> float:
    """
    计算词级置信度
    """
    # 1. 字符级平均置信度
    char_conf = character_level_confidence(ocr_result)
    
    # 2. 字典匹配分数
    dict_score = medical_dict.match_score(text, field_name)
    
    # 3. 上下文一致性分数
    context_score = compute_context_consistency(text, field_name, context)
    
    # 加权综合
    word_conf = 0.4 * char_conf + 0.3 * dict_score + 0.3 * context_score
    return min(word_conf, 1.0)
```

#### Level 3: Context-Level Confidence（上下文级置信度）

| 项目 | 说明 |
|------|------|
| **来源** | 跨字段交叉验证 |
| **校验规则** | (1) 数值范围合理性: 如"红细胞计数"不应 > 10^13/L; (2) 字段类型一致性: 年龄字段必须是数字; (3) 逻辑一致性: "性别=男"的报告不应有"妊娠"相关检验项; (4) 日期合理性: report_date ≥ collection_date; (5) 单位-数值配对合理性: "血糖 98 mmol/L" 不合理 (正常空腹 ~4-6 mmol/L) |

```python
def context_level_confidence(observation: Observation,
                              all_observations: List[Observation],
                              cross_validation_rules: List[CrossValidationRule]) -> float:
    """
    计算上下文级置信度
    返回: [0.0, 1.0] 其中 1.0 表示所有规则通过
    """
    applicable_rules = [r for r in cross_validation_rules 
                        if r.applies_to(observation)]
    if not applicable_rules:
        return 0.8  # 无适用规则时默认较高
    
    passed = 0
    for rule in applicable_rules:
        if rule.validate(observation, all_observations):
            passed += 1
    
    context_conf = passed / len(applicable_rules)
    return context_conf
```

#### Level 4: Template-Matching Confidence（模板匹配置信度）

| 项目 | 说明 |
|------|------|
| **来源** | 报告布局与已知模板的匹配程度 |
| **计算** | `template_conf = 0.5 * layout_similarity + 0.3 * field_coverage + 0.2 * positional_deviation` |
| **layout_similarity** | 基于版面分析结果的布局向量余弦相似度（block 类型、数量、相对位置） |
| **field_coverage** | 模板定义的预期字段中，实际提取到的比例: `found_fields / expected_fields` |
| **positional_deviation** | 提取字段的 bbox 位置与模板预期位置的像素偏差平均值倒数归一化 |

```python
def template_matching_confidence(detected_layout: LayoutResult,
                                  matched_template: Template,
                                  extracted_fields: List[Field]) -> float:
    """
    计算模板匹配置信度
    """
    # 1. 版面相似度（基于 block 类型分布和相对位置）
    layout_sim = cosine_similarity(
        detected_layout.to_feature_vector(),
        matched_template.layout_feature_vector
    )
    
    # 2. 字段覆盖率
    expected_fields = set(matched_template.expected_field_names)
    found_fields = set(f.field_name for f in extracted_fields if f.confidence_score > 0.5)
    coverage = len(found_fields & expected_fields) / max(len(expected_fields), 1)
    
    # 3. 位置偏差（平均归一化偏差）
    deviations = []
    for field in extracted_fields:
        expected_pos = matched_template.get_expected_position(field.field_name)
        if expected_pos and field.source_location:
            deviation = euclidean_distance(
                field.source_location.bbox_center,
                expected_pos.bbox_center
            )
            deviations.append(deviation)
    
    if deviations:
        avg_deviation = sum(deviations) / len(deviations)
        # 归一化：< 10px → 1.0, > 200px → 0.0
        positional_score = max(0.0, 1.0 - avg_deviation / 200.0)
    else:
        positional_score = 0.5
    
    template_conf = 0.5 * layout_sim + 0.3 * coverage + 0.2 * positional_score
    return min(template_conf, 1.0)
```

### 3.3 综合 Per-Field Confidence

```python
def per_field_confidence(ocr_char_conf: float,
                          word_conf: float,
                          context_conf: float,
                          template_conf: float) -> float:
    """
    计算单个字段的综合置信度
    
    权重分配依据:
    - 数字字段 (numeric): OCR 精度高，侧重 character-level
    - 文本字段 (text): 侧重 word-level (字典匹配)
    - 编码字段 (coded): 侧重 context-level (逻辑一致性)
    """
    # 动态权重（基于字段类型调整）
    # 默认权重
    W_CHAR = 0.25
    W_WORD = 0.25
    W_CONTEXT = 0.25
    W_TEMPLATE = 0.25
    
    field_conf = (
        W_CHAR * ocr_char_conf +
        W_WORD * word_conf +
        W_CONTEXT * context_conf +
        W_TEMPLATE * template_conf
    )
    return round(field_conf, 4)
```

### 3.4 置信度阈值

| 级别 | 范围 | 含义 | 处理策略 |
|------|------|------|----------|
| **HIGH** | >= 0.95 | 高置信度，OCR 结果极可能正确 | 可批量确认 (Bulk Confirm)，人工抽查 10% |
| **MEDIUM** | 0.80 - 0.94 | 中等置信度，可能存在个别字符错误 | 人工审核推荐逐条检查 |
| **LOW** | < 0.80 | 低置信度，OCR 结果不可直接使用 | 必须人工逐条审核，建议重新扫描或手动录入 |

### 3.5 历史准确率追踪（Per Template）

```json
{
  "template_accuracy_tracking": {
    "template_id": "TPL-LAB-001",
    "template_name": "Standard Hematology Report",
    "total_reports_processed": 1250,
    "accuracy_stats": {
      "overall_accuracy": 0.94,
      "field_level_accuracy": {
        "白细胞计数": {"total": 1250, "correct": 1200, "accuracy": 0.96},
        "红细胞计数": {"total": 1250, "correct": 1187, "accuracy": 0.95},
        "血红蛋白": {"total": 1250, "correct": 1212, "accuracy": 0.97}
      },
      "confidence_bucket_accuracy": {
        "HIGH": {"total": 900, "correct": 882, "accuracy": 0.98},
        "MEDIUM": {"total": 250, "correct": 200, "accuracy": 0.80},
        "LOW": {"total": 100, "correct": 42, "accuracy": 0.42}
      }
    },
    "last_updated": "2026-05-10T18:00:00Z",
    "drift_detected": false,
    "drift_detail": null
  }
}
```

**准确率追踪机制**:
1. CRC 人工确认/修正的结果记录到 `field_correction_log` 表
2. 每日定时任务 (CRON: `0 2 * * *`) 汇总统计 per-template / per-field 准确率
3. 若某模板 30 天内准确率下降 >5% → 触发 `TEMPLATE_DRIFT_ALERT`，通知 AI 团队重新评估模板

---

## Section 4: Unit Standardization 单位标准化

### 4.1 常用检验单位映射表（>20 例）

| # | 检验项目 (Observation) | 原始单位 | 标准单位 (SI) | 换算公式 | 换算因子 | LOINC Code |
|---|------------------------|----------|---------------|----------|----------|------------|
| 1 | 血糖 (Glucose) | mg/dL | mmol/L | `x / 18.018` | `0.0555` | 2345-7 |
| 2 | 血糖 (Glucose) | mmol/L | mmol/L | `x * 1` | `1.0` | 2345-7 |
| 3 | 肌酐 (Creatinine) | mg/dL | umol/L | `x * 88.42` | `88.42` | 2160-0 |
| 4 | 肌酐 (Creatinine) | umol/L | umol/L | `x * 1` | `1.0` | 2160-0 |
| 5 | 尿素氮 (BUN) | mg/dL | mmol/L | `x * 0.357` | `0.357` | 3094-0 |
| 6 | 尿素氮 (BUN) | mmol/L | mmol/L | `x * 1` | `1.0` | 3094-0 |
| 7 | 总胆红素 (Total Bilirubin) | mg/dL | umol/L | `x * 17.104` | `17.104` | 1975-2 |
| 8 | 总胆红素 (Total Bilirubin) | umol/L | umol/L | `x * 1` | `1.0` | 1975-2 |
| 9 | 总胆固醇 (Total Cholesterol) | mg/dL | mmol/L | `x / 38.67` | `0.02586` | 2093-3 |
| 10 | 总胆固醇 (Total Cholesterol) | mmol/L | mmol/L | `x * 1` | `1.0` | 2093-3 |
| 11 | 甘油三酯 (Triglycerides) | mg/dL | mmol/L | `x / 88.57` | `0.01129` | 2571-8 |
| 12 | 甘油三酯 (Triglycerides) | mmol/L | mmol/L | `x * 1` | `1.0` | 2571-8 |
| 13 | 尿酸 (Uric Acid) | mg/dL | umol/L | `x * 59.48` | `59.48` | 3084-1 |
| 14 | 尿酸 (Uric Acid) | umol/L | umol/L | `x * 1` | `1.0` | 3084-1 |
| 15 | 血钙 (Calcium) | mg/dL | mmol/L | `x / 4.008` | `0.2495` | 17861-6 |
| 16 | 血钙 (Calcium) | mmol/L | mmol/L | `x * 1` | `1.0` | 17861-6 |
| 17 | 血钠 (Sodium) | mEq/L | mmol/L | `x * 1` | `1.0` | 2951-2 |
| 18 | 血钾 (Potassium) | mEq/L | mmol/L | `x * 1` | `1.0` | 2823-3 |
| 19 | 血红蛋白 (Hemoglobin) | g/dL | g/L | `x * 10` | `10.0` | 718-7 |
| 20 | 血红蛋白 (Hemoglobin) | g/L | g/L | `x * 1` | `1.0` | 718-7 |
| 21 | 白蛋白 (Albumin) | g/dL | g/L | `x * 10` | `10.0` | 1751-7 |
| 22 | 白蛋白 (Albumin) | g/L | g/L | `x * 1` | `1.0` | 1751-7 |
| 23 | 总蛋白 (Total Protein) | g/dL | g/L | `x * 10` | `10.0` | 2885-2 |
| 24 | 铁蛋白 (Ferritin) | ng/mL | ug/L | `x * 1` | `1.0` | 2276-4 |
| 25 | 铁蛋白 (Ferritin) | ng/mL | pmol/L | `x * 2.247` | `2.247` | 2276-4 |
| 26 | TSH | mIU/L | mIU/L | `x * 1` | `1.0` | 3016-3 |
| 27 | TSH | uIU/mL | mIU/L | `x * 1` | `1.0` | 3016-3 |
| 28 | 维生素 D (25-OH) | ng/mL | nmol/L | `x * 2.496` | `2.496` | 1989-3 |
| 29 | 维生素 D (25-OH) | nmol/L | nmol/L | `x * 1` | `1.0` | 1989-3 |
| 30 | INR | - (无单位) | - (无单位) | `x * 1` | `1.0` | 34714-7 |

### 4.2 Unit Conversion 函数

```python
import re
from typing import Optional, Tuple, Dict
from dataclasses import dataclass
from decimal import Decimal, InvalidOperation


@dataclass
class UnitConversionRule:
    """单位换算规则"""
    observation_loinc: str
    from_unit: str
    to_unit: str          # 标准单位 (SI)
    conversion_factor: float
    conversion_formula: str  # "x * factor" | "x / divisor" | "x * 1"
    precision: int = 4       # 结果保留小数位


class UnitConverter:
    """单位标准化转换器"""
    
    def __init__(self, conversion_rules: Dict[str, Dict[str, UnitConversionRule]]):
        """
        Args:
            conversion_rules: {loinc_code: {from_unit_str: UnitConversionRule}}
        """
        self.rules = conversion_rules
        
        # 常见单位别名映射（同一单位的不同写法）
        self.unit_aliases = {
            "mg/dL": ["mg/dl", "mg/100ml", "mg/100mL", "mg%"],
            "g/dL": ["g/dl", "g/100ml", "g/100mL", "g%"],
            "mmol/L": ["mmol/l", "mM", "mmol·L-1"],
            "umol/L": ["umol/l", "μmol/L", "μmol/l", "uM", "umol·L-1"],
            "g/L": ["g/l", "g·L-1"],
            "mIU/L": ["mIU/l", "mIU/ml", "mIU/mL", "uIU/ml", "uIU/mL"],
            "ng/mL": ["ng/ml", "μg/L", "ug/L", "μg/l"],
            "pg/mL": ["pg/ml", "ng/L"],
            "mEq/L": ["meq/l", "meq/L", "mEq/l"],
            "10^9/L": ["x10^9/L", "×10⁹/L", "10⁹/L", "G/L", "G/l"],
            "10^12/L": ["x10^12/L", "×10¹²/L", "10¹²/L", "T/L", "T/l"],
            "percent": ["%", "pct", "PCT"],
        }
        
    def normalize_unit_string(self, raw_unit: str) -> Optional[str]:
        """
        将原始单位字符串标准化为已知单位名

        Examples:
            "mg/dl" -> "mg/dL"
            "μmol/L" -> "umol/L"
            "x10^9/L" -> "10^9/L"
        """
        raw = raw_unit.strip()
        
        # 直接匹配
        for canonical, aliases in self.unit_aliases.items():
            if raw == canonical:
                return canonical
            for alias in aliases:
                if raw.lower() == alias.lower():
                    return canonical
        
        # 模糊匹配（处理带空格情况，如 "mg / dL" -> "mg/dL"）
        cleaned = re.sub(r'\s+', '', raw)
        for canonical, aliases in self.unit_aliases.items():
            if cleaned == canonical:
                return canonical
            for alias in aliases:
                if cleaned.lower() == alias.lower().replace(' ', ''):
                    return canonical
        
        return None  # 未识别
    
    def convert(self, value_str: str, raw_unit: str,
                observation_loinc: str) -> Tuple[Optional[float], Optional[str], bool, Optional[str]]:
        """
        执行单位转换
        
        Args:
            value_str: OCR 提取的原始数值字符串，如 "98", "<1.0", ">200"
            raw_unit: OCR 提取的原始单位字符串，如 "mg/dL"
            observation_loinc: LOINC 编码
            
        Returns:
            (normalized_value, normalized_unit, unit_recognized, error_message)
            - normalized_value: 标准化后的数值 (float or None)
            - normalized_unit: 标准化后的单位 (str or None)
            - unit_recognized: 单位是否被成功识别
            - error_message: 错误描述 (成功时为 None)
        """
        # 1. 标准化单位字符串
        canonical_unit = self.normalize_unit_string(raw_unit)
        if canonical_unit is None:
            return None, raw_unit, False, f"UNKNOWN_UNIT: '{raw_unit}' 无法识别"
        
        # 2. 检查是否需要转换
        rules_for_obs = self.rules.get(observation_loinc, {})
        rule = rules_for_obs.get(canonical_unit)
        
        if rule is None:
            # 可能已经是标准单位
            # 检查是否可以找到任何规则确定标准单位
            std_unit = None
            for r in rules_for_obs.values():
                std_unit = r.to_unit
                break
            if std_unit and canonical_unit == std_unit:
                # 已经是标准单位, 无需转换
                pass
            elif std_unit:
                return None, canonical_unit, False, \
                    f"NO_CONVERSION_RULE: LOINC={observation_loinc}, from={canonical_unit}"
            # std_unit 为 None: 无此 LOINC 的任何规则, 保持原值
        
        # 3. 提取数值（处理 "<", ">", ">=", "<=" 前缀）
        comparator = ""
        numeric_part = value_str.strip()
        match = re.match(r'^([<>]=?)(.*)$', numeric_part)
        if match:
            comparator = match.group(1)
            numeric_part = match.group(2).strip()
        
        try:
            raw_value = float(numeric_part)
        except ValueError:
            return None, canonical_unit, True, f"INVALID_NUMBER: '{value_str}' 不是有效数字"
        
        # 4. 执行转换
        if rule:
            normalized = raw_value * rule.conversion_factor
            normalized = round(normalized, rule.precision)
            return normalized, rule.to_unit, True, None
        else:
            # 无转换规则，假设已经是标准单位
            return raw_value, canonical_unit, True, None
    
    def auto_detect_and_convert(self, value_str: str, raw_unit: str,
                                 observation_loinc: str) -> Dict[str, any]:
        """
        自动检测单位并转换，返回完整结果字典
        """
        result = {
            "raw_value": value_str,
            "raw_unit": raw_unit,
            "normalized_value": None,
            "normalized_unit": None,
            "conversion_factor": None,
            "unit_recognized": False,
            "error": None
        }
        
        normalized_val, normalized_unit, recognized, error = \
            self.convert(value_str, raw_unit, observation_loinc)
        
        if recognized and normalized_val is not None:
            # 计算实际使用的转换因子
            try:
                raw_numeric = float(re.sub(r'^[<>=]+', '', value_str.strip()))
                if raw_numeric != 0:
                    result["conversion_factor"] = round(normalized_val / raw_numeric, 6)
            except (ValueError, ZeroDivisionError):
                pass
        
        result["normalized_value"] = normalized_val
        result["normalized_unit"] = normalized_unit
        result["unit_recognized"] = recognized
        result["error"] = error
        
        return result
```

### 4.3 Unknown Unit 处理策略

| 场景 | 处理 | 后续动作 |
|------|------|----------|
| 单位字符串为空 | `unit_recognized: false`, `normalized_value = raw_value`, flag for review | CRC 人工确认时选择正确单位 |
| 单位字符串无法匹配任何别名 | `unit_recognized: false`, `normalized_value = raw_value`, `warning: "UNKNOWN_UNIT"` 加入 warnings 列表 | 通知 AI 团队添加新单位别名 |
| 有 LOINC 无换算规则 | `unit_recognized: false`, 假设为标准单位，记录 `NO_CONVERSION_RULE` warning | 通知配置管理员添加换算规则 |
| 数值无法解析为数字 | `normalized_value = null`, `error: "INVALID_NUMBER"` | CRC 人工录入正确数值 |
| 数值范围极不合理 (如血糖 9.9e99) | `abnormal_flag: UNCERTAIN`, 不阻塞流程 | CRC 人工判断是 OCR 错误还是真实异常 |

---

## Section 5: Abnormal Value Detection 异常值检测

### 5.1 Reference Range 参考范围解析

```python
import re
from typing import Optional, List, Dict, Union
from enum import Enum
from dataclasses import dataclass


class RangeType(Enum):
    SIMPLE_RANGE = "simple_range"           # 3.5-9.5
    LESS_THAN = "less_than"                  # <1.0
    GREATER_THAN = "greater_than"            # >100
    LESS_OR_EQUAL = "less_or_equal"          # <=5.0
    GREATER_OR_EQUAL = "greater_or_equal"    # >=200
    TEXTUAL = "textual"                      # "Negative", "阴性", "未见异常"
    GENDER_SPECIFIC = "gender_specific"      # "4.0-5.5 (F) / 4.2-5.8 (M)"
    AGE_SPECIFIC = "age_specific"            # "3.5-5.5 (<18y) / 3.9-5.8 (>=18y)"
    UNDEFINED = "undefined"                  # --/无


@dataclass
class ParsedRange:
    """解析后的参考范围"""
    range_type: RangeType
    raw_text: str
    lower: Optional[float] = None
    upper: Optional[float] = None
    inclusive_lower: bool = True
    inclusive_upper: bool = True
    textual_value: Optional[str] = None  # for TEXTUAL type
    gender: Optional[str] = None         # for GENDER_SPECIFIC type
    age_min: Optional[float] = None      # for AGE_SPECIFIC type
    age_max: Optional[float] = None      # for AGE_SPECIFIC type


class ReferenceRangeParser:
    """参考范围解析器"""
    
    # 范围正则模式
    PATTERNS = {
        RangeType.SIMPLE_RANGE: [
            # "3.5-9.5", "3.5~9.5", "3.5 - 9.5"
            re.compile(r'(?P<lower>[\d.]+)\s*[-~至到]\s*(?P<upper>[\d.]+)'),
        ],
        RangeType.LESS_THAN: [
            re.compile(r'<\s*(?P<upper>[\d.]+)'),
        ],
        RangeType.GREATER_THAN: [
            re.compile(r'>\s*(?P<lower>[\d.]+)'),
        ],
        RangeType.LESS_OR_EQUAL: [
            re.compile(r'≤\s*(?P<upper>[\d.]+)|<=\s*(?P<upper>[\d.]+)'),
        ],
        RangeType.GREATER_OR_EQUAL: [
            re.compile(r'≥\s*(?P<lower>[\d.]+)|>=\s*(?P<lower>[\d.]+)'),
        ],
    }
    
    # 文本型结果关键词映射
    TEXTUAL_ABNORMAL_KEYWORDS = [
        "阳性", "positive", "检出", "detected",
        "异常", "abnormal", "可见", "present",
        "+", "++", "+++"
    ]
    
    TEXTUAL_NORMAL_KEYWORDS = [
        "阴性", "negative", "正常", "normal",
        "未检出", "not detected", "未见", "absent",
        "-", "无"
    ]
    
    def parse(self, raw_range_text: str, 
              subject_gender: Optional[str] = None,
              subject_age: Optional[float] = None) -> ParsedRange:
        """
        解析参考范围文本
        
        Args:
            raw_range_text: OCR 提取的参考范围文本
            subject_gender: 受试者性别 ("MALE"/"FEMALE")
            subject_age: 受试者年龄 (years)
        
        Returns:
            ParsedRange 对象
        """
        text = raw_range_text.strip()
        
        if not text or text in ('-', '--', '---', '/', 'N/A', 'n/a'):
            return ParsedRange(range_type=RangeType.UNDEFINED, raw_text=text)
        
        # 尝试文本型
        if any(kw in text.lower() for kw in ['阴性', '阳性', 'negative', 'positive', 'normal', 'abnormal']):
            return ParsedRange(range_type=RangeType.TEXTUAL, raw_text=text, textual_value=text)
        
        # 尝试性别特异性范围 "4.0-5.5(F) / 4.2-5.8(M)" 或 "男：4.0-5.5 女：4.2-5.8"
        gender_match = self._parse_gender_specific(text, subject_gender)
        if gender_match:
            return gender_match
        
        # 尝试年龄特异性范围
        age_match = self._parse_age_specific(text, subject_age)
        if age_match:
            return age_match
        
        # 尝试数值范围
        for range_type, patterns in self.PATTERNS.items():
            for pattern in patterns:
                match = pattern.search(text)
                if match:
                    lower = float(match.group('lower')) if 'lower' in match.groupdict() else None
                    upper = float(match.group('upper')) if 'upper' in match.groupdict() else None
                    return ParsedRange(
                        range_type=range_type,
                        raw_text=text,
                        lower=lower,
                        upper=upper,
                        inclusive_lower=(range_type not in [RangeType.GREATER_THAN, RangeType.GREATER_OR_EQUAL]),
                        inclusive_upper=(range_type not in [RangeType.LESS_THAN, RangeType.LESS_OR_EQUAL])
                    )
        
        # 无法识别
        return ParsedRange(range_type=RangeType.UNDEFINED, raw_text=text)
    
    def _parse_gender_specific(self, text: str, 
                                subject_gender: Optional[str]) -> Optional[ParsedRange]:
        """解析性别特异性参考范围"""
        # Pattern: "4.0-5.5(F) / 4.2-5.8(M)"
        # 或者 "男：4.0-5.5，女：4.2-5.8"
        female_patterns = [
            r'(?:F|Female|女|女性)[:：]?\s*(?P<range>[\d.]+\s*[-~至]\s*[\d.]+)',
            r'(?P<range>[\d.]+\s*[-~至]\s*[\d.]+)\s*[(（]?\s*(?:F|Female|女|女性)\s*[)）]?'
        ]
        male_patterns = [
            r'(?:M|Male|男|男性)[:：]?\s*(?P<range>[\d.]+\s*[-~至]\s*[\d.]+)',
            r'(?P<range>[\d.]+\s*[-~至]\s*[\d.]+)\s*[(（]?\s*(?:M|Male|男|男性)\s*[)）]?'
        ]
        
        if subject_gender == "FEMALE":
            for pat in female_patterns:
                m = re.search(pat, text, re.IGNORECASE)
                if m:
                    range_text = m.group('range')
                    nums = re.findall(r'[\d.]+', range_text)
                    if len(nums) >= 2:
                        return ParsedRange(
                            range_type=RangeType.GENDER_SPECIFIC,
                            raw_text=text,
                            lower=float(nums[0]),
                            upper=float(nums[1]),
                            gender="FEMALE"
                        )
        elif subject_gender == "MALE":
            for pat in male_patterns:
                m = re.search(pat, text, re.IGNORECASE)
                if m:
                    range_text = m.group('range')
                    nums = re.findall(r'[\d.]+', range_text)
                    if len(nums) >= 2:
                        return ParsedRange(
                            range_type=RangeType.GENDER_SPECIFIC,
                            raw_text=text,
                            lower=float(nums[0]),
                            upper=float(nums[1]),
                            gender="MALE"
                        )
        
        return None
    
    def _parse_age_specific(self, text: str,
                             subject_age: Optional[float]) -> Optional[ParsedRange]:
        """解析年龄特异性参考范围"""
        # Pattern: "3.5-5.5(<18y) / 3.9-5.8(>=18y)"
        if subject_age is None:
            return None
        
        # 简化实现：根据年龄匹配适用的范围区间
        age_range_pattern = re.compile(
            r'(?P<range>[\d.]+\s*[-~至]\s*[\d.]+)\s*[(（]\s*(?:<|<=|< |≤|小于)\s*(?P<age>[\d.]+)\s*(?:y|岁|Y)'
        )
        # ... (实际实现会更复杂，此处简化)
        return None


class AbnormalFlagDetector:
    """异常标识检测器"""
    
    # 常见危急值阈值表
    CRITICAL_THRESHOLDS = {
        "2345-7": {    # Glucose
            "critical_low": 2.2,    # mmol/L
            "critical_high": 33.3,  # mmol/L
            "critical_low_text": "严重低血糖",
            "critical_high_text": "严重高血糖"
        },
        "2823-3": {    # Potassium
            "critical_low": 2.5,
            "critical_high": 6.5,
            "critical_low_text": "严重低钾血症",
            "critical_high_text": "严重高钾血症"
        },
        "2951-2": {    # Sodium
            "critical_low": 120,
            "critical_high": 160,
            "critical_low_text": "严重低钠血症",
            "critical_high_text": "严重高钠血症"
        },
        "718-7": {     # Hemoglobin
            "critical_low": 60,
            "critical_high": 200,
            "critical_low_text": "重度贫血",
            "critical_high_text": "严重血红蛋白增多"
        },
        "2160-0": {    # Creatinine
            "critical_high": 884,  # umol/L (>10 mg/dL)
            "critical_high_text": "严重肾功能损害"
        },
        "20570-8": {   # Platelet Count
            "critical_low": 20,    # x10^9/L
            "critical_high": 1000,
            "critical_low_text": "血小板严重减少（出血风险）",
            "critical_high_text": "血小板极度增多（血栓风险）"
        }
    }
    
    def detect(self, value: float, parsed_range: ParsedRange,
               observation_loinc: str,
               study_safety_ranges: Optional[Dict[str, Dict]] = None) -> Dict[str, any]:
        """
        检测异常值
        
        Args:
            value: normalized_value (标准化后的数值)
            parsed_range: 解析后的参考范围
            observation_loinc: LOINC 编码
            study_safety_ranges: 研究级安全范围 {loinc: {min, max, ...}}
        
        Returns:
            检测结果字典
        """
        result = {
            "abnormal_flag": "NORMAL",
            "critical_breached": False,
            "critical_detail": None,
            "safety_breached": False,
            "safety_detail": None
        }
        
        # 1. 与参考范围比较
        flag = self._compare_with_range(value, parsed_range)
        
        # 2. 与危急值阈值比较
        critical = self._check_critical_threshold(value, observation_loinc)
        if critical:
            flag = critical
            result["critical_breached"] = True
            result["critical_detail"] = critical
        
        # 3. 与研究级安全范围比较
        if study_safety_ranges and observation_loinc in study_safety_ranges:
            safety = self._check_safety_range(value, study_safety_ranges[observation_loinc])
            if safety:
                result["safety_breached"] = True
                result["safety_detail"] = safety
        
        result["abnormal_flag"] = flag
        return result
    
    def _compare_with_range(self, value: float, parsed_range: ParsedRange) -> str:
        """将数值与参考范围比较"""
        if parsed_range.range_type == RangeType.UNDEFINED:
            return "UNCERTAIN"
        
        if parsed_range.range_type == RangeType.TEXTUAL:
            return "NORMAL"  # 文本型暂不自动判定
        
        if parsed_range.lower is not None and parsed_range.upper is not None:
            # 双边范围
            if value < parsed_range.lower:
                return "LOW"
            elif value > parsed_range.upper:
                return "HIGH"
            else:
                return "NORMAL"
        elif parsed_range.upper is not None:
            # 小于某个值
            if value > parsed_range.upper:
                return "HIGH"
            else:
                return "NORMAL"
        elif parsed_range.lower is not None:
            # 大于某个值
            if value < parsed_range.lower:
                return "LOW"
            else:
                return "NORMAL"
        
        return "UNCERTAIN"
    
    def _check_critical_threshold(self, value: float, observation_loinc: str) -> Optional[str]:
        """检查危急值"""
        thresholds = self.CRITICAL_THRESHOLDS.get(observation_loinc)
        if not thresholds:
            return None
        
        critical_low = thresholds.get("critical_low")
        critical_high = thresholds.get("critical_high")
        
        if critical_low is not None and value <= critical_low:
            return "CRITICAL_LOW"
        if critical_high is not None and value >= critical_high:
            return "CRITICAL_HIGH"
        
        return None
    
    def _check_safety_range(self, value: float, safety_config: Dict) -> Optional[Dict]:
        """检查研究级安全范围"""
        min_val = safety_config.get("min")
        max_val = safety_config.get("max")
        
        breached = False
        detail = {}
        
        if min_val is not None and value < min_val:
            breached = True
            detail["type"] = "BELOW_SAFETY_MIN"
            detail["safety_min"] = min_val
            detail["actual"] = value
        
        if max_val is not None and value > max_val:
            breached = True
            detail["type"] = "ABOVE_SAFETY_MAX"
            detail["safety_max"] = max_val
            detail["actual"] = value
        
        if breached:
            detail["action"] = safety_config.get("action", "REVIEW_REQUIRED")
            detail["message"] = safety_config.get("message", "")
            return detail
        
        return None
```

### 5.2 Abnormal Flag 状态枚举与处理策略

| Flag | 含义 | CRC 通知 | 处理建议 |
|------|------|----------|----------|
| `NORMAL` | 在参考范围内 | 无特殊通知 | 可批量确认 |
| `LOW` | 低于参考范围 | WebSocket 通知 | CRC 人工确认 |
| `HIGH` | 高于参考范围 | WebSocket 通知 | CRC 人工确认 |
| `CRITICAL_LOW` | 低于危急值下限 | WebSocket + IM + 邮件 (urgent) | 立即人工审阅，通知 PI |
| `CRITICAL_HIGH` | 高于危急值上限 | WebSocket + IM + 邮件 (urgent) | 立即人工审阅，通知 PI |
| `ABNORMAL` | 异常（编码值） | WebSocket 通知 | CRC 人工确认 |
| `UNCERTAIN` | 无法确定 | WebSocket 通知 | 必须人工逐条审核 |

---

## Section 6: Document Types & PaddleX Pipeline

### 6.1 支持的文档类型

#### 6.1.1 Lab Reports (检验报告)

| 子类型 | 提取字段 | 输出格式 |
|--------|----------|----------|
| **Hematology (血常规)** | WBC, RBC, HGB, HCT, MCV, MCH, MCHC, PLT, NEUT#, NEUT%, LYMPH#, LYMPH%, MONO#, MONO%, EO#, EO%, BASO#, BASO% | 每个指标对应一条 CDM Observation |
| **Chemistry (生化)** | GLU, BUN, CRE, UA, ALT, AST, GGT, ALP, TBIL, DBIL, TP, ALB, TC, TG, HDL, LDL, CK, CK-MB, LDH, K, Na, Cl, Ca, P, Mg | 每个指标对应一条 CDM Observation |
| **Coagulation (凝血)** | PT, INR, APTT, TT, FIB, D-Dimer, FDP | 每个指标对应一条 CDM Observation |
| **Urinalysis (尿常规)** | pH, SG, PRO, GLU, KET, BIL, UBG, NIT, LEU, BLD | 每个指标对应一条 CDM Observation |
| **Microbiology (微生物)** | 标本类型, 培养结果, 菌株鉴定, 药敏结果 (抗生素, MIC, 敏感度 S/I/R) | 菌株 + 药敏表格 |

#### 6.1.2 Imaging Reports (影像学报告)

| 子类型 | 提取字段 | 输出格式 |
|--------|----------|----------|
| **CT** | 检查部位, 扫描方法, 影像所见 (文本), 影像诊断 (文本), 病灶描述, 测量数值 (大小, CT值), 结论 | 结构化文本 + 关键数值 Observation |
| **MRI** | 检查部位, 序列, 影像所见, 影像诊断, 病灶描述, 信号特征, 结论 | 结构化文本 + 关键数值 Observation |
| **X-Ray** | 检查部位, 投照位置, 影像所见, 影像诊断, 结论 | 结构化文本 |
| **Ultrasound (超声)** | 检查部位, 探头类型, 超声所见, 超声提示, 测量值 | 结构化文本 + 关键数值 Observation |
| **ECG (心电图)** | 心率, PR间期, QRS时限, QT/QTc, 心电轴, 结论 | 数值 Observation + 结论文本 |

#### 6.1.3 Pathology Reports (病理报告)

| 提取字段 | 输出格式 |
|----------|----------|
| 标本部位, 标本类型 (手术切除/活检/细胞学), 大体描述, 镜下描述, 病理诊断, ICD-O 编码, 分级 (G1-G4), 切缘状态, 淋巴结状态, 免疫组化结果 (抗体+结果+评分), 分子病理结果 | 结构化文本 + 免疫组化表格 + 编码 Observation |

#### 6.1.4 Genetic Reports (基因检测报告)

| 提取字段 | 输出格式 |
|----------|----------|
| 检测方法 (NGS/Sanger/PCR), 基因名称 (HGNC Symbol), 变异描述 (HGVS), 染色体位置, 变异类型 (SNV/Indel/CNV/Fusion), 致病性分类 (Pathogenic/Likely Pathogenic/VUS/Likely Benign/Benign), ACMG 评分, 测序深度, 变异频率 (VAF), 药物关联 | 每条变异对应一条 Observation |

#### 6.1.5 Medical Certificates / Discharge Summaries (医疗文书)

| 文档类型 | 提取字段 | 输出格式 |
|----------|----------|----------|
| **出院小结** | 入院日期, 出院日期, 入院诊断, 出院诊断, 主诉, 现病史, 既往史, 住院经过, 出院医嘱, 随访建议 | 结构化文本 |
| **诊断证明** | 诊断名称, ICD-10 编码, 医师签名, 签发日期 | 诊断 Observation |
| **知情同意书** | 文件类型, 签署日期, 受试者签名状态 | 元数据 + 签名状态 |

#### 6.1.6 Prescriptions (处方)

| 提取字段 | 输出格式 |
|----------|----------|
| 药品名称 (通用名+商品名), 规格, 剂量, 频次, 给药途径, 起始日期, 结束日期, 处方医师 | 每条药品对应一条 Observation |

### 6.2 PaddleX Pipeline 详细配置

#### 6.2.1 Pipeline 架构

```
┌──────────────────────────────────────────────────────────────┐
│                     PaddleX Pipeline                          │
│                                                               │
│  Input: PDF/Image File                                        │
│    │                                                          │
│    v                                                          │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │ 1. Document Preprocessing                                │ │
│  │    - PDF → Image (pdf2image, DPI=300)                    │ │
│  │    - Image denoise / deskew / contrast enhancement        │ │
│  │    - Page orientation correction (0°/90°/180°/270°)      │ │
│  └───────────────────────┬─────────────────────────────────┘ │
│                          │                                    │
│                          v                                    │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │ 2. Layout Analysis (版面分析)                             │ │
│  │    - Model: PP-DocLayout                                 │ │
│  │    - Output: Block regions with labels                   │ │
│  └───────────────────────┬─────────────────────────────────┘ │
│                          │                                    │
│          ┌───────────────┼───────────────┐                    │
│          │               │               │                    │
│          v               v               v                    │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐          │
│  │ 3a. Text OCR │ │ 3b. Table    │ │ 3c. Image    │          │
│  │  PP-OCRv4    │ │  SLANet      │ │  Figure      │          │
│  │  Recognition │ │  Structure   │ │  Extraction  │          │
│  │              │ │  Recognition │ │  (DICOM)     │          │
│  └──────┬───────┘ └──────┬───────┘ └──────┬───────┘          │
│         │                │                │                   │
│         v                v                v                   │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │ 4. Structured Extraction                                 │ │
│  │    - KV Extraction (Key-Value Pair)                      │ │
│  │    - Table → Cell mapping to CDM                         │ │
│  │    - Named Entity Recognition (Medical NER)              │ │
│  └───────────────────────┬─────────────────────────────────┘ │
│                          │                                    │
│                          v                                    │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │ 5. Post-Processing                                       │ │
│  │    - Unit normalization                                  │ │
│  │    - Abnormal flag detection                             │ │
│  │    - Confidence scoring                                  │ │
│  │    - Field mapping to CDM Observation                    │ │
│  └───────────────────────┬─────────────────────────────────┘ │
│                          │                                    │
│                          v                                    │
│  Output: Structured JSONB (Section 2 Schema)                  │
└──────────────────────────────────────────────────────────────┘
```

#### 6.2.2 各 Pipeline 组件配置

**Document Preprocessing (预处理)**

```yaml
preprocessing:
  pdf_to_image:
    dpi: 300
    fmt: "png"
    grayscale: false
    thread_count: 4
  
  image_enhancement:
    enabled: true
    denoise: true          # 去噪
    deskew: true           # 纠偏 (Hough Transform)
    contrast_clahe: true   # CLAHE 自适应直方图均衡
    contrast_clip_limit: 2.0
    binarization: false    # 二值化（默认关闭，保留灰度信息）
    threshold_method: "otsu"  # OTSU / adaptive
  
  orientation_correction:
    enabled: true
    model: "PP-OCRv4_cls"
    supported_angles: [0, 90, 180, 270]
```

**Layout Analysis (版面分析)**

```yaml
layout_analysis:
  model: "PP-DocLayout"
  model_path: "models/PP-DocLayout_v1_infer"
  
  labels:
    - header           # 页眉
    - footer           # 页脚
    - title            # 标题
    - text             # 正文段落
    - table            # 表格
    - figure           # 图片
    - list             # 列表
    - reference        # 参考文献
    - abstract         # 摘要
  
  reading_order:
    method: "xy_cut"   # XY-Cut 算法确定阅读顺序
  
  batch_size: 1
  threshold: 0.5       # 检测置信度阈值
```

**Table Structure Recognition (表格结构识别)**

```yaml
table_recognition:
  model: "SLANet"
  model_path: "models/SLANet_v2_infer"
  
  structure:
    detect_header: true         # 检测表头
    detect_merged_cells: true   # 检测合并单元格
    max_rows: 500
    max_cols: 50
  
  cell_extraction:
    pad: 2                      # cell 内边距裁剪 (pixels)
    use_ocr_confidence: true    # 结合 OCR 置信度
    
  output:
    include_html: false         # 是否输出 HTML table
    include_latex: false        # 是否输出 LaTeX table
```

#### 6.2.3 Template-Based Extraction (基于模板的提取)

**Template 定义结构**

```json
{
  "template_id": "TPL-LAB-001",
  "template_name": "模板_XX医院_血常规_v1",
  "document_type": "LAB_REPORT",
  "sub_type": "HEMATOLOGY",
  "version": "1.3.0",
  "status": "ACTIVE",
  "created_at": "2026-01-15T08:00:00Z",
  "updated_at": "2026-04-01T10:00:00Z",
  "layout_signature": {
    "feature_vector": [0.12, 0.87, 0.33, ...],
    "block_distribution": {
      "header": 1,
      "text": 2,
      "table": 1,
      "footer": 1
    },
    "relative_positions": {
      "title_y": 0.05,
      "patient_info_y": 0.12,
      "table_y": 0.25,
      "footer_y": 0.92
    }
  },
  "expected_fields": [
    {
      "field_name": "姓名",
      "section": "patient_info",
      "cdm_observation_code": null,
      "field_type": "text",
      "expected_position": {"x_ratio": 0.15, "y_ratio": 0.12, "width_ratio": 0.2, "height_ratio": 0.02},
      "key_words": ["姓名", "患者姓名", "Name"],
      "value_pattern": null,
      "required": true
    }
  ],
  "observation_fields": [
    {
      "field_name": "白细胞计数",
      "field_name_en": "White Blood Cell Count",
      "cdm_observation_code": "6690-2",
      "field_type": "numeric",
      "table_column_index": 2,
      "key_words": ["白细胞计数", "WBC", "白细胞", "White Blood Cell"],
      "unit_aliases": ["10^9/L", "x10^9/L", "G/L", "10⁹/L"],
      "unit_standard": "10^9/L",
      "reference_range_column": 4,
      "required": true,
      "default_reference_range": {"male": [3.5, 9.5], "female": [3.5, 9.5]}
    }
  ],
  "key_value_zones": [
    {
      "zone_id": "patient_info_zone",
      "bbox_ratio": [0.05, 0.10, 0.45, 0.22],
      "extraction_method": "spatial",
      "keys": ["姓名", "性别", "年龄", "病历号", "采样日期", "送检科室", "临床诊断"]
    }
  ],
  "ignore_regions": [
    {
      "bbox_ratio": [0.05, 0.05, 0.95, 0.08],
      "reason": "医院 banner/logo 区域"
    }
  ]
}
```

#### 6.2.4 Template Learning & Registration Process

```
┌─────────────────────────────────────────────────────────────┐
│                  Template Learning Workflow                  │
│                                                              │
│  Step A: New Report Type Detected                            │
│    - Template matching confidence < 0.6 for all templates     │
│    - AI 自动标记 "UNKNOWN_TEMPLATE"                          │
│    - 通知 Template Admin                                     │
│                                                              │
│  Step B: Manual Template Creation                            │
│    - Template Admin 在 "Template Studio" UI 中:              │
│      1. 上传 3-5 份同类报告样本                              │
│      2. 框选关键区域 (patient_info_zone, table_zone)         │
│      3. 标注字段名和 LOINC code                              │
│      4. 配置参考范围列、单位列                                │
│      5. 设置 Ignore Regions                                  │
│      6. 保存 Template Draft (status=DRAFT)                   │
│                                                              │
│  Step C: Validation & Testing                                │
│    - 使用 10+ 份历史报告验证模板准确率                        │
│    - 准确率 >= 95% → 可发布 (ACTIVE)                         │
│    - 准确率 80-94% → 需优化 (DRAFT)                          │
│    - 准确率 < 80% → 重新设计                                 │
│                                                              │
│  Step D: Template Activation                                 │
│    - 状态: DRAFT → ACTIVE                                     │
│    - 版本号递增: 0.1.0 → 1.0.0                               │
│    - 旧版本保留 (INACTIVE)，用于历史数据回溯                  │
│    - 启动每日准确率追踪                                       │
│                                                              │
│  Step E: Template Drift Detection                            │
│    - 每日定时任务计算模板 30 天滑动准确率                      │
│    - 准确率下降 >5% → DRIFT_ALERT                            │
│    - Admin 评估后决定: 更新模板 / 替换模板 / 停用模板         │
└─────────────────────────────────────────────────────────────┘
```

---

## Section 7: Human Review UI & Workflow 人工审核

### 7.1 Review UI 规范

#### 7.1.1 整体布局

```
┌─────────────────────────────────────────────────────────────────────────┐
│  [Dashboard] > [Study STU-2026-00045] > Report Review: lab_report.pdf     │
│                                                                          │
│  ┌─────────────────────────────┐  ┌──────────────────────────────────┐  │
│  │  Original Document           │  │  Extracted Fields                │  │
│  │  (PDF Viewer / Image Viewer) │  │                                   │  │
│  │                              │  │  ┌ Patient Info ──────────────┐  │  │
│  │  ┌────────────────────────┐  │  │  │ 姓名: 张三        🟢 0.99  │  │  │
│  │  │                        │  │  │  │ 性别: 男          🟢 0.99  │  │  │
│  │  │    XX医院检验报告单      │  │  │  │ 年龄: 45岁        🟢 0.99  │  │  │
│  │  │                         │  │  │  │ 病历号: M2026...  🟢 0.98  │  │  │
│  │  │  姓名: 张三   性别: 男   │  │  │  │ 采样日期: 05-10  🟢 0.97  │  │  │
│  │  │  年龄: 45     病历号:...│  │  │  └────────────────────────────┘  │  │
│  │  │                        │  │  │                                   │  │
│  │  │  ┌──────────────────┐  │  │  │  ┌ Observations ───────────────┐  │  │
│  │  │  │ 检验项目  │ 结果  │  │  │  │  │ 白细胞计数  11.5 10^9/L  │  │  │
│  │  │  ├──────────────────┤  │  │  │  │ Ref: 3.5-9.5  🔴 HIGH  0.91│  │  │
│  │  │  │ 白细胞   │ 11.5  │  │  │  │  ├────────────────────────────┤  │  │
│  │  │  │ 红细胞   │  4.2  │  │  │  │  │ 红细胞计数   4.2 10^12/L  │  │  │
│  │  │  │ 血红蛋白 │ 95 ↓  │  │  │  │  │ Ref: 4.0-5.5  🟡 LOW   0.95│  │  │
│  │  │  │ ...      │ ...   │  │  │  │  ├────────────────────────────┤  │  │
│  │  │  └──────────────────┘  │  │  │  │ 血红蛋白    95   g/L       │  │  │
│  │  │                        │  │  │  │ Ref: 115-150 🔴 LOW   0.96│  │  │
│  │  └────────────────────────┘  │  │  │  ...                        │  │  │
│  │                              │  │  └────────────────────────────┘  │  │
│  │  <Prev Page>  Page 1/2  <Next>│  │                                   │  │
│  │                              │  │  [Confirm All] [Reject Report]     │  │
│  └─────────────────────────────┘  └──────────────────────────────────┘  │
│                                                                          │
│  Review Actions: [Last Saved: 10:05]  [Submit Review]                    │
└─────────────────────────────────────────────────────────────────────────┘
```

#### 7.1.2 交互细节规范

| 功能 | UI 交互 | 说明 |
|------|---------|------|
| **原文-字段联动高亮** | 点击提取字段 → 原文视图中对应位置 bbox 高亮（黄色框+半透明黄色底） | 基于 `source_location.bbox` 在 PDF viewer 中定位 |
| **置信度颜色编码** | 绿 (>=0.95) / 黄 (0.80-0.94) / 红 (<0.80) | 字段卡片左侧 border + 圆点指示器 |
| **异常标识** | 正常: 无额外标记 / LOW: 蓝色向下箭头 / HIGH: 红色向上箭头 / CRITICAL: 红色闪烁+报警图标 | 配合 Tooltip 显示参考范围 |
| **行内编辑** | 双击字段值 → 变为可编辑 input; 下拉选择 (coded 字段); 日期选择器 (date 字段) | 自动进入 IN_REVIEW 状态 |
| **Correction 日志** | 编辑字段后, 字段卡片下方显示 "原始值: 11.5 → 修正值: 12.0" | 自动创建 CorrectionLog 记录 |
| **批量确认** | 顶部 [Confirm All] 按钮: 确认所有未确认 Observation; 二次确认弹窗: "确认所有 N 条观察结果？异常值将一并确认。" | 确认后所有 Observation 状态变更 |
| **单条确认** | 每行右侧 checkbox + 行尾 [Confirm] 按钮 | 确认单条后 immediate audit log |
| **拒绝报告** | 右上角 [Reject] 按钮: 弹窗选择拒绝原因（下拉+文本）, Reasons: OCR_QUALITY_POOR, WRONG_DOCUMENT_TYPE, IMAGE_UNREADABLE, PATIENT_INFO_MISMATCH, OTHER | 拒绝后 FileObject.review_status=REJECTED |
| **键盘快捷键** | Tab: 切换到下一条 Observation; Enter: 确认当前字段; Ctrl+Z: 撤销上一次修改; Ctrl+S: 保存审核进度; Shift+Tab: 回到上一条 | 提高审核效率 |
| **分页/滚动同步** | 左侧 PDF viewer 滚动时, 右侧表格滚动到对应区域的字段; 反之亦然 | 基于 page 和 bbox 位置 |
| **进度指示** | 顶部进度条: "已审核: 15/25 (60%)  |  确认: 12  |  修正: 3  |  待定: 10" | 实时更新 |

#### 7.1.3 特殊场景 UI

**场景 1: Table 提取不完整**
- 表格中某些 cell 为空 → cell 显示灰色 "空" 占位符, 标记为未提取
- 鼠标悬停显示: "OCR未识别到该单元格内容，请手动填写"

**场景 2: 多页报告**
- 左侧 PDF viewer 支持翻页
- 右侧字段列表页签分组: "Page 1", "Page 2", ...
- 或全部展示, 每个字段标注页号

**场景 3: DICOM 影像报告**
- 左侧显示: DICOM Viewer 缩略图 + DICOM Tags 面板
- 右侧提取字段
- 支持窗宽窗位调节（不影响审核流程）

### 7.2 Review Workflow 状态机

```
                        ┌──────────────┐
                        │ PENDING_REVIEW│  (OCR 完成，CRC 未开始审核)
                        └──────┬───────┘
                               │
                   CRC opens Review UI
                               │
                               v
                        ┌──────────────┐
                        │  IN_REVIEW   │  (CRC 正在审核中)
                        └──┬───┬───┬───┘
                           │   │   │
              ┌────────────┼───┘   └────────────┐
              │            │                    │
              v            v                    v
     ┌────────────┐ ┌──────────────┐  ┌──────────────┐
     │ CONFIRMED  │ │PARTIALLY_    │  │  REJECTED    │
     │            │ │CONFIRMED     │  │              │
     │ (全部Observation│(部分确认+部分│  │ (整体拒绝)    │
     │  已确认)   │ │ 拒绝/待定)   │  │              │
     └─────┬─────┘ └──────┬───────┘  └──────┬───────┘
           │              │                  │
           │              │   (Rejected →     │
           │              │    Re-upload or   │
           │              │    Manual Entry)  │
           │              │                  │
           v              v                  v
    ┌──────────────┐ ┌──────────────┐ ┌───────────────┐
    │ Data Available│ │ Data Partially│ │ Need Re-upload│
    │ for eCRF     │ │ Available    │ │ / Manual Entry│
    └──────────────┘ └──────────────┘ └───────────────┘
```

### 7.3 状态转换审计

每条状态转换必须记录到 `review_audit_log` 表：

```json
{
  "audit_log_id": "audit-001",
  "timestamp": "2026-05-11T14:30:00Z",
  "report_id": "dr-xxx",
  "observation_id": "OBS-001",  // null if report-level change
  "action": "STATUS_TRANSITION",
  "from_status": "PENDING_REVIEW",
  "to_status": "IN_REVIEW",
  "actor": {
    "user_id": "crc-wang",
    "user_name": "王芳",
    "role": "CRC"
  },
  "correction": null,
  "comment": "开始审核",
  "ip_address": "10.1.1.100",
  "user_agent": "Mozilla/5.0 ...",
  "session_id": "sess-abc123"
}
```

---

## Section 8: AI Safety Boundaries 安全边界

### 8.1 DO and DON'T

| # | 规则 | 类型 | 说明 |
|---|------|------|------|
| 1 | AI Service **DO** process OCR recognition and structure extraction | DO | AI Service 核心职责：OCR 识别 + PaddleX 结构化提取 |
| 2 | AI Service **DO** return results via HTTP callback | DO | 不通过消息队列返回结果，通过 callback URL 回传 |
| 3 | AI Service **DO** record model_version, prompt_version, pipeline_version in every result | DO | 每次输出必须包含完整的模型/提示词/管道版本信息 |
| 4 | AI Service **DO** compute and attach confidence_score per field | DO | 每个字段必须有独立的置信度评分 |
| 5 | AI Service **DO** report errors with structured error codes and messages | DO | 错误必须结构化，包含 error_code, message, affected_fields |
| 6 | AI Service **DO** implement graceful degradation on low confidence | DO | 低置信度不阻塞流程，标记后由人工处理 |
| 7 | AI Service **DO NOT** access the main database (MySQL/PostgreSQL) directly | DON'T | 绝对禁止：AI 不可直接连接业务数据库 |
| 8 | AI Service **DO NOT** access MinIO buckets other than `pms-uploads` | DON'T | 绝对禁止：AI 只读 pms-uploads bucket |
| 9 | AI Service **DO NOT** modify patient data, study status, or any business state | DON'T | 绝对禁止：AI 不可修改任何业务状态 |
| 10 | AI Service **DO NOT** make clinical decisions or diagnoses | DON'T | 绝对禁止：AI 只做数据提取，不做临床决策 |
| 11 | AI Service **DO NOT** auto-confirm any OCR result | DON'T | 绝对禁止：所有 AI 结果必须经人工审核 |
| 12 | AI Service **DO NOT** store or cache patient data permanently | DON'T | 临时文件处理完即删除；不可落盘持久化 PII/PHI |
| 13 | AI Service **DO NOT** send patient data to external services/APIs | DON'T | 绝对禁止：数据不可流出 AI Service |
| 14 | AI Service **DO NOT** share model weights or training data externally | DON'T | 模型和数据均在内部网络中 |
| 15 | AI Service **DO NOT** fail silently — always report errors via callback | DON'T | 所有异常必须通过 callback 或死信队列报告 |
| 16 | Human Reviewer **MUST** confirm or correct all LOW confidence fields | MUST | 低置信度字段必须人工审核 |
| 17 | Human Reviewer **MUST** review all CRITICAL_HIGH/CRITICAL_LOW flags within 30 minutes | MUST | 危急值结果必须在 30 分钟内审阅 |
| 18 | System **MUST** log all AI outputs and human confirmations/rejections | MUST | 所有 AI 输出和人工操作必须审计 |
| 19 | System **MUST** verify JWT callback_token before accepting AI results | MUST | 回调请求必须签名校验 |
| 20 | System **MUST** perform idempotency check on duplicate OCR callbacks | MUST | 重复回调不创建重复 OCRJob |

### 8.2 安全边界架构图

```
┌─────────────────────────────────────────────────────────────────┐
│                        SECURITY BOUNDARY                         │
│                                                                  │
│  ┌──────────────────────┐          ┌───────────────────────────┐ │
│  │   Trusted Zone        │          │   AI Service Zone         │ │
│  │   (Java Backend)      │          │   (Python FastAPI)        │ │
│  │                       │          │                           │ │
│  │  ┌───────────────┐    │  HTTP    │  ┌──────────────────┐    │ │
│  │  │ Main Database  │    │ Callback │  │ PaddleOCR Engine │    │ │
│  │  │ (MySQL/PG)     │◄───┼──────────┼──│ PaddleX Pipeline │    │ │
│  │  └───────────────┘    │  (JWT)   │  └──────────────────┘    │ │
│  │                       │          │                           │ │
│  │  ┌───────────────┐    │          │  ┌──────────────────┐    │ │
│  │  │ Audit Log      │◄───┼──────────┼──│ /tmp/ 临时文件    │    │ │
│  │  └───────────────┘    │          │  │ (即用即删)        │    │ │
│  │                       │          │  └──────────────────┘    │ │
│  │  ┌───────────────┐    │          │                           │ │
│  │  │ Business State │    │          │  ┌──────────────────┐    │ │
│  │  │ (JPA Entities) │    │          │  │ DLQ / Outbox     │    │ │
│  │  └───────────────┘    │          │  │ (本地兜底)        │    │ │
│  │                       │          │  └──────────────────┘    │ │
│  └───────────────────────┘          └───────────────────────────┘ │
│           │                                    │                   │
│           │                                    │                   │
│           │         ┌──────────────────┐       │                   │
│           └─────────┤   RabbitMQ       ├───────┘                   │
│                     │   (OCR Queue)     │                           │
│                     │   (DLQ)           │                           │
│                     └──────────────────┘                           │
│                                                                    │
│                     ┌──────────────────┐                           │
│                     │   MinIO           │                           │
│                     │   pms-uploads     │◄──── AI Read Only        │
│                     │   (Documents)     │                           │
│                     └──────────────────┘                           │
└─────────────────────────────────────────────────────────────────┘
```

### 8.3 Network & Access Control

| 层面 | 配置 | 说明 |
|------|------|------|
| **Network** | AI Service 部署在独立 VPC/子网 (`ai-subnet`) | 与 Java Backend (`app-subnet`) 网络隔离 |
| **Firewall** | AI Service egress: 仅允许 RabbitMQ(5672), MinIO(9000), Java Backend Callback(443) | 白名单出站规则 |
| **Firewall** | AI Service ingress: 仅允许来自 Load Balancer(443) 的健康检查 | 白名单入站规则 |
| **MinIO Policy** | AI Service 使用只读 IAM Policy: `{"Action": ["s3:GetObject"], "Resource": ["arn:aws:s3:::pms-uploads/*"]}` | 只读，仅限 pms-uploads bucket |
| **RabbitMQ** | AI Service 使用受限 vhost (`/ai`), 仅 `ocr.*` queues 的 read + `basic_ack` 权限 | 不能 publish 到其他 exchange |
| **Secrets** | `MINIO_ACCESS_KEY`, `MINIO_SECRET_KEY`, `CALLBACK_TOKEN_SECRET` 通过 Vault/K8s Secret 注入 | 不硬编码，不落盘 |
| **mTLS** | AI Service ↔ Java Backend 之间使用 mTLS | 双向证书认证 |

### 8.4 Data Lifecycle

```
1. 文件上传          → MinIO pms-uploads (持久化, 加密 at rest)
2. 队列消息           → RabbitMQ (持久化, 1h TTL)
3. AI 下载到 /tmp      → 临时文件 (处理完立即删除, finally 块保证)
4. AI 内存处理         → Python 变量 (进程结束自动释放)
5. AI Callback 回传   → HTTPS + JWT (传输中加密 in transit)
6. Java 存储结果      → Main Database + Audit Log (持久化, 加密 at rest)
7. AI 确认后 ACK      → RabbitMQ 消息删除
8. 人工审核后         → 最终确认数据写入 Main Database
```

**AI 侧数据保留**: 0 分钟（不持久化任何患者数据）
**AI 日志**: 仅保留 `task_id`, `file_id`, `duration_ms`, `error_code` 等元数据（不含 OCR 文本/PII），保留 30 天后自动清理

---

## 附录 A: 关键术语对照表

| 中文 | English | 说明 |
|------|---------|------|
| 预签名 URL | Presigned URL | MinIO/S3 的临时上传授权链接 |
| 死信队列 | Dead Letter Queue (DLQ) | 无法处理的消息的终点队列 |
| 危急值 | Critical Value / Panic Value | 表明患者可能处于生命危险状态的检验结果 |
| 临床数据管理 | Clinical Data Management (CDM) | 临床试验数据的采集和管理标准 |
| 临床研究协调员 | Clinical Research Coordinator (CRC) | 负责审核和管理临床数据的专业人员 |
| 版面分析 | Document Layout Analysis | 识别文档中不同内容区域（标题、段落、表格等） |
| 键值对提取 | Key-Value Pair Extraction | 从文档中自动识别和提取 "标签-值" 对 |
| 表格结构识别 | Table Structure Recognition | 识别表格的行列结构和单元格归属 |
| 命名实体识别 | Named Entity Recognition (NER) | 识别文本中的特定实体（人名、日期、医学名词等） |
| 结构化提取 | Structured Extraction | 将非结构化/半结构化文档转为结构化数据 |
| 电子病例报告表 | Electronic Case Report Form (eCRF) | 临床试验的电子化数据采集表单 |
| 观察性健康数据科学和信息学 | Observational Health Data Sciences and Informatics (OHDSI) | 通用数据模型 (CDM) 标准 |
| 受保护健康信息 | Protected Health Information (PHI) | 受法律保护的个人健康信息 |
| 个人可识别信息 | Personally Identifiable Information (PII) | 可识别到个人的信息 |
| IAM | Identity and Access Management | 身份与访问管理 |
| mTLS | Mutual Transport Layer Security | 双向 TLS 认证 |

---

## 附录 B: 技术版本信息

| 组件 | 版本 | 说明 |
|------|------|------|
| Python | 3.11+ | AI Service 运行环境 |
| FastAPI | 0.110+ | AI Service Web Framework |
| PaddleOCR | 2.7.0+ | OCR 引擎 |
| PaddleX | 2.1.0+ | 文档结构提取管道 |
| PP-OCRv4 | Latest | 文字检测+识别模型 |
| PP-DocLayout | Latest | 文档版面分析模型 |
| SLANet | v2 | 表格结构识别模型 |
| RabbitMQ | 3.12+ | Message Broker |
| MinIO | RELEASE.2024+ | Object Storage |
| Java | 17 LTS | Backend 运行环境 |
| Spring Boot | 3.2+ | Backend Framework |
| OpenSearch | 2.11+ | 文档全文检索 |
| PDF.js | 3.0+ | 前端 PDF Viewer |

---

> **文档状态**: Draft v1.0  
> **下次评审日期**: 2026-05-18  
> **联系人**: AI/OCR Technical Lead  
> **分发**: 开发团队, QA 团队, 架构评审委员会
