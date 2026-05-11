# CTMS - Clinical Trial Management System

临床研究项目运营管理平台（PMS/CTMS），连接申办方、CRO、临床机构、研究者与受试者。

## 技术栈

| 层 | 技术 |
|----|------|
| 主业务后端 | Java 21 + Spring Boot 3 + MyBatis Plus + Flowable |
| 管理端 Web | Next.js 14 + TypeScript + Ant Design + React Query |
| 患者端 | Taro + React + TypeScript（微信小程序） |
| AI/OCR 服务 | Python 3.12 + FastAPI + PaddleOCR |
| 数据库 | MySQL 8.0 |
| 缓存/队列 | Redis 7 + RabbitMQ 3 |
| 搜索引擎 | OpenSearch 2 |
| 对象存储 | MinIO |
| 部署 | Docker Compose（开发）+ Kubernetes + Helm（生产） |

## 快速开始（Docker 方式，推荐）

### 前置条件

- **Docker Desktop** — 运行所有基础设施
- **Java 21** — 运行后端（或使用 IDE 内置 Maven）
- **Node.js 20+ / pnpm** — 运行管理端

### 1. 启动基础设施

```bash
docker compose up -d
```

启动 MySQL、Redis、RabbitMQ、MinIO、OpenSearch（首次需拉取镜像，约 2-3 分钟）。

### 2. 启动后端 API

```bash
cd apps/api

# Windows (无需安装 Maven):
mvnw.cmd spring-boot:run

# Mac / Linux:
./mvnw spring-boot:run
```

API 启动后访问：
- 健康检查：http://localhost:8080/actuator/health
- Swagger 文档：http://localhost:8080/swagger-ui.html

### 3. 启动管理端

```bash
cd apps/web
pnpm install
pnpm dev
```

管理端：http://localhost:3000

### 4. 启动 AI 服务（可选）

```bash
cd apps/ai-service
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

AI 服务文档：http://localhost:8000/docs

### 默认账号

| 用户名 | 密码 | 角色 |
|--------|------|------|
| `admin` | `admin123` | 系统管理员/PM/CRA |

### 基础设施管理页面

| 服务 | 地址 | 账号 |
|------|------|------|
| MinIO Console | http://localhost:9001 | minioadmin / minioadmin |
| RabbitMQ Mgmt | http://localhost:15672 | guest / guest |
| OpenSearch Dashboards | http://localhost:5601 | 无需登录 |

### 使用已有 MySQL

如果本地已运行 MySQL，注释 `docker-compose.yml` 中的 mysql 服务：

```yaml
  # 注释掉 mysql 服务块：
  # mysql:
  #   ...
```

然后在 `apps/api/src/main/resources/application.yml` 中修改数据库连接信息。

### Docker 全容器模式

后端也可容器化运行（需先构建）：

```bash
# 构建 API 镜像
cd apps/api
./mvnw package -DskipTests
docker build -t ctms-api .

# 在 docker-compose.yml 中追加 api 服务，或：
docker run -p 8080:8080 --network pms_default ctms-api
```

## 项目结构

```
├── apps/
│   ├── api/                # Java Spring Boot 主业务后端 (42 Java 文件)
│   │   ├── src/main/java/com/ctms/
│   │   │   ├── controller/ # REST Controller (8 个)
│   │   │   ├── service/    # 业务逻辑 + 状态机
│   │   │   ├── entity/     # 数据实体 (7 个)
│   │   │   ├── mapper/     # MyBatis Plus Mapper (7 个)
│   │   │   ├── enums/      # 状态枚举
│   │   │   ├── security/   # JWT + Spring Security
│   │   │   ├── config/     # MyBatis/Security 配置
│   │   │   └── common/     # ApiResponse/ErrorCode/异常处理
│   │   ├── src/main/resources/
│   │   │   ├── application.yml
│   │   │   ├── application-docker.yml
│   │   │   └── db/migration/  # Flyway SQL
│   │   ├── mvnw / mvnw.cmd  # Maven Wrapper (无需安装 Maven)
│   │   └── pom.xml
│   ├── web/                # Next.js 管理端
│   └── ai-service/         # Python FastAPI AI/OCR 服务
├── docs/                   # 14 份设计文档 (~31,000 行)
│   └── INDEX.md            # 总目录与一致性校验报告
├── docker-compose.yml      # 本地开发基础设施
└── README.md
```

## 核心 API 端点

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/v1/auth/login` | 登录获取 JWT |
| POST | `/api/v1/auth/refresh` | 刷新 Token |
| GET/POST | `/api/v1/studies` | 研究项目管理 |
| PUT | `/api/v1/studies/{id}/status` | 研究状态流转 |
| GET/POST | `/api/v1/sites` | 中心管理 |
| GET/POST | `/api/v1/subjects` | 受试者管理 |
| GET/POST | `/api/v1/visits` | 访视管理 |
| GET/POST | `/api/v1/aes` | 不良事件 |
| GET/POST | `/api/v1/queries` | 数据质疑 |
| POST | `/api/v1/files/upload-url` | 获取文件上传 URL |

完整 API 文档见 Swagger UI 或 [docs/round3-api.md](docs/round3-api.md)

## 开发状态

- [x] 设计文档完整（14 份 / 31,000 行）
- [x] 数据库 DDL（12 张核心表 + Flyway 自动迁移）
- [x] Java 后端 42 文件可编译运行
- [x] Next.js 管理端基础页面可运行
- [x] Python AI 服务骨架就绪
- [x] Docker Compose 一键启动基础设施
- [ ] Taro 患者端小程序
- [ ] Flowable 工作流 BPMN 定义
- [ ] K8s Helm Chart
