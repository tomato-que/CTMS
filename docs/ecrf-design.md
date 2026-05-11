# eCRF 任务管理与量表设计器 — 后端技术设计文档

> 项目：CTMS/PMS-Research | 日期：2026-05-11 | 技术栈：Java 21 + Spring Boot 3 + MyBatis Plus + MySQL 8.0 + Redis + RabbitMQ

---

## 一、模块功能拆解

### 1.1 eCRF 任务管理模块

| 子功能 | 核心职责 |
|--------|----------|
| 任务创建 | CRC/课题管理员选择受试者(Subject)、访视(Visit)、应填表单(FormDef)，生成 eCRF 任务(EcrfTask) |
| 表单填报 | 录入人员打开任务 → 动态渲染表单 → 填写数据 → 暂存草稿或正式提交 |
| 任务审核 | 审核人员(PI/CRC)查看填报数据 → 填写审核意见 → 通过/驳回。通过后锁定任务，驳回则退回录入中 |
| SDV 管理 | CRA 核对源数据与 eCRF 数据一致性 → 标记 SDV 完成/有差异 → 系统自动计算 SDV 完成率和平均耗时 |
| 任务列表 | 多条件筛选(受试者/访视/表单/状态/录入人)、排序、分页，支持导出 |
| 状态看板 | 实时的录入中/待审核/已锁定/SDV 完成等状态的汇总统计，进度条展示 |
| 审计追踪 | 所有状态变更、数据修改、审核操作、SDV 操作自动记录审计日志 |

### 1.2 eCRF 量表设计器模块

| 子功能 | 核心职责 |
|--------|----------|
| 组件库 | 基础字段(文本/数值/日期/单选/多选)、医疗专用(生命体征组/合并用药组/实验室检查组)的组件定义和元数据 |
| 设计画布 | 拖拽/点击添加组件 → 编排题目顺序 → 配置题目属性(必填/选项/校验规则/跳转逻辑) |
| 题目跳转 | 条件跳转逻辑配置(如"心功能等级=I级 → 跳到第5题")，运行时动态跳题 |
| 版本控制 | 量表新建→草稿→发布→修订(新建版本)→旧版废止。已发布版本不可修改，修改时创建新版本。支持版本回滚查看 |
| 量表发布 | 发布后量表进入可用状态，可被访视计划引用。已引用的版本在运行时不受新版本影响 |
| 审计追踪 | 量表创建、修改、发布、废止全流程留痕，符合 21 CFR Part 11 |

---

## 二、数据库核心表结构

### 2.1 动态表单存储策略

**选择 JSON 列 而非 EAV 模型。**

| 维度 | EAV 模型 | JSON 列 |
|------|----------|---------|
| 写入性能 | 单次填报产生 N 条 INSERT（N=题目数），事务开销大 | 单条 INSERT，一行一个表单答案 |
| 查询性能 | 需 JOIN + PIVOT，复杂的聚合查询难以优化 | MySQL 8.0 JSON 函数 + 虚拟列索引可高效查询 |
| 数据完整性 | 关系型约束难以应用 | JSON Schema 校验(Java端) + 审计对比 |
| 版本管理 | 表单变更后数据迁移复杂 | 新旧版本 JSON 并存，互不干扰 |
| 开发维护 | 表结构固定，逻辑在代码层 | 表单定义驱动，无需 ALTER TABLE |

> **理由**：临床试验表单版本频繁迭代，EAV 模型在查询、版本管理、迁移方面成本远高于 JSON。MySQL 8.0 的 JSON 类型 + 虚拟列 + 多值索引（8.0.17+）已能胜任。

### 2.2 核心表 DDL

```sql
-- ============================================================
-- 表单定义表（量表元数据）
-- ============================================================
CREATE TABLE ecrf_form_defs (
    id              VARCHAR(36)  NOT NULL PRIMARY KEY,
    study_id        VARCHAR(36)  NOT NULL,
    form_code       VARCHAR(50)  NOT NULL COMMENT '表单编码，如 ICF, PE, CONMED',
    form_name       VARCHAR(200) NOT NULL COMMENT '表单名称',
    form_category   VARCHAR(30)  NOT NULL DEFAULT 'GENERAL' COMMENT 'GENERAL/MEDICAL/LAB',
    version_number  INT          NOT NULL DEFAULT 1,
    status          VARCHAR(20)  NOT NULL DEFAULT 'DRAFT' COMMENT 'DRAFT/PUBLISHED/DEPRECATED',
    form_schema     JSON         NOT NULL COMMENT '表单结构定义(题目列表、跳转逻辑、校验规则)',
    published_at    DATETIME,
    published_by    VARCHAR(36),
    created_at      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    created_by      VARCHAR(36),
    updated_by      VARCHAR(36),
    is_deleted      TINYINT      NOT NULL DEFAULT 0,
    deleted_at      DATETIME,
    version         INT          NOT NULL DEFAULT 0,
    UNIQUE KEY uk_form_version (study_id, form_code, version_number),
    INDEX idx_form_status (study_id, status),
    INDEX idx_form_code (form_code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- form_schema JSON 示例：
-- {
--   "questions": [
--     {"id":"q1","type":"SINGLE_CHOICE","label":"心功能等级","options":[{"value":"I","label":"I级"},{"value":"II","label":"II级"}],"required":true,"order":1,"validation":{}},
--     {"id":"q2","type":"NUMERIC","label":"体重(kg)","unit":"kg","min":30,"max":200,"required":true,"order":2}
--   ],
--   "skip_logic": [
--     {"source_q":"q1","condition":{"operator":"eq","value":"I"},"target_q":"q5"},
--     {"source_q":"q1","condition":{"operator":"in","value":["II","III","IV"]},"target_q":"q3"}
--   ],
--   "groups": [
--     {"group_id":"g1","group_name":"生命体征","questions":["q2","q3","q4"]}
--   ]
-- }
```

```sql
-- ============================================================
-- eCRF 任务表
-- ============================================================
CREATE TABLE ecrf_tasks (
    id              VARCHAR(36)  NOT NULL PRIMARY KEY,
    study_id        VARCHAR(36)  NOT NULL,
    site_id         VARCHAR(36),
    subject_id      VARCHAR(36)  NOT NULL,
    visit_id        VARCHAR(36)  NOT NULL COMMENT '关联访视',
    form_def_id     VARCHAR(36)  NOT NULL COMMENT '关联表单定义(指定版本)',
    task_number     VARCHAR(50)  NOT NULL COMMENT '任务编号,如 TASK-001',
    status          VARCHAR(20)  NOT NULL DEFAULT 'DRAFT' COMMENT 'DRAFT/IN_PROGRESS/SUBMITTED/PENDING_REVIEW/APPROVED/LOCKED/REJECTED',
    sdv_status      VARCHAR(20)  DEFAULT NULL COMMENT 'NOT_STARTED/IN_PROGRESS/COMPLETED/DIFFERENCE_FOUND',
    assigned_to     VARCHAR(36)  COMMENT '录入人员',
    reviewer_id     VARCHAR(36)  COMMENT '审核人员',
    sdv_reviewer_id VARCHAR(36)  COMMENT 'SDV执行人(CRA)',
    submitted_at    DATETIME,
    locked_at       DATETIME,
    sdv_completed_at DATETIME,
    due_date        DATE         COMMENT '计划完成日期',
    priority        VARCHAR(10)  DEFAULT 'MEDIUM' COMMENT 'LOW/MEDIUM/HIGH/URGENT',
    created_at      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    created_by      VARCHAR(36),
    updated_by      VARCHAR(36),
    is_deleted      TINYINT      NOT NULL DEFAULT 0,
    deleted_at      DATETIME,
    version         INT          NOT NULL DEFAULT 0,
    INDEX idx_task_subject (subject_id),
    INDEX idx_task_visit (visit_id),
    INDEX idx_task_status (study_id, status),
    INDEX idx_task_sdv (study_id, sdv_status),
    INDEX idx_task_assigned (assigned_to, status),
    INDEX idx_task_due (due_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

```sql
-- ============================================================
-- 受试者填报答案表（JSON 存储）
-- ============================================================
CREATE TABLE ecrf_responses (
    id              VARCHAR(36)  NOT NULL PRIMARY KEY,
    task_id         VARCHAR(36)  NOT NULL COMMENT '关联任务',
    form_def_id     VARCHAR(36)  NOT NULL COMMENT '填写时的表单版本(用于追溯)',
    subject_id      VARCHAR(36)  NOT NULL,
    response_data   JSON         NOT NULL COMMENT '填报数据',
    status          VARCHAR(20)  NOT NULL DEFAULT 'DRAFT' COMMENT 'DRAFT/SUBMITTED',
    submitted_at    DATETIME,
    created_at      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    created_by      VARCHAR(36),
    updated_by      VARCHAR(36),
    is_deleted      TINYINT      NOT NULL DEFAULT 0,
    version         INT          NOT NULL DEFAULT 0,
    UNIQUE KEY uk_task_response (task_id),
    INDEX idx_response_subject (subject_id),
    INDEX idx_response_form (form_def_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- response_data JSON 示例：
-- {
--   "filled_at": "2026-05-11T10:30:00Z",
--   "filled_by": "CRC_Wang",
--   "answers": {
--     "q1": {"value": "I", "text": "I级"},
--     "q2": {"value": 72.5, "unit": "kg"}
--   }
-- }
-- 虚拟列索引：在 response_data 上创建虚拟列
-- ALTER TABLE ecrf_responses ADD COLUMN answer_q1 VARCHAR(50) GENERATED ALWAYS AS (response_data->>'$.answers.q1.value') VIRTUAL;
-- CREATE INDEX idx_answer_q1 ON ecrf_responses(answer_q1);
```

```sql
-- ============================================================
-- SDV 记录表
-- ============================================================
CREATE TABLE ecrf_sdv_records (
    id              VARCHAR(36)  NOT NULL PRIMARY KEY,
    task_id         VARCHAR(36)  NOT NULL,
    field_key       VARCHAR(100) NOT NULL COMMENT '核查字段, 如 answers.q1',
    source_value    TEXT         COMMENT '源数据值(来自原始病历/检验报告)',
    ecrf_value      TEXT         COMMENT 'eCRF 中录入的值',
    is_match        TINYINT      DEFAULT 1 COMMENT '1=一致, 0=不一致',
    difference_note TEXT,
    reviewer_id     VARCHAR(36),
    reviewed_at     DATETIME,
    created_at      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_sdv_task (task_id),
    INDEX idx_sdv_match (task_id, is_match)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

```sql
-- ============================================================
-- 审计日志表（复用现有 audit_logs 结构，增加 ecrf 相关列）
-- ============================================================
ALTER TABLE audit_logs ADD COLUMN module VARCHAR(30) DEFAULT NULL COMMENT 'ecrf_task/ecrf_form/ecrf_sdv';
ALTER TABLE audit_logs ADD COLUMN change_summary VARCHAR(500) DEFAULT NULL COMMENT '变更摘要，便于快速检索';
```

### 2.3 索引设计思路

| 表 | 索引策略 | 原因 |
|----|----------|------|
| ecrf_tasks | (study_id, status) 复合索引 | 最常用筛选：某试验下某状态的任务 |
| ecrf_tasks | (assigned_to, status) | CRC 查自己的待办 |
| ecrf_tasks | (due_date) | 逾期任务预警 |
| ecrf_responses | (task_id) UNIQUE | 一个任务一份答案 |
| ecrf_responses | JSON 虚拟列索引 | 高频查询字段(如受试者编号、关键指标值) |
| ecrf_sdv_records | (task_id) | SDV 记录按任务聚合 |
| audit_logs | (module, target_entity, created_at) | 按模块快速检索审计记录 |

---

## 三、API 接口清单

### 3.1 eCRF 任务管理 API

| 方法 | 路径 | 说明 | 关键参数 |
|------|------|------|----------|
| POST | `/api/v1/ecrf/tasks` | 创建任务 | `{subjectId, visitId, formDefId, assignedTo, dueDate}` |
| GET | `/api/v1/ecrf/tasks` | 任务列表(分页+筛选) | `?studyId=&status=&assignedTo=&subjectId=&page=&size=` |
| GET | `/api/v1/ecrf/tasks/{taskId}` | 任务详情 | 含表单定义+已填数据 |
| PUT | `/api/v1/ecrf/tasks/{taskId}/submit` | 提交填报 | `{responseData: {...}}` → status: SUBMITTED |
| PUT | `/api/v1/ecrf/tasks/{taskId}/review` | 审核 | `{action: APPROVE/REJECT, comment: "..."}` |
| PUT | `/api/v1/ecrf/tasks/{taskId}/sdv/start` | 启动 SDV | status: IN_PROGRESS |
| POST | `/api/v1/ecrf/tasks/{taskId}/sdv/field` | 核查单个字段 | `{fieldKey, sourceValue, ecrfValue, isMatch, note}` |
| PUT | `/api/v1/ecrf/tasks/{taskId}/sdv/complete` | 完成 SDV | → sdv_status: COMPLETED |
| GET | `/api/v1/ecrf/tasks/stats` | 状态看板 | `?studyId=` → `{total, draft, inProgress, submitted, pendingReview, locked, sdvRate, avgSdvDays}` |

### 3.2 eCRF 量表设计器 API

| 方法 | 路径 | 说明 | 关键参数 |
|------|------|------|----------|
| GET | `/api/v1/ecrf/forms/components` | 组件库 | 返回基础字段+医疗专用组件列表 |
| POST | `/api/v1/ecrf/forms` | 创建量表 | `{studyId, formCode, formName, formCategory}` |
| PUT | `/api/v1/ecrf/forms/{formDefId}` | 保存量表设计 | `{formSchema: {...}}` (覆盖) |
| PUT | `/api/v1/ecrf/forms/{formDefId}/publish` | 发布量表 | status: DRAFT → PUBLISHED |
| POST | `/api/v1/ecrf/forms/{formDefId}/clone` | 复制为新版本 | 自动 version_number+1, status=DRAFT |
| GET | `/api/v1/ecrf/forms/{formDefId}/versions` | 历史版本列表 | 返回该 form_code 的所有版本 |
| GET | `/api/v1/ecrf/forms/{formDefId}/versions/{version}` | 查看历史版本 | 返回指定版本的 form_schema |
| PUT | `/api/v1/ecrf/forms/{formDefId}/deprecate` | 废止版本 | status: PUBLISHED → DEPRECATED |

---

## 四、关键业务逻辑实现

### 4.1 eCRF 任务状态机

```
                    ┌─────────┐
                    │  DRAFT  │ ← CRC 创建任务(初始状态)
                    └────┬────┘
                         │ 录入人员开始填写
                    ┌────▼─────────┐
                    │ IN_PROGRESS  │ ← 草稿保存/填写中
                    └────┬─────────┘
                         │ 录入人员提交
                    ┌────▼─────────┐
                    │  SUBMITTED   │ ← 已提交, 待审核
                    └────┬─────────┘
                         │ PI/CRC 审核
              ┌──────────┼──────────┐
              │ 驳回                 │ 通过
         ┌────▼─────────┐     ┌─────▼────────┐
         │  REJECTED    │     │  APPROVED →  │
         │ (退回录入中)  │     │  LOCKED      │ ← 锁定, 不可修改
         └────┬─────────┘     └──────┬───────┘
              │                      │
              └──→ IN_PROGRESS       │ SDV 流程
                                    │
                    SDV: ┌───────────▼───────────┐
                         │ NOT_STARTED → IN_PROGRESS │
                         │ → COMPLETED / DIFFERENCE_FOUND │
                         └───────────────────────────────┘
```

**SDV 进度条计算（伪代码）：**

```java
// 定时任务(Redis缓存, 每5分钟刷新)
public SdvStats calculateSdvStats(String studyId) {
    String cacheKey = "sdv:stats:" + studyId;

    // 1. 已完成 SDV 的任务数
    Long completed = ecrfTaskMapper.selectCount(
        new LambdaQueryWrapper<EcrfTask>()
            .eq(EcrfTask::getStudyId, studyId)
            .eq(EcrfTask::getSdvStatus, "COMPLETED"));

    // 2. 总锁定任务数
    Long totalLocked = ecrfTaskMapper.selectCount(
        new LambdaQueryWrapper<EcrfTask>()
            .eq(EcrfTask::getStudyId, studyId)
            .eq(EcrfTask::getStatus, "LOCKED"));

    // 3. SDV 平均完成时间(天)
    Double avgDays = ecrfTaskMapper.selectObjs(
        new LambdaQueryWrapper<EcrfTask>()
            .eq(EcrfTask::getStudyId, studyId)
            .eq(EcrfTask::getSdvStatus, "COMPLETED")
            .select(EcrfTask::getLockedAt, EcrfTask::getSdvCompletedAt))
        .stream()
        .mapToDouble(row -> {
            LocalDateTime locked = (LocalDateTime) row[0];
            LocalDateTime sdvDone = (LocalDateTime) row[1];
            return ChronoUnit.HOURS.between(locked, sdvDone) / 24.0;
        })
        .average().orElse(0.0);

    SdvStats stats = new SdvStats(completed, totalLocked, avgDays);
    redisTemplate.opsForValue().set(cacheKey, stats, 5, TimeUnit.MINUTES);
    return stats;
}
```

### 4.2 量表版本控制实现

```
版本生命周期:
DRAFT → 修改保存 → DRAFT
DRAFT → 发布 → PUBLISHED (版本号锁定)
PUBLISHED → 克隆 → 新 DRAFT (version_number + 1)
PUBLISHED → 废止 → DEPRECATED
```

**核心实现：**

```java
@Service
public class FormVersionService {

    // 发布量表: 将当前版本设为 PUBLISHED, 不可再修改
    @Transactional
    public FormDef publish(String formDefId) {
        FormDef def = formDefMapper.selectById(formDefId);
        if (!"DRAFT".equals(def.getStatus())) {
            throw new BusinessException("仅 DRAFT 状态的量表可发布");
        }
        def.setStatus("PUBLISHED");
        def.setPublishedAt(LocalDateTime.now());
        formDefMapper.updateById(def);
        // 清除组件库缓存
        redisTemplate.delete("form:published:" + def.getStudyId());
        return def;
    }

    // 克隆新版本: 基于已发布版本创建草稿
    @Transactional
    public FormDef cloneNewVersion(String formDefId) {
        FormDef source = formDefMapper.selectById(formDefId);
        FormDef newVer = new FormDef();
        BeanUtils.copyProperties(source, newVer, "id", "version", "createdAt");
        newVer.setId(null);
        newVer.setVersionNumber(source.getVersionNumber() + 1);
        newVer.setStatus("DRAFT");
        newVer.setPublishedAt(null);
        formDefMapper.insert(newVer);
        return newVer;
    }

    // 热切换: 访视计划引用已发布版本, 新建任务时取最新 PUBLISHED 版本
    public FormDef getActiveForm(String studyId, String formCode) {
        return formDefMapper.selectOne(
            new LambdaQueryWrapper<FormDef>()
                .eq(FormDef::getStudyId, studyId)
                .eq(FormDef::getFormCode, formCode)
                .eq(FormDef::getStatus, "PUBLISHED")
                .orderByDesc(FormDef::getVersionNumber)
                .last("LIMIT 1"));
    }
}
```

**版本隔离策略**：`ecrf_tasks.form_def_id` 指向任务创建时的具体版本。已创建的任务不受量表更新影响——即使发布了新版本，旧任务依然使用旧版本的 `form_schema`。这是通过直接存储 `form_def_id` 实现的版本冻结（snapshot 模式）。

---

## 五、21 CFR Part 11 合规设计

### 5.1 需审计的操作

| 模块 | 操作 | 审计内容 |
|------|------|----------|
| 任务管理 | 创建任务 | 操作人/时间/受试者/表单/访视 |
| 任务管理 | 提交填报 | 操作人/时间/修改前后的 response_data |
| 任务管理 | 审核(通过/驳回) | 操作人/时间/审核意见/角色 |
| 任务管理 | SDV 核查 | 每个字段的 source_value vs ecrf_value / 是否一致 |
| 量表设计 | 创建量表 | 操作人/时间/表单编码 |
| 量表设计 | 修改 form_schema | 修改前后 form_schema 的 JSON diff |
| 量表设计 | 发布/废止 | 操作人/时间/版本号变化 |

### 5.2 Spring Boot AOP 审计实现

```java
@Target(ElementType.METHOD)
@Retention(RetentionPolicy.RUNTIME)
public @interface EcrfAudit {
    String module();          // "ecrf_task" / "ecrf_form" / "ecrf_sdv"
    String operation();       // "CREATE" / "SUBMIT" / "REVIEW" / "LOCK" / "PUBLISH"
    String targetEntity();    // "EcrfTask" / "FormDef"
}

@Aspect
@Component
public class EcrfAuditAspect {

    @Autowired private AuditLogService auditLogService;

    @Around("@annotation(audit)")
    public Object audit(ProceedingJoinPoint jp, EcrfAudit audit) throws Throwable {
        Object[] args = jp.getArgs();
        String targetId = extractId(args);
        Object before = fetchBefore(audit.targetEntity(), targetId);

        Object result = jp.proceed();

        Object after = fetchAfter(audit.targetEntity(), targetId);
        auditLogService.save(AuditLog.builder()
            .module(audit.module())
            .operationType(audit.operation())
            .targetEntity(audit.targetEntity())
            .targetId(targetId)
            .beforeValue(JsonUtil.toJson(before))
            .afterValue(JsonUtil.toJson(after))
            .userId(CurrentUser.get().getUserId())
            .ipAddress(RequestContext.getIp())
            .createdAt(LocalDateTime.now())
            .build());
        return result;
    }
}
```

### 5.3 电子签名

对审核操作和 SDV 完成操作，前端展示确认对话框（"我确认以上数据审核无误"），用户点击确认时，调用 `/api/v1/ecrf/tasks/{id}/review` 接口。后端记录 `reviewed_by`、`locked_at` 时间戳和审计日志，构成电子签名链。

---

## 六、性能与可扩展性

### 6.1 JSON 查询优化

```sql
-- 创建虚拟列索引（针对高频查询字段）
ALTER TABLE ecrf_responses
  ADD COLUMN answer_q2_value DECIMAL(10,2)
    GENERATED ALWAYS AS (response_data->>'$.answers.q2.value') VIRTUAL,
  ADD INDEX idx_q2_value (answer_q2_value);
```

### 6.2 百万级任务列表优化

| 策略 | 实现 |
|------|------|
| 覆盖索引 | `(study_id, status, assigned_to)` 避免回表 |
| 分页优化 | 游标分页替代 OFFSET：`WHERE id > ? ORDER BY id LIMIT 20` |
| Redis 缓存 | 状态统计(`ecrf:stats:{studyId}`) 5 分钟刷新，任务总数缓存在 Redis |
| 读写分离 | V2 阶段引入 Read Replica，列表查询走从库 |
| 归档 | 已完成+已锁定超过 1 年的任务历史数据归档到 `ecrf_tasks_archive` |

### 6.3 量表变更隔离

- **已创建任务不受影响**：`ecrf_tasks.form_def_id` 指向创建时的版本号。任务打开时加载的 `form_schema` 是该版本快照。
- **新建任务使用最新版**：`getActiveForm()` 始终返回最新 `PUBLISHED` 版本。
- **废弃版本标记**：`DEPRECATED` 不可用于新建任务，但已关联的历史任务仍可查看。

---

## 七、实施优先级

| 阶段 | 内容 | 周期 |
|------|------|------|
| P0 | 数据库表创建 + Flyway 迁移 | 1 天 |
| P0 | FormDef CRUD + 版本控制 API | 2 天 |
| P0 | EcrfTask CRUD + 状态机 + 简单录入 | 3 天 |
| P1 | 审核流程 + 锁定 + 审计 | 2 天 |
| P1 | SDV 流程 + 统计看板 | 2 天 |
| P2 | 量表设计器(动态表单渲染引擎) | 5 天 |
| P2 | 跳转逻辑 + 校验规则引擎 | 3 天 |
| P3 | 报表导出 + 离线归档 | 2 天 |
