# CTMS/PMS 集成设计文档 - Phase 3: Integration Design

> 版本: 1.0.0 | 日期: 2026-05-11 | 状态: Draft

---

## 文档概述

本文档定义CTMS/PMS平台与外部临床研究生态系统的完整集成架构。集成架构基于以下核心设计原则：

| 原则 | 说明 |
|------|------|
| Phase 1 无完整FHIR Server | 不部署独立FHIR Server，采用FHIR风格资源映射作为内部交换格式 |
| Adapter 模式 | 每种外部系统类型对应一个独立适配器，隔离异构性 |
| 规范数据模型 (CDM) | 内部统一数据表示，所有外部数据首先转换为CDM实体 |
| 全异步集成 | 所有集成操作通过RabbitMQ异步任务驱动，带完整任务追踪 |
| 幂等性保证 | 通过(source_system, source_id, entity_type)三元组唯一约束实现幂等 |
| 失败退避与死信 | 失败任务经最大重试后进入死信队列，自动告警 |
| 定时与按需对账 | 对账引擎每日自动运行，支持手动触发 |

---

## 7.1 内部规范数据模型 (CDM)

规范数据模型(Canonical Data Model, CDM)是CTMS平台内部的统一数据表示层。所有外部系统数据在进入平台后，首先由对应适配器转换为CDM实体，后续所有业务逻辑仅操作CDM实体，实现对异构外部系统的完全解耦。

### 7.1.1 CDM设计原则

1. **领域驱动**: 每个CDM实体对应临床研究领域中的一个明确概念
2. **外部无关**: CDM字段不包含任何外部系统特有字段，外部特有信息存入`extension` JSONB字段
3. **溯源可审计**: 每条CDM记录保留`source_system`, `source_id`, `source_version`三个溯源字段
4. **去标识化**: 患者级数据在CDM层完成去标识化，保留`study_subject_id`作为研究身份
5. **FHIR对齐**: CDM实体设计与FHIR R4资源模型对齐，便于未来升级至完整FHIR Server

### 7.1.2 CDM实体总览

| 序号 | CDM实体 | 对应FHIR资源 | 数据来源 | 业务域 |
|------|---------|-------------|---------|--------|
| 1 | CdmPatient | Patient | HIS, EMR | 受试者人口学 |
| 2 | CdmEncounter | Encounter | HIS, EDC | 访视/就诊 |
| 3 | CdmObservation | Observation | LIS, EDC | 临床观察/检查结果 |
| 4 | CdmDiagnosticReport | DiagnosticReport | PACS, LIS | 诊断报告 |
| 5 | CdmMedicationStatement | MedicationStatement | EMR, EDC | 用药记录 |
| 6 | CdmAdverseEvent | AdverseEvent | EDC, HIS | 不良事件 |
| 7 | CdmDocumentReference | DocumentReference | eTMF, PACS | 文档引用 |
| 8 | CdmStudySubject | ResearchSubject | EDC, HIS | 研究-受试者关联 |

### 7.1.3 CdmPatient - 受试者人口学

**业务说明**: 存储受试者的去标识化人口学信息。原始标识信息(PII)不存储于CDM层，仅在适配器层临时持有用于匹配。

**字段定义**:

| 字段名 | 类型 | 必填 | 说明 | FHIR路径 | 映射规则 |
|--------|------|------|------|----------|----------|
| patient_cdm_id | BIGSERIAL | PK | CDM内部主键 | Patient.id | AUTO_GENERATE |
| study_subject_id | VARCHAR(50) | M | 研究受试者编号 | Patient.identifier:studySubjectId | DIRECT |
| subject_screening_no | VARCHAR(50) | O | 筛选号 | Patient.identifier:screeningNo | DIRECT |
| subject_randomization_no | VARCHAR(50) | O | 随机号 | Patient.identifier:randomizationNo | DIRECT |
| gender | VARCHAR(10) | O | 性别 (MALE/FEMALE/OTHER/UNKNOWN) | Patient.gender | CODE_MAP (HL7->FHIR AdministrativeGender) |
| birth_year | INTEGER | O | 出生年份(去标识化) | Patient.birthDate (仅保留年份) | TRANSFORM (完整日期->仅年份) |
| age_at_enrollment | INTEGER | O | 入组时年龄 | Patient.extension:ageAtEnrollment | DIRECT |
| ethnicity | VARCHAR(50) | O | 民族 | Patient.extension:ethnicity | LOOKUP (HIS编码->CTMS字典) |
| race | VARCHAR(50) | O | 人种 | Patient.extension:race | LOOKUP (CDISC Race->CTMS字典) |
| country | VARCHAR(5) | O | 国家 (ISO 3166-1 alpha-3) | Patient.address.country | DIRECT |
| region | VARCHAR(100) | O | 省份/地区 | Patient.address.state | DIRECT |
| site_id | VARCHAR(50) | M | 中心编号 | Patient.managingOrganization.reference | DIRECT |
| study_id | VARCHAR(50) | M | 研究项目编号 | Patient.extension:studyId | DIRECT |
| enrollment_status | VARCHAR(30) | M | 入组状态 | Patient.extension:enrollmentStatus | CODE_MAP |
| enrollment_date | DATE | O | 入组日期 | Patient.extension:enrollmentDate | DIRECT |
| withdrawal_date | DATE | O | 退出日期 | Patient.extension:withdrawalDate | DIRECT |
| informed_consent_date | TIMESTAMP | O | 知情同意签署时间 | Patient.extension:informedConsentDate | DIRECT |
| source_system | VARCHAR(50) | M | 源系统代码 | Patient.meta.tag:sourceSystem | DIRECT |
| source_id | VARCHAR(100) | M | 源系统主键ID | Patient.identifier:sourceId | DIRECT |
| source_version | INTEGER | M | 源数据版本号 | Patient.meta.versionId | DIRECT |
| sync_time | TIMESTAMP | M | 同步时间戳 | Patient.meta.lastUpdated | AUTO |
| data_hash | VARCHAR(64) | M | 数据指纹(SHA-256) | -- | AUTO_CALCULATE |
| extension | JSONB | O | 扩展字段 | Patient.extension[*] | AGGREGATE |
| is_deleted | BOOLEAN | M | 软删除标记 | Patient.extension:isDeleted | DIRECT |
| create_time | TIMESTAMP | M | 创建时间 | -- | AUTO |
| update_time | TIMESTAMP | M | 更新时间 | -- | AUTO |

**唯一约束**: UNIQUE(source_system, source_id) -- 幂等性保证

**索引设计**:
- idx_cdm_patient_study_subject ON (study_id, study_subject_id)
- idx_cdm_patient_site ON (site_id)
- idx_cdm_patient_hash ON (data_hash) -- 变更检测
- idx_cdm_patient_gin_extension ON extension USING GIN -- JSONB查询

**数据来源与权威系统**:

| 字段组 | 权威来源 | 备选来源 | 合并策略 |
|--------|---------|---------|----------|
| study_subject_id / site_id | EDC | -- | EDC为准 |
| 人口学 (gender, birth_year, ethnicity) | HIS | EMR | HIS优先, EMR补充空值 |
| 知情同意日期 | EDC | HIS | EDC为准(监管要求) |
| 入组状态 | EDC | -- | EDC为准 |

**映射示例 - HIS ADT HL7v2 -> CdmPatient**:

```
HL7 v2 PID Segment                     CdmPatient Field
=====================================  ====================
PID-3.1 (Patient Identifier)       ->  source_id
PID-3.4 (Assigning Authority)      ->  source_system = 'HIS_SITE_001'
PID-7  (Date of Birth)             ->  birth_year = EXTRACT(YEAR)
PID-8  (Administrative Sex)        ->  gender (M->MALE, F->FEMALE)
PID-11 (Patient Address)           ->  region (PID-11.4), country (PID-11.6)
PV1-7 (Attending Doctor)           ->  extension.attending_doctor
```

### 7.1.4 CdmEncounter - 访视/就诊记录

**业务说明**: 记录受试者的每次访视/就诊。包括筛选访视、基线访视、治疗访视、随访访视等。

**字段定义**:

| 字段名 | 类型 | 必填 | 说明 | FHIR路径 | 映射规则 |
|--------|------|------|------|----------|----------|
| encounter_cdm_id | BIGSERIAL | PK | CDM内部主键 | Encounter.id | AUTO_GENERATE |
| patient_cdm_id | BIGINT | M | FK->CdmPatient | Encounter.subject.reference | LOOKUP_CDM |
| study_subject_id | VARCHAR(50) | M | 研究受试者编号 | Encounter.subject.identifier | DIRECT |
| study_id | VARCHAR(50) | M | 研究编号 | Encounter.extension:studyId | DIRECT |
| site_id | VARCHAR(50) | M | 中心编号 | Encounter.serviceProvider.reference | DIRECT |
| visit_sequence_no | INTEGER | M | 访视序号 (1,2,3...) | Encounter.extension:visitSequenceNo | DIRECT |
| visit_code | VARCHAR(50) | M | 访视编码 (SCREENING/C1D1/C2D1/FU_W4) | Encounter.class.code | CODE_MAP |
| visit_name | VARCHAR(200) | M | 访视名称 (筛选期/第1周期第1天) | Encounter.class.display | DIRECT |
| visit_type | VARCHAR(30) | M | 访视类型 | Encounter.type | LOOKUP (EDC EPOCH->CTMS VisitType) |
| visit_status | VARCHAR(30) | M | 访视状态 | Encounter.status | CODE_MAP |
| planned_start_date | DATE | O | 计划开始日期 | Encounter.period.start | DIRECT |
| actual_start_date | DATE | O | 实际开始日期 | Encounter.extension:actualStartDate | DIRECT |
| actual_end_date | DATE | O | 实际结束日期 | Encounter.period.end | DIRECT |
| window_days_before | INTEGER | O | 窗口期前N天 | Encounter.extension:windowBefore | DIRECT |
| window_days_after | INTEGER | O | 窗口期后N天 | Encounter.extension:windowAfter | DIRECT |
| is_window_violation | BOOLEAN | O | 是否窗口期超窗 | Encounter.extension:windowViolation | TRANSFORM |
| hospital_encounter_id | VARCHAR(100) | O | 对应HIS就诊号 | Encounter.identifier:hospitalEncounter | DIRECT |
| hospital_visit_type | VARCHAR(30) | O | HIS就诊类型 | Encounter.hospitalization.admitSource | DIRECT |
| edc_crf_status | VARCHAR(30) | O | EDC CRF状态 | Encounter.extension:edcCrfStatus | DIRECT |
| edc_crf_completion_date | TIMESTAMP | O | EDC CRF完成日期 | Encounter.extension:edcCrfCompletionDate | DIRECT |
| source_system | VARCHAR(50) | M | 源系统代码 | -- | DIRECT |
| source_id | VARCHAR(100) | M | 源系统唯一ID | -- | DIRECT |
| source_version | INTEGER | M | 源数据版本 | -- | DIRECT |
| sync_time | TIMESTAMP | M | 同步时间 | -- | AUTO |
| data_hash | VARCHAR(64) | M | 数据指纹 | -- | AUTO |
| extension | JSONB | O | 扩展字段 | -- | AGGREGATE |
| is_deleted | BOOLEAN | M | 软删除 | -- | DIRECT |
| create_time | TIMESTAMP | M | 创建时间 | -- | AUTO |
| update_time | TIMESTAMP | M | 更新时间 | -- | AUTO |

**唯一约束**: UNIQUE(source_system, source_id)

**业务约束**: UNIQUE(study_id, study_subject_id, visit_sequence_no) -- 同研究同受试者访视序号唯一

**数据来源与权威系统**:

| 字段组 | 权威来源 | 说明 |
|--------|---------|------|
| 访视定义 (visit_code/name/type/sequence) | EDC | EDC中的访视表单定义为权威 |
| 实际访视日期 | HIS | 受试者实际到院日期以HIS为准 |
| CRF完成状态 | EDC | EDC为唯一来源 |
| 窗口期超窗判定 | CTMS | CTMS根据计划日期与实际日期计算 |

### 7.1.5 CdmObservation - 临床观察/检查结果

**业务说明**: 存储所有临床观察和检查结果，包括实验室检查、生命体征、体格检查等。

**字段定义**:

| 字段名 | 类型 | 必填 | 说明 | FHIR路径 | 映射规则 |
|--------|------|------|------|----------|----------|
| obs_cdm_id | BIGSERIAL | PK | CDM内部主键 | Observation.id | AUTO_GENERATE |
| patient_cdm_id | BIGINT | M | FK->CdmPatient | Observation.subject.reference | LOOKUP_CDM |
| encounter_cdm_id | BIGINT | O | FK->CdmEncounter | Observation.encounter.reference | LOOKUP_CDM |
| study_subject_id | VARCHAR(50) | M | 研究受试者编号 | Observation.subject.identifier | DIRECT |
| study_id | VARCHAR(50) | M | 研究编号 | Observation.extension:studyId | DIRECT |
| site_id | VARCHAR(50) | M | 中心编号 | Observation.extension:siteId | DIRECT |
| visit_sequence_no | INTEGER | O | 访视序号 | Observation.extension:visitSequenceNo | DIRECT |
| observation_code | VARCHAR(100) | M | 观察项目编码 | Observation.code.coding[0].code | CODE_MAP |
| observation_code_system | VARCHAR(200) | M | 编码系统 | Observation.code.coding[0].system | DIRECT |
| observation_name | VARCHAR(200) | M | 观察项目名称 | Observation.code.coding[0].display | DIRECT |
| observation_category | VARCHAR(50) | M | 分类 (LAB/VITAL/PHYSICAL_EXAM/ECG) | Observation.category | CODE_MAP |
| value_type | VARCHAR(30) | M | 值类型 (NUMERIC/STRING/CODED/RANGE/RATIO) | Observation.value[x]子元素类型 | DIRECT |
| value_numeric | DOUBLE PRECISION | O | 数值型结果 | Observation.valueQuantity.value | CONVERT |
| value_unit | VARCHAR(50) | O | 单位 | Observation.valueQuantity.unit | UNIT_STANDARDIZE |
| value_unit_system | VARCHAR(200) | O | 单位系统 (UCUM) | Observation.valueQuantity.system | DIRECT |
| value_string | TEXT | O | 文本型结果 | Observation.valueString | DIRECT |
| value_code | VARCHAR(100) | O | 编码型结果 | Observation.valueCodeableConcept.coding.code | DIRECT |
| value_code_system | VARCHAR(200) | O | 编码系统 | Observation.valueCodeableConcept.coding.system | DIRECT |
| reference_range_low | DOUBLE PRECISION | O | 参考范围下限 | Observation.referenceRange.low.value | DIRECT |
| reference_range_high | DOUBLE PRECISION | O | 参考范围上限 | Observation.referenceRange.high.value | DIRECT |
| reference_range_text | VARCHAR(200) | O | 参考范围文本 | Observation.referenceRange.text | DIRECT |
| abnormal_flag | VARCHAR(10) | O | 异常标识 (N/H/L/LL/HH/AA) | Observation.interpretation | CODE_MAP |
| is_clinically_significant | BOOLEAN | O | 是否临床有意义 | Observation.extension:clinicallySignificant | TRANSFORM |
| effective_date | TIMESTAMP | M | 结果生效时间 | Observation.effectiveDateTime | DIRECT |
| collection_date | TIMESTAMP | O | 标本采集时间 | Observation.extension:specimenCollectionDate | DIRECT |
| result_date | TIMESTAMP | O | 结果报告时间 | Observation.issued | DIRECT |
| performing_lab_code | VARCHAR(50) | O | 执行实验室代码 | Observation.performer.reference | DIRECT |
| performing_lab_name | VARCHAR(200) | O | 执行实验室名称 | Observation.performer.display | DIRECT |
| method_code | VARCHAR(100) | O | 方法学编码 | Observation.method.coding.code | DIRECT |
| method_name | VARCHAR(200) | O | 方法学名称 | Observation.method.coding.display | DIRECT |
| specimen_type | VARCHAR(100) | O | 标本类型 (SERUM/URINE/BLOOD) | Observation.specimen | CODE_MAP |
| comment | TEXT | O | 备注 | Observation.note | DIRECT |
| edc_crf_field_id | VARCHAR(100) | O | 对应EDC eCRF字段ID | Observation.extension:edcFieldId | DIRECT |
| source_system | VARCHAR(50) | M | 源系统 | -- | DIRECT |
| source_id | VARCHAR(100) | M | 源系统ID | -- | DIRECT |
| source_version | INTEGER | M | 源版本 | -- | DIRECT |
| sync_time | TIMESTAMP | M | 同步时间 | -- | AUTO |
| data_hash | VARCHAR(64) | M | 数据指纹 | -- | AUTO |
| extension | JSONB | O | 扩展 | -- | AGGREGATE |
| is_deleted | BOOLEAN | M | 软删除 | -- | DIRECT |
| create_time | TIMESTAMP | M | 创建时间 | -- | AUTO |
| update_time | TIMESTAMP | M | 更新时间 | -- | AUTO |

**唯一约束**: UNIQUE(source_system, source_id)

**业务唯一约束**: UNIQUE(study_subject_id, visit_sequence_no, observation_code, effective_date)

**单位标准化规则**:

| 检验项目 | 标准单位 (UCUM) | 常见变体 | 转换公式 |
|----------|----------------|----------|----------|
| 白细胞计数 (WBC) | 10^9/L | /uL, K/uL, G/L | /uL*0.001 -> 10^9/L |
| 血红蛋白 (HGB) | g/L | g/dL, mg/dL | g/dL*10 -> g/L |
| 肌酐 (CREA) | umol/L | mg/dL | mg/dL*88.4 -> umol/L |
| 血糖 (GLU) | mmol/L | mg/dL | mg/dL*0.0555 -> mmol/L |
| 总胆红素 (TBIL) | umol/L | mg/dL | mg/dL*17.1 -> umol/L |

**代码系统映射**:

| 检验类别 | CTMS内部编码系统 | 标准编码系统 | 映射方向 |
|----------|-----------------|-------------|---------|
| 血常规 | LIS_LOCAL | LOINC | LIS_LOCAL -> LOINC |
| 生化 | LIS_LOCAL | LOINC | LIS_LOCAL -> LOINC |
| 凝血功能 | LIS_LOCAL | LOINC | LIS_LOCAL -> LOINC |
| 尿常规 | LIS_LOCAL | LOINC | LIS_LOCAL -> LOINC |
| 生命体征 | CTMS_VITAL | LOINC | 直接存储LOINC |
| ECG | CTMS_ECG | LOINC | 直接存储LOINC |

### 7.1.6 CdmDiagnosticReport - 诊断报告

**业务说明**: 存储影像学报告、病理报告、内镜报告等结构化或半结构化诊断报告。

**字段定义**:

| 字段名 | 类型 | 必填 | 说明 | FHIR路径 | 映射规则 |
|--------|------|------|------|----------|----------|
| report_cdm_id | BIGSERIAL | PK | CDM内部主键 | DiagnosticReport.id | AUTO_GENERATE |
| patient_cdm_id | BIGINT | M | FK->CdmPatient | DiagnosticReport.subject.reference | LOOKUP_CDM |
| encounter_cdm_id | BIGINT | O | FK->CdmEncounter | DiagnosticReport.encounter.reference | LOOKUP_CDM |
| study_subject_id | VARCHAR(50) | M | 研究受试者编号 | -- | DIRECT |
| study_id | VARCHAR(50) | M | 研究编号 | -- | DIRECT |
| site_id | VARCHAR(50) | M | 中心编号 | -- | DIRECT |
| visit_sequence_no | INTEGER | O | 访视序号 | -- | DIRECT |
| report_type | VARCHAR(50) | M | 报告类型 (RADIOLOGY/PATHOLOGY/ENDOSCOPY/ECG/OTHER) | DiagnosticReport.category | CODE_MAP |
| report_code | VARCHAR(100) | O | 报告项目编码 (LOINC) | DiagnosticReport.code.coding.code | LOINC_MAP |
| report_code_system | VARCHAR(200) | O | 编码系统 | DiagnosticReport.code.coding.system | DIRECT |
| report_name | VARCHAR(200) | M | 报告名称 | DiagnosticReport.code.coding.display | DIRECT |
| report_title | VARCHAR(500) | O | 报告标题 | DiagnosticReport.conclusion | DIRECT |
| report_conclusion | TEXT | O | 报告结论 | DiagnosticReport.conclusion | DIRECT |
| report_findings | TEXT | O | 报告所见 | DiagnosticReport.extension:findings | DIRECT |
| report_impression | TEXT | O | 影像学印象 | DiagnosticReport.extension:impression | DIRECT |
| report_priority | VARCHAR(20) | O | 优先级 (STAT/ROUTINE) | DiagnosticReport.extension:priority | DIRECT |
| imaging_modality | VARCHAR(30) | O | 影像学模态 (CT/MR/XA/US/NM/PT) | DiagnosticReport.extension:modality | DICOM_MAP |
| imaging_anatomy | VARCHAR(100) | O | 影像部位 | DiagnosticReport.extension:anatomy | SNOMED_MAP |
| procedure_code | VARCHAR(100) | O | 操作编码 | DiagnosticReport.extension:procedureCode | CODE_MAP |
| effective_date | TIMESTAMP | M | 检查执行时间 | DiagnosticReport.effectiveDateTime | DIRECT |
| issued_date | TIMESTAMP | M | 报告签发时间 | DiagnosticReport.issued | DIRECT |
| performing_org_code | VARCHAR(100) | O | 执行科室编码 | DiagnosticReport.performer.reference | DIRECT |
| performing_org_name | VARCHAR(200) | O | 执行科室名称 | DiagnosticReport.performer.display | DIRECT |
| reporting_doctor_name | VARCHAR(100) | O | 报告医生 | DiagnosticReport.resultsInterpreter.display | DIRECT |
| approving_doctor_name | VARCHAR(100) | O | 审核医生 | DiagnosticReport.extension:approvingDoctor | DIRECT |
| result_images | JSONB | O | 关联影像列表 | DiagnosticReport.media[*] | TRANSFORM |
| associated_observations | JSONB | O | 关联检查项目 | DiagnosticReport.result[*] | LOOKUP_CDM |
| document_ref_uuids | JSONB | O | 关联文档UUID | DiagnosticReport.presentedForm[*] | LOOKUP_MINIO |
| source_system | VARCHAR(50) | M | 源系统 | -- | DIRECT |
| source_id | VARCHAR(100) | M | 源系统ID (studyInstanceUID) | -- | DIRECT |
| source_version | INTEGER | M | 源版本 | -- | DIRECT |
| sync_time | TIMESTAMP | M | 同步时间 | -- | AUTO |
| data_hash | VARCHAR(64) | M | 数据指纹 | -- | AUTO |
| extension | JSONB | O | 扩展 | -- | AGGREGATE |
| is_deleted | BOOLEAN | M | 软删除 | -- | DIRECT |
| create_time | TIMESTAMP | M | 创建时间 | -- | AUTO |
| update_time | TIMESTAMP | M | 更新时间 | -- | AUTO |

**唯一约束**: UNIQUE(source_system, source_id)

**影像关联设计**:

```
CdmDiagnosticReport.result_images JSONB结构:
{
  "images": [
    {
      "series_uid": "2.25.123456.7890.1.2.3.4",
      "instance_uid": "2.25.123456.7890.1.2.3.4.5",
      "sop_class": "1.2.840.10008.5.1.4.1.1.2",
      "image_index": 1,
      "thumbnail_path": "pacs/thumbnails/study_xxx/series_yyy/img_1.jpg",
      "wado_rs_url": "http://pacs-server/wado?requestType=WADO&studyUID=...",
      "is_key_image": true
    }
  ]
}
```

### 7.1.7 CdmMedicationStatement - 用药记录

**业务说明**: 记录受试者在研究期间的合并用药、研究用药情况。

**字段定义**:

| 字段名 | 类型 | 必填 | 说明 | FHIR路径 | 映射规则 |
|--------|------|------|------|----------|----------|
| med_cdm_id | BIGSERIAL | PK | CDM主键 | MedicationStatement.id | AUTO_GENERATE |
| patient_cdm_id | BIGINT | M | FK->CdmPatient | MedicationStatement.subject.reference | LOOKUP_CDM |
| encounter_cdm_id | BIGINT | O | FK->CdmEncounter | MedicationStatement.context.reference | LOOKUP_CDM |
| study_subject_id | VARCHAR(50) | M | 研究受试者编号 | -- | DIRECT |
| study_id | VARCHAR(50) | M | 研究编号 | -- | DIRECT |
| medication_code | VARCHAR(100) | M | 药品编码 (ATC) | MedicationStatement.medicationCodeableConcept.coding.code | ATC_MAP |
| medication_code_system | VARCHAR(200) | M | 编码系统 | MedicationStatement.medicationCodeableConcept.coding.system | DIRECT |
| medication_name | VARCHAR(300) | M | 药品通用名 | MedicationStatement.medicationCodeableConcept.coding.display | DIRECT |
| medication_trade_name | VARCHAR(300) | O | 商品名 | MedicationStatement.extension:tradeName | DIRECT |
| medication_category | VARCHAR(30) | M | 用药类别 (CONCOMITANT/STUDY_MED/RESCUE/PRE_MED) | MedicationStatement.extension:category | CODE_MAP |
| dosage_form | VARCHAR(100) | O | 剂型 | MedicationStatement.dosage.form | DIRECT |
| dosage_value | DOUBLE PRECISION | O | 单次剂量 | MedicationStatement.dosage.doseAndRate.doseQuantity.value | CONVERT |
| dosage_unit | VARCHAR(50) | O | 剂量单位 | MedicationStatement.dosage.doseAndRate.doseQuantity.unit | UNIT_STANDARDIZE |
| dosage_frequency | VARCHAR(100) | O | 给药频次 (QD/BID/TID/QID/QW) | MedicationStatement.dosage.timing.code | CODE_MAP |
| dosage_route | VARCHAR(100) | O | 给药途径 (PO/IV/SC/IM) | MedicationStatement.dosage.route | CODE_MAP |
| start_date | DATE | M | 开始日期 | MedicationStatement.effectivePeriod.start | DIRECT |
| end_date | DATE | O | 结束日期 | MedicationStatement.effectivePeriod.end | DIRECT |
| is_ongoing | BOOLEAN | O | 是否持续用药 | MedicationStatement.status | TRANSFORM |
| is_study_medication | BOOLEAN | M | 是否研究用药 | MedicationStatement.extension:isStudyMedication | DIRECT |
| is_prior_medication | BOOLEAN | O | 是否入组前用药 | MedicationStatement.extension:isPriorMedication | DIRECT |
| indication_code | VARCHAR(100) | O | 适应症编码 (ICD-10) | MedicationStatement.reasonCode.coding.code | ICD_MAP |
| indication_name | VARCHAR(200) | O | 适应症描述 | MedicationStatement.reasonCode.coding.display | DIRECT |
| ae_relationship | VARCHAR(30) | O | 与AE关系 (关联AE ID) | MedicationStatement.extension:aeRelation | LOOKUP_CDM |
| source_system | VARCHAR(50) | M | 源系统 | -- | DIRECT |
| source_id | VARCHAR(100) | M | 源系统ID | -- | DIRECT |
| source_version | INTEGER | M | 源版本 | -- | DIRECT |
| sync_time | TIMESTAMP | M | 同步时间 | -- | AUTO |
| data_hash | VARCHAR(64) | M | 数据指纹 | -- | AUTO |
| extension | JSONB | O | 扩展 | -- | AGGREGATE |
| is_deleted | BOOLEAN | M | 软删除 | -- | DIRECT |
| create_time | TIMESTAMP | M | 创建时间 | -- | AUTO |
| update_time | TIMESTAMP | M | 更新时间 | -- | AUTO |

**唯一约束**: UNIQUE(source_system, source_id)

### 7.1.8 CdmAdverseEvent - 不良事件

**业务说明**: 存储临床研究中发生的所有不良事件(AE)及严重不良事件(SAE)。整合来自EDC、HIS、安全数据库的数据。

**字段定义**:

| 字段名 | 类型 | 必填 | 说明 | FHIR路径 | 映射规则 |
|--------|------|------|------|----------|----------|
| ae_cdm_id | BIGSERIAL | PK | CDM主键 | AdverseEvent.id | AUTO_GENERATE |
| patient_cdm_id | BIGINT | M | FK->CdmPatient | AdverseEvent.subject.reference | LOOKUP_CDM |
| encounter_cdm_id | BIGINT | O | FK->CdmEncounter | AdverseEvent.encounter.reference | LOOKUP_CDM |
| study_subject_id | VARCHAR(50) | M | 研究受试者编号 | -- | DIRECT |
| study_id | VARCHAR(50) | M | 研究编号 | -- | DIRECT |
| site_id | VARCHAR(50) | M | 中心编号 | -- | DIRECT |
| ae_number | VARCHAR(30) | M | AE编号 (受试者内自增) | AdverseEvent.extension:aeNumber | DIRECT |
| ae_term | VARCHAR(500) | M | AE名称(报告术语) | AdverseEvent.event.coding.display | DIRECT |
| ae_llt_code | VARCHAR(50) | O | MedDRA LLT编码 | AdverseEvent.event.coding.code | MEDDRA_MAP |
| ae_pt_code | VARCHAR(50) | O | MedDRA PT编码 | AdverseEvent.extension:meddraPtCode | MEDDRA_ROLLUP |
| ae_pt_name | VARCHAR(200) | O | MedDRA PT名称 | AdverseEvent.extension:meddraPtName | MEDDRA_ROLLUP |
| ae_soc_code | VARCHAR(50) | O | MedDRA SOC编码 | AdverseEvent.extension:meddraSocCode | MEDDRA_ROLLUP |
| ae_soc_name | VARCHAR(200) | O | MedDRA SOC名称 | AdverseEvent.extension:meddraSocName | MEDDRA_ROLLUP |
| is_serious | BOOLEAN | M | 是否SAE | AdverseEvent.seriousness | TRANSFORM |
| seriousness_criteria | JSONB | O | SAE标准 | AdverseEvent.seriousness | CODE_MAP |
| severity | VARCHAR(20) | M | 严重程度 (MILD/MODERATE/SEVERE/LIFE_THREATENING/DEATH) | AdverseEvent.severity | CODE_MAP |
| ae_outcome | VARCHAR(30) | M | 结局 (RECOVERED/RECOVERING/NOT_RECOVERED/FATAL/UNKNOWN) | AdverseEvent.outcome | CODE_MAP |
| onset_date | DATE | M | 发生日期 | AdverseEvent.actuality+date | DIRECT |
| end_date | DATE | O | 结束日期 | AdverseEvent.extension:endDate | DIRECT |
| duration_days | INTEGER | O | 持续时间(天) | AdverseEvent.extension:durationDays | CALCULATE |
| is_treatment_emergent | BOOLEAN | O | 是否TEAE | AdverseEvent.extension:isTEAE | TRANSFORM |
| study_med_relation | VARCHAR(30) | O | 与研究药物关系 | AdverseEvent.suspectEntity[0].causality | CODE_MAP |
| concomitant_med_relation | VARCHAR(30) | O | 与合并用药关系 | AdverseEvent.suspectEntity[1].causality | CODE_MAP |
| action_taken | VARCHAR(100) | O | 采取措施 | AdverseEvent.extension:actionTaken | CODE_MAP |
| sae_report_date | DATE | O | SAE报告日期 | AdverseEvent.recordedDate | DIRECT |
| sae_report_to_ec_date | DATE | O | 上报伦理委员会日期 | AdverseEvent.extension:saeReportToECDate | DIRECT |
| sae_report_to_sponsor_date | DATE | O | 上报申办方日期 | AdverseEvent.extension:saeReportToSponsorDate | DIRECT |
| sae_report_to_ha_date | DATE | O | 上报监管部门日期 | AdverseEvent.extension:saeReportToHADate | DIRECT |
| sae_expedited_report | BOOLEAN | O | 是否加速报告 | AdverseEvent.extension:expeditedReport | DIRECT |
| narrative | TEXT | O | AE描述/SAE叙述 | AdverseEvent.extension:narrative | DIRECT |
| source_system | VARCHAR(50) | M | 源系统 | -- | DIRECT |
| source_id | VARCHAR(100) | M | 源系统ID | -- | DIRECT |
| source_version | INTEGER | M | 源版本 | -- | DIRECT |
| sync_time | TIMESTAMP | M | 同步时间 | -- | AUTO |
| data_hash | VARCHAR(64) | M | 数据指纹 | -- | AUTO |
| extension | JSONB | O | 扩展 | -- | AGGREGATE |
| is_deleted | BOOLEAN | M | 软删除 | -- | DIRECT |
| create_time | TIMESTAMP | M | 创建时间 | -- | AUTO |
| update_time | TIMESTAMP | M | 更新时间 | -- | AUTO |

**唯一约束**: UNIQUE(source_system, source_id)

**AE合并去重规则**:

| 优先级 | 来源系统 | 合并策略 |
|--------|---------|----------|
| 1 | EDC (eCRF) | AE的主要来源，AE术语以EDC为准 |
| 2 | 安全数据库 (Argus/ArisGlobal) | SAE相关字段(报告日期、严重程度判定)以安全数据库为准 |
| 3 | HIS | 补充支持信息(实验室检查、合并用药等信息用于判定与药物的关系) |

### 7.1.9 CdmDocumentReference - 文档引用

**业务说明**: 存储与临床研究相关的文档元数据引用，实际文件存储于MinIO。

**字段定义**:

| 字段名 | 类型 | 必填 | 说明 | FHIR路径 | 映射规则 |
|--------|------|------|------|----------|----------|
| doc_cdm_id | BIGSERIAL | PK | CDM主键 | DocumentReference.id | AUTO_GENERATE |
| patient_cdm_id | BIGINT | O | FK->CdmPatient | DocumentReference.subject.reference | LOOKUP_CDM |
| study_id | VARCHAR(50) | M | 研究编号 | DocumentReference.extension:studyId | DIRECT |
| site_id | VARCHAR(50) | O | 中心编号 | DocumentReference.extension:siteId | DIRECT |
| doc_uuid | UUID | M | 文档唯一标识 | DocumentReference.masterIdentifier.value | AUTO_GENERATE |
| doc_type | VARCHAR(50) | M | 文档类型 (ICF/SOURCE_MEDICAL_RECORD/LAB_REPORT/IMAGING_REPORT/AE_SAE_FORM/ETMF_DOC) | DocumentReference.type.coding.code | CODE_MAP |
| doc_category | VARCHAR(50) | M | 文档分类 (ESSENTIAL/TMF/SOURCE/REGULATORY) | DocumentReference.category | CODE_MAP |
| doc_title | VARCHAR(500) | M | 文档标题 | DocumentReference.description | DIRECT |
| doc_format | VARCHAR(50) | M | 文件格式 (PDF/DICOM/JPEG/PNG/XML) | DocumentReference.content[0].format.code | DIRECT |
| doc_size_bytes | BIGINT | O | 文件大小 | DocumentReference.content[0].attachment.size | DIRECT |
| doc_hash | VARCHAR(64) | O | 文件SHA-256 | DocumentReference.content[0].attachment.hash | AUTO_CALCULATE |
| minio_bucket | VARCHAR(100) | M | MinIO存储桶 | DocumentReference.content[0].attachment.url (Bucket) | DIRECT |
| minio_object_key | VARCHAR(500) | M | MinIO对象键 | DocumentReference.content[0].attachment.url (ObjectKey) | DIRECT |
| s3_presigned_url_expiry | TIMESTAMP | O | 预签名URL过期时间 | -- | AUTO_CALCULATE |
| doc_status | VARCHAR(30) | M | 文档状态 (DRAFT/FINAL/SUPERSEDED/RETIRED) | DocumentReference.status | CODE_MAP |
| author_name | VARCHAR(200) | O | 作者 | DocumentReference.author.display | DIRECT |
| author_org | VARCHAR(200) | O | 作者单位 | DocumentReference.author.reference | DIRECT |
| creation_date | TIMESTAMP | O | 创建日期 | DocumentReference.date | DIRECT |
| indexing_date | TIMESTAMP | M | 归档日期 | DocumentReference.extension:indexingDate | AUTO |
| version_no | INTEGER | M | 版本号 | DocumentReference.meta.versionId | DIRECT |
| is_current_version | BOOLEAN | M | 是否当前版本 | DocumentReference.extension:isCurrentVersion | DIRECT |
| replaced_doc_cdm_id | BIGINT | O | 被取代的文档CDM ID | DocumentReference.relatesTo | LOOKUP_CDM |
| etmf_artifact_id | VARCHAR(100) | O | eTMF artifact ID | DocumentReference.extension:etmfArtifactId | DIRECT |
| etmf_zone | VARCHAR(100) | O | eTMF区域 | DocumentReference.extension:etmfZone | DIRECT |
| regulatory_ref | VARCHAR(200) | O | 监管引用 (e.g., 21 CFR Part 11) | DocumentReference.extension:regulatoryRef | DIRECT |
| source_system | VARCHAR(50) | M | 源系统 | -- | DIRECT |
| source_id | VARCHAR(100) | M | 源系统ID | -- | DIRECT |
| source_version | INTEGER | M | 源版本 | -- | DIRECT |
| sync_time | TIMESTAMP | M | 同步时间 | -- | AUTO |
| data_hash | VARCHAR(64) | M | 数据指纹 | -- | AUTO |
| extension | JSONB | O | 扩展 | -- | AGGREGATE |
| is_deleted | BOOLEAN | M | 软删除 | -- | DIRECT |
| create_time | TIMESTAMP | M | 创建时间 | -- | AUTO |
| update_time | TIMESTAMP | M | 更新时间 | -- | AUTO |

**唯一约束**: UNIQUE(doc_uuid); UNIQUE(source_system, source_id)

### 7.1.10 CdmStudySubject - 研究-受试者关联

**业务说明**: 管理受试者在多个系统中的身份映射，是去标识化的核心桥梁。

**字段定义**:

| 字段名 | 类型 | 必填 | 说明 | FHIR路径 | 映射规则 |
|--------|------|------|------|----------|----------|
| study_subject_cdm_id | BIGSERIAL | PK | CDM主键 | ResearchSubject.id | AUTO_GENERATE |
| patient_cdm_id | BIGINT | M | FK->CdmPatient | ResearchSubject.individual.reference | LOOKUP_CDM |
| study_id | VARCHAR(50) | M | 研究编号 | ResearchSubject.study.reference | DIRECT |
| site_id | VARCHAR(50) | M | 中心编号 | ResearchSubject.extension:siteId | DIRECT |
| study_subject_id | VARCHAR(50) | M | 研究受试者编号(CTMS统一编号) | ResearchSubject.identifier:universal | CTMS_GENERATE |
| screening_no | VARCHAR(50) | O | 筛选号 | ResearchSubject.identifier:screeningNo | DIRECT |
| randomization_no | VARCHAR(50) | O | 随机号 | ResearchSubject.identifier:randomizationNo | DIRECT |
| subject_status | VARCHAR(30) | M | 受试者状态 | ResearchSubject.status | CODE_MAP |
| enrollment_date | DATE | O | 入组日期 | ResearchSubject.period.start | DIRECT |
| withdrawal_date | DATE | O | 退出日期 | ResearchSubject.period.end | DIRECT |
| withdrawal_reason | VARCHAR(200) | O | 退出原因 | ResearchSubject.extension:withdrawalReason | DIRECT |
| treatment_arm | VARCHAR(100) | O | 治疗组别 | ResearchSubject.extension:treatmentArm | DIRECT |
| is_randomized | BOOLEAN | O | 是否已随机 | ResearchSubject.extension:isRandomized | DIRECT |
| identity_mappings | JSONB | M | 多系统身份映射 | ResearchSubject.identifier[*] | AGGREGATE |
| source_system | VARCHAR(50) | M | 源系统 | -- | DIRECT |
| source_id | VARCHAR(100) | M | 源系统ID | -- | DIRECT |
| source_version | INTEGER | M | 源版本 | -- | DIRECT |
| sync_time | TIMESTAMP | M | 同步时间 | -- | AUTO |
| data_hash | VARCHAR(64) | M | 数据指纹 | -- | AUTO |
| extension | JSONB | O | 扩展 | -- | AGGREGATE |
| is_deleted | BOOLEAN | M | 软删除 | -- | DIRECT |
| create_time | TIMESTAMP | M | 创建时间 | -- | AUTO |
| update_time | TIMESTAMP | M | 更新时间 | -- | AUTO |

**identity_mappings JSONB结构**:

```json
{
  "mappings": [
    {
      "system": "HIS",
      "system_patient_id": "HIS_PAT_123456",
      "system_encounter_id": "HIS_ENC_789012",
      "site_id": "SITE_001"
    },
    {
      "system": "EDC",
      "system_subject_id": "EDC_SUBJ_001-001",
      "system_screening_no": "SCR-2024-001",
      "study_id": "STUDY_CTM_001"
    },
    {
      "system": "EMR",
      "system_patient_id": "EMR_PAT_789",
      "site_id": "SITE_001"
    }
  ]
}
```

**唯一约束**: UNIQUE(study_id, study_subject_id); UNIQUE(source_system, source_id)

---

## 7.2 FHIR风格资源映射

### 7.2.1 映射策略

CTMS采用FHIR R4资源模型作为内部交换格式，但不部署独立的FHIR Server。映射遵守以下策略：

| 策略 | 说明 | 示例 |
|------|------|------|
| 资源类选择 | 选择与CDM语义最接近的FHIR资源 | CdmPatient -> Patient, CdmObservation -> Observation |
| Identifier处理 | 所有标识符使用system/value对 | ... |
| Extension扩展 | CTMS特有字段通过自定义Extension表达 | 入组状态、超窗标记等 |
| CodeSystem映射 | 标准编码系统直接使用; 本地编码通过ConceptMap映射 | LIS_LOCAL -> LOINC via CTMS ConceptMap |
| 去标识化 | FHIR Patient中不包含PII字段; 通过study_subject_id作为研究身份 | birthDate仅保留年份 |

### 7.2.2 使用的FHIR资源列表

| FHIR资源 | CTMS CDM实体 | 用途 | 外部系统交互方向 |
|----------|-------------|------|-----------------|
| Patient | CdmPatient | 受试者人口学信息 | HIS/EMR -> CTMS (入站) |
| Encounter | CdmEncounter | 访视/就诊记录 | HIS/EDC -> CTMS (入站) |
| Observation | CdmObservation | 临床观察/检查结果 | LIS/EDC -> CTMS (入站) |
| DiagnosticReport | CdmDiagnosticReport | 诊断报告 | PACS/LIS -> CTMS (入站) |
| MedicationStatement | CdmMedicationStatement | 用药记录 | EMR/EDC -> CTMS (入站) |
| AdverseEvent | CdmAdverseEvent | 不良事件 | EDC/HIS -> CTMS (入站) |
| DocumentReference | CdmDocumentReference | 文档引用 | eTMF/PACS -> CTMS (入站) |
| ResearchSubject | CdmStudySubject | 研究-受试者关联 | EDC -> CTMS (入站) |

### 7.2.3 Identifier体系设计

所有FHIR资源中的identifier采用统一的system URI规范：

| Identifier System URI | 说明 | 示例Value | 使用资源 |
|----------------------|------|-----------|----------|
| http://ctms.example.com/identifiers/studySubjectId | CTMS统一研究受试者编号 | SUBJ-001 | Patient, Encounter, Observation等 |
| http://ctms.example.com/identifiers/screeningNo | 筛选号 | SCR-2024-001 | Patient, ResearchSubject |
| http://ctms.example.com/identifiers/randomizationNo | 随机号 | RND-2024-001 | Patient, ResearchSubject |
| http://ctms.example.com/identifiers/sourceId | 源系统ID | HIS_PAT_123456 | 所有CDM实体 |
| http://ctms.example.com/identifiers/hospitalEncounter | HIS就诊号 | ENC-789012 | Encounter |
| http://ctms.example.com/identifiers/edcCrfId | EDC CRF ID | CRF_PAGE_001 | Encounter, Observation |
| http://ctms.example.com/identifiers/studyUid | DICOM Study UID | 2.25.123456... | DiagnosticReport |
| http://ctms.example.com/identifiers/etmfArtifactId | eTMF构件ID | ART-001 | DocumentReference |

### 7.2.4 编码系统映射

CTMS内部使用标准术语系统进行数据标准化。本地编码通过ConceptMap资源进行双向映射。

| 领域 | 标准编码系统 | 标准URI | CTMS本地编码 | 映射方式 |
|------|-------------|---------|-------------|---------|
| 实验室检查项目 | LOINC | http://loinc.org | LIS本地编码 | LIS_LOCAL -> LOINC via ConceptMap |
| 实验室检查方法 | LOINC | http://loinc.org | LIS本地编码 | 同上 |
| 临床发现/诊断 | SNOMED CT | http://snomed.info/sct | 中文诊断术语 | ICD-10 -> SNOMED via ConceptMap |
| 药品编码 | ATC | http://www.whocc.no/atc | 本地药品编码 | DRUG_LOCAL -> ATC via ConceptMap |
| 给药途径 | SNOMED CT | http://snomed.info/sct | 本地途径编码 | ROUTE_LOCAL -> SNOMED via ConceptMap |
| 不良事件 | MedDRA | http://meddra.org | 报告术语 | LLT -> PT -> SOC (MedDRA层级) |
| 生命体征 | LOINC | http://loinc.org | 直接使用LOINC | LOINC -> LOINC (直接) |
| 影像学检查 | LOINC / DICOM | http://loinc.org / DICOM CID | PACS本地编码 | PACS_LOCAL -> LOINC/DICOM via ConceptMap |
| 知情同意 | SNOMED CT | http://snomed.info/sct | CTMS内部编码 | CTMS -> SNOMED via ConceptMap |
| 民族 | CDISC Race | https://www.cdisc.org/terminology | 直接使用CDISC | 直接 |
| 单位 | UCUM | http://unitsofmeasure.org | LIS本地单位 | UNIT_LOCAL -> UCUM via ConversionTable |
**ConceptMap资源结构**:

```json
{
  "resourceType": "ConceptMap",
  "id": "lis-loinc-hematology",
  "name": "LIS_LOCAL_to_LOINC_Hematology",
  "sourceUri": "http://ctms.example.com/codesystem/lis-local",
  "targetUri": "http://loinc.org",
  "group": [
    {
      "element": [
        {
          "code": "WBC",
          "display": "白细胞计数",
          "target": [{"code": "6690-2", "display": "Leukocytes [#/volume] in Blood", "equivalence": "EQUIVALENT"}]
        },
        {
          "code": "HGB",
          "display": "血红蛋白",
          "target": [{"code": "718-7", "display": "Hemoglobin [Mass/volume] in Blood", "equivalence": "EQUIVALENT"}]
        }
      ]
    }
  ]
}
```

### 7.2.5 Extension定义

CTMS自定义Extension用于承载CTMS特有字段：

| Extension URI | 用途 | 值类型 | 使用资源 |
|---------------|------|--------|----------|
| .../studyId | 研究编号 | string | Patient, Encounter, Observation等 |
| .../siteId | 中心编号 | string | Patient, Encounter, Observation等 |
| .../enrollmentStatus | 入组状态 | CodeableConcept | Patient |
| .../enrollmentDate | 入组日期 | date | Patient |
| .../withdrawalDate | 退出日期 | date | Patient |
| .../informedConsentDate | 知情同意日期 | dateTime | Patient |
| .../ageAtEnrollment | 入组时年龄 | integer | Patient |
| .../ethnicity | 民族 | CodeableConcept | Patient |
| .../visitSequenceNo | 访视序号 | integer | Encounter, Observation |
| .../visitName | 访视名称 | string | Encounter |
| .../windowBefore | 超窗前N天 | integer | Encounter |
| .../windowAfter | 超窗后N天 | integer | Encounter |
| .../windowViolation | 是否超窗 | boolean | Encounter |
| .../treatmentArm | 治疗组别 | string | ResearchSubject |
| .../isRandomized | 是否随机 | boolean | ResearchSubject |
| .../isStudyMedication | 是否研究用药 | boolean | MedicationStatement |
| .../isTEAE | 是否TEAE | boolean | AdverseEvent |
| .../meddraPtCode | MedDRA PT编码 | Coding | AdverseEvent |
| .../meddraSocCode | MedDRA SOC编码 | Coding | AdverseEvent |
| .../saeReportingDate | SAE报告日期 | dateTime | AdverseEvent |
| .../expeditedReport | 是否加速报告 | boolean | AdverseEvent |
| .../etmfZone | eTMF Zone | string | DocumentReference |
| .../etmfArtifactId | eTMF构件ID | string | DocumentReference |
| .../isCurrentVersion | 是否当前版本 | boolean | DocumentReference |
| .../sourceSystem | 源系统 | string | 所有CDM实体 |
| .../sourceId | 源系统ID | string | 所有CDM实体 |
| .../isDeleted | 软删除 | boolean | 所有CDM实体 |

Extension URL前缀统一为: http://ctms.example.com/fhir/StructureDefinition/
### 7.2.6 FHIR Patient JSON示例

以下展示CdmPatient到FHIR Patient的完整映射示例：

```json
{
  "resourceType": "Patient",
  "id": "cdm-patient-1001",
  "meta": {
    "versionId": "3",
    "lastUpdated": "2026-05-11T10:30:00+08:00",
    "tag": [
      {"system": "http://ctms.example.com/tags", "code": "sourceSystem", "display": "HIS_SITE_001"}
    ]
  },
  "identifier": [
    {
      "system": "http://ctms.example.com/identifiers/studySubjectId",
      "value": "SUBJ-001"
    },
    {
      "system": "http://ctms.example.com/identifiers/screeningNo",
      "value": "SCR-2024-001"
    },
    {
      "system": "http://ctms.example.com/identifiers/randomizationNo",
      "value": "RND-2024-001"
    },
    {
      "system": "http://ctms.example.com/identifiers/sourceId",
      "value": "HIS_PAT_123456"
    }
  ],
  "gender": "male",
  "birthDate": "1965",
  "address": [
    {
      "country": "CHN",
      "state": "北京市"
    }
  ],
  "managingOrganization": {
    "reference": "Organization/SITE_001"
  },
  "extension": [
    {
      "url": "http://ctms.example.com/fhir/StructureDefinition/studyId",
      "valueString": "STUDY_CTM_001"
    },
    {
      "url": "http://ctms.example.com/fhir/StructureDefinition/enrollmentStatus",
      "valueCodeableConcept": {
        "coding": [{"system": "http://ctms.example.com/codesystem/enrollmentStatus", "code": "ENROLLED", "display": "已入组"}]
      }
    },
    {
      "url": "http://ctms.example.com/fhir/StructureDefinition/enrollmentDate",
      "valueDate": "2025-01-15"
    },
    {
      "url": "http://ctms.example.com/fhir/StructureDefinition/informedConsentDate",
      "valueDateTime": "2025-01-14T09:00:00+08:00"
    },
    {
      "url": "http://ctms.example.com/fhir/StructureDefinition/ageAtEnrollment",
      "valueInteger": 60
    },
    {
      "url": "http://ctms.example.com/fhir/StructureDefinition/ethnicity",
      "valueCodeableConcept": {
        "coding": [{"system": "http://ctms.example.com/codesystem/ethnicity", "code": "HAN", "display": "汉族"}]
      }
    }
  ]
}
```

**CdmPatient <-> FHIR Patient 字段级映射**:

| CdmPatient字段 | FHIR Patient路径 | 转换逻辑 |
|----------------|-----------------|---------|
| patient_cdm_id | Patient.id | 'cdm-patient-' + id |
| study_subject_id | Patient.identifier[studySubjectId].value | 直接映射 |
| subject_screening_no | Patient.identifier[screeningNo].value | 直接映射 |
| gender | Patient.gender | CODE_MAP: MALE->male, FEMALE->female |
| birth_year | Patient.birthDate | 仅取年份部分，格式'YYYY' |
| ethnicity | Patient.extension:ethnicity | LOOKUP到标准CodeableConcept |
| country | Patient.address.country | ISO 3166-1 alpha-3 |
| region | Patient.address.state | 直接映射 |
| site_id | Patient.managingOrganization.reference | 'Organization/' + site_id |
| source_system | Patient.meta.tag | system=http://ctms.example.com/tags, code=sourceSystem |
| source_version | Patient.meta.versionId | 转为string |
### 7.2.7 FHIR Observation JSON示例

以下展示CdmObservation到FHIR Observation的完整映射示例（血常规-白细胞计数）：

```json
{
  "resourceType": "Observation",
  "id": "cdm-obs-5001",
  "meta": {
    "versionId": "1",
    "lastUpdated": "2026-05-11T10:35:00+08:00"
  },
  "status": "final",
  "category": [
    {
      "coding": [
        {"system": "http://terminology.hl7.org/CodeSystem/observation-category", "code": "laboratory", "display": "Laboratory"}
      ]
    }
  ],
  "code": {
    "coding": [
      {"system": "http://loinc.org", "code": "6690-2", "display": "Leukocytes [#/volume] in Blood"}
    ],
    "text": "白细胞计数(WBC)"
  },
  "subject": {
    "reference": "Patient/cdm-patient-1001",
    "identifier": {"system": "http://ctms.example.com/identifiers/studySubjectId", "value": "SUBJ-001"}
  },
  "encounter": {
    "reference": "Encounter/cdm-encounter-2001"
  },
  "effectiveDateTime": "2025-02-01T08:00:00+08:00",
  "issued": "2025-02-01T10:00:00+08:00",
  "valueQuantity": {
    "value": 7.5,
    "unit": "10^9/L",
    "system": "http://unitsofmeasure.org",
    "code": "10*9/L"
  },
  "referenceRange": [
    {
      "low": {"value": 3.5, "unit": "10^9/L"},
      "high": {"value": 9.5, "unit": "10^9/L"},
      "text": "3.5-9.5 10^9/L"
    }
  ],
  "interpretation": [
    {
      "coding": [{"system": "http://terminology.hl7.org/CodeSystem/v3-ObservationInterpretation", "code": "N", "display": "Normal"}]
    }
  ],
  "performer": [
    {
      "reference": "Organization/LAB_CENTRAL_001",
      "display": "中心实验室"
    }
  ],
  "extension": [
    {
      "url": "http://ctms.example.com/fhir/StructureDefinition/studyId",
      "valueString": "STUDY_CTM_001"
    },
    {
      "url": "http://ctms.example.com/fhir/StructureDefinition/visitSequenceNo",
      "valueInteger": 3
    },
    {
      "url": "http://ctms.example.com/fhir/StructureDefinition/sourceSystem",
      "valueString": "LIS_CENTRAL_001"
    }
  ]
}
```

**CdmObservation <-> FHIR Observation 字段级映射**:

| CdmObservation字段 | FHIR Observation路径 | 转换逻辑 |
|--------------------|---------------------|---------|
| obs_cdm_id | Observation.id | 'cdm-obs-' + id |
| patient_cdm_id | Observation.subject.reference | 'Patient/cdm-patient-' + patient_cdm_id |
| observation_code | Observation.code.coding[0].code | 通过ConceptMap将LIS本地编码转为LOINC |
| observation_code_system | Observation.code.coding[0].system | 标准系统URI |
| value_numeric + value_unit | Observation.valueQuantity | 单位标准化后填入UCUM单位 |
| value_string | Observation.valueString | 直接映射 |
| value_code | Observation.valueCodeableConcept | 构建CodeableConcept |
| reference_range_low/high | Observation.referenceRange | 构建low/high ValueQuantity |
| abnormal_flag | Observation.interpretation | H->HH, L->LL, N->N 等映射 |
| effective_date | Observation.effectiveDateTime | ISO 8601格式 |
| collection_date | Observation.extension:specimenCollectionDate | Extension |
| performing_lab_code/name | Observation.performer | 构建reference+display |
| method_code/name | Observation.method | 构建CodeableConcept |

---

## 7.3 外部系统适配器

### 7.3.1 适配器架构总览

适配器层是CTMS与外部系统之间进行数据交换的桥梁。每个适配器负责：

1. **协议适配**: 处理不同外部系统的通信协议(HL7 v2/DICOM/FHIR/REST)
2. **数据转换**: 将外部系统特定格式转换为CDM实体（入站），或将CDM实体转换为外部系统格式（出站）
3. **术语映射**: 将外部系统的本地编码映射为标准术语系统
4. **错误处理**: 处理网络故障、数据格式错误、业务规则冲突等异常情况
5. **凭证管理**: 安全管理各中心的外部系统访问凭证

```
                           CTMS Integration Layer
                          ========================

  +--------+     +-------+     +--------+     +-----------+
  |  HIS   |     |  LIS  |     |  PACS  |     |    EMR    |
  | (HL7v2)|     |(HL7v2)|     |(DICOM) |     |(FHIR/HL7) |
  +----+---+     +---+---+     +---+----+     +-----+-----+
       |               |             |                |
  +----v----+     +---v----+   +----v----+     +-----v-----+
  |  HIS    |     |  LIS   |   |  PACS   |     |    EMR    |
  | Adapter |     |Adapter |   | Adapter |     |  Adapter  |
  +----+----+     +---+----+   +----+----+     +-----+-----+
       |               |             |                |
       +---------------------------------------------------+
                           |
                    +------v-------+       +-----------+
                    |   CDM Layer  |<----->| RabbitMQ  |
                    | (PostgreSQL) |       | Event Bus |
                    +------+-------+       +-----+-----+
                           |                      |
              +-------------------------+ |    +-----v-----+
              |    EDC Adapter (REST)   | |    |   eTMF    |
              +-------------------------+ |    |  Adapter  |
              |    Medidata Rave/Veeva  | |    |  (REST)   |
              +-------------------------+ |    +-----------+
```

### 7.3.2 适配器统一接口规范

每个适配器必须实现以下Java接口：

```java
public interface ExternalSystemAdapter<T_SOURCE, T_CDM> {

    /** 适配器标识, 如 'HIS-SITE-001' **/
    String getAdapterName();

    /** 适配器支持的系统类型 **/
    ExternalSystemType getSystemType();

    /** 将外部系统数据转换为CDM实体 **/
    T_CDM toCdmEntity(T_SOURCE sourceData);

    /** 将CDM实体转换为外部系统格式(仅双向适配器需要) **/
    default T_SOURCE toSourceFormat(T_CDM cdmEntity) {
        throw new UnsupportedOperationException("Unidirectional adapter");
    }

    /** 检测数据是否有实质性变更(基于data_hash比较) **/
    boolean hasChanges(T_CDM existing, T_CDM incoming);

    /** 验证外部数据完整性和业务规则 **/
    List<ValidationError> validate(T_SOURCE sourceData);

    /** 连接测试和健康检查 **/
    HealthCheckResult healthCheck();
}
```

### 7.3.3 适配器通用错误处理策略

| 错误类别 | 处理策略 | 重试次数 | 告警机制 |
|---------|---------|---------|---------|
| 网络超时 | 指数退避重试, 30s/5min/30min | 3 | 3次后发送告警通知 |
| 认证失败 | 检查凭证配置, 不重试 | 0 | 立即发送告警(高优先级) |
| 数据格式错误 | 记录错误详情到integration_error_log, 跳过 | 0 | 日累计>100条时告警 |
| 编码映射失败 | 存储原始值到extension, 标记为UNMAPPED | 0 | 计入未映射统计日报 |
| 单位转换失败 | 记录原始值和单位, 标记为UNCONVERTED | 0 | 计入未转换统计日报 |
| 患者匹配失败 | 创建临时孤记录, 进入manual_review | 0 | 立即通知数据管理员 |
| 业务规则校验失败 | 标记为VALIDATION_FAILED, 进入manual_review | 0 | 通知数据管理员 |
| 数据哈希一致(无变更) | 跳过更新, 记录为SKIPPED | N/A | 否 |

### 7.3.4 适配器凭证管理

每个站点的外部系统凭证存储于加密配置中，通过site_id索引：

```yaml
integration:
  credentials:
    SITE_001:
      his:
        endpoint: "https://his-server.site001.hospital.com:8443"
        auth_type: "BASIC"
        username: "${HIS_SITE001_USER}"
        password: "${HIS_SITE001_PASS}"
        timeout_ms: 30000
        rate_limit_per_second: 10
      lis:
        endpoint: "hl7://lis-server.site001.hospital.com:2575"
        auth_type: "CERTIFICATE"
        keystore_path: "/etc/ctms/certs/site001-lis-keystore.p12"
        timeout_ms: 60000
        rate_limit_per_second: 5
      pacs:
        endpoint: "http://pacs.site001.hospital.com/dicomweb"
        auth_type: "TOKEN"
        token_endpoint: "http://pacs.site001.hospital.com/auth/token"
        client_id: "${PACS_SITE001_CLIENT_ID}"
        client_secret: "${PACS_SITE001_SECRET}"
        timeout_ms: 120000
```
### 7.3.5 HIS适配器 (Hospital Information System)

**适配器标识**: HIS_ADAPTER

**系统描述**: 医院信息系统(HIS)是住院部门诊管理系统的总称，提供患者基本信息、就诊记录、入院/出院/转科(ADT)信息。

#### 接口协议

| 协议 | 标准消息 | 方向 | 场景 | 优先级 |
|------|---------|------|------|--------|
| HL7 v2.x | ADT^A01 (入院) | HIS -> CTMS | 受试者入院通知 | 高 |
| HL7 v2.x | ADT^A02 (转科) | HIS -> CTMS | 受试者转科/转区 | 中 |
| HL7 v2.x | ADT^A03 (出院) | HIS -> CTMS | 受试者出院 | 高 |
| HL7 v2.x | ADT^A04 (挂号) | HIS -> CTMS | 门诊挂号(筛选) | 中 |
| HL7 v2.x | ADT^A08 (更新患者信息) | HIS -> CTMS | 人口学信息变更 | 中 |
| HL7 v2.x | ORM^O01 (医嘱) | HIS -> CTMS | 医嘱下达(可选) | 低 |
| HL7 v2.x | ORU^R01 (结果) | HIS -> CTMS | 检验/检查结果 | 中 |
| RESTful API | JSON | 双向 | 按需查询(HIS支持REST时) | 低 |

#### 认证方式

| 认证类型 | 说明 | 配置位置 |
|---------|------|---------|
| BASIC Auth | 用户名+密码，适用于REST接口 | endpoint配置中 |
| TLS双向认证 | 客户端证书，适用于HL7 MLLP连接 | keystore证书文件 |
| VPN/IPSec | 站点网络层安全 | 网络层配置 |
| API Key | Key+Secret签名，适用于部分新系统 | Header: X-Api-Key |

#### HL7 v2 到 CdmPatient 数据映射

```
HL7 v2 Message (ADT^A01)                          CdmPatient
=============================================     ==========================
MSH-3  (Sending Application)                  ->  source_system = 'HIS_{siteId}'
MSH-10 (Message Control ID)                   ->  source_id (消息级幂等性) + extension.message_control_id
MSH-7  (Message Date/Time)                    ->  sync_time
PID-3.1 (Patient Identifier List - ID)        ->  source_id = 'HIS-PAT-' + PID-3.1
PID-3.4 (Patient Identifier - Auth)           ->  合并到 source_system 判定
PID-5.1 (Patient Name - Family)               ->  extension.family_name (PII仅存extension, 可配置脱敏)
PID-7  (Date of Birth)                        ->  birth_year = EXTRACT(YEAR FROM PID-7)
PID-8  (Administrative Sex)                   ->  gender = CODE_MAP(M->MALE, F->FEMALE, O->OTHER, U->UNKNOWN)
PID-10 (Race)                                 ->  race = LOOKUP_CDISC(PID-10)
PID-11.3 (Address - City)                     ->  extension.city
PID-11.4 (Address - State)                    ->  region
PID-11.6 (Address - Country)                  ->  country = ISO_3166_ALPHA3(PID-11.6)
PID-22 (Ethnic Group)                         ->  ethnicity = LOOKUP_ETHNIC(PID-22)
PV1-2  (Patient Class)                        ->  extension.patient_class (I=住院, O=门诊, E=急诊)
PV1-3  (Assigned Patient Location)            ->  extension.assigned_location
PV1-7  (Attending Doctor)                     ->  extension.attending_doctor
PV1-19 (Visit Number)                         ->  extension.his_visit_number
PV1-44 (Admission Date)                       ->  extension.admission_date
PV1-45 (Discharge Date)                       ->  extension.discharge_date
```

#### HL7 v2 到 CdmEncounter 数据映射

```
HL7 v2 Message (ADT)                              CdmEncounter
=============================================     ==========================
MSH-3  (Sending Application)                  ->  source_system
PID-3.1 (Patient ID)                          ->  通过Patient匹配→patient_cdm_id
PV1-2  (Patient Class)                        ->  hospital_visit_type = CODE_MAP
PV1-19 (Visit Number)                         ->  hospital_encounter_id
PV1-44 (Admit Date/Time)                      ->  actual_start_date = DATE(PV1-44)
PV1-45 (Discharge Date/Time)                  ->  actual_end_date = DATE(PV1-45)
PV1-3  (Assigned Location)                    ->  extension.hospital_department
```

#### HL7 v2 消息接入示例 - ADT^A01 (入院通知)

```
MSH|^~\&|HIS_SITE001|HOSP_A|CTMS|CTMS_APP|20260201080000||ADT^A01^ADT_A01|MSG-001-20260201|P|2.5
EVN|A01|20260201080000
PID|1||PAT-00123456^^^HOSP_A^MR||张三^ZHANGSAN||19650115|M||HAN|北京市朝阳区XX路100号^^北京市^^100020^CHN|||M|NON|||||||||^汉族
PV1|1|I|W101^01^01^^^S||||1234^王医生|||||||||||0||||||||||||||||||||||||||||202602010800||20260201080000
```

**解析逻辑(伪代码)**:
```java
public CdmPatient parseAdtToPatient(String hl7Message) {
    Hl7Message msg = Hl7Parser.parse(hl7Message);
    String sendingApp = msg.get("MSH-3");
    String patientId = msg.get("PID-3.1");
    String[] nameParts = msg.get("PID-5").split("^");

    CdmPatient patient = new CdmPatient();
    patient.setSourceSystem("HIS_" + sendingApp.substring(sendingApp.lastIndexOf('_')+1));
    patient.setSourceId("HIS-PAT-" + patientId);
    patient.setSourceVersion(1);
    patient.setGender(mapAdministrativeSex(msg.get("PID-8")));
    patient.setBirthYear(extractYear(msg.get("PID-7")));
    patient.setRegion(msg.get("PID-11.4"));
    patient.setCountry(toIsoAlpha3(msg.get("PID-11.6")));
    // PII信息仅保存到extension JSONB
    patient.setExtension(buildPiiExtension(nameParts));
    patient.setSyncTime(now());
    patient.setDataHash(calculateHash(patient));
    return patient;
}
```

#### HIS适配器连接管理

| 配置项 | 说明 | 默认值 |
|--------|------|--------|
| endpoint | HIS服务器端点URL或MLLP地址 | - |
| auth_type | 认证类型 (BASIC/CERTIFICATE/TOKEN) | BASIC |
| timeout_ms | 连接超时(毫秒) | 30000 |
| max_pool_size | 最大连接池大小 | 5 |
| rate_limit_per_second | 每秒最大请求数 | 10 |
| retry_count | 失败重试次数 | 3 |
| retry_backoff_ms | 重试退避初始值(毫秒) | 30000 |
| mllp_port | MLLP监听端口(接收HL7消息时) | 2575 |
| mllp_buffer_size | MLLP接收缓冲区大小 | 1048576 (1MB) |
| charset | 字符编码 | UTF-8 |
### 7.3.6 LIS适配器 (Laboratory Information System)

**适配器标识**: LIS_ADAPTER

**系统描述**: 实验室信息系统(LIS)管理临床实验室的检验申请、标本处理、结果录入与报告。是临床研究中最核心的数据源之一。

#### 接口协议

| 协议 | 标准 | 方向 | 场景 |
|------|------|------|------|
| HL7 v2 | ORU^R01 (Unsolicited Observation Result) | LIS -> CTMS | 检验结果主动推送 |
| HL7 v2 | OML^O21 (Lab Order) | CTMS -> LIS | 检验申请(可选) |
| ASTM E1394 | ASTM E1394 | LIS -> CTMS | 仪器直接输出(老系统) |
| FHIR R4 | Observation | LIS -> CTMS | 现代LIS系统FHIR接口 |
| CSV/Excel Export | 自定义格式 | LIS -> CTMS | 定期批量导出 |

#### LOINC编码映射流程

```
LIS本地检验编码 → CTMS ConceptMap → LOINC标准编码

   LIS系统发送:                      CTMS处理:
   OBX|1|NM|WBC^白细胞计数||7.3|    1. 查找ConceptMap[code=WBC]
                                    2. 找到target LOINC: 6690-2
                                    3. CdmObservation.observation_code = '6690-2'
                                    4. CdmObservation.observation_code_system = 'http://loinc.org'
                                    5. 同时保存原始编码到extension.source_observation_code = 'WBC'

未映射编码处理:
   ConceptMap[code=UNKNOWN_TEST] → NOT FOUND
   → CdmObservation.observation_code = 'UNKNOWN_TEST' (保持原值)
   → CdmObservation.observation_code_system = 'http://ctms.example.com/codesystem/lis-local'
   → extension.mapping_status = 'UNMAPPED'
   → 触发未映射告警，加入mapping_review队列
```

#### ORU^R01 到 CdmObservation 数据映射

```
HL7 v2 ORU^R01 OBX Segment                     CdmObservation
==========================================     ===========================
MSH-3  (Sending Application)               ->  source_system
MSH-10 (Message Control ID)                ->  source_id + extension.message_control_id
OBX-2  (Value Type: NM/ST/CE)              ->  value_type (NM->NUMERIC, ST->STRING, CE->CODED)
OBX-3.1 (Observation Identifier)           ->  observation_code (经ConceptMap->LOINC)
OBX-3.2 (Observation Text)                 ->  observation_name
OBX-3.3 (Coding System)                    ->  原始编码系统 (留存extension)
OBX-5  (Observation Value)                 ->  value_numeric / value_string / value_code (根据OBX-2类型)
OBX-6  (Units)                             ->  value_unit (经UCUM标准化)
OBX-7  (Reference Range)                   ->  reference_range_low / reference_range_high (PARSE数值范围)
OBX-8  (Abnormal Flags)                    ->  abnormal_flag = CODE_MAP(OBX-8)
OBX-11 (Observation Result Status)         ->  当OBX-11='C'时标记为CORRECTED,生成新版本
OBX-14 (Date/Time of Observation)          ->  effective_date
OBR-7  (Observation Date/Time)             ->  collection_date
OBR-22 (Results Rpt/Status Chng - DT)      ->  result_date
OBR-15 (Specimen Source)                   ->  specimen_type
OBR-26 (Parent Result)                     ->  extension.parent_result_id
```

#### ORU^R01消息示例 - 血常规结果

```
MSH|^~\&|LIS_CENTRAL|LAB_CENTRAL_001|CTMS|CTMS_APP|20260201100000||ORU^R01^ORU_R01|MSG-002-20260201|P|2.5
PID|1||PAT-00123456^^^HOSP_A^MR
OBR|1||ORD-1001|CBC^血常规|||20260201080000
OBX|1|NM|WBC^白细胞计数||7.5|10^9/L|3.5-9.5|N|||F|||20260201080000
OBX|2|NM|RBC^红细胞计数||4.85|10^12/L|3.8-5.1|N|||F|||20260201080000
OBX|3|NM|HGB^血红蛋白||142|g/L|115-150|N|||F|||20260201080000
OBX|4|NM|PLT^血小板||210|10^9/L|125-350|N|||F|||20260201080000
```

#### 单位标准化配置

```yaml
unit_conversion:
  WBC:
    standard_unit: "10^9/L"
    standard_ucum: "10*9/L"
    conversions:
      - from: "/uL"
        to: "10^9/L"
        factor: 0.001
      - from: "K/uL"
        to: "10^9/L"
        factor: 1.0
  HGB:
    standard_unit: "g/L"
    standard_ucum: "g/L"
    conversions:
      - from: "g/dL"
        to: "g/L"
        factor: 10
      - from: "mg/dL"
        to: "g/L"
        factor: 0.01
  GLU:
    standard_unit: "mmol/L"
    standard_ucum: "mmol/L"
    conversions:
      - from: "mg/dL"
        to: "mmol/L"
        factor: 0.0555
```

#### 参考范围解析逻辑

```java
public static RangeRange parseReferenceRange(String obx7, String valueType) {
    // OBX-7 格式: "3.5-9.5" 或 "<5.0" 或 ">1.0" 或 "NEGATIVE"
    if (obx7 == null || obx7.isEmpty()) return null;
    
    if (obx7.contains("-")) {
        String[] parts = obx7.split("-");
        return new ReferenceRange(
            parseDouble(parts[0]), 
            parseDouble(parts[1]));
    } else if (obx7.startsWith("<")) {
        return new ReferenceRange(null, parseDouble(obx7.substring(1)));
    } else if (obx7.startsWith(">")) {
        return new ReferenceRange(parseDouble(obx7.substring(1)), null);
    } else {
        // 定性参考范围，直接保存文本
        return new ReferenceRange(obx7);
    }
}
```

#### LIS适配器连接管理

| 配置项 | 说明 | 默认值 |
|--------|------|--------|
| endpoint | LIS服务器地址 (HL7 MLLP / REST URL) | - |
| auth_type | 认证类型 | CERTIFICATE |
| hl7_mllp_port | MLLP监听端口 | 2575 |
| hl7_version | 默认HL7版本 | 2.5 |
| loinc_version | LOINC版本 | 2.77 |
| default_coding_system | 默认编码系统 | LIS_LOCAL |
| unit_conversion_strict | 严格单位转换模式(转换失败则拒绝) | false |
| reference_range_parse_mode | 参考范围解析模式 (AUTO/MANUAL/LITERAL) | AUTO |
| max_batch_size | 单次批量处理最大记录数 | 1000 |
### 7.3.7 PACS适配器 (Picture Archiving and Communication System)

**适配器标识**: PACS_ADAPTER

**系统描述**: 影像归档和通信系统(PACS)管理医学影像的存储、检索、分发和展示。CTMS从PACS获取影像报告和DICOM元数据。

#### 接口协议

| 协议 | 标准 | 方向 | 场景 |
|------|------|------|------|
| DICOMweb WADO-RS | DICOM PS3.18 | PACS -> CTMS | 影像检索 (Web Access to DICOM Objects) |
| DICOMweb QIDO-RS | DICOM PS3.18 | PACS -> CTMS | 影像查询 (Query based on ID) |
| DICOMweb STOW-RS | DICOM PS3.18 | CTMS -> PACS | 影像存储(不常用) |
| DICOM C-FIND | DICOM PS3.4 | PACS -> CTMS | DICOM查询(传统接口) |
| DICOM C-MOVE | DICOM PS3.4 | PACS <-> CTMS | DICOM影像迁移 |
| HL7 v2 | ORU^R01 (MDM^T02) | PACS -> CTMS | 影像报告结果 |
| RESTful API | JSON | PACS -> CTMS | 现代PACS系统REST接口 |

#### DICOM 到 CdmDiagnosticReport 数据映射

```
DICOM Attribute                                       CdmDiagnosticReport
===============================================       =============================
Study Instance UID (0020,000D)                    ->  source_id
SOP Instance UID (0008,0018)                      ->  extension.sop_instance_uid
Patient ID (0010,0020)                            -> 通过patient_cdm_id匹配
Patient Name (0010,0010)                          -> extension.patient_name (脱敏)
Study Date (0008,0020)                            -> effective_date
Study Time (0008,0030)                            -> effective_date (合并时间部分)
Modality (0008,0060)                              -> imaging_modality = DICOM_MAP
Study Description (0008,1030)                     -> report_name
Body Part Examined (0018,0015)                    -> imaging_anatomy = SNOMED_MAP
Accession Number (0008,0050)                      -> extension.accession_number
Institution Name (0008,0080)                      -> performing_org_name
Referring Physician (0008,0090)                   -> extension.referring_physician
Series Instance UID (0020,000E)                   -> result_images[].series_uid
Number of Series (0020,1206)                      -> extension.series_count
Number of Instances (0020,1208)                   -> extension.instance_count
Image Type (0008,0008)                            -> extension.image_type
```

#### DICOM元数据提取流程

```
1. QIDO-RS查询: 按Study Date范围查询Study Instance UID列表
   GET /dicomweb/studies?Modality=CT&StudyDate=20260201-20260228&PatientID=PAT-00123456

2. WADO-RS获取: 逐个获取Study元数据(JSON格式)
   GET /dicomweb/studies/{studyInstanceUID}/metadata

3. 影像缩略图生成:
   对每个Series: 
     a. WADO-RS获取中间帧DICOM Instance
     b. DICOM解码 → BufferedImage (Java ImageIO + dcm4che)
     c. 应用Windowing (根据Window Center/Width)
     d. Resize → 256x256 JPEG缩略图
     e. 上传缩略图至MinIO: ctms-pacs/thumbnails/{studyUID}/{seriesUID}_{instanceNo}.jpg
     f. 生成预签名URL(有效期24h)存入result_images

4. 报告提取:
   a. 解析DICOM SR (Structured Report) SOP Class: 1.2.840.10008.5.1.4.1.1.88.33
   b. 提取findings字段: 从TID 2000, 3000, 4000模板中提取
   c. 提取conclusion字段: 从DICOM SR的conclusion节点
   d. 提取impression字段: 从DICOM SR的impression节点
```

#### DICOMweb QIDO-RS 请求/响应示例

**请求**:
```http
GET /dicomweb/studies?00100020=PAT-00123456&00080060=CT&00080020=20260201- HTTP/1.1
Host: pacs.site001.hospital.com
Accept: application/dicom+json
Authorization: Bearer eyJhbGciOiJSUzI1NiIs...
```

**响应**:
```json
[
  {
    "0020000D": {"vr": "UI", "Value": ["2.25.12345678901234567890.1.2.3.4"]},
    "00100020": {"vr": "LO", "Value": ["PAT-00123456"]},
    "00080020": {"vr": "DA", "Value": ["20260201"]},
    "00080060": {"vr": "CS", "Value": ["CT"]},
    "00081030": {"vr": "LO", "Value": ["胸部CT平扫"]},
    "00180015": {"vr": "CS", "Value": ["CHEST"]},
    "00201206": {"vr": "IS", "Value": ["2"]},
    "00201208": {"vr": "IS", "Value": ["350"]}
  }
]
```

#### 影像缩略图生成Java实现

```java
@Service
public class DicomThumbnailService {

    public ThumbnailResult generateThumbnail(String studyUid, String seriesUid, 
                                            String instanceUid, String wadoUrl) {
        // 1. 通过WADO-RS获取DICOM Instance
        byte[] dicomBytes = wadoRsClient.getInstance(studyUid, seriesUid, instanceUid);

        // 2. 解码DICOM
        DicomInputStream dis = new DicomInputStream(new ByteArrayInputStream(dicomBytes));
        Attributes attrs = dis.getDataset();

        // 3. 获取Window参数
        double windowCenter = attrs.getDouble(Tag.WindowCenter, 40);
        double windowWidth = attrs.getDouble(Tag.WindowWidth, 400);

        // 4. 渲染为BufferedImage
        BufferedImage image = DicomRenderer.render(attrs, windowCenter, windowWidth);

        // 5. Resize为缩略图
        BufferedImage thumbnail = new BufferedImage(256, 256, BufferedImage.TYPE_INT_RGB);
        Graphics2D g = thumbnail.createGraphics();
        g.drawImage(image, 0, 0, 256, 256, null);
        g.dispose();

        // 6. 编码为JPEG
        ByteArrayOutputStream baos = new ByteArrayOutputStream();
        ImageIO.write(thumbnail, "JPEG", baos);
        byte[] jpegBytes = baos.toByteArray();

        // 7. 上传至MinIO
        String objectKey = String.format("pacs/thumbnails/%s/%s/%s.jpg", 
            studyUid, seriesUid, instanceUid);
        minioClient.upload("ctms-pacs", objectKey, jpegBytes, "image/jpeg");

        // 8. 生成预签名URL
        String presignedUrl = minioClient.presignedGetObject("ctms-pacs", objectKey, 24, TimeUnit.HOURS);

        return new ThumbnailResult(objectKey, presignedUrl, 256, 256);
    }
}
```

#### PACS适配器连接管理

| 配置项 | 说明 | 默认值 |
|--------|------|--------|
| dicomweb_base_url | DICOMweb端点URL | - |
| ae_title | Application Entity Title | CTMS_APP |
| dicom_version | DICOM标准版本 | 2024c |
| thumbnail_size | 缩略图尺寸 | 256x256 |
| thumbnail_format | 缩略图格式 | JPEG |
| thumbnail_quality | JPEG质量(0-100) | 80 |
| max_studies_per_query | 单次查询最大Study数 | 500 |
| dicom_sr_enabled | 是否提取结构化报告 | true |
| dcm4che_version | dcm4che库版本 | 5.32 |
### 7.3.8 EMR适配器 (Electronic Medical Record)

**适配器标识**: EMR_ADAPTER

**系统描述**: 电子病历系统(EMR)管理患者的临床文档、问题列表、用药记录、过敏史等。CTMS从EMR获取受试者的源医疗文档和临床数据。

#### 接口协议

| 协议 | 标准 | 方向 | 场景 | 优先级 |
|------|------|------|------|--------|
| FHIR R4 | Patient, Encounter, MedicationStatement, AllergyIntolerance, Condition (Problem List), DocumentReference | EMR -> CTMS | FHIR原生接口(首选) | 高 |
| HL7 v2 | ADT, ORU, MDM | EMR -> CTMS | 传统HL7接口 | 中 |
| HL7 CDA R2 | Clinical Document Architecture | EMR -> CTMS | 临床文档交换 | 中 |
| HL7 CCD | Continuity of Care Document | EMR -> CTMS | 连续性照护文档 | 中 |

#### FHIR优先策略

EMR适配器遵循FHIR优先(FHIR-First)策略：

```java
public class EmrAdapter implements ExternalSystemAdapter<Object, Object> {

    @Override
    public CdmPatient toCdmEntity(Object sourceData) {
        if (sourceData instanceof Bundle fhirBundle) {
            return parseFHIRPatientBundle(fhirBundle);
        } else if (sourceData instanceof Hl7Message hl7Message) {
            return parseHL7AdtToPatient(hl7Message);
        } else if (sourceData instanceof CdaDocument cdaDocument) {
            return parseCdaToPatient(cdaDocument);
        }
        throw new UnsupportedSourceFormatException(
            "EMR source must be FHIR Bundle, HL7v2, or CDA");
    }
}
```

#### FHIR Bundle 到 CDM 批量映射

EMR适配器从FHIREndpoint获取Bundle，根据资源类型分别映射：

| FHIR Resource in Bundle | 映射目标 CDM 实体 | 触发条件 |
|------------------------|-------------------|---------|
| Patient | CdmPatient | 存在即映射 |
| Encounter | CdmEncounter | 关联到已存在的CdmPatient |
| MedicationStatement | CdmMedicationStatement | 关联到已存在的CdmPatient |
| AllergyIntolerance | CdmObservation (category=ALLERGY) | 关联到已存在的CdmPatient |
| Condition (Problem List) | CdmObservation (category=DIAGNOSIS) | 关联到已存在的CdmPatient |
| DocumentReference | CdmDocumentReference | 文件下载至MinIO |
| Procedure | CdmEncounter (extension:procedures) | 作为Encounter的扩展信息 |

#### 用药数据映射 (FHIR MedicationStatement -> CdmMedicationStatement)

```
FHIR MedicationStatement               CdmMedicationStatement
=============================          ============================
id                                     source_id = 'EMR-FHIR-' + id
subject.reference                      patient_cdm_id (通过reference解析)
context.reference                      encounter_cdm_id (通过reference解析)
medicationCodeableConcept.
  coding[ATC].code                     medication_code (ATC编码直接使用)
  coding[ATC].system                   medication_code_system
  coding[ATC].display                  medication_name
medicationCodeableConcept.
  coding[LOCAL].display                medication_trade_name
dosage.patientInstruction              extension.dosage_instruction
dosage.doseAndRate.doseQuantity.value   dosage_value (单位标准化)
dosage.doseAndRate.doseQuantity.unit    dosage_unit (UCUM标准化)
dosage.timing.code.coding.code          dosage_frequency
dosage.route.coding.code                dosage_route
effectivePeriod.start                   start_date
effectivePeriod.end                     end_date
status                                 is_ongoing (status=active -> true)
reasonCode[0].coding[ICD-10].code       indication_code
reasonCode[0].coding[ICD-10].display    indication_name
extension:category                       medication_category
```

#### EMR文档同步流程

```
1. FHIR DocumentReference 搜索:
   GET /fhir/DocumentReference?_sort=-date&_count=100&patient=Patient/cdm-patient-1001

2. 对比已有文档:
   检查 status 字段: 
   - current -> 需要同步
   - superseded -> 标记旧版本superseded, 同步新版本
   - retired -> 标记文档为retired

3. 文件下载:
   GET {DocumentReference.content[0].attachment.url}
   -> 二进制流下载 -> 计算SHA-256 -> MinIO存储

4. 元数据同步:
   CdmDocumentReference 保存文件引用和元数据
```

#### EMR适配器连接管理

| 配置项 | 说明 | 默认值 |
|--------|------|--------|
| fhir_base_url | FHIR服务器URL | - |
| fhir_version | FHIR版本 | R4 |
| fhir_auth_type | FHIR认证类型 (TOKEN/BASIC/OAUTH2) | TOKEN |
| hl7_fallback_enabled | HL7 v2回退模式 | true |
| cda_fallback_enabled | CDA回退模式 | true |
| max_bundle_entries | 单次Bundle最大条目数 | 200 |
| support_patient_everything | 是否支持$everything操作 | false |
| document_auto_download | 是否自动下载文档文件 | true |
| document_max_size_bytes | 文档最大下载大小 | 104857600 (100MB) |
### 7.3.9 EDC适配器 (Electronic Data Capture)

**适配器标识**: EDC_ADAPTER

**系统描述**: 电子数据采集系统(EDC)是临床研究的核心数据入口，管理CRF表单设计、数据录入、质疑管理、数据锁定等。主流EDC系统包括Medidata Rave、Veeva CDMS、Oracle Clinical等。

#### 支持的EDC系统

| EDC系统 | 协议 | 标准格式 | 认证方式 | 适配器实现类 |
|--------|------|---------|---------|-------------|
| Medidata Rave | REST API (Rave Web Services) | ODM XML (CDISC ODM 1.3.2), CSV Export | Basic Auth + Session Token | MedidataRaveAdapter |
| Veeva CDMS | REST API | CDISC ODM XML, JSON | OAuth2 (Client Credentials) | VeevaCdmsAdapter |
| Oracle Clinical | REST API / Database Link | ODM XML, SAS XPT | Basic Auth / DB Credential | OracleClinicalAdapter |
| Medrio EDC | REST API | JSON, CSV | API Key | MedrioEdcAdapter |
| 自定义EDC | CSV/Excel File Import | CSV/Excel模板 | N/A | CsvFileAdapter |

#### EDC核心同步实体

| EDC数据 | CDM实体 | 同步频率 | 优先级 |
|---------|---------|---------|--------|
| 受试者注册(Subject Registration) | CdmStudySubject, CdmPatient | 实时/准实时 | 高 |
| 筛选/随机信息 | CdmPatient (screening_no, randomization_no) | 实时 | 高 |
| 访视表单完成状态 | CdmEncounter (edc_crf_status) | 准实时 | 中 |
| 实验室数据(本地上传) | CdmObservation | 准实时/按需 | 中 |
| 不良事件(AE/SAE表单) | CdmAdverseEvent | 准实时 | 高 |
| 合并用药(ConMed表单) | CdmMedicationStatement | 准实时 | 中 |
| 质疑(Query)记录 | 扩展: integration_query_log | 每日 | 低 |
| 数据锁定状态 | CdmStudySubject.subject_status | 事件驱动 | 中 |
| 签名/审批记录 | 扩展: integration_signature_log | 每日 | 低 |

#### CDISC ODM XML 到 CDM 映射

```
CDISC ODM Element/XPath                             CDM Entity / Field
===============================================     =============================
/ODM/Study/@OID                                  ->  study_id (配置映射表)
/ODM/Study/GlobalVariables/StudyName             ->  study_name (验证用)
/ODM/Study/MetaDataVersion/Protocol/
   StudyEventRef/@StudyEventOID                   ->  访视定义
/ODM/ClinicalData/SubjectData/
  @SubjectKey                                     ->  study_subject_id (source) + screening_no
/ODM/ClinicalData/SubjectData/
  StudyEventData/@StudyEventOID                   ->  visit_code
/ODM/ClinicalData/SubjectData/
  StudyEventData/@StudyEventRepeatKey             ->  visit_sequence_no
/ODM/ClinicalData/SubjectData/
  StudyEventData/FormData/@FormOID                ->  CRF表单标识
/ODM/ClinicalData/SubjectData/
  StudyEventData/FormData/
  ItemGroupData/@ItemGroupOID                     ->  逻辑分组标识
/ODM/ClinicalData/SubjectData/
  StudyEventData/FormData/
  ItemGroupData/ItemData/@ItemOID                 ->  observation_code (经映射)
/ODM/ClinicalData/SubjectData/
  StudyEventData/FormData/
  ItemGroupData/ItemData/@Value                   ->  value_numeric / value_string
/ODM/AdminData/User/
  AuditRecord/DateTimeStamp                       ->  extension.audit_timestamp
```

#### EDC受试者同步 REST API示例 (Medidata Rave)

**请求 - 获取受试者列表**:
```http
POST https://medidata-rave.example.com/RaveWebServices/webservice.aspx HTTP/1.1
Content-Type: text/xml

<ODM xmlns="http://www.cdisc.org/ns/odm/v1.3"
     xmlns:mdsol="http://www.mdsol.com/ns/odm/metadata"
     FileType="Transactional" FileOID="SUBJ-SYNC-20260201"
     CreationDateTime="2026-02-01T08:00:00+08:00">
  <ClinicalData StudyOID="STUDY_CTM_001"
                MetaDataVersionOID="MDV_1.0">
    <SubjectData SubjectKey="SITE001-001">
      <SiteRef LocationOID="SITE_001"/>
      <StudyEventData StudyEventOID="SCREENING"
                     StudyEventRepeatKey="1">
        <FormData FormOID="DM">
          <ItemGroupData ItemGroupOID="DM_DEMOG">
            <ItemData ItemOID="DM.BRTHDAT" Value="1965-01-15"/>
            <ItemData ItemOID="DM.SEX" Value="MALE"/>
            <ItemData ItemOID="DM.RACE" Value="ASIAN"/>
            <ItemData ItemOID="DM.ICFDAT" Value="2025-01-14"/>
          </ItemGroupData>
        </FormData>
      </StudyEventData>
    </SubjectData>
  </ClinicalData>
</ODM>
```

**解析逻辑**:
```java
public CdmPatient parseOdmToPatient(ODMDocument odm) {
    ClinicalData clinical = odm.getClinicalData();
    SubjectData subject = clinical.getSubjectData().get(0);

    CdmPatient patient = new CdmPatient();
    patient.setSourceSystem("EDC_MEDIDATA");
    patient.setSourceId("EDC-SUBJ-" + subject.getSubjectKey());
    patient.setSourceVersion(1);
    patient.setStudySubjectId(subject.getSubjectKey());
    patient.setSiteId(extractSiteId(subject));

    // 解析DM表单
    for (StudyEventData event : subject.getStudyEventData()) {
        for (FormData form : event.getFormData()) {
            if ("DM".equals(form.getFormOID())) {
                for (ItemGroupData ig : form.getItemGroupData()) {
                    for (ItemData item : ig.getItemData()) {
                        switch (item.getItemOID()) {
                            case "DM.BRTHDAT":
                                patient.setBirthYear(extractYear(item.getValue()));
                                break;
                            case "DM.SEX":
                                patient.setGender(mapEdcSex(item.getValue()));
                                break;
                            case "DM.RACE":
                                patient.setRace(mapEdcRace(item.getValue()));
                                break;
                            case "DM.ICFDAT":
                                patient.setInformedConsentDate(parseDate(item.getValue()));
                                break;
                        }
                    }
                }
            }
        }
    }
    return patient;
}
```

#### 受试者身份映射管理

```
EDC Subject ID <-> CTMS Study Subject ID 映射:

  EDC:     SITE001-001  (EDC中的SubjectKey)
  HIS:     PAT-00123456  (HIS中的Patient ID)
  CTMS:    SUBJ-001      (CTMS统一Study Subject ID)

CdmStudySubject.identity_mappings:
{
  "mappings": [
    {"system": "EDC", "system_subject_id": "SITE001-001", "study_id": "STUDY_CTM_001"},
    {"system": "HIS", "system_patient_id": "PAT-00123456", "site_id": "SITE_001"},
    {"system": "CTMS", "study_subject_id": "SUBJ-001"}
  ]
}
```

#### EDC适配器连接管理

| 配置项 | 说明 | 默认值 |
|--------|------|--------|
| edc_type | EDC系统类型 (MEDIDATA/VEEVA/ORACLE/MEDRIO/CSV) | - |
| edc_base_url | EDC API基础URL | - |
| edc_auth_type | 认证类型 | BASIC |
| edc_api_version | API版本 | 1.0 |
| odm_version | CDISC ODM版本 | 1.3.2 |
| study_oid_mapping | Study OID到CTMS Study ID的映射表 | 数据库配置表 |
| sync_interval_seconds | 同步间隔(秒) | 300 (5分钟) |
| max_subjects_per_sync | 单次同步最大受试者数 | 100 |
| crf_field_mapping | CRF字段到CDM的映射配置 | 研究级JSON配置文件 |
| query_sync_enabled | 是否同步质疑记录 | true |
| lock_status_sync_enabled | 是否同步锁定状态 | true |
### 7.3.10 eTMF适配器 (electronic Trial Master File)

**适配器标识**: ETMF_ADAPTER

**系统描述**: 电子试验主文件(eTMF)系统管理临床试验的必需文档，包括研究者文件、伦理批件、监管文件、SOPs等。主流eTMF系统包括Veeva Vault eTMF、Phlexglobal PhlexEview等。

#### 接口协议

| 协议 | 标准 | 方向 | 场景 |
|------|------|------|------|
| REST API | TMF Reference Model (XML/JSON) | eTMF -> CTMS | 文档元数据同步 |
| REST API | Custom JSON | eTMF <-> CTMS | 双向同步(里程碑、状态) |
| WebDAV | WebDAV Protocol | eTMF -> CTMS | 文件直接访问 |
| REST API | Binary Download | eTMF -> CTMS | 文档文件下载 |

#### TMF Reference Model映射

```
TMF Reference Model Artifact               CdmDocumentReference
===================================        =============================
Artifact ID (e.g., 01.01.01)            ->  etmf_artifact_id
Artifact Name (e.g., Investigator CV)   ->  doc_title
Zone (e.g., Zone 01: Study Management)  ->  etmf_zone
Sub-zone                                ->  extension.etmf_subzone
Section                                 ->  extension.etmf_section
Country / Site                          ->  site_id
Document Type                           ->  doc_type = 'ETMF_DOC'
Document Category                       ->  doc_category = 'TMF'
Document Version                        ->  version_no
Document Status (Draft/Final/Superseded) ->  doc_status
Document Date                           ->  creation_date
Author / Owner                          ->  author_name / author_org
File Reference                          ->  下载后存储为 minio_object_key
Hash (if available)                     ->  doc_hash
```

#### eTMF文档同步REST API示例 (Veeva Vault eTMF)

**请求 - 获取文档列表**:
```http
GET /api/v22.1/objects/documents?study__c=STUDY_CTM_001&limit=200 HTTP/1.1
Host: ctms-veeva.veevavault.com
Authorization: Bearer {session_token}
Accept: application/json
```

**响应**:
```json
{
  "responseStatus": "SUCCESS",
  "data": [
    {
      "id": "DOC-000123",
      "name__v": "01.01.01_Investigator_CV_v2.0",
      "title__v": "Investigator CV - 王医生",
      "document_type__v": "Investigator CV",
      "study__c": "STUDY_CTM_001",
      "site__c": "SITE_001",
      "etmf_artifact_id__c": "01.01.01",
      "etmf_zone__c": "01",
      "version__v": 2,
      "status__v": "final__v",
      "document_date__v": "2025-01-15",
      "author__c": "王医生",
      "file__v": "/files/DOC-000123_Investigator_CV_v2.0.pdf",
      "file_size__v": 245760,
      "file_hash__v": "sha256:a1b2c3d4e5f6..."
    }
  ]
}
```

#### eTMF里程碑同步

```
eTMF Milestone                          CTMS StudyMilestone / CdmDocumentReference
===================================     ==========================================
Milestone ID                         ->  source_id
Milestone Name (e.g., Site Initiation)-> milestone_name
Planned Date / Target Date           ->  planned_date
Actual Date / Completion Date        ->  actual_date
Status (Pending/In Progress/Complete)->  milestone_status
Related Document(s)                  ->  关联 CdmDocumentReference(多对多)
```

#### 文档版本同步流程

```
1. eTMF通知CTMS新文档/版本更新 (Webhook或批量API)
2. CTMS下载文档文件
3. CTMS计算文件SHA-256并与eTMF提供的hash比对
4. CTMS存储文件至MinIO:
   Bucket: ctms-etmf
   ObjectKey: {studyId}/{etmfZone}/{etmfArtifactId}/v{versionNo}/{fileName}
5. CTMS创建/更新CdmDocumentReference:
   - 旧版本标记: is_current_version = false, doc_status = 'SUPERSEDED'
   - 新版本: is_current_version = true, doc_status = 'FINAL'
   - replaced_doc_cdm_id 指向旧版本
6. CTMS检查里程碑完整性
```

#### eTMF适配器连接管理

| 配置项 | 说明 | 默认值 |
|--------|------|--------|
| etmf_type | eTMF系统类型 (VEEVA_VAULT/PHLEXGLOBAL/CUSTOM) | - |
| etmf_base_url | eTMF API基础URL | - |
| etmf_auth_type | 认证类型 (OAUTH2/SESSION/BASIC) | OAUTH2 |
| etmf_oauth2_token_url | OAuth2 Token URL | - |
| tmf_ref_model_version | TMF Reference Model版本 | 3.2.0 |
| artifact_mapping | Artifact ID到CTMS文档类型的映射表 | JSON配置文件 |
| zone_mapping | Zone到CTMS分类的映射表 | JSON配置文件 |
| sync_interval_seconds | 同步间隔 | 3600 (1小时) |
| max_docs_per_sync | 单次同步最大文档数 | 500 |
| file_download_enabled | 是否下载文件 | true |
| file_max_size_bytes | 文件最大下载大小 | 52428800 (50MB) |
| milestone_sync_enabled | 是否同步里程碑 | true |
| webhook_enabled | 是否接收Webhook通知 | false |
---

## 7.4 集成任务生命周期

### 7.4.1 状态机设计

集成任务(IntegrationTask)是CTMS内部追踪每次数据同步操作的持久化实体。每个IntegrationTask经历以下生命周期状态：

```
                    +----------+
                    |  PENDING  |
                    +----+-----+
                         |
                  [发布到RabbitMQ]
                         |
                    +----v-----+
                    |  QUEUED   |
                    +----+-----+
                         |
                  [消费者接收]
                         |
                    +----v-----+
                    | PROCESSING |
                    +----+------+
                         |
            +------------+-------------+------------+
            |            |              |            |
       [同步成功]   [业务异常]     [系统异常]    [数据无变更]
            |            |              |            |
       +----v----+  +----v-----+   +----v----+  +----v----+
       |COMPLETED|  | RETRYING |   | RETRYING|  | SKIPPED |
       +---------+  +----+-----+   +----+----+  +---------+
                         |              |
                  [指数退避重试]      |
                    (最多3次)         |
                         |              |
                 +----------------------+
                 |   max_retries=3 ?   |
                 +-------+-------------+
                         |
                   [超过最大重试次数]
                         |
                    +----v------+
                    |   FAILED   |
                    +----+-------+
                         |
                  [自动进入DLQ]
                         |
                    +----v---------+
                    | MANUAL_REVIEW |
                    +----+---------+
                         |
               +-----------+-----------+
               |                       |
          [管理员手动重试]      [管理员跳过]
               |                       |
          +----v----+             +----v----+
          | RESOLVED|             | SKIPPED |
          +---------+             +---------+
```

### 7.4.2 IntegrationTask 表结构

| 字段名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| task_id | BIGSERIAL | PK | 任务主键 |
| task_uuid | UUID | M | 任务全局唯一标识 |
| task_type | VARCHAR(50) | M | 任务类型 (SYNC_PATIENT/SYNC_ENCOUNTER/SYNC_OBSERVATION/SYNC_DIAGNOSTIC_REPORT/SYNC_MEDICATION/SYNC_AE/SYNC_DOCUMENT/SYNC_STUDY_SUBJECT/RECONCILIATION/COMPENSATION) |
| entity_type | VARCHAR(50) | M | CDM实体类型 (CDM_PATIENT/CDM_ENCOUNTER/CDM_OBSERVATION/...) |
| source_system | VARCHAR(50) | M | 源系统代码 |
| source_id | VARCHAR(100) | M | 源系统数据ID |
| entity_id | VARCHAR(100) | O | CDM实体ID（操作完成后回填） |
| study_id | VARCHAR(50) | O | 关联研究编号 |
| site_id | VARCHAR(50) | O | 关联中心编号 |
| parent_task_id | BIGINT | O | 父任务ID（用于子任务追踪） |
| correlation_id | VARCHAR(64) | M | 关联ID（同一业务操作的所有任务共享同一correlation_id） |
| status | VARCHAR(30) | M | 任务状态 (PENDING/QUEUED/PROCESSING/COMPLETED/SKIPPED/FAILED/RETRYING/MANUAL_REVIEW/RESOLVED) |
| retry_count | INTEGER | M | 当前重试次数 (default: 0) |
| max_retries | INTEGER | M | 最大重试次数 (default: 3) |
| priority | INTEGER | M | 优先级 (1=最高, 5=最低, default: 3) |
| payload | JSONB | M | 请求载荷(完整的数据交换内容) |
| result_payload | JSONB | O | 结果载荷(处理结果) |
| error_code | VARCHAR(50) | O | 错误代码 |
| error_message | TEXT | O | 错误详情 |
| error_stacktrace | TEXT | O | 错误堆栈 |
| queue_name | VARCHAR(100) | M | RabbitMQ队列名称 |
| routing_key | VARCHAR(100) | M | RabbitMQ路由键 |
| message_id | VARCHAR(100) | O | RabbitMQ消息ID |
| scheduled_time | TIMESTAMP | O | 计划执行时间 |
| start_time | TIMESTAMP | O | 开始执行时间 |
| end_time | TIMESTAMP | O | 结束时间 |
| duration_ms | BIGINT | O | 执行耗时(毫秒) |
| source_version | INTEGER | M | 源数据版本 |
| data_hash_before | VARCHAR(64) | O | 处理前数据指纹 |
| data_hash_after | VARCHAR(64) | O | 处理后数据指纹 |
| reviewer_id | BIGINT | O | 审核人ID |
| review_comment | TEXT | O | 审核意见 |
| review_time | TIMESTAMP | O | 审核时间 |
| compensation_task_id | BIGINT | O | 关联的补偿任务ID |
| create_time | TIMESTAMP | M | 创建时间 |
| update_time | TIMESTAMP | M | 更新时间 |

**索引设计**:
- idx_task_status ON (status) -- 任务状态查询
- idx_task_source ON (source_system, source_id) -- 溯源查询
- idx_task_entity ON (entity_type, entity_id) -- 按实体查任务
- idx_task_correlation ON (correlation_id) -- 关联任务查询
- idx_task_created ON (create_time) -- 按时间查询
- idx_task_parent ON (parent_task_id) -- 子任务查询

**唯一约束**: UNIQUE(source_system, source_id, entity_type, source_version) -- 同一版本不重复处理

### 7.4.3 任务类型定义

| task_type | 说明 | 触发方式 | 优先级 | 关联实体类型 |
|-----------|------|---------|--------|------------|
| SYNC_PATIENT | 同步患者人口学数据 | 自动(定时)/手动 | 2 | CDM_PATIENT |
| SYNC_ENCOUNTER | 同步就诊/访视数据 | 自动(定时)/手动 | 2 | CDM_ENCOUNTER |
| SYNC_OBSERVATION | 同步检查/检验结果 | 自动(定时)/手动 | 2 | CDM_OBSERVATION |
| SYNC_DIAGNOSTIC_REPORT | 同步诊断报告 | 自动(定时)/手动 | 3 | CDM_DIAGNOSTIC_REPORT |
| SYNC_MEDICATION | 同步用药记录 | 自动(定时)/手动 | 3 | CDM_MEDICATION_STATEMENT |
| SYNC_AE | 同步不良事件 | 自动(准实时) | 1 | CDM_ADVERSE_EVENT |
| SYNC_DOCUMENT | 同步文档/文件 | 自动(定时)/手动 | 3 | CDM_DOCUMENT_REFERENCE |
| SYNC_STUDY_SUBJECT | 同步研究-受试者关联 | 自动(准实时) | 1 | CDM_STUDY_SUBJECT |
| RECONCILIATION | 对账任务 | 自动(定时)/手动 | 4 | 多种 |
| COMPENSATION | 补偿同步任务 | 手动/半自动 | 3 | 多种 |
| DATA_RETRY | 手动重试任务 | 手动 | 3 | 多种 |

### 7.4.4 任务重试策略

```java
@Configuration
public class RetryPolicyConfig {

    /** 指数退避间隔: 30s, 5min, 30min **/
    private static final long[] RETRY_DELAYS_MS = {
        30_000,      // 第1次重试: 30秒后
        300_000,     // 第2次重试: 5分钟后
        1_800_000    // 第3次重试: 30分钟后
    };

    /** 最大重试次数 **/
    private static final int MAX_RETRIES = 3;

    /** 获取指定重试次数的延迟时间 **/
    public long getRetryDelay(int retryCount) {
        if (retryCount <= 0 || retryCount > RETRY_DELAYS_MS.length) {
            throw new IllegalArgumentException("Invalid retry count: " + retryCount);
        }
        return RETRY_DELAYS_MS[retryCount - 1];
    }

    /** 可重试的错误类型 **/
    public static final Set<String> RETRYABLE_ERRORS = Set.of(
        "NETWORK_TIMEOUT",
        "CONNECTION_REFUSED",
        "TEMPORARY_SERVICE_UNAVAILABLE",
        "DEADLOCK_DETECTED",
        "LOCK_WAIT_TIMEOUT",
        "RABBITMQ_CONNECTION_LOST",
        "RATE_LIMIT_EXCEEDED"
    );

    /** 不可重试的错误类型（直接标记为FAILED，进入MANUAL_REVIEW） **/
    public static final Set<String> NON_RETRYABLE_ERRORS = Set.of(
        "AUTHENTICATION_FAILED",
        "AUTHORIZATION_DENIED",
        "DATA_VALIDATION_FAILED",
        "ENCODING_MAPPING_NOT_FOUND",
        "BUSINESS_RULE_VIOLATION",
        "PATIENT_MATCHING_FAILED",
        "SOURCE_DATA_CORRUPTED"
    );
}
```

### 7.4.5 死信处理机制

RabbitMQ死信队列(DLX)配置：

```yaml
rabbitmq:
  dead_letter:
    exchange: ctms.integration.dlx
    queue: ctms.integration.dlq
    routing_key: dlq.{taskType}.{sourceSystem}
    message_ttl: 259200000  # 死信中保留3天 (毫秒)
    max_queue_length: 100000
    overflow: reject-publish-dlx
```

死信处理流程：

```
1. 任务进入DLQ后:
   a. 更新integration_task.status = 'FAILED'
   b. 创建 manual_review 记录
   c. 发送告警通知:
      - 钉钉/企业微信 (即时通知)
      - 邮件 (每日汇总)
      - 系统内消息通知

2. 手动评审操作:
   a. GET /api/integration/tasks/manual-review -- 列出所有待手动评审任务
   b. GET /api/integration/tasks/{taskId}/detail -- 查看具体错误详情
   c. POST /api/integration/tasks/{taskId}/retry -- 手动重试(重置retry_count, 重新发布)
   d. POST /api/integration/tasks/{taskId}/skip -- 跳过(标记SKIPPED, 说明原因)
   e. POST /api/integration/tasks/{taskId}/compensate -- 创建补偿任务

3. 手动重试API:
   POST /api/integration/tasks/{taskId}/retry
   {
     "reason": "问题已修复，手动重试",
     "reset_version": true
   }
```

### 7.4.6 任务补偿API

```java
@RestController
@RequestMapping("/api/integration/tasks")
public class IntegrationTaskController {

    /** 手动触发单个实体全量同步 **/
    @PostMapping("/sync/single")
    public ApiResponse<IntegrationTask> syncSingle(@RequestBody SyncSingleRequest req) {
        // req: {entityType, sourceSystem, sourceId}
        // 创建新的IntegrationTask, 发布到RabbitMQ
    }

    /** 手动触发批量同步 **/
    @PostMapping("/sync/batch")
    public ApiResponse<BatchSyncResult> syncBatch(@RequestBody SyncBatchRequest req) {
        // req: {entityType, sourceSystem, sourceIdList}
        // 批量创建IntegrationTask, 批量发布
    }

    /** 按站点全量同步 **/
    @PostMapping("/sync/site/{siteId}")
    public ApiResponse<SyncSummary> syncBySite(
            @PathVariable String siteId,
            @RequestParam ExternalSystemType systemType) {
        // 触发站点级全量同步
    }

    /** 查询任务状态 **/
    @GetMapping("/{taskId}")
    public ApiResponse<IntegrationTask> getTask(@PathVariable Long taskId) {
        // 返回任务详情
    }

    /** 查询任务历史 **/
    @GetMapping("/history")
    public ApiResponse<Page<IntegrationTask>> getTaskHistory(
            @RequestParam(required = false) String entityType,
            @RequestParam(required = false) String sourceSystem,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) LocalDateTime startTime,
            @RequestParam(required = false) LocalDateTime endTime,
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "20") int size) {
        // 分页查询任务历史
    }
}
```
---

## 7.5 对账与补偿

### 7.5.1 对账概述

对账引擎(Reconciliation Engine)是CTMS平台的数据一致性保障机制。它定期将CTMS中的数据与外部系统中对应数据进行对比，发现差异并触发补偿操作。

对账引擎的核心职责：
1. 定期自动运行(每日凌晨02:00)
2. 支持手动触发(管理界面一键对账)
3. 覆盖关键业务维度的数据一致性校验
4. 差异分级处理(自动/人工)
5. 补偿任务自动创建与追踪

### 7.5.2 对账类型与匹配规则

#### 对账类型1: 受试者数量对账 (Subject Count)

| 维度 | 说明 |
|------|------|
| 对账对象 | CTMS中的受试者数量 vs EDC中的受试者数量 vs 中心报告中的受试者数量 |
| 匹配规则 | 按study_id + site_id维度统计受试者数 |
| 期望关系 | CTMS.count >= EDC.count >= SiteReport.count |
| 允许偏差 | <5% (minor), 5-20% (significant), >20% (critical) |
| 数据来源 | CTMS: CdmStudySubject表 + CdmPatient表; EDC: EDC适配器拉取; Site: 站点管理员手动报告 |
| 差异分析 | 1) CTMS多而EDC少: EDC数据延迟同步; 2) CTMS少而EDC多: CTMS同步任务遗漏; 3) 与Site差异: Site报告不准确或数据延迟 |

```sql
-- 受试者数量对账SQL
SELECT 
    t.study_id,
    t.site_id,
    t.ctms_count,
    e.edc_count,
    ROUND(ABS(t.ctms_count - e.edc_count) * 100.0 / GREATEST(t.ctms_count, e.edc_count, 1), 2) AS variance_pct
FROM (
    SELECT study_id, site_id, COUNT(*) AS ctms_count
    FROM cdm_study_subject
    WHERE is_deleted = false
    GROUP BY study_id, site_id
) t
LEFT JOIN (
    SELECT study_id, site_id, jsonb_array_length(
        edc_recon_data->'subjects') AS edc_count
    FROM recon_temp_edc_subject
) e ON t.study_id = e.study_id AND t.site_id = e.site_id
WHERE ABS(t.ctms_count - e.edc_count) * 100.0 / GREATEST(t.ctms_count, e.edc_count, 1) > 0
```

#### 对账类型2: 访视数量对账 (Visit Count)

| 维度 | 说明 |
|------|------|
| 对账对象 | CTMS中的访视记录数 vs EDC中CRF提交数 |
| 匹配规则 | 按study_id + site_id + study_subject_id维度统计已完成/已提交的访视数 |
| 期望关系 | CTMS.visit_count 应 >= EDC.crf_submission_count (CTMS还可能含HIS就诊) |
| 数据来源 | CTMS: CdmEncounter表; EDC: EDC适配器获取CRF提交记录 |
| 差异分析 | 1) CTMS多:包含HIS来源的非EDC访视(正常); 2) CTMS少: EDC CRF未同步或关联断裂 |

```sql
-- 访视数量对账SQL
SELECT 
    t.study_id, t.site_id, t.study_subject_id,
    t.ctms_visit_count, e.edc_crf_count,
    ROUND(ABS(t.ctms_visit_count - e.edc_crf_count) * 100.0
        / GREATEST(t.ctms_visit_count, e.edc_crf_count, 1), 2) AS variance_pct
FROM (
    SELECT study_id, site_id, study_subject_id, COUNT(*) AS ctms_visit_count
    FROM cdm_encounter
    WHERE is_deleted = false AND visit_status IN ('COMPLETED', 'IN_PROGRESS')
    GROUP BY study_id, site_id, study_subject_id
) t
FULL OUTER JOIN (
    SELECT study_id, site_id, study_subject_id, jsonb_array_length(
        edc_recon_data->'crf_submissions') AS edc_crf_count
    FROM recon_temp_edc_crf
) e ON t.study_id = e.study_id 
   AND t.site_id = e.site_id 
   AND t.study_subject_id = e.study_subject_id
```

#### 对账类型3: SAE数量对账 (SAE Count)

| 维度 | 说明 |
|------|------|
| 对账对象 | CTMS中的SAE记录数 vs EDC中SAE表单数 vs 安全数据库中的SAE Case数 |
| 匹配规则 | 按study_id + site_id维度统计is_serious=true的AE记录 |
| 期望关系 | SafetyDB.count >= CTMS.count (安全数据库是SAE最终目的地) |
| 重要性级别 | CRITICAL -- SAE差异直接影响受试者安全 |
| 数据来源 | CTMS: CdmAdverseEvent表(is_serious=true); EDC: EDC适配器; SafetyDB: 安全数据库适配器 |

#### 对账类型4: 付款金额对账 (Payment Amount)

| 维度 | 说明 |
|------|------|
| 对账对象 | CTMS中的受试者付款金额 vs 财务系统中的付款金额 |
| 匹配规则 | 按study_id + site_id + study_subject_id维度按访视汇总付款 |
| 期望关系 | CTMS.payment_total = Finance.payment_total |
| 数据来源 | CTMS: 支付模块; Finance: 财务系统接口 |

### 7.5.3 对账调度配置

```yaml
reconciliation:
  schedule:
    cron: "0 0 2 * * ?"  # 每日凌晨02:00
    timezone: Asia/Shanghai
    on_demand_enabled: true  # 允许手动触发
  types:
    subject_count:
      enabled: true
      schedule: daily
      variance_threshold_pct: 5.0
    visit_count:
      enabled: true
      schedule: daily
      variance_threshold_pct: 5.0
    sae_count:
      enabled: true
      schedule: daily
      variance_threshold_pct: 0  # SAE不允许任何差异
    payment_amount:
      enabled: true
      schedule: weekly_on_monday
      variance_threshold_pct: 1.0
```

### 7.5.4 差异分类与处理

| 差异级别 | 定义 | 自动处理 | 告警方式 | 处理时效 |
|---------|------|---------|---------|---------|
| MINOR | 差异 < 5% | 自动确认(AUTO_ACKNOWLEDGE), 记录差异日志 | 仅记录, 不告警 | 无需立即处理 |
| SIGNIFICANT | 差异 5% - 20% | 创建对账差异任务(recon_discrepancy), 通知数据管理员 | 邮件 + 系统内通知 | 3个工作日内处理 |
| CRITICAL | 差异 > 20% 或涉及SAE | 创建对账差异任务, 立即通知研究团队 | 邮件 + 短信 + 系统内通知 | 24小时内处理 |

### 7.5.5 差异解决工作流

```
1. 对账引擎运行 -> 发现差异

2. 差异分级:
   - MINOR: 自动确认为'已知差异', 记录到recon_discrepancy_log表
   - SIGNIFICANT/CRITICAL: 进入人工评审流程

3. 人工评审界面:
   GET /api/reconciliation/discrepancies -- 列出所有未处理差异
   GET /api/reconciliation/discrepancies/{id} -- 查看差异详情
     
4. 评审操作:
   a. POST /api/reconciliation/discrepancies/{id}/acknowledge
      -- 确认差异(提供合理解释), 不触发补偿
   b. POST /api/reconciliation/discrepancies/{id}/compensate
      -- 触发补偿同步, 创建CompensationIntegrationTask
   c. POST /api/reconciliation/discrepancies/{id}/reclassify
      -- 重新分级(如果自动分级不准确)

5. 补偿执行:
   补偿任务进入标准IntegrationTask生命周期

6. 闭环验证:
   补偿任务完成后, 系统自动重新运行对账, 验证差异是否解决
```

### 7.5.6 补偿任务

补偿任务(Compensation Task)用于修复数据差异。根据差异类型自动生成对应的补偿操作：

| 差异场景 | 补偿操作 | 补偿task_type | 目标实体 |
|---------|---------|--------------|---------|
| 受试者缺失(CTMS无, EDC有) | 从EDC全量同步该受试者 | COMPENSATION | CDM_PATIENT, CDM_STUDY_SUBJECT |
| 受试者多余(CTMS有, EDC无) | 标记为inactive或软删除 | COMPENSATION | CDM_PATIENT |
| 访视缺失 | 从EDC同步该受试者的CRF记录 | COMPENSATION | CDM_ENCOUNTER |
| 检查结果缺失 | 按visit+observation_code全量同步 | COMPENSATION | CDM_OBSERVATION |
| SAE缺失 | 从EDC+安全数据库同步 | COMPENSATION | CDM_ADVERSE_EVENT |
| 数据版本不一致 | 带source_version强制覆盖同步 | COMPENSATION | 多种 |
| 付款金额不一 | 通知财务管理员手动核对 | MANUAL_RESOLVE | N/A |

**补偿任务表结构**:

| 字段名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| compensation_id | BIGSERIAL | PK | 补偿任务主键 |
| discrepancy_id | BIGINT | M | 关联的对账差异ID |
| integration_task_id | BIGINT | O | 关联的IntegrationTask ID |
| compensation_type | VARCHAR(50) | M | 补偿类型 |
| compensation_target | VARCHAR(100) | M | 补偿目标 (entity_type:source_system:source_id) |
| compensation_payload | JSONB | M | 补偿所需的完整数据载荷 |
| status | VARCHAR(30) | M | 状态 (PENDING/IN_PROGRESS/COMPLETED/FAILED) |
| result_summary | TEXT | O | 补偿结果摘要 |
| create_time | TIMESTAMP | M | 创建时间 |
| complete_time | TIMESTAMP | O | 完成时间 |
---

## 7.6 事件总线设计

### 7.6.1 RabbitMQ拓扑总览

```
                          CTMS Integration Event Bus
                         ===========================

  [外部系统适配器]          [内部消费者]            [管理工具]
       |                       |                       |
  +----v----+             +----v----+             +----v----+
  |Producer |             |Consumer |             |  Admin  |
  +----+----+             +----+----+             +----+----+
       |                       |                       |
       +-----------------------+-----------------------+
                               |
              +----------------v----------------+
              |   ctms.integration (topic)       |
              |   Exchange Type: topic           |
              |   Durable: true                  |
              |   Auto-delete: false             |
              +---------------+-----------------+
                              |
          +-------------------+-------------------+
          |                   |                   |
  +-------v-------+   +-------v-------+   +------v--------+
  | integration   |   | integration   |   | integration    |
  | .sync.*       |   | .recon.*      |   | .compensation.* |
  | Queues        |   | Queues        |   | Queues          |
  +-------+-------+   +-------+-------+   +-------+--------+
          |                   |                   |
  +-------v-------+   +-------v-------+   +------v--------+
  | DLX Queue     |   | DLX Queue     |   | DLX Queue      |
  | sync.dlq      |   | recon.dlq     |   | compensation   |
  |               |   |               |   | .dlq            |
  +---------------+   +---------------+   +----------------+
```

### 7.6.2 Exchange设计

| Exchange名称 | 类型 | Durable | 说明 |
|-------------|------|---------|------|
| ctms.integration | topic | true | 集成主交换机，所有集成事件通过此Exchange路由 |
| ctms.integration.dlx | topic | true | 死信交换机，接收过期的/被拒绝的消息 |
| ctms.integration.retry | direct | true | 重试交换机，用于延迟重试 |

### 7.6.3 路由键定义

路由键采用分层命名：`{domain}.{operation}.{targetSystem}.{targetId}`

#### 数据同步路由键

| 路由键模式 | 说明 | 示例 | 队列 |
|-----------|------|------|------|
| integration.sync.his.{siteId} | HIS数据同步 | integration.sync.his.SITE_001 | ctms.integration.sync.his |
| integration.sync.lis.{siteId} | LIS数据同步 | integration.sync.lis.SITE_001 | ctms.integration.sync.lis |
| integration.sync.pacs.{siteId} | PACS数据同步 | integration.sync.pacs.SITE_001 | ctms.integration.sync.pacs |
| integration.sync.emr.{siteId} | EMR数据同步 | integration.sync.emr.SITE_001 | ctms.integration.sync.emr |
| integration.sync.edc.{studyId} | EDC数据同步 | integration.sync.edc.STUDY_CTM_001 | ctms.integration.sync.edc |
| integration.sync.etmf.{studyId} | eTMF数据同步 | integration.sync.etmf.STUDY_CTM_001 | ctms.integration.sync.etmf |
| integration.sync.batch.{batchId} | 批量同步 | integration.sync.batch.BATCH-20260201 | ctms.integration.sync.batch |

#### 对账路由键

| 路由键模式 | 说明 | 示例 |
|-----------|------|------|
| integration.recon.subject-count | 受试者数量对账 | integration.recon.subject-count |
| integration.recon.visit-count | 访视数量对账 | integration.recon.visit-count |
| integration.recon.sae-count | SAE数量对账 | integration.recon.sae-count |
| integration.recon.payment-amount | 付款金额对账 | integration.recon.payment-amount |
| integration.recon.full.{studyId} | 研究级全量对账 | integration.recon.full.STUDY_CTM_001 |
| integration.recon.daily | 每日自动对账 | integration.recon.daily |

#### 补偿路由键

| 路由键模式 | 说明 | 示例 |
|-----------|------|------|
| integration.compensation.create | 创建补偿任务 | integration.compensation.create |
| integration.compensation.execute.{compTaskId} | 执行补偿任务 | integration.compensation.execute.1001 |
| integration.compensation.verify.{compTaskId} | 验证补偿结果 | integration.compensation.verify.1001 |

### 7.6.4 队列绑定策略

```
Exchange: ctms.integration (topic)
                                 
  Binding: integration.sync.his.*
    -> Queue: ctms.integration.sync.his
       x-single-active-consumer: false (每个站点可并行)
       x-max-priority: 10
       x-message-ttl: 3600000 (1小时)
       x-dead-letter-exchange: ctms.integration.dlx
       x-dead-letter-routing-key: dlq.sync.his

  Binding: integration.sync.lis.*
    -> Queue: ctms.integration.sync.lis
       x-single-active-consumer: false
       x-message-ttl: 3600000
       x-dead-letter-exchange: ctms.integration.dlx
       x-dead-letter-routing-key: dlq.sync.lis

  Binding: integration.sync.pacs.*
    -> Queue: ctms.integration.sync.pacs
       x-single-active-consumer: true (PACS不支持并发大量请求)
       x-message-ttl: 7200000 (2小时, 影像操作耗时较长)
       x-dead-letter-exchange: ctms.integration.dlx
       x-dead-letter-routing-key: dlq.sync.pacs

  Binding: integration.sync.emr.*
    -> Queue: ctms.integration.sync.emr
       x-single-active-consumer: false
       x-message-ttl: 3600000
       x-dead-letter-exchange: ctms.integration.dlx
       x-dead-letter-routing-key: dlq.sync.emr

  Binding: integration.sync.edc.*
    -> Queue: ctms.integration.sync.edc
       x-single-active-consumer: true (EDC API限流)
       x-max-priority: 10
       x-message-ttl: 3600000
       x-dead-letter-exchange: ctms.integration.dlx
       x-dead-letter-routing-key: dlq.sync.edc

  Binding: integration.sync.etmf.*
    -> Queue: ctms.integration.sync.etmf
       x-single-active-consumer: true (eTMF API通常有速率限制)
       x-message-ttl: 7200000 (文档下载耗时)
       x-dead-letter-exchange: ctms.integration.dlx
       x-dead-letter-routing-key: dlq.sync.etmf

  Binding: integration.recon.*
    -> Queue: ctms.integration.recon
       x-single-active-consumer: true (对账任务串行执行, 避免资源竞争)
       x-message-ttl: 86400000 (24小时)
       x-dead-letter-exchange: ctms.integration.dlx
       x-dead-letter-routing-key: dlq.recon

  Binding: integration.compensation.*
    -> Queue: ctms.integration.compensation
       x-single-active-consumer: false
       x-max-priority: 10
       x-message-ttl: 86400000
       x-dead-letter-exchange: ctms.integration.dlx
       x-dead-letter-routing-key: dlq.compensation
```

### 7.6.5 死信队列配置

```yaml
rabbitmq:
  dead_letter_queues:
    - name: ctms.integration.sync.dlq
      bindings:
        - dlq.sync.*
      arguments:
        x-message-ttl: 259200000  # 3天
        x-max-length: 100000
        x-overflow: reject-publish-dlx
    - name: ctms.integration.recon.dlq
      bindings:
        - dlq.recon
      arguments:
        x-message-ttl: 604800000  # 7天
        x-max-length: 10000
    - name: ctms.integration.compensation.dlq
      bindings:
        - dlq.compensation
      arguments:
        x-message-ttl: 259200000  # 3天
        x-max-length: 50000
```

### 7.6.6 消息重试配置

使用RabbitMQ的延迟插件(rabbitmq_delayed_message_exchange)或Per-Message TTL实现延迟重试：

```java
@Configuration
public class RetryRabbitConfig {
    
    /** 重试Exchange：使用延迟消息插件 **/
    @Bean
    public CustomExchange retryExchange() {
        Map<String, Object> args = new HashMap<>();
        args.put("x-delayed-type", "direct");
        return new CustomExchange("ctms.integration.retry", "x-delayed-message", true, false, args);
    }

    @Bean
    public Queue retryQueue() {
        return QueueBuilder.durable("ctms.integration.retry.queue"
            .withArgument("x-dead-letter-exchange", "ctms.integration")
            .build();
    }

    @Bean
    public RabbitTemplate rabbitTemplate(ConnectionFactory connectionFactory) {
        RabbitTemplate template = new RabbitTemplate(connectionFactory);
        
        // 发布确认
        template.setConfirmCallback((correlationData, ack, cause) -> {
            if (!ack) {
                log.error("Message publish failed: {}, cause: {}", correlationData.getId(), cause);
            }
        });
        
        // 返回回调
        template.setReturnsCallback(returned -> {
            log.error("Message returned: {} - {}", returned.getReplyCode(), returned.getReplyText());
        });
        
        template.setMandatory(true);
        return template;
    }
}
```

### 7.6.7 消息Schema定义

#### 同步消息Schema

```json
{
  "header": {
    "messageId": "550e8400-e29b-41d4-a716-446655440000",
    "messageType": "SYNC_REQUEST",
    "correlationId": "CORR-2026-02-01-001",
    "timestamp": "2026-02-01T08:00:00.000Z",
    "sourceSystem": "HIS_SITE_001",
    "targetEntity": "CDM_PATIENT",
    "version": "1.0",
    "priority": 2
  },
  "payload": {
    "entityType": "CDM_PATIENT",
    "operation": "UPSERT",
    "sourceSystem": "HIS_SITE_001",
    "sourceId": "HIS-PAT-123456",
    "sourceVersion": 3,
    "data": {
      "studySubjectId": "SUBJ-001",
      "screeningNo": "SCR-2024-001",
      "gender": "MALE",
      "birthYear": 1965,
      "ethnicity": "HAN",
      "region": "北京市",
      "country": "CHN",
      "siteId": "SITE_001",
      "studyId": "STUDY_CTM_001"
    },
    "dataHash": "sha256:a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0"
  },
  "metadata": {
    "retryCount": 0,
    "maxRetries": 3,
    "parentTaskId": null,
    "batchId": null
  }
}
```

#### 对账消息Schema

```json
{
  "header": {
    "messageId": "660f9511-f39c-42e5-b827-557760551111",
    "messageType": "RECONCILIATION_REQUEST",
    "correlationId": "RECON-DAILY-2026-02-01",
    "timestamp": "2026-02-01T02:00:00.000Z",
    "version": "1.0"
  },
  "payload": {
    "reconType": "SUBJECT_COUNT",
    "studyId": "STUDY_CTM_001",
    "siteIds": ["SITE_001", "SITE_002"],
    "referenceDate": "2026-02-01",
    "parameters": {
      "varianceThresholdPct": 5.0,
      "includeUnreviewedSubjects": false
    }
  },
  "metadata": {
    "triggeredBy": "SCHEDULER",
    "scheduleType": "DAILY"
  }
}
```

#### 补偿消息Schema

```json
{
  "header": {
    "messageId": "770ea622-g49d-53f6-c938-668871662222",
    "messageType": "COMPENSATION_REQUEST",
    "correlationId": "COMP-RECON-2026-02-01-003",
    "timestamp": "2026-02-01T09:00:00.000Z",
    "version": "1.0",
    "priority": 1
  },
  "payload": {
    "compensationType": "RE_SYNC_MISSING_ENTITY",
    "discrepancyId": 1001,
    "target": {
      "entityType": "CDM_PATIENT",
      "sourceSystem": "EDC_MEDIDATA",
      "sourceId": "EDC-SUBJ-SITE001-099",
      "studyId": "STUDY_CTM_001",
      "siteId": "SITE_001"
    },
    "syncParameters": {
      "forceSync": true,
      "overrideExisting": false,
      "includeChildEntities": true
    }
  },
  "metadata": {
    "triggeredBy": "ADMIN_USER_001",
    "compensationReason": "Subject count discrepancy: CTMS has 50, EDC has 51"
  }
}
```

### 7.6.8 消息生产者模板

```java
@Service
public class IntegrationMessageProducer {

    private final RabbitTemplate rabbitTemplate;
    private final ObjectMapper objectMapper;

    public IntegrationMessageProducer(RabbitTemplate rabbitTemplate, ObjectMapper objectMapper) {
        this.rabbitTemplate = rabbitTemplate;
        this.objectMapper = objectMapper;
    }

    /** 发布数据同步消息 **/
    public String publishSyncMessage(
            ExternalSystemType systemType,
            String targetId,
            CdmEntityType entityType,
            Object payload,
            int priority) {
        
        String routingKey = buildSyncRoutingKey(systemType, targetId);
        IntegrationMessage message = IntegrationMessage.builder()
            .header(MessageHeader.builder()
                .messageId(UUID.randomUUID().toString())
                .messageType("SYNC_REQUEST")
                .correlationId(generateCorrelationId())
                .timestamp(Instant.now())
                .sourceSystem(systemType.getCode())
                .targetEntity(entityType.name())
                .version("1.0")
                .priority(priority)
                .build())
            .payload(payload)
            .build();

        CorrelationData correlationData = 
            new CorrelationData(message.getHeader().getMessageId());

        rabbitTemplate.convertAndSend(
            "ctms.integration",
            routingKey,
            objectMapper.writeValueAsString(message),
            msg -> {
                msg.getMessageProperties().setPriority(priority);
                msg.getMessageProperties().setMessageId(message.getHeader().getMessageId());
                msg.getMessageProperties().setCorrelationId(message.getHeader().getCorrelationId());
                return msg;
            },
            correlationData
        );
        return message.getHeader().getMessageId();
    }

    private String buildSyncRoutingKey(ExternalSystemType systemType, String targetId) {
        return String.format("integration.sync.%s.%s", 
            systemType.getCode().toLowerCase(), targetId);
    }
}
```

### 7.6.9 消息消费者模板

```java
@Service
@Slf4j
public class IntegrationMessageConsumer {

    private final AdapterFactory adapterFactory;
    private final IntegrationTaskService taskService;

    @RabbitListener(queues = "ctms.integration.sync.his", 
                    concurrency = "3-10",
                    messageConverter = "jackson2JsonMessageConverter")
    public void handleHisSyncMessage(IntegrationMessage message, 
                                     @Header(AmqpHeaders.MESSAGE_ID) String msgId,
                                     @Header(AmqpHeaders.RECEIVED_ROUTING_KEY) String routingKey) {
        processSyncMessage("HIS", message, msgId, routingKey);
    }

    @RabbitListener(queues = "ctms.integration.sync.lis", concurrency = "3-10")
    public void handleLisSyncMessage(IntegrationMessage message, 
                                     @Header(AmqpHeaders.MESSAGE_ID) String msgId,
                                     @Header(AmqpHeaders.RECEIVED_ROUTING_KEY) String routingKey) {
        processSyncMessage("LIS", message, msgId, routingKey);
    }

    @RabbitListener(queues = "ctms.integration.sync.edc", concurrency = "1-3")
    public void handleEdcSyncMessage(IntegrationMessage message, 
                                     @Header(AmqpHeaders.MESSAGE_ID) String msgId,
                                     @Header(AmqpHeaders.RECEIVED_ROUTING_KEY) String routingKey) {
        processSyncMessage("EDC", message, msgId, routingKey);
    }

    private void processSyncMessage(String systemCode, IntegrationMessage message, 
                                    String msgId, String routingKey) {
        try {
            taskService.updateStatus(msgId, "PROCESSING");
            ExternalSystemAdapter adapter = adapterFactory.getAdapter(systemCode);
            CdmEntity result = adapter.toCdmEntity(message.getPayload().getData());
            taskService.saveCdmEntity(result);
            taskService.updateStatus(msgId, "COMPLETED");
        } catch (RetryableException e) {
            int retryCount = message.getMetadata().getRetryCount();
            if (retryCount < message.getMetadata().getMaxRetries()) {
                scheduleRetry(message, retryCount + 1);
            } else {
                sendToDlq(message, e);
            }
        } catch (NonRetryableException e) {
            sendToDlq(message, e);
        }
    }

    private void sendToDlq(IntegrationMessage message, Exception e) {
        taskService.updateStatus(message.getHeader().getMessageId(), "FAILED");
        taskService.createManualReview(message, e);
        sendAlert(message, e);
    }
}
```

### 7.6.10 Exchange/Queue/Binding配置总结

| 组件 | 名称 | 类型 | 绑定规则 | 特殊参数 |
|------|------|------|---------|---------|
| Exchange | ctms.integration | topic | N/A | durable=true |
| Exchange | ctms.integration.dlx | topic | N/A | durable=true |
| Exchange | ctms.integration.retry | x-delayed-message | N/A | x-delayed-type=direct |
| Queue | ctms.integration.sync.his | queue | integration.sync.his.* | TTL=1h, priority=10 |
| Queue | ctms.integration.sync.lis | queue | integration.sync.lis.* | TTL=1h, priority=10 |
| Queue | ctms.integration.sync.pacs | queue | integration.sync.pacs.* | TTL=2h, single-consumer |
| Queue | ctms.integration.sync.emr | queue | integration.sync.emr.* | TTL=1h |
| Queue | ctms.integration.sync.edc | queue | integration.sync.edc.* | TTL=1h, single-consumer, priority=10 |
| Queue | ctms.integration.sync.etmf | queue | integration.sync.etmf.* | TTL=2h, single-consumer |
| Queue | ctms.integration.recon | queue | integration.recon.* | TTL=24h, single-consumer |
| Queue | ctms.integration.compensation | queue | integration.compensation.* | TTL=24h, priority=10 |
| DLQ | ctms.integration.sync.dlq | queue | dlq.sync.* | TTL=3d, max-length=100K |
| DLQ | ctms.integration.recon.dlq | queue | dlq.recon | TTL=7d, max-length=10K |
| DLQ | ctms.integration.compensation.dlq | queue | dlq.compensation | TTL=3d, max-length=50K |
| Queue | ctms.integration.retry.queue | queue | # (retry exchange) | Dead-letter->ctms.integration |

### 7.6.11 监控与运维

```java
@Component
public class RabbitMQHealthIndicator implements HealthIndicator {

    private final RabbitTemplate rabbitTemplate;

    @Override
    public Health health() {
        try {
            // 检查连接
            Connection conn = rabbitTemplate.getConnectionFactory().createConnection();
            conn.close();

            // 检查声明式队列
            Map<String, QueueInformation> queues = rabbitAdmin.getQueueProperties();
            long deadLettered = queues.values().stream()
                .filter(q -> q.getName().contains("dlq"))
                .mapToLong(QueueInformation::getMessageCount)
                .sum();

            Health.Builder builder = Health.up()
                .withDetail("queues", queues.size())
                .withDetail("deadLetteredMessages", deadLettered);

            if (deadLettered > 1000) {
                builder.status(new Status("DEAD_LETTER_WARNING",
                    "High dead-letter count: " + deadLettered));
            }
            return builder.build();
        } catch (Exception e) {
            return Health.down(e).build();
        }
    }
}
```

### 7.6.12 消息追踪与可视化

所有消息通过`correlationId`追踪完整调用链：

```
1. 一个定时任务触发批量同步
   -> correlationId = "BATCH-2026-02-01-SITE_001"

2. 批量同步拆分为100条同步消息
   -> 每条消息复用相同的correlationId

3. 消息分别路由到不同的队列(his/lis/pacs)
   -> 消费者处理后更新IntegrationTask表

4. 管理界面通过correlationId查询:
   GET /api/integration/tasks/trace/{correlationId}
   -> 返回完整的任务树和每条消息的状态
```

**RabbitMQ管理API监控指标**:

| 指标 | API端点 | 说明 |
|------|---------|------|
| 各队列消息数 | GET /api/queues/{vhost}/{queue} | messages_ready, messages_unacknowledged |
| 消息速率 | GET /api/queues/{vhost}/{queue} | publish_details.rate, deliver_details.rate |
| 连接数 | GET /api/connections | 当前消费者/生产者连接数 |
| 消费者状态 | GET /api/consumers/{vhost} | 消费者详细信息 |
| 节点状态 | GET /api/nodes/{node} | 内存、磁盘、FD使用率 |

### 7.6.13 Spring Boot RabbitMQ配置

```yaml
spring:
  rabbitmq:
    host: ${RABBITMQ_HOST:localhost}
    port: ${RABBITMQ_PORT:5672}
    username: ${RABBITMQ_USER:ctms}
    password: ${RABBITMQ_PASSWORD:ctms_secret}
    virtual-host: ${RABBITMQ_VHOST:ctms_integration}
    # 连接池配置
    connection-timeout: 30000
    requested-heartbeat: 60
    # 发布确认
    publisher-confirm-type: correlated
    publisher-returns: true
    template:
      mandatory: true
      retry:
        enabled: true
        initial-interval: 2000ms
        max-attempts: 3
        multiplier: 2.0
    listener:
      simple:
        acknowledge-mode: manual
        prefetch: 50
        retry:
          enabled: false  # 使用应用层重试而非Spring Retry
        default-requeue-rejected: false
        concurrency: 3
        max-concurrency: 10

rabbitmq:
  delayed-exchange-enabled: true  # 需要安装rabbitmq_delayed_message_exchange插件
  monitor:
    alert-on-dlq-count: 500  # DLQ积压超过500条自动告警
    alert-on-consumer-down: true  # 消费者下线自动告警
    metrics-export-interval-seconds: 60  # 指标导出间隔
```

---

## 附录: 术语与缩写表

| 缩写 | 全称 | 说明 |
|------|------|------|
| CTMS | Clinical Trial Management System | 临床试验管理系统 |
| PMS | Project Management System | 项目管理系统 |
| CDM | Canonical Data Model | 规范数据模型 |
| FHIR | Fast Healthcare Interoperability Resources | HL7 FHIR标准 |
| HIS | Hospital Information System | 医院信息系统 |
| LIS | Laboratory Information System | 实验室信息系统 |
| PACS | Picture Archiving and Communication System | 影像归档和通信系统 |
| EMR | Electronic Medical Record | 电子病历 |
| EDC | Electronic Data Capture | 电子数据采集 |
| eTMF | electronic Trial Master File | 电子试验主文件 |
| HL7 | Health Level Seven | 医疗信息交换标准 |
| ADT | Admission, Discharge, Transfer | 入院/出院/转科 |
| ORU | Observation Result Unsolicited | 检查结果主动推送 |
| DICOM | Digital Imaging and Communications in Medicine | 医学数字成像和通信 |
| ODM | Operational Data Model | CDISC操作数据模型 |
| CDISC | Clinical Data Interchange Standards Consortium | 临床数据交换标准联盟 |
| LOINC | Logical Observation Identifiers Names and Codes | 实验室观察标识符名称和代码 |
| SNOMED CT | Systematized Nomenclature of Medicine Clinical Terms | 医学系统命名法-临床术语 |
| ATC | Anatomical Therapeutic Chemical | 解剖治疗化学分类系统 |
| MedDRA | Medical Dictionary for Regulatory Activities | 监管活动医学词典 |
| UCUM | Unified Code for Units of Measure | 统一计量单位代码 |
| ICD-10 | International Classification of Diseases, 10th Revision | 国际疾病分类第10版 |
| AE | Adverse Event | 不良事件 |
| SAE | Serious Adverse Event | 严重不良事件 |
| TEAE | Treatment Emergent Adverse Event | 治疗期间出现的不良事件 |
| CRF | Case Report Form | 病例报告表 |
| LLT | Lowest Level Term | MedDRA最低层级术语 |
| PT | Preferred Term | MedDRA首选术语 |
| SOC | System Organ Class | MedDRA系统器官分类 |
| DLQ | Dead Letter Queue | 死信队列 |
| DLX | Dead Letter Exchange | 死信交换机 |
| TTL | Time To Live | 消息存活时间 |
| PII | Personally Identifiable Information | 个人可识别信息 |
| SSS | Study Subject System | 研究受试者系统 |

---

## 附录B: 集成安全设计

### B.1 传输层安全

| 组件 | 安全方案 | 配置说明 |
|------|---------|---------|
| CTMS <-> 外部系统 | TLS 1.2/1.3 | 强制HTTPS, 禁用TLS 1.0/1.1 |
| CTMS <-> RabbitMQ | TLS 1.2 | 使用amqps://协议, 客户端证书双向认证 |
| CTMS <-> PostgreSQL | TLS 1.2 | SSL Mode=verify-full, 服务端证书验证 |
| CTMS <-> MinIO | TLS 1.2 | HTTPS上传/下载, 服务端加密(SSE-S3) |
| CTMS <-> OpenSearch | TLS 1.2 | HTTPS查询, Basic Auth + TLS |
| RabbitMQ Management UI | HTTPS + RBAC | 非生产环境建议限制内网访问 |

### B.2 数据安全

| 安全措施 | 实现方式 | 说明 |
|---------|---------|------|
| PII加密存储 | AES-256-GCM | extension字段中的PII数据加密存储 |
| PII传输加密 | TLS + JWE | PII字段在消息中JSON Web Encryption加密 |
| 凭证管理 | Spring Vault / K8s Secrets | 数据库密码、API Key等通过Vault注入 |
| 数据脱敏 | @Sensitive注解 + 脱敏Aspect | 日志输出自动脱敏姓名/ID/电话等 |
| 审计日志 | audit_log表 + 文件日志 | 所有数据访问和修改操作记录审计日志 |
| 数据保留 | 研究配置 retention_period_days | 研究结束后自动标记可清理数据 |
| 文件病毒扫描 | MinIO Bucket Notification + ClamAV | 上传文件自动触发病毒扫描 |

### B.3 访问控制

| 层级 | 控制方式 | 粒度 |
|------|---------|------|
| 适配器连接 | 站点级凭证隔离，每个站点独立凭证 | 站点 |
| RabbitMQ | vhost隔离(ctms_integration), 用户级ACL | 队列/Exchange |
| PostgreSQL | Schema级隔离, 角色级SELECT/INSERT/UPDATE/DELETE | 表/行 |
| MinIO | Bucket Policy + IAM Policy, 预签名URL + 过期时间 | 对象 |
| OpenSearch | Index Pattern + Document Level Security (DLS) | 索引/文档 |

---

## 附录C: 集成性能指标

### C.1 吞吐量目标

| 指标 | 目标值 | 测量方式 |
|------|--------|---------|
| 消息生产速率 | >= 500 msg/s (峰值) | RabbitMQ publish rate |
| 消息消费速率 | >= 200 msg/s (稳态) | RabbitMQ deliver rate |
| 单条消息处理延迟(P50) | < 500ms | IntegrationTask.duration_ms |
| 单条消息处理延迟(P99) | < 5000ms | IntegrationTask.duration_ms |
| 对账任务(1000受试者) | < 5min | ReconTask.duration_ms |
| 批量同步(100条数据) | < 30s | BatchTask.duration_ms |
| 文档下载(10MB文件) | < 60s | DocumentDownload.duration_ms |
| 影像缩略图生成 | < 3s | ThumbnailGeneration.duration_ms |

### C.2 可用性目标

| 指标 | 目标 | 说明 |
|------|------|------|
| RabbitMQ可用性 | 99.9% | 单节点故障不影响消息持久化 |
| 集成层可用性 | 99.5% | 适配器冗余, 自动故障转移 |
| 外部系统连接可用性 | 取决于外部系统 | 通过healthCheck持续监控 |
| 对账完成率 | > 99% | 对账任务不失败(差异本身不算失败) |

---

## 附录D: 部署拓扑

```
              [Internet / VPN]
                    |
         +----------+----------+
         |          |          |
    +----v----+ +---v----+ +---v----+
    | Site001 | |Site002 | |Site003 |
    | HIS/LIS | |HIS/LIS | |HIS/LIS |
    | PACS/EMR| |PACS/EMR| |PACS/EMR|
    +----+----+ +---+----+ +---+----+
         |          |          |
         +----------+----------+
                    |
         [DMZ / API Gateway]
                    |
         +----------+----------+
         |                     |
    +----v-----+        +-----v-----+
    |  CTMS    |        |   EDC     |
    |  App x3  |        | (Cloud)   |
    | (K8s)    |        | Medidata  |
    +----+-----+        | Veeva etc |
         |              +-----+-----+
    +----+----------+---------+----+
    |    |          |         |    |
 +--v--+ v  +-------v-+ +----v--+ v
 | PG  |    | RabbitMQ| | MinIO |
 |(HA) |    | (3 node)| |(Dist) |
 +-----+    +---------+ +-------+
```

**部署说明**:
- CTMS应用部署在Kubernetes集群，3副本冗余
- PostgreSQL主从复制，PITR备份
- RabbitMQ 3节点集群，镜像队列模式
- MinIO分布式部署，Erasure Code纠删码保护
- 各站点通过VPN/专线连接，确保HL7 MLLP通信稳定性
- EDC系统通常为SaaS云端部署，通过公网HTTPS访问

---

## 附录E: 常见问题与故障排查

### E.1 HIS连接失败

| 症状 | 原因 | 解决方案 |
|------|------|---------|
| MLLP端口拒绝连接 | 防火墙未开放2575端口 | 联系网络管理员开放端口 |
| HL7消息格式错误 | MSH段参数不匹配 | 检查发送方MSH-12(版本ID)是否与配置一致 |
| 患者匹配失败 | HIS患者ID无法关联到EDC Subject ID | 检查CdmStudySubject.identity_mappings, 手动建立映射 |
| MLLP消息未收到ACK | 网络延迟或发送方超时 | 检查网络延迟, 调整MLLP超时参数 |

### E.2 LIS编码映射缺失

| 症状 | 原因 | 解决方案 |
|------|------|---------|
| OBX-3编码在ConceptMap中找不到 | 新检验项目未配置映射 | 登录管理界面添加ConceptMap映射条目 |
| 单位无法转换 | 未配置单位转换规则 | 添加unit_conversion配置项 |
| 参考范围解析错误 | OBX-7格式不规范 | 配置该项目的reference_range_parse_mode为LITERAL |

### E.3 死信队列积压

| 症状 | 原因 | 解决方案 |
|------|------|---------|
| DLQ消息数 > 500 | 外部系统长时间不可用或数据批量异常 | 1.检查外部系统状态 2.暂停新消息生产 3.批量手动处理DLQ |
| 重复消息导致DLQ积压 | 幂等性约束违反 | 检查source_version是否正确递增, 修复版本号后重试 |
| 内存溢出导致消费停止 | JVM Heap不足 | 增加消费者JVM内存, 降低prefetch值 |

---

## 附录F: 集成测试策略

### F.1 测试层次

| 测试层 | 工具 | 覆盖范围 | 执行频率 |
|--------|------|---------|---------|
| 单元测试 | JUnit 5 + Mockito | 适配器映射逻辑、数据转换规则 | 每次提交 |
| 集成测试 | Testcontainers (PostgreSQL + RabbitMQ) | 消息发送/消费、数据库持久化、幂等性 | 每次提交 |
| 契约测试 | Pact / Spring Cloud Contract | 外部系统API契约验证 | 每次部署 |
| E2E测试 | Testcontainers + WireMock | 完整同步流程: 消息->适配器->CDM->持久化 | 每日 |
| 性能测试 | JMeter / Gatling | 吞吐量、延迟、资源使用 | 每周/按需 |
| 对账测试 | 手工构造测试数据 | 差异检测、分级、补偿 | 按需 |

### F.2 关键测试用例

```gherkin
Feature: HIS ADT消息处理

  Scenario: ADT^A01入院消息正确创建CdmPatient
    Given HIS Site001 发送ADT^A01消息
    When 消息被HIS适配器消费
    Then CdmPatient表中创建一条新记录
    And 性别字段映射为MALE
    And 出生年份为1965
    And source_system为HIS_SITE_001

  Scenario: 重复ADT^A01消息幂等性处理
    Given HIS Site001 发送相同source_id的ADT^A01消息
    And 该消息已成功处理过
    When 消息被HIS适配器消费
    Then 不会创建新的CdmPatient记录
    And 不会更新现有记录(data_hash一致)
    And 任务状态更新为SKIPPED

  Scenario: LIS ORU^R01检验结果正确映射
    Given LIS Central 发送ORU^R01血常规结果消息
    When 消息被LIS适配器消费
    Then CdmObservation表中创建4条记录(WBC/RBC/HGB/PLT)
    And 每条记录的observation_code为LOINC编码
    And WBC的value_numeric为7.5, value_unit为10^9/L
    And HGB的值在参考范围内, abnormal_flag为N

Feature: 对账引擎

  Scenario: 受试者数量对账发现差异
    Given CTMS中有50个受试者
    And EDC中有51个受试者
    When 对账引擎执行SUBJECT_COUNT对账
    Then 检测到1个差异
    And 差异百分比为2%(MINOR级别)
    And 自动确认为已知差异

  Scenario: SAE数量对账发现差异触发告警
    Given CTMS中有3个SAE记录
    And 安全数据库中有4个SAE Case
    When 对账引擎执行SAE_COUNT对账
    Then 差异级别为CRITICAL
    And 立即发送邮件和系统内告警
    And 创建manual_review任务
```

---

## 变更历史

| 版本 | 日期 | 作者 | 变更描述 |
|------|------|------|---------|
| 1.0.0 | 2026-05-11 | 集成架构团队 | 初始版本: CDM实体定义、FHIR映射、6个外部系统适配器、集成任务生命周期、对账与补偿、事件总线设计 |
