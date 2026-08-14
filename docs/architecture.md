# 架构文档

> 版本: v4.0 | 日期: 2026-08-08
> 本文档描述**当前代码实际实现**的架构。若与历史文档（D1 / Vectorize / Better Auth 等）不一致，以本文件与代码为准。

## 概述

Simple AI Agent Platform 是一个轻量级多用户 AI Agent 管理平台。基于 Hono + Cloudflare Workers，前端使用 Vite + React 19，提供 Agent 创建/配置、流式对话、工具调用、知识库（RAG）和用户认证功能。

## 技术栈

| 层级 | 技术 | 版本 |
|------|------|------|
| Backend | Hono (Cloudflare Workers) | 4.7 |
| Frontend | React + Vite + Tailwind CSS + @base-ui/react | 19 / 8 / 4 |
| Language | TypeScript (strict) | 6 |
| Database | PostgreSQL（Cloudflare Hyperdrive 代理，本地用 postgres.js 直连） | 18+ |
| Vector DB | PostgreSQL pgvector (cosine, 1024d) | — |
| ORM | Drizzle ORM (postgres-js adapter, pg-core) | 0.45 |
| AI SDK | OpenAI SDK / Vercel AI SDK (DeepSeek) | 6 |
| Streaming | ReadableStream SSE | — |
| Embedding | workers-ai (@cf/baai/bge-m3) / DashScope (text-embedding-v3) / mock，三选一 | — |
| Auth | 自研 JWT (jose) + refresh token 轮换 + bcryptjs 密码哈希 | — |
| PDF 解析 | Worker 内本地解析（unpdf / PDF.js serverless），无独立服务 | — |
| Validation | Zod | 4 |
| Cache | Cloudflare KV（限流） | — |
| Deploy | Cloudflare Workers + Pages | — |

> 说明：本文档不含 D1 / Cloudflare Vectorize / Better Auth。数据库为 PostgreSQL（含 pgvector），认证为自研 JWT，嵌入通过 `EMBEDDING_PROVIDER` 切换。

---

## 1. 系统分层架构

```mermaid
%%{init: {'theme': 'base', 'themeVariables': {'fontSize': '10px'}, 'flowchart': {'useMaxWidth': true, 'nodeSpacing': 30, 'rankSpacing': 40}}}%%
graph TB
    subgraph Client["🖥 客户端层"]
        direction LR
        Browser["React 19 + Vite"]
        Pages["pages/agents, tools, knowledge"]
    end

    subgraph API["🔌 API 层 (Hono)"]
        direction LR
        ChatAPI["/api/chat SSE"]
        AgentsAPI["/api/agents CRUD"]
        ToolsAPI["/api/tools CRUD"]
        KbAPI["/api/knowledge CRUD"]
        ChatsAPI["/api/chats CRUD"]
        AuthAPI["/api/auth JWT"]
    end

    subgraph Core["🧠 核心逻辑层 lib/"]
        direction LR
        subgraph AI_Lib["ai/"]
            Provider["provider.ts"]
            Embedding["embedding.ts"]
            Chunker["chunker.ts"]
            Retriever["retriever.ts"]
        end
        subgraph Chat_Lib["chat/"]
            Context["build-context.ts"]
            Retrieve["retrieve.ts"]
            ToolLoop["tool-loop.ts 5轮"]
        end
        subgraph Tools_Lib["tools/"]
            Builtin["web_search / web_request"]
            DBTools["db-tools.ts 动态代理"]
            Guard["url-guard.ts SSRF"]
        end
        subgraph Shared["共享模块"]
            Auth["auth.ts (JWT)"]
            Quota["quota.ts (DB 统计)"]
            Errors["errors.ts"]
            RateLimit["rate-limit.ts (KV)"]
        end
    end

    subgraph Data["💾 数据存储"]
        direction LR
        PG["PostgreSQL (pgvector)"]
        KV["KV 限流"]
        Base["PDF 本地解析 (unpdf)"]
        DeepSeek["DeepSeek API"]
        EmbedAPI["Workers AI / DashScope"]
        SerpAPI["SerpAPI"]
    end

    Browser --> Pages
    Pages --> API
    API --> Core
    ChatAPI --> Chat_Lib
    Chat_Lib --> AI_Lib
    Chat_Lib --> Tools_Lib
    Tools_Lib --> Guard
    Retriever --> Embedding
    Retriever --> PG
    Embedding --> EmbedAPI
    Provider --> DeepSeek
    Builtin --> SerpAPI
    KbAPI --> Base

    Core --> PG
    Core --> KV

    style Client fill:#e3f2fd,stroke:#1565c0
    style API fill:#e8f5e9,stroke:#2e7d32
    style Core fill:#f3e5f5,stroke:#7b1fa2
    style Data fill:#fce4ec,stroke:#c62828
```

---

## 2. 安全与错误处理

### 请求处理流水线

```mermaid
%%{init: {'theme': 'base', 'themeVariables': {'fontSize': '10px'}, 'flowchart': {'useMaxWidth': true, 'nodeSpacing': 25, 'rankSpacing': 35}}}%%
flowchart TD
    R["HTTP 请求"] --> COR["CORS 中间件<br/>origin + credentials"]
    COR --> ONERR["onError 全局异常处理<br/>AuthError → 401<br/>其他 → 500"]

    ONERR --> API["API 路由"]

    subgraph API_PIPELINE["每个受保护路由"]
        A["requireUser 认证<br/>Bearer accessToken (JWT)"]
        L["checkRateLimit 限流 (KV)"]
        Z["parseBody Zod 校验"]
        OWN["所有权校验 WHERE user_id = ?"]
        BIZ["业务逻辑"]
        A --> L --> Z --> OWN --> BIZ
    end

    API --> API_PIPELINE
    BIZ --> RESP["JSON / SSE 响应"]

    style ONERR fill:#fff3e0,stroke:#e65100
    style API fill:#e8f5e9,stroke:#2e7d32
```

认证错误通过 `AuthError` throw + `app.onError` 全局处理器捕获，返回 `401`。非认证错误返回 `500`。

- 访问令牌（access token）：短期 JWT（15 分钟），由客户端放在 `Authorization: Bearer` 头传递（`src/lib/jwt.ts`）。
- 刷新令牌（refresh token）：256bit 随机串，存库并写入 HttpOnly Cookie，7 天有效期，刷新时一次性轮换（`src/routes/auth.ts`）。
- 密码使用 bcrypt 加盐哈希存储，绝不明文保存。
- 数据隔离：所有查询都以当前 `userId` 为前缀过滤（`WHERE user_id = ?`），资源归属不符返回 404（不暴露存在性）。

---

## 3. 数据模型（11 张表）

### 业务数据

```mermaid
%%{init: {'theme': 'base', 'themeVariables': {'fontSize': '10px'}}}%%
erDiagram
    users {
        uuid id PK
        text name
        text email UK
        boolean email_verified
        text image
        text password_hash
        text provider
        text provider_id
        timestamp created_at
        timestamp updated_at
    }

    agents {
        uuid id PK
        uuid user_id FK
        text name
        text system_prompt
        text model
        double temperature
        int max_tokens
        timestamp created_at
        timestamp updated_at
    }

    agent_tools {
        uuid agent_id PK_FK
        text tool_id PK_FK
    }

    chats {
        uuid id PK
        uuid agent_id FK
        text title
        timestamp created_at
    }

    messages {
        uuid id PK
        uuid chat_id FK
        text role
        text content
        jsonb tool_calls
        jsonb tool_result
        timestamp created_at
    }

    tools {
        uuid id PK
        uuid user_id FK
        text name
        text description
        jsonb parameters
        text endpoint
        text method
        jsonb headers
        timestamp created_at
        timestamp updated_at
    }

    users ||--o{ agents : "创建"
    users ||--o{ tools : "创建"
    agents ||--o{ chats : "包含"
    agents ||--o{ agent_tools : "绑定"
    tools ||--o{ agent_tools : "被引用"
    chats ||--o{ messages : "包含"
```

### 知识库 + 认证

```mermaid
%%{init: {'theme': 'base', 'themeVariables': {'fontSize': '10px'}}}%%
erDiagram
    users {
        uuid id PK
        text name
        text email UK
    }

    knowledge_bases {
        uuid id PK
        uuid user_id FK
        text name
        timestamp created_at
    }

    knowledge_documents {
        uuid id PK
        uuid kb_id FK
        text filename
        int size_bytes
        text status
        text error
        timestamp created_at
    }

    knowledge_chunks {
        uuid id PK
        uuid doc_id FK
        uuid kb_id FK
        text content
        int chunk_index
        vector embedding
        timestamp created_at
    }

    agent_knowledge {
        uuid agent_id PK_FK
        uuid kb_id PK_FK
    }

    agents {
        uuid id PK
        uuid user_id FK
    }

    refresh_tokens {
        text id PK
        text token UK
        uuid user_id FK
        timestamp expires_at
        timestamp created_at
    }

    users ||--o{ knowledge_bases : "创建"
    users ||--o{ refresh_tokens : "拥有"
    knowledge_bases ||--o{ knowledge_documents : "包含"
    knowledge_documents ||--o{ knowledge_chunks : "切片"
    agents ||--o{ agent_knowledge : "绑定"
    knowledge_bases ||--o{ agent_knowledge : "被引用"
```

> 级联删除：`knowledge_documents` / `knowledge_chunks` 依赖 `kb_id` 与 `doc_id` 的 `onDelete: cascade`，删除知识库或文档时级联清理分块与向量，无孤儿数据。

---

## 4. 对话核心流程

```mermaid
%%{init: {'theme': 'base', 'themeVariables': {'fontSize': '10px'}, 'sequence': {'width': 650, 'actorMargin': 30, 'messageMargin': 18}}}%%
sequenceDiagram
    actor U as 用户
    participant FE as React 前端
    participant API as /api/chat (Hono)
    participant DB as PostgreSQL
    participant LLM as DeepSeek
    participant RAG as 知识检索
    participant Tool as 工具系统

    U->>FE: 输入消息
    FE->>API: POST { agentId, chatId, content }

    Note over API: 安全校验
    API->>API: checkRateLimit (KV)
    API->>API: requireUser (Bearer JWT)
    API->>DB: 查 Agent (userId 隔离)
    API->>API: checkQuota (DB 统计当日对话)

    Note over API: 准备上下文
    API->>DB: 新建/复用 Chat
    API->>DB: INSERT user message
    API->>DB: buildContext (近20条消息)

    Note over API: RAG 注入（失败时回退普通回答）
    API->>RAG: injectKnowledgeContext(绑定 KB)
    RAG->>RAG: generateEmbedding → Workers AI / DashScope
    RAG->>DB: pgvector 余弦检索 (topK + 阈值)
    DB-->>API: 相关分块 + 来源文件名

    Note over API: 工具循环 (最多 5 轮)
    loop step 0..4
        API->>LLM: chat.completions.create(stream)
        LLM-->>API: SSE 流式
        API-->>FE: SSE 转发

        alt 无 tool_calls
            API->>DB: INSERT assistant
        else 有 tool_calls
            API->>DB: INSERT assistant + tool_calls
            loop 每个工具
                API->>Tool: execute(args)
                Tool-->>API: 结果
                API->>DB: INSERT tool message
            end
        end
    end
    API->>API: generateChatTitle (异步, 10字)
```

---

## 5. 工具调用循环

```mermaid
%%{init: {'theme': 'base', 'themeVariables': {'fontSize': '9px'}, 'sequence': {'width': 650, 'actorMargin': 30, 'messageMargin': 15}}}%%
sequenceDiagram
    participant Loop as tool-loop.ts
    participant LLM as DeepSeek
    participant Tool as getTool()
    participant Builtin as 内置工具
    participant DBTool as 自定义工具
    participant Guard as url-guard.ts
    participant DB as PostgreSQL

    Note over Loop: 最多 5 轮

    Loop->>LLM: completions.create(stream, tools)
    LLM-->>Loop: 流式文本块

    alt 有 tool_calls
        Loop->>DB: INSERT assistant + tool_calls

        loop 每个 tool_call
            Loop->>Tool: getTool(name)

            alt web_search (内置)
                Tool->>Builtin: search-execute.ts
                Builtin->>Builtin: fetch SerpAPI
                Builtin-->>Tool: top 5 结果
            else web_request (内置)
                Tool->>Builtin: web-request-execute.ts
                Builtin->>Guard: validateExternalUrlWithDNS
                Guard-->>Builtin: 放行
                Builtin->>Builtin: fetch (redirect:error)
                Builtin-->>Tool: 文本 ≤2000字
            else 自定义工具 (DB)
                Tool->>DBTool: db-tools.ts
                DBTool->>Guard: validate + sanitizeHeaders
                DBTool->>DBTool: fetch (redirect:error)
                DBTool-->>Tool: 文本 ≤2000字
            end

            Tool-->>Loop: 结果
            Loop->>DB: INSERT tool message
        end
    end
```

---

## 6. 目录结构

```
backend/
├── src/
│   ├── index.ts              # Hono 应用入口 (CORS + onError + DB 生命周期 + 路由)
│   ├── routes/
│   │   ├── _middleware.ts     # requireUser (Bearer JWT) + AuthError
│   │   ├── auth.ts            # /api/auth 注册/登录/刷新/登出/会话
│   │   ├── agents.ts          # /api/agents CRUD
│   │   ├── chat.ts            # /api/chat SSE 流式
│   │   ├── chats.ts           # /api/chats CRUD + 消息分页
│   │   ├── tools.ts           # /api/tools CRUD
│   │   ├── knowledge.ts       # /api/knowledge CRUD + 文档上传/解析/异步嵌入
│   │   └── health.ts          # /api/health
│   └── lib/
│       ├── ai/
│       │   ├── provider.ts    # DeepSeek 客户端
│       │   ├── embedding.ts   # workers-ai / dashscope / mock
│       │   ├── chunker.ts     # 分块 (800/300/100)
│       │   └── retriever.ts   # pgvector 余弦检索
│       ├── chat/
│       │   ├── build-context.ts   # 消息 → LLM 上下文
│       │   ├── retrieve.ts        # 知识库注入
│       │   ├── tool-loop.ts       # 多轮工具循环
│       │   └── generate-title.ts  # LLM 生成标题
│       ├── tools/
│       │   ├── types.ts           # Tool 接口
│       │   ├── index.ts           # 内置工具注册
│       │   ├── search.ts / search-execute.ts
│       │   ├── web-request.ts / web-request-execute.ts
│       │   ├── db-tools.ts        # 自定义工具代理
│       │   └── url-guard.ts       # SSRF 防护
│       ├── db/
│       │   ├── index.ts           # postgres.js + Drizzle + AsyncLocalStorage
│       │   ├── helpers.ts         # findById / syncManyToMany
│       │   └── schema/            # 11 张表
│       ├── util/
│       │   ├── encoding.ts        # UTF-8 / GBK 自动解码
│       │   ├── text.ts            # 分块去重
│       │   └── uuid.ts
│       ├── jwt.ts               # access token (jose) + refresh token 生成
│       ├── config.ts             # 统一配置
│       ├── env-holder.ts         # Cloudflare env 注入
│       ├── errors.ts             # 统一错误响应
│       ├── logger.ts             # 日志
│       ├── quota.ts              # 配额 (DB 统计当日对话 / 存储用量)
│       ├── rate-limit.ts         # KV 限流
│       ├── validate.ts           # Zod 包装
│       ├── validators.ts         # Zod Schema
│       └── types.ts              # 类型定义
├── scripts/
│   └── seed.ts                   # 初始化（参考）
├── wrangler.jsonc
├── drizzle.config.ts
└── package.json

services/
└── base/                       # 【已停用】PDF 解析服务 (Python FastAPI + PyMuPDF)，代码保留作参考/回退
    ├── app/
    │   ├── main.py             # GET /health + POST /doc-parser/parse
    │   └── pdf_parser.py       # PyMuPDF 文字层提取
    ├── docker/Dockerfile
    ├── pyproject.toml
    └── run.py                  # 本地运行入口

frontend/
├── src/
│   ├── App.tsx               # 路由 + Auth + QueryClient
│   ├── main.tsx              # 入口
│   ├── pages/                # agents / tools / knowledge / login / signup
│   ├── components/           # chat / ui / sidebar / empty-state / confirm-dialog
│   ├── hooks/                # useChat (SSE)
│   └── lib/                  # api / auth / types / utils
├── vite.config.ts
└── package.json
```

---

## 7. 认证流程

```mermaid
%%{init: {'theme': 'base', 'themeVariables': {'fontSize': '10px'}, 'sequence': {'width': 600, 'actorMargin': 30, 'messageMargin': 18}}}%%
sequenceDiagram
    actor U as 用户
    participant B as React 前端
    participant API as Hono API
    participant Auth as auth.ts (JWT)
    participant DB as PostgreSQL

    U->>B: 访问 /agents
    B->>API: GET /api/agents (Bearer accessToken)
    API->>Auth: verifyAccessToken
    Auth-->>API: 无效/过期
    API-->>B: AuthError → 401

    U->>B: /login 邮箱 + 密码
    B->>API: POST /api/auth/sign-in/email
    API->>Auth: bcrypt 校验
    Auth->>DB: 查用户 + password_hash 比对
    Auth->>DB: INSERT refresh_tokens
    Auth-->>B: accessToken (JSON) + refresh_token (HttpOnly Cookie)

    U->>B: 再次访问 /agents
    B->>API: GET /api/agents + Bearer accessToken
    API->>Auth: verifyAccessToken ✓
    API->>DB: SELECT ... WHERE user_id = ?

    Note over DB: 后续查询都带 WHERE user_id

    Note over B,API: accessToken 过期后
    B->>API: POST /api/auth/refresh (Cookie)
    API->>DB: 校验 refresh token → 删除旧 token
    API->>DB: INSERT 新 refresh token（轮换）
    API-->>B: 新 accessToken + 新 Cookie
```

---

## 环境变量

| 变量 | 必填 | 说明 |
|------|:--:|------|
| `DEEPSEEK_API_KEY` | ✅ | DeepSeek API Key |
| `DEEPSEEK_BASE_URL` | 可选 | DeepSeek API 地址（默认 `https://api.deepseek.com/v1`） |
| `JWT_SECRET` | ✅ | access token 签名密钥 (`openssl rand -base64 32`) |
| `SERPAPI_API_KEY` | 可选 | 网页搜索（不配则工具不可用） |
| `EMBEDDING_PROVIDER` | 可选 | 嵌入服务：`workers-ai`（默认）/ `dashscope` / `mock`（仅本地调试；失败不再自动降级，生产失败即标记文档 failed） |
| `DASHSCOPE_API_KEY` | 按需 | 阿里云百炼 Key（`EMBEDDING_PROVIDER=dashscope` 时需要） |
| `DASHSCOPE_BASE_URL` | 可选 | DashScope 兼容地址（默认官方） |
| `DASHSCOPE_EMBEDDING_MODEL` | 可选 | 默认 `text-embedding-v3`（1024 维，与 schema 匹配） |
| `DATABASE_URL` | 本地开发 | 本地 PostgreSQL 连接串（生产用 Hyperdrive） |

知识库检索参数（可选，见 `src/lib/config.ts`）：`KNOWLEDGE_TOP_K`、`KNOWLEDGE_SIMILARITY_THRESHOLD`（cosine **距离**阈值，越小越严格）、`KNOWLEDGE_CHUNK_MAX_CHARS` / `MIN_CHARS` / `OVERLAP`、`KNOWLEDGE_EMBEDDING_BATCH_SIZE`、`KNOWLEDGE_MAX_FILE_SIZE`（默认 5MB）、`KNOWLEDGE_MAX_PDF_PAGES`（默认 100）。配额与限流参数：`QUOTA_FREE_*`、`RATE_LIMIT_*`。

Cloudflare 绑定（通过 `wrangler.jsonc` 配置，非环境变量）：
- `HYPERDRIVE` — 连接 PostgreSQL（含 pgvector）
- `RATE_LIMIT_KV` — 限流 KV
- `QUOTA_KV` — 配额 KV（按天计数真实请求次数）
- `AI` — Workers AI 嵌入（`EMBEDDING_PROVIDER=workers-ai` 时需要）

Cron 触发器（`wrangler.jsonc` `triggers`）：
- `0 */6 * * *` — 每 6 小时回收超时（>30 分钟）卡在 `processing` 的知识库文档，标记为 `failed`（见 `recoverStaleProcessingDocs`）

---

## 部署

- Cloudflare Workers + Pages：参见 [cloudflare-deployment.md](cloudflare-deployment.md)
- PDF 解析在 Worker 内本地完成（unpdf），无需独立服务；base 服务（ECS，已停用）部署参见 [ecs-deployment.md](ecs-deployment.md)
