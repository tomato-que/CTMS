# PMS Admin Web 模块详述：M01-M07

> **文档版本:** 2.0 | **日期:** 2026-05-11 | **作者:** Clinical Research PM + Clinical Operations Consultant
>
> **技术栈:** Backend: Java 21 + Spring Boot 3 + MyBatis Plus + Spring Security + Flowable | Frontend Admin: Next.js + TypeScript + Ant Design + React Query | DB: PostgreSQL (UUIDv7 PKs, JSONB, soft delete, UTC) | Queue: RabbitMQ / Cache: Redis / Search: OpenSearch / Storage: MinIO

---

## 目录

1. [M01: 项目组合与工作台 (Portfolio & Workspace)](#m01-项目组合与工作台-portfolio--workspace)
2. [M02: 研究启动与立项 (Study Startup & Initiation)](#m02-研究启动与立项-study-startup--initiation)
3. [M03: 方案与版本管理 (Protocol & Version Management)](#m03-方案与版本管理-protocol--version-management)
4. [M04: 中心/研究者管理 (Site/Investigator Management)](#m04-中心研究者管理-siteinvestigator-management)
5. [M05: 受试者筛选/入组/随机/退出管理 (Subject Management)](#m05-受试者筛选入组随机退出管理-subject-management)
6. [M06: 访视计划与访视执行 (Visit Planning & Execution)](#m06-访视计划与访视执行-visit-planning--execution)
7. [M07: 监查管理 (Monitoring Management)](#m07-监查管理-monitoring-management)

---

## M01: 项目组合与工作台 (Portfolio & Workspace)

### M01: 项目组合与工作台

**模块目标 (Goal):** 为 Admin、PM、Sponsor 等管理角色提供跨研究的全局视图与个人工作台，支持项目组合级别的进度监控、里程碑追踪、风险预警与工作量分配决策，实现从“进入系统”到“定位到具体任务”的高效导航。

**子功能清单 (Sub-features):**

| 序号 | 子功能 | 描述 | 关键操作 |
|------|--------|------|----------|
| 1 | 项目组合仪表盘 (Portfolio Dashboard) | 聚合展示所有研究的整体健康状态（红/黄/绿灯）、入组进度、监查完成率、SAE 统计等 KPI 卡片 | 筛选、下钻到具体研究 |
| 2 | 我的工作台 (My Workspace) | 按当前登录用户聚合待办任务、待审事项、即将到期的里程碑 | 快速处理、批量审批 |
| 3 | 研究列表与搜索 (Study List & Search) | 支持多条件筛选（状态、治疗领域、申办方、PM）的研究列表，含 OpenSearch 全文检索 | 新建研究、导出列表 |
| 4 | 里程碑甘特图 (Milestone Gantt Chart) | 以甘特图形式可视化跨研究的里程碑时间线，支持拖拽调整 | 缩放、导出图片、依赖线查看 |
| 5 | 入组进度追踪 (Enrollment Progress) | 展示每项研究的计划入组数 vs 实际入组数 vs 筛选数，含趋势折线图 | 切换时间粒度（月/周/日） |
| 6 | 风险热力图 (Risk Heatmap) | 按中心/研究维度展示风险等级分布（监查发现数、PD 率、数据录入延迟等） | 下钻到具体中心、导出风险报告 |
| 7 | 通知中心 (Notification Center) | 站内通知聚合：SAE 上报提醒、访视窗口到期、审批请求、里程碑延期 | 标记已读、跳转到来源 |
| 8 | 快捷操作面板 (Quick Actions) | 常用操作的快捷入口：新建研究、添加中心、发布方案版本、导出报表 | 自定义快捷方式 |
| 9 | 我的日程 (My Calendar) | 聚合展示个人相关的监查访视、研究者会议、里程碑到期日 | 切换视图（月/周/日）、新建事件 |
| 10 | 工作量总览 (Workload Overview) | 按 CRA/CRC/PM 展示任务分配量与完成率，含柱状对比图 | 筛选时间段、导出 |

**核心交互流程 (Core Interactions):**

1. 用户登录后进入 Portfolio Dashboard 页面，系统根据角色加载对应的默认视图（Admin 看到全量、PM 看到所负责研究、CRA 看到所负责中心）。
2. 页面上方展示 KPI 卡片行：活跃研究数、总入组数、本月 SAE 数、监查完成率、PD 总数。卡片支持点击下钻。
3. 中间区域左侧展示“我的待办”列表（审批请求、到期里程碑、未读通知），右侧展示入组进度趋势图或甘特图。
4. 用户可通过顶部搜索栏进行全局搜索（研究名称、方案编号、中心名称、受试者 ID），搜索结果按实体类型分组展示。
5. 用户点击导航菜单“研究列表”进入列表视图，使用筛选条件（状态、治疗领域、申办方、PM、日期范围）过滤。
6. 列表每行显示关键字段（研究编号、名称、状态、入组进度条、里程碑状态、风险灯）。行尾操作按钮：详情、编辑、归档。
7. 用户点击某研究行进入该研究的概览页面（跳转至 M02 研究详情）。
8. 甘特图页面加载所有活跃研究的里程碑数据，用户可展开/折叠研究节点，查看里程碑依赖关系。
9. 当系统检测到里程碑延期或 SAE 上报时，通知中心红点数字递增，用户可展开通知面板逐条处理。
10. 用户可通过“快速操作”面板一键跳转至新建研究向导（M02）、添加中心（M04）或发布方案（M03）。

**关键状态流转 (State Transitions):**

| 当前状态 | 目标状态 | 触发动作 | 触发角色 | 前置条件 | 审计要求 |
|----------|----------|----------|----------|----------|----------|
| (全局视图) | (下钻研究) | 点击研究卡片/行 | PM/Sponsor/Admin | 用户有该研究的查看权限 | 记录页面访问日志 |
| dashboard_default | dashboard_filtered | 应用筛选条件 | 所有角色 | 筛选参数合法 | 无需审计 |
| dashboard_default | study_detail | 点击"进入研究" | PM/CRA/Admin | 研究状态非 archived | 记录跨研究导航 |
| 通知未读 | 通知已读 | 点击通知或标记已读 | 所有角色 | 通知存在 | 记录已读时间 |
| 风险等级正常 | 风险等级升高 | 系统自动（基于规则引擎） | 系统 | 指标超过阈值 | 记录风险变更原因与时间 |

**核心字段 (Core Fields):**

| 字段 | 类型 | 必填 | 敏感级别 | 说明 |
|------|------|------|----------|------|
| study_id | UUIDv7 | 是 | 内部 | 研究唯一标识 |
| study_code | VARCHAR(50) | 是 | 内部 | 研究编号（如 CT-2026-001） |
| study_title | VARCHAR(500) | 是 | 内部 | 研究全称 |
| therapeutic_area | VARCHAR(200) | 否 | 内部 | 治疗领域 |
| sponsor_name | VARCHAR(200) | 是 | 内部 | 申办方名称 |
| study_status | VARCHAR(50) | 是 | 内部 | 研究状态（状态机） |
| enrollment_planned | INTEGER | 是 | 内部 | 计划入组总数 |
| enrollment_actual | INTEGER | 是 | 内部 | 实际入组数 |
| enrollment_rate | DECIMAL(5,2) | 否 | 内部 | 入组完成率百分比 |
| milestone_on_track | BOOLEAN | 否 | 内部 | 里程碑是否正常 |
| risk_level | VARCHAR(20) | 否 | 内部 | 风险等级：GREEN / YELLOW / RED |
| last_monitoring_date | TIMESTAMPTZ | 否 | 内部 | 最近一次监查日期 |
| pm_user_id | UUIDv7 | 是 | 内部 | 负责 PM 的用户 ID |
| cra_user_ids | JSONB | 否 | 内部 | 负责 CRA 的用户 ID 列表 |
| created_at | TIMESTAMPTZ | 是 | 内部 | 创建时间 |
| updated_at | TIMESTAMPTZ | 是 | 内部 | 更新时间 |

**KPI 卡片展示字段：**
- 活跃研究数（状态 != archived 的研究总数）
- 本月新入组数（enrollment_date 在本月范围内）
- 待处理 SAE 数（状态 = reported/reviewing/escalated 的 SAE 总数）
- 监查完成率（已完成 COV / 计划 COV * 100%）
- 方案偏离率（PD 数 / 总访视数 * 100%）
- 数据录入延迟天数（(数据录入日期 - 访视日期) 的中位数）

**异常场景 (Exception Scenarios):**

| 场景 | 处理方式 | 用户提示 |
|------|----------|----------|
| 用户无任何研究查看权限 | Dashboard 展示空白占位图，隐藏 KPI 卡片 | "您当前没有可访问的研究项目，请联系系统管理员配置权限" |
| 甘特图数据加载超时 (>10s) | 展示骨架屏，提供"重试"按钮，后台异步加载 | "数据量较大，正在加载中…" / "加载失败，请重试" |
| OpenSearch 服务不可用 | 降级为 PostgreSQL LIKE 模糊查询，提示搜索功能降级 | "全文搜索暂不可用，已为您切换为普通搜索" |
| 通知列表获取失败 (500) | 静默失败，通知图标显示感叹号，不阻断页面其他功能 | "通知加载失败，点击重试" |
| 入组进度数据缺失（新研究尚无入组） | 进度条显示 0%，折线图该研究显示为 0 值线 | "该研究尚未开始入组" |
| 甘特图中里程碑依赖形成循环 | 前端校验 + 后端拓扑排序检测，阻止保存并高亮循环节点 | "里程碑依赖关系存在循环引用，请检查依赖配置" |
| 用户会话过期 | 全局拦截器捕获 401，弹出重新登录对话框 | "登录已过期，请重新登录" |

**权限要求 (Permission):**

| 角色 | 查看 | 创建 | 编辑 | 删除 | 特殊权限 |
|------|------|------|------|------|----------|
| Admin | 全局 | — | 系统配置 | — | 查看所有研究、配置工作台布局 |
| PM | 所负责研究 | — | — | — | 查看所管理研究的 KPI 与甘特图 |
| CRA | 所负责中心关联研究 | — | — | — | 仅查看个人待办与监查日程 |
| CRC | 所负责中心 | — | — | — | 仅查看个人数据录入待办 |
| Sponsor | 所申办研究 | — | — | — | 只读查看投资组合视图 |
| Finance | 所关联研究 | — | — | — | 仅查看与费用相关的里程碑 |
| PI | 所负责中心 | — | — | — | 仅查看与本人中心相关的通知 |
| ReadOnlyAuditor | 全局（只读） | — | — | — | 对所有内容只读 |

**关联数据实体 (Related Entities):** Study, StudyMilestone, StudyTask, Site, Enrollment, AE, SAE, Notification, AuditLog, User

**关联 REST API (Related APIs):**

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api/v1/portfolio/dashboard | 获取仪表盘聚合 KPI 数据 |
| GET | /api/v1/portfolio/studies | 分页查询研究列表（支持多条件筛选与排序） |
| GET | /api/v1/portfolio/studies/search | OpenSearch 全文检索研究 |
| GET | /api/v1/portfolio/gantt | 获取跨研究里程碑甘特图数据 |
| GET | /api/v1/portfolio/enrollment-trend | 获取入组进度趋势数据 |
| GET | /api/v1/portfolio/risk-heatmap | 获取风险热力图数据 |
| GET | /api/v1/workspace/my-tasks | 获取当前用户的待办任务列表 |
| GET | /api/v1/workspace/my-calendar | 获取当前用户的日程事件 |
| GET | /api/v1/notifications | 分页获取通知列表 |
| PATCH | /api/v1/notifications/{id}/read | 标记通知为已读 |
| PATCH | /api/v1/notifications/read-all | 全部标记已读 |
| GET | /api/v1/workspace/quick-actions | 获取快捷操作配置 |
| PUT | /api/v1/workspace/quick-actions | 更新快捷操作配置 |
| GET | /api/v1/portfolio/workload | 获取工作量分布数据 |

---

## M02: 研究启动与立项 (Study Startup & Initiation)

### M02: 研究启动与立项

**模块目标 (Goal):** 支持研究从立项申请到正式启动的完整管理流程，包括研究创建向导、方案关联、中心预选、里程碑规划、审批流转（Flowable 工作流驱动），确保研究从 draft 状态顺利推进至 startup 完成。

**子功能清单 (Sub-features):**

| 序号 | 子功能 | 描述 | 关键操作 |
|------|--------|------|----------|
| 1 | 研究创建向导 (Study Creation Wizard) | 分步骤引导创建研究：基本信息 → 方案关联 → 中心预选 → 里程碑规划 → 审批提交 | 分步保存草稿、上一步/下一步、最终提交 |
| 2 | 研究基本信息管理 (Study Profile) | 编辑研究编号、全称、简称、治疗领域、适应症、申办方信息、CRO 信息、研究类型（干预性/观察性）、分期（I/II/III/IV） | 保存、编辑、版本对比 |
| 3 | 里程碑模板选择与定制 (Milestone Template) | 从预定义模板选择里程碑集或自定义里程碑，设置目标日期与依赖关系 | 从模板加载、添加/删除里程碑、设置依赖 |
| 4 | 中心预选与可行性问卷 (Site Pre-selection) | 在立项阶段预选候选中心，发起可行性问卷（链接至 M04 中心模块） | 添加候选中心、发送问卷、查看反馈 |
| 5 | 审批工作流 (Approval Workflow) | 基于 Flowable 的立项审批流程：PM 提交 → 医学审核 → 运营审核 → 财务审核 → 最终批准 | 提交、审批通过、驳回（含意见）、撤回 |
| 6 | 研究任务清单 (Study Task Checklist) | 立项阶段关联的必做任务（如：获取方案终版、签署合同、伦理批件获取、合同签署），追踪完成状态 | 勾选完成、上传证据文件、添加备注 |
| 7 | 研究时间线 (Study Timeline) | 以时间线形式展示研究的完整生命周期（从立项到归档），包括里程碑达成、状态变更、关键事件 | 筛选事件类型、导出 |
| 8 | 立项文档管理 (Startup Document Repository) | 存储立项阶段的相关文档（方案、知情同意书模板、研究者手册、合同等） | 上传、预览、版本管理、关联至 FileObject |
| 9 | 预算与合同概览 (Budget & Contract Summary) | 展示与立项相关的预算审批状态与合同签署状态（只读概览，详细在财务模块） | 查看详情 |
| 10 | 重复研究与冲突检查 (Duplicate & Conflict Check) | 提交前自动检测是否存在相同适应症、相同方案的重复立项 | 查看检查结果、强制提交 |

**核心交互流程 (Core Interactions):**

1. 用户（PM 或 Admin）点击"新建研究"进入创建向导，第一步填写研究基本信息：研究编号（可自动生成，规则：CT-{year}-{seq}）、全称、简称、治疗领域、适应症、申办方、研究类型、分期。系统实时校验研究编号唯一性。
2. 第二步选择/关联方案：从已有方案库中选择，或上传新方案文档（跳转 M03）。若选择已有方案，系统自动带入方案版本信息。若为新方案，则提示先去 M03 完成方案上传。
3. 第三步中心预选：通过搜索选择候选中心（Site），系统展示中心基本信息（所在城市、PI 姓名、设施情况）。勾选后系统自动生成待发送的可行性问卷任务（关联 M04）。
4. 第四步里程碑规划：系统根据研究类型和分期自动加载推荐的里程碑模板（如 I 期研究模板含 FPI、LPI、LPO、DBL、CSR 等）。用户可调整目标日期、增加/删除里程碑、设置依赖关系（如 LPI 依赖 FPI，DBL 依赖 LPO）。前端以甘特图形式实时预览。
5. 第五步确认与提交：汇总展示前面所有步骤填写的信息，用户确认无误后点击"提交审批"。系统执行重复检查，若有疑似重复研究弹出警告，用户可选择"继续提交"或"返回修改"。
6. 系统调用 Flowable 启动审批流程实例（processDefinitionKey: study_initiation_approval），创建第一个审批任务并分配给医学审核角色。研究状态从 draft 变更为 pending_approval。
7. 审批人在"我的待办"中看到审批任务，点击进入审批页面。页面展示研究申请的全部信息、里程碑计划、中心预选列表。审批人可选择：通过（附意见）、驳回（必填驳回原因）、转审（转给其他人）。
8. 驳回时，研究状态变回 draft，PM 收到通知并在"我的待办"中看到修改任务。PM 修改后重新提交，流程回到审批环节。
9. 全部审批节点通过后，系统自动：激活研究（状态变更为 startup）、生成 StudyTask 实例（关联至里程碑）、发送通知给相关角色（CRA、CRC、PI 等）。
10. 研究进入 startup 阶段后，PM 在任务清单中逐一确认启动前置条件（伦理批件、合同签署、研究者培训等），全部完成后可手动将研究状态推进至 enrolling。

**关键状态流转 (State Transitions):**

| 当前状态 | 目标状态 | 触发动作 | 触发角色 | 前置条件 | 审计要求 |
|----------|----------|----------|----------|----------|----------|
| draft | pending_approval | 提交立项审批 | PM | 必填字段完整、里程碑已设置、至少关联一个方案版本、中心预选列表非空 | 记录提交人、提交时间、提交内容快照 (JSONB) |
| pending_approval | draft | 审批驳回 | 审批人 (医学/运营/财务) | 驳回意见必填 | 记录驳回人、驳回时间、驳回原因 |
| pending_approval | approved | 全部审批节点通过 | 审批人 (医学/运营/财务) | 所有节点审批通过 | 记录每个节点的审批人、时间、意见 |
| approved | startup | 系统自动流转 | 系统 | 审批全部通过、研究任务自动生成 | 记录自动化流转时间 |
| startup | enrolling | 启动前置任务全部完成 | PM | 伦理批件已获取、合同已签署、研究者培训已完成 | 记录启动确认人、时间 |
| startup | draft | 撤回研究（启动前） | PM/Admin | 尚无受试者入组 | 记录撤回原因 |
| enrolling | locked | 研究数据锁定 | PM/数据管理 | DBL 已完成、Query 全部关闭 | 记录锁定人、锁定时间、锁定范围 |
| locked | archived | 归档研究 | PM/Admin | CSR 已完成、监管报告已提交 | 记录归档人、归档时间 |

**核心字段 (Core Fields):**

| 字段 | 类型 | 必填 | 敏感级别 | 说明 |
|------|------|------|----------|------|
| study_id | UUIDv7 | 是 | 内部 | 研究主键 |
| study_code | VARCHAR(50) | 是 | 内部 | 研究编号，自动生成规则 CT-{year}-{seq} |
| study_title | VARCHAR(500) | 是 | 内部 | 研究全称（英文） |
| study_title_cn | VARCHAR(500) | 否 | 内部 | 研究全称（中文） |
| short_title | VARCHAR(200) | 否 | 内部 | 研究简称/缩写 |
| therapeutic_area | VARCHAR(200) | 否 | 内部 | 治疗领域（从字典表取值） |
| indication | VARCHAR(500) | 是 | 内部 | 适应症 |
| study_type | VARCHAR(50) | 是 | 内部 | 研究类型：INTERVENTIONAL / OBSERVATIONAL |
| study_phase | VARCHAR(20) | 是 | 内部 | 研究分期：I / II / III / IV / NOT_APPLICABLE |
| sponsor_name | VARCHAR(200) | 是 | 内部 | 申办方名称 |
| sponsor_contact | VARCHAR(200) | 否 | 内部 | 申办方联系人 |
| cro_name | VARCHAR(200) | 否 | 内部 | CRO 名称（如有） |
| protocol_id | UUIDv7 | 否 | 内部 | 关联的当前生效 ProtocolVersion ID |
| pm_user_id | UUIDv7 | 是 | 内部 | 负责的项目经理 |
| planned_sites_count | INTEGER | 是 | 内部 | 计划中心数量 |
| planned_enrollment | INTEGER | 是 | 内部 | 计划总入组数 |
| start_date | DATE | 否 | 内部 | 计划启动日期 (FPI 目标) |
| end_date | DATE | 否 | 内部 | 计划结束日期 (LPO 目标) |
| status | VARCHAR(30) | 是 | 内部 | 状态：draft / pending_approval / approved / startup / enrolling / followup / locked / archived |
| approval_workflow_id | VARCHAR(100) | 否 | 内部 | Flowable 流程实例 ID |
| study_metadata | JSONB | 否 | 内部 | 扩展元数据（自定义字段、配置项） |
| is_deleted | BOOLEAN | 是 | 内部 | 软删除标记，默认 false |

**异常场景 (Exception Scenarios):**

| 场景 | 处理方式 | 用户提示 |
|------|----------|----------|
| 研究编号重复 | 前端实时校验 + 后端唯一约束，提交时防重 | "研究编号 [code] 已存在，请更换编号或检查是否重复立项" |
| 向导中某一步数据未保存即点击下一步 | 自动保存当前步骤草稿到 localStorage + 后端 draft 接口，然后跳转 | 静默保存，无感知 |
| 提交审批时流程引擎不可用 | 前端显示错误，不丢失已填数据（draft 已保存），提供重试 | "审批流程启动失败，您的数据已保存为草稿，请稍后重试" |
| 审批超时（超过配置天数无人审批） | 系统自动发送催办通知给审批人及其上级，抄送 PM | 通知中心显示催办提醒 |
| 里程碑依赖关系中目标日期早于前置里程碑 | 前端甘特图实时校验，红线标注冲突 | "里程碑 [name] 的目标日期早于其依赖里程碑 [dep_name] 的完成日期，请调整" |
| 重复研究检测命中 | 弹出警告对话框列出疑似重复的研究（name、code、适应症相似度），用户可选择继续或取消 | "检测到以下疑似重复研究：[列表]，是否确认继续提交？" |
| 草稿超过 30 天未提交 | 系统自动发送提醒通知给 PM | "您的研究 [code] 草稿已保存 30 天，是否继续编辑或删除？" |

**权限要求 (Permission):**

| 角色 | 查看 | 创建 | 编辑 | 删除 | 特殊权限 |
|------|------|------|------|------|----------|
| Admin | 全局 | 是 | 全局 | 是（仅 draft） | 强制提交、跳过审批 |
| PM | 所负责研究 | 是 | 所负责研究 (draft/startup) | 是（仅 draft） | 提交审批、推进状态、编辑里程碑 |
| CRA | 所负责中心关联研究 | — | — | — | 查看启动进度 |
| Sponsor | 所申办研究 | — | — | — | 审批（若配置为审批节点） |
| Finance | 所关联研究 | — | — | — | 审批预算相关节点 |
| ReadOnlyAuditor | 全局（只读） | — | — | — | 全字段只读 |
| CRC | — | — | — | — | 无访问权限 |
| PI | — | — | — | — | 无访问权限（通过 M04 查看） |
| Patient/Caregiver | — | — | — | — | 无访问权限 |

**关联数据实体 (Related Entities):** Study, ProtocolVersion, StudyMilestone, StudyTask, Site, FileObject, AuditLog, Notification

**关联 REST API (Related APIs):**

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | /api/v1/studies | 创建研究（向导保存草稿或最终提交） |
| GET | /api/v1/studies/{id} | 获取研究详情 |
| PUT | /api/v1/studies/{id} | 更新研究基本信息 |
| PATCH | /api/v1/studies/{id}/status | 更新研究状态（含状态机校验） |
| POST | /api/v1/studies/{id}/submit-approval | 提交立项审批（启动 Flowable 流程） |
| POST | /api/v1/studies/{id}/approve | 审批通过当前节点 |
| POST | /api/v1/studies/{id}/reject | 审批驳回 |
| POST | /api/v1/studies/{id}/withdraw | 撤回审批 |
| GET | /api/v1/studies/{id}/approval-history | 获取审批历史（流程记录） |
| GET | /api/v1/studies/{id}/milestones | 获取研究的里程碑列表 |
| POST | /api/v1/studies/{id}/milestones | 批量保存里程碑 |
| PUT | /api/v1/studies/{id}/milestones/{mid} | 更新单个里程碑 |
| GET | /api/v1/studies/{id}/tasks | 获取研究任务清单 |
| PUT | /api/v1/studies/{id}/tasks/{tid} | 更新任务完成状态 |
| POST | /api/v1/studies/duplicate-check | 重复研究检查 |
| GET | /api/v1/studies/{id}/timeline | 获取研究时间线 |
| GET | /api/v1/study-milestone-templates | 获取里程碑模板列表 |
| GET | /api/v1/study-milestone-templates/{id} | 获取模板详情（含里程碑定义） |

---

## M03: 方案与版本管理 (Protocol & Version Management)

### M03: 方案与版本管理

**模块目标 (Goal):** 管理临床研究方案的完整生命周期，包括方案文档上传、版本发布、修订对比、审批流程以及方案版本与研究、知情同意书模板、访视模板之间的关联追溯，确保所有研究使用的方案版本可控、可追溯、符合 GCP 要求。

**子功能清单 (Sub-features):**

| 序号 | 子功能 | 描述 | 关键操作 |
|------|--------|------|----------|
| 1 | 方案库总览 (Protocol Repository) | 展示所有方案的列表，按治疗领域、状态、创建时间筛选，支持全文检索 | 新建方案、导入方案 |
| 2 | 方案创建与元数据编辑 (Protocol Profile) | 创建方案基本信息：方案编号、标题、治疗领域、适应症、申办方、方案摘要 | 保存、编辑、归档 |
| 3 | 文档上传与预览 (Document Upload & Preview) | 上传方案 PDF/Word 文件至 MinIO，支持在线预览（PDF.js） | 上传、替换文件、在线预览、下载 |
| 4 | 版本管理 (Version Management) | 创建新版本（major/minor/patch），记录版本号（语义化版本）、变更说明、生效日期 | 创建新版本、设为当前版本、版本回退 |
| 5 | 版本对比 (Version Diff) | 并排展示两个版本之间的差异，包括元数据变更和文档内容对比（附件级别） | 选择版本 A/B，展示差异 |
| 6 | 版本审批工作流 (Version Approval Workflow) | 基于 Flowable 的方案版本审批：提交 → 医学审核 → 法规审核 → 批准/驳回 | 提交审批、审批通过、驳回 |
| 7 | 关联影响分析 (Impact Analysis) | 方案版本变更时自动分析影响范围：关联的知情同意书模板是否需要更新、访视模板是否需要调整、已入组受试者是否需要重新知情 | 运行影响分析、查看报告 |
| 8 | 方案关联管理 (Protocol Associations) | 管理方案版本与 ICF 模板（ConsentTemplate）、访视模板（VisitTemplate）的关联关系 | 添加/解除关联 |
| 9 | 方案修订历史 (Amendment History) | 展示方案的完整修订历史时间线，包括每个版本的创建时间、审批人、生效日期、变更摘要 | 按时间轴查看、筛选版本 |
| 10 | 方案合规检查 (Compliance Checklist) | 检查方案必备要素：签名页、研究目的、入排标准、访视计划、统计方法、安全性报告要求等 | 勾选检查项、生成合规报告 |

**核心交互流程 (Core Interactions):**

1. 用户（PM 或医学角色）进入方案库，浏览已有方案列表。列表每行显示：方案编号、标题、当前版本号、状态、治疗领域、最近更新时间。支持按状态和关键词过滤。
2. 用户点击"新建方案"，填写方案元数据：方案编号（规则：PROTO-{study_code}）、标题、治疗领域、适应症、申办方、方案摘要。保存后方案状态为 draft。
3. 在方案详情页，用户点击"上传文档"上传方案文件（PDF/Word，最大 50MB）。文件上传至 MinIO，后端创建 FileObject 记录并关联到当前方案版本。上传成功后文件显示在文档列表中，支持在线预览（使用 PDF.js 渲染或 MinIO 预签名 URL）。
4. 用户填写版本变更说明（变更摘要、变更原因、影响评估）、选择版本类型（Major: 实质性变更 / Minor: 非实质性变更 / Patch: 勘误），点击"发布版本"。系统检查版本号自动递增（如 1.0.0 → 若 Major 则为 2.0.0）。
5. 系统自动进行影响分析：检索所有关联的 ConsentTemplate 和 VisitTemplate，标记"可能受影响"的实体，生成影响分析报告并展示给用户确认。
6. 用户确认后提交版本审批。系统创建 Flowable 流程实例（processDefinitionKey: protocol_version_approval），生成审批任务。方案版本状态从 draft 变更为 pending_approval。
7. 审批人依次审核（医学审核 → 法规审核），每个节点可选择通过或驳回。驳回时需填写驳回原因，版本状态回到 draft。
8. 审批全部通过后，版本状态变更为 approved，系统自动或手动设置生效日期。系统自动发送通知给所有使用该方案的研究的 PM，告知方案版本已更新，并提示可能的 ICF/访视模板更新需求。
9. 若方案版本存在重大变更（Major），系统会自动标记关联研究的 reconsent 需求（通知 M05 受试者管理模块），提示 CRC 为已入组受试者执行重新知情同意流程。
10. 用户可在版本历史时间线中查看方案的所有版本记录。点击两个版本可进入并排对比视图，系统展示：元数据差异表 + 文档列表变化（新增/删除/替换的附件）。

**关键状态流转 (State Transitions):**

| 当前状态 | 目标状态 | 触发动作 | 触发角色 | 前置条件 | 审计要求 |
|----------|----------|----------|----------|----------|----------|
| draft | pending_approval | 提交版本审批 | PM / 医学 | 方案文档已上传、变更说明已填写、影响分析已完成 | 记录提交人、时间、版本快照 |
| pending_approval | draft | 审批驳回 | 审批人（医学/法规） | 驳回原因必填 | 记录驳回人、原因、时间 |
| pending_approval | approved | 全部审批通过 | 审批人（医学/法规） | 所有审批节点通过 | 记录每节点审批信息 |
| approved | effective | 到达生效日期（或手动生效） | 系统/PM | 审批通过且生效日期已到 | 记录生效时间 |
| effective | superseded | 新版本生效 | 系统 | 新版本已 approved 且生效 | 记录被取代的版本号 |
| any | revoked | 版本撤回/作废 | Admin | 该版本未被任何研究使用或使用研究均处于 draft | 记录撤回原因与时间 |
| effective | suspended | 紧急暂停（安全原因） | Admin / DSMB | 安全性事件触发 | 记录暂停原因、时间、相关 SAE 引用 |

**核心字段 (Core Fields):**

| 字段 | 类型 | 必填 | 敏感级别 | 说明 |
|------|------|------|----------|------|
| protocol_id | UUIDv7 | 是 | 内部 | 方案主键（跨版本不变） |
| protocol_code | VARCHAR(50) | 是 | 内部 | 方案编号，如 PROTO-CT-2026-001 |
| protocol_title | VARCHAR(500) | 是 | 内部 | 方案标题 |
| therapeutic_area | VARCHAR(200) | 否 | 内部 | 治疗领域 |
| indication | VARCHAR(500) | 是 | 内部 | 适应症 |
| sponsor_name | VARCHAR(200) | 是 | 内部 | 申办方 |
| protocol_version_id | UUIDv7 | 是 | 内部 | 版本主键 |
| version_number | VARCHAR(20) | 是 | 内部 | 语义化版本号（如 1.0.0） |
| version_type | VARCHAR(20) | 是 | 内部 | 版本类型：MAJOR / MINOR / PATCH |
| version_status | VARCHAR(30) | 是 | 内部 | 版本状态：draft / pending_approval / approved / effective / superseded / revoked / suspended |
| change_summary | TEXT | 是 | 内部 | 变更摘要 |
| change_reason | TEXT | 否 | 内部 | 变更原因 |
| impact_assessment | TEXT | 否 | 内部 | 影响评估说明 |
| effective_date | DATE | 否 | 内部 | 生效日期 |
| approval_workflow_id | VARCHAR(100) | 否 | 内部 | Flowable 流程实例 ID |
| file_object_id | UUIDv7 | 是 | 内部 | 关联的方案文档 FileObject ID |
| amendment_number | VARCHAR(20) | 否 | 内部 | 修正案编号（法规提交用途） |
| ec_approval_date | DATE | 否 | 内部 | 伦理委员会批准日期 |
| ra_approval_date | DATE | 否 | 内部 | 监管机构批准日期 |
| protocol_metadata | JSONB | 否 | 内部 | 扩展信息（入排标准摘要、研究设计等） |

**异常场景 (Exception Scenarios):**

| 场景 | 处理方式 | 用户提示 |
|------|----------|----------|
| 方案文档上传文件格式不支持 | 前端类型校验 + 后端 Magic Number 校验 | "不支持的文件格式，请上传 PDF 或 DOCX 文件" |
| 方案文档超过大小限制 (50MB) | 前端文件大小校验 + 后端 Multer 限制 | "文件大小超过 50MB 限制，请压缩后重新上传" |
| 版本号冲突（同一方案已存在相同版本号） | 后端唯一约束检查 + 前端自动递增提示 | "版本号 [num] 已存在，系统建议版本号：[suggested]" |
| 影响分析发现高风险项（如已入组受试者需重新知情） | 前端弹出特殊警告框，列出高风险项，要求用户确认并留下备注 | "警告：此变更可能影响 [N] 名已入组受试者，需执行重新知情同意流程" |
| 审批期间有人尝试修改版本内容 | 悲观锁（status = pending_approval 时禁止编辑） | "此版本正在审批中，无法修改。请等待审批完成或撤回审批" |
| 文件预览服务 (MinIO) 不可用 | 降级为仅显示文件信息和下载链接，隐藏预览面板 | "文档预览暂不可用，您仍可下载文件查看" |
| 版本回退操作（将旧版本重新设为 current） | 需 Admin 权限 + 二次确认 + 填写回退原因 + 通知所有使用方案的研究 PM | "确认将版本回退至 [old_ver]？此操作将通知所有使用此方案的研究团队" |

**权限要求 (Permission):**

| 角色 | 查看 | 创建 | 编辑 | 删除 | 特殊权限 |
|------|------|------|------|------|----------|
| Admin | 全局 | 是 | 全局 | 是 | 版本回退、强制生效、版本撤回 |
| PM | 所负责研究关联方案 | 是 | 所负责方案 (draft) | 是（仅 draft） | 提交审批、影响分析 |
| 医学角色 | 全局 | 是 | 所负责方案 (draft) | — | 审批（医学审核节点） |
| 法规角色 | 全局 | — | — | — | 审批（法规审核节点） |
| CRA | 所负责中心关联研究的方案 | — | — | — | 只读查看生效版本 |
| CRC | 所负责中心关联研究的方案 | — | — | — | 只读（查看方案中的访视/评估要求） |
| PI | 所负责中心关联研究的方案 | — | — | — | 只读 |
| Sponsor | 所申办研究的方案 | — | — | — | 只读 |
| ReadOnlyAuditor | 全局（只读） | — | — | — | 全字段只读 |

**关联数据实体 (Related Entities):** ProtocolVersion, Study, ConsentTemplate, VisitTemplate, FileObject, AuditLog, Notification

**关联 REST API (Related APIs):**

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api/v1/protocols | 分页查询方案列表 |
| POST | /api/v1/protocols | 创建方案（初始版本） |
| GET | /api/v1/protocols/{id} | 获取方案详情 |
| PUT | /api/v1/protocols/{id} | 更新方案元数据 |
| GET | /api/v1/protocols/{id}/versions | 获取方案的所有版本列表 |
| POST | /api/v1/protocols/{id}/versions | 创建新的方案版本 |
| GET | /api/v1/protocols/{id}/versions/{vid} | 获取指定版本详情 |
| PUT | /api/v1/protocols/{id}/versions/{vid} | 更新版本信息（仅 draft） |
| POST | /api/v1/protocols/{id}/versions/{vid}/submit-approval | 提交版本审批 |
| POST | /api/v1/protocols/{id}/versions/{vid}/approve | 审批通过 |
| POST | /api/v1/protocols/{id}/versions/{vid}/reject | 审批驳回 |
| POST | /api/v1/protocols/{id}/versions/{vid}/withdraw | 撤回审批 |
| GET | /api/v1/protocols/{id}/versions/diff | 版本差异对比（query: v1=xxx&v2=yyy） |
| GET | /api/v1/protocols/{id}/versions/{vid}/impact-analysis | 获取指定版本的影响分析报告 |
| POST | /api/v1/protocols/{id}/documents | 上传方案文档 |
| GET | /api/v1/protocols/{id}/documents/{fid}/preview-url | 获取文档预览 URL（MinIO 预签名） |
| GET | /api/v1/protocols/{id}/timeline | 获取方案修订历史时间线 |

---

## M04: 中心/研究者管理 (Site/Investigator Management)

### M04: 中心/研究者管理

**模块目标 (Goal):** 支持临床研究中心的选点、可行性评估、启动激活、研究者与研究人员管理、培训追踪以及中心绩效监控的全流程管理，确保每个中心符合 GCP 要求并按时完成启动准备。

**子功能清单 (Sub-features):**

| 序号 | 子功能 | 描述 | 关键操作 |
|------|--------|------|----------|
| 1 | 中心库总览 (Site Repository) | 展示所有中心的列表/卡片视图，支持按状态、城市、研究筛选 | 添加中心、导入中心 |
| 2 | 中心档案管理 (Site Profile) | 维护中心基本信息：名称、地址、联系方式、设施描述、资质证书 | 编辑、上传资质文件 |
| 3 | 可行性问卷管理 (Feasibility Questionnaire) | 向候选中心发送可行性问卷，追踪完成状态，汇总反馈 | 创建问卷、发送、查看回复、评分 |
| 4 | 中心选点决策 (Site Selection) | 基于可行性问卷结果、历史绩效、PI 资质等进行中心选点评分与决策 | 评分、状态变更（candidate→selected） |
| 5 | 研究者管理 (Investigator Management) | 管理 PI/Sub-I 的个人信息、资质证书（GCP 证书、执业证）、CV、培训记录 | 添加研究者、上传证书、设置到期提醒 |
| 6 | 中心激活清单 (Site Activation Checklist) | 管理从 selected 到 active 必须完成的启动任务清单：合同签署、伦理批件、研究者培训、设备到位、药品到位 | 勾选任务、上传证据、标记完成 |
| 7 | 培训追踪 (Training Tracking) | 追踪中心研究人员的方案培训、GCP 培训、系统培训完成情况 | 记录培训、上传培训记录、到期提醒 |
| 8 | 中心绩效看板 (Site Performance Dashboard) | 展示单个中心的入组效率、数据质量（Query 率）、监查发现数、方案偏离率 | 查看趋势图、对比基准 |
| 9 | 中心沟通记录 (Site Communication Log) | 记录与中心的沟通（邮件、电话、会议），关联 Issue 或 Action Item | 新建记录、关联实体 |
| 10 | 中心暂停/关闭管理 (Site Suspension/Closure) | 管理中心暂停入组或关闭中心的流程与审批 | 申请暂停/关闭、审批、记录原因 |

**核心交互流程 (Core Interactions):**

1. PM 或 CRA 进入中心管理模块首页，展示中心总览列表。每行显示：中心编码、名称、所在城市、当前状态、关联研究数、PI 姓名、最近监查日期。状态以彩色标签展示（candidate=灰、selected=蓝、activating=橙、active=绿、paused=黄、closed=红）。
2. 用户点击"添加中心"，填写中心基本信息（名称、地址、城市、省份、机构类型、联系方式）。保存后中心状态为 candidate。
3. 对于 candidate 状态的中心，PM 可发起可行性评估（Feasibility Assessment）：系统自动生成标准可行性问卷（如：PI 经验、科室病源量、伦理委员会周期、设备条件、竞争试验情况），发送给中心联系人。
4. 中心联系人通过外部链接填写问卷，或 CRC 代为录入。系统汇总问卷回复，生成评分（基于预设评分规则，如：PI 经验权重 30%、病源量权重 30%、伦理周期权重 20% 等）。
5. PM 在可行性评审页面查看各中心的评分排名与详细回复，勾选要选定的中心（可多选），点击"选定中心"。系统将中心状态从 candidate 批量变更为 selected，并生成对应的 SiteTask（激活清单任务）。
6. 对于 selected 状态的中心，CRA 逐步完成激活清单任务：（a）合同签署 → 上传合同扫描件；（b）伦理批件获取 → 上传伦理批件；（c）研究者文档收集（CV、GCP 证书、执业证）→ 上传至 FileObject；（d）设备到位确认；（e）药品到位确认；（f）研究者培训完成 → 关联培训记录。
7. 全部激活清单任务完成后，CRA 点击"申请激活"，系统将中心状态变更为 activating，并通知 PM 审核。
8. PM 确认后手动将中心状态推进至 active。系统记录激活日期，并允许该中心开始筛选受试者。
9. 中心进入 active 后，CRA 可在培训追踪中为该中心研究人员安排方案培训、系统培训。培训完成后记录培训日期、培训内容、到期日。系统自动监测证书/培训到期情况（提前 30 天、7 天提醒）。
10. 当中心因绩效问题、安全性问题或研究结束需要暂停或关闭时，PM 或 CRA 发起暂停/关闭申请，填写原因与计划，经审批后中心状态变更为 paused 或 closed。若为 paused，可后续恢复至 active。

**关键状态流转 (State Transitions):**

| 当前状态 | 目标状态 | 触发动作 | 触发角色 | 前置条件 | 审计要求 |
|----------|----------|----------|----------|----------|----------|
| candidate | selected | 可行性评估通过并选定 | PM | 可行性问卷已完成、评分达标 | 记录选点决策依据（评分、备注） |
| candidate | rejected | 可行性评估不通过 | PM | 拒绝原因必填 | 记录拒绝原因与时间 |
| selected | activating | 激活清单全部完成并提交 | CRA | 所有激活清单任务 completed、合同已签署、伦理批件已获取、研究者资质齐全 | 记录清单完成证据 |
| activating | active | PM 审核确认激活 | PM | 激活申请已提交、审查无误 | 记录激活日期与审批人 |
| active | paused | 中心暂停申请审批通过 | PM/CRA | 暂停原因必填、已获批准 | 记录暂停原因、暂停日期 |
| paused | active | 中心恢复 | PM | 暂停原因已解决、确认可恢复 | 记录恢复日期与审批人 |
| active | closed | 中心关闭申请审批通过 | PM | 关闭原因必填、所有受试者已完成/转出、CRF 数据已锁定、监查访视已完结 | 记录关闭日期、关闭报告 |
| paused | closed | 中心关闭（从暂停状态） | PM | 同 active→closed | 记录关闭日期、关闭报告 |

**核心字段 (Core Fields):**

**Site (中心) 字段：**

| 字段 | 类型 | 必填 | 敏感级别 | 说明 |
|------|------|------|----------|------|
| site_id | UUIDv7 | 是 | 内部 | 中心主键 |
| site_code | VARCHAR(20) | 是 | 内部 | 中心编码（如 SITE-001） |
| site_name | VARCHAR(200) | 是 | 内部 | 中心全称（机构名称） |
| site_type | VARCHAR(50) | 是 | 内部 | 机构类型：HOSPITAL / CLINIC / RESEARCH_CENTER |
| address_line1 | VARCHAR(300) | 是 | 内部 | 地址 1 |
| city | VARCHAR(100) | 是 | 内部 | 城市 |
| province | VARCHAR(100) | 是 | 内部 | 省份/州 |
| country | VARCHAR(100) | 是 | 内部 | 国家 |
| postal_code | VARCHAR(20) | 否 | 内部 | 邮政编码 |
| contact_name | VARCHAR(100) | 否 | 内部 | 中心联系人 |
| contact_phone | VARCHAR(50) | 否 | PII | 联系电话 |
| contact_email | VARCHAR(200) | 否 | PII | 联系邮箱 |
| status | VARCHAR(20) | 是 | 内部 | 状态：candidate / selected / activating / active / paused / closed / rejected |
| feasibility_score | DECIMAL(5,2) | 否 | 内部 | 可行性评估评分 |
| activation_date | DATE | 否 | 内部 | 激活日期 |
| close_date | DATE | 否 | 内部 | 关闭日期 |
| site_metadata | JSONB | 否 | 内部 | 扩展信息（设施描述、特殊要求等） |

**Investigator (研究者) 字段：**

| 字段 | 类型 | 必填 | 敏感级别 | 说明 |
|------|------|------|----------|------|
| investigator_id | UUIDv7 | 是 | 内部 | 研究者主键 |
| full_name | VARCHAR(100) | 是 | PII | 姓名 |
| role | VARCHAR(30) | 是 | 内部 | 角色：PI / SUB_I |
| license_number | VARCHAR(50) | 否 | PII | 执业证编号 |
| specialty | VARCHAR(200) | 否 | 内部 | 专业领域 |
| cv_file_id | UUIDv7 | 否 | 内部 | CV 文件关联 (FileObject) |
| gcp_certificate_id | UUIDv7 | 否 | 内部 | GCP 证书文件关联 |
| gcp_certificate_expiry | DATE | 否 | 内部 | GCP 证书到期日 |
| site_id | UUIDv7 | 是 | 内部 | 所属中心 ID |
| is_primary | BOOLEAN | 是 | 内部 | 是否为主要研究者（PI） |

**异常场景 (Exception Scenarios):**

| 场景 | 处理方式 | 用户提示 |
|------|----------|----------|
| 可行性问卷无回复（超过预设天数） | 系统自动发送催办邮件/通知给中心联系人和 CRA | "中心 [name] 的可行性问卷已超过 [N] 天未回复" |
| 激活清单任务阻塞（如伦理批件超期未获取） | 清单页该任务标红，显示已超期天数，通知 PM | "伦理批件获取任务已超期 [N] 天，请跟进" |
| 研究者 GCP 证书即将到期（30 天内） | 系统自动生成通知，并在培训追踪页标记为警告状态 | "研究者 [name] 的 GCP 证书将于 [date] 到期，请安排重新培训" |
| 同一医生在多中心担任 PI | 添加研究者时前端提示 + 后端校验关联研究是否冲突 | "该研究者已在中心 [other_site] 担任 [role]，确认继续添加？" |
| 中心关闭时有未完成的受试者访视 | 后端校验，阻止关闭操作 | "该中心尚有 [N] 名受试者有未完成的访视，请先处理或转移" |
| 中心暂停后 90 天未恢复 | 系统自动升级通知至 PM 和 Admin | "中心 [name] 已暂停 90 天，请评估是否需要关闭该中心" |
| 可行性评分中出现多中心同分 | 前端平局展示，支持手动排序和备注 | "以下中心评分相同：[list]，请手动排定优先级" |

**权限要求 (Permission):**

| 角色 | 查看 | 创建 | 编辑 | 删除 | 特殊权限 |
|------|------|------|------|------|----------|
| Admin | 全局 | 是 | 全局 | 是 | 强制关闭中心 |
| PM | 所负责研究关联中心 | 是 | 所管理中心的档案与清单 | — | 选点决策、激活审批、暂停/关闭审批 |
| CRA | 所负责中心 | — | 所负责中心的清单与培训 | — | 激活清单操作、培训记录、监查安排 |
| CRC | 所属中心 | — | — | — | 查看激活清单（只读） |
| PI | 所属中心 | — | 编辑本人信息与证书 | — | 查看中心档案 |
| Sponsor | 所研究关联中心 | — | — | — | 只读 |
| ReadOnlyAuditor | 全局（只读） | — | — | — | 全字段只读 |
| Patient/Caregiver | — | — | — | — | 无访问权限 |

**关联数据实体 (Related Entities):** Site, Investigator, Study (多对多 study_site), StudyTask (激活清单), FileObject, FeasibilityQuestionnaire (JSONB), TrainingRecord, CommunicationLog, AuditLog, Notification

**关联 REST API (Related APIs):**

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api/v1/sites | 分页查询中心列表（支持按研究、状态、城市筛选） |
| POST | /api/v1/sites | 添加中心 |
| GET | /api/v1/sites/{id} | 获取中心详情（含研究者列表、激活清单摘要） |
| PUT | /api/v1/sites/{id} | 更新中心档案 |
| PATCH | /api/v1/sites/{id}/status | 更新中心状态（含状态机校验） |
| POST | /api/v1/sites/{id}/select | 选定中心（candidate→selected） |
| POST | /api/v1/sites/{id}/activate | 提交激活申请（activating） |
| POST | /api/v1/sites/{id}/confirm-activation | PM 确认激活（activating→active） |
| POST | /api/v1/sites/{id}/pause | 暂停中心 |
| POST | /api/v1/sites/{id}/resume | 恢复中心 |
| POST | /api/v1/sites/{id}/close | 关闭中心 |
| GET | /api/v1/sites/{id}/feasibility | 获取可行性问卷及评分 |
| POST | /api/v1/sites/{id}/feasibility | 创建/发送可行性问卷 |
| PUT | /api/v1/sites/{id}/feasibility | 填写/更新问卷回复 |
| GET | /api/v1/sites/{id}/activation-checklist | 获取激活清单任务 |
| PUT | /api/v1/sites/{id}/activation-checklist/{tid} | 更新激活清单任务状态 |
| GET | /api/v1/sites/{id}/investigators | 获取中心研究者列表 |
| POST | /api/v1/sites/{id}/investigators | 添加研究者 |
| PUT | /api/v1/sites/{id}/investigators/{iid} | 更新研究者信息 |
| GET | /api/v1/sites/{id}/training-records | 获取培训记录列表 |
| POST | /api/v1/sites/{id}/training-records | 添加培训记录 |
| GET | /api/v1/sites/{id}/performance | 获取中心绩效数据 |
| GET | /api/v1/sites/{id}/communication-log | 获取沟通记录 |
| POST | /api/v1/sites/{id}/communication-log | 添加沟通记录 |
| GET | /api/v1/investigators | 全局搜索研究者 |
| GET | /api/v1/investigators/{id}/certifications | 获取研究者证书列表 |

---

## M05: 受试者筛选/入组/随机/退出管理 (Subject Management)

### M05: 受试者筛选/入组/随机/退出管理

**模块目标 (Goal):** 管理受试者从潜在招募到完成/退出研究的全生命周期，包括预筛选、知情同意签署 (ICF)、筛选访视、合格性评估、入组确认、随机分组、访视追踪、早期终止与退出管理，确保受试者数据完整、受试者隐私 (PII) 受到严格的角色权限控制。

**子功能清单 (Sub-features):**

| 序号 | 子功能 | 描述 | 关键操作 |
|------|--------|------|----------|
| 1 | 受试者列表与搜索 (Subject List & Search) | 按中心、状态、筛选日期、入组日期等条件筛选受试者列表，支持全局 ID 搜索 | 筛选、导出、批量操作 |
| 2 | 预筛选与招募 (Pre-screening & Recruitment) | 管理潜在受试者（lead），记录基本信息、初步入排评估、来源渠道 | 添加 lead、发起预筛选、转为 prescreened |
| 3 | 知情同意管理 (ICF Management) | 关联 ConsentRecord，追踪知情同意书签署状态、版本、日期，管理重新知情流程 | 查看 ICF 状态、发起重新知情 |
| 4 | 筛选访视与合格性评估 (Screening & Eligibility) | 记录筛选访视数据（人口学、病史、体格检查、实验室检查），系统自动匹配入排标准并给出合格性判定建议 | 填写筛选 CRF、查看合格性评估结果 |
| 5 | 入组确认 (Enrollment Confirmation) | 确认受试者合格并入组，系统验证：ICF 已签署、合格性全部满足、无并发入组冲突 | 确认入组、生成 subject_id |
| 6 | 随机分组 (Randomization) | 支持多种随机方案（简单随机、分层区组随机、动态随机），系统自动分配治疗组 | 触发随机、查看分配结果 |
| 7 | 随机盲态管理 (Blinding Management) | 区分盲态角色（非盲药师/统计师）与非盲态角色的数据访问权限，紧急揭盲流程 | 紧急揭盲申请/审批/执行 |
| 8 | 退出/终止管理 (Withdrawal/Termination) | 管理受试者退出（自愿退出）与终止（研究者决定），记录退出原因、退出访视 | 登记退出/终止、记录退出原因 |
| 9 | 受试者流转仪表盘 (Subject Flow Dashboard) | 以漏斗图/桑基图形式展示受试者从 lead 到 completed 的流转数据与转化率 | 查看流转漏斗、导出 |
| 10 | 受试者时间线 (Subject Timeline) | 展示单个受试者的完整历程时间线：预筛选→知情→筛选→入组→随机→各访视→退出/完成 | 查看时间线、点击跳转到详情 |
| 11 | 受试者文档管理 (Subject Document Management) | 管理受试者相关文档：ICF 签署件、身份证复印件、检查报告等 | 上传、预览、关联 FileObject |
| 12 | PII 脱敏与访问控制 (PII Masking & Access Control) | 基于角色自动脱敏受试者身份信息（姓名、身份证号、联系电话），支持授权临时查看 | 申请 PII 查看权限、审批 |

**核心交互流程 (Core Interactions):**

1. CRC 在研究中心的受试者列表中查看本中心所有受试者。列表展示受试者编号（subject_id）、状态标签、姓名缩写（脱敏）、入组日期、当前访视、最近访视日期。支持按状态、入组时间段筛选。
2. CRC 通过"添加潜在受试者"功能录入新的 lead：填写姓名、联系电话、来源渠道（门诊/推荐/广告等）、初步入排评估（是否符合主要入排标准的大致判断）。系统状态为 lead。
3. 对于符合条件的 lead，CRC 启动预筛选流程（lead → prescreened）：安排受试者来院，进行初步沟通，介绍研究概况。若受试者表达兴趣，则进入知情同意环节。
4. 知情同意（prescreened → consented）：CRC 向受试者提供当前生效版本的知情同意书 (ICF)，详细解释研究内容、风险、权益。受试者签署 ICF 后，CRC 在系统中创建 ConsentRecord，关联受试者、ICF 版本、签署日期、签署方式（本人/法定代理人）。系统记录 ICF 签署完成，受试者状态变更为 consented。
5. CRC 进入筛选阶段（consented → screened）：按照研究方案规定的筛选访视项目，依次完成并记录：人口学信息、既往病史、合并用药、体格检查、生命体征、实验室检查（血常规、生化、尿常规等）、影像学检查、ECG 等。系统根据方案预定义的入排标准（从 ProtocolVersion 的 protocol_metadata JSONB 中加载），自动逐条匹配受试者数据，生成合格性评估报告。
6. 系统标记每条入排标准为"满足/不满足/数据不足"。若全部纳入标准满足且全部排除标准不满足，系统建议"合格"，CRC 可确认入组。若有任一不满足，系统标记为"筛选失败"（screen_failure），受试者状态变更为 withdrawn（筛选失败是退出的原因之一）。
7. 入组确认（screened → enrolled）：CRC 点击"确认入组"，系统执行前置校验：（a）ICF 已签署且版本有效；（b）合格性全部满足；（c）受试者未在其他研究中同时入组。校验通过后，系统自动生成 subject_id（规则：{site_code}-{seq}），记录 enrollment_date，受试者状态变更为 enrolled。
8. 随机分组（enrolled 后，根据方案配置）：若研究采用随机化设计，系统根据配置的随机方案自动为受试者分配治疗组。随机结果对非盲角色显示为"已随机"但不显示具体分组（盲态），对非盲药师/统计师显示实际治疗组。系统记录随机号与治疗组分配。
9. 受试者退出处理：当受试者主动要求退出或研究者决定终止时，CRC/CRC+PI 在系统中记录退出/终止原因（从标准字典选择：不良事件、撤回知情同意、失访、死亡、方案违背、研究者决定、其他）。系统记录退出日期，受试者状态变更为 withdrawn 或 lost。若为失访（lost_to_followup），系统记录最后联系日期，并在达到预设失访确认期限后自动确认状态。
10. 受试者正常完成（in_followup → completed）：当受试者完成方案规定的所有访视（包括安全性随访），最后一次访视完成后系统自动/手动将受试者状态变更为 completed。

**关键状态流转 (State Transitions):**

| 当前状态 | 目标状态 | 触发动作 | 触发角色 | 前置条件 | 审计要求 |
|----------|----------|----------|----------|----------|----------|
| lead | prescreened | 通过预筛选评估 | CRC | 初步入排评估通过、受试者表达参与意愿 | 记录预筛选结果 |
| prescreened | consented | ICF 签署完成 | CRC | 受试者（或法定代理人）已签署 ICF、ICF 版本有效 | 记录 ICF 签署日期、版本、签署方式 |
| consented | screened | 开始筛选访视 | CRC | 受试者到院、筛选检查可开展 | 记录筛选开始日期 |
| screened | screen_failure (withdrawn) | 筛选不合格 | CRC + PI 确认 | 不满足入排标准、筛选失败原因已记录 | 记录筛选失败原因（具体入排标准未满足项） |
| screened | enrolled | 确认入组 | CRC + PI 确认 | ICF 有效、所有入选标准满足、所有排除标准不满足、无并发入组冲突 | 记录入组日期、合格性评估报告 |
| enrolled | in_followup | 随机分组完成（若有）/ 首次治疗访视完成 | CRC / 系统自动 | 随机分组已完成（若方案要求）、首次访视已执行 | 记录首次治疗日期 |
| in_followup | completed | 完成所有研究访视 | 系统自动 / CRC | 所有计划访视已完成（含安全性随访）、CRF 数据已录入、Query 已关闭 | 记录完成日期 |
| in_followup | withdrawn | 受试者自愿退出 | CRC + PI 确认 | 退出原因已填写 | 记录退出原因、退出日期 |
| in_followup | lost | 失访 | CRC + PI 确认 | 多次联系失败、失访确认期限已过 | 记录最后一次联系日期 |
| any_active | withdrawn | 研究者决定终止 | PI | 终止原因已填写（AE/SAE/PD/其他）、安全评估已记录 | 记录终止原因、日期 |
| withdrawn | enrolled | 重新入组（特例） | PM + PI 审批 | 审批通过、退出原因可逆（非 AE/SAE 导致） | 记录重新入组原因与审批信息 |

**核心字段 (Core Fields):**

| 字段 | 类型 | 必填 | 敏感级别 | 说明 |
|------|------|------|----------|------|
| subject_id | UUIDv7 | 是 | 内部 | 受试者主键 |
| subject_code | VARCHAR(50) | 是 | 内部 | 受试者编码（如 SITE-001-S001） |
| full_name | VARCHAR(100) | 是 | PII | 姓名（存储加密，前台脱敏） |
| name_initials | VARCHAR(10) | 否 | 内部 | 姓名缩写（脱敏展示用） |
| date_of_birth | DATE | 是 | PII | 出生日期 |
| gender | VARCHAR(10) | 是 | PII | 性别 |
| id_number | VARCHAR(50) | 否 | PII | 身份证号（加密存储） |
| phone_number | VARCHAR(50) | 否 | PII | 联系电话（加密存储） |
| site_id | UUIDv7 | 是 | 内部 | 所属中心 |
| study_id | UUIDv7 | 是 | 内部 | 关联研究 |
| status | VARCHAR(30) | 是 | 内部 | 状态：lead / prescreened / consented / screened / enrolled / in_followup / completed / withdrawn / lost |
| screening_date | DATE | 否 | 内部 | 筛选日期 |
| enrollment_date | DATE | 否 | 内部 | 入组日期 |
| randomization_date | DATE | 否 | 内部 | 随机日期 |
| randomization_number | VARCHAR(50) | 否 | 盲态 | 随机号 |
| treatment_arm | VARCHAR(50) | 否 | 盲态 | 治疗组分配（盲态用户不可见） |
| withdrawal_date | DATE | 否 | 内部 | 退出日期 |
| withdrawal_reason | VARCHAR(100) | 否 | 内部 | 退出原因（字典值） |
| completion_date | DATE | 否 | 内部 | 完成日期 |
| last_contact_date | DATE | 否 | 内部 | 最后一次联系日期 |
| recruitment_source | VARCHAR(50) | 否 | 内部 | 招募来源渠道 |
| screening_number | VARCHAR(50) | 否 | 内部 | 筛选编号 |
| is_blinded | BOOLEAN | 是 | 内部 | 是否盲态研究 |
| subject_metadata | JSONB | 否 | 内部 | 扩展信息 |

**盲态规则 (Blinding Rules):**

- **全盲角色（CRC, CRA, PM, PI, Sponsor）：** treatment_arm 字段不可见，显示为"MASKED"；randomization_number 显示为星号
- **非盲角色（非盲药师 Unblinded Pharmacist、独立统计师）：** 可查看 treatment_arm 和 randomization_number 完整值
- **揭盲 (Unblinding)：** 紧急情况下需申请揭盲，需填写揭盲原因（如 SAE 报告需要）、审批流程（PI + DSMB 审核）、全量审计记录

**异常场景 (Exception Scenarios):**

| 场景 | 处理方式 | 用户提示 |
|------|----------|----------|
| 筛选失败 (Screen Failure) | 系统自动将状态变更为 withdrawn，记录失败原因（具体入排标准编号），可生成筛选失败报告 | "受试者 [code] 因不满足以下入选标准/满足以下排除标准而筛选失败：[list]" |
| ICF 版本过期（新版本方案生效后旧 ICF 版本被取代） | 系统自动检测已入组受试者关联的 ICF 版本是否为 superseded 状态，生成重新知情任务 | "受试者 [code] 的 ICF 版本 [ver] 已被取代，需执行重新知情同意流程" |
| 受试者同意后但在筛选前反悔（撤销 ICF） | CRC 在系统中记录 ICF 撤销（ConsentRecord 状态 → revoked），受试者状态 → withdrawn，销毁已收集的 PII（如适用） | "确认撤销该受试者的知情同意？此操作将标记 ICF 为已撤销并终止该受试者参与" |
| 随机化系统不可用 | 前端禁用随机按钮，展示系统不可用提示，不阻塞入组（可先入组后补随机） | "随机化服务暂不可用，可先完成入组，待恢复后补执行随机分组" |
| 同一受试者在不同研究中重复入组 | 后端基于 PII 哈希值进行跨研究匹配检测，若命中弹出警告 | "警告：该受试者疑似已在研究 [study] (中心 [site]) 中入组，请核实" |
| 紧急揭盲 | 需填写紧急揭盲申请表（原因、请求人、紧急程度），经 PI 或 DSMB 审批后，系统记录全量审计日志，揭示治疗组分配 | "紧急揭盲申请已提交，审批通过后将揭示盲态信息，此操作将产生不可撤销的审计记录" |
| 失访确认 | 系统在预设天数（如 30 天）内多次联系失败后，自动通知 PI/CRC 确认失访状态 | "受试者 [code] 已失联 [N] 天，请确认是否标记为失访 (Lost to Follow-up)" |

**权限要求 (Permission):**

| 角色 | 查看 | 创建 | 编辑 | 删除 | 特殊权限 |
|------|------|------|------|------|----------|
| Admin | 全局（含 PII） | — | — | — | 紧急揭盲审批 |
| PM | 所负责研究受试者（脱敏） | — | — | — | 查看受试者流转仪表盘 |
| CRA | 所负责中心受试者（脱敏） | — | — | — | SDV 时申请临时 PII 查看权限 |
| CRC | 所属中心受试者（含 PII） | 是 | 所属中心受试者数据 | — | 录入筛选/入组/退出数据 |
| PI | 所属中心受试者（含 PII） | — | 确认入组/退出审核 | — | 审批入组确认、退出确认、紧急揭盲申请 |
| Sponsor | 所研究受试者（脱敏） | — | — | — | 仅匿名聚合数据 |
| 非盲药师 | 所研究受试者（含盲态字段） | — | — | — | 查看治疗组分配 |
| 独立统计师 | 所研究受试者（含盲态字段） | — | — | — | 查看治疗组分配 |
| ReadOnlyAuditor | 全局（PII 脱敏） | — | — | — | 可申请临时 PII 查看 |
| Patient/Caregiver | — | — | — | — | 无 Admin Web 访问（通过 Patient Portal） |

**关联数据实体 (Related Entities):** Subject, Screening, Enrollment, ConsentRecord, ConsentVersion, Visit, AE, SAE, ProtocolDeviation, FileObject, AuditLog, Notification

**关联 REST API (Related APIs):**

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api/v1/subjects | 分页查询受试者列表（按 study_id, site_id, status 筛选） |
| POST | /api/v1/subjects | 添加受试者（lead） |
| GET | /api/v1/subjects/{id} | 获取受试者详情（含脱敏处理） |
| PUT | /api/v1/subjects/{id} | 更新受试者基本信息 |
| PATCH | /api/v1/subjects/{id}/status | 更新受试者状态（含状态机校验） |
| POST | /api/v1/subjects/{id}/pre-screen | 执行预筛选（lead→prescreened） |
| POST | /api/v1/subjects/{id}/consent | 记录 ICF 签署（prescreened→consented） |
| POST | /api/v1/subjects/{id}/screen | 开始筛选（consented→screened） |
| GET | /api/v1/subjects/{id}/eligibility | 获取合格性评估结果（入排标准逐条匹配） |
| POST | /api/v1/subjects/{id}/enroll | 确认入组（screened→enrolled） |
| POST | /api/v1/subjects/{id}/randomize | 执行随机分组 |
| GET | /api/v1/subjects/{id}/randomization | 获取随机结果（含盲态控制） |
| POST | /api/v1/subjects/{id}/emergency-unblind | 提交紧急揭盲申请 |
| POST | /api/v1/subjects/{id}/emergency-unblind/{req_id}/approve | 审批紧急揭盲 |
| POST | /api/v1/subjects/{id}/withdraw | 登记退出 |
| POST | /api/v1/subjects/{id}/complete | 标记完成 |
| GET | /api/v1/subjects/{id}/timeline | 获取受试者时间线 |
| GET | /api/v1/subjects/{id}/documents | 获取受试者文档列表 |
| POST | /api/v1/subjects/{id}/documents | 上传受试者文档 |
| GET | /api/v1/subjects/{id}/pii-access-request | 申请临时 PII 查看权限 |
| POST | /api/v1/subjects/duplicate-check | 跨研究重复入组检查 |
| GET | /api/v1/subjects/flow-dashboard | 获取受试者流转仪表盘数据（按研究/中心） |

---

## M06: 访视计划与访视执行 (Visit Planning & Execution)

### M06: 访视计划与访视执行

**模块目标 (Goal):** 支持基于研究方案自动生成受试者访视计划、动态管理访视窗口、提供灵活的电子 CRF 数据录入界面（支持多种数据类型与动态表单）、实时追踪访视状态并联动 Query 管理，确保访视数据的及时性、完整性与合规性。

**子功能清单 (Sub-features):**

| 序号 | 子功能 | 描述 | 关键操作 |
|------|--------|------|----------|
| 1 | 访视模板管理 (Visit Template Management) | 定义研究级别的访视计划模板：访视名称、访视序号、访视窗口（±天数）、访视类型（筛选/基线/治疗/随访/安全性随访/结束） | 创建模板、编辑访视序列、关联表单 |
| 2 | 访视表单设计器 (Visit Form Designer) | 以 JSON Schema 定义每个访视的数据采集表单：字段类型（文本/数字/日期/下拉/单选/多选/表格/文件上传）、验证规则、必填逻辑、显隐逻辑（基于前序字段值） | 拖拽设计表单、预览、版本管理 |
| 3 | 访视计划自动生成 (Visit Schedule Auto-Generation) | 受试者入组后，系统根据 VisitTemplate 自动生成该受试者的全部 Visit 记录，计算每个访视的计划日期与窗口起止日期 | 手动触发生成、查看生成日志 |
| 4 | 访视列表与日历 (Visit List & Calendar) | 按中心/受试者/状态查看访视列表，日历视图展示即将到期的访视 | 筛选、日历视图、批量操作 |
| 5 | 数据录入 (Data Entry) | 为每个访视填写 CRF 表单数据（JSONB），支持部分保存（草稿）、数据校验、文件上传（如心电图、影像报告） | 新建数据记录、保存草稿、提交、修改 |
| 6 | 访视窗口告警 (Visit Window Alert) | 系统自动检测访视是否在窗口期内完成：窗口内、窗口外但可接受、严重偏离。并生成相应的 ProtocolDeviation（如需） | 查看告警、记录窗口偏离原因 |
| 7 | 数据修改审计 (Data Change Audit) | 所有数据修改（提交后的修改）均记录审计日志：修改前值、修改后值、修改人、修改时间、修改原因 | 查看数据修改历史、还原到历史值 |
| 8 | Query 联动 (Query Linkage) | 数据录入后系统自动或手动生成 Query（质疑），关联到具体字段和访视，追踪 Query 解决状态 | 查看 Query、回复 Query、关闭 Query |
| 9 | 源数据核查 (Source Data Verification, SDV) | CRA 对比 CRF 数据与源数据（病历、检查报告原件），标记数据核查状态 | 逐字段核查、标记 SDV 状态、批量 SDV |
| 10 | 访视状态管理 (Visit Status Management) | 管理每个访视的状态流转：planned→due→overdue→completed/missed/cancelled | 手动变更状态、批量取消 |
| 11 | 随访问卷与患者自报结局 (ePRO/Questionnaire) | 支持结构化问卷（如 QLQ-C30、EQ-5D）的电子化录入与评分计算 | 填写问卷、自动计算分数 |
| 12 | 访视报告生成 (Visit Report) | 汇总单个访视的全部数据生成访视摘要报告（用于研究者审核签字） | 预览报告、导出 PDF、PI 电子签名 |

**核心交互流程 (Core Interactions):**

1. PM 或数据管理员在 M03 方案管理阶段定义访视模板（VisitTemplate）：为研究创建访视序列，如 Screening (V1) → Baseline (V2) → Treatment Cycle 1 Day 1 (V3) → Treatment Cycle 1 Day 15 (V4) → … → End of Treatment (Vn) → Safety Follow-up (Vn+1)。每个访视设置窗口（如 V3 计划日期 = 入组日期 + 28 天，窗口 ±3 天）。
2. 为每个访视类型关联数据采集表单（CRF 表单）：通过 JSON Schema 定义表单字段。例如 Screening 访视包含：人口学信息、生命体征、体格检查、ECOG 评分、实验室检查、入排标准确认等板块。
3. 受试者入组后（M05 enrolled 状态），系统自动调用访视计划生成服务：遍历该研究当前生效方案版本关联的 VisitTemplate，为受试者创建所有 Visit 记录。每个 Visit 包含：planned_date（基于 enrollment_date + 方案规定的访视间隔天数）、window_start_date、window_end_date、初始状态为 planned。
4. CRC 在访视列表页查看本中心所有受试者的访视状态。列表按 due_date 排序，到期/逾期的访视红色高亮。日历视图展示本周/本月的访视安排。
5. 当受试者来院进行某次访视时，CRC 点击该访视进入数据录入界面。系统根据表单 Schema 动态渲染数据录入表单。CRC 填写各项数据（文本、数值、日期、下拉选择、多选、量表填写、文件上传等）。表单支持实时字段验证（必填检查、范围检查、逻辑检查）。
6. CRC 可随时"保存草稿"（数据状态 = draft），数据暂存于 JSONB 字段中。全部必填字段填写完成后，CRC 可点击"提交"（数据状态 = submitted）。提交时系统再次执行全部验证规则，验证通过后数据保存并记录审计日志。
7. 系统在提交后自动执行以下检查：（a）访视日期是否在窗口期内；（b）关键字段是否在正常值范围内（如超出正常值范围标记为 clinically_significant）；（c）是否有缺失的关键数据。若发现问题，系统自动生成 Query 记录（状态 = open），关联到具体字段，通知 CRC 处理。
8. CRC 在 Query 列表中查看待处理的 Query，逐条回复（提供解释、更正数据或确认原值）。CRC 回复后 Query 状态变更为 answered，数据管理员审核通过后关闭 (closed) 或打回 (reopened)。
9. CRA 在监查访视时（M07），可进行 SDV 操作：打开受试者的某次访视，逐字段查看 CRF 数据与源文件（扫描件）的对比。对匹配的字段标记 SDV_STATUS = verified，对不匹配的生成 Query 或标记 PD。
10. 访视正常完成后，CRC 将 Visit 状态变更为 completed。若受试者未按时来院（超出窗口期），系统自动将 Visit 状态从 due 变更为 overdue，并发送通知给 CRC 和 CRA。CRC 需确认是否重新安排 (reschedule) 或标记为 missed。

**关键状态流转 (State Transitions):**

| 当前状态 | 目标状态 | 触发动作 | 触发角色 | 前置条件 | 审计要求 |
|----------|----------|----------|----------|----------|----------|
| planned | due | 到达窗口开始日期 | 系统自动 | 当前日期 ≥ window_start_date | 无需审计 |
| due | overdue | 超过窗口结束日期未完成 | 系统自动 | 当前日期 > window_end_date 且 visit 未 completed | 记录 overdue 时间 |
| due | completed | CRC 提交完整访视数据 | CRC | 所有必填字段已验证通过、表单已提交 | 记录 completion_date、提交人 |
| overdue | completed | CRC 补充完成过期的访视 | CRC | 同 due→completed、需填写窗口外原因 | 记录窗口外完成原因 |
| due | missed | 确认无法完成的访视 | CRC + PI 确认 | 填写 missed 原因 | 记录 missed 原因、是否生成 PD |
| overdue | missed | 确认逾期的访视为无法完成 | CRC + PI 确认 | 填写 missed 原因 | 记录 missed 原因、是否生成 PD |
| scheduled | cancelled | 取消已安排的访视（方案修订或研究者决定） | CRC + PI 确认 | 取消原因必填 | 记录取消原因 |
| missed | rescheduled | 重新安排未完成的访视（创建新 Visit 记录） | CRC | Reschedule 原因、新日期 | 记录原 Visit 与新 Visit 的关联 |

**数据录入状态 (CRF Data Status):**

| 当前状态 | 目标状态 | 触发动作 | 说明 |
|----------|----------|----------|------|
| not_started | draft | CRC 开始录入数据 | 首次保存草稿 |
| draft | submitted | CRC 提交数据 | 所有必填字段已填、验证通过 |
| submitted | verified | CRA 完成 SDV | 源数据核查通过 |
| submitted | queried | 系统/CRA 生成 Query | 数据存在问题 |
| queried | answered | CRC 回复 Query | 提供解释或更正 |
| answered | closed | 数据管理员/DM 关闭 Query | 审核通过 |
| answered | reopened | 数据管理员/DM 打回 Query | 回复不充分 |
| submitted | amended | CRC 修改已提交数据 | 提交后发现需要修改 |

**核心字段 (Core Fields):**

**VisitTemplate (访视模板) 字段：**

| 字段 | 类型 | 必填 | 敏感级别 | 说明 |
|------|------|------|----------|------|
| visit_template_id | UUIDv7 | 是 | 内部 | 访视模板主键 |
| protocol_version_id | UUIDv7 | 是 | 内部 | 关联方案版本 |
| visit_name | VARCHAR(100) | 是 | 内部 | 访视名称（如 Screening） |
| visit_label | VARCHAR(50) | 是 | 内部 | 访视标签（如 V1） |
| visit_type | VARCHAR(30) | 是 | 内部 | 类型：SCREENING / BASELINE / TREATMENT / FOLLOWUP / SAFETY_FOLLOWUP / END_OF_TREATMENT / END_OF_STUDY |
| visit_order | INTEGER | 是 | 内部 | 访视序号 |
| days_from_enrollment | INTEGER | 否 | 内部 | 距入组天数（用于计划日期计算） |
| window_before_days | INTEGER | 是 | 内部 | 窗口前移天数（允许提前） |
| window_after_days | INTEGER | 是 | 内部 | 窗口后移天数（允许延迟） |
| is_required | BOOLEAN | 是 | 内部 | 是否为必做访视（不可跳过） |
| form_schema | JSONB | 是 | 内部 | CRF 表单 JSON Schema 定义（字段结构、验证规则、显隐逻辑） |

**Visit (访视实例) 字段：**

| 字段 | 类型 | 必填 | 敏感级别 | 说明 |
|------|------|------|----------|------|
| visit_id | UUIDv7 | 是 | 内部 | 访视实例主键 |
| subject_id | UUIDv7 | 是 | 内部 | 关联受试者 |
| visit_template_id | UUIDv7 | 是 | 内部 | 关联访视模板 |
| planned_date | DATE | 是 | 内部 | 计划日期 |
| window_start_date | DATE | 是 | 内部 | 窗口开始日期 |
| window_end_date | DATE | 是 | 内部 | 窗口结束日期 |
| actual_date | DATE | 否 | 内部 | 实际完成日期 |
| status | VARCHAR(20) | 是 | 内部 | 访视状态：planned / due / overdue / completed / missed / cancelled / rescheduled |
| data_status | VARCHAR(20) | 否 | 内部 | 数据状态：not_started / draft / submitted / verified / queried |
| form_data | JSONB | 否 | 内部 | 访视采集的 CRF 数据（JSONB 动态存储） |
| form_data_version | INTEGER | 否 | 内部 | 数据版本号（每次修改递增） |
| is_window_violation | BOOLEAN | 否 | 内部 | 是否超出窗口完成 |
| window_violation_reason | TEXT | 否 | 内部 | 超出窗口原因 |
| sdv_status | VARCHAR(20) | 否 | 内部 | SDV 状态：NOT_VERIFIED / PARTIALLY_VERIFIED / VERIFIED |
| sdv_date | DATE | 否 | 内部 | SDV 完成日期 |
| sdv_by_user_id | UUIDv7 | 否 | 内部 | SDV 执行人 |
| signed_by_pi | BOOLEAN | 否 | 内部 | PI 是否已电子签名 |
| signed_date | DATE | 否 | 内部 | PI 签名日期 |
| notes | TEXT | 否 | 内部 | 访视备注 |
| visit_metadata | JSONB | 否 | 内部 | 扩展信息 |

**异常场景 (Exception Scenarios):**

| 场景 | 处理方式 | 用户提示 |
|------|----------|----------|
| 访视计划生成失败（模板数据不完整） | 记录错误日志，生成失败事件通知数据管理员，支持手动修复模板后重新生成 | "受试者 [code] 的访视计划生成失败：[reason]，请联系数据管理员检查访视模板配置" |
| 受试者未在窗口期内完成访视 (Out-of-Window Visit) | 记录窗口违规 (window_violation)，要求 CRC 填写原因。若方案定义该情况为 PD，系统自动创建 ProtocolDeviation 记录 | "该访视超出允许的时间窗口 (实际日期: [date], 窗口: [start]~[end])，请填写原因" |
| 受试者跳过一次访视 (Missed Visit) | CRC 确认后标记 missed，系统自动生成 ProtocolDeviation（需评估），并检查是否影响后续访视的计划日期 | "受试者 [code] 的访视 [label] 已标记为未完成，请评估是否需要重新安排后续访视" |
| 数据提交时网络中断导致部分数据丢失 | 前端实时草稿自动保存（每 30 秒 + 表单 onBlur 事件），恢复时可加载最近草稿。提交按钮点击后采用乐观锁 + 版本号防覆盖 | "检测到未保存的草稿数据，是否恢复？" / "数据已被他人修改，请刷新后重试" |
| 表单 JSON Schema 解析失败 | 前端捕获渲染异常，回退到基本表单模式（不做动态渲染），提示用户刷新或联系管理员 | "表单配置加载失败，请联系管理员检查表单 Schema 配置。显示为默认表单模式" |
| Query 解决超时（超过预设天数未回复） | 系统自动升级通知：CRC → PI → CRA → PM，逐级提醒 | "Query #[id] 已超过 [N] 天未回复，请尽快处理" |
| 修改已 SDV 验证的数据 | 修改后自动重置该字段的 SDV 状态为 NOT_VERIFIED，记录变更原因，通知 CRA 重新 SDV | "您正在修改已通过 SDV 的数据字段，保存后将重置 SDV 状态，CRA 需重新核查" |
| PI 签名前发现数据问题需要修改 | CRC 取消提交（需权限），修改后重新提交。若已 PI 签名则需走正式的数据修正流程 | "该访视已完成 PI 签名，修改数据将生成修正记录并要求 PI 重新签名" |

**权限要求 (Permission):**

| 角色 | 查看 | 创建 | 编辑 | 删除 | 特殊权限 |
|------|------|------|------|------|----------|
| Admin | 全局 | — | — | — | 强制关闭 Query、修改表单 Schema |
| PM | 所负责研究访视数据（只读） | — | — | — | 查看访视汇总报告 |
| CRA | 所负责中心访视数据 | — | SDV 标记 | — | SDV 操作、生成 Query |
| CRC | 所属中心受试者访视 | 是（开始数据录入） | 录入/修改数据、回复 Query | — | 日常数据录入与 Query 回复 |
| PI | 所属中心受试者访视 | — | 电子签名确认 | — | PI 签名 |
| 数据管理员(DM) | 全局 | — | 关闭/打回 Query | — | Query 最终审核 |
| Sponsor | 所研究访视数据（只读） | — | — | — | 只读 |
| ReadOnlyAuditor | 全局（只读） | — | — | — | 全字段只读 |

**关联数据实体 (Related Entities):** VisitTemplate, Visit, Observation (form_data 内结构化观察指标), QuestionnaireResponse, DiagnosticReport, Query, ProtocolDeviation, ConsentRecord, Subject, AuditLog, FileObject

**关联 REST API (Related APIs):**

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api/v1/visit-templates | 获取访视模板列表（按 protocol_version_id 筛选） |
| POST | /api/v1/visit-templates | 创建访视模板 |
| GET | /api/v1/visit-templates/{id} | 获取访视模板详情（含 form_schema） |
| PUT | /api/v1/visit-templates/{id} | 更新访视模板 |
| PUT | /api/v1/visit-templates/{id}/form-schema | 更新表单 JSON Schema |
| POST | /api/v1/subjects/{subjectId}/visits/generate | 为受试者自动生成访视计划 |
| GET | /api/v1/visits | 分页查询访视列表（支持多条件筛选） |
| GET | /api/v1/visits/calendar | 获取日历视图访视数据 |
| GET | /api/v1/visits/{id} | 获取访视详情（含 form_data） |
| POST | /api/v1/visits/{id}/data | 保存访视数据（创建或更新 draft） |
| PUT | /api/v1/visits/{id}/data/submit | 提交访视数据（draft→submitted） |
| GET | /api/v1/visits/{id}/data/history | 获取数据修改历史（审计日志） |
| PATCH | /api/v1/visits/{id}/status | 更新访视状态（completed/missed/cancelled） |
| POST | /api/v1/visits/{id}/reschedule | 重新安排访视 |
| POST | /api/v1/visits/{id}/sdv | 执行/批量执行 SDV |
| GET | /api/v1/visits/{id}/sdv-status | 获取 SDV 状态（按字段） |
| POST | /api/v1/visits/{id}/pi-sign | PI 电子签名确认访视数据 |
| GET | /api/v1/visits/{id}/report | 生成访视报告 (PDF) |
| GET | /api/v1/visits/{id}/queries | 获取关联的 Query 列表 |
| POST | /api/v1/visits/{id}/queries | 手动创建 Query |
| GET | /api/v1/queries | 分页查询 Query 列表 |
| GET | /api/v1/queries/{id} | 获取 Query 详情 |
| POST | /api/v1/queries/{id}/respond | 回复 Query |
| PATCH | /api/v1/queries/{id}/status | 更新 Query 状态（close/reopen） |
| GET | /api/v1/visits/window-violations | 获取窗口违规列表 |

---

## M07: 监查管理 (Monitoring Management)

### M07: 监查管理

**模块目标 (Goal):** 支持 CRA 对研究中心进行全面的现场或远程监查管理，包括监查计划制定、监查访视排程（SIV/IMV/COV）、监查报告撰写与审批、源数据核查 (SDV) 追踪、行动项 (Action Item) 管理以及重大发现升级处理，确保研究质量、受试者安全与数据完整性符合 GCP 与监管要求。

**子功能清单 (Sub-features):**

| 序号 | 子功能 | 描述 | 关键操作 |
|------|--------|------|----------|
| 1 | 监查计划管理 (Monitoring Plan) | 按研究定义监查策略：监查频率（如每 6-8 周）、监查类型（SIV/IMV/COV）、监查范围（100% SDV vs 抽样 SDV）、风险导向监查配置 | 创建计划、编辑、关联中心 |
| 2 | 监查访视排程 (Monitoring Visit Scheduling) | 为每个中心安排监查访视日程：SIV（中心启动访视）、IMV（中期监查访视）、COV（关闭访视） | 创建访视、设置日期、分配 CRA |
| 3 | 监查准备清单 (Monitoring Preparation Checklist) | 每次监查访视前的准备任务：审阅上次监查报告、确认未关闭行动项、审查安全数据、确认受试者列表、准备 SDV 计划 | 勾选准备项、上传准备文档 |
| 4 | 监查报告撰写 (Monitoring Report) | CRA 撰写结构化监查报告：访视摘要、受试者入组与退出更新、方案偏离汇总、AE/SAE 审核、数据质量评估、行动项列表 | 新建报告、保存草稿、提交审批 |
| 5 | 源数据核查 (Source Data Verification, SDV) | CRA 按受试者/访视执行 SDV，标记核查状态，记录差异。支持风险导向 SDV（关键数据 100% SDV，非关键数据抽样） | 逐字段 SDV、批量 SDV、SDV 状态报告 |
| 6 | 行动项管理 (Action Item Management) | 追踪监查访视中发现的问题与后续行动：描述、负责人、截止日期、优先级、完成状态 | 创建行动项、分配、标记完成 |
| 7 | 重大发现与升级 (Critical Findings & Escalation) | 对监查中发现的重大问题（严重 GCP 违规、数据造假嫌疑、SAE 未报告等）进行升级处理，通知 PM/管理层 | 创建重大发现、升级、追踪解决 |
| 8 | 监查报告审批 (Report Approval Workflow) | 基于 Flowable 的监查报告审批流程：CRA 提交 → PM 审核 → 医学审核（如有）→ 最终批准/退回修改 | 提交、审批、退回 |
| 9 | 中心合规仪表盘 (Site Compliance Dashboard) | 按中心/研究展示监查合规状态：最近监查日期、下次监查日期、逾期未监查天数、未关闭行动项数、重大发现数 | 查看仪表盘、导出合规报告 |
| 10 | 监查发现统计与分析 (Findings Analytics) | 按发现类别（方案偏离、数据录入错误、知情同意问题、药品管理问题、设备问题等）统计趋势，支持跨中心对比 | 查看趋势图、对比分析、导出 |
| 11 | 远程监查支持 (Remote Monitoring Support) | 支持标记远程监查访视、上传远程审阅文档、记录远程监查发现 | 创建远程监查、上传远程审阅记录 |
| 12 | 监查访视费用追踪 (Monitoring Visit Cost Tracking) | 记录监查访视相关费用（差旅、住宿、其他），关联财务模块 | 录入费用、查看费用汇总 |

**核心交互流程 (Core Interactions):**

1. PM 或 CRA Lead 在 M02 研究启动阶段为研究配置监查计划 (Monitoring Plan)：定义监查策略（常规监查 vs 风险导向监查）、监查类型与频率（如 SIV 在中心激活前、IMV 每 8 周、COV 在中心关闭时）。将监查计划关联到各中心。
2. CRA（或 CRA Lead）为所负责中心安排监查访视。在中心详情页点击"安排监查访视"，选择访视类型（SIV/IMV/COV）、计划日期（工作日历中显示可用时段）、分配 CRA（主 CRA 和协访 CRA）。保存后创建 MonitoringVisit 记录，状态 = planned。
3. 在监查访视前，CRA 完成监查准备清单：审阅上次监查报告、导出未关闭行动项列表、审阅受试者入组进展、审查自上次监查以来的 AE/SAE、确认 SDV 计划（对哪些受试者/访视/数据进行 SDV）。CRA 在系统中逐项勾选完成。
4. CRA 到达中心进行现场监查（或远程开展远程监查）。CRA 在系统中将 MonitoringVisit 状态变更为 in_progress。系统记录 actual_start_date。
5. CRA 执行 SDV：打开受试者 CRF 数据 (M06)，逐字段核对源数据（病历、检查报告原件），标记 SDV 状态。SDV 数据与 M06 访视模块共享，CRA 在同一界面操作。
6. 监查过程中，CRA 记录发现的问题（Findings）：分类（如：知情同意问题、方案偏离、数据录入错误、药品管理问题、设备校准问题等）、严重程度（Minor/Major/Critical）、描述、关联受试者（适用时）、建议措施。对于重大问题（Major/Critical），系统触发升级工作流。
7. CRA 创建行动项 (Action Item)：针对每个发现设定具体的改进行动、分配给中心研究人员（PI/CRC）、设定期限、优先级。系统自动发送通知给被分配人。
8. CRA 完成监查后撰写监查报告：报告包含结构化各部分 - (a) 访视基本信息（中心、日期、CRA）；(b) 受试者状态更新（入组/筛选/完成/退出数量）；(c) SDV 统计（计划核查 vs 实际核查、发现差异数）；(d) 方案偏离汇总；(e) AE/SAE 审核；(f) 药品管理审核；(g) 上次行动项关闭状态；(h) 本次新发现与行动项列表；(i) 总体评价与下次监查计划。CRA 保存草稿后可预览报告 PDF。
9. CRA 提交监查报告审批。系统创建 Flowable 审批流程，PM 审核报告内容。PM 可批准（附意见）、退回修改（附意见和要求）、或对重大问题进行升级。退回后 CRA 修改并重新提交。
10. PM 批准后，报告状态变更为 finalized，系统生成正式 PDF 报告并归档至 FileObject/MinIO。系统自动更新中心的下次监查日期，发送报告完成通知给相关角色（PI、Sponsor）。行动项开始追踪，系统定期检查未关闭行动项并向 CRA/PI 发送提醒。

**关键状态流转 (State Transitions):**

**MonitoringVisit (监查访视) 状态流转：**

| 当前状态 | 目标状态 | 触发动作 | 触发角色 | 前置条件 | 审计要求 |
|----------|----------|----------|----------|----------|----------|
| planned | confirmed | CRA 确认访视安排 | CRA | 日期、地点、参与人员已确定 | 记录确认时间 |
| confirmed | in_progress | CRA 开始监查 | CRA | 准备清单已完成 | 记录 actual_start_date |
| in_progress | completed | CRA 完成现场监查 | CRA | 报告草稿已保存 | 记录 actual_end_date |
| completed | report_submitted | CRA 提交监查报告 | CRA | 报告必填项已填写、行动项已创建 | 记录提交时间 |
| report_submitted | report_approved | PM 审批通过 | PM | 报告内容合规、无重大问题或已妥善处理 | 记录审批人、时间、意见 |
| report_submitted | report_rejected | PM 退回修改 | PM | 退回原因必填 | 记录退回原因、退回时间 |
| report_rejected | report_submitted | CRA 修改后重新提交 | CRA | 已在原报告上修改 | 记录重新提交时间 |
| report_approved | finalized | 系统自动归档 | 系统 | 审批通过 | 记录归档时间、生成最终 PDF |
| planned | cancelled | 取消已安排的监查访视 | CRA/PM | 取消原因必填 | 记录取消原因 |

**Finding (监查发现) 状态流转：**

| 当前状态 | 目标状态 | 触发动作 | 触发角色 | 前置条件 | 审计要求 |
|----------|----------|----------|----------|----------|----------|
| open | triaged | CRA 分类分级 | CRA | 严重程度与分类已标记 | 记录分类信息 |
| triaged | in_progress | 中心开始处理 | CRC/PI | 关联的行动项已接受 | 记录开始处理时间 |
| in_progress | resolved | 中心完成整改 | CRC/PI | 行动项完成、整改证据已上传 | 记录解决时间与证据 |
| resolved | verified | CRA 确认整改有效 | CRA | CRA 在下次监查中确认 | 记录验证日期与方法 |
| open | escalated | 重大问题升级 | CRA/PM | 严重程度 = Critical 或重复发生 | 记录升级原因、升级至对象 |
| escalated | resolved | 升级问题解决 | PM/管理层 | 整改措施已落实、CAPA 已完成（如需要） | 记录解决方式与审批 |

**核心字段 (Core Fields):**

**MonitoringPlan (监查计划) 字段：**

| 字段 | 类型 | 必填 | 敏感级别 | 说明 |
|------|------|------|----------|------|
| monitoring_plan_id | UUIDv7 | 是 | 内部 | 监查计划主键 |
| study_id | UUIDv7 | 是 | 内部 | 关联研究 |
| site_id | UUIDv7 | 是 | 内部 | 关联中心（可为空表示研究级别默认计划） |
| monitoring_type | VARCHAR(20) | 是 | 内部 | 监查策略：ROUTINE / RISK_BASED |
| imv_frequency_days | INTEGER | 是 | 内部 | IMV 频率（天） |
| sdv_strategy | VARCHAR(20) | 是 | 内部 | SDV 策略：100_PERCENT / RISK_BASED / SAMPLING |
| sdv_sampling_rate | DECIMAL(5,2) | 否 | 内部 | 抽样 SDV 比例（如 30.00%） |
| critical_data_fields | JSONB | 否 | 内部 | 需要 100% SDV 的关键数据字段列表 |
| plan_metadata | JSONB | 否 | 内部 | 扩展配置 |

**MonitoringVisit (监查访视) 字段：**

| 字段 | 类型 | 必填 | 敏感级别 | 说明 |
|------|------|------|----------|------|
| monitoring_visit_id | UUIDv7 | 是 | 内部 | 监查访视主键 |
| site_id | UUIDv7 | 是 | 内部 | 关联中心 |
| study_id | UUIDv7 | 是 | 内部 | 关联研究 |
| visit_type | VARCHAR(10) | 是 | 内部 | SIV / IMV / COV |
| planned_date | DATE | 是 | 内部 | 计划日期 |
| actual_start_date | DATE | 否 | 内部 | 实际开始日期 |
| actual_end_date | DATE | 否 | 内部 | 实际结束日期 |
| status | VARCHAR(30) | 是 | 内部 | planned / confirmed / in_progress / completed / report_submitted / report_approved / report_rejected / finalized / cancelled |
| is_remote | BOOLEAN | 是 | 内部 | 是否远程监查 |
| lead_cra_user_id | UUIDv7 | 是 | 内部 | 主 CRA |
| co_cra_user_id | UUIDv7 | 否 | 内部 | 协访 CRA（如有） |
| preparation_checks | JSONB | 否 | 内部 | 准备清单完成状态 |

**MonitoringReport (监查报告) 字段：**

| 字段 | 类型 | 必填 | 敏感级别 | 说明 |
|------|------|------|----------|------|
| monitoring_report_id | UUIDv7 | 是 | 内部 | 报告主键 |
| monitoring_visit_id | UUIDv7 | 是 | 内部 | 关联监查访视 |
| summary | TEXT | 是 | 内部 | 访视摘要 |
| enrollment_update | JSONB | 否 | 内部 | 入组更新（筛选/入组/完成/退出数量） |
| pd_summary | TEXT | 否 | 内部 | 方案偏离汇总 |
| ae_review | TEXT | 否 | 内部 | AE/SAE 审核意见 |
| sdv_summary | JSONB | 否 | 内部 | SDV 统计（计划核查、实际核查、差异数） |
| drug_management_review | TEXT | 否 | 内部 | 研究药品管理审核 |
| document_review | TEXT | 否 | 内部 | 必要文档审核（ISF、TMF） |
| overall_assessment | TEXT | 是 | 内部 | 总体评价 |
| next_visit_plan | DATE | 否 | 内部 | 下次监查计划日期 |
| total_findings | INTEGER | 否 | 内部 | 本次发现总数 |
| critical_findings | INTEGER | 否 | 内部 | 重大发现数 |
| report_metadata | JSONB | 否 | 内部 | 报告元数据 |
| pdf_file_id | UUIDv7 | 否 | 内部 | 归档 PDF 文件 (FileObject) |

**Finding (监查发现) 字段：**

| 字段 | 类型 | 必填 | 敏感级别 | 说明 |
|------|------|------|----------|------|
| finding_id | UUIDv7 | 是 | 内部 | 发现主键 |
| monitoring_visit_id | UUIDv7 | 是 | 内部 | 关联监查访视 |
| category | VARCHAR(50) | 是 | 内部 | 分类（字典：INFORMED_CONSENT / PROTOCOL_DEVIATION / DATA_ENTRY_ERROR / DRUG_MANAGEMENT / EQUIPMENT / DOCUMENT / OTHER） |
| severity | VARCHAR(10) | 是 | 内部 | 严重程度：MINOR / MAJOR / CRITICAL |
| description | TEXT | 是 | 内部 | 详细描述 |
| subject_id | UUIDv7 | 否 | 内部 | 关联受试者（如适用） |
| visit_id | UUIDv7 | 否 | 内部 | 关联访视（如适用） |
| status | VARCHAR(20) | 是 | 内部 | open / triaged / in_progress / resolved / verified / escalated |
| action_items_generated | INTEGER | 否 | 内部 | 生成的行动项数量 |

**ActionItem (行动项) 字段：**

| 字段 | 类型 | 必填 | 敏感级别 | 说明 |
|------|------|------|----------|------|
| action_item_id | UUIDv7 | 是 | 内部 | 行动项主键 |
| finding_id | UUIDv7 | 否 | 内部 | 关联发现 |
| monitoring_visit_id | UUIDv7 | 是 | 内部 | 关联监查访视 |
| description | TEXT | 是 | 内部 | 行动描述 |
| assigned_to_user_id | UUIDv7 | 是 | 内部 | 负责人 |
| due_date | DATE | 是 | 内部 | 截止日期 |
| priority | VARCHAR(10) | 是 | 内部 | 优先级：LOW / MEDIUM / HIGH / URGENT |
| status | VARCHAR(20) | 是 | 内部 | open / in_progress / completed / verified / cancelled |
| completed_date | DATE | 否 | 内部 | 完成日期 |
| verified_date | DATE | 否 | 内部 | CRA 确认日期 |
| evidence_file_ids | JSONB | 否 | 内部 | 整改证据文件 ID 列表 |

**异常场景 (Exception Scenarios):**

| 场景 | 处理方式 | 用户提示 |
|------|----------|----------|
| 监查逾期（超过 IMV 频率天数未执行监查） | 系统自动将中心标记为 overdue_monitoring，通知 CRA 和 PM，在合规仪表盘标红 | "中心 [site] 上次监查日期为 [date]，已超过监查频率 [N] 天，请尽快安排监查访视" |
| 重大发现 (Critical Finding) 触发 | 创建发现时若 severity = CRITICAL，系统自动触发升级工作流：(a) 立即通知 PM；(b) 冻结中心新受试者入组（可配置）；(c) 要求 24h 内制定 CAPA 计划 | "重大发现已创建：[summary]，已自动通知项目经理。根据公司 SOP 可能需要暂停该中心入组" |
| 监查报告中行动项超过 30 天未关闭 | 系统自动发送 escalated 提醒给 CRA、PI、PM，并记录为逾期行动项 | "行动项 #[id] 已逾期 [N] 天，请立即处理或更新截止日期" |
| SDV 发现系统性问题（如某 CRC 数据录入错误率 > 10%） | 系统自动汇总该 CRC 的 SDV 差异统计，通知 CRA 和 PI，建议重新培训 | "CRC [name] 的数据录入错误率为 [X]%，超过阈值，建议安排重新培训" |
| 远程监查时 MinIO 文件访问失败 | 提示文件暂时无法访问，提供重试按钮，不阻塞监查流程 | "远程文档预览失败，请稍后重试。您仍可记录监查发现并稍后补充核查" |
| 监查报告审批流程中审批人离职/转岗 | CRA 可手动转交审批任务至替代审批人（需有审批权限），或 PM 手动重新分配 | "审批人 [name] 不可用，请选择替代审批人" |
| 同一中心短时间内多次取消监查访视 | 系统标记异常，通知 PM 审核该中心的合作意愿 | "中心 [site] 在 [N] 天内已取消 [M] 次监查访视，请关注中心合作情况" |

**权限要求 (Permission):**

| 角色 | 查看 | 创建 | 编辑 | 删除 | 特殊权限 |
|------|------|------|------|------|----------|
| Admin | 全局 | — | — | — | 强制关闭行动项、查看所有报告 |
| PM | 所负责研究的监查数据 | 创建监查计划 | 审批报告、分配 CRA | — | 审批监查报告、处理重大发现升级 |
| CRA | 所负责中心的监查数据 | 创建监查访视、报告、发现、行动项 | 编辑自己的草稿报告与发现、标记 SDV、关闭行动项 | — | 执行 SDV、提交报告 |
| CRA Lead | 所管 CRA 的监查数据 | 同 CRA | 分配 CRA、审核报告 | — | 人员分配、工作量平衡 |
| CRC | 所属中心行动项（分配给自己的） | — | 更新行动项状态、上传证据 | — | 仅查看和回复分配给自己的行动项 |
| PI | 所属中心监查报告与行动项 | — | 更新分配给自己的行动项 | — | 只读查看监查报告、处理分配给自己的行动项 |
| Sponsor | 所研究监查报告（只读） | — | — | — | 只读查看已批准的报告 |
| ReadOnlyAuditor | 全局（只读） | — | — | — | 全字段只读 |

**关联数据实体 (Related Entities):** MonitoringPlan, MonitoringVisit, MonitoringReport, Finding, ActionItem, Site, Study, Visit (for SDV), Subject, User (CRA assignment), FileObject, AuditLog, Notification, CAPA (关联重大发现)

**关联 REST API (Related APIs):**

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | /api/v1/monitoring-plans | 创建监查计划 |
| GET | /api/v1/monitoring-plans | 获取监查计划列表（按 study_id, site_id 筛选） |
| GET | /api/v1/monitoring-plans/{id} | 获取监查计划详情 |
| PUT | /api/v1/monitoring-plans/{id} | 更新监查计划 |
| POST | /api/v1/monitoring-visits | 创建监查访视 |
| GET | /api/v1/monitoring-visits | 分页查询监查访视列表 |
| GET | /api/v1/monitoring-visits/calendar | 获取监查访视日历数据 |
| GET | /api/v1/monitoring-visits/{id} | 获取监查访视详情 |
| PUT | /api/v1/monitoring-visits/{id} | 更新监查访视 |
| PATCH | /api/v1/monitoring-visits/{id}/status | 更新监查访视状态 |
| GET | /api/v1/monitoring-visits/{id}/preparation-checklist | 获取准备清单 |
| PUT | /api/v1/monitoring-visits/{id}/preparation-checklist | 更新准备清单 |
| POST | /api/v1/monitoring-visits/{id}/reports | 创建监查报告（草稿） |
| GET | /api/v1/monitoring-visits/{id}/reports | 获取监查访视的报告列表 |
| GET | /api/v1/monitoring-reports/{id} | 获取报告详情 |
| PUT | /api/v1/monitoring-reports/{id} | 更新报告 |
| POST | /api/v1/monitoring-reports/{id}/submit | 提交报告审批 |
| POST | /api/v1/monitoring-reports/{id}/approve | 审批通过 |
| POST | /api/v1/monitoring-reports/{id}/reject | 退回报告 |
| GET | /api/v1/monitoring-reports/{id}/pdf | 下载/预览报告 PDF |
| GET | /api/v1/monitoring-visits/{id}/findings | 获取监查发现列表 |
| POST | /api/v1/monitoring-visits/{id}/findings | 创建监查发现 |
| PUT | /api/v1/findings/{id} | 更新发现 |
| PATCH | /api/v1/findings/{id}/status | 更新发现状态 |
| POST | /api/v1/findings/{id}/escalate | 升级重大发现 |
| GET | /api/v1/monitoring-visits/{id}/action-items | 获取行动项列表 |
| POST | /api/v1/monitoring-visits/{id}/action-items | 创建行动项 |
| PUT | /api/v1/action-items/{id} | 更新行动项 |
| PATCH | /api/v1/action-items/{id}/status | 更新行动项状态 |
| GET | /api/v1/sites/{id}/monitoring-compliance | 获取中心监查合规仪表盘数据 |
| GET | /api/v1/monitoring/findings-analytics | 获取发现统计分析数据（按研究/中心） |
| GET | /api/v1/monitoring/sdv-summary | 获取 SDV 汇总统计 |
| POST | /api/v1/monitoring-visits/{id}/costs | 记录监查费用 |
| GET | /api/v1/monitoring-visits/{id}/costs | 获取监查费用列表 |
| GET | /api/v1/cras/{id}/workload | 获取 CRA 工作量统计 |

---

## 附录 A: 全局异常处理策略

所有模块共用的异常场景处理：

| 异常类型 | HTTP 状态码 | 处理策略 | 用户体验 |
|----------|-------------|----------|----------|
| 认证失败 (未登录/Token 过期) | 401 | 全局拦截器 → 跳转登录页 | "登录已过期，请重新登录" |
| 授权失败 (无权限) | 403 | 拦截显示权限不足页面或隐藏功能入口 | "您没有权限访问此功能，如需访问请联系管理员" |
| 资源不存在 | 404 | 展示 404 占位页面 | "您访问的资源不存在或已被删除" |
| 数据并发冲突 (乐观锁) | 409 | 提示用户刷新后重试，展示冲突字段 | "数据已被他人修改，请刷新页面后重新编辑" |
| 状态机校验失败 | 422 | 提示当前状态不允许该操作，展示允许的操作 | "当前状态 [status] 不允许执行 [action] 操作" |
| 必填字段缺失 | 422 | 前端表单校验 + 后端 Bean Validation，标红缺失字段 | "请填写所有必填字段：[field_names]" |
| 服务降级 (OpenSearch/Redis/MinIO 不可用) | 503 | 降级到备用方案（PG 直查/本地缓存/仅下载），Banner 提示 | "部分服务暂不可用，功能已降级运行" |
| 服务器内部错误 | 500 | 显示通用错误页面，记录错误日志，提供重试 | "系统繁忙，请稍后重试。如问题持续，请联系技术支持" |

## 附录 B: 通用审计日志格式

所有模块的数据变更均按以下格式记录审计日志 (AuditLog)：

| 字段 | 类型 | 说明 |
|------|------|------|
| audit_id | UUIDv7 | 审计日志主键 |
| entity_type | VARCHAR(50) | 实体类型（如 Study, Site, Subject, Visit 等） |
| entity_id | UUIDv7 | 实体主键 |
| action | VARCHAR(30) | 操作类型：CREATED / UPDATED / DELETED / STATUS_CHANGED / SUBMITTED / APPROVED / REJECTED / EXPORTED / VIEWED_PII |
| changed_by_user_id | UUIDv7 | 操作人 |
| changed_at | TIMESTAMPTZ | 操作时间 (UTC) |
| changes | JSONB | 变更内容（before/after diff） |
| reason | TEXT | 变更原因（如适用） |
| ip_address | VARCHAR(50) | 操作人 IP 地址 |
| user_agent | VARCHAR(500) | 用户浏览器/设备信息 |

---

> **文档结束**
>
> 本文为 PMS 系统 Admin Web 模块 M01-M07 的功能详述文档，覆盖模块目标、子功能、交互流程、状态流转、核心字段、异常场景、权限矩阵与 API 端点设计。
> 数据实体中的具体字段定义（建表 DDL）、Flowable 流程图 BPMN 定义、前端页面原型将在后续文档中补充。
