# 四、权限模型 (Permission Model)

> **文档版本**: Round 2 - RBAC+ABAC Hybrid Permission Model  
> **适用范围**: CTMS/PMS 临床研究项目运营平台  
> **技术栈**: Java 21 + Spring Boot 3 + Spring Security + MyBatis Plus  
> **前端**: Next.js + Ant Design (Admin Web) / Taro (WeChat Mini Program - Patient)  
> **Date**: 2026-05-11

---

## 4.1 模型概述 (Model Overview)

### 4.1.1 设计理念

本系统采用 **RBAC + ABAC 混合权限模型**，将"能做什么"与"能看什么数据"解耦：

| 维度 | 模型 | 职责 | 实现方式 |
|------|------|------|----------|
| **操作权限** (Operation) | RBAC | 控制用户可以执行哪些操作（菜单、按钮、API） | Spring Security `@PreAuthorize` + 权限注解 |
| **数据权限** (Data Scope) | ABAC | 控制用户能看到哪些数据范围（哪些研究、哪些中心、哪些受试者） | MyBatis Plus 拦截器 + 自定义数据权限规则引擎 |
| **字段权限** (Field) | ABAC | 控制用户在可见数据中能看到哪些字段（PII/PHI 脱敏） | 序列化过滤器 + 字段级权限注解 |

### 4.1.2 核心公式

```
用户可见数据 = 操作权限(RBAC) ∩ 数据范围(ABAC) ∩ 字段权限(Field-Level)
```

即：用户能执行某操作 **且** 在授权数据范围内 **且** 对特定字段有可见性时，才能看到对应的完整信息。

### 4.1.3 模型关系图

```
┌─────────────────────────────────────────────────────────────┐
│                        用户 (User)                           │
│  - userId, username, realName, orgId, status                │
└──────────┬────────────────────────────────────┬─────────────┘
           │                                    │
    ┌──────▼──────┐                    ┌────────▼──────────┐
    │  RBAC 层     │                    │  ABAC 层           │
    │  (角色-权限) │                    │  (数据范围规则)     │
    └──────┬──────┘                    └────────┬──────────┘
           │                                    │
    ┌──────▼──────────────┐           ┌─────────▼───────────────┐
    │ User ↔ Role          │           │ DataScopePolicy         │
    │ Role ↔ Permission    │           │  - studyScope            │
    │ Menu ↔ Permission    │           │  - siteScope             │
    │ Button ↔ Permission  │           │  - subjectScope          │
    │ API ↔ Permission     │           │  - documentScope         │
    └──────────────────────┘           │  - sensitivityLevel       │
                                       │  - fieldMasking           │
                                       └──────────────────────────┘
```

### 4.1.4 权限类型说明

| 权限类型 | 标识前缀 | 说明 | 示例 |
|---------|---------|------|------|
| 菜单权限 | `MENU_` | 控制左侧导航菜单可见性 | `MENU_PROJECT_LIST` |
| 按钮/操作权限 | `BTN_` | 控制页面内按钮和操作入口 | `BTN_PROJECT_CREATE` |
| API权限 | `API_` | 控制后端接口访问 | `API_PROJECT_CREATE` |
| 字段权限 | `FLD_` | 控制字段可见性（脱敏/隐藏） | `FLD_SUBJECT_NAME_PII` |
| 数据范围权限 | `SCOPE_` | 控制可访问的数据范围 | `SCOPE_OWN_STUDY_ONLY` |

### 4.1.5 权限继承与叠加

- 用户可以拥有多个角色，权限取**并集**（叠加）
- 数据范围取**并集**（扩大可见范围）
- 字段级限制取**最严格**的那个（安全优先，防止越权看到敏感数据）
- 如果某个角色有 ❌ 而另一个角色有 ✅，最终是 ✅（权限并集）
- 如果某个角色有 👁️* 而另一个角色有 ✅，敏感字段仍然需要按 👁️* 处理（最严格原则对于字段级限制）

---

## 4.2 角色定义 (Role Definitions)

### 4.2.1 角色总览

| 序号 | 角色代码 | 角色名称 | 角色类型 | 分配粒度 | 典型用户 |
|------|---------|---------|---------|---------|---------|
| 1 | `ROLE_ADMIN` | 系统管理员 | 系统级 | 系统全局 | IT管理员、系统运维 |
| 2 | `ROLE_PM` | 项目经理 | 业务级 | 按研究分配 | 临床项目经理、项目主管 |
| 3 | `ROLE_CRA` | 临床监查员 | 业务级 | 按中心分配 | CRA、Senior CRA |
| 4 | `ROLE_CRC` | 临床研究协调员 | 业务级 | 按中心分配 | 中心CRC、研究护士 |
| 5 | `ROLE_PI` | 主要研究者 | 业务级 | 按中心分配 | PI、Sub-I |
| 6 | `ROLE_SPONSOR` | 申办方代表 | 业务级 | 按研究分配 | 申办方医学经理、PM |
| 7 | `ROLE_FINANCE` | 财务专员 | 业务级 | 按研究分配 | 财务经理、项目财务 |
| 8 | `ROLE_PATIENT` | 患者/受试者 | 自服务 | 按自身 | 临床试验受试者 |
| 9 | `ROLE_CAREGIVER` | 看护人/监护人 | 自服务 | 按关联患者 | 患者家属、法定监护人 |
| 10 | `ROLE_AUDITOR` | 只读审计员 | 系统级 | 系统全局 | GCP审计员、稽查员、监管机构 |

### 4.2.2 角色详细定义

---

#### ROLE_ADMIN - 系统管理员

| 属性 | 内容 |
|------|------|
| **角色代码** | `ROLE_ADMIN` |
| **角色名称** | 系统管理员 (System Administrator) |
| **角色类型** | 系统级角色 |
| **分配粒度** | 系统全局（一个用户拥有即为全局生效） |
| **典型用户** | IT系统管理员、DevOps运维人员 |
| **职责范围** | 用户与权限管理、系统配置、字典与模板维护、审计日志管理、系统级操作（上线/维护/恢复） |
| **默认数据范围** | 全部数据（All Studies, All Sites, All Subjects） |
| **数据敏感度** | 可访问所有敏感级别数据，含 PII / PHI |
| **关键限制** | 不应干预临床决策（如SAE评估、受试者入组确认），但拥有技术能力执行所有操作 |
| **典型工作流** | 创建用户/分配角色 / 维护字典 / 配置系统参数 / 查询审计日志 / 处理系统异常 |

---

#### ROLE_PM - 项目经理

| 属性 | 内容 |
|------|------|
| **角色代码** | `ROLE_PM` |
| **角色名称** | 项目经理 (Project Manager) |
| **角色类型** | 业务级角色 |
| **分配粒度** | 按研究分配（Study-level assignment） |
| **典型用户** | 临床项目经理(CPM)、项目主管(Project Lead) |
| **职责范围** | 研究项目的全面管理：方案设计、中心选择与激活、研究者团队组建、预算编制、进度跟踪、项目报告 |
| **默认数据范围** | 仅分配的研究 → 所属全部中心 → 所属全部受试者（Study → All Sites → All Subjects） |
| **数据敏感度** | 可查看脱敏后的受试者列表，不可查看完整 PII；可查看 PHI 用于项目决策 |
| **关键限制** | 不可操作受试者级别的临床决策（入组确认、随机、揭盲）；不可进行SDV确认 |
| **典型工作流** | 创建项目 → 选择/激活中心 → 分配研究者 → 管理预算 → 查看进度报表 → 审批文档 |

---

#### ROLE_CRA - 临床监查员

| 属性 | 内容 |
|------|------|
| **角色代码** | `ROLE_CRA` |
| **角色名称** | 临床监查员 (Clinical Research Associate) |
| **角色类型** | 业务级角色 |
| **分配粒度** | 按中心分配（Site-level assignment） |
| **典型用户** | CRA、Senior CRA、Lead CRA |
| **职责范围** | 中心监查：SDV(源数据核查)、监查访视、监查报告撰写、Query管理、合规检查 |
| **默认数据范围** | 分配的中心 → 中心所属研究 → 中心内受试者（Assigned Sites → Study → Subjects in sites） |
| **数据敏感度** | 可访问受试者完整信息（含PII/PHI），用于SDV核对；受限于分配的中心 |
| **关键限制** | 不可进行受试者入组确认；不可紧急揭盲；不可审批CAPA |
| **典型工作流** | 制定监查计划 → 执行监查访视 → 核对SDV → 撰写监查报告 → 创建/处理Query |

---

#### ROLE_CRC - 临床研究协调员

| 属性 | 内容 |
|------|------|
| **角色代码** | `ROLE_CRC` |
| **角色名称** | 临床研究协调员 (Clinical Research Coordinator) |
| **角色类型** | 业务级角色 |
| **分配粒度** | 按中心分配（Site-level assignment） |
| **典型用户** | 中心CRC、研究护士(Study Nurse) |
| **职责范围** | 中心日常操作：受试者筛选与入组、访视数据录入、生物样本管理、CRF填写、AE/SAE报告 |
| **默认数据范围** | 仅本中心 → 本中心所属研究 → 本中心受试者（Own Site → Study → Own site's subjects） |
| **数据敏感度** | 可访问本中心受试者完整信息（含PII/PHI），需进行日常数据录入和随访 |
| **关键限制** | 不可进行SDV确认（那是CRA的职责）；不可进行中心激活/关闭；不可处理付款 |
| **典型工作流** | 筛选受试者 → 获取知情同意 → 录入受试者信息 → 安排访视 → 录入访视数据 → 报告AE |

---

#### ROLE_PI - 主要研究者

| 属性 | 内容 |
|------|------|
| **角色代码** | `ROLE_PI` |
| **角色名称** | 主要研究者 (Principal Investigator) |
| **角色类型** | 业务级角色 |
| **分配粒度** | 按中心分配（Site-level assignment，通常一个中心一个PI） |
| **典型用户** | PI、Sub-I(Sub-Investigator) |
| **职责范围** | 医学决策：受试者入组确认、随机操作、安全性评估、SAE评估、紧急揭盲、医学判断 |
| **默认数据范围** | 本中心 → 本中心研究 → 本中心受试者（Own Site → Study → Own site's subjects） |
| **数据敏感度** | 完整访问本中心受试者信息（含PII/PHI）- 这是医学判断的基础 |
| **关键限制** | 不可操作本中心以外受试者；不可审批合同；不可操作系统配置 |
| **典型工作流** | 审查筛选结果 → 确认入组 → 执行随机 → 评估AE严重性 → 签署SAE报告 → 签署eCRF |

---

#### ROLE_SPONSOR - 申办方代表

| 属性 | 内容 |
|------|------|
| **角色代码** | `ROLE_SPONSOR` |
| **角色名称** | 申办方代表 (Sponsor Representative) |
| **角色类型** | 业务级角色 |
| **分配粒度** | 按研究/组织分配（Study/Organization-level） |
| **典型用户** | 申办方医学经理(Medical Director)、临床运营总监、申办方PM |
| **职责范围** | 研究监督：进度跟踪、预算审批、安全性监管、申办方文档审批、合同签署 |
| **默认数据范围** | 本组织发起的研究 → 所有中心 → 所有受试者（Sponsored Studies → All Sites → All Subjects，PII脱敏） |
| **数据敏感度** | **PII必须始终脱敏**（受试者姓名、联系方式、身份证号等不可见）；PHI和临床数据可见 |
| **关键限制** | 不可进行临床操作（入组、随机、揭盲）；不可进行SDV；不可回复Query |
| **典型工作流** | 查看研究进度 → 审批预算/合同 → 查看安全性报告(脱敏) → 审批关键文档 → 查看报表 |

---

#### ROLE_FINANCE - 财务专员

| 属性 | 内容 |
|------|------|
| **角色代码** | `ROLE_FINANCE` |
| **角色名称** | 财务专员 (Finance Specialist) |
| **角色类型** | 业务级角色 |
| **分配粒度** | 按研究分配（Study-level assignment） |
| **典型用户** | 项目财务(Project Finance)、财务经理(Finance Manager) |
| **职责范围** | 财务管理：预算制定/编辑、合同审批、付款管理、报销处理、开票操作 |
| **默认数据范围** | 分配的研究的财务相关数据（Study financial data only） |
| **数据敏感度** | 无权限查看PII/PHI（受试者层面），可访问财务金额、合同金额等业务敏感信息 |
| **关键限制** | 不可查看任何受试者数据（包括脱敏）；不可访问临床数据；不可进行任何临床操作 |
| **典型工作流** | 制定预算 → 编辑预算变更 → 审批合同立项 → 创建付款申请 → 审批付款 → 处理报销 → 开具发票 |

---

#### ROLE_PATIENT - 患者/受试者

| 属性 | 内容 |
|------|------|
| **角色代码** | `ROLE_PATIENT` |
| **角色名称** | 患者/受试者 (Patient/Subject) |
| **角色类型** | 自服务角色 |
| **分配粒度** | 自身数据（Self-data only） |
| **典型用户** | 临床试验受试者 |
| **职责范围** | 查看自身信息、填写PRO问卷、查看访视安排、提交知情同意、查看自身AE状态 |
| **默认数据范围** | 仅自身受试者记录（Self-subject record only） |
| **数据敏感度** | 仅能访问自身PII/PHI数据 |
| **关键限制** | 不可查看其他受试者任何信息；不可操作任何非自身数据；仅通过WeChat小程序访问（无Admin Web权限） |
| **典型工作流** | 登录小程序 → 查看访视安排 → 填写电子问卷 → 报告不良事件（自述） → 查看知情同意书 |

---

#### ROLE_CAREGIVER - 看护人/监护人

| 属性 | 内容 |
|------|------|
| **角色代码** | `ROLE_CAREGIVER` |
| **角色名称** | 看护人/监护人 (Caregiver/Guardian) |
| **角色类型** | 自服务角色 |
| **分配粒度** | 按关联患者分配（Linked patient assignment） |
| **典型用户** | 患者家属、法定监护人 |
| **职责范围** | 代表患者：查看访视安排、代填问卷（需标注代填人）、协助提交知情同意、管理提醒 |
| **默认数据范围** | 仅关联的受试者记录（Linked subject records only） |
| **数据敏感度** | 经患者授权后可访问关联受试者的PII/PHI数据 |
| **关键限制** | 仅能访问已授权的关联患者；所有操作需要标注代理人身份；不可进行需要患者本人签署的操作（如首次知情同意） |
| **典型工作流** | 登录小程序 → 选择关联患者 → 查看访视安排 → 代填问卷 → 确认就诊提醒 |

---

#### ROLE_AUDITOR - 只读审计员

| 属性 | 内容 |
|------|------|
| **角色代码** | `ROLE_AUDITOR` |
| **角色名称** | 只读审计员 (Read-Only Auditor) |
| **角色类型** | 系统级角色 |
| **分配粒度** | 系统全局（可配置范围） |
| **典型用户** | GCP审计员(GCP Auditor)、监管机构检查员(Inspector)、质量保证(QA)、伦理委员会(EC/IRB) |
| **职责范围** | 审计/检查：查看所有数据和文档、导出审计报告、查看审计日志、查看TMF完整性 |
| **默认数据范围** | 全部数据（可配置限制到特定研究/中心范围） |
| **数据敏感度** | 可查看完整数据包括PII/PHI（审计需要核验受试者来源数据） |
| **关键限制** | **严格只读** - 不可创建/编辑/删除任何数据；不可进行任何审批操作；所有查看行为必须记录审计日志 |
| **典型工作流** | 登录系统 → 查看TMF文档 → 审查受试者记录 → 导出审计报告 → 查看操作日志 |

---

### 4.2.3 角色-状态流转权限映射

下表定义各角色在关键状态机节点上的操作权限：

#### 研究状态流转 (Study: draft → startup → enrolling → followup → locked → archived)

| 状态流转 | Admin | PM | CRA | CRC | PI | Sponsor | Finance | Auditor |
|----------|-------|----|-----|-----|----|---------|---------|---------|
| draft → startup | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| startup → enrolling | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| enrolling → followup | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| followup → locked | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| locked → archived | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| 任何状态 → locked (紧急) | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| 恢复 locked → 之前状态 | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |

#### 受试者状态流转 (Subject: lead → prescreened → consented → screened → enrolled → in_followup → completed / withdrawn / lost)

| 状态流转 | Admin | PM | CRA | CRC | PI | Sponsor | Auditor |
|----------|-------|----|-----|-----|----|---------|---------|
| lead → prescreened | ✅ | ❌ | 🔒 | 🔒 | ❌ | ❌ | ❌ |
| prescreened → consented | ✅ | ❌ | ❌ | 🔒 | ❌ | ❌ | ❌ |
| consented → screened | ✅ | ❌ | ❌ | 🔒 | 🔒 | ❌ | ❌ |
| screened → enrolled | ✅ | ❌ | ❌ | 🔒 | 🔒 | ❌ | ❌ |
| enrolled → in_followup | ✅ | ❌ | ❌ | 🔒 | 🔒 | ❌ | ❌ |
| in_followup → completed | ✅ | ❌ | ❌ | 🔒 | 🔒 | ❌ | ❌ |
| any → withdrawn | ✅ | ❌ | ❌ | 🔒 | 🔒 | ❌ | ❌ |
| any → lost | ✅ | ❌ | ❌ | 🔒 | 🔒 | ❌ | ❌ |
| 撤销入组 (enrolled → withdrawn) | ✅ | ❌ | ❌ | ❌ | 🔒 | ❌ | ❌ |

> 🔒 = 仅限分配给该用户的中心/受试者数据范围内

---

## 4.3 权限矩阵表 (Permission Matrix)

> **阅读指引**:
> - ✅ = 全部权限 (Full access)
> - 🔒 = 仅限自身数据范围 (Own scope only)
> - 🔒+ = 自身范围 + ABAC过滤 (Own scope with ABAC filtering)
> - 👁️ = 只读 (Read only)
> - 👁️* = 只读，PII脱敏 (Read only, PII masked)
> - ❌ = 无权限 (No access)
> - ⚡ = 条件许可 (Conditional, 见脚注)

### 4.3.1 工作台 (Workspace/Home)

| 功能项 | 权限码 | Admin | PM | CRA | CRC | PI | Sponsor | Finance | Patient | Caregiver | Auditor |
|--------|--------|-------|----|-----|-----|----|---------|---------|---------|-----------|---------|
| 工作台仪表盘 | `MENU_WORKSPACE` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ⚡¹ | ⚡¹ | 👁️ |
| 待办事项 (我的任务) | `BTN_MY_TASKS` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | 👁️ |
| 消息通知 | `BTN_NOTIFICATIONS` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | 👁️ |
| 快捷操作入口 | `BTN_QUICK_ACTIONS` | ✅ | 🔒 | 🔒 | 🔒 | 🔒 | 🔒 | 🔒 | 🔒 | 🔒 | ❌ |

> ⚡¹ = Patient/Caregiver 仅能访问小程序版轻量工作台（"我的研究"），无Admin Web完整仪表盘

### 4.3.2 项目管理 (Project/Study Management)

| 功能项 | 权限码 | Admin | PM | CRA | CRC | PI | Sponsor | Finance | Patient | Caregiver | Auditor |
|--------|--------|-------|----|-----|-----|----|---------|---------|---------|-----------|---------|
| 创建项目 | `BTN_STUDY_CREATE` | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| 编辑项目 | `BTN_STUDY_EDIT` | ✅ | 🔒 | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| 查看项目列表 | `MENU_STUDY_LIST` | ✅ | 🔒 | 🔒 | 🔒 | 🔒 | 🔒 | 🔒 | ❌ | ❌ | 👁️ |
| 查看项目详情 | `BTN_STUDY_DETAIL` | ✅ | 🔒 | 🔒 | 🔒 | 🔒 | 🔒 | 🔒 | ❌ | ❌ | 👁️ |
| 删除/归档项目 | `BTN_STUDY_ARCHIVE` | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| 查看所有项目 | `SCOPE_STUDY_ALL` | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | 👁️ |

### 4.3.3 方案管理 (Protocol Management)

| 功能项 | 权限码 | Admin | PM | CRA | CRC | PI | Sponsor | Finance | Patient | Caregiver | Auditor |
|--------|--------|-------|----|-----|-----|----|---------|---------|---------|-----------|---------|
| 上传方案文档 | `BTN_PROTOCOL_UPLOAD` | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| 查看方案内容 | `BTN_PROTOCOL_VIEW` | ✅ | ✅ | 🔒 | 🔒 | 🔒 | 🔒 | ❌ | 👁️ | 👁️ | 👁️ |
| 方案版本管理 | `BTN_PROTOCOL_VERSION` | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| 方案签批 (eSignature) | `BTN_PROTOCOL_SIGN` | ✅ | ✅ | ❌ | ❌ | 🔒 | ✅ | ❌ | ❌ | ❌ | ❌ |

> 患者/看护人仅可查看已发布的方案摘要或患者版方案概要（ICF相关内容），非完整方案

### 4.3.4 中心管理 (Site/Center Management)

| 功能项 | 权限码 | Admin | PM | CRA | CRC | PI | Sponsor | Finance | Patient | Caregiver | Auditor |
|--------|--------|-------|----|-----|-----|----|---------|---------|---------|-----------|---------|
| 创建中心 | `BTN_SITE_CREATE` | ✅ | 🔒 | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| 编辑中心信息 | `BTN_SITE_EDIT` | ✅ | 🔒 | 🔒 | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| 激活/暂停/关闭中心 | `BTN_SITE_STATUS` | ✅ | 🔒 | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| 分配研究者到中心 | `BTN_SITE_ASSIGN_INV` | ✅ | 🔒 | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| 查看所有中心 | `SCOPE_SITE_ALL` | ✅ | 🔒 | 🔒 | 🔒 | 🔒 | 🔒 | ❌ | ❌ | ❌ | 👁️ |
| 查看中心绩效 | `BTN_SITE_PERFORMANCE` | ✅ | 🔒 | 🔒 | ❌ | 🔒 | 🔒 | ❌ | ❌ | ❌ | 👁️ |
| 中心启动报告 | `BTN_SITE_INIT_REPORT` | ✅ | 🔒 | 🔒 | ❌ | ❌ | 🔒 | ❌ | ❌ | ❌ | 👁️ |

### 4.3.5 研究者管理 (Investigator Management)

| 功能项 | 权限码 | Admin | PM | CRA | CRC | PI | Sponsor | Finance | Patient | Caregiver | Auditor |
|--------|--------|-------|----|-----|-----|----|---------|---------|---------|-----------|---------|
| 添加研究者 | `BTN_INV_ADD` | ✅ | 🔒 | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| 编辑研究者 | `BTN_INV_EDIT` | ✅ | 🔒 | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| 查看研究者详情 | `BTN_INV_DETAIL` | ✅ | 🔒 | 🔒 | 🔒 | 🔒 | 🔒 | ❌ | ❌ | ❌ | 👁️ |
| 研究者资质审核 | `BTN_INV_QUALIFY` | ✅ | 🔒 | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| 研究者培训记录 | `BTN_INV_TRAINING` | ✅ | 🔒 | 🔒 | ❌ | ❌ | 🔒 | ❌ | ❌ | ❌ | 👁️ |

### 4.3.6 受试者管理 (Subject Management)

| 功能项 | 权限码 | Admin | PM | CRA | CRC | PI | Sponsor | Finance | Patient | Caregiver | Auditor |
|--------|--------|-------|----|-----|-----|----|---------|---------|---------|-----------|---------|
| 查看受试者列表(脱敏) | `BTN_SUBJECT_LIST` | ✅ | 🔒 | 🔒 | 🔒 | 🔒 | 👁️* | ❌ | ❌ | ❌ | 👁️ |
| 查看受试者详情(含PII) | `BTN_SUBJECT_DETAIL` | ✅ | ❌ | 🔒 | 🔒 | 🔒 | ❌ | ❌ | 🔒² | 🔒³ | 👁️ |
| 查看受试者识别信息(PII) | `FLD_SUBJECT_PII` | ✅ | ❌ | 🔒 | 🔒 | 🔒 | ❌ | ❌ | 🔒² | 🔒³ | 👁️ |
| 录入筛选信息 (prescreening) | `BTN_SUBJECT_PRESCREEN` | ✅ | ❌ | 🔒 | 🔒 | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| 录入知情同意 (consent) | `BTN_SUBJECT_CONSENT` | ✅ | ❌ | ❌ | 🔒 | 🔒 | ❌ | ❌ | ✅² | ❌ | ❌ |
| 确认入组 (enrollment) | `BTN_SUBJECT_ENROLL` | ✅ | ❌ | ❌ | ❌ | 🔒 | ❌ | ❌ | ❌ | ❌ | ❌ |
| 随机操作 (randomization) | `BTN_SUBJECT_RANDOMIZE` | ✅ | ❌ | ❌ | ❌ | 🔒 | ❌ | ❌ | ❌ | ❌ | ❌ |
| 处理退出 (withdrawal) | `BTN_SUBJECT_WITHDRAW` | ✅ | ❌ | 🔒 | 🔒 | 🔒 | ❌ | ❌ | ❌ | ❌ | ❌ |
| 处理失访 (lost to follow-up) | `BTN_SUBJECT_LOST` | ✅ | ❌ | 🔒 | 🔒 | 🔒 | ❌ | ❌ | ❌ | ❌ | ❌ |
| 查看所有受试者 | `SCOPE_SUBJECT_ALL` | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | 👁️ |

> 👁️* = Sponsor 仅可见PII完全脱敏的受试者列表（姓名→受试者编号，身份证号→不可见，联系方式→不可见）
> 🔒² = Patient 仅可见自身数据
> 🔒³ = Caregiver 仅可查看被授权关联的患者的受试者数据

### 4.3.7 访视管理 (Visit Management)

| 功能项 | 权限码 | Admin | PM | CRA | CRC | PI | Sponsor | Finance | Patient | Caregiver | Auditor |
|--------|--------|-------|----|-----|-----|----|---------|---------|---------|-----------|---------|
| 创建访视计划 | `BTN_VISIT_PLAN_CREATE` | ✅ | 🔒 | ❌ | 🔒 | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| 编辑访视计划 | `BTN_VISIT_PLAN_EDIT` | ✅ | 🔒 | ❌ | 🔒 | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| 查看访视计划 | `BTN_VISIT_PLAN_VIEW` | ✅ | 🔒 | 🔒 | 🔒 | 🔒 | 👁️ | ❌ | 🔒² | 🔒³ | 👁️ |
| 录入访视数据 (eCRF) | `BTN_VISIT_DATA_ENTRY` | ✅ | ❌ | ❌ | 🔒 | 🔒 | ❌ | ❌ | ⚡⁴ | ⚡⁵ | ❌ |
| 确认/冻结访视 (lock) | `BTN_VISIT_LOCK` | ✅ | ❌ | 🔒 | 🔒 | 🔒 | ❌ | ❌ | ❌ | ❌ | ❌ |
| 解冻访视 (unlock) | `BTN_VISIT_UNLOCK` | ✅ | ❌ | 🔒 | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| 查看访视数据完整性 | `BTN_VISIT_COMPLETENESS` | ✅ | 🔒 | 🔒 | 🔒 | 🔒 | 🔒 | ❌ | ❌ | ❌ | 👁️ |
| 查看所有访视 | `SCOPE_VISIT_ALL` | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | 👁️ |
| 安排下次访视日期 | `BTN_VISIT_SCHEDULE` | ✅ | ❌ | ❌ | 🔒 | 🔒 | ❌ | ❌ | ❌ | ❌ | ❌ |

> ⚡⁴ = Patient 可录入PRO问卷（Patient Reported Outcome），但不可录入eCRF数据
> ⚡⁵ = Caregiver 可代填PRO问卷（需标注代填人身份），不可录入eCRF数据

### 4.3.8 监查管理 (Monitoring Management)

| 功能项 | 权限码 | Admin | PM | CRA | CRC | PI | Sponsor | Finance | Patient | Caregiver | Auditor |
|--------|--------|-------|----|-----|-----|----|---------|---------|---------|-----------|---------|
| 创建监查计划 | `BTN_MON_PLAN_CREATE` | ✅ | 🔒 | 🔒 | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| 编辑监查计划 | `BTN_MON_PLAN_EDIT` | ✅ | 🔒 | 🔒 | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| 执行监查访视 | `BTN_MON_VISIT_EXEC` | ✅ | ❌ | 🔒 | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| 撰写监查报告 | `BTN_MON_REPORT_WRITE` | ✅ | ❌ | 🔒 | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| 查看监查报告 | `BTN_MON_REPORT_VIEW` | ✅ | 🔒 | 🔒 | ❌ | 🔒 | 🔒 | ❌ | ❌ | ❌ | 👁️ |
| SDV操作确认 (Source Data Verification) | `BTN_MON_SDV` | ✅ | ❌ | 🔒 | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| 监查发现管理 | `BTN_MON_FINDING` | ✅ | ❌ | 🔒 | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| 中心关闭访视 | `BTN_MON_CLOSE_OUT` | ✅ | 🔒 | 🔒 | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |

### 4.3.9 质量管理 (Quality Management)

| 功能项 | 权限码 | Admin | PM | CRA | CRC | PI | Sponsor | Finance | Patient | Caregiver | Auditor |
|--------|--------|-------|----|-----|-----|----|---------|---------|---------|-----------|---------|
| 创建Query | `BTN_QUERY_CREATE` | ✅ | 🔒 | 🔒 | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| 回复Query | `BTN_QUERY_REPLY` | ✅ | ❌ | 🔒 | 🔒 | 🔒 | ❌ | ❌ | ❌ | ❌ | ❌ |
| 关闭Query | `BTN_QUERY_CLOSE` | ✅ | ❌ | 🔒 | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| 重新打开Query | `BTN_QUERY_REOPEN` | ✅ | ❌ | 🔒 | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| 创建Issue | `BTN_ISSUE_CREATE` | ✅ | 🔒 | 🔒 | 🔒 | 🔒 | ❌ | ❌ | ❌ | ❌ | ❌ |
| 处理Issue | `BTN_ISSUE_RESOLVE` | ✅ | 🔒 | 🔒 | 🔒 | 🔒 | ❌ | ❌ | ❌ | ❌ | ❌ |
| 创建Protocol Deviation | `BTN_PD_CREATE` | ✅ | 🔒 | 🔒 | 🔒 | 🔒 | ❌ | ❌ | ❌ | ❌ | ❌ |
| 评估Protocol Deviation | `BTN_PD_EVALUATE` | ✅ | 🔒 | 🔒 | ❌ | 🔒 | ❌ | ❌ | ❌ | ❌ | ❌ |
| 创建CAPA | `BTN_CAPA_CREATE` | ✅ | 🔒 | 🔒 | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| 审批CAPA | `BTN_CAPA_APPROVE` | ✅ | 🔒 | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| 执行CAPA | `BTN_CAPA_EXECUTE` | ✅ | 🔒 | 🔒 | 🔒 | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| 关闭CAPA | `BTN_CAPA_CLOSE` | ✅ | 🔒 | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| 查看质量报告 | `BTN_QA_REPORT_VIEW` | ✅ | 🔒 | 🔒 | ❌ | 🔒 | 🔒 | ❌ | ❌ | ❌ | 👁️ |

### 4.3.10 安全管理 (Safety Management)

| 功能项 | 权限码 | Admin | PM | CRA | CRC | PI | Sponsor | Finance | Patient | Caregiver | Auditor |
|--------|--------|-------|----|-----|-----|----|---------|---------|---------|-----------|---------|
| 报告AE (不良事件) | `BTN_AE_REPORT` | ✅ | ❌ | 🔒 | 🔒 | 🔒 | ❌ | ❌ | ⚡⁶ | ⚡⁷ | ❌ |
| 查看AE列表(脱敏) | `BTN_AE_LIST` | ✅ | 🔒 | 🔒 | 🔒 | 🔒 | 👁️* | ❌ | 🔒² | 🔒³ | 👁️ |
| 查看AE详情(含PII) | `BTN_AE_DETAIL` | ✅ | ❌ | 🔒 | 🔒 | 🔒 | ❌ | ❌ | 🔒² | 🔒³ | 👁️ |
| 评估AE严重性 | `BTN_AE_SEVERITY` | ✅ | ❌ | ❌ | ❌ | 🔒 | ❌ | ❌ | ❌ | ❌ | ❌ |
| 判断AE与研究药物关系 | `BTN_AE_CAUSALITY` | ✅ | ❌ | ❌ | ❌ | 🔒 | ❌ | ❌ | ❌ | ❌ | ❌ |
| 升级为SAE | `BTN_SAE_ESCALATE` | ✅ | ❌ | 🔒 | 🔒 | 🔒 | ❌ | ❌ | ❌ | ❌ | ❌ |
| SAE上报 | `BTN_SAE_REPORT` | ✅ | ❌ | ❌ | ❌ | 🔒 | 🔒 | ❌ | ❌ | ❌ | ❌ |
| 紧急揭盲 | `BTN_UNBLIND_EMERGENCY` | ✅ | ❌ | ❌ | ❌ | 🔒 | ❌ | ❌ | ❌ | ❌ | ❌ |
| 关闭SAE | `BTN_SAE_CLOSE` | ✅ | ❌ | ❌ | ❌ | 🔒 | ❌ | ❌ | ❌ | ❌ | ❌ |
| 安全性报告汇总 | `BTN_SAFETY_REPORT` | ✅ | 🔒 | ❌ | ❌ | 🔒 | 🔒 | ❌ | ❌ | ❌ | 👁️ |
| 查看所有AE/SAE | `SCOPE_SAFETY_ALL` | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | 👁️ |

> 👁️* = Sponsor 查看AE列表时，受试者身份信息脱敏（仅显示受试者编号）
> ⚡⁶ = Patient 通过小程序自述不良事件（Patient Self-Reported AE），需CRC/PI确认后正式记录
> ⚡⁷ = Caregiver 可代填患者自述AE，标注代填人身份

### 4.3.11 文档管理 (Document Management)

| 功能项 | 权限码 | Admin | PM | CRA | CRC | PI | Sponsor | Finance | Patient | Caregiver | Auditor |
|--------|--------|-------|----|-----|-----|----|---------|---------|---------|-----------|---------|
| 上传文档 | `BTN_DOC_UPLOAD` | ✅ | 🔒 | 🔒 | 🔒 | 🔒 | 🔒 | 🔒 | ⚡⁸ | ⚡⁸ | ❌ |
| 查看文档列表 | `BTN_DOC_LIST` | ✅ | 🔒+ | 🔒+ | 🔒+ | 🔒+ | 🔒+ | 🔒 | 🔒² | 🔒³ | 👁️ |
| 查看文档内容 | `BTN_DOC_VIEW` | ✅ | 🔒+ | 🔒+ | 🔒+ | 🔒+ | 🔒+ | 🔒 | 🔒² | 🔒³ | 👁️ |
| 下载文档 | `BTN_DOC_DOWNLOAD` | ✅ | 🔒+ | 🔒+ | 🔒+ | 🔒+ | 🔒+ | 🔒 | 🔒² | 🔒³ | 👁️ |
| 审批文档 | `BTN_DOC_APPROVE` | ✅ | 🔒 | ❌ | ❌ | 🔒 | 🔒 | ❌ | ❌ | ❌ | ❌ |
| 归档文档 | `BTN_DOC_ARCHIVE` | ✅ | 🔒 | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| 查看TMF (Trial Master File) | `BTN_TMF_VIEW` | ✅ | 🔒 | 🔒+ | 🔒+ | 🔒+ | 🔒+ | ❌ | ❌ | ❌ | 👁️ |
| TMF完整性检查 | `BTN_TMF_COMPLETENESS` | ✅ | 🔒 | 🔒+ | ❌ | ❌ | 🔒 | ❌ | ❌ | ❌ | 👁️ |
| 电子签名 (eSignature) | `BTN_ESIGN` | ✅ | 🔒 | 🔒 | 🔒 | 🔒 | 🔒 | 🔒 | ✅² | ❌ | ❌ |
| 查看知情同意书 (ICF) | `BTN_ICF_VIEW` | ✅ | 🔒+ | 🔒+ | 🔒+ | 🔒+ | ❌ | ❌ | 🔒² | 🔒³ | 👁️ |

> 🔒+ = 需进一步通过 ABAC 文档类型和敏感级别过滤
> ⚡⁸ = Patient/Caregiver 仅可上传患者自述文件（如外院病历、自拍照片），不可上传研究文件

### 4.3.12 财务管理 (Financial Management)

| 功能项 | 权限码 | Admin | PM | CRA | CRC | PI | Sponsor | Finance | Patient | Caregiver | Auditor |
|--------|--------|-------|----|-----|-----|----|---------|---------|---------|-----------|---------|
| 查看预算 | `BTN_BUDGET_VIEW` | ✅ | 🔒 | ❌ | ❌ | 🔒 | 🔒 | 🔒 | ❌ | ❌ | 👁️ |
| 编辑/制定预算 | `BTN_BUDGET_EDIT` | ✅ | 🔒 | ❌ | ❌ | ❌ | ❌ | 🔒 | ❌ | ❌ | ❌ |
| 审批预算 | `BTN_BUDGET_APPROVE` | ✅ | 🔒 | ❌ | ❌ | ❌ | 🔒 | ❌ | ❌ | ❌ | ❌ |
| 查看合同 | `BTN_CONTRACT_VIEW` | ✅ | 🔒 | ❌ | ❌ | 🔒 | 🔒 | 🔒 | ❌ | ❌ | 👁️ |
| 审批合同 | `BTN_CONTRACT_APPROVE` | ✅ | 🔒 | ❌ | ❌ | ❌ | 🔒 | 🔒 | ❌ | ❌ | ❌ |
| 创建付款申请 | `BTN_PAYMENT_CREATE` | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | 🔒 | ❌ | ❌ | ❌ |
| 审批付款 | `BTN_PAYMENT_APPROVE` | ✅ | 🔒 | ❌ | ❌ | ❌ | 🔒 | 🔒 | ❌ | ❌ | ❌ |
| 查看付款记录 | `BTN_PAYMENT_VIEW` | ✅ | 🔒 | ❌ | ❌ | 🔒 | 🔒 | 🔒 | ❌ | ❌ | 👁️ |
| 处理报销 | `BTN_REIMBURSEMENT` | ✅ | ❌ | 🔒 | 🔒 | ❌ | ❌ | 🔒 | ⚡⁹ | ⚡⁹ | ❌ |
| 开票操作 | `BTN_INVOICE` | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | 🔒 | ❌ | ❌ | ❌ |

> ⚡⁹ = Patient/Caregiver 仅可提交个人交通/营养补助报销申请（受试者补助）

### 4.3.13 报表分析 (Reports & Analytics)

| 功能项 | 权限码 | Admin | PM | CRA | CRC | PI | Sponsor | Finance | Patient | Caregiver | Auditor |
|--------|--------|-------|----|-----|-----|----|---------|---------|---------|-----------|---------|
| 查看工作台统计 | `BTN_STATS_WORKSPACE` | ✅ | 🔒 | 🔒 | 🔒 | 🔒 | 🔒 | 🔒 | 🔒² | 🔒³ | 👁️ |
| 查看项目报表 | `BTN_REPORT_PROJECT` | ✅ | 🔒 | 🔒 | 🔒 | 🔒 | 🔒 | 🔒 | ❌ | ❌ | 👁️ |
| 查看数据质量报表 | `BTN_REPORT_QUALITY` | ✅ | 🔒 | 🔒 | 🔒 | 🔒 | 🔒 | ❌ | ❌ | ❌ | 👁️ |
| 查看安全性报表 | `BTN_REPORT_SAFETY` | ✅ | 🔒 | 🔒 | ❌ | 🔒 | 🔒 | ❌ | ❌ | ❌ | 👁️ |
| 查看财务报表 | `BTN_REPORT_FINANCE` | ✅ | 🔒 | ❌ | ❌ | 🔒 | 🔒 | 🔒 | ❌ | ❌ | 👁️ |
| 导出报表 | `BTN_REPORT_EXPORT` | ✅ | 🔒 | ❌ | ❌ | ❌ | 🔒 | 🔒 | ❌ | ❌ | 👁️ |
| 查看风险热力图 | `BTN_RISK_HEATMAP` | ✅ | 🔒 | 🔒 | ❌ | 🔒 | 🔒 | ❌ | ❌ | ❌ | 👁️ |
| 查看风险信号 | `BTN_RISK_SIGNAL` | ✅ | 🔒 | ❌ | ❌ | 🔒 | 🔒 | ❌ | ❌ | ❌ | 👁️ |
| 查看审计日志 | `BTN_AUDIT_LOG` | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | 👁️ |
| 导出审计报告 | `BTN_AUDIT_EXPORT` | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | 👁️ |

### 4.3.14 系统配置 (System Configuration)

| 功能项 | 权限码 | Admin | PM | CRA | CRC | PI | Sponsor | Finance | Patient | Caregiver | Auditor |
|--------|--------|-------|----|-----|-----|----|---------|---------|---------|-----------|---------|
| 用户管理 (CRUD) | `BTN_SYS_USER` | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| 角色管理 | `BTN_SYS_ROLE` | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| 权限配置 | `BTN_SYS_PERMISSION` | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| 字典管理 (数据字典) | `BTN_SYS_DICT` | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| 模板管理 (CRF/报告模板) | `BTN_SYS_TEMPLATE` | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| 系统参数配置 | `BTN_SYS_PARAM` | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| 工作流配置 | `BTN_SYS_WORKFLOW` | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| 通知/消息模板配置 | `BTN_SYS_NOTIFY_TPL` | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| 数据备份/恢复 | `BTN_SYS_BACKUP` | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| 查看配置 (只读) | `BTN_SYS_CONFIG_VIEW` | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | 👁️ |

### 4.3.15 特殊操作权限 (Special Operations)

| 功能项 | 权限码 | Admin | PM | CRA | CRC | PI | Sponsor | Finance | Patient | Caregiver | Auditor |
|--------|--------|-------|----|-----|-----|----|---------|---------|---------|-----------|---------|
| AI辅助结果查看 | `BTN_AI_RESULT_VIEW` | ✅ | 🔒 | 🔒 | 🔒 | 🔒 | 🔒 | ❌ | ❌ | ❌ | 👁️ |
| AI辅助结果确认 | `BTN_AI_RESULT_CONFIRM` | ✅ | ❌ | 🔒 | 🔒 | 🔒 | ❌ | ❌ | ❌ | ❌ | ❌ |
| OCR识别结果查看 | `BTN_OCR_RESULT_VIEW` | ✅ | 🔒 | 🔒 | 🔒 | 🔒 | 🔒 | ❌ | ❌ | ❌ | 👁️ |
| OCR识别结果确认 | `BTN_OCR_RESULT_CONFIRM` | ✅ | ❌ | 🔒 | 🔒 | 🔒 | ❌ | ❌ | ❌ | ❌ | ❌ |
| 数据导出(含PII) | `BTN_EXPORT_WITH_PII` | ✅ | ❌ | 🔒 | 🔒 | 🔒 | ❌ | ❌ | ❌ | ❌ | 👁️ |
| 数据导出(脱敏) | `BTN_EXPORT_MASKED` | ✅ | 🔒 | 🔒 | 🔒 | 🔒 | 🔒 | 🔒 | 🔒² | 🔒³ | 👁️ |
| 批量导入 | `BTN_IMPORT_DATA` | ✅ | 🔒 | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| 批量操作 (如批量SDV) | `BTN_BATCH_OPERATION` | ✅ | ❌ | 🔒 | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| 锁定/解锁研究数据库 | `BTN_DB_LOCK` | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| 数据纠正/追溯修改 | `BTN_DATA_CORRECTION` | ✅ | ❌ | 🔒 | 🔒 | 🔒 | ❌ | ❌ | ❌ | ❌ | ❌ |

### 4.3.16 小程序端权限 (WeChat Mini Program - Patient Side)

| 功能项 | 权限码 | Patient | Caregiver |
|--------|--------|---------|-----------|
| 查看我的研究 | `MINI_MY_STUDY` | ✅ | ✅ |
| 查看知情同意书 | `MINI_ICF_VIEW` | ✅ | ✅ |
| 签署知情同意书 | `MINI_ICF_SIGN` | ✅ | ❌ |
| 查看我的访视安排 | `MINI_VISIT_SCHEDULE` | ✅ | ✅ |
| 填写PRO问卷 | `MINI_PRO_ENTRY` | ✅ | ⚡ |
| 查看我的AE记录 | `MINI_AE_HISTORY` | ✅ | ✅ |
| 自述AE | `MINI_AE_SELF_REPORT` | ✅ | ⚡ |
| 查看我的补助 | `MINI_REIMBURSEMENT` | ✅ | ✅ |
| 申请补助 | `MINI_REIMBURSEMENT_APPLY` | ✅ | ⚡ |
| 上传文件 | `MINI_UPLOAD` | ✅ | ⚡ |
| 我的消息 | `MINI_NOTIFICATIONS` | ✅ | ✅ |
| 个人设置 | `MINI_SETTINGS` | ✅ | ✅ |
| 切换关联患者 (仅Caregiver) | `MINI_SWITCH_PATIENT` | ❌ | ✅ |
| 查看关联患者列表 | `MINI_PATIENT_LIST` | ❌ | ✅ |

> ⚡ = Caregiver 操作标注代填人身份，部分操作需要患者本人授权

---

## 4.4 ABAC 数据范围规则 (ABAC Data Scope Rules)

### 4.4.1 ABAC 规则引擎架构

```
┌─────────────────────────────────────────────────────────┐
│                    ABAC Policy Engine                     │
│                                                           │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌─────────┐ │
│  │ Study    │  │ Site     │  │ Subject  │  │ Document│ │
│  │ Scope    │  │ Scope    │  │ Scope    │  │ Scope   │ │
│  │ Policy   │  │ Policy   │  │ Policy   │  │ Policy  │ │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬────┘ │
│       │              │              │              │       │
│       └──────────────┴──────────────┴──────────────┘      │
│                          │                                 │
│                   ┌──────▼──────┐                          │
│                   │ Data Filter │                          │
│                   │  Builder    │                          │
│                   └──────┬──────┘                          │
│                          │                                 │
│              ┌───────────▼────────────┐                    │
│              │ MyBatis Plus           │                    │
│              │ DataScopeInterceptor   │                    │
│              └────────────────────────┘                    │
└─────────────────────────────────────────────────────────┘
```

### 4.4.2 研究范围策略 (Study Scope Policy)

| 策略名称 | 策略代码 | 适用角色 | 规则定义 |
|---------|---------|---------|---------|
| 全部研究 | `STUDY_SCOPE_ALL` | Admin, Auditor | `1 = 1` (无条件) |
| 分配的研究 | `STUDY_SCOPE_ASSIGNED` | PM, Sponsor, Finance | `study_id IN (SELECT study_id FROM user_study_assignment WHERE user_id = ? AND is_active = 1)` |
| 中心所属研究 | `STUDY_SCOPE_SITE` | CRA, CRC, PI | `study_id IN (SELECT study_id FROM site WHERE site_id IN (SELECT site_id FROM user_site_assignment WHERE user_id = ? AND is_active = 1))` |
| 自身研究 | `STUDY_SCOPE_SELF` | Patient, Caregiver | `study_id IN (SELECT study_id FROM subject WHERE subject_id = ? OR subject_id IN (SELECT subject_id FROM caregiver_subject WHERE user_id = ?))` |

**SQL 拦截器注入逻辑**:

```sql
-- 示例: 查询受试者列表时的数据范围拦截
SELECT * FROM subject WHERE 1=1
-- PM: AND study_id IN (1, 2, 3)                    -- 分配的研究
-- CRA: AND site_id IN (101, 102)                     -- 分配的中心
-- CRC: AND site_id = 101                              -- 本中心
-- Patient: AND subject_id = 'SUBJ-001'               -- 自身
-- Sponsor: AND study_id IN (SELECT study_id FROM sponsor_study WHERE sponsor_org_id = ?) -- 申办的研究
-- Admin/Auditor: (no additional filter)               -- 全部
```

### 4.4.3 中心范围策略 (Site Scope Policy)

| 策略名称 | 策略代码 | 适用角色 | 规则定义 |
|---------|---------|---------|---------|
| 全部中心 | `SITE_SCOPE_ALL` | Admin, Auditor | `1 = 1` (无条件) |
| 分配的中心 | `SITE_SCOPE_ASSIGNED` | CRA | `site_id IN (SELECT site_id FROM user_site_assignment WHERE user_id = ? AND is_active = 1)` |
| 本中心 | `SITE_SCOPE_OWN` | CRC, PI | `site_id = ?` (单一中心ID) |
| 研究下全部中心 | `SITE_SCOPE_STUDY` | PM | `site_id IN (SELECT site_id FROM site WHERE study_id IN (SELECT study_id FROM user_study_assignment WHERE user_id = ?))` |
| 申办方全部中心 | `SITE_SCOPE_SPONSOR` | Sponsor | `site_id IN (SELECT site_id FROM site WHERE study_id IN (SELECT study_id FROM sponsor_study WHERE sponsor_org_id = ?))` |
| 无中心权限 | `SITE_SCOPE_NONE` | Finance | `1 = 0` (Finance 不可访问任何中心/受试者数据) |

### 4.4.4 受试者范围策略 (Subject Scope Policy)

| 策略名称 | 策略代码 | 适用角色 | 规则定义 |
|---------|---------|---------|---------|
| 全部受试者 | `SUBJECT_SCOPE_ALL` | Admin, Auditor | `1 = 1` (无条件) |
| 中心内受试者 | `SUBJECT_SCOPE_SITE` | CRA, CRC, PI | `subject_id IN (SELECT subject_id FROM subject WHERE site_id IN (user's accessible sites))` |
| 研究内受试者 | `SUBJECT_SCOPE_STUDY` | PM | `subject_id IN (SELECT subject_id FROM subject WHERE study_id IN (user's assigned studies))` |
| 申办方受试者(脱敏) | `SUBJECT_SCOPE_SPONSOR` | Sponsor | `subject_id IN (SELECT subject_id FROM subject WHERE study_id IN (sponsored studies))` — **附加字段级脱敏** |
| 自身受试者 | `SUBJECT_SCOPE_SELF` | Patient | `subject_id = ?` (自身受试者ID) |
| 关联受试者 | `SUBJECT_SCOPE_CARED` | Caregiver | `subject_id IN (SELECT subject_id FROM caregiver_subject WHERE user_id = ? AND auth_status = 'ACTIVE')` |
| 无受试者权限 | `SUBJECT_SCOPE_NONE` | Finance | `1 = 0` (Finance 不可访问任何受试者数据) |

### 4.4.5 文档范围策略 (Document Scope Policy)

文档的可见性基于多维度的ABAC规则组合：

| 维度 | 规则类型 | 说明 |
|------|---------|------|
| **研究归属** | `doc.study_id IN user_accessible_studies` | 文档所属研究 |
| **中心归属** | `doc.site_id IS NULL OR doc.site_id IN user_accessible_sites` | NULL表示研究级文档，否则为中心级文档 |
| **文档类型** | `doc.doc_type IN user_accessible_doc_types` | 基于角色的文档类型白名单 |
| **敏感级别** | `doc.sensitivity_level <= user_max_sensitivity` | 用户最大可访问敏感级别 |
| **文档状态** | `doc.status IN ('APPROVED', 'PUBLISHED', 'ARCHIVED')` | 仅已批准的文档可供非管理员查看 |

**角色-文档类型权限映射**:

| 文档类型 | Admin | PM | CRA | CRC | PI | Sponsor | Finance | Auditor |
|---------|-------|----|-----|-----|----|---------|---------|---------|
| 研究方案 (Protocol) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ |
| 知情同意书 (ICF) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ |
| 研究者手册 (IB) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ |
| 监查报告 (Monitoring Report) | ✅ | ✅ | ✅ | ❌ | ❌ | ✅ | ❌ | ✅ |
| 监查跟进函 (Follow-up Letter) | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ✅ |
| SAE报告 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ |
| 合同/协议 (Contract) | ✅ | ✅ | ❌ | ❌ | ✅ | ✅ | ✅ | ✅ |
| 财务凭证 (Financial Record) | ✅ | ✅ | ❌ | ❌ | ✅ | ✅ | ✅ | ✅ |
| 稽查报告 (Audit Report) | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |
| 监管递交文件 (Regulatory) | ✅ | ✅ | ❌ | ❌ | ❌ | ✅ | ❌ | ✅ |
| CRF表格 (Case Report Form) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ |
| 培训记录 (Training Record) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ |
| 患者上传文件 (Patient Upload) | ✅ | ❌ | ✅ | ✅ | ✅ | ❌ | ❌ | ✅ |
| SOP文档 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ |

### 4.4.6 数据敏感级别策略 (Data Sensitivity Level Policy)

| 敏感级别 | 代码 | 包含数据 | 可访问角色 |
|---------|------|---------|-----------|
| **公开** (Public) | `LEVEL_PUBLIC` | 研究名称、状态、中心名称等基本信息 | 所有角色 |
| **内部** (Internal) | `LEVEL_INTERNAL` | 项目进度、统计汇总、非敏感研究文档 | Admin, PM, CRA, CRC, PI, Sponsor, Auditor |
| **机密** (Confidential) | `LEVEL_CONFIDENTIAL` | 合同金额、商业条款、未发布数据 | Admin, PM, Sponsor, Finance |
| **受限** (Restricted) | `LEVEL_RESTRICTED` | 研究药物相关信息、随机码、揭盲数据 | Admin, PI (揭盲权限), 指定人员 |
| **PII** (个人身份信息) | `LEVEL_PII` | 姓名、身份证号、联系方式、家庭住址 | Admin, CRA, CRC, PI, Auditor, Patient(自身), Caregiver(授权) |
| **PHI** (受保护健康信息) | `LEVEL_PHI` | 病史、诊断、检验结果、影像报告 | Admin, CRA, CRC, PI, Auditor, Patient(自身), Caregiver(授权) |

**敏感字段脱敏规则**:

| 字段类别 | 脱敏规则 | 示例原始值 | 脱敏后显示 |
|---------|---------|----------|-----------|
| 姓名 | 姓\*名 | 张三丰 | 张\*丰 |
| 身份证号 | 前3后4，中间\* | 110101199001011234 | 110\*\*\*\*\*\*\*\*\*\*\*\*1234 |
| 手机号 | 前3后4，中间\* | 13812345678 | 138\*\*\*\*5678 |
| 家庭地址 | 仅显示到区/县 | 北京市朝阳区某某路123号 | 北京市朝阳区\*\*\* |
| 邮箱 | 用户名部分脱敏 | zhangsan@hospital.com | z\*\*\*\*n@hospital.com |
| 银行账号 | 后4位可见 | 6222021234567890 | \*\*\*\*\*\*\*\*\*\*\*\*7890 |

**角色-PII/PHI可见性矩阵**:

| 数据类别 | Admin | PM | CRA | CRC | PI | Sponsor | Finance | Patient | Caregiver | Auditor |
|---------|-------|----|-----|-----|----|---------|---------|---------|-----------|---------|
| 受试者PII | ✅ | ❌ | 🔒 | 🔒 | 🔒 | ❌ | ❌ | 🔒(自身) | 🔒(授权) | ✅ |
| 受试者PHI | ✅ | 👁️* | 🔒 | 🔒 | 🔒 | 👁️* | ❌ | 🔒(自身) | 🔒(授权) | ✅ |
| 研究者PII (执业证号等) | ✅ | 👁️ | 👁️ | 👁️ | 👁️ | ❌ | ❌ | ❌ | ❌ | ✅ |
| 财务数据 | ✅ | 🔒 | ❌ | ❌ | 🔒 | 🔒 | 🔒 | ❌ | ❌ | ✅ |
| 随机/揭盲数据 | ✅ | ❌ | ❌ | ❌ | 🔒(揭盲后) | ❌ | ❌ | ❌ | ❌ | ✅ |
| 审计日志 | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |

### 4.4.7 患者授权策略 (Patient Authorization / Consent Scope)

受试者的数据共享严格遵循知情同意书（ICF）中的授权范围：

| 授权类型 | 授权代码 | 关联文档 | 对系统的影响 |
|---------|---------|---------|------------|
| 数据用于研究分析 | `CONSENT_RESEARCH` | 知情同意书主协议 | 是否允许数据进入统计分析和报表 |
| 数据共享给申办方 | `CONSENT_SPONSOR` | 知情同意书主协议 | Sponsor 角色是否可看到该受试者数据（脱敏后） |
| 样本用于生物标志物研究 | `CONSENT_BIOMARKER` | 可选知情同意附录 | 生物样本管理模块的数据可见性 |
| 数据用于未来二次研究 | `CONSENT_FUTURE_RESEARCH` | 可选知情同意附录 | 研究锁定后数据是否可继续被使用 |
| 允许Caregiver代理操作 | `CONSENT_CAREGIVER` | 代理人授权书 | Caregiver 角色是否可访问该受试者数据 |
| 撤回知情同意 | `CONSENT_WITHDRAWN` | 知情同意撤回书 | 停止所有数据共享，数据标记为"已撤回"，后续不再采集新数据 |

**授权状态对数据访问的影响**:

| 授权状态 | 数据处理规则 |
|---------|------------|
| `ACTIVE` - 已授权 | 正常访问，按角色和ABAC规则处理 |
| `PENDING` - 待签署 | 仅CRC/PI可查看受试者基本信息，不共享给其他角色 |
| `WITHDRAWN` - 已撤回 | 已有数据保留但标记为已撤回（状态: withdrawn），冻结新数据采集，所有外部角色（Sponsor等）访问权限立即撤销 |
| `EXPIRED` - 已过期 | 与 WITHDRAWN 处理相同 |
| `RESTRICTED` - 部分授权 | 仅授权范围内的数据类别可见 |

**Caregiver 代理授权验证流程**:

```
1. Caregiver 尝试访问 Patient 数据
   ↓
2. 检查 Caregiver-Patient 关联关系是否存在 (caregiver_subject 表)
   ↓
3. 检查 Patient 的 CONSENT_CAREGIVER 授权状态 = ACTIVE
   ↓
4. 检查 Caregiver 代理关系状态 = ACTIVE (未被撤销)
   ↓
5. 通过 → 授权访问，标注代理人身份
   拒绝 → 返回 403，记录审计日志
```

### 4.4.8 器官/治疗领域范围策略 (Therapeutic Area Scope)

对于大型CRO或多申办方场景，可配置TA级别的数据隔离：

| 策略级别 | 说明 | 实现方式 |
|---------|------|---------|
| 无TA限制 | 默认策略，适用于单TA场景 | `ta_id IS NOT NULL` (不过滤) |
| TA级隔离 | 按TA限制可访问的研究范围 | 研究表关联TA，用户可分配TA访问权限 |
| 跨TA审查 | Admin/Auditor 可跨TA访问 | 授予 `TA_SCOPE_ALL` 权限标记 |

### 4.4.9 数据范围策略优先级

当多个ABAC策略冲突时，采用以下优先级（数字越小优先级越高）：

| 优先级 | 策略类型 | 说明 |
|--------|---------|------|
| 1 | 患者授权 (Consent) | 最高优先级 - 数据共享必须由受试者授权 |
| 2 | 字段级限制 (Field Sensitivity) | 敏感字段脱敏优先于范围扩大 |
| 3 | 数据范围 (Data Scope) | 角色固有的数据可见范围 |
| 4 | 组织策略 (Organization Policy) | 基于申办方/CRO的隔离（最宽松，可被以上覆盖） |

---

## 4.5 权限实现技术方案 (Technical Implementation)

### 4.5.1 Spring Security 整体配置

```java
@Configuration
@EnableWebSecurity
@EnableMethodSecurity(prePostEnabled = true)
public class SecurityConfig {

    @Bean
    public SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
        http
            // JWT stateless session
            .sessionManagement(session -> session
                .sessionCreationPolicy(SessionCreationPolicy.STATELESS))
            // CSRF disabled for REST API
            .csrf(AbstractHttpConfigurer::disable)
            // JWT filter
            .addFilterBefore(jwtAuthenticationFilter(),
                    UsernamePasswordAuthenticationFilter.class)
            // Authorization rules
            .authorizeHttpRequests(auth -> auth
                // Patient/Caregiver Mini Program endpoints
                .requestMatchers("/api/mini/**").hasAnyRole("PATIENT", "CAREGIVER")
                // Admin Web - system config (Admin only)
                .requestMatchers("/api/admin/system/**").hasRole("ADMIN")
                // Admin Web - all authenticated users
                .requestMatchers("/api/admin/**").authenticated()
                // Public endpoints (login, register, health check)
                .requestMatchers("/api/auth/**", "/api/public/**", "/actuator/health")
                    .permitAll()
                .anyRequest().authenticated()
            )
            // Exception handling
            .exceptionHandling(ex -> ex
                .authenticationEntryPoint(jwtAuthEntryPoint())
                .accessDeniedHandler(customAccessDeniedHandler())
            );

        return http.build();
    }

    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder(12);
    }

    // Custom PermissionEvaluator for ABAC
    @Bean
    public PermissionEvaluator permissionEvaluator() {
        return new AbacPermissionEvaluator();
    }
}
```

### 4.5.2 JWT Token 结构

```json
{
  "sub": "user-uuid-xxx",
  "username": "zhangsan",
  "realName": "张三",
  "iat": 1715432000,
  "exp": 1715518400,
  "tokenType": "ACCESS",
  "auth": {
    "roles": [
      "ROLE_CRA",
      "ROLE_CRC"
    ],
    "permissions": [
      "API_STUDY_VIEW",
      "API_SUBJECT_LIST",
      "API_VISIT_DATA_ENTRY",
      "API_AE_REPORT",
      "API_DOC_UPLOAD",
      "API_MON_SDV_EXEC"
    ],
    "dataScopes": {
      "studyScope": "SCOPE_SITE",
      "siteScope": "SCOPE_ASSIGNED",
      "subjectScope": "SCOPE_SITE",
      "documentScope": "SCOPE_SITE",
      "maxSensitivityLevel": "LEVEL_PHI",
      "therapeuticAreas": ["TA_ONCOLOGY", "TA_CARDIOVASCULAR"],
      "organizationId": "ORG-001",
      "assignedStudyIds": [1, 2, 3],
      "assignedSiteIds": [101, 102],
      "patientSubjectId": null,
      "caregiverSubjectIds": []
    }
  }
}
```

**数据范围在JWT中的编码方案**:

| 方案 | 适用场景 | 优点 | 缺点 |
|------|---------|------|------|
| 直嵌JWT | 分配数据量小（<100个ID） | 零数据库查询，高性能 | JWT体积大，变更需重签 |
| Redis缓存 | 分配数据量大 | JWT轻量，变更灵活 | 需要Redis依赖 |
| **混合方案(推荐)** | 生产环境 | JWT存范围标识，Redis存具体ID列表，数据库兜底 | 复杂度较高 |

**推荐混合方案实现**:

```
JWT内: assignedStudyIds = ["@REDIS:user:123:studies"]
  ↓
请求时拦截器: 解析前缀 @REDIS: → 从Redis获取实际ID列表
  ↓
Redis未命中: 从数据库 user_study_assignment 表查询，回写Redis
  ↓
Redis过期: 30分钟TTL，用户分配变更时主动清除
```

### 4.5.3 @PreAuthorize 注解使用

#### 方法级权限控制

```java
@RestController
@RequestMapping("/api/admin/studies")
public class StudyController {

    // ===== RBAC: 角色+权限校验 =====

    // 创建研究 - 需要 PM 角色 + CREATE 权限
    @PostMapping
    @PreAuthorize("hasRole('PM') and hasAuthority('API_STUDY_CREATE')")
    public Result<StudyVO> createStudy(@Valid @RequestBody StudyCreateDTO dto) {
        return Result.success(studyService.createStudy(dto));
    }

    // 查看列表 - 多角色均可访问，数据范围由拦截器处理
    @GetMapping
    @PreAuthorize("hasAnyRole('ADMIN', 'PM', 'CRA', 'CRC', 'PI', 'SPONSOR', 'AUDITOR')")
    public Result<PageResult<StudyVO>> listStudies(StudyQueryDTO query) {
        // 数据范围自动注入 query 中的 filterStudies 和 filterSites
        return Result.success(studyService.listStudies(query));
    }

    // 归档研究 - 仅Admin
    @PostMapping("/{studyId}/archive")
    @PreAuthorize("hasRole('ADMIN')")
    public Result<Void> archiveStudy(@PathVariable Long studyId) {
        studyService.archiveStudy(studyId);
        return Result.success();
    }

    // ===== ABAC: 数据级权限校验 =====

    // 编辑研究 - PM仅能编辑自己管理的
    @PutMapping("/{studyId}")
    @PreAuthorize("hasRole('ADMIN') or (hasRole('PM') and @abacEvaluator.canManageStudy(#studyId))")
    public Result<StudyVO> updateStudy(@PathVariable Long studyId,
                                        @Valid @RequestBody StudyUpdateDTO dto) {
        return Result.success(studyService.updateStudy(studyId, dto));
    }

    // 查看受试者详情 - ABAC校验：有该受试者的数据权限
    @GetMapping("/{studyId}/subjects/{subjectId}")
    @PreAuthorize("@abacEvaluator.canViewSubject(#subjectId)")
    public Result<SubjectVO> viewSubject(@PathVariable Long studyId,
                                          @PathVariable Long subjectId) {
        return Result.success(subjectService.getSubjectById(subjectId));
    }
}
```

#### 自定义 ABAC 权限评估器

```java
@Component("abacEvaluator")
public class AbacPermissionEvaluator implements PermissionEvaluator {

    private final UserDataScopeService dataScopeService;
    private final SubjectService subjectService;
    private final StudyService studyService;
    private final SiteService siteService;
    private final PatientConsentService consentService;

    /**
     * 检查当前用户是否可以管理指定研究
     */
    public boolean canManageStudy(Long studyId) {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null) return false;

        UserDataScope scope = dataScopeService.getCurrentUserDataScope(auth);

        // Admin 可以管理所有研究
        if (scope.hasRole("ROLE_ADMIN")) return true;

        // PM 只能管理分配的研究
        if (scope.hasRole("ROLE_PM")) {
            return scope.getAssignedStudyIds().contains(studyId);
        }

        return false;
    }

    /**
     * 检查当前用户是否可以查看指定受试者
     */
    public boolean canViewSubject(Long subjectId) {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null) return false;

        UserDataScope scope = dataScopeService.getCurrentUserDataScope(auth);

        // Admin/Auditor 可以查看所有
        if (scope.hasAnyRole("ROLE_ADMIN", "ROLE_AUDITOR")) return true;

        // Patient 仅可查看自身
        if (scope.hasRole("ROLE_PATIENT")) {
            return subjectId.equals(scope.getPatientSubjectId());
        }

        // Caregiver 仅可查看授权的受试者
        if (scope.hasRole("ROLE_CAREGIVER")) {
            boolean authorized = scope.getCaregiverSubjectIds().contains(subjectId);
            if (authorized) {
                // 进一步检查患者授权状态
                return consentService.isCaregiverAuthorized(
                    scope.getUserId(), subjectId);
            }
            return false;
        }

        // CRA/CRC/PI 检查受试者是否在自己的中心内
        Subject subject = subjectService.getById(subjectId);
        if (subject == null) return false;

        return scope.getAssignedSiteIds().contains(subject.getSiteId());
    }

    /**
     * 检查当前用户是否可以查看 PII 字段
     */
    public boolean canViewPii(Long subjectId) {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null) return false;

        UserDataScope scope = dataScopeService.getCurrentUserDataScope(auth);

        // 这些角色因监管/医学需要可查看PII
        if (scope.hasAnyRole("ROLE_ADMIN", "ROLE_CRA", "ROLE_CRC",
                "ROLE_PI", "ROLE_AUDITOR")) {
            return canViewSubject(subjectId); // 进一步校验数据范围
        }

        // Sponsor 绝对不可查看PII
        if (scope.hasRole("ROLE_SPONSOR")) return false;

        // Patient 仅可查看自身
        if (scope.hasRole("ROLE_PATIENT")) {
            return subjectId.equals(scope.getPatientSubjectId());
        }

        return false;
    }

    /**
     * 检查当前用户是否可以进行SDV确认
     */
    public boolean canPerformSdv(Long subjectId) {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null) return false;

        UserDataScope scope = dataScopeService.getCurrentUserDataScope(auth);

        // 只有 Admin 和 CRA 可以进行 SDV
        if (!scope.hasAnyRole("ROLE_ADMIN", "ROLE_CRA")) return false;

        // CRA 还需检查受试者是否在分配的中心内
        if (scope.hasRole("ROLE_CRA")) {
            return canViewSubject(subjectId);
        }

        return true;
    }

    /**
     * 检查当前用户是否有紧急揭盲权限
     */
    public boolean canEmergencyUnblind(Long studyId) {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null) return false;

        UserDataScope scope = dataScopeService.getCurrentUserDataScope(auth);

        // 只有 Admin(技术层面) 和 PI(医学层面) 可以紧急揭盲
        if (!scope.hasAnyRole("ROLE_ADMIN", "ROLE_PI")) return false;

        // PI 只能揭盲自己中心的受试者
        if (scope.hasRole("ROLE_PI")) {
            Study study = studyService.getById(studyId);
            return scope.getAssignedSiteIds().contains(study.getPiSiteId());
        }

        // Admin 紧急揭盲需要记录详细原因（系统审计字段）
        return true;
    }
}
```

### 4.5.4 MyBatis Plus 数据范围拦截器

```java
@Component
@Intercepts({
    @Signature(type = StatementHandler.class,
               method = "prepare",
               args = {Connection.class, Integer.class})
})
public class DataScopeInterceptor implements Interceptor {

    @Override
    public Object intercept(Invocation invocation) throws Throwable {
        StatementHandler statementHandler = (StatementHandler)
            PluginUtils.realTarget(invocation.getTarget());
        MetaObject metaObject = SystemMetaObject.forObject(statementHandler);

        // 解析 MappedStatement，检查是否需要数据范围过滤
        MappedStatement mappedStatement = (MappedStatement)
            metaObject.getValue("delegate.mappedStatement");
        String sqlId = mappedStatement.getId();

        // 获取数据范围注解
        DataScope dataScope = getDataScopeAnnotation(sqlId);
        if (dataScope == null) {
            return invocation.proceed();
        }

        // 获取当前用户登录信息
        LoginUser loginUser = SecurityUtils.getLoginUser();
        if (loginUser == null) {
            return invocation.proceed();
        }

        // Admin 不进行数据范围过滤（全部数据）
        if (SecurityUtils.hasRole("ROLE_ADMIN")) {
            return invocation.proceed();
        }

        // 构建数据过滤SQL
        String originalSql = statementHandler.getBoundSql().getSql();
        String dataScopeSql = buildDataScopeSql(dataScope, loginUser);
        String finalSql = applyDataScope(originalSql, dataScopeSql);

        // 注入修改后的SQL
        metaObject.setValue("delegate.boundSql.sql", finalSql);

        return invocation.proceed();
    }

    /**
     * 根据注解类型构建数据范围过滤SQL
     */
    private String buildDataScopeSql(DataScope dataScope, LoginUser loginUser) {
        UserDataScope scope = loginUser.getDataScope();
        StringBuilder sql = new StringBuilder();

        switch (dataScope.type()) {
            case STUDY:
                appendStudyScope(sql, scope);
                break;
            case SITE:
                appendSiteScope(sql, scope);
                break;
            case SUBJECT:
                appendSubjectScope(sql, scope);
                break;
            case DOCUMENT:
                appendDocumentScope(sql, scope);
                break;
            // ... more cases
        }

        return sql.toString();
    }

    private void appendStudyScope(StringBuilder sql, UserDataScope scope) {
        if (scope.hasRole("ROLE_SPONSOR")) {
            sql.append(" AND study_id IN (SELECT study_id FROM sponsor_study ")
               .append("WHERE sponsor_org_id = ")
               .append(scope.getOrganizationId()).append(")");
        } else if (scope.hasRole("ROLE_PM") || scope.hasRole("ROLE_FINANCE")) {
            sql.append(" AND study_id IN (")
               .append(scope.getAssignedStudyIds().stream()
                   .map(String::valueOf).collect(Collectors.joining(",")))
               .append(")");
        } else if (scope.hasAnyRole("ROLE_CRA", "ROLE_CRC", "ROLE_PI")) {
            sql.append(" AND study_id IN (SELECT study_id FROM site WHERE site_id IN (")
               .append(scope.getAssignedSiteIds().stream()
                   .map(String::valueOf).collect(Collectors.joining(",")))
               .append("))");
        } else if (scope.hasRole("ROLE_PATIENT") || scope.hasRole("ROLE_CAREGIVER")) {
            // Patient 能看到所属的 study
            sql.append(" AND study_id = (SELECT study_id FROM subject WHERE subject_id = ")
               .append(getSubjectIdForCurrentUser(scope)).append(")");
        }
        // Admin/Auditor: 不添加任何过滤条件
    }
}
```

**数据范围注解定义**:

```java
@Target({ElementType.METHOD})
@Retention(RetentionPolicy.RUNTIME)
@Inherited
public @interface DataScope {

    /**
     * 数据范围类型
     */
    ScopeType type();

    /**
     * 表别名 (用于多表关联查询)
     */
    String tableAlias() default "";

    /**
     * 数据范围字段名
     */
    String fieldName() default "";

    enum ScopeType {
        STUDY,          // 研究范围过滤
        SITE,           // 中心范围过滤
        SUBJECT,        // 受试者范围过滤
        DOCUMENT,       // 文档范围过滤
        FINANCE,        // 财务数据过滤
        CUSTOM          // 自定义规则
    }
}
```

**Mapper 中使用示例**:

```java
@Mapper
public interface SubjectMapper extends BaseMapper<Subject> {

    /**
     * 查询受试者列表 - 自动按受试者范围过滤
     */
    @DataScope(type = DataScope.ScopeType.SUBJECT,
               tableAlias = "s",
               fieldName = "site_id")
    IPage<SubjectVO> selectSubjectPage(Page<Subject> page,
                                        @Param("query") SubjectQueryDTO query);

    /**
     * 查询访视数据 - 自动按中心范围过滤
     */
    @DataScope(type = DataScope.ScopeType.SITE,
               tableAlias = "v",
               fieldName = "site_id")
    List<VisitVO> selectVisitList(@Param("subjectId") Long subjectId);
}
```

### 4.5.5 字段级脱敏实现

```java
/**
 * 字段脱敏注解
 */
@Target({ElementType.FIELD})
@Retention(RetentionPolicy.RUNTIME)
public @interface SensitiveField {

    /**
     * 敏感数据类型
     */
    SensitivityType type();

    /**
     * 脱敏处理器类
     */
    Class<? extends MaskingHandler> handler();

    enum SensitivityType {
        PII_NAME,           // 姓名
        PII_PHONE,          // 手机号
        PII_EMAIL,          // 邮箱
        PII_ID_CARD,        // 身份证号
        PII_ADDRESS,        // 地址
        PII_BANK_ACCOUNT,   // 银行账号
        PHI_DIAGNOSIS,      // 诊断信息
        PHI_LAB_RESULT,     // 检验结果
        RESTRICTED_BLIND    // 随机/揭盲数据
    }
}
```

**序列化时脱敏实现**:

```java
@JsonComponent
public class SensitiveFieldJsonSerializer extends JsonSerializer<Object>
        implements ContextualSerializer {

    @Override
    public void serialize(Object value, JsonGenerator gen,
                           SerializerProvider provider) throws IOException {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null) {
            // 未认证状态：全脱敏
            gen.writeString(maskCompletely(value));
            return;
        }

        SensitiveField annotation = getSensitiveAnnotation();
        UserDataScope scope = SecurityUtils.getCurrentUserDataScope();

        if (shouldMask(annotation.type(), scope)) {
            gen.writeString(maskValue(value, annotation.type()));
        } else {
            gen.writeObject(value);
        }
    }

    private boolean shouldMask(SensitivityType type, UserDataScope scope) {
        // Sponsor: 所有PII字段脱敏
        if (scope.hasRole("ROLE_SPONSOR")) {
            return type.name().startsWith("PII_");
        }

        // Finance: 所有受试者字段脱敏/隐藏
        if (scope.hasRole("ROLE_FINANCE")
                && (type.name().startsWith("PII_") || type.name().startsWith("PHI_"))) {
            return true;
        }

        // PM: PII 脱敏，PHI 不脱敏
        if (scope.hasRole("ROLE_PM")) {
            return type.name().startsWith("PII_");
        }

        // Patient/Caregiver: 自身数据不脱敏
        if (scope.hasAnyRole("ROLE_PATIENT", "ROLE_CAREGIVER")) {
            return false; // 自己的数据当然不被脱敏
        }

        return false;
    }
}
```

**VO 字段标注示例**:

```java
@Data
public class SubjectVO {

    private Long subjectId;

    // 受试者编号 - 不脱敏（非敏感）
    private String subjectNo;

    // 姓名 - PII
    @SensitiveField(type = SensitivityType.PII_NAME,
                    handler = NameMaskingHandler.class)
    private String realName;

    // 身份证号 - PII
    @SensitiveField(type = SensitivityType.PII_ID_CARD,
                    handler = IdCardMaskingHandler.class)
    private String idCardNo;

    // 手机号 - PII
    @SensitiveField(type = SensitivityType.PII_PHONE,
                    handler = PhoneMaskingHandler.class)
    private String phone;

    // 诊断 - PHI
    @SensitiveField(type = SensitivityType.PHI_DIAGNOSIS,
                    handler = DiagnosisMaskingHandler.class)
    private String diagnosis;

    // 入组日期 - 非敏感
    private LocalDate enrollmentDate;
}
```

### 4.5.6 前端权限控制组件

#### 权限码定义

```typescript
// types/permission.ts

/** 权限码枚举 - 与后端保持一致 */
export enum PermissionCode {
  // ===== 研究管理 =====
  STUDY_CREATE = 'BTN_STUDY_CREATE',
  STUDY_EDIT = 'BTN_STUDY_EDIT',
  STUDY_DETAIL = 'BTN_STUDY_DETAIL',
  STUDY_ARCHIVE = 'BTN_STUDY_ARCHIVE',

  // ===== 受试者管理 =====
  SUBJECT_LIST = 'BTN_SUBJECT_LIST',
  SUBJECT_DETAIL = 'BTN_SUBJECT_DETAIL',
  SUBJECT_ENROLL = 'BTN_SUBJECT_ENROLL',
  SUBJECT_RANDOMIZE = 'BTN_SUBJECT_RANDOMIZE',
  SUBJECT_WITHDRAW = 'BTN_SUBJECT_WITHDRAW',

  // ===== AE/SAE =====
  AE_REPORT = 'BTN_AE_REPORT',
  AE_SEVERITY = 'BTN_AE_SEVERITY',
  SAE_ESCALATE = 'BTN_SAE_ESCALATE',
  UNBLIND_EMERGENCY = 'BTN_UNBLIND_EMERGENCY',

  // ===== 财务管理 =====
  BUDGET_VIEW = 'BTN_BUDGET_VIEW',
  BUDGET_EDIT = 'BTN_BUDGET_EDIT',
  PAYMENT_CREATE = 'BTN_PAYMENT_CREATE',
  INVOICE = 'BTN_INVOICE',

  // ===== 系统 =====
  SYS_USER = 'BTN_SYS_USER',
  SYS_ROLE = 'BTN_SYS_ROLE',
  SYS_DICT = 'BTN_SYS_DICT',
  AUDIT_LOG = 'BTN_AUDIT_LOG',
  // ... 更多
}
```

#### 权限控制 Hook

```typescript
// hooks/usePermission.ts
import { useAppSelector } from '@/store';
import { PermissionCode } from '@/types/permission';

/**
 * 权限控制 Hook
 * 用于组件内判断当前用户是否拥有特定权限
 */
export function usePermission() {
  const userPermissions = useAppSelector((state) => state.user.permissions);
  const userRoles = useAppSelector((state) => state.user.roles);

  /**
   * 检查是否有指定权限码
   */
  const hasPermission = (code: PermissionCode | string): boolean => {
    // Admin 拥有所有权限
    if (userRoles.includes('ROLE_ADMIN')) return true;
    return userPermissions.includes(code);
  };

  /**
   * 检查是否有任一权限码（OR关系）
   */
  const hasAnyPermission = (...codes: PermissionCode[]): boolean => {
    if (userRoles.includes('ROLE_ADMIN')) return true;
    return codes.some((code) => userPermissions.includes(code));
  };

  /**
   * 检查是否有全部权限码（AND关系）
   */
  const hasAllPermissions = (...codes: PermissionCode[]): boolean => {
    if (userRoles.includes('ROLE_ADMIN')) return true;
    return codes.every((code) => userPermissions.includes(code));
  };

  /**
   * 检查是否有指定角色
   */
  const hasRole = (role: string): boolean => {
    return userRoles.includes(role);
  };

  return {
    hasPermission,
    hasAnyPermission,
    hasAllPermissions,
    hasRole,
  };
}
```

#### 权限控制组件

```tsx
// components/Access/index.tsx
import React from 'react';
import { usePermission } from '@/hooks/usePermission';
import { PermissionCode } from '@/types/permission';

interface AccessProps {
  /** 需要的权限码 */
  permission?: PermissionCode;
  /** 需要的权限码列表 (OR关系) */
  anyPermission?: PermissionCode[];
  /** 需要的权限码列表 (AND关系) */
  allPermissions?: PermissionCode[];
  /** 无权限时的降级展示 */
  fallback?: React.ReactNode;
  /** 子组件 */
  children: React.ReactNode;
}

/**
 * 权限控制容器组件
 * 根据用户权限决定是否渲染子组件
 *
 * 使用示例：
 *   <Access permission={PermissionCode.STUDY_CREATE}>
 *     <Button>创建研究</Button>
 *   </Access>
 *
 *   <Access anyPermission={[PermissionCode.SUBJECT_ENROLL, PermissionCode.SUBJECT_RANDOMIZE]}
 *           fallback={<span>无操作权限</span>}>
 *     <Button>受试者操作</Button>
 *   </Access>
 */
export const Access: React.FC<AccessProps> = ({
  permission,
  anyPermission,
  allPermissions,
  fallback = null,
  children,
}) => {
  const { hasPermission, hasAnyPermission, hasAllPermissions } = usePermission();

  let allowed = true;

  if (permission) {
    allowed = hasPermission(permission);
  } else if (anyPermission) {
    allowed = hasAnyPermission(...anyPermission);
  } else if (allPermissions) {
    allowed = hasAllPermissions(...allPermissions);
  }

  if (!allowed) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
};
```

#### 路由权限守卫

```tsx
// components/Access/RouteGuard.tsx
import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { usePermission } from '@/hooks/usePermission';
import { PermissionCode } from '@/types/permission';

interface RouteGuardProps {
  /** 路由需要的权限码 */
  permission?: PermissionCode;
  /** 路由需要的角色 */
  roles?: string[];
  /** 子组件 */
  children: React.ReactNode;
}

/**
 * 路由权限守卫
 * 在路由层面拦截无权限的页面访问
 */
export const RouteGuard: React.FC<RouteGuardProps> = ({
  permission,
  roles,
  children,
}) => {
  const { hasPermission, hasRole } = usePermission();
  const location = useLocation();

  if (permission && !hasPermission(permission)) {
    return <Navigate to="/403" state={{ from: location }} replace />;
  }

  if (roles && !roles.some((role) => hasRole(role))) {
    return <Navigate to="/403" state={{ from: location }} replace />;
  }

  return <>{children}</>;
};
```

#### 菜单权限过滤

```tsx
// utils/menuFilter.ts
import { MenuItem } from '@/types/menu';
import { PermissionCode } from '@/types/permission';

/**
 * 根据用户权限过滤菜单树
 * 递归过滤 - 如果父菜单所有子菜单都不可见，父菜单也隐藏
 */
export function filterMenuByPermission(
  menus: MenuItem[],
  userPermissions: string[],
  userRoles: string[],
): MenuItem[] {
  const isAdmin = userRoles.includes('ROLE_ADMIN');

  return menus
    .filter((menu) => {
      // Admin 可见所有菜单
      if (isAdmin) return true;
      // 没有权限码的菜单默认可见
      if (!menu.permission) return true;
      return userPermissions.includes(menu.permission);
    })
    .map((menu) => {
      if (menu.children && menu.children.length > 0) {
        const filteredChildren = filterMenuByPermission(
          menu.children,
          userPermissions,
          userRoles,
        );
        // 如果子菜单全被过滤且父菜单无独立页面，则隐藏父菜单
        if (filteredChildren.length === 0 && !menu.path) {
          return null;
        }
        return { ...menu, children: filteredChildren };
      }
      return menu;
    })
    .filter(Boolean) as MenuItem[];
}
```

### 4.5.7 API 权限码注册表

```java
/**
 * 权限码注册表常量
 * 集中管理所有权限码，避免魔法字符串
 *
 * 权限码命名规范：
 *   API_{资源}_{操作}         - 接口级权限
 *   BTN_{资源}_{操作}         - 按钮/操作级权限
 *   MENU_{资源}              - 菜单级权限
 *   FLD_{资源}_{敏感级别}    - 字段级权限
 *   SCOPE_{资源}_{范围}      - 数据范围权限
 */
public final class Permissions {

    private Permissions() {}

    // ==================== 研究管理 ====================
    public static final String STUDY_CREATE         = "API_STUDY_CREATE";
    public static final String STUDY_EDIT           = "API_STUDY_EDIT";
    public static final String STUDY_VIEW           = "API_STUDY_VIEW";
    public static final String STUDY_LIST           = "API_STUDY_LIST";
    public static final String STUDY_ARCHIVE        = "API_STUDY_ARCHIVE";
    public static final String STUDY_EXPORT         = "API_STUDY_EXPORT";

    // ==================== 中心管理 ====================
    public static final String SITE_CREATE          = "API_SITE_CREATE";
    public static final String SITE_EDIT            = "API_SITE_EDIT";
    public static final String SITE_STATUS          = "API_SITE_STATUS";
    public static final String SITE_VIEW            = "API_SITE_VIEW";
    public static final String SITE_ASSIGN_INV      = "API_SITE_ASSIGN_INV";

    // ==================== 受试者管理 ====================
    public static final String SUBJECT_LIST         = "API_SUBJECT_LIST";
    public static final String SUBJECT_DETAIL       = "API_SUBJECT_DETAIL";
    public static final String SUBJECT_PII          = "API_SUBJECT_PII";
    public static final String SUBJECT_CREATE       = "API_SUBJECT_CREATE";
    public static final String SUBJECT_ENROLL       = "API_SUBJECT_ENROLL";
    public static final String SUBJECT_RANDOMIZE    = "API_SUBJECT_RANDOMIZE";
    public static final String SUBJECT_WITHDRAW     = "API_SUBJECT_WITHDRAW";
    public static final String SUBJECT_LOST         = "API_SUBJECT_LOST";

    // ==================== 访视管理 ====================
    public static final String VISIT_PLAN_CREATE    = "API_VISIT_PLAN_CREATE";
    public static final String VISIT_PLAN_EDIT      = "API_VISIT_PLAN_EDIT";
    public static final String VISIT_PLAN_VIEW      = "API_VISIT_PLAN_VIEW";
    public static final String VISIT_DATA_ENTRY     = "API_VISIT_DATA_ENTRY";
    public static final String VISIT_LOCK           = "API_VISIT_LOCK";
    public static final String VISIT_UNLOCK         = "API_VISIT_UNLOCK";

    // ==================== 监查管理 ====================
    public static final String MON_PLAN_CREATE      = "API_MON_PLAN_CREATE";
    public static final String MON_VISIT_EXEC       = "API_MON_VISIT_EXEC";
    public static final String MON_REPORT_WRITE     = "API_MON_REPORT_WRITE";
    public static final String MON_REPORT_VIEW      = "API_MON_REPORT_VIEW";
    public static final String MON_SDV              = "API_MON_SDV";

    // ==================== 质量管理 ====================
    public static final String QUERY_CREATE         = "API_QUERY_CREATE";
    public static final String QUERY_REPLY          = "API_QUERY_REPLY";
    public static final String QUERY_CLOSE          = "API_QUERY_CLOSE";
    public static final String ISSUE_CREATE         = "API_ISSUE_CREATE";
    public static final String ISSUE_RESOLVE        = "API_ISSUE_RESOLVE";
    public static final String PD_CREATE            = "API_PD_CREATE";
    public static final String PD_EVALUATE          = "API_PD_EVALUATE";
    public static final String CAPA_CREATE          = "API_CAPA_CREATE";
    public static final String CAPA_APPROVE         = "API_CAPA_APPROVE";
    public static final String CAPA_CLOSE           = "API_CAPA_CLOSE";

    // ==================== 安全管理 ====================
    public static final String AE_REPORT            = "API_AE_REPORT";
    public static final String AE_SEVERITY          = "API_AE_SEVERITY";
    public static final String AE_CAUSALITY         = "API_AE_CAUSALITY";
    public static final String SAE_ESCALATE         = "API_SAE_ESCALATE";
    public static final String SAE_REPORT           = "API_SAE_REPORT";
    public static final String SAE_CLOSE            = "API_SAE_CLOSE";
    public static final String UNBLIND_EMERGENCY    = "API_UNBLIND_EMERGENCY";

    // ==================== 文档管理 ====================
    public static final String DOC_UPLOAD           = "API_DOC_UPLOAD";
    public static final String DOC_VIEW             = "API_DOC_VIEW";
    public static final String DOC_DOWNLOAD         = "API_DOC_DOWNLOAD";
    public static final String DOC_APPROVE          = "API_DOC_APPROVE";
    public static final String DOC_ARCHIVE          = "API_DOC_ARCHIVE";
    public static final String TMF_VIEW             = "API_TMF_VIEW";
    public static final String ESIGN                = "API_ESIGN";

    // ==================== 财务管理 ====================
    public static final String BUDGET_VIEW          = "API_BUDGET_VIEW";
    public static final String BUDGET_EDIT          = "API_BUDGET_EDIT";
    public static final String BUDGET_APPROVE       = "API_BUDGET_APPROVE";
    public static final String CONTRACT_APPROVE     = "API_CONTRACT_APPROVE";
    public static final String PAYMENT_CREATE       = "API_PAYMENT_CREATE";
    public static final String PAYMENT_APPROVE      = "API_PAYMENT_APPROVE";
    public static final String PAYMENT_VIEW         = "API_PAYMENT_VIEW";
    public static final String REIMBURSEMENT        = "API_REIMBURSEMENT";
    public static final String INVOICE              = "API_INVOICE";

    // ==================== 报表 ====================
    public static final String REPORT_PROJECT       = "API_REPORT_PROJECT";
    public static final String REPORT_QUALITY       = "API_REPORT_QUALITY";
    public static final String REPORT_SAFETY        = "API_REPORT_SAFETY";
    public static final String REPORT_FINANCE       = "API_REPORT_FINANCE";
    public static final String REPORT_EXPORT        = "API_REPORT_EXPORT";
    public static final String AUDIT_LOG            = "API_AUDIT_LOG";

    // ==================== 系统管理 ====================
    public static final String SYS_USER             = "API_SYS_USER";
    public static final String SYS_ROLE             = "API_SYS_ROLE";
    public static final String SYS_PERMISSION       = "API_SYS_PERMISSION";
    public static final String SYS_DICT             = "API_SYS_DICT";
    public static final String SYS_TEMPLATE         = "API_SYS_TEMPLATE";
    public static final String SYS_PARAM            = "API_SYS_PARAM";

    // ==================== AI/OCR ====================
    public static final String AI_RESULT_VIEW       = "API_AI_RESULT_VIEW";
    public static final String AI_RESULT_CONFIRM    = "API_AI_RESULT_CONFIRM";
    public static final String OCR_RESULT_VIEW      = "API_OCR_RESULT_VIEW";
    public static final String OCR_RESULT_CONFIRM   = "API_OCR_RESULT_CONFIRM";
}
```

### 4.5.8 数据变更权限控制模式

对于需要校验前置状态的敏感操作（如入组确认、随机操作、紧急揭盲），应结合数据状态进行权限判断：

```java
/**
 * 受试者操作权限校验 Service
 * 将角色权限、数据范围、业务状态三者结合判断
 */
@Service
public class SubjectOperationPermissionService {

    /**
     * 确认受试者入组 - 校验模型：
     *   1. RBAC: 用户必须具有 ROLE_PI 角色 + BTN_SUBJECT_ENROLL 权限
     *   2. ABAC: 受试者必须在用户所属中心的数据范围内
     *   3. State: 受试者当前状态必须是 screened
     *   4. Data: 受试者的知情同意书必须已签署 (consented 状态)
     */
    public OperationCheckResult checkEnrollSubject(Long subjectId) {
        Subject subject = subjectService.getById(subjectId);
        if (subject == null) {
            return OperationCheckResult.fail("受试者不存在");
        }

        // State check
        if (!"screened".equals(subject.getStatus())) {
            return OperationCheckResult.fail(
                "受试者状态不正确，当前状态: " + subject.getStatus() + "，需要: screened");
        }

        // Consent check
        if (!"consented".equals(subject.getConsentStatus())) {
            return OperationCheckResult.fail("受试者尚未签署知情同意书");
        }

        return OperationCheckResult.pass();
    }

    /**
     * 紧急揭盲 - 校验模型：
     *   1. RBAC: 用户必须具有 ROLE_PI + API_UNBLIND_EMERGENCY
     *   2. ABAC: 受试者必须在 PI 所在中心范围内
     *   3. State: 研究必须是双盲设计 + 存在需要揭盲的紧急医学理由
     *   4. Audit: 无论通过与否，必须记录紧急揭盲尝试的审计日志
     */
    @Transactional
    public OperationCheckResult checkEmergencyUnblind(Long subjectId, String reason) {
        // 先记录审计日志
        auditService.logUnblindAttempt(subjectId,
            SecurityUtils.getCurrentUserId(), reason);

        Subject subject = subjectService.getById(subjectId);
        Study study = studyService.getById(subject.getStudyId());

        // 检查是否双盲
        if (!"DOUBLE_BLIND".equals(study.getBlindDesign())) {
            return OperationCheckResult.fail("该研究不是双盲设计，无需紧急揭盲");
        }

        // 检查是否已揭盲
        if (subject.getBlindStatus() != null && "UNBLINDED".equals(subject.getBlindStatus())) {
            return OperationCheckResult.fail("该受试者已经揭盲");
        }

        // 不需要返回具体的随机结果，仅校验权限
        return OperationCheckResult.pass();
    }
}
```

---

## 4.6 审计要求 (Audit Requirements)

### 4.6.1 审计日志分类

| 审计类别 | 审计代码 | 记录内容 | 保留期限 | 合规要求 |
|---------|---------|---------|---------|---------|
| 认证审计 | `AUDIT_AUTH` | 登录成功/失败、登出、JWT刷新、密码修改 | 3年 | GCP 21 CFR Part 11 |
| 权限变更审计 | `AUDIT_PERM_CHANGE` | 角色分配/移除、权限变更、用户状态变更 | 永久 | 21 CFR Part 11 §11.10(e) |
| 敏感操作审计 | `AUDIT_SENSITIVE_OP` | 紧急揭盲、随机操作、入组确认、受试者退出 | 永久 | ICH GCP E6(R2) §2.10 |
| 数据访问审计 | `AUDIT_DATA_ACCESS` | 受试者PII查看、PHI查看、文档下载、数据导出 | 5年 | GDPR / PIPL / HIPAA |
| 数据变更审计 | `AUDIT_DATA_CHANGE` | 数据修改（含before/after）、数据删除、追溯修改 | 永久 | 21 CFR Part 11 §11.10(e) |
| 配置变更审计 | `AUDIT_CONFIG_CHANGE` | 系统参数修改、字典变更、权限配置变更 | 3年 | GCP |
| 拒绝访问审计 | `AUDIT_ACCESS_DENIED` | 403拒绝、权限不足尝试 | 2年 | 安全基线要求 |

### 4.6.2 必须记录的权限检查操作

以下操作无论成功与否，都必须记录审计日志：

#### 高危操作审计点

| 序号 | 操作 | 审计级别 | 日志必须包含 |
|------|------|---------|------------|
| 1 | 紧急揭盲 | CRITICAL | 操作人、时间、受试者ID、原因、结果 |
| 2 | 受试者入组确认 | CRITICAL | 操作人、时间、受试者ID、入组号、IP地址 |
| 3 | 随机操作 | CRITICAL | 操作人、时间、受试者ID、随机结果(仅记录随机号，不记录治疗组) |
| 4 | 受试者退出研究 | HIGH | 操作人、时间、受试者ID、退出原因、退出类型 |
| 5 | 查看受试者PII | HIGH | 操作人、时间、受试者ID、查看的字段列表、来源页面 |
| 6 | 查看受试者PHI | HIGH | 操作人、时间、受试者ID、查看的字段列表 |
| 7 | 数据导出(含PII) | HIGH | 操作人、时间、导出范围、导出字段、导出条数 |
| 8 | 数据更正/追溯修改 | HIGH | 操作人、时间、表名、字段、原值、新值、修改原因 |
| 9 | SAE上报 | HIGH | 操作人、时间、受试者ID、SAE编号、上报机构 |
| 10 | 角色/权限分配变更 | HIGH | 操作人、时间、目标用户、变更前、变更后 |
| 11 | 审批通过/拒绝 | MEDIUM | 操作人、时间、审批对象类型、审批对象ID、审批结果、审批意见 |
| 12 | 解锁访视数据 | MEDIUM | 操作人、时间、访视ID、解锁原因 |
| 13 | 关闭Query | MEDIUM | 操作人、时间、Query ID、关闭依据 |
| 14 | SDV确认 | MEDIUM | 操作人、时间、受试者ID、访视ID、确认的数据点数量 |
| 15 | 冻结访视数据 | MEDIUM | 操作人、时间、访视ID |
| 16 | 文档下载 | MEDIUM | 操作人、时间、文档ID、文档名称 |
| 17 | 角色切换尝试 | LOW | 操作人、时间、尝试切换的目标角色 |
| 18 | 权限拒绝(403错误) | LOW | 操作人、时间、请求URL、尝试的操作 |

### 4.6.3 敏感数据访问日志

```java
/**
 * 敏感数据访问审计 AOP
 * 在方法上标注 @AuditSensitiveAccess 后自动记录审计日志
 */
@Target(ElementType.METHOD)
@Retention(RetentionPolicy.RUNTIME)
public @interface AuditSensitiveAccess {

    /** 操作类型 */
    AuditActionType action();

    /** 操作描述模板 (支持 SpEL) */
    String description();

    /** 敏感数据类别 */
    DataCategory category();

    /** 是否记录请求参数 */
    boolean logParams() default false;

    enum AuditActionType {
        VIEW_PII,           // 查看PII
        VIEW_PHI,           // 查看PHI
        EXPORT_WITH_PII,    // 导出含PII数据
        MODIFY_SUBJECT,     // 修改受试者数据
        UNBLIND,            // 揭盲操作
        RANDOMIZE           // 随机操作
    }

    enum DataCategory {
        SUBJECT_PII,
        SUBJECT_PHI,
        RESTRICTED_BLIND,
        FINANCIAL_CONFIDENTIAL
    }
}
```

```java
@Aspect
@Component
@Slf4j
public class SensitiveAccessAuditAspect {

    private final AuditLogService auditLogService;
    private final IpAddressResolver ipResolver;

    @Around("@annotation(audit)")
    public Object auditSensitiveAccess(ProceedingJoinPoint joinPoint,
                                        AuditSensitiveAccess audit) throws Throwable {
        AuditLog auditLog = new AuditLog();
        auditLog.setAuditType("AUDIT_DATA_ACCESS");
        auditLog.setOperatorId(SecurityUtils.getCurrentUserId());
        auditLog.setOperatorName(SecurityUtils.getCurrentUserName());
        auditLog.setOperatorIp(ipResolver.getClientIp());
        auditLog.setOperateTime(LocalDateTime.now());
        auditLog.setActionType(audit.action().name());
        auditLog.setDescription(audit.description());
        auditLog.setDataCategory(audit.category().name());
        auditLog.setTargetMethod(
            joinPoint.getSignature().getDeclaringTypeName()
            + "." + joinPoint.getSignature().getName());

        // 记录请求参数
        if (audit.logParams()) {
            auditLog.setRequestParams(
                sanitizeSensitiveParams(joinPoint.getArgs()));
        }

        try {
            Object result = joinPoint.proceed();
            auditLog.setStatus("SUCCESS");
            return result;
        } catch (AccessDeniedException e) {
            auditLog.setStatus("ACCESS_DENIED");
            auditLog.setErrorMsg(e.getMessage());
            throw e;
        } catch (Exception e) {
            auditLog.setStatus("ERROR");
            auditLog.setErrorMsg(e.getMessage());
            throw e;
        } finally {
            // 异步写入审计日志
            auditLogService.logAsync(auditLog);
        }
    }

    /**
     * 清理敏感参数中的具体值，仅保留结构信息
     */
    private String sanitizeSensitiveParams(Object[] args) {
        // 不对审计日志再记录一遍完整的PII数据
        // 仅记录参数的类型和结构描述
        return Arrays.stream(args)
            .map(arg -> arg != null ? arg.getClass().getSimpleName() : "null")
            .collect(Collectors.joining(", "));
    }
}
```

**使用示例**:

```java
@RestController
@RequestMapping("/api/admin/subjects")
public class SubjectController {

    // 查看受试者PII - 必须记录审计日志
    @GetMapping("/{subjectId}/pii")
    @PreAuthorize("@abacEvaluator.canViewPii(#subjectId)")
    @AuditSensitiveAccess(
        action = AuditActionType.VIEW_PII,
        description = "查看受试者个人身份信息",
        category = DataCategory.SUBJECT_PII,
        logParams = false  // PII参数不应再被审计日志记录
    )
    public Result<SubjectPiiVO> viewSubjectPii(@PathVariable Long subjectId) {
        return Result.success(subjectService.getSubjectPii(subjectId));
    }

    // 紧急揭盲 - CRITICAL 级别审计
    @PostMapping("/{subjectId}/emergency-unblind")
    @PreAuthorize("@abacEvaluator.canEmergencyUnblind(#studyId)")
    @AuditSensitiveAccess(
        action = AuditActionType.UNBLIND,
        description = "紧急揭盲操作",
        category = DataCategory.RESTRICTED_BLIND,
        logParams = false
    )
    public Result<UnblindResultVO> emergencyUnblind(
            @PathVariable Long subjectId,
            @RequestParam Long studyId,
            @Valid @RequestBody UnblindRequestDTO request) {
        return Result.success(unblindService.emergencyUnblind(subjectId, request));
    }
}
```

### 4.6.4 权限变更审计

```java
/**
 * 权限变更审计 Service
 * 所有角色、权限、数据范围的变更都必须记录完整的 before/after 快照
 */
@Service
public class PermissionChangeAuditService {

    /**
     * 记录角色分配变更
     */
    @Async
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void logRoleAssignmentChange(
            Long targetUserId,
            String targetUsername,
            List<String> rolesBefore,
            List<String> rolesAfter,
            Long operatorId,
            String operatorName,
            String reason) {

        AuditLog log = new AuditLog();
        log.setAuditType("AUDIT_PERM_CHANGE");
        log.setAuditSubType("ROLE_ASSIGNMENT");
        log.setOperatorId(operatorId);
        log.setOperatorName(operatorName);
        log.setTargetUserId(targetUserId);
        log.setTargetUsername(targetUsername);
        log.setChangeBefore(JsonUtils.toJson(rolesBefore));
        log.setChangeAfter(JsonUtils.toJson(rolesAfter));
        log.setChangeDetail(String.format(
            "角色变更: 新增 %s, 移除 %s, 操作原因: %s",
            CollectionUtils.subtract(rolesAfter, rolesBefore),
            CollectionUtils.subtract(rolesBefore, rolesAfter),
            reason));
        log.setOperateTime(LocalDateTime.now());
        log.setStatus("SUCCESS");

        auditLogMapper.insert(log);
    }

    /**
     * 记录数据范围变更
     */
    @Async
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void logDataScopeChange(
            Long targetUserId,
            String scopeType,
            String scopeBefore,
            String scopeAfter,
            Long operatorId,
            String reason) {

        AuditLog log = new AuditLog();
        log.setAuditType("AUDIT_PERM_CHANGE");
        log.setAuditSubType("DATA_SCOPE");
        log.setOperatorId(operatorId);
        log.setTargetUserId(targetUserId);
        log.setScopeType(scopeType);
        log.setChangeBefore(scopeBefore);
        log.setChangeAfter(scopeAfter);
        log.setChangeDetail("数据范围变更: " + scopeType + ", 原因: " + reason);
        log.setOperateTime(LocalDateTime.now());

        auditLogMapper.insert(log);
    }
}
```

### 4.6.5 失败的访问尝试日志

```java
/**
 * 自定义 403 处理器
 * 记录所有权限拒绝尝试
 */
@Component
public class CustomAccessDeniedHandler implements AccessDeniedHandler {

    private final AuditLogService auditLogService;
    private final IpAddressResolver ipResolver;

    @Override
    public void handle(HttpServletRequest request,
                       HttpServletResponse response,
                       AccessDeniedException accessDeniedException)
            throws IOException {

        Authentication auth = SecurityContextHolder.getContext().getAuthentication();

        // 异步记录审计日志
        auditLogService.logAsync(AuditLog.builder()
            .auditType("AUDIT_ACCESS_DENIED")
            .operatorId(auth != null ? auth.getName() : "ANONYMOUS")
            .operatorIp(ipResolver.getClientIp(request))
            .requestUrl(request.getRequestURI())
            .requestMethod(request.getMethod())
            .requiredPermission(extractRequiredPermission(accessDeniedException))
            .userRoles(auth != null ?
                auth.getAuthorities().stream()
                    .map(GrantedAuthority::getAuthority)
                    .collect(Collectors.joining(","))
                : "NONE")
            .errorMsg(accessDeniedException.getMessage())
            .operateTime(LocalDateTime.now())
            .status("DENIED")
            .build());

        response.setContentType("application/json;charset=UTF-8");
        response.setStatus(HttpServletResponse.SC_FORBIDDEN);
        response.getWriter().write(JsonUtils.toJson(
            Result.error(403, "权限不足，请联系管理员。该操作已被记录。")));
    }
}

/**
 * 登录失败审计
 */
@Component
public class AuthenticationFailureListener
        implements ApplicationListener<AuthenticationFailureBadCredentialsEvent> {

    private final AuditLogService auditLogService;

    @Override
    public void onApplicationEvent(AuthenticationFailureBadCredentialsEvent event) {
        String username = event.getAuthentication().getName();
        String ipAddress = extractIpFromContext();

        auditLogService.logAsync(AuditLog.builder()
            .auditType("AUDIT_AUTH")
            .auditSubType("LOGIN_FAILED")
            .operatorId(username)
            .operatorIp(ipAddress)
            .errorMsg("密码验证失败")
            .operateTime(LocalDateTime.now())
            .status("FAILED")
            .build());

        // 检查是否需要触发账户锁定
        auditLogService.checkAndLockAccount(username, ipAddress);
    }
}
```

### 4.6.6 审计日志数据表设计

```sql
-- 审计日志主表
CREATE TABLE audit_log (
    id              BIGINT PRIMARY KEY AUTO_INCREMENT,
    audit_type      VARCHAR(50)   NOT NULL COMMENT '审计类别: AUDIT_AUTH/AUDIT_PERM_CHANGE/AUDIT_SENSITIVE_OP/AUDIT_DATA_ACCESS/AUDIT_DATA_CHANGE/AUDIT_CONFIG_CHANGE/AUDIT_ACCESS_DENIED',
    audit_sub_type  VARCHAR(50)   COMMENT '审计子类别',
    operator_id     VARCHAR(64)   COMMENT '操作人ID',
    operator_name   VARCHAR(100)  COMMENT '操作人姓名',
    operator_ip     VARCHAR(45)   COMMENT '操作人IP地址',
    target_user_id  VARCHAR(64)   COMMENT '目标用户ID',
    target_type     VARCHAR(50)   COMMENT '操作目标类型: STUDY/SITE/SUBJECT/DOCUMENT/ROLE/PERMISSION',
    target_id       VARCHAR(64)   COMMENT '操作目标ID',
    action_type     VARCHAR(100)  COMMENT '操作类型',
    description     TEXT          COMMENT '操作描述',
    request_url     VARCHAR(500)  COMMENT '请求URL',
    request_method  VARCHAR(10)   COMMENT 'HTTP方法',
    request_params  TEXT          COMMENT '请求参数(已脱敏)',
    required_permission VARCHAR(200) COMMENT '要求的权限码',
    user_roles      VARCHAR(500)  COMMENT '操作时的用户角色',
    change_before   JSON          COMMENT '变更前数据快照',
    change_after    JSON          COMMENT '变更后数据快照',
    change_detail   TEXT          COMMENT '变更详情描述',
    scope_type      VARCHAR(50)   COMMENT '数据范围类型',
    data_category   VARCHAR(50)   COMMENT '数据类别',
    error_msg       TEXT          COMMENT '错误信息',
    status          VARCHAR(20)   NOT NULL DEFAULT 'SUCCESS' COMMENT '状态: SUCCESS/DENIED/ERROR',
    operate_time    DATETIME      NOT NULL COMMENT '操作时间',
    created_at      DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,

    INDEX idx_audit_type_time (audit_type, operate_time),
    INDEX idx_operator_time (operator_id, operate_time),
    INDEX idx_target (target_type, target_id),
    INDEX idx_audit_time (operate_time)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='审计日志表';

-- 审计日志归档表 (历史数据)
CREATE TABLE audit_log_archive (
    LIKE audit_log INCLUDING ALL
) COMMENT='审计日志归档表 - 超过保留期的日志迁移至此或直接删除';
```

### 4.6.7 审计日志查询权限

| 操作 | Admin | Auditor | 其他角色 |
|------|-------|--------|---------|
| 查询全部审计日志 | ✅ | ✅ | ❌ |
| 查询自身操作日志 | ✅ | ✅ | ✅ |
| 导出审计日志 | ✅ | ✅ | ❌ |
| 删除审计日志 | ✅ | ❌ | ❌ |
| 配置审计策略 | ✅ | ❌ | ❌ |

> 注：Auditor 可查询但不能修改或删除任何日志。Admin 的审计日志删除操作本身也会被记录。

### 4.6.8 合规性检查清单

| 法规/标准 | 条款 | 系统实现 | 验证方式 |
|----------|------|---------|---------|
| 21 CFR Part 11 | §11.10(e) - 审计追踪 | 全量审计日志表，不可删除 | 管理员定期查阅审计报告 |
| 21 CFR Part 11 | §11.10(d) - 权限控制 | RBAC+ABAC双重权限控制 | 权限矩阵评审 |
| 21 CFR Part 11 | §11.200 - 电子签名 | eSignature + 审计记录 | 电子签名记录验证 |
| ICH GCP E6(R2) | §2.10 - 稽查 | Auditor 只读角色 + 完整审计追踪 | Auditor 账户测试 |
| ICH GCP E6(R2) | §4.9 - 源数据核查 | SDV 权限 + 数据变更完整审计 | SDV 流程验证 |
| ICH GCP E6(R2) | §5.18 - 监查 | CRA 角色 + ABAC中心范围限制 | 中心级数据隔离测试 |
| GDPR | Art.15 - 数据主体访问权 | Patient 角色可查看/导出自身数据 | Patient 数据导出测试 |
| GDPR | Art.17 - 被遗忘权 | 受试者撤回知情同意 → 数据标记WITHDRAWN | 撤回后数据访问验证 |
| PIPL (中国) | 第45条 - 个人信息查阅复制权 | Patient 角色可查看/导出自身PII数据 | Patient 端PII查看测试 |
| PIPL (中国) | 第47条 - 个人信息删除权 | 撤回同意 → 数据最小化处理 | 撤回后字段级验证 |
| HIPAA | §164.502 - 使用和披露 | Sponsor PII脱敏 + Finance 不可访问受试者 | 角色权限验证 |
| HIPAA | §164.312 - 审计控制 | 硬件/软件/程序机制记录和检查 | 审计日志功能测试 |

---

## 附录A: 权限冲突解决规则

当用户拥有多个角色时，可能产生权限冲突。以下为冲突解决的层级规则：

| 优先级 | 冲突类型 | 解决规则 | 示例 |
|--------|---------|---------|------|
| 1 | 字段级脱敏 vs 完整可见 | **脱敏优先** (安全优先) | 用户同时有 ROLE_PM(脱敏) + ROLE_CRA(完整)，受试者PII仍脱敏 |
| 2 | 操作权限冲突 | **并集取大** (权限叠加) | 用户同时有 ROLE_CRA + ROLE_CRC，操作权限取两者并集 |
| 3 | 数据范围冲突 | **并集取大** (范围叠加) | 用户有CRA(中心101) + CRC(中心102)，可访问两个中心数据 |
| 4 | 审计要求冲突 | **最严格审计** | 任何角色组合，只要其中之一要求审计，就必须审计 |

> **特别说明**: 当 ROLE_ADMIN 与其他业务角色共存时，仍以 ROLE_ADMIN 为准（全部权限），但审计日志会特别标注该用户具有 Admin 角色。

---

## 附录B: 权限初始化SQL脚本模板

```sql
-- =============================================
-- 角色初始化
-- =============================================
INSERT INTO sys_role (role_code, role_name, role_type, description, is_active) VALUES
('ROLE_ADMIN', '系统管理员', 'SYSTEM', '系统超级管理员，具有全部权限', 1),
('ROLE_PM', '项目经理', 'BUSINESS', '研究项目经理，管理研究项目及团队', 1),
('ROLE_CRA', '临床监查员', 'BUSINESS', '临床监查员，负责中心监查和SDV', 1),
('ROLE_CRC', '临床研究协调员', 'BUSINESS', '中心CRC，负责受试者管理和数据录入', 1),
('ROLE_PI', '主要研究者', 'BUSINESS', '主要研究者，负责医学决策和监督', 1),
('ROLE_SPONSOR', '申办方代表', 'BUSINESS', '申办方代表，负责研究监督和财务审批', 1),
('ROLE_FINANCE', '财务专员', 'BUSINESS', '财务专员，负责预算、付款和报销管理', 1),
('ROLE_PATIENT', '患者/受试者', 'SELF_SERVICE', '受试者，通过小程序访问个人数据', 1),
('ROLE_CAREGIVER', '看护人/监护人', 'SELF_SERVICE', '看护人/监护人，代理受试者操作', 1),
('ROLE_AUDITOR', '只读审计员', 'SYSTEM', 'GCP审计员/检查员，具有全系统只读权限', 1);

-- =============================================
-- 用户-研究分配关系表
-- =============================================
CREATE TABLE user_study_assignment (
    id          BIGINT PRIMARY KEY AUTO_INCREMENT,
    user_id     BIGINT NOT NULL COMMENT '用户ID',
    study_id    BIGINT NOT NULL COMMENT '研究ID',
    role_code   VARCHAR(50) NOT NULL COMMENT '分配时的角色',
    is_active   TINYINT NOT NULL DEFAULT 1 COMMENT '是否有效',
    assigned_by BIGINT COMMENT '分配操作人',
    assigned_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    expires_at  DATETIME COMMENT '过期时间(NULL表示永久)',
    UNIQUE KEY uk_user_study_role (user_id, study_id, role_code)
) COMMENT='用户-研究分配关系';

-- =============================================
-- 用户-中心分配关系表
-- =============================================
CREATE TABLE user_site_assignment (
    id          BIGINT PRIMARY KEY AUTO_INCREMENT,
    user_id     BIGINT NOT NULL COMMENT '用户ID',
    site_id     BIGINT NOT NULL COMMENT '中心ID',
    role_code   VARCHAR(50) NOT NULL COMMENT '分配时的角色',
    is_active   TINYINT NOT NULL DEFAULT 1 COMMENT '是否有效',
    assigned_by BIGINT COMMENT '分配操作人',
    assigned_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    expires_at  DATETIME COMMENT '过期时间',
    UNIQUE KEY uk_user_site_role (user_id, site_id, role_code)
) COMMENT='用户-中心分配关系';

-- =============================================
-- Caregiver-受试者关联关系
-- =============================================
CREATE TABLE caregiver_subject (
    id              BIGINT PRIMARY KEY AUTO_INCREMENT,
    caregiver_user_id BIGINT NOT NULL COMMENT '看护人用户ID',
    subject_id      BIGINT NOT NULL COMMENT '受试者ID',
    relationship    VARCHAR(50) NOT NULL COMMENT '关系: PARENT/SPOUSE/CHILD/GUARDIAN/OTHER',
    auth_status     VARCHAR(20) NOT NULL DEFAULT 'PENDING' COMMENT '授权状态: ACTIVE/PENDING/REVOKED',
    auth_start_date DATE COMMENT '授权开始日期',
    auth_end_date   DATE COMMENT '授权结束日期',
    created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uk_caregiver_subject (caregiver_user_id, subject_id)
) COMMENT='看护人-受试者关联关系';
```

---

## 附录C: 前端路由-权限映射配置

```typescript
// config/routePermission.ts
import { PermissionCode } from '@/types/permission';

export interface RouteConfig {
  path: string;
  name: string;
  permission?: PermissionCode;
  roles?: string[];
}

export const routePermissionMap: Record<string, RouteConfig> = {
  // ===== 工作台 =====
  '/workspace': {
    name: '工作台',
    // 无特殊权限要求，所有登录用户均可访问
  },

  // ===== 项目管理 =====
  '/projects': {
    name: '项目列表',
    permission: PermissionCode.STUDY_LIST,
  },
  '/projects/create': {
    name: '创建项目',
    permission: PermissionCode.STUDY_CREATE,
    roles: ['ROLE_ADMIN', 'ROLE_PM'],
  },

  // ===== 受试者管理 =====
  '/subjects': {
    name: '受试者列表',
    permission: PermissionCode.SUBJECT_LIST,
  },
  '/subjects/:id': {
    name: '受试者详情',
    permission: PermissionCode.SUBJECT_DETAIL,
  },

  // ===== AE管理 =====
  '/safety/aes': {
    name: '不良事件列表',
    permission: PermissionCode.AE_LIST,
  },
  '/safety/aes/report': {
    name: '报告AE',
    permission: PermissionCode.AE_REPORT,
  },

  // ===== 财务管理 =====
  '/finance/budget': {
    name: '预算管理',
    permission: PermissionCode.BUDGET_VIEW,
  },
  '/finance/payments': {
    name: '付款管理',
    permission: PermissionCode.PAYMENT_VIEW,
    roles: ['ROLE_ADMIN', 'ROLE_PM', 'ROLE_SPONSOR', 'ROLE_FINANCE', 'ROLE_PI'],
  },

  // ===== 系统配置 =====
  '/admin/users': {
    name: '用户管理',
    permission: PermissionCode.SYS_USER,
    roles: ['ROLE_ADMIN'],
  },
  '/admin/roles': {
    name: '角色管理',
    permission: PermissionCode.SYS_ROLE,
    roles: ['ROLE_ADMIN'],
  },
  '/admin/audit-log': {
    name: '审计日志',
    permission: PermissionCode.AUDIT_LOG,
    roles: ['ROLE_ADMIN', 'ROLE_AUDITOR'],
  },
};
```

---

> **文档结束**  
> 本权限模型文档为 Round 2 设计阶段产出，后续将基于实际业务需求迭代更新。设计原则为：安全优先、最小权限、职责分离、审计全覆盖。
