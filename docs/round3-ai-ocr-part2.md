# CTMS/PMS AI/OCR 设计文档 Part 2 - AI智能服务设计

> **版本**: 4.0 | **日期**: 2026-05-11 | **作者**: AI/ML Tech Lead
>
> **技术栈**: Python 3.12 + FastAPI + sentence-transformers + LLM Adapter (OpenAI-compatible / local LLM) + OpenSearch + RabbitMQ + Redis
>
> **核心约束**: Java Spring Boot 后端持有所有主数据状态; AI Service 永远不直接访问主数据库; AI 产出为 candidate 状态等待人工确认

---

## 目录

1. [Knowledge Base Q&A (RAG)](#1-knowledge-base-qa-rag-architecture)
2. [PM/CRA Copilot](#2-pmcra-copilot)
3. [Auto-Reporting](#3-auto-reporting)
4. [Enrollment Prediction](#4-enrollment-prediction)
5. [Risk Scoring](#5-risk-scoring)
6. [Model Version & Prompt Management](#6-model-version--prompt-management)
7. [AI Feedback Loop](#7-ai-feedback-loop)

---

## 系统架构总览: AI Service

### 架构定位 (Architecture Positioning)

AI Service 是一个独立的、无状态的 Python FastAPI 微服务，部署为独立容器/进程。它不与CTMS主数据库(PostgreSQL)建立任何连接，所有数据交互通过以下两条途径完成:

**Path A: Java Backend -> RabbitMQ -> AI Service (异步任务)**

```
Java Backend (Spring Boot)
  |
  +--> RabbitMQ Exchange: ai.task.exchange (topic)
         |
         +--> Queue: ai.task.rag.query          (routing_key: task.rag.query)
         +--> Queue: ai.task.copilot.request    (routing_key: task.copilot.request)
         +--> Queue: ai.task.report.generate    (routing_key: task.report.generate)
         +--> Queue: ai.task.enrollment.predict (routing_key: task.enrollment.predict)
         +--> Queue: ai.task.risk.score         (routing_key: task.risk.score)
         |
         v
       AI Service (FastAPI Consumer, 独立容器)
         |
         v
       RabbitMQ Exchange: ai.result.exchange (direct)
         |
         +--> Queue: ai.result.rag.response        (routing_key: result.rag.response)
         +--> Queue: ai.result.copilot.response    (routing_key: result.copilot.response)
         +--> Queue: ai.result.report.draft        (routing_key: result.report.draft)
         +--> Queue: ai.result.enrollment.prediction (routing_key: result.enrollment.prediction)
         +--> Queue: ai.result.risk.heatmap        (routing_key: result.risk.heatmap)
         |
         v
       Java Backend (Consumer) -> persist to PostgreSQL
```

**Path B: Java Backend -> REST API -> AI Service (同步查询)**

```
Frontend (React/Vue) -> Java Backend -> HTTP REST -> AI Service FastAPI -> 同步返回
                                          (timeout: 30s 同步, 300s 异步)
```
### 数据隔离原则 (Data Isolation)

| 原则 | 实现方式 | 验证方式 |
|------|----------|----------|
| AI Service 无数据库访问 | 不持有任何 JDBC/MyBatis 连接配置，Dockerfile 中不注入 DB 环境变量 | 安全审计: 端口扫描 + 进程检查 |
| 数据由 Java Backend 打包 | 在 RabbitMQ 消息中，Java 端将查询所需的上下文数据 (chunks, study metadata, AE records, site info) 序列化后放入消息体 | 代码审查: Message DTO 不允许包含 DB connection string |
| AI Service 不存储业务数据 | 仅 Redis 缓存 embedding/搜索结果和会话上下文; 业务结果通过 RabbitMQ 返回 | Redis 审计: key pattern 检查 |
| 文件访问通过 MinIO | Java 端对待分析文件生成 Presigned URL (有效期 30min)，AI Service 通过 URL 只读访问 | 日志审计: MinIO access log |
| PII/PHI 脱敏 | 传给 AI Service 的数据预先经过去标识化处理(replace study_subject_id with masked_id) | 数据质量扫描: PII regex check |

### 技术组件选型 (Component Selection)

| 组件 | 选型 | 版本 | 核心理由 | 备选方案 |
|------|------|------|----------|----------|
| Web框架 | FastAPI | >= 0.115.0 | 异步原生，OpenAPI自动生成，Pydantic验证，与 httpx/OpenSearch client 协同良好 | Flask + gunicorn |
| LLM Orchestration | langchain-core + custom adapter | >= 0.3.x | 仅使用核心抽象(Document, PromptTemplate, Runnable)，不使用 langchain-community 重量级封装 | LlamaIndex, 自研 pipeline |
| 向量模型 (Dense) | BAAI/bge-large-zh-v1.5 | latest | C-MTEB 中文榜单综合第1，768维，max_seq_length=512 tokens，支持中英混合 | text2vec-large-chinese, m3e-large |
| 稀疏检索 (Sparse) | BAAI/bge-m3 (lexical weights) | latest | 支持 Sparse+Dense Hybrid 检索，弥补关键词匹配场景精度 | BM25 alone |
| Cross-Encoder Reranker | BAAI/bge-reranker-v2-m3 | latest | 多语言，Cross-encoder 精度远超 Bi-encoder，P@1提升 > 15% | bge-reranker-large, Cohere Rerank API |
| LLM 默认 (云端) | deepseek-v4-pro | latest | OpenAI-compatible API, 128K context, 中英双语高质量，性价比高 | GPT-4o, Claude Opus 4 |
| LLM 本地备选 | Qwen3-72B-Instruct (vLLM部署) | latest | 本地部署，无数据外泄风险，用于处理 PII/PHI 场景 | Qwen2.5-72B, Llama-3.3-70B |
| 搜索引擎 | OpenSearch | >= 2.17 | 内置向量搜索(HNSW k-NN) + BM25全文搜索，免托管ES，Apache 2.0 许可证 | Elasticsearch 8.x |
| 消息队列 | RabbitMQ | >= 3.13 | 与后端版本一致，Stream Plugin 提供持久化+重放能力，减少运维复杂度 | Kafka |
| 缓存 | Redis | >= 7.2 | Embedding缓存、搜索结果缓存、会话上下文缓存、限流计数器 | -- |
| 指标监控 | Prometheus + Grafana | - | FastAPI 内置 metrics endpoint，Prometheus scrape 指标 | -- |

### AI Service 内部模块划分

```
AI Service (FastAPI)
|
+-- api/                          # REST API 路由层
|   +-- routes/
|       +-- rag_router.py         # /api/v1/ai/rag/*
|       +-- copilot_router.py     # /api/v1/ai/copilot/*
|       +-- report_router.py      # /api/v1/ai/reports/*
|       +-- prediction_router.py  # /api/v1/ai/predictions/*
|       +-- risk_router.py        # /api/v1/ai/risk/*
|       +-- model_router.py       # /api/v1/ai/model-versions/*
|       +-- health_router.py      # /health, /ready
|
+-- services/                     # 业务逻辑层
|   +-- rag_service.py            # RAG 检索+生成编排
|   +-- copilot_service.py        # Copilot 功能编排
|   +-- report_service.py         # 报告生成编排
|   +-- prediction_service.py     # 入组预测模型
|   +-- risk_service.py           # 风险评分模型
|   +-- feedback_service.py       # 反馈收集与处理
|
+-- core/                         # 核心基础设施
|   +-- embedding.py              # Embedding 模型管理 (bge, sparse)
|   +-- llm_adapter.py            # LLM 适配器 (OpenAI-compatible)
|   +-- search.py                 # OpenSearch 客户端封装
|   +-- reranker.py               # Cross-encoder 重排序
|   +-- chunker.py                # 文档分块策略
|   +-- citation.py               # 引用生成与溯源
|   +-- rabbitmq.py               # RabbitMQ 消费者/生产者
|   +-- redis_client.py           # Redis 缓存客户端
|   +-- auth.py                   # JWT 验证 (与 Java 共享 signing key)
|   +-- audit.py                  # AI 产出台账记录
|   +-- model_registry.py         # 模型版本注册表
|   +-- prompt_registry.py        # Prompt 版本注册表
|
+-- models/                       # Pydantic 数据模型
|   +-- request.py                # 请求 DTO
|   +-- response.py               # 响应 DTO
|   +-- messaging.py              # RabbitMQ 消息体
|   +-- db.py                     # (预留)未来知识库元数据模型
|
+-- config/
    +-- settings.py               # 配置管理 (pydantic-settings)
    +-- prompts/                  # Prompt 模板文件 (YAML)
        +-- rag_prompts.yaml
        +-- copilot_prompts.yaml
        +-- report_prompts.yaml
        +-- safety_prompts.yaml
```

### AI 产出台账模型 (AI Output Ledger)

每一次 AI 产出都必须记录以下元数据，用于审计、追溯和模型性能分析:

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| output_id | UUID | Y | AI 产出唯一标识 |
| task_type | Enum | Y | RAG_QUERY / COPILOT_SUMMARY / REPORT_DRAFT / ENROLLMENT_PREDICTION / RISK_SCORE / MEDICAL_REVIEW / SAFETY_COMMENTARY |
| model_name | String | Y | 模型名称，如 deepseek-v4-pro / qwen3-72b |
| model_version | String | Y | 模型版本号，如 2026-04-15 |
| prompt_name | String | Y | Prompt 模板名称 |
| prompt_version | String | Y | Prompt 版本 hash (SHA-256 前 12 位) |
| prompt_full_hash | String | Y | Prompt 完整 SHA-256 hash |
| confidence_score | Float | Y | 置信度评分 0.0-1.0 |
| references | JSONB | N | 引用来源列表 [{doc_name, version, section, paragraph, chunk_id}] |
| input_summary | Text | Y | 输入摘要 (脱敏后，用于调试) |
| processing_time_ms | Integer | Y | 处理耗时 (毫秒) |
| token_count_input | Integer | Y | 输入 token 数量 |
| token_count_output | Integer | Y | 输出 token 数量 |
| retry_count | Integer | N | 重试次数 |
| error_message | Text | N | 错误信息 |
| status | Enum | Y | CANDIDATE / CONFIRMED / REJECTED / SUPERSEDED |
| confirmed_by | String | N | 确认人 user_id |
| confirmed_at | Timestamp | N | 确认时间 |
| rejection_reason | String | N | 驳回原因 |
| rejection_category | String | N | 驳回分类: INACCURATE / INCOMPLETE / HALLUCINATION / IRRELEVANT / FORMAT_ERROR / OTHER |
| superseded_by | UUID | N | 被哪个产出取代 |
| created_at | Timestamp | Y | 创建时间 |
| study_id | Long | N | 关联试验ID |
| site_id | Long | N | 关联中心ID |

**索引设计** (在 Java 后端 PostgreSQL):
- idx_ai_output_study ON (study_id, task_type, created_at DESC)
- idx_ai_output_model ON (model_name, model_version, created_at DESC)
- idx_ai_output_prompt ON (prompt_full_hash, created_at DESC)
- idx_ai_output_status ON (status, created_at DESC)
- idx_ai_output_confidence ON (confidence_score) WHERE status = 'REJECTED'

---

## 1. Knowledge Base Q&A (RAG Architecture)

### 1.1 概述

知识库问答系统为临床试验团队提供基于项目文档的智能问答能力。系统采用 RAG (Retrieval-Augmented Generation) 架构，确保回答基于真实文档、可追溯出处，避免 LLM 幻觉(hallucination)。

**设计目标**:
- 回答准确率 >= 90% (基于人工评审)
- 引用精确到 Section/Paragraph 级别
- 平均响应时间 < 5s (P95)
- 支持中英文混合查询
- 权限感知: 不同角色可检索的文档范围不同

### 1.2 知识来源与索引策略 (Knowledge Sources)

| 序号 | 知识源 | 文档类型 | 更新频率 | 索引策略 | 权限范围 |
|------|--------|----------|----------|----------|----------|
| 1 | 临床试验方案 (Protocol) | PDF/DOCX | 版本发布时 | Full re-index | PM, CRA, CRC, PI, DS |
| 2 | 标准操作规程 (SOP) | PDF/DOCX | 变更时 | Incremental | 全体员工 |
| 3 | 研究者手册 (IB) | PDF | 年度/安全更新 | Full re-index | PM, CRA, CRC, PI, DS |
| 4 | 药房手册 (Pharmacy Manual) | PDF | 版本发布时 | Full re-index | CRC, Pharmacist |
| 5 | 实验室手册 (Lab Manual) | PDF | 版本发布时 | Full re-index | CRC, Lab Staff |
| 6 | 患者教育材料 (Patient Education) | PDF | 变更时 | Incremental | CRC, Patient (脱敏) |
| 7 | GCP 指南 (ICH E6 R2/R3) | PDF/Web | 按官方发布 | Manual trigger | 全体员工 |
| 8 | 监管递交指南 (Regulatory Guide) | PDF | 按官方发布 | Manual trigger | PM, RA |
| 9 | 历史 Query 与回复 (Query History) | JSON (结构化) | 实时 | Direct index (无需chunking) | PM, CRA, CRC, DM |
| 10 | 历史 Audit Trail 记录 | JSON (结构化) | 每日 | Incremental | PM, QA, DM |

### 1.3 文档处理流水线 (Document Processing Pipeline)

```
文档摄入 (Document Ingestion)
  |
  +--> Step 1: 格式解析 (Document Parser)
  |     |
  |     +-- PDF  : PyMuPDF (fitz) 提取文本 + 表格 + 结构信息
  |     +-- DOCX : python-docx 提取文本 + 样式 (标题层级)
  |     +-- HTML : BeautifulSoup + html2text
  |     +-- JSON : 直接映射为结构化 chunk
  |     +-- TXT  : 直接读取
  |
  +--> Step 2: 文档结构化 (Document Structure Analysis)
  |     |
  |     +-- 识别标题层级 (Heading 1-6)
  |     +-- 识别表格 (Table detection)
  |     +-- 识别图片标题 (Figure Caption)
  |     +-- 生成章节路径 (Section Path): e.g., 3.1.2 -> 3. Inclusion Criteria -> 3.1 Disease -> 3.1.2 Staging
  |     +-- 提取 metadata: {doc_id, doc_name, doc_version, doc_type, page_number, section_path}
  |
  +--> Step 3: 智能分块 (Smart Chunking)
  |     |
  |     +-- (详见 1.4 文档分块策略)
  |
  +--> Step 4: 向量化 (Embedding Generation)
  |     |
  |     +-- Dense Embedding: BAAI/bge-large-zh-v1.5 -> 768-dim vector
  |     +-- Sparse Embedding: BAAI/bge-m3 (lexical weights) -> term-weight pairs
  |     +-- 批量处理: batch_size=32, device=cuda:0
  |     +-- 缓存策略: chunk_text SHA-256 -> embedding 缓存 (Redis)
  |
  +--> Step 5: 索引写入 (Index Writing)
  |     |
  |     +-- OpenSearch Index: {env}-rag-knowledge-v{index_version}
  |     +-- 索引映射: {chunk_id, doc_id, chunk_text, dense_vector(768), sparse_vector, metadata}
  |     +-- 索引别名: {env}-rag-knowledge -> 指向最新版本索引
  |     +-- 索引操作: 新建索引 -> 写入 -> 切换别名 -> 删除旧索引 (零停机)
  |
  +--> Step 6: 质量校验 (Quality Validation)
        |
        +-- 抽样校验: 从每个文档随机抽取 5 个 chunks
        +-- 验证: chunk_id 唯一性、chunk_text 非空、embedding 维度正确
        +-- 告警: 任何文档 missing_chunks > 10% 或 avg_chunk_len < 50 chars 触发告警
```

### 1.4 文档分块策略 (Document Chunking Strategy)

分块策略是 RAG 检索质量的决定性因素。针对不同类型文档采用不同策略:

#### 1.4.1 结构化文档 (Protocol, IB, Manual)

```
策略: Section-aware Recursive Character Split
chunk_size:  1000 characters
chunk_overlap: 200 characters
separators: ["\n\n", "\n", "。", ".", " "]

处理流程:
1. 先按 Heading 层级建立 section tree
2. 每个 Section 独立分块 (不跨 section 合并)
3. 每块自动附加 section_path metadata
4. 若某 section 文本不足 1000 chars，则不切分，整体作为 1 chunk
5. 表格内容: 转为 Markdown Table 格式后作为独立 chunk

示例:
原文档 Section 3.1.2 (包含 2500 chars):
  Chunk 1: [chars 0-1000]  section_path: "3 -> 3.1 -> 3.1.2"
  Chunk 2: [chars 800-1800] section_path: "3 -> 3.1 -> 3.1.2"
  Chunk 3: [chars 1500-2500] section_path: "3 -> 3.1 -> 3.1.2"
```

#### 1.4.2 GCP 指南文档

```
策略: Semantic-aware Split (Sentence Boundary)
chunk_size:  800 characters (指南文本通常短句多)
chunk_overlap: 150 characters
separators: ["\n\n", ". ", "\n", " "]
特殊处理: 保留原 GCP Section 编号 (如 ICH E6 R2 5.18.3)
```

#### 1.4.3 结构化 JSON 数据 (Query History, Audit Trail)

```
策略: Entity-based Chunking
- 每条 Query 为一个 chunk
- chunk_text = "Question: {query_text}\nAnswer: {response_text}\nCategory: {category}\nResolution: {resolution}"
- metadata 保留: query_id, study_id, site_id, category, status, created_date, resolved_date
- 无需 overlap (实体独立)
```

#### 1.4.4 分块参数汇总

| 文档类型 | 分块策略 | chunk_size | overlap | 平均 chunks/页 |
|----------|----------|------------|---------|----------------|
| Protocol / IB / Manual | Section-aware Recursive | 1000 chars | 200 chars | 3-4 |
| GCP / Regulatory Guide | Semantic Sentence-boundary | 800 chars | 150 chars | 4-5 |
| Patient Education | Recursive Character | 600 chars | 100 chars | 2-3 |
| JSON Structured | Entity-based | N/A | 0 | 1 per entity |
| SOP | Section-aware Recursive | 800 chars | 150 chars | 3-4 |

### 1.5 Embedding 模型选择与推理配置

#### 1.5.1 模型对比与选型

| 模型 | 维度 | 最大长度 | C-MTEB 排名 | 推理速度 (V100) | 内存占用 | 选型结论 |
|------|------|----------|-------------|-----------------|----------|----------|
| BAAI/bge-large-zh-v1.5 | 768 | 512 tokens | 综合第1 | ~350 texts/s | ~1.3 GB | **主选** |
| BAAI/bge-m3 (Dense) | 1024 | 8192 tokens | 综合第2 | ~200 texts/s | ~2.2 GB | 长文本备选 |
| text2vec-large-chinese | 1024 | 512 tokens | 前10 | ~280 texts/s | ~1.5 GB | -- |
| m3e-large | 1024 | 512 tokens | 前15 | ~300 texts/s | ~1.2 GB | -- |
| BAAI/bge-m3 (Sparse) | N/A (lexical) | 8192 tokens | N/A | ~500 texts/s | ~0.5 GB | **Sparse 主选** |

**选型理由**: bge-large-zh-v1.5 在 C-MTEB 中文基准中综合排名第一，768维在精度与效率间取得良好平衡。512 tokens 对于 1000-char chunks 完全够用。

#### 1.5.2 Embedding 推理配置

```yaml
# config/embedding.yaml
embedding:
  dense:
    model_name: "BAAI/bge-large-zh-v1.5"
    device: "cuda:0"  # or "cpu" for fallback
    batch_size: 32
    normalize: true    # L2 normalize for cosine similarity
    max_seq_length: 512
    pooling: "cls"    # [CLS] token pooling
    cache:
      enabled: true
      redis_ttl: 86400  # 24 hours
      key_prefix: "emb:dense:"
  
  sparse:
    model_name: "BAAI/bge-m3"
    device: "cuda:0"
    batch_size: 64
    mode: "lexical"     # 仅提取 lexical weights
    cache:
      enabled: true
      redis_ttl: 86400
      key_prefix: "emb:sparse:"
```

#### 1.5.3 Embedding 生成代码框架

```python
# core/embedding.py
from sentence_transformers import SentenceTransformer
from typing import List
import hashlib
import json

class EmbeddingService:
    def __init__(self, config):
        self.dense_model = SentenceTransformer(config.dense.model_name)
        self.sparse_model = SentenceTransformer(config.sparse.model_name)
        self.redis = Redis.from_url(config.redis_url)

    async def embed_dense(self, texts: List[str]) -> List[List[float]]:
        # Check cache first
        cached, uncached_indices, uncached_texts = await self._check_dense_cache(texts)
        
        if uncached_texts:
            vectors = self.dense_model.encode(
                uncached_texts,
                batch_size=self.config.dense.batch_size,
                normalize_embeddings=True,
                show_progress_bar=False
            )
            await self._cache_dense(uncached_texts, vectors)

        # Reconstruct full results from cache + new
        return self._reconstruct_dense(texts, cached, uncached_indices, vectors)
    
    async def embed_sparse(self, texts: List[str]) -> List[Dict[str, float]]:
        # Similar caching logic...
        pass
```

### 1.6 混合检索架构 (Hybrid Search)

#### 1.6.1 检索流程总览

```
User Query: "方案中III期非小细胞肺癌的入组标准是什么?"
  |
  +--> Step 1: Query Embedding (Dense + Sparse)
  |     |
  |     +-- Dense: embed_dense(query) -> float[768]
  |     +-- Sparse: embed_sparse(query) -> {term: weight}
  |
  +--> Step 2: OpenSearch Hybrid Search
  |     |
  |     +-- Dense k-NN: HNSW search, k=50, vector_field=dense_vector
  |     +-- BM25 Text: match on chunk_text, k=50
  |     +-- Sparse: Sparse Vector similarity, k=50
  |     +-- Merge: Reciprocal Rank Fusion (RRF)
  |     +-- Top-N: select top 30 after RRF merge
  |     +-- 权限过滤: filter by doc_type accessibility for user role
  |
  +--> Step 3: Cross-Encoder Reranking (详见 1.7)
  |     |
  |     +-- Rerank top 30 -> top 10
  |
  +--> Step 4: Context Assembly
  |     |
  |     +-- 取 top-K chunks (可配置，默认 K=8)
  |     +-- 按 doc_id + section_path 排序 (保持逻辑顺序)
  |     +-- 组装 context: [chunk_1]\n\n[chunk_2]\n\n...
  |     +-- 检查 context 总长度不超过 LLM context window 的 60%
  |
  +--> Step 5: LLM Generation (详见 1.8)
  |
  +--> Step 6: Citation Enrichment (详见 1.9)
  |
  +--> Final Response with citations
```

#### 1.6.2 OpenSearch Hybrid Query DSL

```json
POST /{index}/_search
{
  "size": 50,
  "query": {
    "hybrid": {
      "queries": [
        {
          "bool": {
            "should": [
              {"match": {"chunk_text": {"query": "非小细胞肺癌 入组标准", "boost": 1.0}}},
              {"match": {"section_path": {"query": "inclusion criteria", "boost": 2.0}}}
            ],
            "filter": [
              {"terms": {"doc_type": ["protocol", "ib"]}},
              {"term": {"study_id": "STUDY-2026-001"}}
            ]
          }
        },
        {
          "knn": {
            "dense_vector": {
              "vector": [0.012, -0.034, ...],
              "k": 50
            }
          }
        },
        {
          "neural_sparse": {
            "sparse_vector": {
              "query_tokens": {"非小细胞肺癌": 0.8, "入组": 0.6, "标准": 0.4},
              "model_id": "bge-m3-sparse"
            }
          }
        }
      ]
    }
  },
  "_source": ["chunk_id", "doc_id", "doc_name", "doc_version", "section_path", "chunk_text", "page_number"]
}
```

#### 1.6.3 RRF (Reciprocal Rank Fusion) 权重配置

| 检索分支 | 权重 | RRF rank_constant | 说明 |
|----------|------|-------------------|------|
| Dense KNN | 1.0 | 60 | 语义匹配，主力 |
| BM25 Text | 0.6 | 60 | 关键词匹配，补充召回 |
| Sparse Vector | 0.4 | 60 | 稀疏语义，查漏补缺 |

**RRF 公式**: `score(d) = SUM(w_i / (k + rank_i(d)))`
  where w_i = 分支权重, k = 60 (常量), rank_i(d) = 文档 d 在分支 i 中的排名

### 1.7 Cross-Encoder 重排序 (Re-ranking)

#### 1.7.1 为什么需要 Reranker

Bi-encoder (Dense Embedding) 将 query 和 document 分别编码为向量，通过余弦相似度比较。这种方式计算快，但交互浅，可能漏掉高度相关但语义角度不同的文档。

Cross-encoder 将 (query, document) 对同时输入模型，进行深层交叉注意力计算，精度显著提升。但速度慢，因此仅对初步检索的 Top-N 结果进行重排序。

| 阶段 | 模型 | 候选集 | 延迟 | 目的 |
|------|------|--------|------|------|
| 召回 (Retrieval) | Bi-encoder (bge-large-zh) | 全文库 (10^4-10^6 chunks) | ~200ms | 高召回率 |
| 粗排 (Merge) | RRF Fusion | 150 candidates | ~10ms | 融合多路 |
| 精排 (Rerank) | Cross-encoder (bge-reranker-v2-m3) | Top 30 | ~500ms | 高精度 |
| 返回 (Return) | -- | Top 10 | -- | 最终结果 |

#### 1.7.2 Reranking 实现

```python
# core/reranker.py
from transformers import AutoModelForSequenceClassification, AutoTokenizer
import torch

class RerankerService:
    def __init__(self, model_name="BAAI/bge-reranker-v2-m3"):
        self.tokenizer = AutoTokenizer.from_pretrained(model_name)
        self.model = AutoModelForSequenceClassification.from_pretrained(model_name)
        self.model.eval()
        if torch.cuda.is_available():
            self.model = self.model.cuda()

    def rerank(self, query: str, documents: List[SearchResult], top_k: int = 10) -> List[SearchResult]:
        if len(documents) <= top_k:
            return documents

        pairs = [[query, doc.chunk_text] for doc in documents]
        
        with torch.no_grad():
            inputs = self.tokenizer(pairs, padding=True, truncation=True, 
                                   max_length=512, return_tensors="pt")
            if torch.cuda.is_available():
                inputs = {k: v.cuda() for k, v in inputs.items()}
            scores = self.model(**inputs, return_dict=True).logits.view(-1).cpu().float()
        
        # Sort by score descending, keep top_k
        for i, doc in enumerate(documents):
            doc.rerank_score = float(scores[i])
        
        documents.sort(key=lambda x: x.rerank_score, reverse=True)
        return documents[:top_k]
```

#### 1.7.3 性能预算

| 指标 | 目标值 | 备注 |
|------|--------|------|
| Reranker P99 延迟 | < 800ms | 30 candidates on GPU |
| Reranker 精度提升 (P@5) | +15% - +25% | vs. pure RRF |
| Reranker 精度提升 (MRR) | +10% - +18% | vs. pure RRF |

### 1.8 引用格式与溯源 (Citation Format)

#### 1.8.1 引用格式规范

每条 AI 回答中的事实性陈述必须附带引用。引用格式:

```
{doc_name} v{version}, Section {s}, Paragraph {p}

示例:
[1] 非小细胞肺癌III期临床研究方案 v3.0, Section 4.1, Paragraph 3
[2] 中心实验室手册 v2.1, Section 3.4.2, Table 2
[3] ICH E6(R2) GCP Guidelines, Section 5.18.3, Paragraph 1
```

#### 1.8.2 引用数据结构

```json
{
  "citation_id": 1,
  "doc_name": "非小细胞肺癌III期临床研究方案",
  "doc_id": "DOC-PROTO-2026-001",
  "doc_version": "3.0",
  "section_path": "4 -> 4.1",
  "section_name": "Inclusion Criteria",
  "paragraph": 3,
  "chunk_id": "chunk-proto-001-045",
  "page_number": 28,
  "relevance_score": 0.92,
  "highlight_text": "...年龄 >= 18岁且 <= 75岁，经组织学或细胞学确诊的IIIB-IV期非小细胞肺癌..."
}
```

#### 1.8.3 引用验证机制

LLM 在生成答案时可能编造引用。系统的后处理验证步骤:

```
1. 提取 LLM 输出中的所有 citation markers: [1], [2], ...
2. 检查每个 marker 是否在返回的 references 列表中存在
3. 检查引用中的 doc_name + section_path 是否与检索到的 chunk metadata 一致
4. 任何不一致 -> 标记为 unverified_citation，在 response 中标注 warning
5. 缺失的引用 -> 标记为 unsupported_claim
```

### 1.9 多轮对话上下文管理 (Multi-turn Conversation)

#### 1.9.1 会话模型

```json
{
  "conversation_id": "conv-uuid-abc-123",
  "user_id": "user-001",
  "study_id": "STUDY-2026-001",
  "created_at": "2026-05-11T10:30:00Z",
  "updated_at": "2026-05-11T10:35:00Z",
  "status": "ACTIVE",
  "messages": [
    {
      "role": "user",
      "content": "方案中III期非小细胞肺癌的入组标准是什么?",
      "timestamp": "2026-05-11T10:30:00Z"
    },
    {
      "role": "assistant",
      "content": "根据方案 v3.0 Section 4.1，入组标准包括...",
      "references": [{"citation_id": 1, ...}],
      "confidence": 0.93,
      "timestamp": "2026-05-11T10:30:03Z"
    },
    {
      "role": "user",
      "content": "那排除标准呢?",
      "timestamp": "2026-05-11T10:35:00Z"
    }
  ],
  "context_window": {
    "max_messages": 20,
    "max_tokens": 8000,
    "current_tokens": 1520
  }
}
```

#### 1.9.2 上下文管理策略

| 策略 | 描述 | 配置 |
|------|------|------|
| 滑动窗口 (Sliding Window) | 保留最近 N 条消息 | N=20 条消息 |
| Token 预算 (Token Budget) | 上下文总 token 数不超过限制 | max_context_tokens = 8000 (约为 model max 的 6%) |
| 查询改写 (Query Rewriting) | 将 follow-up question 改写为独立查询 | e.g., "那排除标准呢?" -> "方案中III期非小细胞肺癌的排除标准是什么?" |
| 对话摘要 (Conversation Summarization) | 超出窗口时，用 LLM 压缩历史为摘要 | 触发条件: messages > 15 or tokens > 6000 |
| 主题切换检测 (Topic Switch Detection) | 检测到话题改变时，重置检索上下文 | 基于最后两条消息的语义相似度 < 0.3 |

#### 1.9.3 查询改写实现

```python
async def rewrite_query(current_query: str, conversation_history: List[Message]) -> str:
    # 检查是否为 follow-up (含指代词、省略)
    follow_up_patterns = ["那", "它", "这个", "上面", "刚才", "之前"]
    is_follow_up = any(p in current_query for p in follow_up_patterns) or len(current_query) < 15
    
    if not is_follow_up:
        return current_query  # 独立查询，直接返回
    
    # 使用 LLM 进行查询改写
    prompt = f"""Given the conversation history and the current query, 
    rewrite the query to be standalone and self-contained.
    History: {format_history(conversation_history[-3:])}
    Current query: {current_query}
    Rewritten query:"""
    
    rewritten = await llm.generate(prompt, max_tokens=100)
    return rewritten.strip()
```

### 1.10 RAG Response Schema

#### 1.10.1 完整响应结构

```json
{
  "conversation_id": "conv-uuid-abc-123",
  "query_id": "qry-uuid-def-456",
  "query": "...",
  "rewritten_query": null,
  "answer_text": "...",
  "citations": [
    {
      "citation_id": 1,
      "doc_name": "...",
      "doc_version": "3.0",
      "section_path": "4 -> 4.1",
      "section_name": "Inclusion Criteria",
      "paragraph": 2,
      "page_number": 28,
      "relevance_score": 0.92,
      "highlight_text": "..."
    }
  ],
  "confidence_score": 0.93,
  "model_name": "deepseek-v4-pro",
  "model_version": "2026-04-15",
  "prompt_name": "rag-protocol-qa-v3",
  "prompt_version": "a1b2c3d4e5f6",
  "processing_time_ms": 2340,
  "token_usage": {
    "input_tokens": 2840,
    "output_tokens": 320
  },
  "warnings": [],
  "suggested_followups": ["...", "...", "..."],
  "created_at": "2026-05-11T10:30:03.000+08:00"
}
```

#### 1.10.2 响应字段说明

| 字段 | 类型 | 说明 |
|------|------|------|
| conversation_id | UUID | 会话ID (多轮对话共享) |
| query_id | UUID | 本次查询的唯一标识 |
| query | String | 用户原始查询文本 |
| rewritten_query | String/null | 查询改写后的文本 (null 表示未改写) |
| answer_text | String | Markdown 格式的回答，内嵌引用标记 [n] |
| citations | Array | 引用列表，回答中的 [n] 对应此数组索引 |
| confidence_score | Float | 置信度评分 0.0-1.0 |
| model_name | String | 使用的 LLM 模型名称 |
| model_version | String | 模型版本 |
| prompt_name | String | 使用的 Prompt 模板名称 |
| prompt_version | String | Prompt 版本 hash (SHA-256 前 12 位) |
| processing_time_ms | Integer | 端到端处理时间 (毫秒) |
| token_usage | Object | Token 使用详情 |
| warnings | Array | 警告信息 |
| suggested_followups | Array | AI 建议的后续问题 (最多3个) |
| created_at | Timestamp | 创建时间 |

### 1.11 Knowledge QA 应用场景 (Use Cases)

#### 1.11.1 方案问题回答

| 示例问题 | 期望的 AI 行为 |
|----------|---------------|
| "筛选期需要做哪些实验室检查?" | 检索 Section 5 (Study Procedures)，列出所有筛选期检查项 + 引用 |
| "给药后72小时内出现3级皮疹怎么处理?" | 检索 Section 7 (Dose Modification) + Section 8 (AE Management)，给出剂量调整和AE处理指南 |
| "允许的合并用药有哪些?" | 检索 Section 6 (Concomitant Medications)，列出禁止和允许的合并用药清单 |
| "肿瘤评估的时间窗是多久?" | 检索 Section 5.3 (Tumor Assessment)，说明每个评估时间点的窗口期 |

#### 1.11.2 SOP 查询

| 示例问题 | 期望的 AI 行为 |
|----------|---------------|
| "SAE 报告必须在几小时内提交?" | 检索 SAE 报告 SOP，返回24小时时限 + 提交流程 |
| "知情同意的版本更新后要怎么做?" | 检索 ICF 管理 SOP，返回重新签署流程 |
| "IP 接收和存储的温度要求是什么?" | 检索 IP Management SOP，返回温度范围 + 记录要求 |

#### 1.11.3 安全性报告时间线查询

| 示例问题 | 期望的 AI 行为 |
|----------|---------------|
| "SUSAR 的递交时限是多少?" | 检索 GCP + 当地法规，返回 fatal/life-threatening 7天，其他15天 |
| "DSUR 每年什么时候提交?" | 检索监管指南，返回 DSUR 提交周期和内容要求 |
| "IND Safety Report 和 SUSAR 的区别?" | 检索 FDA 21 CFR 312.32 和相关 SOP，说明两者适用范围 |

#### 1.11.4 入排标准查询

| 示例问题 | 期望的 AI 行为 |
|----------|---------------|
| "列出所有排除标准" | 检索 Section 4.2，列出全部排除标准并按系统归类 |
| "肾功能不全的患者可以入组吗?" | 检索入排标准中关于肾功能的条目，说明 CrCl 阈值 |
| "既往接受过免疫治疗的患者能否入组?" | 检索 prior therapy 相关排除标准 |

### 1.12 RAG API 端点设计

#### 1.12.1 REST API (Java Backend 调用 AI Service)

**POST /api/v1/ai/rag/query** - 知识库问答查询

| 参数 | 位置 | 类型 | 必填 | 说明 |
|------|------|------|------|------|
| Idempotency-Key | Header | UUID | Y | 幂等键 |
| query | Body | String | Y | 用户查询文本 (max 1000 chars) |
| study_id | Body | Long | Y | 试验ID |
| conversation_id | Body | UUID | N | 会话ID (多轮对话，首次不传则创建新会话) |
| document_filter.doc_types | Body | String[] | N | 限定文档类型: protocol, sop, ib, pharmacy_manual, lab_manual, patient_edu, gcp, regulatory_guide |
| document_filter.doc_ids | Body | String[] | N | 限定特定文档ID |
| max_chunks | Body | Integer | N | 最大检索chunk数 (default=8, min=3, max=20) |
| user_role | Body | String | N | 用户角色 (PM/CRA/CRC/PI/DS/DM) |

**GET /api/v1/ai/rag/conversations/{id}** - 获取会话历史

| 参数 | 位置 | 类型 | 说明 |
|------|------|------|------|
| id | Path | UUID | 会话ID |
| page | Query | Integer | 页码 (default=1) |
| size | Query | Integer | 每页条数 (default=20, max=50) |

**DELETE /api/v1/ai/rag/conversations/{id}** - 删除会话

#### 1.12.2 RabbitMQ 消息格式

**请求消息 (Java -> AI Service)**:

```json
{
  "message_id": "msg-uuid-789",
  "task_type": "RAG_QUERY",
  "payload": {
    "query": "方案中入组标准是什么?",
    "study_id": 1001,
    "conversation_id": "conv-uuid-abc-123",
    "user_id": "user-001",
    "user_role": "CRA",
    "document_filter": {"doc_types": ["protocol"]},
    "max_chunks": 8
  },
  "timestamp": "2026-05-11T10:30:00.000+08:00",
  "trace_id": "trace-abc-123"
}
```

**响应消息 (AI Service -> Java)**:

```json
{
  "message_id": "msg-uuid-789",
  "correlation_id": "msg-uuid-789",
  "task_type": "RAG_QUERY",
  "status": "SUCCESS",
  "payload": {
    "conversation_id": "conv-uuid-abc-123",
    "query_id": "qry-uuid-def-456",
    "answer_text": "...",
    "citations": [],
    "confidence_score": 0.93,
    "model_name": "deepseek-v4-pro",
    "model_version": "2026-04-15",
    "prompt_name": "rag-protocol-qa-v3",
    "prompt_version": "a1b2c3d4e5f6",
    "processing_time_ms": 2340,
    "token_usage": {},
    "warnings": []
  },
  "timestamp": "2026-05-11T10:30:03.000+08:00"
}
```

### 1.13 RAG Prompt 模板设计

#### 1.13.1 主 Prompt (rag-protocol-qa-v3)

**System Prompt**:

```
You are a Clinical Research Knowledge Assistant. Your role is to answer questions
based STRICTLY on the provided reference documents. Follow these rules:

1. ONLY use information from the provided [References] section. Do NOT use external
   knowledge or training data.
2. If the references do not contain sufficient information to answer the question,
   respond with: Based on the provided documents, I cannot answer this question.
3. Every factual claim MUST be followed by a citation marker [n] referencing the
   corresponding reference number.
4. Format your response in Markdown. Use bullet points, tables, or numbered lists
   where appropriate.
5. If information from multiple references is used, synthesize a coherent answer
   rather than listing references separately.
6. Highlight any important caveats, warnings, or version-specific notes.
7. At the end, suggest up to 3 follow-up questions that might be helpful.

Current context: The user is working on study {study_name}. They have the role of
{user_role} and are authorized to access the provided documents.
```

**User Prompt Template**:

```
## Question
{query}

## References
{references_formatted}

Please answer the question based on the references above.
```

**References Format (per chunk)**:

```
[{n}] Source: {doc_name} v{version}, Section {section_path}
Content: {chunk_text}
```

### 1.14 RAG 性能指标与SLA

| 指标 | 目标 | 测量方法 |
|------|------|----------|
| P50 响应时间 | < 2s | Prometheus histogram: rag_response_time_seconds |
| P95 响应时间 | < 5s | Prometheus histogram: rag_response_time_seconds |
| P99 响应时间 | < 8s | Prometheus histogram: rag_response_time_seconds |
| 检索召回率 (Recall@10) | > 85% | 离线评估: 标注测试集 |
| 回答准确率 (人工评审) | > 90% | 抽样评审: 每周50条 |
| 引用准确率 (citation precision) | > 95% | 人工验证: 引用文本是否真的包含声称信息 |
| 幻觉率 (hallucination rate) | < 5% | 抽样人工评审 |
| 可用率 (Uptime) | 99.9% | Prometheus up metric |

---

## 2. PM/CRA Copilot

### 2.1 概述

PM/CRA Copilot 是一组 AI 驱动的智能助手功能，旨在减轻项目经理(PM)和临床监查员(CRA)的日常工作负担。所有 Copilot 产出均为 candidate 状态，需人工审核确认后方可生效。

**设计原则**:
- AI 辅助决策，不替代专业判断
- 所有产出可追溯、可解释、可驳回
- 基于历史数据 + 最佳实践的模式识别
- 随使用反馈持续改进

### 2.2 Copilot 功能矩阵

| 序号 | 功能 | 用户角色 | 输入 | 输出 | 触发方式 | Human Review |
|------|------|----------|------|------|----------|-------------|
| 1 | Smart Study Summary | PM | study_id, time_period | 结构化研究摘要 | 手动 + 定时 | PM 确认后发布 |
| 2 | Risk Alerts | PM, CRA | study_id (自动) | 风险告警列表 | 定时(每日) | 标记为 acknowledged/dismissed |
| 3 | Query Suggestions | CRA, DM | new_query_text, study_id | 相似历史Query + 建议回复 | 手动(Query创建时) | CRA 选择使用/忽略 |
| 4 | Visit Preparation Checklist | CRA | visit_id | 监查访视准备清单 | 手动(访视前) | CRA 勾选完成 |
| 5 | Monitoring Report Draft | CRA | visit_id, visit_data | 监查报告草稿章节 | 手动(访视后) | CRA 编辑确认后提交 |
| 6 | Action Item Extraction | CRA, PM | report_text | 从报告文本提取Action Items | 手动(报告提交时) | CRA 确认/修改后分配 |

### 2.3 Feature 1: Smart Study Summary (智能研究摘要)

#### 2.3.1 功能描述

根据试验近期活动数据(里程碑、入组、访视、Query、AE、监查)，自动生成研究进展摘要。PM 可以在 Dashboard 查看，也可以导出为 PPT/PDF 用于汇报。

#### 2.3.2 输入数据

| 数据维度 | 数据源 | 时间范围 | 聚合方式 |
|----------|--------|----------|----------|
| 里程碑 (Milestones) | study_milestones 表 | 最近30天 + 未来60天 | 完成/即将到期列表 |
| 入组进度 (Enrollment) | subjects 表 | 按周汇总 | 本周/本月新增，累计，vs 计划对比 |
| 筛选进度 (Screening) | subjects 表 (status=SCREENING) | 按周汇总 | 筛选数、筛选失败数、失败率 |
| 访视完成 (Visits) | visits 表 | 按周汇总 | 计划访视数、实际完成数、超窗率 |
| Query 动态 | queries 表 | 按周汇总 | 新增、已解决、待处理、平均解决时间 |
| AE/SAE 动态 | adverse_events 表 | 按周汇总 | 新增AE、SAE、按严重程度分布 |
| 监查活动 (Monitoring) | monitoring_visits 表 | 最近60天 | 完成/计划访视数、主要发现数 |
| 中心表现 (Site Performance) | sites 表 (聚合) | 按中心 | Top/Bottom 3 中心 |

#### 2.3.3 AI 处理流程

```
输入数据 (Java Backend 从 DB 查询并打包)
  |
  +--> Step 1: 数据格式化 (Data Formatter)
  |     |
  |     +-- 各维度数据转为自然语言描述
  |     +-- 计算关键指标 (enrollment_rate, query_aging, screen_fail_rate)
  |     +-- 与计划/目标对比，生成趋势判断 (on_track/at_risk/behind)
  |     +-- 生成简单统计: 均值、中位数、变化率
  |
  +--> Step 2: LLM Narrative Generation
  |     |
  |     +-- Prompt: copilot-study-summary-v2
  |     +-- 输入: {study_summary_stats, historical_context, comparison_data}
  |     +-- 输出: 叙事性摘要 (narrative text) + 关键亮点 (key_highlights)
  |     +-- 输出格式: 结构化 JSON (便于前端渲染)
  |
  +--> Step 3: Risk Flagging
  |     |
  |     +-- 自动检测以下风险信号:
  |         - enrollment_rate < 80% of plan -> AT_RISK_ENROLLMENT
  |         - screen_fail_rate > 30% -> AT_RISK_SCREEN_FAIL
  |         - query_aging_avg > 15 days -> AT_RISK_QUERY_AGING
  |         - sae_rate_change > +50% vs last period -> AT_RISK_SAE_SPIKE
  |         - visit_window_violation_rate > 10% -> AT_RISK_VISIT_COMPLIANCE
  |
  +--> Step 4: Output Assembly
        |
        +-- 组装: narrative + highlights + risk_flags + charts_data
        +-- 返回给 Java Backend
```

#### 2.3.4 输出示例

```json
{
  "summary_id": "summary-uuid-001",
  "study_id": 1001,
  "study_name": "NSCLC-III期-2026-001",
  "period": {"from": "2026-04-11", "to": "2026-05-11"},
  "generated_at": "2026-05-11T08:00:00Z",
  "narrative": "## 研究进展摘要 (2026/04/11 - 2026/05/11)

在本报告期间，NSCLC-III期研究入组进展良好，共入组 23 例受试者，累计入组 187 例，
完成总计划入组数(300例)的 62.3%。当前入组速率(5.8例/周)略高于计划速率(5.0例/周)，
按当前趋势预计可于 2026年10月完成全部入组。

筛选方面，本期共筛选 35 例，其中 12 例筛选失败，筛选失败率为 34.3%，
较上期(28.1%)有所上升，主要集中在中心 S003(5例失败)，建议关注该中心的筛选质量。

Query 方面，本期新增 47 条 Query，解决 52 条，平均解决时间 8.3 天，处于健康水平。

安全性方面，本期报告 8 例 AE，其中 1 例 SAE(已按规定时限报告)，无 SUSAR。",

  "key_highlights": [
    "入组进度: 187/300 (62.3%)，on track",
    "筛选失败率上升至 34.3%，中心 S003 需关注",
    "Query 平均解决时间 8.3 天，healthy",
    "1 例 SAE 已按时报告，无安全性信号"
  ],
  "risk_flags": [
    {
      "type": "HIGHLIGHT_SCREEN_FAIL",
      "severity": "MEDIUM",
      "message": "中心 S003 筛选失败率 45% (5/11)，超过阈值 30%",
      "site_id": 2003,
      "site_name": "北京肿瘤医院"
    }
  ],
  "charts_data": {
    "enrollment_trend": {"labels": ["W1","W2","W3","W4"], "actual":[5,6,7,5], "plan":[5,5,5,5]},
    "query_status": {"open": 23, "answered": 15, "resolved": 52},
    "site_performance": [
      {"site_name": "北京肿瘤医院", "enrollment": 42, "screen_fail_rate": 28.6},
      {"site_name": "上海中山医院", "enrollment": 38, "screen_fail_rate": 22.1},
      {"site_name": "广州南方医院", "enrollment": 25, "screen_fail_rate": 45.0}
    ]
  },
  "confidence_score": 0.88,
  "model_name": "deepseek-v4-pro",
  "model_version": "2026-04-15",
  "prompt_name": "copilot-study-summary-v2",
  "prompt_version": "c3d4e5f6a7b8"
}
```

#### 2.3.5 人工审核步骤

1. PM 在 Dashboard 查看 AI 生成的摘要草稿 (标记为 DRAFT)
2. PM 编辑 narrative (修正错误、补充上下文)
3. PM 确认/驳回每条 risk_flag
4. PM 点击 Approve -> 摘要状态变为 PUBLISHED
5. 已发布的摘要可通过通知推送或导出为报告

### 2.4 Feature 2: Risk Alerts (主动风险告警)

#### 2.4.1 功能描述

系统每日自动扫描所有活跃试验的运营数据，基于预定义模式 + ML 异常检测，主动识别潜在风险并向相关 PM/CRA 推送告警。

#### 2.4.2 风险检测规则库

| 风险类别 | 检测规则 | 严重程度 | 检测频率 | 告警接收人 |
|----------|----------|----------|----------|------------|
| 入组滞后 (Enrollment Delay) | 实际入组数 < 计划入组数 * 70% 持续 >= 2周 | HIGH | 每周一 | PM, CRA Lead |
| 筛选失败异常 (Screen Fail Spike) | 单中心筛选失败率 > 40% 或周环比增长 > 50% | MEDIUM | 每日 | CRA, PM |
| Query 积压 (Query Backlog) | 待处理 Query > 50 条或平均老化 > 20天 | HIGH | 每日 | DM, CRA |
| 访视超窗 (Visit Window Violation) | 超窗率 > 15% 或 周环比增长 > 30% | MEDIUM | 每日 | CRA, PM |
| SAE 聚集 (SAE Cluster) | 同一中心 2周内 >= 3 例 SAE | HIGH | 每日 | DS, PM, PI |
| SAE 报告延迟 (SAE Reporting Delay) | SAE 未在 24h 内报告 | CRITICAL | 实时 | PM, DS, QA |
| 中心启动延迟 (Site Activation Delay) | 计划启动日期已过 >= 14天 | MEDIUM | 每周 | PM |
| 数据录入延迟 (Data Entry Delay) | CRF 完成时间 > 访视后 5 个工作日 | MEDIUM | 每日 | DM, CRA |
| 药品库存不足 (IP Stock Low) | 预计库存 < 未来 30 天用量 | HIGH | 每周 | PM, Pharmacist |
| 受试者脱落率 (Dropout Rate) | 脱落率 > 15% | HIGH | 每月 | PM, PI |

#### 2.4.3 ML 异常检测

除了基于规则的检测，系统还使用统计方法检测非预期模式:

| 方法 | 适用场景 | 参数 |
|------|----------|------|
| Z-score 异常检测 | 单变量时间序列 (如 weekly enrollment) | z > 2.5 触发告警 |
| Isolation Forest | 多变量异常 (site-level: enrollment + ae + query 联合) | contamination=0.05 |
| Change Point Detection | 趋势突变 (如 SAE rate sudden jump) | PELT algorithm, penalty=10 |
| Prophet 预测残差 | 实际 vs 预测偏差过大 | abs(residual) > 2 * sigma |

#### 2.4.4 告警生命周期

```
DETECTED (AI检测到风险信号)
  |
  +--> DELIVERED (推送至用户 Dashboard + Email/App通知)
        |
        +--> ACKNOWLEDGED (用户已读)
        |     |
        |     +--> RESOLVED (用户确认已处理)
        |     +--> FALSE_POSITIVE (用户标记为误报)
        |
        +--> DISMISSED (用户忽略，需填写原因)
              |
              +--> 若 DISMISSED 后风险再次触发，升级严重程度告警
```

#### 2.4.5 API Schema

**GET /api/v1/ai/copilot/risk-alerts?studyId={id}** - 获取风险告警列表

```json
{
  "code": 200,
  "data": {
    "study_id": 1001,
    "generated_at": "2026-05-11T06:00:00Z",
    "total_alerts": 4,
    "by_severity": {"CRITICAL": 0, "HIGH": 2, "MEDIUM": 2, "LOW": 0},
    "alerts": [
      {
        "alert_id": "alert-uuid-001",
        "category": "ENROLLMENT_DELAY",
        "severity": "HIGH",
        "detection_method": "RULE_BASED",
        "message": "入组滞后: 中心 S005 近2周入组 2 例，计划入组 6 例 (达成率 33%)",
        "detail": {
          "site_id": 2005,
          "site_name": "华西医院",
          "actual_enrollment": 2,
          "planned_enrollment": 6,
          "achievement_rate": 0.33,
          "period_weeks": 2
        },
        "recommended_action": "建议 PM 联系中心 PI 了解入组瓶颈，评估是否需要增加中心或调整策略",
        "status": "DELIVERED",
        "detected_at": "2026-05-11T06:00:00Z"
      }
    ]
  }
}
```

### 2.5 Feature 3: Query Suggestions (智能质疑建议)

#### 2.5.1 功能描述

当 CRA/DM 创建新 Query 时，系统基于 Query 文本和历史 Query 数据库，推荐相似的历史 Query 及其解决方案，帮助快速决策。

#### 2.5.2 处理流程

```
CRA 输入新 Query 文本: "受试者 SUB-042 在 V3 访视 WBC 值为 15.2x10^9/L，
                           但未记录是否复查，请确认。"
  |
  +--> Step 1: Query Embedding (bge-large-zh-v1.5)
  |
  +--> Step 2: Similar Query Search (OpenSearch)
  |     |
  |     +-- 搜索范围: 同一 study 或 同一 site 的历史 Query
  |     +-- 返回 Top 10 相似 Query
  |     +-- 相似度阈值: cosine_similarity > 0.75
  |
  +--> Step 3: LLM Suggestion Generation
  |     |
  |     +-- Prompt: copilot-query-suggestion-v2
  |     +-- 输入: {new_query, similar_queries[], context(study/subject/visit)}
  |     +-- 输出: 建议回复(suggested_response)、建议分类(suggested_category)、
  |                参考依据(rationale)、置信度(confidence)
  |
  +--> Step 4: 返回建议列表给 CRA
```

#### 2.5.3 输出示例

```json
{
  "suggestions": [
    {
      "rank": 1,
      "similar_query_id": "Q-2026-0312",
      "similar_query_text": "受试者 SUB-018 V4 访视 WBC 值 16.1，请确认是否复查",
      "similarity_score": 0.89,
      "historical_resolution": "CRA 回复: 受试者于 V4 后第 3 天复查 WBC 为 8.2，
                               复查记录已补充至 eCRF。",
      "suggested_response": "请确认: 1) 该 WBC 异常值是否为复查结果; 
                           2) 若未复查，建议安排受试者尽快复查; 
                           3) 确认是否有伴随感染症状。",
      "suggested_category": "LAB_ABNORMALITY",
      "rationale": "基于 3 条相似 Query (相似度 > 0.85)，
                   此类 WBC 升高 Query 通常需要确认复查状态和伴随症状。",
      "confidence": 0.87
    },
    {
      "rank": 2,
      "similar_query_id": "Q-2026-0208",
      "similar_query_text": "SUB-011 V3 实验室检查值异常，请提供复查报告",
      "similarity_score": 0.82,
      "historical_resolution": "CRC 上传了复查报告。",
      "suggested_response": "建议直接要求上传复查报告。",
      "suggested_category": "LAB_ABNORMALITY",
      "confidence": 0.79
    }
  ],
  "model_name": "deepseek-v4-pro",
  "processing_time_ms": 850
}
```

### 2.6 Feature 4: Visit Preparation Checklist (监查访视准备清单)

#### 2.6.1 功能描述

CRA 在计划监查访视前，AI 自动分析该中心的最新数据，生成个性化的访视准备清单，确保 CRA 在访视时重点关注关键问题。

#### 2.6.2 输入数据源

| 数据项 | 来源 | 用途 |
|--------|------|------|
| 上次监查访视报告 (Last Monitoring Report) | monitoring_visits + reports | 跟进上次发现的问题 |
| 上次访视后新增 Query | queries 表 | Source Data Verification (SDV) 重点 |
| 上次访视后新入组受试者 | subjects 表 | 需核查 ICF + 入排标准 |
| 待办 Action Items (未关闭) | action_items 表 | 跟进上次访视的待办 |
| 中心 SOP 偏差 (Site Deviations) | deviations 表 | 需要讨论的偏差项 |
| 中心 IP 库存 | ip_inventory 表 | 药品清点和 accountability |
| 即将到期的文档 (Expiring Docs) | documents 表 | ICF re-consent, 证书到期等 |
| 受试者安全数据 (Safety) | adverse_events 表 | 待审查的 AE/SAE |

#### 2.6.3 清单生成流程

```
CRA 选择访视 (visit_id) -> 触发 AI 生成
  |
  +--> Java Backend 查询所有相关数据
  |     |
  |     +-- 上次报告中的 OPEN findings
  |     +-- 未关闭的 Action Items (by site_id)
  |     +-- 新入组受试者列表 (enrolled after last_visit_date)
  |     +-- 新增 Query 列表 (by site_id, after last_visit_date)
  |     +-- 中心偏差列表
  |     +-- IP 库存信息
  |     +-- 即将到期文档
  |
  +--> AI Service 接收打包数据
  |     |
  |     +-- LLM Prompt: copilot-visit-prep-v3
  |     +-- 归类检查项: ICF审查 / SDV / IP管理 / 文档审查 / 安全性审查 / Follow-up
  |     +-- 按优先级排序 (HIGH/MEDIUM/LOW)
  |     +-- 每项附带具体操作指引
  |
  +--> 返回结构化 Checklist
```

#### 2.6.4 输出示例

```json
{
  "checklist_id": "chklst-uuid-001",
  "visit_id": 5001,
  "site_id": 2001,
  "site_name": "北京肿瘤医院",
  "cra_name": "王监查员",
  "visit_date": "2026-05-15",
  "generated_at": "2026-05-11T08:00:00Z",
  "last_visit_date": "2026-04-15",
  "sections": [
    {
      "section": "A. ICF 审查 (Informed Consent Review)",
      "priority": "HIGH",
      "items": [
        {
          "id": "A1",
          "description": "核查 4 例新入组受试者的 ICF 签署 (SUB-043, SUB-044, SUB-045, SUB-046)",
          "detail": "核查签署日期、版本号、签署人、重新签署历史",
          "reference": "上次访视后(2026-04-15)新入组 4 例受试者",
          "priority": "HIGH"
        },
        {
          "id": "A2",
          "description": "ICF 版本 3.0 已获批，确认所有在组受试者已完成重新签署",
          "detail": "ICF v3.0 于 2026-04-20 EC 获批，需在下次访视前完成所有在组受试者重新签署",
          "reference": "EC Approval Letter 2026-04-20",
          "priority": "HIGH"
        }
      ]
    },
    {
      "section": "B. SDV (Source Data Verification)",
      "priority": "MEDIUM",
      "items": [
        {
          "id": "B1",
          "description": "SDV 重点: 上次访视后新增 23 条 Query 涉及 8 例受试者",
          "detail": "优先核查: SUB-012 (5条Query), SUB-018 (4条Query)",
          "reference": "Query Report 2026-04-15 to 2026-05-11",
          "priority": "MEDIUM"
        }
      ]
    },
    {
      "section": "C. IP 管理 (Investigational Product Management)",
      "priority": "HIGH",
      "items": [
        {
          "id": "C1",
          "description": "IP 库存清点: 当前库存 48 瓶，预计可支持 18 天 (至 2026-05-29)，需安排补货",
          "detail": "按当前消耗率 2.67 瓶/天计算，IP 库存将在下次访视前耗尽",
          "reference": "IP Inventory Record 2026-05-11",
          "priority": "HIGH"
        },
        {
          "id": "C2",
          "description": "IP 温度记录审查: 核查 2026-04-15 至 2026-05-11 期间温度日志",
          "detail": "确认是否有温度偏移事件及处理措施",
          "priority": "MEDIUM"
        }
      ]
    },
    {
      "section": "D. 文档审查 (Document Review)",
      "priority": "MEDIUM",
      "items": [
        {
          "id": "D1",
          "description": "PI 医师执业证书将于 2026-06-15 到期，提醒更新",
          "reference": "Investigator File",
          "priority": "MEDIUM"
        }
      ]
    },
    {
      "section": "E. Follow-up (上次访视遗留事项)",
      "priority": "HIGH",
      "items": [
        {
          "id": "E1",
          "description": "跟进: 上次访视 Finding #F-042 (SUB-012 合并用药记录不完整) 待关闭",
          "detail": "Finding 已存在 30 天，需在此次访视中确认解决",
          "priority": "HIGH"
        }
      ]
    }
  ],
  "summary_stats": {
    "new_subjects_since_last_visit": 4,
    "new_queries_since_last_visit": 23,
    "open_action_items": 3,
    "open_findings": 1,
    "total_checklist_items": 7
  },
  "confidence_score": 0.91
}
```

### 2.7 Feature 5: Monitoring Report Draft (监查报告草稿生成)

#### 2.7.1 功能描述

CRA 完成监查访视后，AI 基于访视数据、发现项、Query 动态等自动生成监查报告的核心章节草稿，CRA 审核编辑后提交。

#### 2.7.2 可生成章节

| 章节 | 内容来源 | AI 处理方式 | Human Review 重点 |
|------|----------|-------------|-------------------|
| 1. Visit Summary | visit 元数据 | 模板填充 + 简要叙事 | 准确性核查 |
| 2. Subject Status | subjects 表 (该site) | 数据格式化 | 核对受试者数量 |
| 3. Informed Consent | ICF 记录 | 识别过期/缺失 | 务必逐条核查 |
| 4. Protocol Compliance | deviations 表 | 汇总偏差 + 趋势分析 | 严重性评估 |
| 5. IP Management | ip_inventory 表 | 库存计算 + 差异分析 | 数字核对 |
| 6. Data Quality (SDV) | queries + CRF 完成率 | 汇总统计 + 重点标注 | CRA 补充 SDV 细节 |
| 7. Safety Review | AE/SAE 记录 | 汇总 + AE 趋势 | DS 审核 |
| 8. Findings & Action Items | CRA 输入的 findings | Draft 转结构化 Action Items | CRA 确认每项 |
| 9. Conclusion & Next Visit | 整体评估 | AI 综合建议 | PM/Lead CRA 审核 |

#### 2.7.3 生成流程

```
CRA 完成监查 -> 在系统中点击 Generate Report Draft
  |
  +--> Java Backend 收集所有 visit 相关数据
  |     +-- visit metadata (date, type, attendees)
  |     +-- subject status snapshot (at visit date)
  |     +-- ICF records (all subjects at site)
  |     +-- Protocol deviations (since last visit)
  |     +-- IP inventory snapshot
  |     +-- Query summary (by subject, by category)
  |     +-- AE/SAE summary
  |     +-- Previous report findings (for follow-up)
  |
  +--> AI Service: 逐章节生成
  |     +-- Ch 1-2: 数据填充 + 简要叙事
  |     +-- Ch 3-7: 数据格式化 + AI 趋势分析 + 标注潜在问题
  |     +-- Ch 8: Action Items 提取 (see Feature 6)
  |     +-- Ch 9: LLM 综合分析 (copilot-report-conclusion-v1)
  |
  +--> 返回 JSON structured draft
        +-- 每个 section 单独返回，CRA 可逐节编辑
        +-- 每个 AI 生成的内容标注 [AI-GENERATED] tag
```

#### 2.7.4 输出结构

```json
{
  "draft_id": "draft-uuid-001",
  "visit_id": 5001,
  "status": "DRAFT",
  "sections": {
    "visit_summary": {
      "content": "...",
      "confidence": 0.95,
      "ai_generated": true
    },
    "subject_status": {
      "content": "...",
      "confidence": 0.98,
      "ai_generated": true
    },
    "findings_and_actions": {
      "content": "...",
      "extracted_actions": [...]  
    }
  },
  "overall_confidence": 0.90
}
```

### 2.8 Feature 6: Action Item Extraction (行动项提取)

#### 2.8.1 功能描述

从监查报告文本、会议纪要、邮件等自由文本中自动提取结构化的 Action Items，并智能分配责任人及截止日期。

#### 2.8.2 处理流程

```
输入文本: 监查报告 Findings 章节 或 自由文本
  |
  +--> Step 1: NER + Intent Detection
  |     |
  |     +-- 实体识别: PERSON, DATE, SUBJECT_ID, DOC_TYPE
  |     +-- 意图分类: ACTION_REQUIRED / INFORMATION / OBSERVATION
  |     +-- 模型: LLM (few-shot) + 规则后备
  |
  +--> Step 2: Action Item Structuring
  |     +-- Extract: {action_description, assignee, deadline, priority, category}
  |     +-- 如果 assignee 未明确提及 -> 智能推断 (基于角色 + 历史)
  |     +-- 如果 deadline 未明确提及 -> 使用默认规则 (HIGH: 7d, MEDIUM: 14d, LOW: 30d)
  |
  +--> Step 3: Deduplication
  |     +-- 与已有 OPEN Action Items 对比 (语义相似度 > 0.85 -> 可能重复)
  |
  +--> Step 4: 返回提取结果，CRA 逐条确认/修改
```

#### 2.8.3 输入输出示例

**输入 (Report Text)**:

```
Finding F-001: 受试者 SUB-012 的合并用药记录缺少用药起止日期，
CRC 张丽需在 5 个工作日内补充。

Finding F-002: IP 温度记录仪 #TEMP-03 于 4月28日出现一次温度偏移(9.2C, 持续45分钟)，
需评估对药品质量的影响。药房李主任需在 5月20日前完成评估报告。

Finding F-003: 源文件与 eCRF 进行 SDV 确认一致，无差异。
```

**输出 (Extracted Action Items)**:

```json
{
  "extracted_items": [
    {
      "source_text": "受试者 SUB-012 的合并用药记录缺少用药起止日期，CRC 张丽需在 5 个工作日内补充",
      "action": "补充 SUB-012 合并用药起止日期",
      "assignee_suggested": "张丽 (CRC)",
      "deadline_suggested": "2026-05-16",
      "priority": "HIGH",
      "category": "DATA_COMPLETENESS",
      "related_subject_id": "SUB-012",
      "confidence": 0.92
    },
    {
      "source_text": "IP 温度记录仪 #TEMP-03 于 4月28日出现一次温度偏移，需评估对药品质量的影响...",
      "action": "完成 IP 温度偏移评估报告 (TEMP-03, 2026-04-28)",
      "assignee_suggested": "李主任 (Pharmacist)",
      "deadline_suggested": "2026-05-20",
      "priority": "HIGH",
      "category": "IP_MANAGEMENT",
      "related_equipment": "TEMP-03",
      "confidence": 0.89
    },
    {
      "source_text": "源文件与 eCRF 进行 SDV 确认一致，无差异",
      "action": null,
      "intent": "OBSERVATION",
      "is_actionable": false,
      "confidence": 0.97
    }
  ],
  "total_extracted": 2,
  "total_observations": 1
}
```

### 2.9 Copilot API 端点设计

#### 2.9.1 API 总览

| # | Method | Path | Description | Sync/Async |
|---|--------|------|-------------|------------|
| 1 | POST | /api/v1/ai/copilot/ask | 通用 Copilot 查询 | Sync |
| 2 | POST | /api/v1/ai/copilot/summary | 生成研究摘要 | Async |
| 3 | GET | /api/v1/ai/copilot/summary/{id} | 获取摘要结果 | Sync |
| 4 | POST | /api/v1/ai/copilot/query-suggestions | Query 建议 | Sync |
| 5 | POST | /api/v1/ai/copilot/visit-prep | 访视准备清单 | Async |
| 6 | GET | /api/v1/ai/copilot/visit-prep/{id} | 获取清单结果 | Sync |
| 7 | POST | /api/v1/ai/copilot/report-draft | 监查报告草稿 | Async |
| 8 | GET | /api/v1/ai/copilot/report-draft/{id} | 获取草稿 | Sync |
| 9 | POST | /api/v1/ai/copilot/extract-actions | 提取 Action Items | Sync |
| 10 | GET | /api/v1/ai/copilot/risk-alerts | 风险告警 | Sync |
| 11 | PUT | /api/v1/ai/copilot/risk-alerts/{id}/acknowledge | 确认告警 | Sync |
| 12 | PUT | /api/v1/ai/copilot/risk-alerts/{id}/dismiss | 忽略告警 | Sync |

#### 2.9.2 POST /api/v1/ai/copilot/ask - 通用 Copilot 查询

这是一个通用的 AI 查询端点，CRA/PM 可以自由问答，系统根据查询类型自动路由到对应的处理流程。

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| query | String | Y | 自然语言查询 |
| study_id | Long | Y | 试验ID |
| site_id | Long | N | 中心ID (限定范围) |
| context_type | String | N | 上下文类型: STUDY_OVERVIEW / SITE_PERFORMANCE / VISIT / SUBJECT / QUERY / AE |
| context_id | Long | N | 上下文实体ID |
| conversation_id | UUID | N | 会话ID |

**响应** (同步): `AiCopilotResponseVO` (参考 round3-api.md Section 15.2)

#### 2.9.3 POST /api/v1/ai/copilot/summary - 生成研究摘要

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| study_id | Long | Y | 试验ID |
| period_start | Date | N | 期间开始 (默认: 30天前) |
| period_end | Date | N | 期间结束 (默认: 今天) |
| include_charts | Boolean | N | 是否生成图表数据 (default: true) |

**响应**: `ApiResponse<AsyncTaskVO>` (异步任务，轮询获取结果)

#### 2.9.4 POST /api/v1/ai/copilot/query-suggestions - Query 建议

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| query_text | String | Y | 新 Query 文本 |
| study_id | Long | Y | 试验ID |
| site_id | Long | N | 中心ID |
| category | String | N | Query 分类 (如果用户已选择) |

**响应**: 同步返回建议列表

#### 2.9.5 POST /api/v1/ai/copilot/visit-prep - 访视准备清单

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| visit_id | Long | Y | 访视ID |

**响应**: `ApiResponse<AsyncTaskVO>`

### 2.10 Copilot Prompt 管理

| Prompt 名称 | 版本 | 用途 | 关键特性 |
|-------------|------|------|----------|
| copilot-study-summary-v2 | v2 | 研究摘要生成 | 支持中英双语，结构化 JSON 输出 |
| copilot-risk-alert-v1 | v1 | 风险告警生成 | 基于规则 + 统计模式 |
| copilot-query-suggestion-v3 | v3 | Query 建议 | Few-shot 示例 + 历史对比 |
| copilot-visit-prep-v3 | v3 | 访视准备清单 | 多维度输入 + 优先级排序 |
| copilot-report-conclusion-v1 | v1 | 报告结论生成 | 综合分析 + 建议 |
| copilot-action-extraction-v2 | v2 | Action Item 提取 | NER + 结构化输出 |

### 2.11 Copilot 质量控制

| 检查项 | 方法 | 频率 | 责任人 |
|--------|------|------|--------|
| 摘要准确率 | 人工评审: 每周随机抽取 5 份摘要 | 每周 | PM Lead |
| 风险告警误报率 | 统计: dismissed / total 比率 | 每月 | QA |
| Query 建议采纳率 | 统计: 用户选择使用 AI 建议的比例 | 每月 | DM Lead |
| Action Item 提取准确率 | 人工验证: 每周抽取 20 个提取结果 | 每周 | QA |
| 用户满意度 | 每个 AI 产出附带 1-5 星评分 | 实时 | 产品团队 |

---

## 3. Auto-Reporting (自动报告生成)

### 3.1 概述

自动报告系统按预定时间表，自动收集各维度数据，通过 AI 生成叙事性报告草稿和可视化图表。报告生成后需人工审核确认方可分发。整个流程基于异步任务，支持轮询进度。

### 3.2 报告类型总览

| 报告类型 | 频率 | 触发时间 | 数据时间范围 | 审阅人 | 分发对象 |
|----------|------|----------|-------------|--------|----------|
| 周报 (Weekly Progress Report) | 每周 | 周一 08:00 (Asia/Shanghai) | 上周一至周日 | PM | PM, CRA Lead, Sponsor |
| 月安全性报告 (Monthly Safety Report) | 每月 | 每月第1个工作日 08:00 | 上月 | DS, PI | DS, PI, PM, Sponsor DS |
| 季度汇总报告 (Quarterly Report) | 每季度 | 季度结束后第1个周一 | 上季度 | PM, DS | PM, Sponsor |
| 研究结束报告 (End-of-Study Report) | 按需 | 手动触发 | 全部研究期 | PM, PI, DS | Sponsor, RA |

### 3.3 报告生成通用流程

```
触发 (定时调度 或 手动)
  |
  +--> Step 1: Java Backend 创建 Async Task ({report_type}_task_id)
  |     |
  |     +-- 检查是否有进行中的同类型任务 -> 跳过
  |     +-- 锁定数据快照: 创建 data_snapshot 记录 (保证报告数据一致性)
  |     +-- 查询报告所需数据
  |
  +--> Step 2: 发送到 RabbitMQ ai.task.report.generate
  |
  +--> Step 3: AI Service 消费消息
  |     |
  |     +-- 数据聚合与统计
  |     +-- 图表数据生成 (返回 JSON 格式的 chart config)
  |     +-- LLM 叙事生成: Prompt -> 各章节草稿
  |     +-- 整体置信度评分
  |
  +--> Step 4: 返回结果到 RabbitMQ ai.result.report.draft
  |
  +--> Step 5: Java Backend 持久化报告草稿
  |     |
  |     +-- 更新 Async Task 状态 = COMPLETED
  |     +-- 推送通知给审阅人
  |     +-- 报告状态 = DRAFT_PENDING_REVIEW
  |
  +--> Step 6: 人工审阅
        |
        +-- APPROVED -> 报告发布，分发通知
        +-- REVISED -> PM 编辑后重新 APPROVE
        +-- REJECTED -> 回退到 Draft，记录原因
```

### 3.4 周报 (Weekly Progress Report)

#### 3.4.1 包含章节

| 章节 | 内容 | 数据来源 | AI 处理 | 是否需图表 |
|------|------|----------|---------|------------|
| 1. 执行摘要 (Executive Summary) | 本周期核心亮点 + 风险概述 | 全维度聚合 | LLM 叙事生成 | 否 |
| 2. 入组与筛选 (Enrollment & Screening) | 本周/累计入组、筛选失败率 | subjects 表 | 数据统计 + 趋势分析 | 是 (折线图 + 柱状图) |
| 3. 访视执行 (Visit Execution) | 计划/完成访视、超窗率 | visits 表 | 统计 + 超窗分析 | 是 (完成率仪表盘) |
| 4. 数据质量 (Data Quality) | Query 状态、CRF 完成率 | queries 表 + CRF 记录 | 统计 + 老化分析 | 是 (Query 趋势图) |
| 5. 安全性概述 (Safety Overview) | AE/SAE 汇总 | adverse_events 表 | 统计 + SAE 描述 | 是 (AE 分布饼图) |
| 6. 监查活动 (Monitoring Activities) | 完成/计划访视、主要发现 | monitoring_visits 表 | 汇总 + 发现分析 | 否 |
| 7. 里程碑状态 (Milestone Status) | 完成/进度中/即将到期 | study_milestones 表 | 状态分析 | 是 (甘特图) |
| 8. 风险与问题 (Risks & Issues) | 当前 OPEN 风险、升级项 | risk_alerts 表 | 从风险告警提取 | 否 |
| 9. 下周计划 (Next Week Plan) | 计划活动 + 预期里程碑 | 综合 | LLM 推理生成 | 否 |

#### 3.4.2 LLM Prompt 核心指令

```
System: You are a Clinical Research Report Writer. Generate a weekly progress report
for a clinical trial. Follow these rules:

1. Write in a professional, objective tone suitable for sponsor review.
2. Base ALL content on the provided data. Do not fabricate.
3. For each section, provide: (a) current status, (b) comparison vs last period,
   (c) comparison vs plan, (d) notable findings or risks.
4. Use data-driven language: include specific numbers, percentages, trends.
5. Highlight risks with [RISK] tag and recommendations with [RECOMMENDATION] tag.
6. Format in Markdown with appropriate headers.
7. Generate chart configuration data as JSON for frontend rendering.
```

#### 3.4.3 输出结构 (核心字段)

```json
{
  "report_id": "weekly-rpt-2026-W19-001",
  "report_type": "WEEKLY",
  "study_id": 1001,
  "study_name": "NSCLC-III期",
  "period": {"from": "2026-05-04", "to": "2026-05-10"},
  "week_number": 19,
  "status": "DRAFT_PENDING_REVIEW",
  "generated_at": "2026-05-11T08:00:00Z",
  "review_due_by": "2026-05-12T18:00:00Z",
  "sections": [
    {
      "section_id": "executive_summary",
      "title": "1. 执行摘要",
      "content": "## 执行摘要...",
      "confidence": 0.90,
      "ai_generated": true
    },
    {
      "section_id": "enrollment",
      "title": "2. 入组与筛选",
      "content": "## 入组与筛选...",
      "charts": [
        {
          "chart_id": "enrollment_trend",
          "chart_type": "line",
          "title": "入组趋势",
          "data": {"labels": "[]", "values": "[]"}
        }
      ],
      "confidence": 0.95
    }
  ],
  "overall_confidence": 0.92,
  "model_name": "deepseek-v4-pro",
  "model_version": "2026-04-15",
  "prompt_name": "report-weekly-v2",
  "prompt_version": "d5e6f7a8b9c0"
}
```

### 3.5 月安全性报告 (Monthly Safety Report)

#### 3.5.1 功能描述

每月自动汇总所有活跃试验的安全性数据，生成包含统计图表和 AI 安全性信号评论的综合报告。该报告是监管递交(如 DSUR)的重要数据基础，须经 PI/DS 严格审核。

#### 3.5.2 报告章节

| 章节 | 内容 | AI 处理 | 审核要点 |
|------|------|---------|----------|
| 1. 执行摘要 | 本月安全性概览，关键安全性信号 | LLM 叙事 | PI 确认无遗漏 |
| 2. AE 汇总 | AE 总体发生情况: 发生率、严重程度分布、SOC 分布 | 统计 + 图表 | DM 核对原始数据 |
| 3. SAE 详情 | SAE 逐例列表，包括 SUSAR 标注 | 数据格式化 + 叙事 | DS 逐例审核 |
| 4. AE 趋势 | 逐月 AE 发生率趋势、按中心趋势 | 趋势分析 + 图表 | DS 判断趋势真实性 |
| 5. 实验室异常 | 3/4 级实验室异常汇总 | 异常检测 | DS 审核临床意义 |
| 6. 退出/死亡 | 因 AE 退出、死亡病例详情 | 数据摘要 | PI 审核因果关系 |
| 7. AI 安全性信号评论 | AI 检测到的潜在安全性模式 | LLM 分析 | PI/DS 必须审核 |
| 8. 结论与建议 | 总体安全性评估 + 建议措施 | LLM 综合 | PI 签署 |

#### 3.5.3 AI 安全性信号检测

系统使用以下方法检测潜在安全性信号:

| 方法 | 描述 | 输出 | 阈值 |
|------|------|------|------|
| 发生率异常检测 | 比较本月 vs 历史月 AE 发生率 | 异常 PT/中心 | p < 0.05 (Poisson) |
| Proportional Reporting Ratio (PRR) | 特定 AE 的 PRR 计算 | PRR > 2, chi-sq > 4 | 统计显著 |
| 时间聚类扫描 | 扫描 SAE 时间聚集性 | 聚集时间段 | Kulldorff 空间-时间扫描 |
| 中心异常检测 | 某中心 AE 报告率显著高于其他中心 | 异常中心列表 | z-score > 3 |
| LLM 模式识别 | LLM 从 SAE 描述中提取潜在因果关系模式 | 自然语言信号描述 | -- |

#### 3.5.4 安全性信号输出格式

```json
{
  "safety_signals": [
    {
      "signal_id": "SIG-2026-05-001",
      "detection_method": "PRR",
      "ae_term": "间质性肺炎 (Interstitial Pneumonitis)",
      "meddra_pt_code": "10022698",
      "prr_value": 2.8,
      "chi_square": 6.5,
      "observed_count": 5,
      "expected_count": 1.8,
      "severity": "POTENTIAL_SIGNAL",
      "ai_commentary": "本月观察到 5 例间质性肺炎 (3 例 G3, 2 例 G2)，PRR=2.8，
                        chi-square=6.5，超过阈值(PRR>2, chi-sq>4)。
                        3 例发生在中心 S001 (北京肿瘤医院)，建议关注该中心的环境或评估者因素。
                        需要进一步评估: 1) 药物因果关系; 2) 患者基线肺部状态; 3) 既往放疗史。",
      "recommended_actions": [
        "审查所有 5 例 IP 病例的完整病史和既往治疗",
        "评估 IP 与放疗的潜在相互作用",
        "在下一次 DSMB 会议上讨论此信号"
      ],
      "confidence": 0.78,
      "requires_dsmb_review": true
    }
  ]
}
```

#### 3.5.5 审核流程

```
AI 生成月安全性报告草稿 (DRAFT)
  |
  +--> DM 初审 (数据准确性)
  |     +-- 核对 AE/SAE 数量
  |     +-- 核对严重程度分级
  |     +-- 核对因果关系评估
  |
  +--> DS 审核 (医学评估)
  |     +-- 审核每个 AI 安全性信号
  |     +-- 补充/修改安全性评论
  |     +-- 标记: ACCEPTED / REJECTED / NEEDS_INVESTIGATION
  |
  +--> PI 终审签署
        +-- 确认所有 SAE 已妥善处理
        +-- 确认安全性结论
        +-- 电子签名 (21 CFR Part 11 compliant)
  |
  +--> 报告 PUBLISHED -> 分发通知
```

#### 3.5.6 审核审计追踪

每个审核步骤记录完整的审计信息:

| 字段 | 说明 |
|------|------|
| reviewer_id | 审核人 |
| reviewer_role | 审核人角色 (DM/DS/PI) |
| review_timestamp | 审核时间 |
| review_action | APPROVED / REJECTED / COMMENTED |
| comments | 审核意见 |
| changes_made | 修改内容 (JSON diff) |
| electronic_signature | 电子签名 (合规要求) |

### 3.6 报告生成 API 设计

#### 3.6.1 API 端点总览

| # | Method | Path | Description | Sync/Async | Auth |
|---|--------|------|-------------|------------|------|
| 1 | POST | /api/v1/reports/weekly/generate | 触发周报生成 | Async | PM, ADMIN |
| 2 | POST | /api/v1/reports/monthly-safety/generate | 触发月安全报告生成 | Async | PM, DS, ADMIN |
| 3 | GET | /api/v1/reports/{id}/status | 获取报告生成状态 | Sync | Authenticated |
| 4 | GET | /api/v1/reports/{id} | 获取报告内容 | Sync | Authenticated (by study) |
| 5 | PUT | /api/v1/reports/{id}/review | 提交审核意见 | Sync | DM, DS, PI |
| 6 | PUT | /api/v1/reports/{id}/approve | 批准报告发布 | Sync | PM, PI |
| 7 | POST | /api/v1/reports/{id}/distribute | 分发报告 | Async | PM |
| 8 | GET | /api/v1/reports | 报告列表 (分页+筛选) | Sync | Authenticated |

#### 3.6.2 POST /api/v1/reports/weekly/generate

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| study_id | Long | Y | 试验ID |
| period_start | Date | N | 报告期间起始 (默认: 上周一) |
| period_end | Date | N | 报告期间结束 (默认: 上周日) |
| Idempotency-Key | Header UUID | Y | 幂等键 |

**响应**:
```json
{
  "code": 200,
  "data": {
    "taskId": "weekly-task-abc-123",
    "taskType": "REPORT_GENERATION",
    "status": "PENDING",
    "estimatedCompletionTime": "2026-05-11T08:05:00Z",
    "pollingEndpoint": "/api/v1/reports/weekly-task-abc-123/status",
    "pollingIntervalSeconds": 5
  }
}
```

#### 3.6.3 POST /api/v1/reports/monthly-safety/generate

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| study_id | Long | Y | 试验ID |
| report_month | String | Y | 报告月份 (YYYY-MM) |
| include_llm_commentary | Boolean | N | 是否包含 AI 安全性评论 (default: true) |

**响应**: 同 3.6.2 格式 (AsyncTaskVO)

**重要约束**: 同一 study 同一月份仅允许生成一份月安全报告 (幂等)。重复请求返回已存在报告的 409。

#### 3.6.4 GET /api/v1/reports/{id}/status - 报告生成状态

```json
{
  "code": 200,
  "data": {
    "taskId": "weekly-task-abc-123",
    "taskType": "REPORT_GENERATION",
    "status": "PROCESSING",
    "progress": {
      "percentage": 65,
      "currentStep": "Generating Safety Section...",
      "completedSections": 5,
      "totalSections": 9
    },
    "reportId": "weekly-rpt-2026-W19-001",
    "createdAt": "2026-05-11T08:00:00Z"
  }
}
```

**状态枚举**: PENDING / PROCESSING / COMPLETED / FAILED / CANCELLED

### 3.7 报告分发 (Report Distribution)

| 分发渠道 | 格式 | 触发条件 | 配置 |
|----------|------|----------|------|
| Dashboard (In-App) | Interactive HTML | 报告 PUBLISHED | 默认启用 |
| Email | PDF 附件 | 报告 PUBLISHED | 按角色配置收件人列表 |
| 消息中心 (Notification) | 链接 | 报告 PUBLISHED | 默认推送 |
| 外部 FTP/SFTP | PDF + 数据 (CSV/Excel) | 手动触发 | 按 Sponsor 要求配置 |

**分发审计**: 每次分发记录: {report_id, channel, recipient, sent_at, delivery_status, opened_at}

---

## 4. Enrollment Prediction (入组预测)

### 4.1 概述

入组预测模型基于历史入组数据和多维度影响因素，使用贝叶斯+集成学习混合模型预测研究的入组完成日期，并以置信区间呈现不确定性。预测结果仅供管理参考，不作为决策的唯一依据。

### 4.2 输入特征 (Features)

#### 4.2.1 核心特征

| 特征类别 | 特征 | 数据类型 | 更新频率 | 来源 |
|----------|------|----------|----------|------|
| 入组历史 | 每周入组数 (历史) | Time Series (int) | 每日 | subjects 表 |
| 入组历史 | 累计入组数 | int | 每日 | subjects 表 |
| 中心产能 | 各中心已启动数 | int | 每周 | sites 表 |
| 中心产能 | 各中心计划启动日期 | date[] | 实时 | sites 表 |
| 中心产能 | 各中心历史入组速率 (per week) | float[] | 每周 | 计算指标 |
| 筛选效率 | 筛选数 / 周 | int[] | 每日 | subjects 表 |
| 筛选效率 | 筛选失败率 (rolling 4-week) | float | 每周 | 计算指标 |
| 筛选效率 | 筛选-入组转化率 | float | 每周 | 计算指标 |
| 时间因素 | 季节因子 (month_of_year) | categorical (1-12) | -- | -- |
| 时间因素 | 已入组月份数 (研究成熟度) | int | 每日 | 计算 |
| 竞争因素 | 同适应症竞争试验数 | int | 按需更新 | 外部数据 (CDE登记) |
| 竞争因素 | 竞争试验中心重叠度 | float | 按需更新 | 外部数据 |

#### 4.2.2 特征工程

```python
# Enrichment Pipeline
def build_features(study_id, as_of_date):
    # 1. Time-series features
    enrollment_series = get_weekly_enrollment(study_id)
    features['rolling_4w_avg'] = enrollment_series.rolling(4).mean()[-1]
    features['rolling_4w_std'] = enrollment_series.rolling(4).std()[-1]
    features['momentum'] = enrollment_series[-1] / enrollment_series[-4:].mean()
    
    # 2. Site capacity features
    active_sites = get_active_sites(study_id, as_of_date)
    future_sites = get_planned_sites(study_id, as_of_date)
    features['active_site_count'] = len(active_sites)
    features['future_site_count'] = len(future_sites)
    features['avg_site_rate'] = mean(s.weekly_rate for s in active_sites)
    
    # 3. Efficiency features
    features['screen_fail_rate'] = calculate_screen_fail_rate(study_id)
    features['screen_to_enroll_rate'] = 1 - features['screen_fail_rate']
    
    # 4. Temporal features
    features['month'] = as_of_date.month
    features['quarter'] = (as_of_date.month - 1) // 3 + 1
    features['days_since_fpi'] = (as_of_date - study.fpi_date).days
    features['study_maturity_pct'] = features['days_since_fpi'] / estimated_total_days
    
    # 5. Competition features
    features['competing_trials'] = get_competing_trials(study_id)
    features['site_overlap_ratio'] = calculate_site_overlap(study_id)
    
    return features
```

### 4.3 模型设计 (Model Architecture)

#### 4.3.1 混合模型架构

```
输入特征 X
  |
  +--> [Branch 1] Bayesian Hierarchical Model (PyMC)
  |     |
  |     +-- Level 1: Study-level prior (overall enrollment rate)
  |     +-- Level 2: Site-level rates (hierarchical, partial pooling)
  |     +-- Level 3: Time-varying rate (random walk)
  |     +-- Output: posterior_samples of completion date
  |
  +--> [Branch 2] ML Ensemble (LightGBM + CatBoost)
  |     |
  |     +-- Features: 40+ engineered features
  |     +-- Target: remaining_days_to_completion
  |     +-- Output: point prediction + uncertainty estimate
  |
  +--> [Branch 3] Baseline: Linear extrapolation with seasonal adjustment
  |     |
  |     +-- Simple exponential smoothing (Holt-Winters)
  |     +-- Output: baseline prediction
  |
  +--> [Ensemble] Weighted Average
        |
        +-- Weight: Bayesian 50%, ML 35%, Baseline 15%
        +-- Weights are adaptive based on study maturity:
               Early (< 20% enrolled): Bayesian 60%, ML 25%, Baseline 15%
               Mid (20-80% enrolled): Bayesian 40%, ML 45%, Baseline 15%
               Late (> 80% enrolled): Bayesian 30%, ML 50%, Baseline 20%
        |
        +-- Output: predicted_completion_date + confidence_intervals
```

#### 4.3.2 贝叶斯模型 (PyMC)

```python
import pymc as pm
import numpy as np

def build_bayesian_model(site_rates, n_sites, total_target, current_enrolled):
    with pm.Model() as model:
        # Hyper-priors
        mu_rate = pm.Normal('mu_rate', mu=5.0, sigma=2.0)  # avg weekly rate per site
        sigma_rate = pm.HalfNormal('sigma_rate', sigma=2.0)
        
        # Site-level rates (hierarchical)
        site_rates_est = pm.Normal('site_rates', mu=mu_rate, sigma=sigma_rate, shape=n_sites)
        site_rates_pos = pm.Deterministic('site_rates_pos', pm.math.exp(site_rates_est))
        
        # Total weekly enrollment
        total_weekly_rate = pm.Deterministic('total_weekly_rate', 
            pm.math.sum(site_rates_pos))
        
        # Remaining weeks to completion
        remaining = total_target - current_enrolled
        weeks_to_completion = pm.Deterministic('weeks_to_completion',
            remaining / total_weekly_rate)
        
        # Sample from posterior
        trace = pm.sample(2000, tune=1000, target_accept=0.9)
    return trace
```

### 4.4 输出格式 (Prediction Output)

```json
{
  "prediction_id": "pred-uuid-001",
  "study_id": 1001,
  "study_name": "NSCLC-III期-2026-001",
  "generated_at": "2026-05-11T08:00:00Z",
  "model_version": "enrollment-pred-v2.3",
  "current_status": {
    "enrolled": 187,
    "target": 300,
    "percentage": 62.3,
    "active_sites": 12,
    "planned_sites": 15,
    "current_weekly_rate": 5.8
  },
  "predictions": {
    "point_estimate": "2026-10-15",
    "confidence_80": {"lower": "2026-09-20", "upper": "2026-11-10"},
    "confidence_95": {"lower": "2026-08-25", "upper": "2026-12-05"},
    "pessimistic_scenario": "2027-01-15",
    "optimistic_scenario": "2026-08-01",
    "prediction_method": "ENSEMBLE (Bayesian 50% + LightGBM 35% + Baseline 15%)"
  },
  "chart_data": {
    "actual": [{"week": "2026-W01", "enrolled": 3}, ...],
    "predicted_mean": [...],
    "predicted_upper_95": [...],
    "predicted_lower_95": [...],
    "target_line": 300
  },
  "feature_importance": {
    "active_site_count": 0.28,
    "rolling_4w_avg_rate": 0.22,
    "screen_fail_rate": 0.15,
    "site_overlap_ratio": 0.12,
    "month": 0.08,
    "competing_trials": 0.07
  },
  "limitations": [
    "预测基于历史趋势，无法预见突发的监管变更或重大方案修改",
    "竞争试验数据可能不完整 (来源: CDE公开登记)",
    "中心启动延迟风险未完全量化",
    "本预测不构成任何法律或合同承诺 -- 仅供管理参考"
  ],
  "disclaimer": "本入组预测由AI模型自动生成，基于历史数据和多维度特征分析。预测结果存在不确定性，实际入组进度可能因多种因素偏离预测。建议结合项目管理经验综合判断。",
  "retrain_info": {
    "last_retrained_at": "2026-05-01",
    "training_data_until": "2026-04-30",
    "next_scheduled_retrain": "2026-06-01"
  },
  "model_name": "enrollment-pred-ensemble",
  "confidence_score": 0.82
}
```

### 4.5 模型再训练策略

| 触发条件 | 再训练类型 | 说明 |
|----------|------------|------|
| 每月 1 日 | 定期 Full Retrain | 使用截止上月最后一天的数据 |
| 预测误差连续 4 周 > 20% | Trigger Retrain | 模型漂移告警触发 |
| 新增 >= 5 个活跃中心 | Trigger Retrain | 中心结构重大变化 |
| 方案重大修正 (入排标准变更) | Manual Retrain | PM 手动触发 |

### 4.6 API 端点

**GET /api/v1/dashboard/enrollment-prediction?studyId={id}**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| studyId | Long | Y | 试验ID |
| refresh | Boolean | N | 是否强制重新预测 (default: false, 使用最近缓存) |

**缓存策略**: 预测结果缓存 24h (Redis)，每周一自动刷新。`refresh=true` 会触发异步重新预测。

**权限**: PM, CRA Lead, Sponsor (只读)

---

## 5. Risk Scoring (风险评分)

### 5.1 概述

风险评分系统从五个维度(质量、安全、时间线、运营、财务)对每个试验/中心进行多维度风险量化评分，生成风险热力图(Heatmap)和风险详情，帮助 PM 和 QA 快速识别需要重点关注的高风险领域。

### 5.2 评分维度 (Risk Dimensions)

| 维度 | 英文 | 权重 | 描述 | 评估对象粒度 |
|------|------|------|------|-------------|
| 质量 (Quality) | QUALITY | 25% | 数据质量、Query积压、Protocol Deviation、CRF完成率 | Study + Site |
| 安全 (Safety) | SAFETY | 25% | AE/SAE发生率、SAE报告及时性、安全性信号 | Study + Site |
| 时间线 (Timeline) | TIMELINE | 20% | 入组进度、里程碑达成率、启动延迟 | Study + Site |
| 运营 (Operational) | OPERATIONAL | 20% | 中心运营效率、人员流动、培训完成率、库存管理 | Site |
| 财务 (Financial) | FINANCIAL | 10% | 预算执行率、发票处理周期、中心付款异常 | Study + Site |

### 5.3 评分计算模型

#### 5.3.1 每维度评分公式

```
DimensionScore = SUM(Indicator_i * Weight_i) for i in indicators

每个 Indicator 的评分方法:
  1. 定义方向: Higher is Better 或 Lower is Better
  2. 设定阈值: Target (绿色), Warning (黄色), Critical (红色)
  3. 线性或分段线性映射到 0-100:
     - 绿色区间: 0-30 (低风险)
     - 黄色区间: 31-60 (中等风险)
     - 红色区间: 61-100 (高风险)
```

#### 5.3.2 各维度指标清单

**Quality (质量) - 权重 25%**:

| 指标 | 权重 | 计算方式 | 阈值 (Target/Warning/Critical) | 方向 |
|------|------|----------|------------------------------|------|
| Query 老化 (Aging) | 30% | avg(days_since_creation) for OPEN queries | <7 / 7-20 / >20 | Lower Better |
| Query 积压率 (Backlog) | 25% | OPEN queries / total active subjects | <0.5 / 0.5-2.0 / >2.0 | Lower Better |
| Protocol Deviation 率 | 25% | deviations (last 30d) / active subjects | <0.05 / 0.05-0.15 / >0.15 | Lower Better |
| CRF 及时完成率 | 20% | CRFs completed within 5d / total CRFs | >95 / 80-95 / <80 | Higher Better |

**Safety (安全) - 权重 25%**:

| 指标 | 权重 | 计算方式 | 阈值 | 方向 |
|------|------|----------|------|------|
| SAE 率 | 30% | SAE count / enrolled subjects | <0.05 / 0.05-0.15 / >0.15 | Lower Better |
| SAE 报告及时率 | 35% | SAEs reported within 24h / total SAEs | >99 / 95-99 / <95 | Higher Better |
| AE 漏报风险 | 20% | (AE where ae_source != investigator) / total AE | <0.05 / 0.05-0.15 / >0.15 | Lower Better |
| SUSAR 处理合规率 | 15% | SUSARs filed within 7d / total SUSARs | 100 / 90-100 / <90 | Higher Better |

**Timeline (时间线) - 权重 20%**:

| 指标 | 权重 | 计算方式 | 阈值 | 方向 |
|------|------|----------|------|------|
| 入组达成率 | 35% | actual / planned enrollment | >90 / 70-90 / <70 | Higher Better |
| 里程碑按时完成率 | 30% | milestones completed on time / total milestones | >85 / 70-85 / <70 | Higher Better |
| 中心启动延迟 | 20% | avg(days_delayed) for site activations | <7 / 7-30 / >30 | Lower Better |
| 预测完成日期风险 | 15% | predicted completion vs planned completion gap (weeks) | <4 / 4-12 / >12 | Lower Better |

**Operational (运营) - 权重 20%**:

| 指标 | 权重 | 计算方式 | 阈值 | 方向 |
|------|------|----------|------|------|
| 访视超窗率 | 30% | visits with window violation / total visits | <5 / 5-15 / >15 | Lower Better |
| 人员培训完成率 | 25% | staff with valid training / total staff | >95 / 85-95 / <85 | Higher Better |
| 受试者脱落率 | 25% | dropout subjects / enrolled subjects | <5 / 5-15 / >15 | Lower Better |
| IP 库存充足率 | 20% | IP days of stock / days until next shipment | >150 / 100-150 / <100 | Higher Better |

**Financial (财务) - 权重 10%**:

| 指标 | 权重 | 计算方式 | 阈值 | 方向 |
|------|------|----------|------|------|
| 预算执行偏差 | 40% | abs(actual - planned) / planned | <5 / 5-15 / >15 | Lower Better |
| 发票处理及时率 | 35% | invoices processed within 30d / total invoices | >90 / 70-90 / <70 | Higher Better |
| 中心付款延迟 | 25% | avg(days_overdue) for site payments | <15 / 15-30 / >30 | Lower Better |

#### 5.3.3 综合评分 (Composite Score)

```
CompositeScore = SUM(DimensionScore_d * Weight_d) for d in [Quality, Safety, Timeline, Operational, Financial]

Weight_d: QUALITY(25%), SAFETY(25%), TIMELINE(20%), OPERATIONAL(20%), FINANCIAL(10%)
```

### 5.4 风险等级 (Risk Levels)

| 等级 | 分数范围 | 颜色 | 含义 | 建议行动 |
|------|----------|------|------|----------|
| LOW | 0-30 | 绿色 | 风险可控 | 常规监控 |
| MEDIUM | 31-60 | 黄色 | 需要关注 | 制定改进计划 |
| HIGH | 61-80 | 橙色 | 需要干预 | 立即制定纠正措施，上报 PM/QA |
| CRITICAL | 81-100 | 红色 | 紧急 | 立即升级，可能中断/暂停活动 |

### 5.5 风险证据列表 (Evidence)

每条风险评分附带证据列表，说明评分依据:

```json
{
  "dimension": "QUALITY",
  "score": 58,
  "level": "MEDIUM",
  "evidence": [
    {
      "indicator": "Query 老化",
      "value": 18.5,
      "unit": "days",
      "threshold_status": "WARNING",
      "contribution_to_score": 17.4,
      "detail": "OPEN Query 平均老化 18.5 天，超过 Warning 阈值(14天)。
                 中心 S002 (上海中山医院) 有 12 条 Query 超过 20 天未解决。"
    },
    {
      "indicator": "Protocol Deviation 率",
      "value": 0.12,
      "unit": "per subject",
      "threshold_status": "WARNING",
      "contribution_to_score": 14.5,
      "detail": "最近 30 天平均每受试者 0.12 个 PD，接近 Critical 阈值。
                 主要类型: 访视窗口偏差 (60%), 合并用药记录缺失 (25%)。"
    }
  ]
}
```

### 5.6 风险热力图 (Risk Heatmap)

```
         Quality  Safety  Timeline  Operational  Financial  | Composite
         -------  ------  --------  -----------  ---------  | ---------
Study A    58(M)   35(M)    72(H)      45(M)       25(L)   |   50(M)
Study B    30(L)   22(L)    35(M)      28(L)       15(L)   |   27(L)
Study C    85(C)   40(M)    55(M)      62(H)       45(M)   |   60(M)

Site S001  45(M)   30(L)    40(M)      35(M)       20(L)   |   36(M)
Site S002  75(H)   55(M)    65(H)      50(M)       35(M)   |   59(M)
Site S003  30(L)   25(L)    35(M)      22(L)       18(L)   |   27(L)
```

### 5.7 风险评分 API

**GET /api/v1/dashboard/risk-heatmap?studyId={id}**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| studyId | Long | Y | 试验ID |
| level | String | N | 粒度: STUDY / SITE (default: SITE) |
| refresh | Boolean | N | 是否强制重新计算 (default: false) |

**响应结构核心字段**:

```json
{
  "study_id": 1001,
  "generated_at": "2026-05-11T08:00:00Z",
  "level": "SITE",
  "composite": {"score": 50, "level": "MEDIUM"},
  "dimensions": {
    "QUALITY": {"score": 58, "level": "MEDIUM", "evidence": [...]},
    "SAFETY": {"score": 35, "level": "MEDIUM", "evidence": [...]},
    "TIMELINE": {"score": 72, "level": "HIGH", "evidence": [...]},
    "OPERATIONAL": {"score": 45, "level": "MEDIUM", "evidence": [...]},
    "FINANCIAL": {"score": 25, "level": "LOW", "evidence": [...]}
  },
  "site_breakdown": [
    {
      "site_id": 2001,
      "site_name": "北京肿瘤医院",
      "composite": {"score": 36, "level": "MEDIUM"}
    },
    {
      "site_id": 2002,
      "site_name": "上海中山医院",
      "composite": {"score": 59, "level": "MEDIUM"}
    }
  ],
  "model_name": "risk-scoring-v1.5",
  "model_version": "2026-04-01"
}
```

### 5.8 评分更新频率与缓存

| 评分对象 | 更新频率 | 缓存 TTL | 触发条件 |
|----------|----------|----------|----------|
| Study-level | 每日 06:00 | 6h | 定时 + AE/SAE 实时事件部分触发 |
| Site-level | 每日 06:00 | 6h | 定时 + 中心级 Query/Deviation 累积超阈值 |
| 实时告警 | Event-driven | -- | SAE报告延迟、SUSAR等CRITICAL事件 |

---

## 6. Model Version & Prompt Management (模型版本与Prompt管理)

### 6.1 概述

模型和 Prompt 是 AI Service 的核心资产。系统需要完整的版本管理、测试验证、部署策略和回滚能力，确保 AI 行为可追溯、可复现、可管控。

### 6.2 Model Registry (模型注册表)

#### 6.2.1 模型元数据格式 (model_metadata.yaml)

```yaml
models:
  - model_name: "bge-large-zh-v1.5"
    model_type: "embedding"
    provider: "BAAI"
    source: "huggingface"
    model_uri: "BAAI/bge-large-zh-v1.5"
    versions:
      - version: "1.5.0"
        version_hash: "sha256:e3f4a5b6c7d8..."
        deployed_at: "2026-03-15T00:00:00Z"
        dimensions: 768
        max_seq_length: 512
        performance_metrics:
          c_mteb_avg: 68.3
          retrieval_ndcg_10: 72.1
          retrieval_recall_10: 85.4
        evaluation_dataset: "cmteb-retrieval-v1"
        status: "deployed"
        docker_image: "registry.ctms.ai/embeddings:bge-large-zh-v1.5.0"

  - model_name: "bge-reranker-v2-m3"
    model_type: "reranker"
    provider: "BAAI"
    source: "huggingface"
    model_uri: "BAAI/bge-reranker-v2-m3"
    versions:
      - version: "2.0.0"
        version_hash: "sha256:f1e2d3c4b5a6..."
        deployed_at: "2026-04-01T00:00:00Z"
        performance_metrics:
          p_at_5: 89.2
          mrr: 92.5
        status: "deployed"

  - model_name: "deepseek-v4-pro"
    model_type: "llm"
    provider: "DeepSeek"
    source: "api"
    model_uri: "https://api.deepseek.com/v1"
    versions:
      - version: "2026-04-15"
        version_hash: "api:deepseek-v4-pro:2026-04-15"
        deployed_at: "2026-04-20T00:00:00Z"
        context_window: 131072
        max_output_tokens: 8192
        capabilities: ["chat", "json_mode", "structured_output", "function_calling"]
        performance_metrics:
          rag_accuracy: 91.5
          copilot_acceptance_rate: 78.3
          hallucination_rate: 3.8
        evaluation_dataset: "ctms-eval-suite-v2"
        status: "deployed"
        cost_per_1m_input_tokens: 0.55
        cost_per_1m_output_tokens: 2.19

  - model_name: "qwen3-72b-instruct"
    model_type: "llm"
    provider: "Alibaba"
    source: "local"
    model_uri: "/models/qwen3-72b-instruct"
    versions:
      - version: "2026-05-01"
        version_hash: "sha256:a1b2c3d4e5f6..."
        deployed_at: "2026-05-05T00:00:00Z"
        deployment_mode: "vllm"
        gpu_requirement: "4x A100-80GB"
        context_window: 131072
        max_output_tokens: 8192
        capabilities: ["chat", "json_mode", "pii_safe"]
        status: "deployed"
        evaluation_dataset: "ctms-eval-suite-v2"
        is_fallback: true

  - model_name: "enrollment-pred-ensemble"
    model_type: "ml_ensemble"
    provider: "Internal"
    source: "internal"
    model_uri: "s3://ctms-models/enrollment-pred/"
    versions:
      - version: "v2.3"
        version_hash: "sha256:c8d9e0f1a2b3..."
        deployed_at: "2026-05-01T00:00:00Z"
        training_data_version: "2026-04-30"
        training_data_range: "2024-06-01 to 2026-04-30"
        training_data_size: 85000
        performance_metrics:
          mae_weeks: 3.2
          rmse_weeks: 4.8
          prediction_within_4w_accuracy: 78.5
          prediction_within_8w_accuracy: 91.2
        evaluation_dataset: "enrollment-eval-holdout-v2"
        status: "deployed"
        framework: "pymc 5.x + lightgbm 4.x"
```

#### 6.2.2 模型状态机

```
REGISTERED (模型已注册，未测试)
  |
  +--> TESTING (正在评估数据集上测试)
        |
        +--> APPROVED (测试通过，等待部署)
        |     |
        |     +--> CANARY (金丝雀部署: 10% 流量)
        |     |     |
        |     |     +--> DEPLOYED (全量部署)
        |     |     +--> ROLLED_BACK (回退到旧版本)
        |     |
        |     +--> REJECTED (测试未通过)
        |
        +--> FAILED (测试失败)
              |
              +--> ARCHIVED (归档)

DEPLOYED -> SUPERSEDED (被新版本取代)
DEPLOYED -> DEPRECATED (标记弃用，计划下线)
```

### 6.3 Prompt Versioning (Prompt 版本管理)

#### 6.3.1 Prompt 存储格式

所有 Prompt 模板以 YAML 文件形式存储在 Git 仓库 (`ctms-ai-prompts`)，通过 CI/CD 发布:

```yaml
# prompts/rag_prompts.yaml
rag-protocol-qa:
  current_version: "v3"
  versions:
    - version: "v1"
      version_hash: "sha256:aaa..."
      created_at: "2026-01-10"
      author: "AI Team"
      status: "deprecated"
      changes: "Initial version"

    - version: "v2"
      version_hash: "sha256:bbb..."
      created_at: "2026-03-05"
      author: "AI Team"
      status: "superseded"
      changes: "Added citation format requirements, improved structure"

    - version: "v3"
      version_hash: "sha256:ccc..."
      created_at: "2026-04-10"
      author: "AI Team + Clinical SME"
      status: "deployed"
      changes: "Added patient safety emphasis, improved confidence calibration, added suggested_followups"
      system_prompt: |
        You are a Clinical Research Knowledge Assistant...
      user_prompt_template: |
        ## Question
{query}

...
      output_schema:
        type: "json_object"
        required: ["answer_text", "citations", "confidence"]
```

#### 6.3.2 Prompt 版本哈希计算

```python
import hashlib
import yaml

def calculate_prompt_hash(prompt_config: dict) -> str:
    # 包含所有影响输出的字段
    hash_input = json.dumps({
        'system_prompt': prompt_config['system_prompt'],
        'user_prompt_template': prompt_config['user_prompt_template'],
        'output_schema': prompt_config.get('output_schema'),
        'temperature': prompt_config.get('temperature'),
        'max_tokens': prompt_config.get('max_tokens')
    }, sort_keys=True, ensure_ascii=False)
    return hashlib.sha256(hash_input.encode()).hexdigest()
```

#### 6.3.3 Prompt 审批流程

```
Developer 创建/修改 Prompt (Branch)
  |
  +--> 提交 PR 到 prompts 仓库
        |
        +--> CI 自动运行 Prompt Eval (离线测试集)
        |     +-- 通过: MRR > baseline * 0.95
        |     +-- 失败: 自动拒绝 PR
        |
        +--> Clinical SME Review (临床专家审核)
        |     +-- 审核医学准确性
        |     +-- 审核合规性
        |
        +--> AI Lead Approve -> Merge
              |
              +--> CD deploy to Staging
              +--> Staging 验证 (1-3 days)
              +--> CD deploy to Production (Canary -> Full)
```

### 6.4 A/B Testing (A/B 测试)

#### 6.4.1 测试架构

```
请求进入 (含 X-AB-Test-Group header)
  |
  +--> Group A (Control): 当前 Deployed 版本
  |     Model: deepseek-v4-pro:2026-04-15
  |     Prompt: rag-protocol-qa-v3
  |
  +--> Group B (Treatment): 新版本
        Model: deepseek-v4-pro:2026-05-01
        Prompt: rag-protocol-qa-v4 (candidate)

两组结果均返回给用户 (用户不知情, blind test)
AI Output Ledger 记录实验分组信息
离线对比指标: accuracy, acceptance_rate, hallucination_rate, user_rating
```

#### 6.4.2 A/B 配置

```yaml
# config/ab_tests.yaml
active_tests:
  - test_id: "ab-rag-prompt-v4-2026-05"
    description: "RAG prompt v4 A/B test"
    start_date: "2026-05-10"
    end_date: "2026-05-24"
    traffic_split:
      control: 0.90   # 90% 使用 v3
      treatment: 0.10 # 10% 使用 v4 candidate
    variants:
      control:
        prompt_name: "rag-protocol-qa"
        prompt_version: "v3"
      treatment:
        prompt_name: "rag-protocol-qa"
        prompt_version: "v4-candidate"
    success_criteria:
      - metric: "accuracy"
        min_improvement: 0.02  # 至少提升 2%
        p_value_threshold: 0.05
      - metric: "user_rating"
        min_improvement: 0.1   # 至少提升 0.1 星
```

### 6.5 Canary Deployment (金丝雀部署)

```
阶段 1: Registry - 模型已评估，APPROVED
  |
  +--> 阶段 2: Staging - 在 Staging 环境运行 1 day，人工抽查
        |
        +--> 阶段 3: Canary 5% - 5% 生产流量，监控 24h
              |
              +--> 阶段 4: Canary 25% - 25% 流量，监控 48h
                    |
                    +--> 阶段 5: Full Deploy - 100% 流量
                          |
                          +--> 旧模型标记为 SUPERSEDED, 保留 30 天用于回滚

Canary 阶段监控仪表板:
  - 响应延迟 (P50/P95/P99)
  - 错误率 / 超时率
  - 置信度分布 (compare canary vs stable)
  - 用户 reject 率
  - Token 消耗
```

### 6.6 Rollback (回滚机制)

| 触发条件 | 响应时间 | 回滚方式 |
|----------|----------|----------|
| 错误率 > 5% (连续 5 分钟) | 自动 (30s) | 切换到上一 Deployed 版本 |
| P95 延迟 > 3x 基线 | 自动 (60s) | 切换到上一 Deployed 版本 |
| 置信度均值下降 > 20% | 告警 + 人工确认 | 手动触发回滚 |
| 用户 reject 率 > 20% 激增 | 告警 + 人工确认 | 手动触发回滚 |
| 人工发现严重质量问题 | 立即 (手动) | Admin API 触发回滚 |

**回滚操作** (Prometheus + AlertManager -> Webhook -> Admin API):
```bash
POST /api/v1/admin/ai/models/rollback
{
  "model_name": "deepseek-v4-pro",
  "rollback_to_version": "2026-04-15",
  "reason": "P95 latency spike: 8.2s vs baseline 2.5s",
  "auto_triggered": true
}
```

### 6.7 Model & Prompt API

| # | Method | Path | Description |
|---|--------|------|-------------|
| 1 | GET | /api/v1/ai/model-versions | 模型版本列表 |
| 2 | GET | /api/v1/ai/model-versions/{name} | 特定模型版本历史 |
| 3 | PUT | /api/v1/ai/model-versions/{name}/deploy | 部署指定版本 |
| 4 | POST | /api/v1/ai/model-versions/{name}/rollback | 回滚模型 |
| 5 | GET | /api/v1/ai/prompt-versions | Prompt 版本列表 |
| 6 | GET | /api/v1/ai/prompt-versions/{name} | 特定 Prompt 版本历史 |
| 7 | POST | /api/v1/ai/prompt-versions/{name}/validate | 验证 Prompt (dry-run) |
| 8 | GET | /api/v1/ai/ab-tests | A/B 测试列表 |
| 9 | POST | /api/v1/ai/ab-tests | 创建 A/B 测试 |
| 10 | PUT | /api/v1/ai/ab-tests/{id}/complete | 完成 A/B 测试并选择 Winner |

**GET /api/v1/ai/model-versions 响应示例**:
```json
{
  "code": 200,
  "data": [
    {
      "model_name": "deepseek-v4-pro",
      "model_type": "llm",
      "current_version": "2026-04-15",
      "status": "deployed",
      "deployed_at": "2026-04-20T00:00:00Z",
      "total_versions": 3,
      "latest_evaluation": {
        "rag_accuracy": 91.5,
        "hallucination_rate": 3.8
      }
    }
  ]
}
```

---

## 7. AI Feedback Loop (AI 反馈闭环)

### 7.1 概述

AI 反馈闭环是系统持续改进的核心机制。通过收集用户对 AI 产出的确认(Confirm)、驳回(Reject)、修正(Correct)操作，形成从生产环境到训练数据的反馈链路，驱动模型和 Prompt 的迭代优化。所有反馈数据脱敏后存储，离线用于模型改进(非在线学习)。

### 7.2 反馈类型 (Feedback Types)

| 反馈类型 | 触发操作 | 记录内容 | 用途 |
|----------|----------|----------|------|
| Confirmation | 用户确认 AI 产出 | output_id, confirm_type (AS_IS / MODIFIED), 修改内容 diff | 正样本收集 |
| Rejection | 用户驳回 AI 产出 | output_id, reject_reason, reject_category | 负样本收集 + 错误模式分析 |
| Correction | 用户修正后确认 | output_id, original_output, corrected_output, correction_diff | 训练对 (input, corrected_output) |
| Rating | 用户评分 (1-5星) | output_id, rating, optional_comment | 用户满意度追踪 |
| Report | 用户主动反馈 (Bug/建议) | feedback_text, screenshot, category | 产品改进 |

### 7.3 反馈数据流 (Feedback Data Flow)

```
用户在 Java Backend 操作 (Confirm/Reject/Correct)
  |
  +--> Java Backend 更新 AI Output Ledger 状态
  |     |
  |     +-- status = CONFIRMED / REJECTED / SUPERSEDED
  |     +-- 记录 confirmed_by, confirmed_at, rejection_reason, rejection_category
  |
  +--> 每日批处理: Feedback Exporter (Java Backend)
  |     |
  |     +-- 提取过去 24h 的反馈数据
  |     +-- PII/PHI 脱敏 (replace subject_id with masked_id)
  |     +-- 序列化为 JSONL 文件
  |     +-- 上传到 MinIO: s3://ctms-feedback/{date}/feedback.jsonl
  |
  +--> AI 训练 Pipeline (离线, Python)
        |
        +-- 每周: 下载反馈数据
        +-- 数据清洗 (去重、去噪、质量控制)
        +-- 标注质量评估 (inter-rater agreement)
        +-- 构建训练/验证数据集
        +-- 重新训练/微调模型 (如适用)
        +-- 更新 Prompt (few-shot examples, rules)
        +-- 通过 CI/CD 发布新版本
```

### 7.4 驳回模式分析 (Rejection Pattern Analysis)

#### 7.4.1 驳回分类统计

系统自动统计每种 task_type 的驳回分类分布，识别改进优先领域:

```sql
-- 驳回分类分布仪表板查询
SELECT 
    task_type,
    rejection_category,
    COUNT(*) as count,
    COUNT(*) * 100.0 / SUM(COUNT(*)) OVER (PARTITION BY task_type) as pct
FROM ai_output_ledger
WHERE status = 'REJECTED'
  AND created_at >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY task_type, rejection_category
ORDER BY task_type, count DESC;
```

#### 7.4.2 驳回趋势监控

| 指标 | 计算方法 | 告警阈值 |
|------|----------|----------|
| 周驳回率 (Weekly Rejection Rate) | rejected_count / total_outputs in past 7 days | > 25% 触发告警 |
| 月度驳回率趋势 | rolling 30-day rejection rate | 连续 2 周上升 > 5pp 触发告警 |
| 低置信度驳回率 | rejected AND confidence < 0.7 / total | 持续 > 50% 表示置信度校准问题 |
| 高置信度驳回率 | rejected AND confidence > 0.9 / total | > 10% 表示模型 over-confident |
| 特定类别驳回激增 | 单周某 rejection_category 增长 > 100% | 触发该类别专项分析 |

### 7.5 训练数据改进 (Training Data Improvement)

#### 7.5.1 从确认/修正中构建训练对

```python
# feedback_to_training_data.py
def build_training_pairs(feedback_records):
    pairs = []
    for record in feedback_records:
        if record.status == 'CONFIRMED' and record.confirm_type == 'MODIFIED':
            # 修正后确认: (input, corrected_output) -> 高质量训练对
            pairs.append({
                'task_type': record.task_type,
                'input': reconstruct_input(record),
                'desired_output': record.corrected_output,
                'original_ai_output': record.ai_output,
                'quality': 'HIGH',  # 经人类专家修正
                'corrector_role': record.confirmed_by_role
            })
        elif record.status == 'REJECTED':
            # 驳回: (input, rejection_reason) -> 错误模式训练
            pairs.append({
                'task_type': record.task_type,
                'input': reconstruct_input(record),
                'ai_output': record.ai_output,
                'rejection_category': record.rejection_category,
                'quality': 'NEGATIVE'
            })
    return pairs
```

#### 7.5.2 数据集版本管理

| 数据集 | 内容 | 更新频率 | 大小 | 用途 |
|--------|------|----------|------|------|
| ctms-feedback-train-v{N} | 修正确认数据 (HIGH quality) | 每月 | ~5000 samples | 模型微调 |
| ctms-rejection-patterns-v{N} | 驳回案例分类库 | 每月 | ~2000 samples | Prompt 改进 + 规则补充 |
| ctms-eval-suite-v{N} | 标注评估集 (含人工评分) | 每季度 | ~1000 samples | 模型评估 |

### 7.6 AI 性能监控仪表板 (Performance Monitoring Dashboard)

#### 7.6.1 核心指标面板

| 指标类别 | 指标 | 可视化 | 告警 |
|----------|------|--------|------|
| 使用量 | AI 请求量 (按 task_type) | 时序折线图 | -- |
| 使用量 | 活跃用户数 | 时序折线图 | -- |
| 质量 | 周确认率 (confirmation rate) | 时序 + 仪表盘 | < 70% |
| 质量 | 周驳回率 (rejection rate) | 时序 + 仪表盘 | > 25% |
| 质量 | 平均用户评分 | 时序折线图 | < 3.5/5 |
| 质量 | 置信度-准确率校准曲线 | 校准图 (reliability diagram) | ECE > 0.15 |
| 性能 | P50/P95/P99 响应延迟 | 时序折线图 | P95 > 5s |
| 性能 | Token 消耗 (按模型) | 堆叠柱状图 | -- |
| 性能 | API Cost (按模型) | 时序 | 月度预算 80% 告警 |
| 模型 | 模型版本分布 | 饼图 | -- |
| 模型 | 驳回率按模型版本 | 分组柱状图 | 新版本驳回率 > 旧版本 * 1.5 |
| 反馈 | 驳回分类分布 | 堆叠柱状图 | -- |
| 反馈 | 驳回趋势 | 时序折线图 | 连续上升 |

#### 7.6.2 Prometheus 指标定义

```python
# FastAPI metrics middleware
from prometheus_client import Counter, Histogram, Gauge

# Request metrics
ai_requests_total = Counter(
    "ai_requests_total",
    "Total AI requests",
    ["task_type", "model_name", "model_version", "status"]
)

ai_request_duration_seconds = Histogram(
    "ai_request_duration_seconds",
    "AI request duration",
    ["task_type", "model_name"],
    buckets=[0.5, 1.0, 2.0, 3.0, 5.0, 8.0, 10.0, 15.0, 30.0]
)

ai_confidence_score = Histogram(
    "ai_confidence_score",
    "AI output confidence score distribution",
    ["task_type", "model_name"],
    buckets=[0.1, 0.2, ... , 0.9, 1.0]
)

ai_token_usage_total = Counter(
    "ai_token_usage_total",
    "Token usage (input + output)",
    ["model_name", "token_type"]  # token_type: input / output
)

# Feedback metrics (reported from Java Backend)
ai_feedback_total = Counter(
    "ai_feedback_total",
    "AI feedback count",
    ["task_type", "feedback_type", "rejection_category"]
)

ai_acceptance_rate = Gauge(
    "ai_acceptance_rate",
    "Rolling 7-day AI acceptance rate",
    ["task_type"]
)
```

### 7.7 未知格式模板注册 (New Template Registration)

当 OCR 系统遇到无法识别的文档格式时，系统触发以下流程:

```
OCR 置信度 < 0.5 或 输出标记为 UNKNOWN_FORMAT
  |
  +--> 自动截图 + 保存原始文档到 review queue
  |
  +--> 通知 DM/Admin: 发现未知文档格式
  |
  +--> DM 人工标注: 定义该格式的字段映射
  |     +-- 标注工具箱: 框选 ROI, 定义字段名, 数据类型, 验证规则
  |     +-- 保存为 Template Draft
  |
  +--> Template Review: Admin/DM Lead 审核
  |     +-- 通过 -> Template 状态 = APPROVED -> 加入 OCR 模板库
  |     +-- 需修改 -> 返回 DM 重新标注
  |
  +--> 新模板生效后，触发该格式历史文档重新 OCR
```

### 7.8 反馈闭环时间线 (Feedback Loop Timeline)

| 周期 | 活动 | 产出 | 责任人 |
|------|------|------|--------|
| 每日 | 反馈数据导出 + 脱敏 | JSONL 文件 | 自动化 (Java Backend) |
| 每周 | 反馈数据分析 + 驳回模式报告 | 分析报告 (Notebook) | AI Team |
| 每两周 | Prompt 优化 (基于驳回分析) | Prompt 候选版本 | AI Team + Clinical SME |
| 每月 | 训练数据集更新 | 新版本训练集 | AI Team |
| 每月 | 模型再训练 (如适用: 入组预测、风险评分) | 新版本模型 | AI/ML Team |
| 每季度 | 全面评估 + 模型升级决策 | Eval Report | AI Lead |
| 持续 | 用户满意度追踪 | Dashboard | Product Manager |

---

## 8. AI Service 部署与配置

### 8.1 Docker Compose (AI Service)

```yaml
# docker-compose.ai.yml
version: '3.8'
services:
  ai-service:
    image: registry.ctms.ai/ai-service:latest
    container_name: ctms-ai-service
    restart: unless-stopped
    ports:
      - "8000:8000"
    environment:
      - AI_SERVICE_ENV=production
      - OPENSEARCH_URL=https://opensearch.ctms.internal:9200
      - RABBITMQ_URL=amqp://ctms:password@rabbitmq.ctms.internal:5672
      - REDIS_URL=redis://redis.ctms.internal:6379/1
      - LLM_API_URL=https://api.deepseek.com/v1
      - LLM_API_KEY=${DEEPSEEK_API_KEY}
      - LLM_FALLBACK_URL=http://llm-local.ctms.internal:8000/v1
      - JWT_PUBLIC_KEY_PATH=/secrets/jwt-public.pem
      - PROMETHEUS_METRICS_ENABLED=true
    volumes:
      - ./models:/models:ro  # 只读挂载本地模型
      - ./secrets:/secrets:ro
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8000/health"]
      interval: 30s
      timeout: 10s
      retries: 3
    deploy:
      resources:
        reservations:
          devices:
            - driver: nvidia
              count: 1
              capabilities: [gpu]
    logging:
      driver: "json-file"
      options:
        max-size: "100m"
        max-file: "5"

  # Local LLM (备选, 处理 PII 场景)
  llm-local:
    image: vllm/vllm-openai:latest
    container_name: ctms-llm-local
    restart: unless-stopped
    ports:
      - "8001:8000"
    environment:
      - MODEL_NAME=Qwen3-72B-Instruct
      - HF_HOME=/models
    volumes:
      - ./models/qwen3-72b:/models/qwen3-72b:ro
    deploy:
      resources:
        reservations:
          devices:
            - driver: nvidia
              count: 4
              capabilities: [gpu]
    command: [
      "--model", "/models/qwen3-72b",
      "--tensor-parallel-size", "4",
      "--max-model-len", "32768",
      "--gpu-memory-utilization", "0.90"
    ]
```

### 8.2 FastAPI Settings (pydantic-settings)

```python
# config/settings.py
from pydantic_settings import BaseSettings
from typing import Optional

class Settings(BaseSettings):
    # Environment
    ai_service_env: str = "development"
    debug: bool = False

    # OpenSearch
    opensearch_url: str = "http://localhost:9200"
    opensearch_username: str = "admin"
    opensearch_password: str = "admin"
    opensearch_index_prefix: str = "dev"

    # RabbitMQ
    rabbitmq_url: str = "amqp://guest:guest@localhost:5672"
    rabbitmq_task_exchange: str = "ai.task.exchange"
    rabbitmq_result_exchange: str = "ai.result.exchange"

    # Redis
    redis_url: str = "redis://localhost:6379/0"

    # LLM
    llm_api_url: str = "https://api.deepseek.com/v1"
    llm_api_key: Optional[str] = None
    llm_default_model: str = "deepseek-v4-pro"
    llm_fallback_url: str = "http://localhost:8001/v1"
    llm_fallback_model: str = "Qwen3-72B-Instruct"
    llm_request_timeout: int = 60
    llm_max_retries: int = 2

    # Embedding
    embedding_dense_model: str = "BAAI/bge-large-zh-v1.5"
    embedding_sparse_model: str = "BAAI/bge-m3"
    embedding_device: str = "cuda:0"
    embedding_batch_size: int = 32

    # Reranker
    reranker_model: str = "BAAI/bge-reranker-v2-m3"
    reranker_top_n: int = 30
    reranker_return_k: int = 10

    # RAG
    rag_max_chunks: int = 8
    rag_max_context_tokens: int = 8000
    rag_conversation_max_messages: int = 20
    rag_search_size_dense: int = 50
    rag_search_size_sparse: int = 50
    rag_search_size_bm25: int = 50

    # JWT
    jwt_public_key_path: str = "/secrets/jwt-public.pem"
    jwt_algorithm: str = "RS256"

    # Prometheus
    prometheus_metrics_enabled: bool = True

    # Rate Limiting
    rate_limit_rag_per_minute: int = 30
    rate_limit_copilot_per_minute: int = 20

    class Config:
        env_file = ".env"
        env_prefix = "AI_SERVICE_"
```

---

## 9. 实施路线图 (Implementation Roadmap)

### Phase 1 (MVP, 8 weeks)

| 功能 | 优先级 | 估时 | 依赖 |
|------|--------|------|------|
| AI Service 基础框架 (FastAPI + RabbitMQ + Redis) | P0 | 2w | -- |
| Knowledge Base Q&A (RAG Core) | P0 | 3w | OpenSearch setup |
| Smart Study Summary (Copilot F1) | P1 | 1w | RAG Core |
| Query Suggestions (Copilot F3) | P1 | 1w | Embedding + Search |
| Model Registry + Prompt Versioning | P0 | 1w | -- |

### Phase 2 (12 weeks)

| 功能 | 优先级 | 估时 | 依赖 |
|------|--------|------|------|
| Visit Preparation Checklist (Copilot F4) | P1 | 2w | -- |
| Action Item Extraction (Copilot F6) | P1 | 1.5w | LLM |
| Weekly Report Generation | P1 | 2w | Copilot Summary |
| Risk Alerts (Copilot F2) | P1 | 2w | -- |
| Enrollment Prediction Model | P2 | 3w | 历史入组数据 >= 3个月 |
| Risk Scoring Engine | P2 | 2w | Risk Alerts |
| AI Feedback Loop v1 | P1 | 1.5w | 生产数据积累 |

### Phase 3 (16 weeks)

| 功能 | 优先级 | 估时 | 依赖 |
|------|--------|------|------|
| Monthly Safety Report | P1 | 2w | Weekly Report |
| Monitoring Report Draft (Copilot F5) | P2 | 3w | Action Item Extraction |
| Local LLM 部署 (Qwen3-72B) | P2 | 2w | GPU 资源 |
| A/B Testing Framework | P1 | 2w | -- |
| Canary Deployment Pipeline | P1 | 1w | -- |
| Performance Dashboard (Grafana) | P1 | 1.5w | Prometheus metrics |
| Feedback Loop v2 (自动训练数据构建) | P2 | 3w | Phase 2 反馈数据 |

---

## 10. 风险与缓解 (Risks & Mitigation)

| 风险 | 影响 | 概率 | 缓解措施 |
|------|------|------|----------|
| LLM API 不可用 (deepseek 宕机) | 所有 AI 功能不可用 | Low-Medium | 本地 LLM 备选 (Qwen3-72B) + Circuit Breaker |
| LLM 产生幻觉 (Hallucination) | 用户信任度下降 | Medium | RAG 引用强制验证 + 置信度 < 0.5 自动标记 LOW_CONFIDENCE + 人类审核 |
| OpenSearch 索引性能退化 | RAG 响应慢 | Low | 索引优化 (定期 force merge) + 水平扩展 |
| Embedding 模型更新导致向量不兼容 | RAG 检索失败 | Low | 索引版本管理 + 零停机重建 (alias switch) |
| 入组预测模型漂移 (Model Drift) | 预测偏差大 | Medium | 月度再训练 + 预测误差监控 + 业务侧提示 disclaimer |
| PII 泄露到 AI Service | 合规风险 | Low | 脱敏前置 (Java端) + Prompt 注入防护 + API 审计日志 |
| Prompt 注入攻击 | 越狱回答 | Low-Medium | Prompt 安全护栏 (system prompt 最高优先级) + 输入过滤 + LLM 输出审查 |

