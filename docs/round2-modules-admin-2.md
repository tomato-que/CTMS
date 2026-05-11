# PMS Admin Web Modules -- Round 2: M08-M14 Detailed Module Specifications

> **Document Version:** 2.0
> **Date:** 2026-05-11
> **Scope:** Admin Web 模块 M08 至 M14 详细设计说明
> **Tech Stack:** Java 21 + Spring Boot 3 + MyBatis Plus + Flowable / Next.js + TypeScript + Ant Design + React Query / PostgreSQL (UUIDv7, JSONB, soft-delete, UTC) / RabbitMQ / Redis / OpenSearch / MinIO
> **User Roles:** Admin, PM, CRA, CRC, PI, Sponsor, Finance, ReadOnlyAuditor

---

## 目录

| 编号 | 模块名称 | 说明 |
|------|----------|------|
| M08 | Query / Issue / Protocol Deviation / CAPA | 4 子模块：质量管理闭环 |
| M09 | AE / SAE / 安全上报与升级 | 2 子模块：不良事件全流程 |
| M10 | 文档中心 / 交付物 / 归档 | 单一模块：TMF 风格文档管理 |
| M11 | 预算 / 合同 / 中心付款 / 患者补贴 / 开票 / 对账 | 6 子模块：财务管理 |
| M12 | 消息 / 待办 / 周报 / 月报 / 自动摘要 | 单一模块：通知与报表 |
| M13 | 统计分析 / 入组预测 / 风险热力图 | 3 子模块：数据分析 |
| M14 | 系统配置 / 模板 / 字典 / 权限 / 审计 | 单一模块：系统管理 |

---


## M08: Query / Issue / Protocol Deviation / CAPA

### M08 模块概述

M08 将数据质疑管理、通用问题追踪、方案偏离记录、纠正与预防措施四大质量管理工具整合为统一的质量管理体系。四个子模块之间通过关联字段形成闭环：Query 可升格为 Issue，Issue 分析后触发 CAPA，ProtocolDeviation 的严重偏离可直接关联 CAPA。该模块是临床试验质量管理的核心中枢，直接影响研究数据的完整性和受试者安全。

**设计原则:**

1. **溯源完整性:** 所有记录从创建到关闭保留完整的审计轨迹，采用 append-only 事件溯源模式存储状态变更
2. **级联升级:** Query 逾期未答自动升级为 Issue，Issue 经根因分析后触发 CAPA 流程
3. **时限管控:** 所有记录自带 SLA 计时器，通过 RabbitMQ 延迟队列实现超时告警
4. **权限隔离:** 不同角色在同一个记录上拥有不同字段的读写权限，例如 CRA 可查看 CRC 的回复但不能修改

**关联架构图（逻辑）:**

```
Query (数据质疑)
  |
  +--[逾期升级]--> Issue (通用问题)
  |                    |
  |                    +--[根因分析]--> CAPA (纠正预防措施)
  |
  +--[关联]--> ProtocolDeviation (方案偏离)
                    |
                    +--[严重偏离]--> CAPA
```

---

### M08a: Query Management -- 数据质疑管理

**模块目标:** 管理源数据核查（SDV）和源数据审查（SDR）过程中发现的数据疑点，支持自动规则触发与人工创建双通道，确保数据质疑从提出到关闭的全生命周期可追溯。

**子功能清单:**

| 序号 | 子功能 | 描述 | 关键操作 |
|------|--------|------|----------|
| Q01 | 自动质疑生成 | 基于预定义规则（范围检查、逻辑校验、缺失值检测）自动生成 Query，规则引擎在数据录入/导入时触发 | 规则配置、触发日志查看、批量生成 |
| Q02 | 手动质疑创建 | CRA 在 SDV 过程中发现疑点后手动发起质疑，支持选择关联实体（Observation/Subject/Visit） | 新建 Query、关联实体选择、附件上传 |
| Q03 | 质疑回复 | CRC 针对质疑进行逐条回复，支持文本说明、数据修正引用、附件佐证 | 回复 Query、引用修正记录、状态回传 |
| Q04 | 质疑重开 | CRA 对不满意回复可重新打开质疑，要求 CRC 进一步说明或修正 | 重开 Query、附加重开原因、重开次数计数 |
| Q05 | 质疑老化监控 | 按天统计 Query 滞留时长（aging_days），超阈值自动升级告警 | 老化面板、SLA 看板、自动升级触发 |
| Q06 | 批量质疑处理 | 支持按 Site/Study/Visit 维度批量创建、批量关闭、批量导出 Query | 批量选择、批量操作、批量导出 Excel |
| Q07 | 质疑统计分析 | 按类型、站点、CRA/CRC 维度统计质疑数量、平均回复时长、重开率 | 趋势图、热力图、绩效排名 |

**核心交互流程:**

1. **Query 生成阶段:** 系统根据 EditCheck 规则在数据录入时自动生成 Query；或 CRA 在执行 SDV 时在数据核查界面手动创建 Query，选择质疑类型（范围错误/逻辑矛盾/缺失数据/异常值/其他），关联到具体的 Observation 记录、Subject 和 Visit
2. **Query 分配阶段:** 系统根据 Site 自动将 Query 分配给对应站点的 CRC 角色用户，同时向 CRC 的待办列表推送任务；若 Query 在 24 小时内未被认领，系统自动通知 Site 的 PI
3. **Query 通知阶段:** CRC 在待办列表中看到新 Query，系统同步发送 App 内通知和应用外通知（按配置），通知内容包含 Query ID、质疑描述、关联受试者、创建时间、SLA 倒计时
4. **CRC 响应阶段:** CRC 登录后进入 Query 详情页，查看质疑描述和关联数据；CRC 可选择：（a）直接回复文本说明；（b）修正源数据后回复并关联修正记录；（c）上传支持性文件（如实验室报告、病历扫描件）；（d）将 Query 转交给其他 CRC 或 PI 处理
5. **CRA 审核阶段:** CRA 收到回复通知后进入 Query 详情页，审查 CRC 的回复内容和可能的源数据修正；CRA 可选择：（a）确认满意并关闭 Query；（b）不满意回复，重新打开 Query 并附加重开原因
6. **重开处理循环:** Query 重开后，CRC 再次收到通知；系统记录重开次数（reopen_count），超过 3 次自动升级为 Issue 并通知 PM 介入
7. **自动关闭逻辑:** 若 CRA 在回复后 7 个自然日内未做任何操作，系统自动关闭 Query（可配置）；若 CRC 在规定时限（默认 5 个工作日）内未回复，系统自动升级告警
8. **老化监控:** 定时任务（每 30 分钟）扫描所有 open 状态的 Query，更新 aging_days 字段；aging_days > 14 的 Query 自动标记为 overdue，并推送到 PM 和 CRA Lead 的异常监控面板
9. **最终归档:** Query 关闭后状态不可再修改（除 ReadOnlyAuditor 外）；所有回复历史以 JSONB 格式存储在 query_history 字段中；研究归档时 Query 数据随研究一起锁定

**关键状态流转:**

| 当前状态 | 目标状态 | 触发动作 | 触发角色 | 前置条件 | 审计要求 |
|----------|----------|----------|----------|----------|----------|
| open | answered | CRC 提交回复 | CRC | Query 处于 open 状态，CRC 有该 Site 权限 | 记录回复内容、回复人、时间戳、IP |
| answered | closed | CRA 确认回复满意 | CRA | Query 处于 answered 状态，CRA 有该 Study 权限 | 记录关闭人、关闭时间、回复满意度标记 |
| answered | reopened | CRA 不满意回复 | CRA | Query 处于 answered 状态，reopen_count < 3 | 记录重开原因、重开次数、重开时间 |
| reopened | answered | CRC 再次回复 | CRC | Query 处于 reopened 状态 | 记录二次回复内容、回复时间 |
| open | overdue | 系统自动标记（定时任务） | System | aging_days > 14 且状态为 open | 记录进入 overdue 的时间戳 |
| overdue | answered | CRC 回复 | CRC | Query 处于 overdue 状态 | 记录超时回复、计算超时时长 |
| (any) | escalated | 自动/手动升级为 Issue | System/CRA | reopen_count >= 3 或 aging_days > 30 | 记录升级原因、关联 Issue ID、升级时间 |

**核心字段:**

| 字段 | 类型 | 必填 | 敏感级别 | 说明 |
|------|------|------|----------|------|
| query_id | UUIDv7 (PK) | 是 | 内部 | 主键，UUIDv7 保证时序性 |
| query_no | VARCHAR(32) | 是 | 内部 | 业务编号，格式 QRY-{STUDY}-{SEQ}，全局唯一 |
| query_type | VARCHAR(32) | 是 | 内部 | 质疑类型：RANGE_ERROR / LOGIC_ERROR / MISSING_DATA / OUTLIER / OTHER |
| category | VARCHAR(32) | 是 | 内部 | 分类：SDV / SDR / MEDICAL_REVIEW / STATISTICAL_REVIEW |
| description | TEXT | 是 | 内部 | 质疑描述，支持富文本，最大 2000 字符 |
| response | TEXT | 否 | 内部 | CRC 回复内容，支持富文本，最大 2000 字符 |
| status | VARCHAR(20) | 是 | 内部 | open / answered / reopened / overdue / closed / escalated |
| aging_days | INT | 是 | 内部 | 滞留天数，定时任务自动更新 |
| reopen_count | INT | 是 | 内部 | 重开次数，默认 0，每次 reopen 自增 |
| related_entity_type | VARCHAR(32) | 是 | 内部 | 关联实体类型：OBSERVATION / SUBJECT / VISIT / DOCUMENT |
| related_entity_id | UUIDv7 | 是 | 内部 | 关联实体主键 |
| related_study_id | UUIDv7 | 是 | 内部 | 关联研究 ID |
| related_site_id | UUIDv7 | 是 | 内部 | 关联站点 ID |
| related_subject_id | UUIDv7 | 否 | PII 关联 | 关联受试者 ID，间接关联 PII |
| created_by | UUIDv7 | 是 | 内部 | 创建人 ID（通常为 CRA） |
| assigned_to | UUIDv7 | 是 | 内部 | 被分配人 ID（通常为 CRC） |
| resolved_by | UUIDv7 | 否 | 内部 | 解决人 ID |
| sla_deadline | TIMESTAMPTZ | 是 | 内部 | SLA 截止时间，创建时根据 category 自动计算 |
| resolved_at | TIMESTAMPTZ | 否 | 内部 | 解决时间戳 |
| query_history | JSONB | 否 | 内部 | 完整操作历史 [{action, actor, timestamp, content}] |
| is_deleted | BOOLEAN | 是 | 内部 | 软删除标记，默认 false |
| created_at | TIMESTAMPTZ | 是 | 内部 | 创建时间，UTC |
| updated_at | TIMESTAMPTZ | 是 | 内部 | 更新时间，UTC |

**异常场景:**

| 场景 | 处理方式 | 用户提示 |
|------|----------|----------|
| Query 关联的 Observation 已被删除 | 标记 Query 为 invalid 状态，保留记录不删除 | "关联的数据记录已被删除，此质疑已自动标记为无效" |
| CRC 未在规定时间内回复（超时） | 自动升级告警，通知 PI 和 PM，Query 状态变更为 overdue | "质疑 QRY-XXX 已超时未回复（{N}天），已通知研究负责人" |
| 同一 Observation 重复创建 Query | 检查已存在 open 状态的 Query，提示用户合并或继续 | "该数据记录已存在一个开放状态的质疑（QRY-XXX），是否仍要创建新质疑？" |
| CRA 关闭 Query 但数据未实际修正 | 允许关闭（CRA 判断），但系统记录 warning 标记 | "该质疑关联的数据尚未被修正，确认关闭？" |
| 重开次数超过上限（3次） | 自动升级为 Issue，通知 PM 介入处理 | "该质疑已达最大重开次数（3次），已自动升级为问题工单（ISSUE-XXX）" |
| 批量操作时部分失败 | 事务内逐条处理，失败记录单独标记，成功的正常执行 | "批量操作完成：成功 {N} 条，失败 {M} 条。失败详情请查看操作日志" |
| 关联 Entity 跨 Site 权限 | 校验 assigned_to 的 CRC 与 related_site_id 一致 | "该质疑关联的站点与您的负责站点不匹配，无法回复" |
| Query 归档后尝试修改 | 当 Study 状态为 locked/archived 时禁止所有修改操作 | "该研究已归档，质疑记录不可修改" |

**权限要求:**

| 角色 | 查看 | 创建 | 编辑 | 删除 | 特殊权限 |
|------|------|------|------|------|----------|
| Admin | 全部 | 全部 | 全部 | 可硬删除 | 可批量重分配、修改任何字段 |
| PM | 管辖 Study | 管辖 Study | 管辖 Study | 否 | 可查看 Query 绩效统计、SLA 报表 |
| CRA | 管辖 Site | 管辖 Site | 仅自己创建的 | 仅自己创建的（未回复） | 可关闭/重开 Query，不可修改 CRC 回复 |
| CRC | 管辖 Site | 否 | 仅回复字段 | 否 | 仅可编辑 response 字段，不可修改 description |
| PI | 管辖 Site | 否 | 否 | 否 | 仅查看，可接收升级通知 |
| Sponsor | 管辖 Study（汇总） | 否 | 否 | 否 | 仅查看数量/类型/时效汇总，不可查看详情 |
| ReadOnlyAuditor | 全部（只读） | 否 | 否 | 否 | 完整审计查看权限，含 query_history |

**关联数据实体:** Observation, Subject, Visit, Study, Site, Issue (via escalation), AuditLog

**关联 REST API:**

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api/v1/queries | 分页查询 Query 列表，支持多条件筛选 |
| GET | /api/v1/queries/{queryId} | 获取 Query 详情，含 query_history |
| POST | /api/v1/queries | CRA 手动创建 Query |
| POST | /api/v1/queries/batch | 批量创建 Query（自动规则触发入口） |
| PUT | /api/v1/queries/{queryId}/respond | CRC 回复 Query |
| PUT | /api/v1/queries/{queryId}/close | CRA 关闭 Query |
| PUT | /api/v1/queries/{queryId}/reopen | CRA 重开 Query |
| PUT | /api/v1/queries/{queryId}/escalate | 手动升级 Query 为 Issue |
| PUT | /api/v1/queries/{queryId}/reassign | PM 重新分配 Query 给其他 CRC |
| GET | /api/v1/queries/aging-report | 获取 Query 老化分析报表 |
| GET | /api/v1/queries/statistics | 获取 Query 多维度统计数据 |
| POST | /api/v1/queries/batch-close | 批量关闭 Query |
| GET | /api/v1/queries/export | 导出 Query 列表（Excel/CSV） |

---
TEST APPEND LINE


### M08b: Issue Management -- 通用问题管理

**模块目标:** 追踪临床试验运营过程中发现的非数据类问题（流程问题、人员问题、系统问题、合规问题等），提供从问题识别、分诊、处理、审核到关闭的完整生命周期管理，并可通过根因分析触发 CAPA 流程。

**子功能清单:**

| 序号 | 子功能 | 描述 | 关键操作 |
|------|--------|------|----------|
| I01 | 问题登记 | 手工创建或从 Query 升级生成，支持分类和严重级别设定 | 新建 Issue、选择分类、设定严重级别 |
| I02 | 问题分诊 | PM/CRA Lead 对新问题进行分诊，指定处理人和优先级 | 分诊指派、优先级设定、截止日期设置 |
| I03 | 问题处理 | 处理人进行调查、制定解决方案、实施修复措施 | 方案记录、进展更新、附件上传 |
| I04 | 问题审核 | PM/CRA Lead 对处理结果进行审核，确认是否彻底解决 | 审核通过/驳回、要求补充信息 |
| I05 | 根因分析 | 对已关闭的问题进行根因分析，识别系统性风险 | 鱼骨图/5-Why 分析、根因分类、关联 CAPA |
| I06 | 问题关联 | 关联相关 Issue、Query、ProtocolDeviation，构建问题网络 | 关联关系图、父子问题链 |
| I07 | 趋势分析 | 按时间/类别/站点统计问题趋势，识别高风险领域 | 趋势图、Pareto 图、热力图 |

**核心交互流程:**

1. **问题创建阶段:** 问题来源有三：（a）人工在 Issue 管理界面手动创建，填写描述、分类、严重级别；（b）Query 自动升级（重开 3 次以上或超时 30 天），系统自动创建 Issue 并复制 Query 关键信息；（c）ProtocolDeviation 评审中发现系统性风险时，手动升格为 Issue
2. **问题分诊阶段:** Issue 创建后进入 triaged 状态，通知 PM 或 CRA Lead；PM/CRA Lead 在 Issue 详情页指定处理人（assigned_to）、设置优先级（P1/P2/P3/P4）、填写截止日期
3. **处理人分配通知:** 系统向被分配的处理人发送通知，包含 Issue 详情、优先级、截止日期；处理人在待办列表中可见该 Issue
4. **问题处理阶段:** 处理人进入 Issue 详情页，开始调查并记录：（a）问题描述确认/补充；（b）影响范围评估；（c）解决方案/处理措施；（d）处理进度更新（支持多次更新，每次更新以时间线展示）
5. **方案实施阶段:** 处理人实施解决方案，完成后更新 Issue 状态为 pending_review，同时填写 resolution（解决方案摘要）和 impact_assessment（影响评估）
6. **审核阶段:** PM/CRA Lead 收到审核通知后进入 Issue 详情页，审查处理结果；可选操作：（a）确认通过，关闭 Issue；（b）驳回并要求补充，状态退回 in_progress；（c）触发 CAPA 创建（当问题反映系统性缺陷时）
7. **CAPA 关联:** 若审核人判断需要 CAPA，系统在 Issue 详情页提供"创建 CAPA"快捷操作；创建后 Issue 与 CAPA 双向关联，Issue 在 CAPA 关闭前不可关闭
8. **问题关闭与归档:** Issue 关闭后状态变为 closed；系统记录完整的处理日志到 issue_history JSONB 字段；Issue 数据保留至研究归档后 5 年

**关键状态流转:**

| 当前状态 | 目标状态 | 触发动作 | 触发角色 | 前置条件 | 审计要求 |
|----------|----------|----------|----------|----------|----------|
| open | triaged | PM/CRA Lead 分诊指派 | PM / CRA Lead | Issue 有分类和严重级别 | 记录分诊人、时间、指派对象 |
| triaged | in_progress | 处理人开始处理 | 处理人(Assignee) | Issue 已指派且截止日期已设定 | 记录开始处理时间 |
| in_progress | pending_review | 处理人提交解决方案 | 处理人(Assignee) | resolution 字段非空 | 记录提交时间、方案摘要 |
| pending_review | closed | 审核人确认通过 | PM / CRA Lead | CAPA 已创建或不需要 CAPA | 记录审核人、关闭时间 |
| pending_review | in_progress | 审核人驳回 | PM / CRA Lead | 驳回原因非空 | 记录驳回原因、驳回时间 |
| any | escalated | 问题超时/手动升级 | System / PM | 超过截止日期 3 天或手动触发 | 记录升级原因、升级时间、通知升级对象 |
| triaged | cancelled | 问题重复或无效 | PM | 确认取消原因 | 记录取消原因，保留记录不删除 |

**核心字段:**

| 字段 | 类型 | 必填 | 敏感级别 | 说明 |
|------|------|------|----------|------|
| issue_id | UUIDv7 (PK) | 是 | 内部 | 主键 |
| issue_no | VARCHAR(32) | 是 | 内部 | 业务编号 ISSUE-{STUDY}-{SEQ} |
| title | VARCHAR(200) | 是 | 内部 | 问题标题，简明扼要 |
| description | TEXT | 是 | 内部 | 详细描述，支持富文本 |
| category | VARCHAR(32) | 是 | 内部 | 分类：PROCESS / PERSONNEL / SYSTEM / COMPLIANCE / OTHER |
| severity | VARCHAR(16) | 是 | 内部 | 严重级别：CRITICAL / MAJOR / MINOR / OBSERVATION |
| priority | VARCHAR(4) | 是 | 内部 | 优先级：P1(24h) / P2(3d) / P3(7d) / P4(14d) |
| status | VARCHAR(20) | 是 | 内部 | open / triaged / in_progress / pending_review / closed / escalated / cancelled |
| source_type | VARCHAR(32) | 是 | 内部 | 来源：MANUAL / QUERY_ESCALATION / DEVIATION_ESCALATION / OTHER |
| source_id | UUIDv7 | 否 | 内部 | 来源实体 ID（如 Query ID） |
| assigned_to | UUIDv7 | 否 | 内部 | 处理人 ID |
| assigned_by | UUIDv7 | 否 | 内部 | 分诊人 ID |
| resolution | TEXT | 否 | 内部 | 解决方案摘要 |
| root_cause | TEXT | 否 | 内部 | 根因分析结果 |
| root_cause_category | VARCHAR(32) | 否 | 内部 | 根因分类：HUMAN_ERROR / PROCESS_GAP / TRAINING / SYSTEM / OTHER |
| impact_assessment | TEXT | 否 | 内部 | 影响范围评估 |
| capa_id | UUIDv7 | 否 | 内部 | 关联 CAPA ID |
| related_study_id | UUIDv7 | 是 | 内部 | 关联研究 ID |
| related_site_id | UUIDv7 | 否 | 内部 | 关联站点 ID（非必填，部分 Issue 跨站点） |
| due_date | TIMESTAMPTZ | 否 | 内部 | 截止日期 |
| resolved_at | TIMESTAMPTZ | 否 | 内部 | 解决时间 |
| closed_at | TIMESTAMPTZ | 否 | 内部 | 关闭时间 |
| reopen_count | INT | 是 | 内部 | 驳回次数，默认 0 |
| issue_history | JSONB | 否 | 内部 | 操作历史 |
| attachments | JSONB | 否 | 内部 | 附件列表 [{file_id, file_name, uploaded_by, uploaded_at}] |
| related_issue_ids | UUID[] | 否 | 内部 | 关联 Issue ID 数组 |
| is_deleted | BOOLEAN | 是 | 内部 | 软删除 |
| created_by | UUIDv7 | 是 | 内部 | 创建人 |
| created_at | TIMESTAMPTZ | 是 | 内部 | 创建时间 |
| updated_at | TIMESTAMPTZ | 是 | 内部 | 更新时间 |

**异常场景:**

| 场景 | 处理方式 | 用户提示 |
|------|----------|----------|
| Issue 超过截止日期未处理 | 自动标记为 escalated 并通知 PM | "问题 ISSUE-XXX 已超过处理截止日期，已自动升级" |
| 关联的 Query 已被删除 | Issue 保留，source_id 置空，记录日志 | "关联的源记录已删除，此问题工单保留用于存档" |
| CAPA 创建后 Issue 被尝试关闭 | 阻止关闭操作 | "该问题已关联 CAPA（CAPA-XXX），请先完成 CAPA 流程后关闭" |
| 处理人无 Site 权限 | 阻止指派或提示风险 | "指定的处理人没有该站点的权限，确认指派？" |
| 重复创建相同 Issue | AI 相似度检测提醒 | "检测到可能存在重复问题工单（相似度 {X}%）：ISSUE-XXX" |
| 审核驳回超过 3 次 | 自动升级到 PM 负责人 | "该问题工单已被驳回 {N} 次，已通知项目经理处理" |

**权限要求:**

| 角色 | 查看 | 创建 | 编辑 | 删除 | 特殊权限 |
|------|------|------|------|------|----------|
| Admin | 全部 | 全部 | 全部 | 可硬删除 | 可修改任何字段、强制关闭 |
| PM | 管辖 Study | 管辖 Study | 管辖 Study | 否 | 可指派、审核、创建 CAPA |
| CRA Lead | 管辖 Study | 管辖 Study | 管辖 Study | 否 | 可指派、审核 |
| CRA | 管辖 Site | 管辖 Site | 仅自己创建的/被指派的 | 否 | 仅可处理被指派给自己的 Issue |
| CRC | 管辖 Site | 管辖 Site（仅限 PROCESS 类） | 仅自己创建的/被指派的 | 否 | 仅可查看和处理与自己相关的 Issue |
| PI | 管辖 Site | 否 | 否 | 否 | 仅查看 |
| Sponsor | 管辖 Study（汇总） | 否 | 否 | 否 | 仅查看 Issue 数量/类型汇总 |
| ReadOnlyAuditor | 全部（只读） | 否 | 否 | 否 | 完整审计查看权限 |

**关联数据实体:** Query, ProtocolDeviation, CAPA, Study, Site, AuditLog, User

**关联 REST API:**

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api/v1/issues | 分页查询 Issue 列表 |
| GET | /api/v1/issues/{issueId} | 获取 Issue 详情 |
| POST | /api/v1/issues | 创建 Issue |
| PUT | /api/v1/issues/{issueId}/triage | 分诊指派 |
| PUT | /api/v1/issues/{issueId}/start | 开始处理（状态 -> in_progress） |
| PUT | /api/v1/issues/{issueId}/submit | 提交审核（状态 -> pending_review） |
| PUT | /api/v1/issues/{issueId}/approve | 审核通过（状态 -> closed） |
| PUT | /api/v1/issues/{issueId}/reject | 审核驳回（状态 -> in_progress） |
| PUT | /api/v1/issues/{issueId}/escalate | 手动升级 |
| PUT | /api/v1/issues/{issueId}/cancel | 取消 Issue |
| POST | /api/v1/issues/{issueId}/link-capa | 关联 CAPA |
| GET | /api/v1/issues/{issueId}/history | 获取 Issue 操作历史 |
| GET | /api/v1/issues/statistics | 获取 Issue 趋势统计 |

---

### M08c: Protocol Deviation -- 方案偏离管理

**模块目标:** 记录和追踪临床试验过程中发生的所有方案偏离事件，提供 PI 评估和严重性分级机制，确保严重偏离得到及时处理和报告，并与 CAPA 模块联动以预防重复偏离。

**子功能清单:**

| 序号 | 子功能 | 描述 | 关键操作 |
|------|--------|------|----------|
| D01 | 偏离报告 | CRC/CRA 在发现偏离后填写偏离报告，包含偏离类型、描述、发生时间 | 新建偏离报告、选择偏离分类、时间记录 |
| D02 | PI 评估 | PI 对偏离进行严重性评估，判断是否为严重偏离（Critical） | PI 审核、严重性分级、影响评估 |
| D03 | 偏离审批 | PM/CRA Lead 对 PI 评估结果进行审批确认 | 审批通过/驳回、补充评估要求 |
| D04 | 严重性自动分级 | 系统根据预定义规则自动建议严重级别（minor/major/critical） | 规则匹配、自动标记、人工确认 |
| D05 | CAPA 联动 | 严重和重大偏离自动建议创建 CAPA | CAPA 创建快捷入口、双向关联 |
| D06 | 偏离统计分析 | 按类型/站点/时间统计偏离频率，识别高风险站点 | 偏离率统计、趋势分析、Pareto 图 |
| D07 | 偏离模板 | 常见偏离类型预设模板，加速报告填写 | 模板选择、快速填充、自定义模板 |

**核心交互流程:**

1. **偏离发现阶段:** 任何团队成员（CRA/CRC/PI/PM）发现偏离后均可发起偏离报告；报告人填写偏离基本信息：偏离类型（入排/用药/访视/样本/知情同意/其他）、偏离描述、发生日期、涉及受试者、发现途径
2. **自动分级建议:** 系统根据预配置的偏离分级规则，自动给出严重级别建议；规则示例：涉及受试者安全的 -> Critical；违反入排标准但未造成伤害 -> Major；文档日期填写错误 -> Minor
3. **通知 PI:** 偏离报告提交后，系统自动通知相关站点的 PI 进行评估；通知包含偏离报告详情和系统建议的严重级别
4. **PI 评估阶段:** PI 进入偏离详情页，审核偏离内容并进行评估：（a）确认或修改严重级别；（b）填写影响评估（impact_assessment），说明偏离对受试者安全和数据完整性的影响；（c）判断偏离是否需要报告伦理委员会/监管机构
5. **审批阶段（仅 Major/Critical）:** 若 PI 评估为 Major 或 Critical，偏离记录进入审批流程，通知 PM 或 CRA Lead 审批；Minor 偏离由 PI 评估后直接关闭
6. **PM 审批:** PM/CRA Lead 审查 PI 评估结果。可操作：（a）审批通过，偏离状态进入 closed；（b）驳回重新评估；（c）要求创建 CAPA
7. **CAPA 创建（Major/Critical）:** 对于 Major 和 Critical 偏离，系统在审批通过后自动询问是否需要创建 CAPA；若创建 CAPA，偏离记录与 CAPA 双向关联
8. **偏离关闭与归档:** 偏离关闭后状态不可修改；偏离信息汇总到研究的偏离日志中；研究结束时，所有偏离记录纳入最终研究报告
9. **统计分析:** 系统实时计算每个站点的偏离率（偏离次数/受试者数），偏离率超过阈值自动预警给 PM

**关键状态流转:**

| 当前状态 | 目标状态 | 触发动作 | 触发角色 | 前置条件 | 审计要求 |
|----------|----------|----------|----------|----------|----------|
| reported | assessed | PI 完成评估 | PI | 严重级别已确定、impact_assessment 非空 | 记录 PI 评估时间、评估意见 |
| assessed | approved | PM 审批通过（仅 Major/Critical） | PM / CRA Lead | PI 评估已完成 | 记录审批人、审批时间、审批意见 |
| assessed | closed | 自动关闭（Minor 偏离） | System | PI 评估为 Minor | 记录自动关闭时间 |
| approved | closed | PM 确认（Major/Critical） | PM | CAPA 已创建或不需要 CAPA | 记录最终关闭时间 |
| assessed | reported | PM 驳回 PI 评估 | PM | 驳回原因非空 | 记录驳回原因、驳回时间 |
| reported | cancelled | 报告人撤回/PM 取消 | 报告人/PM | 偏离尚未被 PI 评估 | 记录取消原因和时间 |

**核心字段:**

| 字段 | 类型 | 必填 | 敏感级别 | 说明 |
|------|------|------|----------|------|
| deviation_id | UUIDv7 (PK) | 是 | 内部 | 主键 |
| deviation_no | VARCHAR(32) | 是 | 内部 | 业务编号 DEV-{STUDY}-{SEQ} |
| deviation_type | VARCHAR(32) | 是 | 内部 | 偏离类型：INCLUSION_EXCLUSION / MEDICATION / VISIT / SAMPLE / CONSENT / SAFETY / OTHER |
| description | TEXT | 是 | 内部 | 偏离详细描述 |
| severity | VARCHAR(10) | 是 | 内部 | 严重级别：MINOR / MAJOR / CRITICAL |
| severity_suggested | VARCHAR(10) | 否 | 内部 | 系统建议严重级别 |
| status | VARCHAR(20) | 是 | 内部 | reported / assessed / approved / closed / cancelled |
| impact_assessment | TEXT | 否 | 内部 | PI 填写的影响评估 |
| reportable_to_ec | BOOLEAN | 是 | 内部 | 是否需要报告伦理委员会 |
| reportable_to_ra | BOOLEAN | 是 | 内部 | 是否需要报告监管机构 |
| occurrence_date | DATE | 是 | 内部 | 偏离发生日期 |
| discovered_by | UUIDv7 | 是 | 内部 | 发现人 ID |
| discovery_date | DATE | 是 | 内部 | 发现日期 |
| assessed_by | UUIDv7 | 否 | 内部 | PI 评估人 ID |
| assessed_at | TIMESTAMPTZ | 否 | 内部 | PI 评估时间 |
| approved_by | UUIDv7 | 否 | 内部 | 审批人 ID |
| approved_at | TIMESTAMPTZ | 否 | 内部 | 审批时间 |
| capa_id | UUIDv7 | 否 | 内部 | 关联 CAPA ID |
| related_study_id | UUIDv7 | 是 | 内部 | 关联研究 ID |
| related_site_id | UUIDv7 | 是 | 内部 | 关联站点 ID |
| related_subject_id | UUIDv7 | 否 | PII 关联 | 关联受试者 ID |
| related_visit_id | UUIDv7 | 否 | 内部 | 关联访视 ID |
| corrective_action | TEXT | 否 | 内部 | 已采取的纠正措施 |
| corrective_action_date | DATE | 否 | 内部 | 纠正措施完成日期 |
| attachments | JSONB | 否 | 内部 | 附件列表 |
| deviation_history | JSONB | 否 | 内部 | 操作历史 |
| is_deleted | BOOLEAN | 是 | 内部 | 软删除 |
| created_by | UUIDv7 | 是 | 内部 | 创建人 |
| created_at | TIMESTAMPTZ | 是 | 内部 | 创建时间 |
| updated_at | TIMESTAMPTZ | 是 | 内部 | 更新时间 |

**异常场景:**

| 场景 | 处理方式 | 用户提示 |
|------|----------|----------|
| PI 在 7 天内未完成评估 | 自动提醒 PI 和 PM，超 14 天自动升级 | "偏离 DEV-XXX 等待 PI 评估已 {N} 天，请及时处理" |
| 同一受试者同一访视重复偏离 | 系统检测相似性并提示 | "检测到同一受试者同一访视可能存在重复偏离报告" |
| Critical 偏离 CAPA 未创建 | 关闭时强制要求关联 CAPA 或提供豁免理由 | "严重偏离必须关联 CAPA 或提供豁免理由才能关闭" |
| 偏离关联的 CAPA 被关闭 | 自动同步检查，确保偏离已关闭 | 无用户提示（后台同步） |
| 报告人尝试修改已被评估的偏离 | 阻止修改描述和类型字段 | "该偏离报告已被 PI 评估，不允许修改核心字段" |
| 偏离涉及多站点 | 允许关联多个 Site ID | "该偏离涉及多个站点，请逐一选择" |

**权限要求:**

| 角色 | 查看 | 创建 | 编辑 | 删除 | 特殊权限 |
|------|------|------|------|------|----------|
| Admin | 全部 | 全部 | 全部 | 可硬删除 | 可修改任何字段 |
| PM | 管辖 Study | 管辖 Study | 管辖 Study（审批字段） | 否 | 可审批 Major/Critical 偏离 |
| CRA Lead | 管辖 Study | 管辖 Study | 管辖 Study（审批字段） | 否 | 可审批 Major/Critical 偏离 |
| CRA | 管辖 Site | 管辖 Site | 仅自己创建的（未评估前） | 否 | 可创建偏离报告 |
| CRC | 管辖 Site | 管辖 Site | 仅自己创建的（未评估前） | 否 | 可创建偏离报告 |
| PI | 管辖 Site | 管辖 Site | 管辖 Site（评估字段） | 否 | 可评估偏离、修改 severity 和 impact_assessment |
| Sponsor | 管辖 Study（汇总） | 否 | 否 | 否 | 仅查看偏离数量/类型汇总 |
| ReadOnlyAuditor | 全部（只读） | 否 | 否 | 否 | 完整审计查看权限 |

**关联数据实体:** CAPA, Subject, Visit, Study, Site, AuditLog

**关联 REST API:**

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api/v1/deviations | 分页查询偏离列表 |
| GET | /api/v1/deviations/{deviationId} | 获取偏离详情 |
| POST | /api/v1/deviations | 创建偏离报告 |
| PUT | /api/v1/deviations/{deviationId}/assess | PI 评估偏离 |
| PUT | /api/v1/deviations/{deviationId}/approve | PM 审批偏离 |
| PUT | /api/v1/deviations/{deviationId}/reject | PM 驳回偏离评估 |
| PUT | /api/v1/deviations/{deviationId}/cancel | 取消偏离报告 |
| POST | /api/v1/deviations/{deviationId}/link-capa | 关联 CAPA |
| GET | /api/v1/deviations/statistics | 偏离统计报表 |
| GET | /api/v1/deviations/export | 导出偏离列表 |

---

### M08d: CAPA -- 纠正与预防措施管理

**模块目标:** 管理纠正与预防措施（CAPA）的完整生命周期，从计划创建、审批、实施、验证到最终关闭，确保质量问题得到根本性解决，防止问题复发，形成质量管理闭环。

**子功能清单:**

| 序号 | 子功能 | 描述 | 关键操作 |
|------|--------|------|----------|
| C01 | CAPA 计划创建 | 基于 Issue/ProtocolDeviation 根因分析结果创建 CAPA 计划 | 新建 CAPA、关联根因、制定行动计划 |
| C02 | CAPA 审批流程 | 通过 Flowable 工作流引擎驱动 CAPA 审批流程 | 提交审批、多级审批、审批链配置 |
| C03 | 实施进度追踪 | 跟踪 CAPA 措施的实施进度，支持阶段性检查点 | 进度更新、检查点确认、附件上传 |
| C04 | 有效性检查 | CAPA 实施后定期进行有效性检查，验证措施是否防止问题复发 | 有效性检查计划、检查结果记录、再次触发 CAPA |
| C05 | CAPA 看板 | 可视化展示所有 CAPA 的状态、进度、SLA 剩余时间 | 看板视图、拖拽状态变更、筛选排序 |
| C06 | CAPA 时效监控 | 监控 CAPA 各阶段的 SLA 合规情况，超时自动告警 | SLA 倒计时、超时通知、时效分析报表 |
| C07 | CAPA 归档与查询 | 完整的 CAPA 历史记录查询和归档功能 | 高级搜索、历史对比、归档导出 |

**核心交互流程:**

1. **CAPA 创建阶段:** CAPA 有两种创建途径：（a）在 Issue 详情页或 ProtocolDeviation 详情页通过"创建 CAPA"快捷操作创建，系统自动复制根因信息；（b）在 CAPA 管理界面手动创建，手动关联相关 Issue/Deviation 并填写根因描述
2. **计划制定阶段:** CAPA 创建者（通常为 PM 或 QA）在 CAPA 详情页制定详细的行动计划：（a）填写根因分析结论（root_cause）；（b）制定纠正措施（corrective_action）；（c）制定预防措施（preventive_action）；（d）指定责任人和参与人；（e）设定实施截止日期；（f）设定有效性检查计划日期；（g）上传相关支持文件
3. **审批流程启动:** CAPA 计划制定完成后，提交进入审批流程；系统通过 Flowable 工作流引擎启动审批链：QA -> PM -> Sponsor 代表（如适用）；每级审批人可在审批界面查看 CAPA 详情并选择：通过 / 驳回 / 要求修改
4. **审批驳回处理:** 若任一级审批驳回，CAPA 状态退回 draft，创建者收到驳回通知和驳回原因；创建者修改 CAPA 计划后重新提交审批
5. **实施阶段:** 所有审批通过后，CAPA 状态变为 in_progress，责任人开始实施纠正措施和预防措施；责任人定期更新实施进度，上传实施证据（培训记录、SOP 更新截图、系统变更记录等）
6. **实施检查点:** 系统根据计划中设置的检查点日期自动提醒责任人更新进度；PM 可在实施过程中进行阶段性检查
7. **实施完成与验证:** 责任人完成所有措施后，更新 CAPA 状态为 implemented；QA 或 PM 在实施完成后启动有效性检查
8. **有效性检查:** 在预定检查日期，系统自动通知 QA 执行有效性检查；QA 进入 CAPA 详情页填写 effectiveness_check_result；结果可能是：（a）有效 - 问题不再复发，CAPA 可以关闭；（b）无效 - 问题仍然存在，需要重新开 CAPA 或修改计划
9. **CAPA 关闭:** 有效性检查通过后，CAPA 状态变为 closed；所有 CAPA 记录纳入质量管理档案；CAPA 数据用于后续的趋势分析和质量改进

**关键状态流转:**

| 当前状态 | 目标状态 | 触发动作 | 触发角色 | 前置条件 | 审计要求 |
|----------|----------|----------|----------|----------|----------|
| draft | submitted | 提交审批 | CAPA 创建者 | root_cause、action_plan 非空 | 记录提交时间、提交人 |
| submitted | approved | 所有审批人通过 | 审批链成员 | Flowable 审批链完成 | 记录每级审批人、时间、意见 |
| submitted | draft | 任一审批人驳回 | 审批链成员 | 驳回原因非空 | 记录驳回人、原因、时间 |
| approved | in_progress | 责任人确认开始实施 | 责任人 | CAPA 已通过审批 | 记录确认时间 |
| in_progress | implemented | 责任人完成所有措施 | 责任人 | 所有检查点已完成 | 记录完成时间、实施证据 |
| implemented | verified | QA 有效性检查确认 | QA | effectiveness_check_result 非空 | 记录检查人、时间、结果 |
| verified | closed | 系统自动关闭 | System | 有效性检查结果为"有效" | 记录关闭时间 |
| verified | in_progress | 有效性检查失败，重新实施 | QA | 有效性检查结果为"无效" | 记录重新打开原因、关联新 CAPA ID |
| (any) | cancelled | PM/QA 手动取消 | PM / QA | 取消原因非空 | 记录取消原因，保留完整历史 |

**核心字段:**

| 字段 | 类型 | 必填 | 敏感级别 | 说明 |
|------|------|------|----------|------|
| capa_id | UUIDv7 (PK) | 是 | 内部 | 主键 |
| capa_no | VARCHAR(32) | 是 | 内部 | 业务编号 CAPA-{STUDY}-{SEQ} |
| title | VARCHAR(200) | 是 | 内部 | CAPA 标题 |
| root_cause | TEXT | 是 | 内部 | 根因分析结论 |
| root_cause_category | VARCHAR(32) | 是 | 内部 | 根因分类：HUMAN_ERROR / PROCESS_GAP / TRAINING_DEFICIENCY / SYSTEM_ISSUE / RESOURCE / OTHER |
| corrective_action | TEXT | 是 | 内部 | 纠正措施（解决当前问题的措施） |
| preventive_action | TEXT | 是 | 内部 | 预防措施（防止问题复发的措施） |
| action_plan | JSONB | 否 | 内部 | 详细行动计划 [{step, description, owner, deadline, status}] |
| status | VARCHAR(20) | 是 | 内部 | draft / submitted / approved / in_progress / implemented / verified / closed / cancelled |
| priority | VARCHAR(4) | 是 | 内部 | 优先级 P1/P2/P3/P4 |
| source_type | VARCHAR(32) | 是 | 内部 | 来源类型：ISSUE / DEVIATION / AUDIT / MANUAL |
| source_id | UUIDv7 | 否 | 内部 | 来源实体 ID |
| responsible_person | UUIDv7 | 是 | 内部 | 责任人 ID |
| participants | UUID[] | 否 | 内部 | 参与人 ID 数组 |
| deadline | DATE | 是 | 内部 | 实施截止日期 |
| effectiveness_check_date | DATE | 否 | 内部 | 计划有效性检查日期 |
| effectiveness_check_result | TEXT | 否 | 内部 | 有效性检查结果 |
| effectiveness_check_by | UUIDv7 | 否 | 内部 | 有效性检查人 |
| effectiveness_check_at | TIMESTAMPTZ | 否 | 内部 | 有效性检查时间 |
| checkpoints | JSONB | 否 | 内部 | 实施检查点 [{name, deadline, completed_at, evidence}] |
| implementation_evidence | JSONB | 否 | 内部 | 实施证据 [{file_id, description, uploaded_at}] |
| related_study_id | UUIDv7 | 是 | 内部 | 关联研究 |
| related_site_id | UUIDv7 | 否 | 内部 | 关联站点 |
| flowable_process_instance_id | VARCHAR(64) | 否 | 内部 | Flowable 工作流实例 ID |
| capa_history | JSONB | 否 | 内部 | 操作历史 |
| is_deleted | BOOLEAN | 是 | 内部 | 软删除 |
| created_by | UUIDv7 | 是 | 内部 | 创建人 |
| created_at | TIMESTAMPTZ | 是 | 内部 | 创建时间 |
| updated_at | TIMESTAMPTZ | 是 | 内部 | 更新时间 |

**异常场景:**

| 场景 | 处理方式 | 用户提示 |
|------|----------|----------|
| CAPA 超过实施截止日期 | 自动通知责任人、PM 和 QA；超期 7 天后自动升级 | "CAPA-XXX 已超过实施截止日期 {N} 天，请立即处理" |
| 审批链中某审批人离职/不可用 | 自动升级到该审批人的上级或 PM 手动重新指派 | "审批人 {Name} 不可用，已自动升级到 {Manager}" |
| 有效性检查发现措施无效 | CAPA 从 verified 回到 in_progress，触发新的根因分析 | "有效性检查未通过，请重新分析根因并修改行动计划" |
| 同一问题来源多次触发 CAPA | 系统检测并提示可能存在更深层系统性问题 | "该问题来源已触发 {N} 个 CAPA，建议进行系统性审查" |
| 实施证据文件过期或不可访问 | 记录警告日志，通知责任人补充 | "部分实施证据文件不可访问，请重新上传" |
| Flowable 工作流异常中断 | 系统监控 Flowable 异常，自动重试或通知 Admin 手动修复 | "CAPA 审批流程异常，系统管理员已收到通知" |
| CAPA 关联的 Issue/Deviation 被删除 | CAPA 保留，source_id 置空，记录日志 | "关联的源记录已删除，CAPA 保留用于存档" |

**权限要求:**

| 角色 | 查看 | 创建 | 编辑 | 删除 | 特殊权限 |
|------|------|------|------|------|----------|
| Admin | 全部 | 全部 | 全部 | 可硬删除 | 可修改任何字段、重新触发工作流 |
| PM | 管辖 Study | 管辖 Study | 管辖 Study | 否 | 可审批 CAPA、有效性检查 |
| QA | 全部 | 全部 | 全部 | 否 | 可审批 CAPA、执行有效性检查、修改任何 CAPA |
| CRA Lead | 管辖 Study | 管辖 Study | 管辖 Study（实施阶段） | 否 | 可查看、可审批 |
| CRA | 管辖 Site | 否 | 仅被指派为责任人的 | 否 | 仅可更新实施进度 |
| CRC | 管辖 Site | 否 | 仅被指派为参与人的 | 否 | 仅可查看和更新被指派的进度 |
| PI | 管辖 Site | 否 | 否 | 否 | 仅查看 |
| Sponsor | 管辖 Study（汇总） | 否 | 否 | 否 | 仅查看 CAPA 数量和状态汇总 |
| ReadOnlyAuditor | 全部（只读） | 否 | 否 | 否 | 完整审计查看权限 |

**关联数据实体:** Issue, ProtocolDeviation, Study, Site, AuditLog, User

**关联 REST API:**

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api/v1/capas | 分页查询 CAPA 列表 |
| GET | /api/v1/capas/{capaId} | 获取 CAPA 详情 |
| POST | /api/v1/capas | 创建 CAPA |
| PUT | /api/v1/capas/{capaId}/submit | 提交审批（启动 Flowable 工作流） |
| PUT | /api/v1/capas/{capaId}/approve | 单级审批通过 |
| PUT | /api/v1/capas/{capaId}/reject | 单级审批驳回 |
| PUT | /api/v1/capas/{capaId}/start-implementation | 开始实施 |
| PUT | /api/v1/capas/{capaId}/update-progress | 更新实施进度 |
| PUT | /api/v1/capas/{capaId}/complete-implementation | 完成实施 |
| PUT | /api/v1/capas/{capaId}/effectiveness-check | 有效性检查 |
| PUT | /api/v1/capas/{capaId}/close | 关闭 CAPA |
| PUT | /api/v1/capas/{capaId}/cancel | 取消 CAPA |
| GET | /api/v1/capas/{capaId}/history | 获取 CAPA 操作历史 |
| GET | /api/v1/capas/kanban | 获取 CAPA 看板数据 |
| GET | /api/v1/capas/sla-report | 获取 CAPA SLA 合规报表 |
| GET | /api/v1/capas/export | 导出 CAPA 列表 |

---


## M09: AE / SAE / 安全上报与升级

### M09 模块概述

M09 是临床试验药物安全管理的核心模块，覆盖不良事件（AE）和严重不良事件（SAE）的完整生命周期。模块遵循 ICH E2A/E2B 指南和 GCP 规范，提供从事件发现、记录、医学评估、因果关系判断到监管报告的标准化流程。AE 和 SAE 之间存在级联关系：AE 一旦符合严重性标准（seriousness_criteria），立即触发 SAE 升级流程。该模块对受试者安全保护至关重要，权限控制严格，Sponsor 只能看到盲态汇总数据。

**设计原则:**

1. **GCP 合规优先:** 所有流程严格按照 ICH GCP E6(R3) 和 NMPA 安全报告要求设计
2. **时效性强制:** SAE 报告有严格的法律时限（24h 初报/7d 随访/15d 终报），系统通过 RabbitMQ 延迟队列严格监控
3. **盲态保护:** 在盲法研究中，AE/SAE 数据对 Sponsor 访问进行盲态过滤，必要时触发紧急揭盲流程
4. **MedDRA 编码:** 所有 AE/SAE 事件术语必须经过 MedDRA 编码，系统内置 MedDRA 浏览器支持自动编码和人工复核
5. **SUSAR 识别:** 系统自动根据 expectedness + causality 的组合判断是否为 SUSAR（Suspected Unexpected Serious Adverse Reaction）

**AE 与 SAE 的关系:**

```
AE (不良事件)
  |
  +--[严重性评估]--> SAE (严重不良事件)
  |                    |
  |                    +--[预期性+因果]--> SUSAR (非预期严重不良反应)
  |                    |
  |                    +--[监管报告]--> 24h/7d/15d 时限报告
  |
  +--[结局追踪]--> resolved / resolving / not_recovered / fatal
```

---

### M09a: AE Management -- 不良事件管理

**模块目标:** 提供不良事件（Adverse Event）的标准化记录、CTCAE 严重程度分级、因果关系评估和结局追踪功能，支持在盲法研究中对 Sponsor 进行数据遮蔽，并能在事件符合严重性标准时自动触发 SAE 升级流程。

**子功能清单:**

| 序号 | 子功能 | 描述 | 关键操作 |
|------|--------|------|----------|
| AE01 | AE 记录与编码 | CRC/PI 记录 AE 基本信息，系统辅助 MedDRA 编码 | AE 新建、MedDRA 术语搜索、自动编码建议 |
| AE02 | CTCAE 分级 | 按照 CTCAE v5.0 标准对 AE 进行 1-5 级严重程度分级 | 分级选择、分级标准查阅、历史分级对比 |
| AE03 | 因果关系评估 | PI 评估研究药物与 AE 之间的因果关系（related/possibly/unlikely/unrelated） | 因果关系选择、评估依据填写、多药物分别评估 |
| AE04 | 严重性筛查 | 系统自动检查 AE 是否符合 SAE 严重性标准 | 自动筛查、SAE 升级触发、升级提醒 |
| AE05 | AE 结局追踪 | 持续追踪 AE 的结局状态直到受试者恢复或研究结束 | 结局更新、恢复日期记录、后遗症记录 |
| AE06 | 伴随用药关联 | 记录 AE 发生时受试者的伴随用药情况，辅助因果判断 | 伴随用药选择、时间线展示、交互作用提示 |
| AE07 | AE 汇总报告 | 按研究/站点生成 AE 汇总表，支持 CSR（临床研究报告）输出 | 汇总表生成、发生率计算、MedDRA SOC 分组 |
| AE08 | 盲态数据遮蔽 | 在盲法研究中，Sponsor 用户只能看到汇总级别的 AE 数据 | 自动遮蔽、遮蔽日志、紧急揭盲流程 |

**核心交互流程:**

1. **AE 发现与记录:** 研究相关人员（CRC/PI/CRA）发现受试者发生不良事件后，在 AE 管理界面创建 AE 记录；填写事件术语（ae_term，自由文本）、发生日期（onset_date）、结束日期（如有）、是否为 SAE（初步判断）等基本信息
2. **MedDRA 自动编码:** 系统对输入的 ae_term 自动调用 MedDRA 编码引擎，返回推荐的低位语（LLT）和首选语（PT）；若系统编码置信度低于阈值（如 < 80%），标记为"待人工编码"并通知医学编码员
3. **CTCAE 严重程度分级:** CRC 或 PI 根据 CTCAE v5.0 标准选择 AE 的严重程度等级（Grade 1-5）：Grade 1（轻度）、Grade 2（中度）、Grade 3（重度）、Grade 4（危及生命）、Grade 5（死亡）
4. **因果关系评估:** PI 对 AE 与研究药物的因果关系进行评估，考虑因素包括：时间关系、去激发/再激发结果、是否有其他合理解释、已知药理特性等；评估结论从 related / possibly / unlikely / unrelated 中选择，评估依据记录在 causality_rationale 字段
5. **严重性标准自动检查:** 系统自动检查 AE 是否满足 SAE 严重性标准（死亡、危及生命、住院/延长住院、永久/显著残疾、先天畸形、重要医学事件）；若满足任一标准，自动弹出 SAE 升级对话框
6. **SAE 升级触发:** 当 AE 满足 SAE 标准时，系统引导用户启动 SAE 升级流程：（a）将 AE 的 is_serious 标记为 true；（b）自动创建关联的 SAE 记录；（c）将 AE 中的数据复制到 SAE 记录中；（d）启动 SAE 时效监控
7. **伴随用药记录:** 在 AE 详情页面，CRC 可添加 AE 发生时正在使用的伴随用药，选择用药时间范围，系统自动在时间线上展示 AE 与用药的重叠关系
8. **AE 结局追踪:** AE 的结局（outcome）持续追踪，可选值：recovered/resolved（恢复）、recovering/resolving（恢复中）、not recovered/not resolved（未恢复）、recovered with sequelae（恢复有后遗症）、fatal（死亡）、unknown（未知）
9. **AE 关闭:** 当 AE 结局确定为最终状态（恢复/死亡）后，PI 确认关闭该 AE 记录；AE 关闭后仍可查看，但不可修改常规字段
10. **盲态输出:** 对于盲法研究，AE 数据在输出给 Sponsor 时经过盲态过滤：移除可能暗示治疗组的信息，仅提供分组的 AE 发生率和 SOC 分类汇总

**关键状态流转:**

| 当前状态 | 目标状态 | 触发动作 | 触发角色 | 前置条件 | 审计要求 |
|----------|----------|----------|----------|----------|----------|
| logged | assessed | PI 完成因果关系评估 | PI | CTCAE 分级已完成、因果关系已确定 | 记录评估人、评估时间、评估结论 |
| logged | escalated | 符合 SAE 标准，触发升级 | System/CRC | is_serious = true | 记录升级时间、关联 SAE ID |
| assessed | followup | PI 要求持续随访 | PI | AE 结局尚未最终确定 | 记录随访计划 |
| followup | resolved | 受试者恢复，AE 结案 | PI | outcome 为最终状态 | 记录结案时间、最终结局 |
| assessed | resolved | AE 直接恢复（无随访） | PI | outcome 为恢复/死亡 | 记录结案时间 |
| (any) | related_sae | 关联 SAE 记录已创建 | System | SAE 记录关联完成 | 记录 SAE 关联 ID |

**核心字段:**

| 字段 | 类型 | 必填 | 敏感级别 | 说明 |
|------|------|------|----------|------|
| ae_id | UUIDv7 (PK) | 是 | 内部 | 主键 |
| ae_no | VARCHAR(32) | 是 | 内部 | 业务编号 AE-{STUDY}-{SUBJECT}-{SEQ} |
| ae_term | VARCHAR(500) | 是 | 内部 | 不良事件原始术语（自由文本） |
| ae_term_llt | VARCHAR(500) | 否 | 内部 | MedDRA 低位语 (Lowest Level Term) |
| ae_term_pt | VARCHAR(500) | 否 | 内部 | MedDRA 首选语 (Preferred Term) |
| ae_term_soc | VARCHAR(200) | 否 | 内部 | MedDRA 系统器官分类 (System Organ Class) |
| meddra_code | VARCHAR(20) | 否 | 内部 | MedDRA 代码 |
| meddra_version | VARCHAR(10) | 否 | 内部 | MedDRA 版本号，如 "27.1" |
| onset_date | DATE | 是 | 内部 | AE 发生日期 |
| end_date | DATE | 否 | 内部 | AE 结束日期 |
| severity_grade | INT | 是 | 内部 | CTCAE 严重程度等级 1-5 |
| causality | VARCHAR(20) | 是 | 内部 | 因果关系：related / possibly / unlikely / unrelated |
| causality_rationale | TEXT | 否 | 内部 | 因果关系判断依据 |
| outcome | VARCHAR(30) | 是 | 内部 | 结局：recovered / recovering / not_recovered / recovered_with_sequelae / fatal / unknown |
| is_serious | BOOLEAN | 是 | 内部 | 是否满足 SAE 标准 |
| seriousness_criteria | JSONB | 否 | 内部 | 严重性标准明细 [{criterion, description}] |
| status | VARCHAR(20) | 是 | 内部 | logged / assessed / followup / resolved / related_sae |
| sae_id | UUIDv7 | 否 | 内部 | 关联 SAE 记录 ID |
| related_study_id | UUIDv7 | 是 | 内部 | 关联研究 ID |
| related_site_id | UUIDv7 | 是 | 内部 | 关联站点 ID |
| related_subject_id | UUIDv7 | 是 | PII 关联 | 关联受试者 ID |
| related_drug_id | UUIDv7 | 否 | 内部 | 怀疑药物 ID（多药物时可存储数组） |
| concomitant_medications | JSONB | 否 | 内部 | 伴随用药 [{name, start_date, end_date, dose}] |
| assessor_id | UUIDv7 | 否 | 内部 | 评估人（PI）ID |
| assessed_at | TIMESTAMPTZ | 否 | 内部 | 评估时间 |
| treatment_required | BOOLEAN | 否 | 内部 | 是否需要治疗 |
| treatment_description | TEXT | 否 | 内部 | 治疗措施描述 |
| ae_history | JSONB | 否 | 内部 | 操作历史 |
| is_blinded | BOOLEAN | 是 | 内部 | 是否处于盲态遮蔽 |
| is_deleted | BOOLEAN | 是 | 内部 | 软删除 |
| created_by | UUIDv7 | 是 | 内部 | 创建人 |
| created_at | TIMESTAMPTZ | 是 | 内部 | 创建时间 |
| updated_at | TIMESTAMPTZ | 是 | 内部 | 更新时间 |

**异常场景:**

| 场景 | 处理方式 | 用户提示 |
|------|----------|----------|
| MedDRA 自动编码置信度低于阈值 | 标记为"待人工编码"，通知医学编码员 | "AE 术语自动编码置信度不足，已转交人工编码" |
| AE 已被确认为 SAE 后尝试修改严重性 | 阻止修改 seriousness_criteria 字段 | "该 AE 已关联 SAE 记录，严重性标准不可修改" |
| PI 未在规定时间（48h）内完成评估 | 自动提醒 PI 和 PM；超 72h 升级通知 | "AE-XXX 等待 PI 评估已超 48 小时，请及时处理" |
| 盲法研究中 Sponsor 尝试查看 AE 详情 | 返回盲态汇总数据，记录访问日志 | "您正在查看盲法研究的汇总数据，详细 AE 信息在揭盲前不可见" |
| 同一受试者同一天发生相似 AE | 系统检测相似性并提示合并或区分 | "检测到同日相似 AE 记录（AE-XXX），请确认是否为同一事件" |
| 死亡事件（Grade 5）发生后 SAE 未创建 | 强制触发 SAE 创建流程 | "死亡事件（Grade 5）必须同时创建 SAE 记录，系统将自动引导您完成" |
| CTCAE 分级与 MedDRA 术语不匹配 | 记录警告，不阻止保存 | "选择的 CTCAE 等级与 MedDRA 术语通常的分级不一致，请确认" |

**权限要求:**

| 角色 | 查看 | 创建 | 编辑 | 删除 | 特殊权限 |
|------|------|------|------|------|----------|
| Admin | 全部 | 全部 | 全部 | 可硬删除 | 可修改任何字段 |
| PM | 管辖 Study（非盲态） | 否 | 否 | 否 | 可查看 AE 汇总、趋势 |
| PI | 管辖 Site | 管辖 Site | 管辖 Site（评估字段） | 否 | 因果关系评估、结局确认 |
| CRC | 管辖 Site | 管辖 Site | 管辖 Site（记录字段） | 否 | 初始记录、MedDRA 编码辅助、结局更新 |
| CRA | 管辖 Site | 管辖 Site | 否 | 否 | 仅查看，可在 SDV 时记录 AE 建议 |
| Sponsor | 管辖 Study（盲态汇总） | 否 | 否 | 否 | 仅查看盲态汇总数据 |
| ReadOnlyAuditor | 全部（只读） | 否 | 否 | 否 | 完整审计查看权限 |

**关联数据实体:** SAE, Subject, Study, Site, Drug, ConcomitantMedication, AuditLog

**关联 REST API:**

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api/v1/aes | 分页查询 AE 列表 |
| GET | /api/v1/aes/{aeId} | 获取 AE 详情 |
| POST | /api/v1/aes | 创建 AE 记录 |
| PUT | /api/v1/aes/{aeId}/assess | PI 因果关系评估 |
| PUT | /api/v1/aes/{aeId}/outcome | 更新 AE 结局 |
| POST | /api/v1/aes/{aeId}/escalate-to-sae | 升级为 SAE |
| GET | /api/v1/aes/{aeId}/meddra-suggest | 获取 MedDRA 编码建议 |
| PUT | /api/v1/aes/{aeId}/meddra-code | 人工 MedDRA 编码 |
| GET | /api/v1/aes/summary | 获取 AE 汇总报表 |
| GET | /api/v1/aes/export | 导出 AE 列表（CSR 格式） |

---

### M09b: SAE Management -- 严重不良事件管理

**模块目标:** 管理严重不良事件（Serious Adverse Event）的完整生命周期，包括 SAE 升级确认、医学审查、叙述性报告撰写、SUSAR 识别、监管报告时限跟踪、MedDRA 编码复核、揭盲考量及最终关闭，确保符合 ICH E2A 和当地监管机构的报告时限要求。

**子功能清单:**

| 序号 | 子功能 | 描述 | 关键操作 |
|------|--------|------|----------|
| S01 | SAE 升级确认 | 对从 AE 升级或直接报告的 SAE 进行确认和分类 | SAE 确认、严重性标准核实、升级来源记录 |
| S02 | SAE 医学审查 | 医学监查员对 SAE 进行专业医学评审 | 医学评审、术语修正、严重性确认 |
| S03 | 叙事撰写与编辑 | 撰写 SAE 叙述性报告（Narrative），符合 ICH E3 要求 | 叙事编辑器、模板辅助、版本管理 |
| S04 | SUSAR 识别 | 根据预期性（expectedness）和因果关系自动判断 SUSAR | 预期性评估、SUSAR 自动标记、快速报告触发 |
| S05 | 监管报告时限管理 | 追踪 24h/7d/15d 监管报告时限（SLA），自动预警 | 时限倒计时、SLA 仪表板、超时自动升级 |
| S06 | 揭盲考量 | SAE 需要揭盲时的标准操作流程 | 揭盲申请、批准流程、揭盲记录 |
| S07 | 监管提交流程（Flowable） | 通过 Flowable 工作流管理监管提交审批和跟踪 | 提交审批、提交流程跟踪、递交确认回执 |
| S08 | SAE 报告生成 | 自动生成 CIOMS-I 表格、MedWatch 3500A 等标准报告格式 | CIOMS-I 生成、MedWatch 生成、PDF 导出 |

**核心交互流程:**

1. **SAE 创建/升级:** SAE 来源有两种：（a）从 AE 模块升级（满足严重性标准）；（b）直接创建（如受试者在院外发生 SAE，直接报告给研究者）。系统从 AE 自动复制已有数据（术语、日期、受试者信息），SAE 初始状态为 reported
2. **SAE 确认与分类:** PI 在 24 小时内对 SAE 进行确认，核实严重性标准的准确性，补充相关临床信息；确认后 SAE 状态变为 reviewing，系统自动分配 SAE 编号 SAE-{STUDY}-{SEQ}
3. **医学审查阶段:** 医学监查员（Medical Monitor）或 PI 对 SAE 进行详细医学审查：（a）复核 MedDRA 编码的正确性；（b）评估 SAE 与研究药物的因果关系；（c）评估 SAE 的预期性（expected / unexpected），判断依据：是否在 IB（研究者手册）的参考安全信息（RSI）中列出
4. **SUSAR 自动判断:** 系统根据 causality + expectedness 组合自动判断：若 causality = related/possibly 且 expectedness = unexpected，自动标记为 SUSAR；SUSAR 触发加急报告流程（7 天致命/危及生命，15 天其他）
5. **叙事撰写:** 医学监查员或 PI 使用叙事编辑器撰写 SAE Narrative；叙事遵循 ICH E3 标准模板，包含：患者基本信息、事件描述、时间线、实验室检查结果、治疗措施、结局、去激发/再激发信息；叙事支持多版本草稿，最终版本由 PI 签署确认
6. **监管报告时限监控:** 系统根据 SAE 类型和时间自动计算监管报告截止日期：致命或危及生命的 SUSAR = 7 个日历日；其他 SUSAR = 15 个日历日；非 SUSAR SAE = 按申办方 SOP 和当地法规确定。系统通过 RabbitMQ 延迟队列在截止日期前 24h/12h/2h 分别发送预警
7. **揭盲流程（如需要）:** 若 SAE 的医学判断/监管报告需要知道受试者的治疗分组，PI 可发起紧急揭盲申请：（a）PI 填写揭盲理由；（b）系统根据揭盲 SOP 发送给指定人员审批；（c）审批通过后，系统在揭盲日志中记录揭盲人、时间、理由；（d）揭盲后该受试者的盲态标记解除
8. **Flowable 监管提交流程:** 监管提交启动 Flowable 工作流：医学监查员起草 -> QA 审核 -> 药物安全负责人批准 -> 提交至监管机构；每步审批有 SLA 时限，系统跟踪流程进度；提交流程完成后，上传监管机构的接收确认回执
9. **随访报告:** SAE 初次报告后，根据事件的发展需要提交随访报告：（a）事件结局变化时更新 outcome；（b）新获得的实验室/影像学信息；（c）因果关系重新评估结果。每次更新生成新的报告版本，版本号自动递增
10. **SAE 关闭:** 当 SAE 结局确定（受试者恢复/死亡），所有监管报告已提交，最终 Narrative 已签署，SAE 状态变更为 closed；SAE 记录纳入研究的最终安全数据库

**关键状态流转:**

| 当前状态 | 目标状态 | 触发动作 | 触发角色 | 前置条件 | 审计要求 |
|----------|----------|----------|----------|----------|----------|
| reported | reviewing | PI 确认 SAE 并开始医学审查 | PI | seriousness_criteria 已验证 | 记录确认人、确认时间 |
| reviewing | escalated | 确认需要紧急上报 | PI / Medical Monitor | SUSAR 已识别 | 记录升级原因、SUSAR 判断依据 |
| escalated | confirmed | 医学监查员确认最终评估 | Medical Monitor | Narrative 已完成、编码已复核 | 记录确认人、确认时间 |
| confirmed | closed | SAE 处理完毕并归档 | System / PI | 结局已确定、所有报告已提交 | 记录关闭时间、最终结局 |
| reviewing | closed | 非严重/非 SUSAR 直接关闭 | PI | 结局已确定 | 记录关闭时间 |
| (any) | unblinded | 紧急揭盲 | PI | 揭盲审批通过 | 记录揭盲人、时间、理由、审批链 |

**核心字段:**

| 字段 | 类型 | 必填 | 敏感级别 | 说明 |
|------|------|------|----------|------|
| sae_id | UUIDv7 (PK) | 是 | 内部 | 主键 |
| sae_no | VARCHAR(32) | 是 | 内部 | 业务编号 SAE-{STUDY}-{SEQ} |
| sae_term | VARCHAR(500) | 是 | 内部 | SAE 术语 |
| sae_term_pt | VARCHAR(500) | 否 | 内部 | MedDRA 首选语 |
| sae_term_soc | VARCHAR(200) | 否 | 内部 | MedDRA SOC |
| narrative | TEXT | 否 | 内部 | SAE 叙述性报告 |
| narrative_version | INT | 是 | 内部 | 叙事版本号，默认 1 |
| narrative_status | VARCHAR(16) | 是 | 内部 | 叙事状态：draft / final / signed |
| status | VARCHAR(20) | 是 | 内部 | reported / reviewing / escalated / confirmed / closed / unblinded |
| seriousness_criteria | JSONB | 是 | 内部 | 严重性标准 [{criterion: DEATH/LIFE_THREATENING/HOSPITALIZATION/DISABILITY/CONGENITAL_ANOMALY/IMPORTANT_MEDICAL_EVENT, description}] |
| causality | VARCHAR(20) | 是 | 内部 | 因果关系：related / possibly / unlikely / unrelated |
| expectedness | VARCHAR(20) | 否 | 内部 | 预期性：expected / unexpected |
| is_susar | BOOLEAN | 是 | 内部 | 是否为 SUSAR，系统自动计算 |
| onset_date | DATE | 是 | 内部 | SAE 发生日期 |
| aware_date | DATE | 是 | 内部 | 获知日期（PI/申办方首次获知 SAE 的日期） |
| outcome | VARCHAR(30) | 是 | 内部 | 结局（同 AE outcome 字段） |
| outcome_date | DATE | 否 | 内部 | 结局日期 |
| expedited_report_deadline | TIMESTAMPTZ | 否 | 内部 | 加急报告截止日期 |
| regulatory_submission_date | TIMESTAMPTZ | 否 | 内部 | 监管提交日期 |
| report_type | VARCHAR(20) | 否 | 内部 | 报告类型：initial / followup / final |
| report_version | INT | 是 | 内部 | 报告版本号 |
| ae_source_id | UUIDv7 | 否 | 内部 | 来源 AE ID |
| related_study_id | UUIDv7 | 是 | 内部 | 关联研究 ID |
| related_site_id | UUIDv7 | 是 | 内部 | 关联站点 ID |
| related_subject_id | UUIDv7 | 是 | PII 关联 | 关联受试者 ID |
| medical_reviewer_id | UUIDv7 | 否 | 内部 | 医学审查人 ID |
| medical_review_date | TIMESTAMPTZ | 否 | 内部 | 医学审查日期 |
| unblinding_reason | TEXT | 否 | 高敏感 | 揭盲理由 |
| unblinding_date | TIMESTAMPTZ | 否 | 高敏感 | 揭盲日期 |
| unblinding_by | UUIDv7 | 否 | 高敏感 | 揭盲操作人 |
| flowable_process_instance_id | VARCHAR(64) | 否 | 内部 | 监管提交流程 Flowable 实例 ID |
| regulatory_ack_reference | VARCHAR(200) | 否 | 内部 | 监管机构回执编号 |
| sae_history | JSONB | 否 | 内部 | 操作历史 |
| attachments | JSONB | 否 | 内部 | 附件（CIOMS-I/MedWatch 报告 PDF） |
| is_deleted | BOOLEAN | 是 | 内部 | 软删除 |
| created_by | UUIDv7 | 是 | 内部 | 创建人 |
| created_at | TIMESTAMPTZ | 是 | 内部 | 创建时间 |
| updated_at | TIMESTAMPTZ | 是 | 内部 | 更新时间 |

**异常场景:**

| 场景 | 处理方式 | 用户提示 |
|------|----------|----------|
| SAE 报告时限 24h 内未提交初报 | 自动升级通知药物安全负责人和 PM | "SAE-XXX 初报时限已过 {N} 小时，请立即处理！" |
| SUSAR 7 天/15 天报告超时 | 自动通知 PM、药物安全负责人、QA | "SUSAR SAE-XXX 加急报告时限已过，已通知相关人员" |
| 叙事未在 SAE 确认后 48h 内完成 | 自动提醒 PI 和医学监查员 | "SAE-XXX 叙事撰写已超 48 小时，请尽快完成" |
| 盲法研究 SAE 评估需要揭盲但审批未通过 | 无法查看揭盲数据，使用盲态替代方案 | "揭盲申请正在审批中，当前可见盲态数据" |
| MedDRA 编码复核发现术语不当 | 医学监查员修正编码，记录变更日志 | "MedDRA 编码已从 {Old} 修正为 {New}" |
| 监管提交后监管机构要求补充信息 | 创建新的 followup 报告版本 | "监管机构已要求补充信息，请创建随访报告" |
| SAE 关联的 AE 被意外删除 | SAE 保留，ae_source_id 置空，记录日志 | "关联的源 AE 记录已删除，SAE 记录保留" |

**权限要求:**

| 角色 | 查看 | 创建 | 编辑 | 删除 | 特殊权限 |
|------|------|------|------|------|----------|
| Admin | 全部 | 全部 | 全部 | 可硬删除 | 可修改任何字段、强制关闭 SAE |
| PM | 管辖 Study（非盲态） | 否 | 否 | 否 | 可查看 SAE 列表和时限、接收通知 |
| PI | 管辖 Site | 管辖 Site | 管辖 Site（评估/叙事） | 否 | 可确认 SAE、评估因果关系、撰写叙事、发起揭盲 |
| Medical Monitor | 管辖 Study（全部） | 否 | 管辖 Study（医学审查） | 否 | 可医学审查、修改 MedDRA 编码、确认 SUSAR |
| CRC | 管辖 Site | 管辖 Site | 管辖 Site（基本信息） | 否 | 可初始记录和更新基本信息 |
| CRA | 管辖 Site | 管辖 Site | 否 | 否 | 仅查看和 SDV 确认 |
| Sponsor | 管辖 Study（盲态汇总） | 否 | 否 | 否 | 仅查看盲态汇总和时限合规报告 |
| ReadOnlyAuditor | 全部（只读） | 否 | 否 | 否 | 完整审计查看权限，含 SAE 历史 |

**关联数据实体:** AE, Subject, Study, Site, Drug, NarrativeVersion, FlowableProcess, AuditLog

**关联 REST API:**

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api/v1/saes | 分页查询 SAE 列表 |
| GET | /api/v1/saes/{saeId} | 获取 SAE 详情 |
| POST | /api/v1/saes | 直接创建 SAE 记录 |
| POST | /api/v1/saes/from-ae/{aeId} | 从 AE 升级创建 SAE |
| PUT | /api/v1/saes/{saeId}/confirm | PI 确认 SAE |
| PUT | /api/v1/saes/{saeId}/medical-review | 医学监查员审查 |
| PUT | /api/v1/saes/{saeId}/narrative | 更新/签署叙事 |
| PUT | /api/v1/saes/{saeId}/susar-assessment | SUSAR 评估 |
| POST | /api/v1/saes/{saeId}/unblind-request | 发起揭盲申请 |
| PUT | /api/v1/saes/{saeId}/unblind-approve | 审批揭盲申请 |
| POST | /api/v1/saes/{saeId}/submit-regulatory | 启动监管提交流程（Flowable） |
| PUT | /api/v1/saes/{saeId}/followup | 提交随访报告 |
| PUT | /api/v1/saes/{saeId}/close | 关闭 SAE |
| GET | /api/v1/saes/{saeId}/report | 生成 CIOMS-I/MedWatch 报告 |
| GET | /api/v1/saes/timeline | 获取 SAE 时限仪表板数据 |
| GET | /api/v1/saes/susar-list | 获取 SUSAR 列表 |

---

## M10: 文档中心 / 交付物 / 归档

### M10 模块概述

M10 是临床试验文档管理的中央枢纽，仿照 Trial Master File（TMF）的架构设计，提供从文档创建、审批、生效、版本控制到最终归档的全生命周期管理。模块支持完整的文件夹结构（TMF-like Hierarchy）、文档审批工作流（Flowable）、缺失文档自动检测和电子归档功能。所有文档以 FileObject 为底层存储单元，通过 MinIO 实现物理存储，支持文档间引用关系追踪。

**设计原则:**

1. **TMF 对标:** 文档分类和文件夹结构参照 DIA TMF Reference Model，确保监管核查时文档可快速定位
2. **版本不可变:** 文档审批生效后，版本的物理文件不可更改；任何修改必须创建新版本
3. **审批链可配置:** 不同文档类型可配置不同的审批链（如 ICF 需要 EC 审批，SOP 仅需 QA 审批）
4. **缺失检测自动化:** 系统根据研究阶段和里程碑自动检测应存在但缺失的文档，生成缺失文档列表
5. **电子归档:** 研究结束时，所有文档自动打包为符合 eTMF 标准的归档包（XML + PDF/A）

**文件夹结构参考（TMF-like）:**

```
TMF Root
|-- 01. Trial Management
|   |-- 01.01. Study Protocol & Amendments
|   |-- 01.02. Investigator's Brochure (IB)
|   |-- 01.03. Study Plans (SAP, DMP, SMP, etc.)
|   \-- 01.04. Study Reports
|-- 02. Central Documents
|   |-- 02.01. Ethics Committee (EC) Submissions & Approvals
|   |-- 02.02. Regulatory Authority (RA) Submissions & Approvals
|   \-- 02.03. Insurance & Indemnity
|-- 03. Site Documents
|   |-- 03.01. Site Selection & Initiation
|   |-- 03.02. Site Contracts & Budgets
|   |-- 03.03. Site Monitoring Reports
|   \-- 03.04. Site Close-out
\-- 04. Subject Documents
    |-- 04.01. Informed Consent Forms (ICF)
    |-- 04.02. Subject Identification Logs
    \-- 04.03. Subject-specific Documents
```

---

**模块目标:** 提供临床试验从启动到归档全过程的文档集中管理平台，支持文档的版本控制、审批工作流、缺失检测和电子归档，确保 Trial Master File（TMF）的完整性和监管核查就绪。

**子功能清单:**

| 序号 | 子功能 | 描述 | 关键操作 |
|------|--------|------|----------|
| D01 | 文档上传与管理 | 支持多格式文档上传，自动解析元数据，关联 Study/Site/Subject | 文件上传、拖拽上传、批量上传、元数据编辑 |
| D02 | TMF 文件夹结构 | 仿照 DIA TMF Reference Model 的层级文件夹结构 | 文件夹创建、移动、排序、权限设置 |
| D03 | 版本控制 | 文档审批生效后版本锁定，新版本创建、版本历史追溯 | 检出/检入、版本对比、版本回滚查看 |
| D04 | 审批工作流 | 通过 Flowable 驱动文档审批流程，支持多级审批链 | 提交审批、逐级审批、批注、驳回 |
| D05 | 缺失文档检测 | 根据研究阶段/里程碑自动检测应存在但缺失的文档 | 自动检测规则配置、缺失清单生成、提醒通知 |
| D06 | 文档到期提醒 | 文档有效期管理（如 IB 年审、EC 批件到期） | 到期倒计时、自动提醒、续期流程触发 |
| D07 | 电子归档 | 研究结束时所有文档自动打包为 eTMF 归档包 | 归档包生成、XML 索引、PDF/A 转换、完整性校验 |
| D08 | 文档关联 | 建立文档间的引用关系（如 Protocol 引用的 IB 版本） | 引用关系图、关联文档快速跳转、缺失引用检测 |
| D09 | 全文搜索 | 基于 OpenSearch 的文档全文搜索（含 PDF/Word 内容解析） | OCR 文本索引、关键词搜索、高级筛选 |
| D10 | 文档模板 | 预设常用文档模板，标准化文档创建 | 模板库、模板选择、模板变量填充 |

**核心交互流程:**

1. **文档上传:** 用户在文档中心选择目标文件夹后上传文档；系统自动识别文档格式（PDF/Word/Excel/图片）、提取文本内容并存储到 MinIO；自动从文件名和上传路径推断元数据（document_type, related_study, related_site 等）
2. **元数据编辑:** 上传后用户完善文档元数据：（a）选择文档类型（Protocol/ICF/IB/SOP/Monitoring Report 等）；（b）填写标题和描述；（c）设置生效日期和过期日期（如有）；（d）关联相关研究/站点/受试者；（e）设置访问权限级别
3. **文档提交审批:** 文档状态为 draft；用户点击"提交审批"后，系统根据文档类型自动启动对应的 Flowable 审批链；不同类型配置不同的审批链，例如：ICF 文档 = CRC 起草 -> PI 审批 -> EC 审批 -> QA 确认；SOP 文档 = QA 起草 -> PM 审批 -> QA Director 批准
4. **逐级审批:** 每一级审批人在待办列表中看到待审批文档；审批人可查看文档内容、添加批注（annotations）；操作选项：审批通过（approve）、驳回（reject with comments）、要求修改（request changes）
5. **文档生效:** 所有审批通过后，文档状态变为 effective；此时文档版本被锁定，物理文件不可修改；系统自动将文档版本号递增（如 v1.0, v1.1, v2.0）；若有上一版本，上一版本状态自动变为 superseded
6. **文档版本更新:** 若需要修改已生效的文档，用户必须创建新版本；新版本从 effective 的文档检出（checkout），继承上一版本的元数据；新版本回到 draft 状态，走同样的审批流程；审批通过后新版本生效，旧版本进入历史存档
7. **缺失文档检测:** 系统定时任务扫描研究的所有站点，根据研究阶段（如 startup/enrolling/followup）和已完成的里程碑，对照文档清单（Document Checklist），检测应存在但缺失的文档；生成缺失文档报告并通知 PM
8. **文档到期管理:** 对于有过期日期的文档（如 EC 批准函有效期 1 年），系统在到期前 90/60/30/7 天分别发送提醒；到期后文档状态自动标记为 expired 并通知相关人员启动续期流程
9. **文档搜索与查阅:** 用户可通过 OpenSearch 全文搜索或按元数据筛选查找文档；支持在浏览器中预览常见格式（PDF/图片）；文档下载和访问操作均记录到 AuditLog
10. **电子归档:** 研究关闭后，PM 触发归档操作；系统将所有 effective 状态的文档（包括所有历史版本）打包生成 eTMF 归档包：包含 PDF/A 格式文档、XML 索引文件、审计日志文件；归档包完整性校验通过后，Study 状态才能变更为 archived

**关键状态流转:**

| 当前状态 | 目标状态 | 触发动作 | 触发角色 | 前置条件 | 审计要求 |
|----------|----------|----------|----------|----------|----------|
| draft | under_review | 提交审批 | 文档创建者 | 文档元数据完整、文件已关联 | 记录提交人、提交时间、审批链信息 |
| under_review | approved | 所有审批人通过 | 审批链成员 | Flowable 审批链完成 | 记录每位审批人、审批时间、批注 |
| under_review | draft | 审批人驳回/要求修改 | 审批链成员 | 驳回意见非空 | 记录驳回人、驳回原因、驳回时间 |
| approved | effective | 系统自动生效 | System | 所有审批通过、生效日期已到 | 记录生效时间、版本号 |
| effective | superseded | 新版本生效 | System | 新版本状态变为 effective | 记录被替代时间、新版本号 |
| effective | expired | 过期日期到达 | System | 文档有过期日期且已过期 | 记录过期时间 |
| expired | effective | 续期审批通过 | 续期审批链 | 续期文档审批链完成 | 记录续期时间、续期后过期日期 |
| (any) | archived | 研究归档触发 | System/PM | Study 进入 locked 状态 | 记录归档时间、归档包 ID |

**核心字段:**

| 字段 | 类型 | 必填 | 敏感级别 | 说明 |
|------|------|------|----------|------|
| document_id | UUIDv7 (PK) | 是 | 内部 | 主键 |
| document_no | VARCHAR(32) | 是 | 内部 | 业务编号 DOC-{STUDY}-{SEQ} |
| title | VARCHAR(500) | 是 | 内部 | 文档标题 |
| description | TEXT | 否 | 内部 | 文档描述 |
| document_type | VARCHAR(50) | 是 | 内部 | 文档类型：PROTOCOL / ICF / IB / SOP / MONITORING_REPORT / SITE_DOC / SUBJECT_FILE / REGULATORY / OTHER |
| tmf_category | VARCHAR(50) | 是 | 内部 | TMF 分类代码，如 "01.01" "03.02" |
| tmf_folder_path | VARCHAR(500) | 否 | 内部 | TMF 文件夹完整路径 |
| version | VARCHAR(10) | 是 | 内部 | 版本号，如 "1.0" "2.1" |
| status | VARCHAR(20) | 是 | 内部 | draft / under_review / approved / effective / superseded / expired / archived |
| file_id | UUIDv7 | 是 | 内部 | 关联 FileObject ID（物理文件引用） |
| file_name | VARCHAR(255) | 是 | 内部 | 原始文件名 |
| file_size | BIGINT | 是 | 内部 | 文件大小（字节） |
| mime_type | VARCHAR(100) | 是 | 内部 | MIME 类型，如 application/pdf |
| ocr_text | TEXT | 否 | 内部 | OCR 提取的全文文本（OpenSearch 索引源） |
| effective_date | DATE | 否 | 内部 | 生效日期 |
| expiry_date | DATE | 否 | 内部 | 过期日期 |
| related_study_id | UUIDv7 | 否 | 内部 | 关联研究 ID |
| related_site_id | UUIDv7 | 否 | 内部 | 关联站点 ID |
| related_subject_id | UUIDv7 | 否 | PII 关联 | 关联受试者 ID |
| parent_document_id | UUIDv7 | 否 | 内部 | 父文档 ID（版本链的上一版本） |
| next_version_id | UUIDv7 | 否 | 内部 | 下一版本 ID |
| flowable_process_instance_id | VARCHAR(64) | 否 | 内部 | 审批流程 Flowable 实例 ID |
| approval_chain | JSONB | 否 | 内部 | 审批链配置 [{step, role, approver_id, status, comment, approved_at}] |
| annotations | JSONB | 否 | 内部 | 审批批注 [{page, position, content, author, created_at}] |
| reference_documents | UUID[] | 否 | 内部 | 引用的文档 ID 数组 |
| access_level | VARCHAR(16) | 是 | 内部 | 访问级别：PUBLIC / STUDY_ONLY / SITE_ONLY / RESTRICTED |
| checksum | VARCHAR(64) | 是 | 内部 | 文件 SHA-256 校验和 |
| archive_package_id | UUIDv7 | 否 | 内部 | 归档包 ID |
| document_history | JSONB | 否 | 内部 | 操作历史 |
| is_deleted | BOOLEAN | 是 | 内部 | 软删除 |
| created_by | UUIDv7 | 是 | 内部 | 创建人 |
| created_at | TIMESTAMPTZ | 是 | 内部 | 创建时间 |
| updated_at | TIMESTAMPTZ | 是 | 内部 | 更新时间 |

**异常场景:**

| 场景 | 处理方式 | 用户提示 |
|------|----------|----------|
| 文档上传文件损坏或格式不支持 | 前端校验文件头（Magic Number），服务端二次校验 | "文件格式不支持或文件已损坏，请检查后重新上传" |
| MinIO 存储空间不足 | 触发告警，通知管理员扩容 | "文件存储空间不足，请联系系统管理员" |
| 审批人长时间未处理审批（> 5 工作日） | 自动催办提醒，抄送审批人上级 | "文档 DOC-XXX 等待您的审批已超过 5 个工作日" |
| 同一文档类型重复上传相似内容 | 基于文件 checksum 和标题相似度检测 | "检测到相似文档（DOC-XXX），请确认是否需要创建新版本而非新文档" |
| 文档过期日期已到但未续期 | 文档状态自动变为 expired，通知文档负责人 | "文档 DOC-XXX 已过期，请尽快完成续期流程" |
| 研究归档时发现缺失必需文档 | 阻止研究归档，生成缺失文档清单 | "该研究存在 {N} 份必需文档缺失，无法完成归档。请查看缺失文档清单" |
| 大文件（> 500MB）上传超时 | 前端分片上传，后端合并，支持断点续传 | "文件上传中断，已保存进度，可继续上传" |
| 并发编辑冲突（同一文档同时被检出） | 乐观锁控制，后保存者提示冲突 | "文档已被其他用户修改，请刷新后重试" |

**权限要求:**

| 角色 | 查看 | 创建 | 编辑 | 删除 | 特殊权限 |
|------|------|------|------|------|----------|
| Admin | 全部 | 全部 | 全部 | 可硬删除 | 可修改任何字段、强制归档 |
| PM | 管辖 Study 文档 | 管辖 Study | 管辖 Study（未生效） | 管辖 Study（未生效） | 可配置审批链、触发归档 |
| QA | 全部 | 全部 | 全部（未生效） | 全部（未生效） | 可审批任何文档 |
| CRA Lead | 管辖 Study | 管辖 Study | 管辖 Study（未生效） | 否 | 可上传/审批管辖范围内的文档 |
| CRA | 管辖 Site | 管辖 Site | 管辖 Site（未生效） | 管辖 Site（未生效） | 可上传/管理 Site 级文档 |
| CRC | 管辖 Site | 管辖 Site | 管辖 Site（未生效） | 管辖 Site（未生效） | 可上传/管理 Site 级文档和受试者文档 |
| PI | 管辖 Site | 管辖 Site | 管辖 Site（审批） | 否 | 可审批 Site 文档 |
| Sponsor | 管辖 Study（未遮蔽） | 否 | 否 | 否 | 仅查看非盲态文档 |
| ReadOnlyAuditor | 全部（只读） | 否 | 否 | 否 | 完整审计查看权限，含审批批注 |

**关联数据实体:** FileObject, ConsentVersion, Study, Site, Subject, AuditLog, FlowableProcess

**关联 REST API:**

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api/v1/documents | 分页查询文档列表 |
| GET | /api/v1/documents/{documentId} | 获取文档详情 |
| POST | /api/v1/documents/upload | 上传新文档 |
| PUT | /api/v1/documents/{documentId} | 更新文档元数据（仅 draft 状态） |
| POST | /api/v1/documents/{documentId}/submit | 提交审批 |
| PUT | /api/v1/documents/{documentId}/approve | 单级审批通过 |
| PUT | /api/v1/documents/{documentId}/reject | 审批驳回 |
| POST | /api/v1/documents/{documentId}/new-version | 创建新版本（检出） |
| GET | /api/v1/documents/{documentId}/versions | 获取文档所有版本列表 |
| GET | /api/v1/documents/{documentId}/download | 下载文档文件 |
| GET | /api/v1/documents/{documentId}/preview | 获取文档预览 URL |
| GET | /api/v1/documents/search | OpenSearch 全文搜索 |
| GET | /api/v1/documents/missing-items | 获取缺失文档清单 |
| GET | /api/v1/documents/expiring | 获取即将过期文档列表 |
| POST | /api/v1/documents/archive | 触发电子归档 |
| GET | /api/v1/documents/tmf-structure | 获取 TMF 文件夹结构 |
| PUT | /api/v1/documents/{documentId}/move | 移动文档到新位置 |
| GET | /api/v1/documents/{documentId}/references | 获取文档引用关系图 |

---


## M11: 预算 / 合同 / 中心付款 / 患者补贴 / 开票 / 对账

### M11 模块概述

M11 是临床试验财务管理的一体化平台，覆盖从预算编制、合同管理、中心付款、患者报销、发票管理到自动对账的完整财务生命周期。该模块服务于 Finance、PM、CRA 和 CRC 等多角色，确保临床试验的财务运营透明、合规、高效。模块支持多币种、税率配置，并与 Study/Site 主数据紧密集成。

**设计原则:**

1. **财务合规:** 所有财务数据修改采用 append-only 审计日志，支持完整的财务审计追溯
2. **三单匹配:** 发票、合同、付款三方自动匹配，防止重复付款和错付
3. **多币种支持:** 所有金额字段存储原始币种和等值本位币金额，汇率从外部汇率服务获取
4. **工作流驱动:** 预算审批、合同审批、付款审批均通过 Flowable 工作流引擎驱动
5. **实时预算控制:** 付款和报销实时与预算对比，超预算自动预警或阻止

**模块关系图:**

```
Budget (预算: Study/Site)
  |
  +--[关联]--> Contract (合同)
  |                |
  |                +--[里程碑]--> Payment (中心付款)
  |                |
  |                +--[费率]--> Invoice (发票)
  |                                |
  |                                +--[三单匹配]--> Reconciliation (对账)
  |
  +--[患者补贴费率]--> Reimbursement (患者补贴)
```

---

### M11a: Budget Management -- 预算管理

**模块目标:** 管理研究层面和站点层面的预算编制与执行监控，支持预算分项（line items）、实际 vs 预算对比分析、超预算预警，确保临床试验的财务可控性。

**子功能清单:**

| 序号 | 子功能 | 描述 | 关键操作 |
|------|--------|------|----------|
| B01 | 预算编制 | 按 Study/Site 创建预算，包含多项费用明细 | 新建预算、行项目编辑、预算模板导入 |
| B02 | 预算审批 | 通过 Flowable 工作流审批预算 | 提交审批、多级审批、审批链配置 |
| B03 | 预算修订 | 预算调整和版本管理，支持补充预算 | 预算修订、版本对比、调整原因记录 |
| B04 | 预算执行监控 | 实时对比实际支出与预算，计算执行率 | 执行率仪表板、偏差分析、趋势图 |
| B05 | 超预算预警 | 预算项目支出超出阈值时自动预警 | 预警阈值配置、自动通知、超预算阻止 |
| B06 | 预算报表 | 多维度预算分析报表（研究/站点/费用类型/时间） | 预算汇总表、预算 vs 实际表、导出 Excel |

**核心交互流程:**

1. 预算管理员创建研究级预算，设定总预算金额、币种、费用分类（Category）
2. 在预算下添加行项目（Line Items），每项包含：费用类型（PI 费用/CRC 费用/受试者补贴/实验室费用/影像费用/管理费/其他）、预算金额、计量单位、单价、数量
3. 如有多站点，按站点分解预算；站点预算合计不得超过研究总预算
4. 预算草案提交 Flowable 审批链：预算管理员 -> PM -> Finance Manager -> Sponsor 代表
5. 审批通过后预算生效，后续付款和报销实时扣减对应行项目的剩余预算
6. 若需要调整预算，创建预算修订版本（budget_revision），填写调整原因，走简版审批流程
7. 系统实时计算各维度（Study/Site/Category/Line Item）的预算执行率，超 90% 黄色预警，超 100% 红色预警
8. 超预算阻止策略：阻止付款（硬控）/ 仅警告（软控），按配置决定

**关键状态流转:**

| 当前状态 | 目标状态 | 触发动作 | 触发角色 | 前置条件 |
|----------|----------|----------|----------|----------|
| draft | submitted | 提交审批 | 预算管理员 | 至少有一个 line item |
| submitted | approved | 审批通过 | 审批链完成 | Flowable 审批链完成 |
| submitted | draft | 审批驳回 | 审批人 | 驳回原因非空 |
| approved | effective | 生效日期到达 | System | 生效日期 <= 当前日期 |
| effective | superseded | 新版本生效 | System | 预算修订版审批通过 |
| effective | closed | 研究关闭 | PM/System | 所有付款已完成 |

**核心字段:**

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| budget_id | UUIDv7 (PK) | 是 | 主键 |
| budget_no | VARCHAR(32) | 是 | BGT-{STUDY}-{SEQ} |
| title | VARCHAR(200) | 是 | 预算名称 |
| total_amount | DECIMAL(18,2) | 是 | 总预算金额（本位币） |
| currency | VARCHAR(3) | 是 | 币种（ISO 4217） |
| category | VARCHAR(32) | 是 | STUDY / SITE |
| status | VARCHAR(20) | 是 | draft/submitted/approved/effective/superseded/closed |
| version | INT | 是 | 版本号 |
| effective_date | DATE | 否 | 生效日期 |
| line_items | JSONB | 否 | [{item_no, item_type, description, budget_amount, unit_price, quantity, unit, remaining_amount, consumed_amount}] |
| related_study_id | UUIDv7 | 是 | 关联研究 ID |
| related_site_id | UUIDv7 | 否 | 关联站点 ID（SITE 级预算必填） |
| parent_budget_id | UUIDv7 | 否 | 上级预算 ID（SITE 级预算关联 Study 级） |
| flowable_process_instance_id | VARCHAR(64) | 否 | Flowable 审批实例 ID |
| budget_history | JSONB | 否 | 操作历史 |
| is_deleted | BOOLEAN | 是 | 软删除 |
| created_by | UUIDv7 | 是 | 创建人 |
| created_at | TIMESTAMPTZ | 是 | 创建时间 |
| updated_at | TIMESTAMPTZ | 是 | 更新时间 |

**关联 REST API:**

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api/v1/budgets | 分页查询预算列表 |
| GET | /api/v1/budgets/{budgetId} | 获取预算详情含执行率 |
| POST | /api/v1/budgets | 创建预算 |
| PUT | /api/v1/budgets/{budgetId} | 更新预算（仅 draft） |
| POST | /api/v1/budgets/{budgetId}/submit | 提交审批 |
| PUT | /api/v1/budgets/{budgetId}/approve | 审批通过 |
| PUT | /api/v1/budgets/{budgetId}/reject | 审批驳回 |
| POST | /api/v1/budgets/{budgetId}/revise | 创建预算修订版 |
| GET | /api/v1/budgets/{budgetId}/execution | 获取预算执行详情 |
| GET | /api/v1/budgets/report | 获取预算汇总报表 |

---

### M11b: Contract Management -- 合同管理

**模块目标:** 管理临床试验相关合同的完整生命周期，包括 CRO 合同、Site 合同、供应商合同等，提供合同起草、审批（Flowable）、签署追踪、到期管理功能。

**子功能清单:**

| 序号 | 子功能 | 描述 | 关键操作 |
|------|--------|------|----------|
| CT01 | 合同创建 | 创建合同记录，关联预算和合同方 | 新建合同、合同模板、条款编辑 |
| CT02 | 合同审批 | Flowable 工作流驱动的多级审批 | 提交审批、逐级审批、法务审批 |
| CT03 | 签署追踪 | 合同签署状态管理，支持电子签 | 签署状态更新、签署文件上传、签署日期 |
| CT04 | 合同执行 | 合同生效后的执行状态跟踪 | 里程碑达成确认、合同变更 |
| CT05 | 合同到期管理 | 合同到期预警和续期管理 | 到期提醒、续期/终止流程 |

**核心交互流程:**

1. PM 或合同管理员创建合同，选择合同类型（CRO/Site/Vendor/Consultant/Other），关联 Study/Site/Budget
2. 填写合同条款：合同金额、币种、付款条款（% 里程碑）、合同有效期、终止条件、保密条款等
3. 上传合同文件草稿，提交 Flowable 审批链：PM -> 法务（Legal）-> Finance Manager -> Sponsor 代表
4. 审批通过后，合同进入签署阶段；跟踪双方签署状态（待签署/已签署/已驳回）
5. 双方签署完成后合同生效，开始执行；合同中的付款里程碑自动生成 Payment 记录
6. 合同到期前自动通知相关人员，可发起续期或终止流程

**关键状态流转:**

| 当前状态 | 目标状态 | 触发动作 | 触发角色 |
|----------|----------|----------|----------|
| draft | under_review | 提交审批 | PM/合同管理员 |
| under_review | approved | 所有审批人通过 | 审批链完成 |
| under_review | draft | 审批驳回 | 审批人 |
| approved | pending_signature | 发送签署 | PM |
| pending_signature | executed | 双方签署完成 | PM |
| executed | amended | 合同修订 | PM |
| executed | terminated | 合同终止 | PM |
| executed | expired | 合同到期 | System |

**核心字段:**

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| contract_id | UUIDv7 (PK) | 是 | 主键 |
| contract_no | VARCHAR(32) | 是 | CTR-{STUDY}-{SEQ} |
| title | VARCHAR(200) | 是 | 合同名称 |
| contract_type | VARCHAR(20) | 是 | CRO/SITE/VENDOR/CONSULTANT/OTHER |
| total_amount | DECIMAL(18,2) | 是 | 合同总金额 |
| currency | VARCHAR(3) | 是 | 币种 |
| status | VARCHAR(20) | 是 | draft/under_review/approved/pending_signature/executed/amended/terminated/expired |
| effective_date | DATE | 否 | 生效日期 |
| expiry_date | DATE | 否 | 到期日期 |
| payment_terms | JSONB | 否 | 付款条款 [{milestone, percentage, amount, due_date}] |
| related_study_id | UUIDv7 | 是 | 关联研究 ID |
| related_site_id | UUIDv7 | 否 | 关联站点 ID |
| budget_id | UUIDv7 | 否 | 关联预算 ID |
| counterparty_name | VARCHAR(200) | 是 | 合同方名称 |
| counterparty_info | JSONB | 否 | 合同方详细信息 |
| signed_by_sponsor_date | DATE | 否 | 申办方签署日期 |
| signed_by_counterparty_date | DATE | 否 | 合同方签署日期 |
| flowable_process_instance_id | VARCHAR(64) | 否 | Flowable 审批实例 ID |
| contract_file_id | UUIDv7 | 否 | 合同文件 ID |
| signed_file_id | UUIDv7 | 否 | 签署后文件 ID |
| contract_history | JSONB | 否 | 操作历史 |
| is_deleted | BOOLEAN | 是 | 软删除 |
| created_by | UUIDv7 | 是 | 创建人 |
| created_at | TIMESTAMPTZ | 是 | 创建时间 |
| updated_at | TIMESTAMPTZ | 是 | 更新时间 |

**关联 REST API:**

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api/v1/contracts | 分页查询合同列表 |
| GET | /api/v1/contracts/{contractId} | 获取合同详情 |
| POST | /api/v1/contracts | 创建合同 |
| PUT | /api/v1/contracts/{contractId} | 更新合同 |
| POST | /api/v1/contracts/{contractId}/submit | 提交审批 |
| PUT | /api/v1/contracts/{contractId}/approve | 审批通过 |
| PUT | /api/v1/contracts/{contractId}/sign | 签署确认 |
| PUT | /api/v1/contracts/{contractId}/terminate | 终止合同 |
| PUT | /api/v1/contracts/{contractId}/amend | 合同修订 |
| GET | /api/v1/contracts/expiring | 获取即将到期合同 |

---

### M11c: Payment Management -- 中心付款管理

**模块目标:** 管理研究中心款项支付的全流程，包括付款计划生成、付款审批、实际付款记录和付款状态跟踪，支持里程碑付款和定期付款两种模式。

**子功能清单:**

| 序号 | 子功能 | 描述 | 关键操作 |
|------|--------|------|----------|
| P01 | 付款计划生成 | 根据合同付款条款自动生成付款计划 | 付款计划生成、里程碑触发 |
| P02 | 付款审批 | Flowable 付款审批流程 | 付款申请提交、多级审批 |
| P03 | 付款执行 | 记录实际付款信息和凭证 | 付款日期、银行流水号、付款凭证上传 |
| P04 | 付款跟踪 | 付款状态实时跟踪和查询 | 付款状态看板、付款历史查询 |

**核心交互流程:**

1. 合同生效后，系统根据合同的 payment_terms 自动生成付款计划（Payment Schedule）
2. 当合同里程碑达成时（如 Site Initiation 完成），PM 或 CRA 确认里程碑，系统自动创建付款申请
3. 付款申请包含：合同信息、里程碑描述、付款金额、收款方银行信息、关联发票（如有）
4. 付款申请提交 Flowable 审批：PM -> Finance Manager -> Sponsor 代表（按金额阈值升级）
5. 审批通过后，Finance 执行实际付款，录入付款日期、银行交易流水号、上传付款凭证
6. 付款完成后更新 Payment 状态为 paid，同步更新预算消耗金额

**关键状态流转:**

| 当前状态 | 目标状态 | 触发动作 | 触发角色 |
|----------|----------|----------|----------|
| planned | requested | 里程碑达成，发起付款申请 | PM/CRA |
| requested | approved | 审批通过 | 审批链完成 |
| requested | rejected | 审批驳回 | 审批人 |
| approved | paid | 实际付款完成 | Finance |
| paid | reconciled | 对账完成 | System/Finance |
| planned | cancelled | 里程碑取消/合同变更 | PM |

**核心字段:**

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| payment_id | UUIDv7 (PK) | 是 | 主键 |
| payment_no | VARCHAR(32) | 是 | PMT-{STUDY}-{SEQ} |
| contract_id | UUIDv7 | 是 | 关联合同 ID |
| budget_id | UUIDv7 | 否 | 关联预算 ID |
| milestone_name | VARCHAR(100) | 是 | 里程碑名称 |
| amount | DECIMAL(18,2) | 是 | 付款金额 |
| currency | VARCHAR(3) | 是 | 币种 |
| status | VARCHAR(20) | 是 | planned/requested/approved/rejected/paid/reconciled/cancelled |
| payment_method | VARCHAR(20) | 否 | 付款方式：BANK_TRANSFER/CHEQUE/OTHER |
| payment_date | DATE | 否 | 实际付款日期 |
| transaction_reference | VARCHAR(100) | 否 | 银行交易流水号 |
| payee_name | VARCHAR(200) | 是 | 收款方名称 |
| payee_bank_info | JSONB | 否 | 收款方银行信息 |
| related_study_id | UUIDv7 | 是 | 关联研究 ID |
| related_site_id | UUIDv7 | 否 | 关联站点 ID |
| flowable_process_instance_id | VARCHAR(64) | 否 | Flowable 审批实例 ID |
| payment_evidence | JSONB | 否 | 付款凭证 [{file_id, description}] |
| payment_history | JSONB | 否 | 操作历史 |
| is_deleted | BOOLEAN | 是 | 软删除 |
| created_by | UUIDv7 | 是 | 创建人 |
| created_at | TIMESTAMPTZ | 是 | 创建时间 |
| updated_at | TIMESTAMPTZ | 是 | 更新时间 |

**关联 REST API:**

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api/v1/payments | 分页查询付款列表 |
| GET | /api/v1/payments/{paymentId} | 获取付款详情 |
| POST | /api/v1/payments | 创建付款记录 |
| POST | /api/v1/payments/{paymentId}/request | 发起付款申请 |
| PUT | /api/v1/payments/{paymentId}/approve | 审批通过 |
| PUT | /api/v1/payments/{paymentId}/reject | 审批驳回 |
| PUT | /api/v1/payments/{paymentId}/execute | 执行付款 |
| PUT | /api/v1/payments/{paymentId}/cancel | 取消付款 |
| GET | /api/v1/payments/schedule | 获取付款计划 |

---

### M11d: Patient Reimbursement -- 患者补贴管理

**模块目标:** 管理受试者参与临床试验的交通、住宿、误工等补贴的申请、审批和发放流程，支持收据上传审核和批量发放。

**子功能清单:**

| 序号 | 子功能 | 描述 | 关键操作 |
|------|--------|------|----------|
| R01 | 补贴申请 | CRC 代受试者提交补贴申请 | 新建申请、费用类型、收据上传 |
| R02 | 补贴审批 | PI/PM 审批补贴申请 | 审批通过/驳回、金额调整 |
| R03 | 补贴发放 | 记录实际发放信息 | 发放日期、发放方式、签收确认 |
| R04 | 补贴标准管理 | 按 Study/Site 配置补贴标准 | 交通费标准、住宿费上限、误工费标准 |

**核心交互流程:**

1. CRC 根据受试者实际到院情况，在补贴管理界面为受试者创建补贴申请
2. 填写补贴类型（交通/住宿/误工/其他）、申请金额、发生日期、上传收据/票据照片
3. 补贴申请提交 PI 审批；PI 审核收据的合理性和真实性
4. PI 审批通过后，若金额超阈值，自动提升到 PM/Finance 审批
5. 审批通过，Finance 安排发放；发放方式：银行转账/现金/支付宝/微信
6. 发放完成后，受试者或 CRC 确认收款（签收）

**关键状态流转:**

| 当前状态 | 目标状态 | 触发动作 | 触发角色 |
|----------|----------|----------|----------|
| draft | submitted | CRC 提交申请 | CRC |
| submitted | approved | PI/PM 审批通过 | PI/PM/Finance |
| submitted | rejected | 审批驳回 | 审批人 |
| approved | paid | 发放完成 | Finance |
| paid | confirmed | 受试者确认收款 | CRC/Subject |

**核心字段:**

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| reimbursement_id | UUIDv7 (PK) | 是 | 主键 |
| reimbursement_no | VARCHAR(32) | 是 | RMB-{STUDY}-{SUBJECT}-{SEQ} |
| expense_type | VARCHAR(20) | 是 | TRANSPORT/ACCOMMODATION/MEAL/LOST_WAGES/OTHER |
| amount | DECIMAL(18,2) | 是 | 申请金额 |
| currency | VARCHAR(3) | 是 | 币种 |
| status | VARCHAR(20) | 是 | draft/submitted/approved/rejected/paid/confirmed |
| occurrence_date | DATE | 是 | 费用发生日期 |
| payment_method | VARCHAR(20) | 否 | BANK_TRANSFER/CASH/ALIPAY/WECHAT |
| payment_date | DATE | 否 | 发放日期 |
| receipt_file_ids | UUID[] | 否 | 收据/票据文件 ID 数组 |
| related_study_id | UUIDv7 | 是 | 关联研究 ID |
| related_site_id | UUIDv7 | 是 | 关联站点 ID |
| related_subject_id | UUIDv7 | 是 | 关联受试者 ID |
| related_visit_id | UUIDv7 | 否 | 关联访视 ID |
| budget_id | UUIDv7 | 否 | 关联预算 ID |
| confirmation_date | DATE | 否 | 确认收款日期 |
| confirmed_by | UUIDv7 | 否 | 确认人 ID |
| reimbursement_history | JSONB | 否 | 操作历史 |
| is_deleted | BOOLEAN | 是 | 软删除 |
| created_by | UUIDv7 | 是 | 创建人 |
| created_at | TIMESTAMPTZ | 是 | 创建时间 |
| updated_at | TIMESTAMPTZ | 是 | 更新时间 |

**关联 REST API:**

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api/v1/reimbursements | 分页查询补贴列表 |
| GET | /api/v1/reimbursements/{reimbursementId} | 获取补贴详情 |
| POST | /api/v1/reimbursements | 创建补贴申请 |
| POST | /api/v1/reimbursements/{reimbursementId}/submit | 提交申请 |
| PUT | /api/v1/reimbursements/{reimbursementId}/approve | 审批通过 |
| PUT | /api/v1/reimbursements/{reimbursementId}/reject | 审批驳回 |
| PUT | /api/v1/reimbursements/{reimbursementId}/pay | 确认发放 |
| PUT | /api/v1/reimbursements/{reimbursementId}/confirm | 确认收款 |
| GET | /api/v1/reimbursements/standards | 获取补贴标准配置 |

---

### M11e: Invoice Management -- 发票管理

**模块目标:** 管理中心/Site 开具的发票，支持发票登记、验证和与合同/付款的三单匹配（Invoice-Contract-Payment three-way matching）。

**子功能清单:**

| 序号 | 子功能 | 描述 | 关键操作 |
|------|--------|------|----------|
| IN01 | 发票登记 | 录入收到的发票信息 | 新建发票、OCR 发票识别、发票金额核对 |
| IN02 | 发票验证 | 验证发票真伪和有效性 | 税务系统对接验证、发票状态标记 |
| IN03 | 三单匹配 | 发票与合同、付款的自动匹配 | 匹配规则配置、自动匹配、人工差异处理 |

**核心交互流程:**

1. Finance 收到发票后，在系统中登记发票信息：发票号码、开票日期、金额、税率、开票方
2. 系统通过 OCR 自动识别上传的发票图片，提取发票号码、金额、日期等关键字段
3. 系统自动进行三单匹配：（a）发票 vs 合同（金额一致性、开票方一致性）；（b）发票 vs 付款（金额匹配、时间匹配）
4. 匹配成功自动标记，匹配失败（差异 > 容差阈值）触发人工差异处理流程
5. 匹配完成后发票状态更新为 matched，可进行付款

**关键状态流转:**

| 当前状态 | 目标状态 | 触发动作 | 触发角色 |
|----------|----------|----------|----------|
| registered | verified | 发票验证通过 | Finance/System |
| registered | rejected | 发票验证失败 | Finance |
| verified | matched | 三单匹配成功 | System |
| verified | unmatched | 三单匹配失败需人工处理 | System |
| unmatched | matched | 差异处理完成 | Finance |
| matched | paid | 关联付款完成 | System |

**核心字段:**

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| invoice_id | UUIDv7 (PK) | 是 | 主键 |
| invoice_no | VARCHAR(32) | 是 | 业务编号 INV-{STUDY}-{SEQ} |
| invoice_number | VARCHAR(100) | 是 | 发票原始号码 |
| invoice_date | DATE | 是 | 开票日期 |
| amount | DECIMAL(18,2) | 是 | 发票金额 |
| tax_amount | DECIMAL(18,2) | 否 | 税额 |
| total_amount | DECIMAL(18,2) | 是 | 含税总金额 |
| currency | VARCHAR(3) | 是 | 币种 |
| tax_rate | DECIMAL(5,2) | 否 | 税率 % |
| status | VARCHAR(20) | 是 | registered/verified/rejected/matched/unmatched/paid |
| issuer_name | VARCHAR(200) | 是 | 开票方名称 |
| issuer_tax_id | VARCHAR(50) | 否 | 开票方税号 |
| contract_id | UUIDv7 | 否 | 关联合同 ID |
| payment_id | UUIDv7 | 否 | 关联付款 ID |
| related_study_id | UUIDv7 | 是 | 关联研究 ID |
| related_site_id | UUIDv7 | 否 | 关联站点 ID |
| ocr_data | JSONB | 否 | OCR 识别原始数据 |
| match_result | JSONB | 否 | 三单匹配结果 [{match_type, matched, difference, tolerance}] |
| invoice_file_id | UUIDv7 | 否 | 发票图片/PDF 文件 ID |
| invoice_history | JSONB | 否 | 操作历史 |
| is_deleted | BOOLEAN | 是 | 软删除 |
| created_by | UUIDv7 | 是 | 创建人 |
| created_at | TIMESTAMPTZ | 是 | 创建时间 |
| updated_at | TIMESTAMPTZ | 是 | 更新时间 |

**关联 REST API:**

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api/v1/invoices | 分页查询发票列表 |
| GET | /api/v1/invoices/{invoiceId} | 获取发票详情 |
| POST | /api/v1/invoices | 登记发票 |
| POST | /api/v1/invoices/ocr | OCR 发票识别 |
| PUT | /api/v1/invoices/{invoiceId}/verify | 验证发票 |
| POST | /api/v1/invoices/{invoiceId}/match | 执行三单匹配 |
| PUT | /api/v1/invoices/{invoiceId}/resolve-discrepancy | 差异处理 |
| GET | /api/v1/invoices/unmatched | 获取未匹配发票列表 |

---

### M11f: Reconciliation -- 对账管理

**模块目标:** 提供自动化的财务对账功能，支持合同金额 vs 付款金额 vs 发票金额的自动比对，识别差异并触发差异处理流程。

**子功能清单:**

| 序号 | 子功能 | 描述 | 关键操作 |
|------|--------|------|----------|
| RC01 | 自动对账规则 | 配置对账规则，定义匹配维度和容差阈值 | 规则配置、匹配维度定义、容差设置 |
| RC02 | 自动对账执行 | 定时执行对账，生成对账报告 | 定时任务、对账运行、报告生成 |
| RC03 | 差异处理 | 对账差异的人工处理流程 | 差异标注、差异原因填写、调整/核销 |
| RC04 | 对账历史 | 对账记录和历史的查询 | 历史对账报告、差异追踪 |

**核心交互流程:**

1. Finance 配置对账规则：匹配维度（金额/日期/币种）、容差阈值（金额差异 < 1% 自动通过）、对账周期（月/季）
2. 系统定时（每月月末）或手动触发对账，按规则比对：Contract milestone payments vs Payment records vs Invoice records
3. 对账完成后生成对账报告（Reconciliation Report），列出所有匹配项和差异项
4. 差异项进入差异处理流程，Finance 人工调查差异原因（汇率差/时间差/数据错误/未登记发票）
5. Finance 完成差异处理后，关闭对账周期

**关键状态流转:**

| 当前状态 | 目标状态 | 触发动作 | 触发角色 |
|----------|----------|----------|----------|
| pending | in_progress | 对账执行中 | System |
| in_progress | matched | 所有项目匹配成功 | System |
| in_progress | discrepancies_found | 发现差异 | System |
| discrepancies_found | reconciled | 所有差异处理完成 | Finance |
| reconciled | closed | 对账周期关闭 | Finance |

**核心字段:**

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| reconciliation_id | UUIDv7 (PK) | 是 | 主键 |
| reconciliation_no | VARCHAR(32) | 是 | REC-{STUDY}-{SEQ} |
| period_start | DATE | 是 | 对账周期起始日期 |
| period_end | DATE | 是 | 对账周期结束日期 |
| status | VARCHAR(24) | 是 | pending/in_progress/matched/discrepancies_found/reconciled/closed |
| total_contract_amount | DECIMAL(18,2) | 是 | 合同金额合计 |
| total_payment_amount | DECIMAL(18,2) | 是 | 付款金额合计 |
| total_invoice_amount | DECIMAL(18,2) | 是 | 发票金额合计 |
| discrepancy_total | DECIMAL(18,2) | 是 | 差异总额 |
| match_result | JSONB | 否 | 匹配详情 [{item, matched, difference, reason}] |
| discrepancies | JSONB | 否 | 差异清单 [{item, expected, actual, difference, reason, resolution}] |
| related_study_id | UUIDv7 | 是 | 关联研究 ID |
| related_site_id | UUIDv7 | 否 | 关联站点 ID |
| reconciliation_history | JSONB | 否 | 操作历史 |
| is_deleted | BOOLEAN | 是 | 软删除 |
| created_by | UUIDv7 | 是 | 创建人 |
| created_at | TIMESTAMPTZ | 是 | 创建时间 |
| updated_at | TIMESTAMPTZ | 是 | 更新时间 |

**关联 REST API:**

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api/v1/reconciliations | 分页查询对账列表 |
| GET | /api/v1/reconciliations/{reconciliationId} | 获取对账详情 |
| POST | /api/v1/reconciliations | 创建对账记录 |
| POST | /api/v1/reconciliations/{reconciliationId}/execute | 执行对账 |
| PUT | /api/v1/reconciliations/{reconciliationId}/resolve | 差异处理 |
| PUT | /api/v1/reconciliations/{reconciliationId}/close | 关闭对账 |
| GET | /api/v1/reconciliations/rules | 获取对账规则配置 |
| PUT | /api/v1/reconciliations/rules | 更新对账规则 |

---

### M11 模块整体异常场景:

| 场景 | 处理方式 | 用户提示 |
|------|----------|----------|
| 汇率波动导致对账差异 | 使用对账日汇率重算，差异在容差内自动通过 | "汇率差异 {amount}，在对账容差范围内，已自动匹配" |
| 合同金额与付款总额不匹配 | 标记为差异，要求 Finance 核实 | "合同 CTR-XXX 金额与付款总额不一致，差额 {amount}" |
| 发票重复登记 | OCR/发票号查重，阻止重复登记 | "发票 {number} 已在系统中登记（INV-XXX），不可重复登记" |
| 预算超支仍发起付款 | 阻止付款（硬控）或警告（软控），按配置 | "付款金额超出预算剩余额度 {amount}，无法完成付款" |
| 三单匹配中发票金额与合同/付款不符 | 自动标记差异，通知 Finance | "发票 INV-XXX 与关联合同/付款金额不一致，需人工处理" |

### M11 模块整体权限要求:

| 角色 | 查看 | 创建 | 编辑 | 删除 | 特殊权限 |
|------|------|------|------|------|----------|
| Admin | 全部 | 全部 | 全部 | 可硬删除 | 可修改任何财务数据 |
| Finance | 管辖 Study | 管辖 Study | 管辖 Study | 否 | 所有财务操作（付款执行、发票验证、对账处理） |
| PM | 管辖 Study | 管辖 Study（预算/合同） | 管辖 Study（未生效/未执行） | 否 | 可查看所有财务数据、发起付款申请 |
| CRA | 管辖 Site | 否 | 否 | 否 | 仅查看 Site 相关合同/付款摘要 |
| CRC | 管辖 Site | 管辖 Site（补贴） | 管辖 Site（补贴） | 否 | 可创建补贴申请、查看 Site 付款摘要 |
| PI | 管辖 Site | 否 | 否 | 否 | 可审批补贴、查看 Site 付款摘要 |
| Sponsor | 管辖 Study（汇总） | 否 | 否 | 否 | 仅查看财务汇总报表 |
| ReadOnlyAuditor | 全部（只读） | 否 | 否 | 否 | 完整财务审计查看权限 |

**关联数据实体:** Study, Site, Subject, Budget, Contract, Payment, Reimbursement, Invoice, Reconciliation, FileObject, AuditLog

---


## M12: 消息 / 待办 / 周报 / 月报 / 自动摘要

### M12 模块概述

M12 是临床试验项目管理的统一通知中心和智能报告平台，覆盖即时消息推送、结构化待办管理、周期性自动报告生成（周报/月报）以及 AI 自动摘要功能。该模块通过 RabbitMQ 实现多通道消息投递（App 内/微信/邮件/短信），通过 Spring 定时任务 + FreeMarker 模板引擎生成周期性报告，并利用 LLM（如 GPT-4o）对近期活动进行智能摘要。

**设计原则:**

1. **多通道统一:** 所有通知统一由 Notification Center 管理，各通道（App/WeChat/Email/SMS）作为 delivery channel 插件化接入
2. **优先级分层:** 消息和待办均支持优先级（P0-P4），P0/P1 消息强制推送多通道
3. **模板化报告:** 周期报告基于 FreeMarker 模板生成，支持 PDF/HTML/邮件三种输出格式
4. **AI 摘要可控:** AI 生成的摘要需经人工确认后才能发送给 Sponsor 或纳入正式报告
5. **待办闭环:** 待办与各业务模块（Query/Issue/CAPA/AE 等）双向关联，处理完成后自动标记待办为完成

**通知架构图:**

```
业务事件 (Query created / SAE escalated / Visit overdue / ...)
  |
  v
Notification Event (RabbitMQ Exchange: pms.notifications)
  |
  +--> Notification Service (路由分发)
         |
         +--> In-App Notification (WebSocket/SSE 推送)
         +--> WeChat Template Message (微信公众号模板消息)
         +--> Email Notification (SMTP, 可选)
         +--> SMS Notification (阿里云短信, 可选)
         |
         +--> Todo Service (待办项创建/更新)
         +--> Report Service (周报/月报数据聚合)
```

---

### M12a: Notification Center -- 统一通知中心

**模块目标:** 提供统一的消息通知平台，支持多渠道推送、消息模板管理、用户通知偏好设置和已读/未读管理，确保关键业务事件能及时送达正确的角色。

**子功能清单:**

| 序号 | 子功能 | 描述 | 关键操作 |
|------|--------|------|----------|
| N01 | 消息通知生成 | 业务事件触发自动消息生成 | 事件监听、消息模板渲染、优先级确定 |
| N02 | 多渠道推送 | 根据用户偏好和消息优先级选择推送通道 | App 内推送、微信模板、邮件、短信 |
| N03 | 消息中心 UI | 统一的消息列表（收件箱） | 消息列表、已读/未读筛选、批量标记已读 |
| N04 | 通知偏好设置 | 用户可自定义各类型通知的接收通道和开关 | 偏好配置、通道开关、免打扰时段设置 |
| N05 | 消息模板管理 | 管理员可配置各类消息的模板 | 模板增删改查、变量定义、预览测试 |
| N06 | 消息追踪 | 消息发送/到达/阅读状态追踪 | 发送日志、送达率统计、阅读率统计 |

**核心交互流程:**

1. 业务模块发布领域事件到 RabbitMQ（如 Query.created、SAE.escalated、Visit.overdue 等）
2. Notification Service 监听事件，根据事件类型匹配消息模板（Notification Template），填充变量后生成 Notification 记录
3. 系统根据消息优先级和用户通知偏好选择推送通道：P0(紧急) -> 所有通道强制推送；P1(高) -> App + 微信；P2(中) -> App 内；P3(低) -> App 内免打扰时段延迟
4. App 内通知通过 WebSocket/SSE 实时推送到前端；前端在导航栏显示未读消息数红点
5. 用户点击消息可跳转到关联业务页面（如 Query 详情、SAE 详情）；系统标记消息为已读
6. 消息在系统中保留 90 天，超期自动归档（软删除）

**核心字段:**

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| notification_id | UUIDv7 (PK) | 是 | 主键 |
| recipient_id | UUIDv7 | 是 | 接收人 ID |
| title | VARCHAR(200) | 是 | 通知标题 |
| content | TEXT | 是 | 通知内容（支持 HTML/Markdown） |
| notification_type | VARCHAR(32) | 是 | 类型：QUERY / ISSUE / CAPA / DEVIATION / AE / SAE / VISIT / DOCUMENT / PAYMENT / SYSTEM |
| priority | VARCHAR(2) | 是 | 优先级：P0/P1/P2/P3 |
| channels | JSONB | 是 | 推送通道 [{channel, status, sent_at}] |
| status | VARCHAR(16) | 是 | unread / read / archived |
| source_event | VARCHAR(32) | 是 | 来源事件如 query.created |
| source_entity_type | VARCHAR(32) | 否 | 源实体类型 |
| source_entity_id | UUIDv7 | 否 | 源实体 ID（可跳转） |
| read_at | TIMESTAMPTZ | 否 | 阅读时间 |
| is_deleted | BOOLEAN | 是 | 软删除 |
| created_at | TIMESTAMPTZ | 是 | 创建时间 |

**关联 REST API:**

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api/v1/notifications | 获取当前用户通知列表 |
| GET | /api/v1/notifications/unread-count | 获取未读通知数量 |
| PUT | /api/v1/notifications/{notificationId}/read | 标记单条已读 |
| PUT | /api/v1/notifications/read-all | 批量标记已读 |
| PUT | /api/v1/notifications/preferences | 更新通知偏好 |
| GET | /api/v1/notifications/preferences | 获取通知偏好 |
| GET | /api/v1/notifications/templates | 获取消息模板列表（Admin） |
| POST | /api/v1/notifications/templates | 创建消息模板 |
| PUT | /api/v1/notifications/templates/{templateId} | 更新消息模板 |

---

### M12b: Todo List -- 待办管理

**模块目标:** 提供结构化的待办任务管理功能，与各业务模块双向关联，支持优先级排序、截止日期追踪、批量操作和完成/驳回生命周期管理。

**子功能清单:**

| 序号 | 子功能 | 描述 | 关键操作 |
|------|--------|------|----------|
| T01 | 待办自动生成 | 业务事件自动创建待办项 | 事件监听、待办创建、关联源实体 |
| T02 | 待办列表与筛选 | 支持和排序筛选的待办列表 | 按优先级/截止日期/类型筛选排序 |
| T03 | 待办处理 | 用户处理待办，跳转到业务页面 | 处理、驳回、延期、转交 |
| T04 | 待办统计 | 待办完成率和时效统计 | 个人统计、团队统计、SLA 达标率 |

**核心交互流程:**

1. 当业务流程要求用户操作时（如 Query 等待 CRC 回复、Issue 等待 PM 分诊、CAPA 等待审批），系统自动创建 Todo 记录
2. Todo 记录包含：标题、描述、优先级、截止日期、关联实体类型和 ID（可跳转）、处理人
3. 用户在 Todo 列表中看到待办，点击进入关联的业务详情页执行操作
4. 用户处理完成后，业务模块更新实体状态，同时发送事件通知 Todo Service 更新待办状态为 completed
5. 若用户超过截止日期未处理，Todo 状态自动变为 overdue，并发送催办通知
6. 用户可以使用"转交"功能将待办转交给其他用户

**核心字段:**

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| todo_id | UUIDv7 (PK) | 是 | 主键 |
| assignee_id | UUIDv7 | 是 | 被分配人 ID |
| title | VARCHAR(200) | 是 | 待办标题 |
| description | TEXT | 否 | 待办描述 |
| todo_type | VARCHAR(32) | 是 | 类型：QUERY_RESPONSE / ISSUE_TRIAGE / CAPA_APPROVAL / DEVIATION_ASSESS / AE_ASSESS / SAE_REVIEW / DOC_APPROVAL / PAYMENT_APPROVAL / OTHER |
| priority | VARCHAR(2) | 是 | P0/P1/P2/P3/P4 |
| status | VARCHAR(16) | 是 | pending / in_progress / completed / overdue / cancelled |
| source_entity_type | VARCHAR(32) | 是 | 源实体类型 |
| source_entity_id | UUIDv7 | 是 | 源实体 ID |
| due_date | TIMESTAMPTZ | 否 | 截止日期 |
| completed_at | TIMESTAMPTZ | 否 | 完成时间 |
| reassignable | BOOLEAN | 是 | 是否允许转交 |
| related_study_id | UUIDv7 | 否 | 关联研究 |
| is_deleted | BOOLEAN | 是 | 软删除 |
| created_at | TIMESTAMPTZ | 是 | 创建时间 |
| updated_at | TIMESTAMPTZ | 是 | 更新时间 |

**关联 REST API:**

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api/v1/todos | 获取当前用户待办列表 |
| GET | /api/v1/todos/{todoId} | 获取待办详情 |
| PUT | /api/v1/todos/{todoId}/start | 开始处理 |
| PUT | /api/v1/todos/{todoId}/complete | 标记完成 |
| PUT | /api/v1/todos/{todoId}/delegate | 转交他人 |
| GET | /api/v1/todos/statistics | 获取待办统计数据 |
| GET | /api/v1/todos/overdue | 获取逾期待办列表 |

---

### M12c: Weekly/Monthly Auto Reports -- 周期自动报告

**模块目标:** 按周/月自动生成并分发标准化的临床试验运营报告，包括入组周报、安全月报、监查状态报告、财务汇总报告等，支持 PDF 和 HTML 格式输出。

**子功能清单:**

| 序号 | 子功能 | 描述 | 关键操作 |
|------|--------|------|----------|
| R01 | 入组周报 | 每周自动生成入组进度报告 | 入组数/筛选数/失败数/完成数统计 |
| R02 | 安全月报 | 每月自动生成安全事件汇总报告 | AE/SAE/SUSAR 数量统计和趋势 |
| R03 | 监查状态报告 | 站点监查进度和发现汇总 | 监查次数/Query 数量/Issue 数量 |
| R04 | 财务汇总报告 | 预算执行率/付款/发票/对账汇总 | 预算 vs 实际、未结款项 |
| R05 | 报告分发 | 自动通过邮件分发报告给指定角色 | 分发列表配置、定时发送、发送日志 |
| R06 | 报告模板管理 | 管理各类型报告的 FreeMarker 模板 | 模板编辑、变量配置、预览 |

**核心交互流程:**

1. Admin 或 PM 配置报告模板（FreeMarker HTML 模板）和分发列表
2. 系统定时任务在配置的时间点（如每周一 08:00 生成上周周报，每月 1 日生成上月月报）自动触发报告生成
3. Report Service 从数据库聚合需要的数据：入组数据、安全数据、监查数据、财务数据
4. 将数据填充到 FreeMarker 模板，生成 HTML 报告，并转换为 PDF（使用 wkhtmltopdf 或 Puppeteer）
5. 根据分发列表自动通过邮件（含 PDF 附件 + HTML 正文）发送给相关角色
6. 报告在系统中保留副本，用户可在报告中心查看历史报告

**核心字段:**

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| report_id | UUIDv7 (PK) | 是 | 主键 |
| report_type | VARCHAR(32) | 是 | ENROLLMENT_WEEKLY / SAFETY_MONTHLY / MONITORING_STATUS / FINANCIAL_SUMMARY / CUSTOM |
| report_period_start | DATE | 是 | 报告周期起始日期 |
| report_period_end | DATE | 是 | 报告周期结束日期 |
| status | VARCHAR(16) | 是 | generating / generated / sent / failed |
| title | VARCHAR(200) | 是 | 报告标题 |
| html_content | TEXT | 否 | HTML 格式内容 |
| pdf_file_id | UUIDv7 | 否 | PDF 文件 ID |
| generation_params | JSONB | 否 | 生成参数 |
| distribution_list | JSONB | 否 | 分发列表 [{user_id, email, status}] |
| related_study_id | UUIDv7 | 是 | 关联研究 |
| generated_at | TIMESTAMPTZ | 否 | 生成时间 |
| sent_at | TIMESTAMPTZ | 否 | 发送时间 |
| is_deleted | BOOLEAN | 是 | 软删除 |
| created_at | TIMESTAMPTZ | 是 | 创建时间 |

**关联 REST API:**

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api/v1/reports | 获取报告列表 |
| GET | /api/v1/reports/{reportId} | 获取报告详情 |
| POST | /api/v1/reports/generate | 手动触发报告生成 |
| GET | /api/v1/reports/{reportId}/download | 下载报告 PDF |
| GET | /api/v1/reports/{reportId}/preview | 预览报告 HTML |
| GET | /api/v1/reports/templates | 获取报告模板列表 |
| PUT | /api/v1/reports/templates/{templateId} | 更新报告模板 |
| PUT | /api/v1/reports/distribution-list | 更新分发列表 |

---

### M12d: AI Auto Summary -- AI 自动摘要

**模块目标:** 利用 LLM（大语言模型）自动生成临床试验近期的关键活动摘要，涵盖入组进展、安全事件、数据质量、重要里程碑等，减少 PM 手工撰写周报/月报总结的时间。

**子功能清单:**

| 序号 | 子功能 | 描述 | 关键操作 |
|------|--------|------|----------|
| A01 | 近期活动聚合 | 自动聚合指定时间段内的关键活动数据 | 数据聚合、重要性排序、异常检测 |
| A02 | AI 摘要生成 | 调用 LLM 生成自然语言摘要 | LLM API 调用、Prompt 模板、摘要长度控制 |
| A03 | 人工审核确认 | PM 对 AI 摘要进行审核和修改 | 审核界面、在线编辑、确认/驳回 |
| A04 | 摘要历史 | 历史摘要的查询和对比 | 历史摘要列表、版本对比 |

**核心交互流程:**

1. PM 在报告界面点击"生成 AI 摘要"或系统定时任务在报告生成前自动触发
2. Summary Service 聚合指定周期内的关键数据：入组数变化、AE/SAE 新增、Query 趋势、Issue 趋势、重要里程碑、风险信号
3. 将聚合数据作为 context 传递给 LLM（使用 GPT-4o 或 DeepSeek），配合精心设计的 Prompt 模板生成摘要
4. LLM 返回摘要文本，系统保存为 draft 状态，推送给 PM 进行审核
5. PM 在审核界面查看 AI 摘要，可在线编辑修改，确认后标记为 confirmed
6. 确认后的摘要自动合并到周期报告的"摘要"部分

**核心字段:**

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| summary_id | UUIDv7 (PK) | 是 | 主键 |
| summary_type | VARCHAR(20) | 是 | WEEKLY / MONTHLY / AD_HOC |
| period_start | DATE | 是 | 摘要周期起始 |
| period_end | DATE | 是 | 摘要周期结束 |
| status | VARCHAR(16) | 是 | draft / confirmed / published |
| content | TEXT | 否 | AI 生成的摘要内容 |
| edited_content | TEXT | 否 | PM 编辑后的最终内容 |
| source_data | JSONB | 否 | 供 LLM 使用的原始聚合数据 |
| llm_model | VARCHAR(50) | 否 | 使用的 LLM 模型名称 |
| llm_tokens_used | INT | 否 | LLM Token 消耗量 |
| related_study_id | UUIDv7 | 是 | 关联研究 ID |
| reviewed_by | UUIDv7 | 否 | 审核人 ID |
| reviewed_at | TIMESTAMPTZ | 否 | 审核时间 |
| report_id | UUIDv7 | 否 | 关联报告 ID |
| is_deleted | BOOLEAN | 是 | 软删除 |
| created_at | TIMESTAMPTZ | 是 | 创建时间 |

**关联 REST API:**

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | /api/v1/summaries/generate | 生成 AI 摘要 |
| GET | /api/v1/summaries/{summaryId} | 获取摘要详情 |
| PUT | /api/v1/summaries/{summaryId}/edit | 编辑摘要 |
| PUT | /api/v1/summaries/{summaryId}/confirm | 确认摘要 |
| GET | /api/v1/summaries | 获取摘要历史列表 |

---

### M12 模块整体异常场景:

| 场景 | 处理方式 | 用户提示 |
|------|----------|----------|
| 微信模板消息发送失败（如用户未关注） | 降级到 App 内通知；记录失败日志 | App 内通知："SAE-XXX 需要您的审查（微信推送失败）" |
| 邮件发送服务不可用 | 降级到 App 内通知；标记待重试 | "邮件服务暂时不可用，通知已通过 App 内消息送达" |
| 周期报告生成时数据查询超时 | 分批查询，设置超时回退；标记部分数据缺失 | "报告生成部分数据缺失，请稍后重试完整报告" |
| LLM API 调用超时或配额耗尽 | 使用缓存的上一周期摘要模板填充 | "AI 摘要服务暂时不可用，已使用标准模板生成摘要" |
| 报告 PDF 生成失败（wkhtmltopdf 异常） | 仅发送 HTML 版本 | "PDF 生成失败，已发送 HTML 版本" |
| 待办关联的源实体已被删除 | 自动标记待办为 cancelled | "关联的业务记录已删除，此待办已自动取消" |

### M12 模块整体权限要求:

| 角色 | Notification | Todo | Reports | AI Summary |
|------|--------------|------|---------|-------------|
| Admin | 全部管理 | 全部管理 | 全部管理 | 全部管理 |
| PM | 管辖 Study | 管辖 Study（含委派） | 管辖 Study | 管辖 Study（审核确认） |
| CRA Lead | 管辖 Study | 管辖 Study | 管辖 Study（只读） | 管辖 Study（只读） |
| CRA | 管辖 Site | 管辖 Site | 管辖 Site（只读） | 否 |
| CRC | 管辖 Site | 管辖 Site | 否 | 否 |
| PI | 管辖 Site | 管辖 Site | 管辖 Site（只读） | 否 |
| Sponsor | 管辖 Study（摘要） | 否 | 管辖 Study（只读） | 管辖 Study（只读） |
| Finance | 管辖 Study（财务） | 管辖 Study（财务） | 管辖 Study（财务报告） | 否 |
| ReadOnlyAuditor | 只读 | 只读 | 只读 | 只读 |

**关联数据实体:** Notification, Todo, Report, Summary, Study, Site, User, AuditLog

---


## M13: 统计分析 / 入组预测 / 风险热力图

### M13 模块概述

M13 是临床试验的数据分析和可视化平台，覆盖传统的描述性统计分析（入组趋势、站点对比、Query 时效分析）、AI 驱动的入组完成日期预测以及多维度风险热力图。该模块通过 OpenSearch 聚合查询实现高性能数据检索，前端使用 Ant Design Charts / ECharts 实现丰富的交互式图表。

**设计原则:**

1. **实时与近实时:** 统计图表支持准实时刷新（每 5 分钟），大查询走 Redis 缓存
2. **可钻取:** 图表数据支持从 Study 级钻取到 Site 级、再到 Subject 级详情
3. **预测可解释:** AI 预测结果附带置信区间和关键影响因素说明
4. **权限控制:** 图表数据按用户角色和数据权限过滤（Sponsor 仅看汇总，PI 仅看自己 Site）

**技术架构:**

```
数据源 (PostgreSQL + OpenSearch)
  |
  +--> 定时聚合任务 (Spring @Scheduled + Redis Cache)
  |       |
  |       +--> 统计数据缓存 (Redis, TTL 5min)
  |
  +--> AI 预测模型 (Python Microservice / ML Service)
  |       |
  |       +--> 入组预测 (Prophet / XGBoost / LLM-based)
  |
  +--> 前端图表渲染 (Ant Design Charts / ECharts)
          |
          +--> REST API 数据接口 (JSON)
          +--> WebSocket 实时更新 (Dashboard)
```

---

### M13a: Statistical Analysis -- 统计分析

**模块目标:** 提供临床试验关键运营指标的交互式图表分析功能，包括入组趋势、站点绩效对比、Query 老化分析、访视完成率等，支持多维度筛选和导出。

**子功能清单:**

| 序号 | 子功能 | 描述 | 图表类型 |
|------|--------|------|----------|
| SA01 | 入组趋势分析 | 实际入组 vs 计划入组的对比趋势 | 折线图 + 面积图 |
| SA02 | 站点绩效对比 | 各站点入组数、筛选失败率、Query 数对比 | 柱状图/条形图 |
| SA03 | Query 老化分析 | Query 滞留天数分布、按类型/站点统计 | 箱线图/热力图 |
| SA04 | 访视完成率 | 各访视的按时完成率、超期率、缺失率 | 堆积柱状图 |
| SA05 | 筛选漏斗 | 从筛选到入组的转化漏斗 | 漏斗图 |
| SA06 | AE/SAE 发生率 | 按 SOC/PT 分类的 AE 发生率 | 树图/旭日图 |
| SA07 | 数据清洗完成度 | SDV/SDR 完成率、冻结率 | 进度仪/仪表盘 |
| SA08 | 自定义报表 | 用户可自选维度和指标生成定制图表 | 透视表/组合图 |

**核心交互流程:**

1. 用户进入统计仪表板（Dashboard），默认展示当前 Study 的关键 KPI 卡片：总入组数、本月入组数、待处理 Query 数、SAE 数等
2. 选择图表类型（如"入组趋势"），系统展示入组曲线：计划线 vs 实际线，支持按月/周/日切换粒度
3. 用户可通过筛选器切换 Study、Site、时间段、受试者分组等维度；前端通过 React Query 发送请求，后端从 Redis 缓存或 OpenSearch 聚合查询获取数据
4. 图表支持交互式操作：鼠标悬停显示详细数据、点击数据点钻取到下级详情（如点击站点柱状图中的柱子，跳转到该站点的详细数据页面）
5. 用户可将当前图表配置保存为个人仪表板布局，下次登录自动加载
6. 支持图表导出为 PNG/SVG 图片，表格数据导出为 Excel

**关联 REST API:**

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api/v1/statistics/enrollment-trend | 入组趋势数据 |
| GET | /api/v1/statistics/site-performance | 站点绩效对比数据 |
| GET | /api/v1/statistics/query-aging | Query 老化分析数据 |
| GET | /api/v1/statistics/visit-completion | 访视完成率数据 |
| GET | /api/v1/statistics/screening-funnel | 筛选漏斗数据 |
| GET | /api/v1/statistics/ae-incidence | AE 发生率数据 |
| GET | /api/v1/statistics/sdv-completion | SDV 完成度数据 |
| GET | /api/v1/statistics/dashboard | 仪表板 KPI 汇总 |
| POST | /api/v1/statistics/custom | 自定义查询 |
| GET | /api/v1/statistics/export | 导出统计数据 |

---

### M13b: Enrollment Prediction -- 入组预测

**模块目标:** 基于历史入组数据和当前入组速率，利用 AI/ML 模型预测入组完成日期和最终入组总数，辅助 PM 进行资源规划和风险管控。

**子功能清单:**

| 序号 | 子功能 | 描述 | 关键输出 |
|------|--------|------|----------|
| EP01 | 入组完成日期预测 | 预测达到目标入组数的日期 | 预测日期 + 95% 置信区间 |
| EP02 | 站点入组预测 | 各站点未来入组趋势预测 | 站点级预测曲线 |
| EP03 | 入组速率分析 | 当前入组速率与目标速率对比 | 速率仪表盘、缺口分析 |
| EP04 | 预测准确度回测 | 对比历史预测与实际结果的准确度 | 回测报告、模型性能评估 |
| EP05 | 情景模拟 | 变更入组速率假设后的 What-if 分析 | 多情景对比图表 |

**核心交互流程:**

1. PM 在入组预测页面查看当前预测结果：预测完成日期、置信区间、当前入组速率、所需速率
2. 系统每日凌晨自动运行预测模型：（a）从数据库聚合历史入组数据（按天/站点）；（b）调用 ML 微服务执行预测（使用 Prophet 或 XGBoost 时间序列模型）；（c）将预测结果回写到数据库
3. 预测结果以图表展示：历史实际入组线 + 未来预测入组线 + 目标线 + 置信区间阴影
4. PM 可通过调整参数进行情景模拟："如果入组速率提升 20% 会怎样？""如果新增 2 个站点会怎样？"
5. 系统按月对预测准确度进行回测，计算 MAE（平均绝对误差）和 MAPE（平均绝对百分比误差），评估模型性能

**核心字段:**

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| prediction_id | UUIDv7 (PK) | 是 | 主键 |
| prediction_type | VARCHAR(20) | 是 | COMPLETION_DATE / SITE_PROJECTION |
| model_name | VARCHAR(50) | 是 | 模型名称：PROPHET / XGBOOST / ENSEMBLE |
| model_version | VARCHAR(10) | 是 | 模型版本号 |
| predicted_date | DATE | 是 | 预测完成日期 |
| confidence_lower | DATE | 否 | 置信区间下界 |
| confidence_upper | DATE | 否 | 置信区间上限 |
| predicted_enrollment | INT | 否 | 预测最终入组数 |
| current_rate | DECIMAL(10,4) | 否 | 当前入组速率（/天） |
| required_rate | DECIMAL(10,4) | 否 | 目标入组速率（/天） |
| input_data | JSONB | 否 | 模型输入数据快照 |
| output_data | JSONB | 否 | 模型原始输出 |
| related_study_id | UUIDv7 | 是 | 关联研究 ID |
| generated_at | TIMESTAMPTZ | 是 | 预测生成时间 |
| is_deleted | BOOLEAN | 是 | 软删除 |
| created_at | TIMESTAMPTZ | 是 | 创建时间 |

**关联 REST API:**

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api/v1/predictions/current | 获取最新预测结果 |
| GET | /api/v1/predictions/history | 获取预测历史 |
| POST | /api/v1/predictions/run | 手动触发预测 |
| POST | /api/v1/predictions/simulate | 情景模拟 |
| GET | /api/v1/predictions/accuracy | 获取预测准确度回测报告 |

---

### M13c: Risk Heatmap -- 风险热力图

**模块目标:** 构建多维度风险评分模型，对研究层面的质量风险、安全风险、时间线风险、财务风险进行综合评分，并通过热力图和仪表盘进行可视化展示。

**子功能清单:**

| 序号 | 子功能 | 描述 | 关键输出 |
|------|--------|------|----------|
| RH01 | 风险指标配置 | 定义风险维度和评分规则 | 风险维度、权重、评分算法 |
| RH02 | 风险自动评分 | 定时自动计算各维度风险分 | Site 风险分、Study 风险分 |
| RH03 | 风险热力图 | 以热力图形式展示各 Study/Site 的风险分布 | 热力图、雷达图 |
| RH04 | 风险趋势 | 风险分数的时间变化趋势 | 趋势折线图 |
| RH05 | 风险预警 | 高风险自动触发预警通知 | 自动通知 PM/Sponsor |
| RH06 | 风险详情钻取 | 从风险分钻取到具体风险项 | 风险明细列表、根因分析 |

**风险评分维度与指标:**

| 维度 | 权重 | 评分指标 |
|------|------|----------|
| 质量风险 | 30% | Query 数量超阈值、Query 老化 > 14d 比例、Issue 数量、CAPA 未关闭/超期、ProtocolDeviation 发生率 |
| 安全风险 | 30% | SAE 数量、SUSAR 数量、SAE 报告超时率、AE 严重度趋势 |
| 时间线风险 | 25% | 入组延迟（实际 vs 计划）、未完成访视比例、数据录入延迟、锁定延迟 |
| 财务风险 | 15% | 预算超支比例、未支付款项金额、合同到期未续约 |

**核心交互流程:**

1. Admin 或 PM 在系统配置中定义风险评分规则：各维度的权重、阈值、评分函数（线性/阶梯/自定义）
2. 系统定时任务（每日 02:00）自动计算各 Study 和 Site 的风险分：从 OpenSearch 聚合各指标数据 -> 按权重加权求和 -> 归一化为 0-100 分
3. 计算完成后更新 risk_score 和 risk_level（LOW: 0-30 / MEDIUM: 31-60 / HIGH: 61-85 / CRITICAL: 86-100）
4. PM 在风险仪表板查看风险热力图：表格以 Study 为行、风险维度为列，颜色深浅表示风险高低
5. 点击某个单元格可钻取到该 Study 某维度的详细风险指标和具体风险事项（如"哪些 Query 已超期"）
6. 风险分数超过阈值时，系统自动创建 RiskSignal 记录，并发送预警通知给 PM 和 Sponsor
7. 风险趋势图展示各 Study 风险分数的历史变化，帮助 PM 判断风险管理措施的有效性

**核心字段:**

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| risk_signal_id | UUIDv7 (PK) | 是 | 主键 |
| target_type | VARCHAR(10) | 是 | STUDY / SITE |
| target_id | UUIDv7 | 是 | 目标 Study/Site ID |
| overall_score | DECIMAL(5,1) | 是 | 总分 0-100 |
| risk_level | VARCHAR(10) | 是 | LOW / MEDIUM / HIGH / CRITICAL |
| quality_score | DECIMAL(5,1) | 是 | 质量维度分 |
| safety_score | DECIMAL(5,1) | 是 | 安全维度分 |
| timeline_score | DECIMAL(5,1) | 是 | 时间线维度分 |
| finance_score | DECIMAL(5,1) | 是 | 财务维度分 |
| score_details | JSONB | 否 | 评分明细 [{dimension, indicator, value, threshold, score}] |
| risk_items | JSONB | 否 | 具体风险事项 [{item_type, item_id, description, severity}] |
| calculated_at | TIMESTAMPTZ | 是 | 计算时间 |
| previous_score | DECIMAL(5,1) | 否 | 上次分数（用于趋势对比） |
| is_deleted | BOOLEAN | 是 | 软删除 |
| created_at | TIMESTAMPTZ | 是 | 创建时间 |

**关联 REST API:**

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api/v1/risk-signals/heatmap | 获取风险热力图数据 |
| GET | /api/v1/risk-signals/{targetType}/{targetId} | 获取特定 Study/Site 风险详情 |
| GET | /api/v1/risk-signals/{targetType}/{targetId}/trend | 获取风险趋势数据 |
| GET | /api/v1/risk-signals/{targetType}/{targetId}/details | 获取风险明细列表 |
| GET | /api/v1/risk-signals/rules | 获取风险评分规则配置 |
| PUT | /api/v1/risk-signals/rules | 更新风险评分规则 |

---

### M13 模块整体异常场景:

| 场景 | 处理方式 | 用户提示 |
|------|----------|----------|
| 统计图表数据查询超时 | 使用最近一次缓存数据，标记"数据非实时" | "数据加载超时，当前展示 {时间} 缓存数据，请稍后刷新" |
| AI 预测模型服务不可用 | 使用上一周期预测结果，标记"预测未更新" | "预测服务暂时不可用，当前显示 {日期} 的预测结果" |
| 风险评分规则配置不当导致所有 Site 均为高风险 | 系统检测异常分布，提醒管理员检查规则 | "风险评分分布异常（>90% 目标为高风险），请检查评分规则配置" |
| 大时间跨度统计（>2 年）导致查询慢 | 按月预聚合缓存，超过 1 年数据按月粒度返回 | "大数据量查询中，已自动优化为月度粒度" |
| 预测模型在新研究（历史数据 < 30 天）上运行 | 使用行业基准速率做默认预测，加上警告标记 | "历史数据不足（< 30 天），预测基于行业基准速率，准确度有限" |

### M13 模块整体权限要求:

| 角色 | 统计分析 | 入组预测 | 风险热力图 |
|------|----------|----------|------------|
| Admin | 全部 | 全部 | 全部（含规则配置） |
| PM | 管辖 Study | 管辖 Study | 管辖 Study |
| CRA Lead | 管辖 Study | 管辖 Study | 管辖 Study |
| CRA | 管辖 Site | 管辖 Site | 否 |
| CRC | 管辖 Site | 否 | 否 |
| PI | 管辖 Site | 否 | 管辖 Site |
| Sponsor | 管辖 Study（汇总） | 管辖 Study（汇总） | 管辖 Study（汇总） |
| Finance | 管辖 Study（财务） | 否 | 管辖 Study（财务维度） |
| ReadOnlyAuditor | 只读 | 只读 | 只读 |

**关联数据实体:** Study, Site, Subject, Visit, Query, Issue, ProtocolDeviation, CAPA, AE, SAE, RiskSignal, AuditLog

---


## M14: 系统配置 / 模板 / 字典 / 权限 / 审计

### M14 模块概述

M14 是 PMS 平台的系统管理中枢，覆盖用户与权限管理、数据字典维护（MedDRA、CTCAE、访视类型、文档类型等）、业务模板管理（访视模板、知情同意模板、通知模板等）、审计日志查询以及 License/租户管理。该模块面向 Admin 和系统运维人员，是整个系统可配置性和可扩展性的基础。

**设计原则:**

1. **最小权限原则:** 系统管理功能严格限制为 Admin 角色，普通用户不可见管理入口
2. **变更审计:** 所有系统配置的修改操作必须记录到 AuditLog，包含修改前后值对比
3. **模板版本化:** 业务模板支持版本管理，版本变更记录完整历史
4. **字典可扩展:** 数据字典支持层级结构和自定义扩展，不与代码硬编码绑定
5. **多租户隔离:** 支持多申办方/多 CRO 的组织架构隔离，租户间数据不可见

**模块架构:**

```
M14 系统管理
|-- 14a. User & Role & Permission Management (用户/角色/权限管理)
|-- 14b. Dictionary Management (字典管理)
|-- 14c. Template Management (模板管理)
|-- 14d. Audit Log Viewer (审计日志查看器)
|-- 14e. System Parameters (系统参数)
\-- 14f. Tenant & Organization Management (租户/组织管理)
```

---

### M14a: User & Role & Permission Management -- 用户、角色与权限管理

**模块目标:** 提供完整的用户生命周期管理、基于 RBAC 的角色权限体系、数据权限范围控制（Study/Site 级）和登录安全策略配置。

**子功能清单:**

| 序号 | 子功能 | 描述 | 关键操作 |
|------|--------|------|----------|
| U01 | 用户管理 | 用户创建、编辑、停用/启用、密码重置 | CRUD、批量导入、LDAP/SSO 集成 |
| U02 | 角色管理 | 定义系统角色及其权限集合 | 角色 CRUD、权限分配、角色复制 |
| U03 | 权限管理 | 细粒度的功能和数据权限定义 | 权限项定义、功能权限 vs 数据权限 |
| U04 | 数据权限范围 | 配置用户可访问的 Study/Site 范围 | Study 授权、Site 授权、批量授权 |
| U05 | 登录安全策略 | 密码策略、MFA 配置、会话管理 | 密码复杂度、登录失败锁定、IP 白名单 |
| U06 | 用户组管理 | 用户分组管理，便于批量授权 | 用户组 CRUD、组成员管理 |

**核心交互流程:**

1. Admin 在用户管理界面创建新用户：填写用户名、邮箱、手机号、初始密码、关联角色
2. 在角色管理界面定义角色：选择角色名（如 CRA、CRC、PI），勾选该角色拥有的功能权限项（如 query:create, query:close, subject:view 等）
3. 在数据权限范围界面为用户绑定 Study/Site 权限：选择用户 -> 添加可访问的 Study -> 在每个 Study 下选择可访问的 Site
4. 系统登录时，Spring Security 从 JWT Token 解析用户信息和权限 Claim，结合数据库中的 RBAC 权限 + 数据权限范围，构建完整的 SecurityContext
5. 业务 Service 层通过注解 @PreAuthorize 检查功能权限，通过 AOP 切面自动过滤数据权限范围内的数据

**核心字段:**

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| user_id | UUIDv7 (PK) | 是 | 主键 |
| username | VARCHAR(50) | 是 | 用户名，唯一 |
| email | VARCHAR(200) | 是 | 邮箱 |
| phone | VARCHAR(20) | 否 | 手机号 |
| full_name | VARCHAR(100) | 是 | 全名 |
| status | VARCHAR(16) | 是 | active / inactive / locked |
| roles | JSONB | 是 | 角色列表 [{role_id, role_code}] |
| data_scope | JSONB | 否 | 数据权限 [{study_id, site_ids[]}] |
| mfa_enabled | BOOLEAN | 是 | MFA 是否启用 |
| last_login_at | TIMESTAMPTZ | 否 | 最后登录时间 |
| password_updated_at | TIMESTAMPTZ | 否 | 密码最后修改时间 |
| tenant_id | UUIDv7 | 是 | 所属租户 ID |
| is_deleted | BOOLEAN | 是 | 软删除 |
| created_at | TIMESTAMPTZ | 是 | 创建时间 |
| updated_at | TIMESTAMPTZ | 是 | 更新时间 |

**关联 REST API:**

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api/v1/admin/users | 分页查询用户列表 |
| GET | /api/v1/admin/users/{userId} | 获取用户详情 |
| POST | /api/v1/admin/users | 创建用户 |
| PUT | /api/v1/admin/users/{userId} | 更新用户 |
| PUT | /api/v1/admin/users/{userId}/status | 启用/停用用户 |
| PUT | /api/v1/admin/users/{userId}/reset-password | 重置密码 |
| PUT | /api/v1/admin/users/{userId}/roles | 分配角色 |
| PUT | /api/v1/admin/users/{userId}/data-scope | 配置数据权限 |
| GET | /api/v1/admin/roles | 获取角色列表 |
| POST | /api/v1/admin/roles | 创建角色 |
| PUT | /api/v1/admin/roles/{roleId} | 更新角色 |
| DELETE | /api/v1/admin/roles/{roleId} | 删除角色 |
| GET | /api/v1/admin/permissions | 获取权限项列表 |
| GET | /api/v1/admin/users/export | 导出用户列表 |

---

### M14b: Dictionary Management -- 字典管理

**模块目标:** 维护系统中所有标准化的数据字典，包括 MedDRA 术语、CTCAE 分级标准、访视类型、文档类型、费用类型、偏离类型等，支持层级结构、多版本和导入导出。

**子功能清单:**

| 序号 | 子功能 | 描述 | 关键操作 |
|------|--------|------|----------|
| D01 | MedDRA 字典管理 | MedDRA 术语的导入、查询和版本管理 | MedDRA 版本导入、HLT/HLGT/SOC 层级浏览 |
| D02 | CTCAE 字典管理 | CTCAE v5.0 分级标准维护 | 分级标准导入/导出、SOC 分类管理 |
| D03 | 通用字典管理 | 自定义字典项维护（访视类型、文档类型、费用类型等） | CRUD、启用/停用、排序、层级结构 |
| D04 | 字典导入导出 | 支持 Excel/CSV 格式的字典批量导入导出 | 导入模板下载、批量导入、差异对比 |

**核心交互流程:**

1. Admin 在字典管理界面选择字典类型（如"visit_type"），查看当前所有字典项
2. 字典项支持父子层级结构（如：访视类型 -> 筛选期访视/基线访视/治疗期访视/随访期访视）
3. 字典项属性：编码（code）、名称（name）、英文名（name_en）、排序号（sort_order）、状态（enabled/disabled）、上级编码（parent_code）
4. MedDRA 字典通过专门的导入功能从 MSSO 官方分发包导入，系统自动解析 MedDRA ASCII 文件，建立 SOC->HLGT->HLT->PT->LLT 五级层级关系
5. CTCAE 字典从 NCI 官方 Excel 文件导入，支持 SOC 分类下的分级标准管理

**核心字段（通用字典项）:**

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| dict_item_id | UUIDv7 (PK) | 是 | 主键 |
| dict_type | VARCHAR(32) | 是 | 字典类型：VISIT_TYPE / DOCUMENT_TYPE / EXPENSE_TYPE / DEVIATION_TYPE / QUERY_CATEGORY / ISSUE_CATEGORY 等 |
| code | VARCHAR(50) | 是 | 字典项编码 |
| name | VARCHAR(200) | 是 | 中文名称 |
| name_en | VARCHAR(200) | 否 | 英文名称 |
| parent_code | VARCHAR(50) | 否 | 上级编码（NULL = 根节点） |
| sort_order | INT | 是 | 排序号 |
| status | VARCHAR(16) | 是 | enabled / disabled |
| description | TEXT | 否 | 描述说明 |
| metadata | JSONB | 否 | 扩展元数据 |
| is_system | BOOLEAN | 是 | 是否系统内置（不可删除） |
| is_deleted | BOOLEAN | 是 | 软删除 |
| created_by | UUIDv7 | 是 | 创建人 |
| created_at | TIMESTAMPTZ | 是 | 创建时间 |
| updated_at | TIMESTAMPTZ | 是 | 更新时间 |

**关联 REST API:**

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api/v1/admin/dictionaries/{dictType} | 获取指定字典类型的所有项 |
| POST | /api/v1/admin/dictionaries/{dictType} | 新增字典项 |
| PUT | /api/v1/admin/dictionaries/{dictType}/{dictItemId} | 更新字典项 |
| DELETE | /api/v1/admin/dictionaries/{dictType}/{dictItemId} | 删除字典项 |
| PUT | /api/v1/admin/dictionaries/{dictType}/batch | 批量更新字典项 |
| GET | /api/v1/admin/dictionaries/types | 获取所有字典类型 |
| POST | /api/v1/admin/dictionaries/import | 批量导入字典 |
| GET | /api/v1/admin/dictionaries/export | 导出字典 |
| POST | /api/v1/admin/dictionaries/meddra/import | 导入 MedDRA 发布包 |
| GET | /api/v1/admin/dictionaries/meddra/search | MedDRA 术语搜索 |
| POST | /api/v1/admin/dictionaries/ctcae/import | 导入 CTCAE 字典 |

---

### M14c: Template Management -- 模板管理

**模块目标:** 管理系统中的所有业务模板，包括访视计划模板、知情同意书模板、通知消息模板、报告模板和邮件模板，支持版本管理和模板变量定义。

**子功能清单:**

| 序号 | 子功能 | 描述 | 关键操作 |
|------|--------|------|----------|
| T01 | 访视模板 | 定义各研究的访视计划和表单模板 | 访视类型编排、表单模板关联、版本管理 |
| T02 | 知情同意书模板 | ICF 模板管理和版本控制 | ICF 模板编辑、变量定义、EC 审批状态 |
| T03 | 通知消息模板 | 统一的通知消息模板管理 | FreeMarker 模板编辑、变量定义、预览 |
| T04 | 报告模板 | 周报/月报的 FreeMarker 模板管理 | 模板编辑、变量定义、HTML 预览 |
| T05 | 邮件模板 | 邮件正文和签名模板管理 | HTML 模板编辑、CSS 样式、发送测试 |
| T06 | 模板变量字典 | 所有模板可用变量的统一管理 | 变量定义、分类、使用说明 |

**核心交互流程:**

1. Admin 在访视模板管理界面创建新的访视模板（如"肿瘤 I 期访视计划"）：定义各访视窗口（筛选期、C1D1、C1D8...）、窗口允许天数范围、各访视需要完成的表单（CRF 页面）
2. 研究创建时，PM 选择访视模板，系统自动为该研究生成访视计划
3. 在通知模板界面，Admin 编辑 FreeMarker 模板（如 Query 创建通知），使用变量如 ${queryNo}、${subjectId}、${dueDate}，支持预览渲染效果
4. 所有模板修改操作自动递增版本号，旧版本保留用于历史追溯

**核心字段:**

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| template_id | UUIDv7 (PK) | 是 | 主键 |
| template_type | VARCHAR(32) | 是 | VISIT_PLAN / ICF / NOTIFICATION / REPORT / EMAIL |
| code | VARCHAR(50) | 是 | 模板编码 |
| name | VARCHAR(200) | 是 | 模板名称 |
| version | VARCHAR(10) | 是 | 版本号 |
| status | VARCHAR(16) | 是 | draft / active / deprecated |
| content | TEXT | 是 | 模板内容（FreeMarker/JSON/HTML） |
| variables | JSONB | 否 | 模板变量定义 [{name, type, required, description}] |
| related_study_id | UUIDv7 | 否 | 关联研究（通用模板为 NULL） |
| is_system | BOOLEAN | 是 | 是否系统内置 |
| is_deleted | BOOLEAN | 是 | 软删除 |
| created_by | UUIDv7 | 是 | 创建人 |
| created_at | TIMESTAMPTZ | 是 | 创建时间 |
| updated_at | TIMESTAMPTZ | 是 | 更新时间 |

**关联 REST API:**

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api/v1/admin/templates | 获取模板列表 |
| GET | /api/v1/admin/templates/{templateId} | 获取模板详情 |
| POST | /api/v1/admin/templates | 创建模板 |
| PUT | /api/v1/admin/templates/{templateId} | 更新模板（自动递增版本） |
| DELETE | /api/v1/admin/templates/{templateId} | 删除模板 |
| GET | /api/v1/admin/templates/{templateId}/versions | 获取模板版本历史 |
| POST | /api/v1/admin/templates/{templateId}/preview | 预览模板渲染 |
| GET | /api/v1/admin/templates/variables | 获取模板变量字典 |

---

### M14d: Audit Log Viewer -- 审计日志查看器

**模块目标:** 提供完整的审计日志查询和分析功能，支持按用户、操作类型、实体类型、时间范围等多维度筛选，确保系统操作的完整可追溯性，满足 GCP/GxP 合规审计要求。

**子功能清单:**

| 序号 | 子功能 | 描述 | 关键操作 |
|------|--------|------|----------|
| AL01 | 审计日志查询 | 多维度查询审计日志 | 按用户/操作/实体/时间筛选、全文搜索 |
| AL02 | 审计日志详情 | 查看单条日志的详细变更内容 | 变更前后值对比（JSON Diff） |
| AL03 | 审计报告 | 生成指定时间范围的审计报告 | PDF 报告生成、导出 Excel |
| AL04 | 敏感操作监控 | 实时监控和告警敏感操作 | 敏感操作定义、实时告警 |

**核心交互流程:**

1. ReadOnlyAuditor 或 Admin 进入审计日志查看器，默认显示最近 7 天的审计日志
2. 筛选条件：操作人、操作类型（CREATE/UPDATE/DELETE/EXPORT/LOGIN）、实体类型（Query/Issue/SAE/Subject 等）、时间范围
3. 点击单条日志，展开查看详细信息：操作人、操作时间、IP 地址、User Agent、操作类型、变更前后值对比（JSON Diff 视图）
4. 审计日志通过 AOP 切面（@Auditable 注解）自动记录，在业务 Service 方法执行前后捕获参数和返回值
5. 审计日志数据存储在独立的 audit_log 表中，不随业务数据软删除而删除；通过 OpenSearch 实现秒级查询
6. 敏感操作（如导出受试者数据、修改权限、数据硬删除）触发实时告警通知安全管理员

**核心字段:**

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| audit_log_id | UUIDv7 (PK) | 是 | 主键 |
| actor_id | UUIDv7 | 是 | 操作人 ID |
| actor_name | VARCHAR(100) | 是 | 操作人用户名（快照） |
| actor_ip | VARCHAR(45) | 是 | 操作人 IP 地址 |
| user_agent | VARCHAR(500) | 否 | User Agent |
| action | VARCHAR(32) | 是 | CREATE / UPDATE / DELETE / EXPORT / LOGIN / LOGOUT / APPROVE / REJECT / VIEW |
| entity_type | VARCHAR(32) | 是 | 实体类型 |
| entity_id | UUIDv7 | 是 | 实体 ID |
| entity_no | VARCHAR(32) | 否 | 实体业务编号 |
| changes | JSONB | 否 | 变更内容 [{field, old_value, new_value}] |
| request_params | JSONB | 否 | 请求参数摘要 |
| request_url | VARCHAR(500) | 否 | 请求 URL |
| http_method | VARCHAR(10) | 否 | HTTP 方法 |
| http_status | INT | 否 | 响应状态码 |
| execution_time_ms | INT | 否 | 执行耗时（毫秒） |
| sensitivity | VARCHAR(16) | 是 | NORMAL / SENSITIVE / CRITICAL |
| related_study_id | UUIDv7 | 否 | 关联 Study |
| related_site_id | UUIDv7 | 否 | 关联 Site |
| tenant_id | UUIDv7 | 是 | 租户 ID |
| created_at | TIMESTAMPTZ | 是 | 创建时间 |

**关联 REST API:**

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api/v1/admin/audit-logs | 分页查询审计日志 |
| GET | /api/v1/admin/audit-logs/{auditLogId} | 获取审计日志详情 |
| GET | /api/v1/admin/audit-logs/search | OpenSearch 全文搜索审计日志 |
| GET | /api/v1/admin/audit-logs/report | 生成审计报告 |
| GET | /api/v1/admin/audit-logs/export | 导出审计日志 |
| GET | /api/v1/admin/audit-logs/statistics | 审计日志统计（操作频率/用户活跃度等） |

---

### M14e: System Parameters -- 系统参数

**模块目标:** 提供系统级运行参数的可视化配置管理，包括 SLA 时限配置、文件上传限制、邮件服务参数、安全策略参数等，支持参数分类、版本记录和热更新。

**子功能清单:**

| 序号 | 子功能 | 描述 | 关键操作 |
|------|--------|------|----------|
| SP01 | 参数配置 | 系统参数的增删改查 | CRUD、分类筛选、参数搜索 |
| SP02 | 参数热更新 | 参数修改后无需重启即可生效 | Redis Pub/Sub 配置刷新机制 |
| SP03 | SLA 时限配置 | 各类业务流程的 SLA 时限配置 | 时限类型（Query/SAE/CAPA/Approval）、单位设置 |
| SP04 | 集成配置 | 外部服务集成参数配置（微信/邮件/短信/税局） | API Key、回调 URL、开关控制 |

**核心字段:**

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| param_id | UUIDv7 (PK) | 是 | 主键 |
| param_key | VARCHAR(100) | 是 | 参数键（唯一） |
| param_value | TEXT | 是 | 参数值 |
| param_type | VARCHAR(16) | 是 | STRING / INT / BOOLEAN / JSON / ENCRYPTED |
| param_category | VARCHAR(32) | 是 | 分类：SLA / FILE / SECURITY / NOTIFICATION / INTEGRATION / GENERAL |
| description | TEXT | 否 | 参数说明 |
| is_encrypted | BOOLEAN | 是 | 是否加密存储（如密码、API Key） |
| is_hot_reloadable | BOOLEAN | 是 | 是否支持热更新 |
| previous_value | TEXT | 否 | 上次值（变更追溯） |
| updated_by | UUIDv7 | 否 | 最后更新人 |
| is_deleted | BOOLEAN | 是 | 软删除 |
| created_at | TIMESTAMPTZ | 是 | 创建时间 |
| updated_at | TIMESTAMPTZ | 是 | 更新时间 |

**示例参数:**

| param_key | param_value | 说明 |
|-----------|-------------|------|
| sla.query.response.days | 5 | Query 回复 SLA（工作日） |
| sla.sae.initial.report.hours | 24 | SAE 初报时限（小时） |
| sla.susar.fatal.days | 7 | 致命/危及生命 SUSAR 报告时限（日历日） |
| sla.susar.other.days | 15 | 其他 SUSAR 报告时限（日历日） |
| file.upload.max.size.mb | 500 | 文件上传大小上限 |
| file.upload.allowed.types | pdf,doc,docx,xls,xlsx,jpg,png | 允许的文件类型 |
| security.password.min.length | 8 | 密码最小长度 |
| security.login.max.attempts | 5 | 登录失败锁定阈值 |
| security.session.timeout.minutes | 30 | 会话超时（分钟） |
| notification.wechat.enabled | true | 微信通知开关 |
| notification.email.enabled | true | 邮件通知开关 |
| notification.sms.enabled | false | 短信通知开关 |

**关联 REST API:**

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api/v1/admin/system-params | 获取所有系统参数 |
| GET | /api/v1/admin/system-params/{paramKey} | 获取单个参数 |
| PUT | /api/v1/admin/system-params/{paramKey} | 更新参数值 |
| POST | /api/v1/admin/system-params/batch | 批量更新参数 |
| GET | /api/v1/admin/system-params/categories | 获取参数分类列表 |
| POST | /api/v1/admin/system-params/reload | 手动触发配置热更新 |

---

### M14f: Tenant & Organization Management -- 租户与组织管理

**模块目标:** 支持多申办方/多 CRO 的多租户架构，提供租户注册开通、组织信息管理、License 管理和租户数据隔离配置。

**子功能清单:**

| 序号 | 子功能 | 描述 | 关键操作 |
|------|--------|------|----------|
| TO01 | 租户管理 | 租户的创建、配置、启用/停用 | 租户 CRUD、租户 Logo/品牌配置 |
| TO02 | 组织机构管理 | 租户下的组织机构树管理 | 组织 CRUD、部门层级、人员归属 |
| TO03 | License 管理 | 系统 License 的激活和到期管理 | License 上传、到期提醒、功能限制 |
| TO04 | 租户数据隔离 | 租户间数据完全隔离，共享表或分库方案 | Schema 隔离、连接池管理 |

**核心交互流程:**

1. 超级管理员在租户管理界面创建新租户：填写租户名称、租户代码（Schema 前缀）、管理员账号、License 文件
2. 系统自动为新租户创建独立的数据库 Schema（或使用共享表 + tenant_id 隔离），初始化默认角色和系统字典
3. 租户管理员在组织管理界面建立组织机构树：总公司 -> 部门 -> 小组；将用户分配到组织节点
4. License 到期前 30/15/7/1 天分别发送提醒；License 到期后系统进入只读模式，禁止创建和修改操作
5. 超级管理员可监控各租户的资源使用情况（用户数、存储量、API 调用量）

**核心字段:**

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| tenant_id | UUIDv7 (PK) | 是 | 主键 |
| tenant_code | VARCHAR(20) | 是 | 租户代码（唯一，Schema 前缀） |
| tenant_name | VARCHAR(200) | 是 | 租户名称 |
| status | VARCHAR(16) | 是 | active / inactive / expired |
| license_key | TEXT | 否 | License 内容（加密存储） |
| license_expiry_date | DATE | 否 | License 到期日期 |
| max_users | INT | 否 | License 最大用户数 |
| max_studies | INT | 否 | License 最大研究数 |
| max_storage_gb | INT | 否 | License 最大存储量（GB） |
| contact_name | VARCHAR(100) | 否 | 联系人姓名 |
| contact_email | VARCHAR(200) | 否 | 联系邮箱 |
| contact_phone | VARCHAR(20) | 否 | 联系电话 |
| org_structure | JSONB | 否 | 组织机构树 [{org_id, name, parent_id, children}] |
| branding | JSONB | 否 | 品牌配置 {logo_url, primary_color, favicon} |
| is_deleted | BOOLEAN | 是 | 软删除 |
| created_at | TIMESTAMPTZ | 是 | 创建时间 |
| updated_at | TIMESTAMPTZ | 是 | 更新时间 |

**关联 REST API:**

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api/v1/admin/tenants | 获取租户列表（Super Admin） |
| GET | /api/v1/admin/tenants/{tenantId} | 获取租户详情 |
| POST | /api/v1/admin/tenants | 创建租户 |
| PUT | /api/v1/admin/tenants/{tenantId} | 更新租户配置 |
| PUT | /api/v1/admin/tenants/{tenantId}/status | 启用/停用租户 |
| POST | /api/v1/admin/tenants/{tenantId}/license | 上传/更新 License |
| GET | /api/v1/admin/tenants/{tenantId}/usage | 获取租户资源用量 |
| GET | /api/v1/admin/orgs/structure | 获取组织机构树 |
| PUT | /api/v1/admin/orgs/structure | 更新组织结构 |
| GET | /api/v1/admin/orgs/nodes | 获取组织节点列表 |

---

### M14 模块整体异常场景:

| 场景 | 处理方式 | 用户提示 |
|------|----------|----------|
| 删除被业务数据引用的字典项 | 阻止删除，提示关联数据 | "该字典项已被 {N} 条业务数据引用，无法删除；请先将其禁用" |
| License 过期后用户尝试操作 | 系统进入只读模式，拒绝写操作 | "系统 License 已过期，当前仅支持查看操作。请联系管理员续期" |
| 修改系统内置角色权限导致管理员锁定 | 权限修改前进行"最小权限检查"，确保至少一个管理员角色 | "无法移除 ADMIN 角色的核心权限。至少保留一个完整管理员角色" |
| 审计日志表数据量过大影响查询性能 | 按月分区存储（PostgreSQL 表分区），超 12 个月数据归档到冷存储 | "您查询的时间范围涉及归档数据，查询可能较慢" |
| MedDRA 导入版本与已有版本冲突 | 检查版本号，阻止相同版本覆盖导入 | "MedDRA 版本 {ver} 已存在，请使用更高版本的发布包" |
| 租户创建时 Schema 初始化失败 | 回滚所有操作，记录错误日志，提示管理员 | "租户数据库初始化失败，请检查数据库连接配置后重试" |

### M14 模块整体权限要求:

| 子模块 | 权限范围 | 可访问角色 |
|--------|----------|------------|
| 用户/角色/权限管理 | 全部（跨租户） | Super Admin |
| 用户/角色/权限管理 | 本租户 | Admin |
| 字典管理 | 本租户 | Admin |
| 模板管理 | 本租户 | Admin, PM（仅查看和使用） |
| 审计日志查看器 | 本租户 | Admin, ReadOnlyAuditor |
| 系统参数 | 本租户 | Admin |
| 租户管理 | 全部（跨租户） | Super Admin |
| 组织管理 | 本租户 | Admin |

**关联数据实体:** User, Role, Permission, DictionaryItem, Template, AuditLog, SystemParam, Tenant, Organization, License

**关联 REST API（除各子模块 API 外）:**

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api/v1/admin/dashboard | 系统管理仪表板（用户数/租户数/存储量/API 调用量） |
| GET | /api/v1/admin/health-check | 系统健康检查（DB/Redis/RabbitMQ/MinIO/OpenSearch） |
| POST | /api/v1/admin/cache/clear | 清除指定缓存区域 |
| GET | /api/v1/admin/system-info | 系统运行信息（版本/构建时间/运行时间） |

---


## 附录 A: 全局跨模块异常场景

下表列出跨模块通用的异常场景及其统一处理策略：

| 场景 | 影响模块 | 处理方式 | 用户提示 |
|------|----------|----------|----------|
| 网络超时导致操作失败 | 全部 | 乐观锁重试（最多 3 次），超限返回错误 | "操作失败，请检查网络连接后重试" |
| 并发操作冲突（乐观锁） | 全部 | 提示用户刷新后重试，展示冲突详情 | "数据已被其他用户修改，请刷新页面后重新操作" |
| PostgreSQL 连接池耗尽 | 全部 | 快速失败（Fail-Fast），返回 HTTP 503 | "系统繁忙，请稍后重试" |
| Redis 缓存不可用 | 全部 | 自动降级到数据库直读，标记 Degraded Mode | "部分功能响应可能变慢，系统正在恢复中" |
| RabbitMQ 消息投递失败 | M08-M13 | 消息持久化到 DLQ（Dead Letter Queue），定时重试 | 无用户提示（后台自动重试） |
| MinIO 文件读写失败 | M10, M11 | 重试 3 次，超限后提示用户重新上传 | "文件操作失败，请稍后重试或联系管理员" |
| Flowable 工作流异常 | M08d, M09b, M11 | 流程挂起并通知 Admin，支持手动干预恢复 | "审批流程出现异常，系统管理员已收到通知" |
| OpenSearch 全文搜索不可用 | M10, M14d | 降级到 PostgreSQL LIKE 查询 | "全文搜索功能暂时不可用，已切换到基础搜索模式" |
| LLM API 超时或不可用 | M12d, M13b | 使用缓存结果/模板填充，标记为"非 AI 生成" | "AI 服务暂时不可用，已使用备用方案生成内容" |

---

## 附录 B: 全局数据保护与合规设计

### B.1 数据脱敏策略

| 数据类别 | 脱敏方式 | 应用场景 |
|----------|----------|----------|
| 受试者姓名 | 仅显示首字母和尾字母，其余星号替换（王*明） | 列表展示、Sponsor 视图 |
| 受试者身份证号 | 仅显示前 6 位和后 4 位 | 日志记录、审计导出 |
| 受试者电话号码 | 仅显示前 3 位和后 4 位 | 日志记录 |
| 银行卡号 | 仅显示后 4 位 | 付款凭证、对账单 |
| API Key / Secret | 完全隐藏，仅显示前 4 位和后 4 位 | 系统参数管理界面 |
| IP 地址（审计日志） | 内部环境保留完整，外部导出时脱敏末段 | 审计报告导出 |

### B.2 数据保留策略

| 数据类型 | 保留周期 | 超期处理 |
|----------|----------|----------|
| 业务数据（Study/Subject/AE 等） | 研究归档后 15 年 | 到期后经数据保护官审批后硬删除 |
| 审计日志 | 永久保留 | 按月归档到冷存储（S3 Glacier Deep Archive） |
| 通知消息 | 90 天 | 定时清理软删除 |
| 文件对象（FileObject） | 随 Study 归档，15 年 | 到期后从 MinIO 删除 |
| 会话 Token（JWT） | 30 分钟 | 自动过期 |
| Redis 缓存 | TTL 5 分钟到 1 小时 | 自动过期 |

### B.3 数据导出控制

| 导出类型 | 审批要求 | 水印保护 | 日志记录 |
|----------|----------|----------|----------|
| 受试者 PII 导出 | 双人审批（PI + PM） | 必须（用户 ID + 时间戳水印） | 完整记录 |
| AE/SAE 汇总导出 | 无需审批 | 可选 | 记录 |
| 财务数据导出 | Finance Manager 审批 | 必须 | 完整记录 |
| 审计日志导出 | Admin 审批 | 必须 | 完整记录 |

---

## 附录 C: 系统集成点总览

| 集成系统 | 集成方式 | 用途 | 相关模块 |
|----------|----------|------|----------|
| MedDRA MSSO | 文件导入 + 本地数据库 | 医学术语编码 | M09, M14b |
| CTCAE NCI | Excel 文件导入 | 不良事件分级标准 | M09, M14b |
| Flowable Engine | 嵌入式 Java Engine | 审批工作流引擎 | M08d, M09b, M10, M11b, M11c |
| 微信公众号 | REST API + Webhook | 模板消息推送 | M12 |
| SMTP 邮件服务 | JavaMail + Spring Mail | 邮件通知和报告分发 | M12 |
| 阿里云/腾讯云短信 | SDK | 紧急通知短信 | M12 |
| 税务系统 | REST API | 发票真伪验证 | M11e |
| 银行/支付网关 | REST API / 文件导入 | 付款回执和对账 | M11c, M11f |
| 电子签章系统 | REST API | 合同电子签 | M11b, M10 |
| LDAP / SSO (OAuth2/OIDC) | Spring Security | 统一身份认证 | M14a |
| LLM API (GPT-4o/DeepSeek) | REST API | AI 摘要和预测 | M12d, M13b |

---

## 附录 D: 文档变更历史

| 版本 | 日期 | 作者 | 变更说明 |
|------|------|------|----------|
| 1.0 | 2026-05-08 | Clinical Research Team | 初始版本，M01-M07 模块说明 |
| 2.0 | 2026-05-11 | Clinical Research Team | 新增 M08-M14 模块详细规格说明，含完整状态流转、字段定义、API 接口、权限矩阵 |

---
