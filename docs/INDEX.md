# CTMS/PMS 临床研究项目运营管理平台 — 完整设计文档索引

> **版本:** V1.0-RC1 | **日期:** 2026-05-11 | **总规模:** 13 文件, ~31,000 行, ~1.5 MB

---

## 一、文件清单与用途

### Round 1 — 产品定义与技术架构 (2 文件)

| 文件 | 章节 | 用途 |
|------|------|------|
| [round1-sections1-3.md](round1-sections1-3.md) | 一~三 | **产品概述**(定位/KPI/非目标/假设)、**信息架构**(管理端/患者端导航树/角色工作台)、**产品域与模块清单**(36模块边界与关系) |
| [round1-sections4-5.md](round1-sections4-5.md) | 四~五 | **数据模型总览**(36实体分组/ER关系/敏感数据/审计/OpenSearch/AI数据源)、**技术架构总览**(Java后端/Python AI/前端/数据/集成/文件/异步/工作流/部署/可观测性) |

### Round 2 — 模块详述与权限模型 (4 文件)

| 文件 | 章节 | 用途 |
|------|------|------|
| [round2-modules-admin-1.md](round2-modules-admin-1.md) | 三(M01-M07) | **管理端模块M01-M07详细设计**: 工作台/研究启动/方案管理/中心研究者/受试者/访视/监查。每模块含目标/子功能/交互流程/状态流转/字段/异常/权限/实体/API |
| [round2-modules-admin-2.md](round2-modules-admin-2.md) | 三(M08-M14) | **管理端模块M08-M14详细设计**: Query+Issue+PD+CAPA/ AE+SAE安全/文档中心/预算合同付款报销开票对账/消息待办报告/统计预测热力图/系统配置 |
| [round2-modules-patient-hub.md](round2-modules-patient-hub.md) | 三(P01-P12, H01-H10) | **患者端12模块**(招募~隐私中心) + **数据中台10模块**(主索引/HIS~EMR适配/EDC~eTMF适配/分层存储/事件总线/质量规则/导入导出/对账补偿/审计/脱敏) |
| [round2-permissions.md](round2-permissions.md) | 四 | **RBAC+ABAC权限模型**: 10角色定义+权限矩阵+ABAC数据范围规则+字段脱敏+Spring Security实现方案+审计要求+合规对照表 |

### Round 3 — 技术落地设计 (5 文件)

| 文件 | 章节 | 用途 |
|------|------|------|
| [round3-database.md](round3-database.md) | 五 | **数据库设计**: 46张表完整DDL(列/类型/约束/索引/分区)、敏感字段加密策略、JSONB示例、Flyway迁移策略、索引设计总览 |
| [round3-api.md](round3-api.md) | 六 | **REST API设计**: 365个端点(14模块35Controller)、10个OpenAPI Schema示例、80+错误码、Webhook设计(25+事件)、文件上传/异步轮询/批量导入/限流策略 |
| [round3-integration.md](round3-integration.md) | 七 | **集成设计**: 内部CDM(8实体)、FHIR映射(25+Extension)、6个外部适配器(HIS/LIS/PACS/EMR/EDC/eTMF)、集成任务状态机(10状态)、对账补偿(4类型)、RabbitMQ事件总线拓扑 |
| [round3-ai-ocr-part1.md](round3-ai-ocr-part1.md) | 八 | **AI/OCR Part1**: OCR完整18步链路(上传→解析→提取→确认)、JSONB结果结构、4级置信度评分、30+单位标准化、6种文档类型PaddleX Pipeline、人工复核UI与工作流、20项AI安全边界 |
| [round3-ai-ocr-part2.md](round3-ai-ocr-part2.md) | 八 | **AI/OCR Part2**: RAG知识库问答(混合搜索+Reranker+引用)、PM/CRA Copilot(6功能)、自动周报/月报、入组预测(贝叶斯+ML)、5维风险评分、模型版本管理(注册/测试/金丝雀/回滚)、AI反馈闭环 |

### Round 4 — 工程落地与交付 (2 文件)

| 文件 | 章节 | 用途 |
|------|------|------|
| [round4-code-skeleton.md](round4-code-skeleton.md) | 十一 | **完整代码骨架**: Maven pom.xml / application.yml / 启动类 / BaseEntity / ApiResponse / ErrorCode(35错误码) / GlobalExceptionHandler / Spring Security / JWT Filter / Study完整模块(Entity+Mapper+XML+DTO+Service+StateMachine+Controller) / FileObject上传 / OCR Producer / OCR Callback Controller / TaskStatus查询 / Python FastAPI(8个模块) / PaddleOCR引擎 / UnitNormalizer(30映射) / ConfidenceScorer / ModelRegistry / CallbackClient / Next.js工作台+权限组件+API Client / Taro首页+上传+OCR轮询Hook / Docker Compose(8服务) / Dockerfile(3) / GitHub Actions CI |
| [round4-completion.md](round4-completion.md) | 九/十/十二~十五 | **补充章节**: 管理端30+页面清单(路由/组件/API/权限) / 患者端17页面 / 页面跳转关系图 / 安全合规(三层模型: 必须有12项+建议有5项+增强4项) / 合规责任声明 / 测试策略(10层+CI/CD流水线) / 路线图(MVP/V1/V2) / 非目标范围(EDC/eTMF/FHIR Server等) / 17项风险清单 / 12项关键假设 |

### 本文件

| 文件 | 用途 |
|------|------|
| [INDEX.md](INDEX.md) | **最终总目录**: 文件清单/一致性校验报告/缺口清单/待确认假设/下一步开发任务 |

---

## 二、一致性校验报告

### 2.1 技术栈一致性 ✅ 通过

| 检查项 | 结果 |
|--------|------|
| 全文无 NestJS 引用 | ✅ Grep扫描: 0匹配 |
| 全文无 Prisma 引用 | ✅ |
| 全文无 TypeORM 引用 | ✅ |
| 全文无 BullMQ 引用 | ✅ |
| 主后端统一 Java 21 + Spring Boot 3 | ✅ pom.xml/application.yml/所有代码示例 |
| ORM统一 MyBatis Plus | ✅ Mapper+XML Mapper模式 |
| 工作流统一 Flowable | ✅ 8流程定义 |
| AI统一 Python + FastAPI | ✅ main.py + routers |
| OCR统一 PaddleOCR/PaddleX | ✅ engines封装 |
| 前端管理端 Next.js + Ant Design | ✅ layout/workspace示例 |
| 患者端 Taro + React + WeChat | ✅ 首页/上传/OCR轮询 |
| 数据库 PostgreSQL | ✅ 46表DDL + Flyway |
| 缓存Redis / 队列RabbitMQ / 搜索OpenSearch / 存储MinIO | ✅ 全部出现在配置和代码中 |

### 2.2 数据实体一致性 ✅ 通过

| 检查项 | 结果 |
|--------|------|
| 36核心实体全部有表定义(扩展至46表) | ✅ round3-database.md |
| 所有实体出现在API中 | ✅ 365端点覆盖 |
| 所有实体出现在状态机中 | ✅ 9状态机定义一致 |
| 审计字段统一(BaseEntity) | ✅ created_at/updated_at/created_by/updated_by/is_deleted/deleted_at/version |
| 敏感字段标记一致 | ✅ S0-S5分级，加密/脱敏策略一致 |

### 2.3 状态机一致性 ✅ 通过

| 状态机 | 数据模型 | API | 代码骨架 | 权限 |
|--------|----------|-----|----------|------|
| Study (6状态) | ✅ studies.status | ✅ PUT /studies/{id}/status | ✅ StudyStateMachine | ✅ PM |
| Site (6状态) | ✅ sites.status | ✅ PUT /sites/{id}/status | ✅ round2-modules-admin-1 | ✅ PM |
| Subject (9状态) | ✅ subjects.status | ✅ PUT /subjects/{id}/status | ✅ round2-modules-admin-1 | ✅ CRC/PI |
| Visit (6状态) | ✅ visits.status | ✅ PUT /visits/{id}/status | ✅ round2-modules-admin-1 | ✅ CRC |
| Consent (6状态) | ✅ consent_versions.status | ✅ PUT /consent/{id}/status | ✅ round2-modules-patient-hub | ✅ Patient/Caregiver |
| Issue (6状态) | ✅ issues.status | ✅ PUT /issues/{id}/status | ✅ round2-modules-admin-2 | ✅ PM/CRA |
| SAE (5状态) | ✅ saes.status | ✅ PUT /saes/{id}/escalate | ✅ round2-modules-admin-2 | ✅ PI/PM |
| CAPA (7状态) | ✅ capas.status | ✅ Flowable workflow | ✅ round2-modules-admin-2 | ✅ PM/PI |
| IntegrationTask (10状态) | ✅ integration_tasks.status | ✅ POST /integration/tasks/{id}/retry | ✅ round3-integration | ✅ Admin |

### 2.4 权限一致性 ✅ 通过

| 检查项 | 结果 |
|--------|------|
| 10角色定义一致(Round1/2/4) | ✅ |
| RBAC+ABAC模型与API @PreAuthorize对齐 | ✅ round2-permissions ↔ round3-api |
| 字段脱敏(S3-S5)与DB加密一致 | ✅ round2-permissions ↔ round3-database |
| 审计注解@Auditable与审计表一致 | ✅ round4-code-skeleton AuditLogAspect ↔ audit_logs |

### 2.5 AI安全边界一致性 ✅ 通过

| 规则 | 体现位置 |
|------|----------|
| AI不直接访问主数据库 | round1-sections4-5 / round3-ai-ocr-part1 §8 |
| AI不直接修改业务状态 | round3-ai-ocr-part1 §8 |
| 所有AI结果标注置信度+模型版本 | round4-code-skeleton OcrService / OcrCallbackService |
| 高风险操作人工确认 | round3-ai-ocr-part1 §7 review workflow |
| 所有确认/驳回审计留痕 | round4-code-skeleton @Auditable(AI_CONFIRMATION) |
| 回调模式返回候选结果 | round3-ai-ocr-part1 callback design |

---

## 三、缺口清单

### 3.1 设计层面缺口

| # | 缺口 | 严重度 | 建议 |
|---|------|--------|------|
| 1 | **随机化算法细节**: randomization模块未指定具体随机化算法(区组/分层/动态)和随机号生成方式 | 中 | V1前需临床统计师确认随机化方案，补充IRWS/IWRS接口设计 |
| 2 | **揭盲流程细节**: 紧急揭盲的授权链和操作路径未详细设计 | 中 | 需与PI/申办方/DSMB确认紧急揭盲SOP |
| 3 | **多语言支持**: 未定义国际化(i18n)方案，当前仅中文 | 低 | V2前规划，一期仅中文 |
| 4 | **患者端离线模式**: 微信小程序弱网/离线场景处理未细化 | 低 | MVP阶段依赖微信本地缓存，V1完善离线策略 |
| 5 | **数据迁移方案**: 从现有系统(如Excel/旧CTMS)迁移数据的工具和流程未设计 | 中 | V1前需数据迁移脚本+校验工具 |
| 6 | **培训材料**: 各角色用户手册和培训计划未涉及 | 低 | MVP阶段由PM和临床顾问编写 |
| 7 | **FHR Server完整设计**: 一期不做FHIR Server，但V2需的接口预留不够具体 | 低 | 当前CDM+FHIR映射层可作为雏形 |

### 3.2 代码层面缺口

| # | 缺口 | 严重度 | 建议 |
|---|------|--------|------|
| 1 | **Flowable BPMN文件**: 未提供实际的.bpmn20.xml流程定义文件 | 高 | 开发阶段需为8个流程创建BPMN图 |
| 2 | **Flyway迁移SQL**: 仅定义了迁移版本规划，未写实际的CREATE TABLE语句 | 高 | 初始化工程时需从round3-database.md转为SQL |
| 3 | **MyBatis Plus MetaObjectHandler**: BaseEntity自动填充未实现 | 中 | 参考MyBatis Plus文档实现create/update自动填充 |
| 4 | **文件扫描Worker**: Java端的文件异步扫描(病毒/MIME/hash)消费者未提供 | 中 | 需实现RabbitMQ Consumer监听ctms.file.scan队列 |
| 5 | **WebSocket/SSE推送**: 实时通知推送(OCR完成/新待办)的基础设施未在骨架中 | 低 | MVP可用轮询，V1加SSE |
| 6 | **完整单元测试**: 骨架中的测试代码较少 | 中 | 开发阶段补充 |

### 3.3 工程层面缺口

| # | 缺口 | 严重度 | 建议 |
|---|------|--------|------|
| 1 | **Kubernetes Helm Chart完整模板**: 仅定义了目录结构，未提供实际template YAML | 中 | 开发中期补充 |
| 2 | **Terraform/Pulumi IaC**: 基础设施即代码未涉及 | 低 | V1/V2补充 |
| 3 | **灾备演练方案**: 未定义具体恢复时间目标(RTO)和恢复点目标(RPO) | 中 | 上线前需运维定义 |
| 4 | **性能基线数据**: 目标QPS/TPS数字来自假设，未经过实际压测验证 | 中 | MVP阶段压测校准 |

---

## 四、待确认假设

以下假设需在项目启动前与相关方确认（按优先级排序）：

| # | 假设 | 确认对象 | 风险(若被推翻) |
|---|------|----------|----------------|
| 1 | 至少3-5家医院愿意作为试点并提供接口对接支持 | 商务/申办方 | 集成中台核心价值严重削弱 |
| 2 | 临床试验机构接受SaaS部署或私有化部署方案 | 机构管理者/IT | 需改为纯私有化部署，CI/CD和运维策略改变 |
| 3 | 电子知情同意(eConsent)在试点中心被伦理和法规认可 | 伦理委员会/法务 | eConsent降级为纸质ICF电子影像版，丧失核心功能 |
| 4 | 微信小程序能通过医院伦理和隐私审查 | 伦理委员会 | 患者端需改为纯H5或独立APP |
| 5 | 团队具备或愿意学习Java 21 + Spring Boot 3 | 技术负责人/HR | 需调整技术栈或招聘策略 |
| 6 | AI OCR在中国医院报告上准确率可达到可用水平(≥90%) | AI团队/试点测试 | AI核心价值需重估 |
| 7 | 中国境内部署不涉及数据出境问题 | 法务 | 若涉及国际多中心需重评数据传输合规 |
| 8 | 一期不建完整EDC/eTMF不会成为销售/客户阻断因素 | PM/商务 | 需考虑EDC/eTMF适配器的优先级提升 |
| 9 | PostgreSQL UUIDv7可在项目中使用(需pg_uuidv7扩展) | 架构/DBA | 回退至UUIDv4或自增ID需调整索引策略 |
| 10 | 申办方和CRO愿意使用统一平台而非各自独立系统 | 商务 | 需更完善的多租户和权限隔离 |
| 11 | Flowable嵌入式部署能满足一期性能需求 | 架构 | 若高并发工作流需独立部署Flowable REST |
| 12 | MinIO社区版能满足生产需求 | 运维 | 若需S3兼容性提升改为AWS S3或阿里云OSS |

---

## 五、下一步开发任务

### Immediate (工程启动前)

| 任务 | 负责人 | 产出 |
|------|--------|------|
| 用Maven Archetype生成Spring Boot 3项目骨架 | 后端Lead | 可编译运行的pom.xml+启动类 |
| 创建pnpm workspace + Turborepo配置 | 前端Lead | monorepo可启动 |
| 编写Flyway V001~V011 SQL迁移脚本 | 后端+DBA | 46张表的DDL |
| 开发环境Docker Compose可一键启动(PostgreSQL+Redis+RabbitMQ+MinIO+OpenSearch) | DevOps | docker compose up即用 |
| 完成最核心8张表(studies/sites/subjects/visits/aes/queries/file_objects/audit_logs)的Entity+Mapper+Service+Controller | 后端 | 可运行的CRUD API |
| 初始角色和权限种子数据 | 后端 | 10角色+初始权限 |
| Admin Web: 登录页+工作台骨架+项目列表 | 前端 | 可登录并查看空项目列表 |
| Patient MiniApp: 首页骨架+Taro配置 | 前端 | MiniApp可编译运行 |
| AI Service: FastAPI骨架+PaddleOCR依赖安装 | AI | /health可用 |

### Short-term (MVP, 第1-3月)

| 里程碑 | 关键交付 |
|--------|----------|
| M1: 核心域模型 + API | Study/Site/Subject/Visit/Query/AE 完整CRUD+状态机+权限+审计 |
| M2: Admin Web基础功能 | 工作台/项目列表/受试者列表/访视执行/Query工作流 |
| M3: Patient MiniApp基础 | 首页/招募/eConsent/上传/OCR确认/问卷 |
| M4: AI OCR MVP | 检验报告OCR管道+人工复核+回调 |
| M5: 集成与部署 | Docker Compose一键启动+CI/CD+基本监控 |

### Medium-term (V1, 第4-9月)

| 里程碑 | 关键交付 |
|--------|----------|
| M6: 完整业务闭环 | 所有14管理端模块+12患者端模块 |
| M7: 工作流+财务 | Flowable 8流程+预算/合同/付款/报销对账 |
| M8: 集成中台 | CDM+FHIR+HIS/LIS/EMR/EDC适配器+对账 |
| M9: AI增强 | RAG问答+Copilot+报告生成+入组预测+风险评分 |
| M10: 生产就绪 | K8s+Helm+HPA+全链路监控+灾备 |

---

## 六、方案统计

| 维度 | 数据 |
|------|------|
| 设计文档 | 13 文件 |
| 总行数 | ~31,000 行 |
| 总大小 | ~1.5 MB |
| 角色 | 10 (Admin/PM/CRA/CRC/PI/Sponsor/Finance/Patient/Caregiver/Auditor) |
| 管理端模块 | 14 (M01~M14) |
| 患者端模块 | 12 (P01~P12) |
| 数据中台模块 | 10 (H01~H10) |
| 核心数据实体 | 46 张表 |
| 状态机 | 9 个 (Study/Site/Subject/Visit/Consent/Issue/SAE/CAPA/IntegrationTask) |
| REST API端点 | 365 个 |
| Controller | 35 个 |
| 错误码 | 35 个 |
| Flowable流程 | 8 个 |
| RabbitMQ队列 | 11 个 |
| 外部系统适配器 | 6 个 (HIS/LIS/PACS/EMR/EDC/eTMF) |
| MinIO Bucket | 4 个 (raw/processed/archive/temp) |
| 管理端页面 | 30+ 个 |
| 患者端页面 | 17 个 |
| 技术栈 | Java 21 / Spring Boot 3 / MyBatis Plus / Python FastAPI / PaddleOCR / Next.js / Taro / PostgreSQL / Redis / RabbitMQ / OpenSearch / MinIO / Flowable / Docker Compose / Kubernetes |
| 已提供代码骨架 | Java 后端(完整Maven配置+核心模块示例+Controller+Service) / Python AI(完整服务+OCR+提取+RAG+Copilot) / Next.js(工作台+权限+API Client) / Taro(首页+上传+OCR轮询Hook) / Docker Compose(8服务) / GitHub Actions CI |

---

> **下一行动:** 基于本方���，启动最小可行工程：`mvn archetype:generate` + `pnpm create next-app` + `taro init` + 编写 Flyway DDL 迁移脚本。
