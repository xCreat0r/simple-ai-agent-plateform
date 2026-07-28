# 架构文档

> 版本: v3.1 | 日期: 2026-07-28

## 概述

Simple AI Agent Platform 是一个轻量级多用户 AI Agent 管理平台。基于 Hono + Cloudflare Workers，前端使用 Vite + React 19，提供 Agent 创建/配置、流式对话、工具调用、知识库（RAG）和用户认证功能。

## 技术栈

| 层级 | 技术 | 版本 |
|------|------|------|
| Backend | Hono (Cloudflare Workers) | 4.7 |
| Frontend | React + Vite + Tailwind CSS + @base-ui/react | 19 / 8 / 4 |
| Language | TypeScript (strict) | 6 |
| Database | Cloudflare D1 (SQLite) | — |
| Vector DB | Cloudflare Vectorize (cosine, 1024d) | — |
| ORM | Drizzle ORM (SQLite dialect) | 0.45 |
| AI SDK | Vercel AI SDK + OpenAI SDK (DeepSeek) | 6 |
| Streaming | ReadableStream SSE | — |
| Embedding | 阿里云 DashScope (text-embedding-v3) | 1024 dims |
| Auth | Better Auth (邮箱+密码, SQLite adapter) | 1.x |
| Validation | Zod | 4 |
| Cache | Cloudflare KV (限流/配额) | — |
| Deploy | Cloudflare Workers + Pages | — |

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
        AuthAPI["/api/auth BetterAuth"]
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
            Auth["auth.ts"]
            Quota["quota.ts"]
            Errors["errors.ts"]
            RateLimit["rate-limit.ts"]
        end
    end

    subgraph Data["💾 数据存储"]
        direction LR
        D1["Cloudflare D1 (SQLite)"]
        VEC["Vectorize 1024d"]
        KV["KV 限流/配额"]
        DeepSeek["DeepSeek API"]
        DashScope["DashScope API"]
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
    Retriever --> VEC
    Embedding --> DashScope
    Provider --> DeepSeek
    Builtin --> SerpAPI

    Core --> D1
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

    subgraph API_PIPELINE["每个路由"]
        A["requireUser 认证"]
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

---

## 3. 数据模型（13 张表）

### 业务数据

```mermaid
%%{init: {'theme': 'base', 'themeVariables': {'fontSize': '10px'}}}%%
erDiagram
    users {
        text id PK
        text name
        text email UK
        integer email_verified
        integer created_at
        integer updated_at
    }

    agents {
        text id PK
        text user_id FK
        text name
        text system_prompt
        text model
        real temperature
        int max_tokens
        integer created_at
        integer updated_at
    }

    agent_tools {
        text agent_id PK_FK
        text tool_id PK_FK
    }

    chats {
        text id PK
        text agent_id FK
        text title
        integer created_at
    }

    messages {
        text id PK
        text chat_id FK
        text role
        text content
        text tool_calls
        text tool_result
        integer created_at
    }

    tools {
        text id PK
        text user_id FK
        text name
        text description
        text parameters
        text endpoint
        text method
        text headers
        integer created_at
        integer updated_at
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
        text id PK
        text name
        text email UK
    }

    knowledge_bases {
        text id PK
        text user_id FK
        text name
        integer created_at
    }

    knowledge_documents {
        text id PK
        text kb_id FK
        text filename
        text content
        integer created_at
    }

    knowledge_chunks {
        text id PK
        text doc_id FK
        text kb_id FK
        text content
    }

    agent_knowledge {
        text agent_id PK_FK
        text kb_id PK_FK
    }

    agents {
        text id PK
        text user_id FK
    }

    sessions {
        text id PK
        text user_id FK
        text token
        integer expires_at
    }

    accounts {
        text id PK
        text user_id FK
        text provider_id
        text password
    }

    verifications {
        text id PK
        text identifier
        integer expires_at
    }

    users ||--o{ knowledge_bases : "创建"
    users ||--o{ sessions : "拥有"
    users ||--o{ accounts : "拥有"
    users ||--o| verifications : "验证"
    knowledge_bases ||--o{ knowledge_documents : "包含"
    knowledge_documents ||--o{ knowledge_chunks : "切片"
    agents ||--o{ agent_knowledge : "绑定"
    knowledge_bases ||--o{ agent_knowledge : "被引用"
```

---

## 4. 对话核心流程

```mermaid
%%{init: {'theme': 'base', 'themeVariables': {'fontSize': '10px'}, 'sequence': {'width': 650, 'actorMargin': 30, 'messageMargin': 18}}}%%
sequenceDiagram
    actor U as 用户
    participant FE as React 前端
    participant API as /api/chat (Hono)
    participant DB as D1 (SQLite)
    participant LLM as DeepSeek
    participant RAG as 知识检索
    participant Tool as 工具系统

    U->>FE: 输入消息
    FE->>API: POST { agentId, chatId, content }

    Note over API: 安全校验
    API->>API: checkRateLimit (KV)
    API->>API: requireUser (Better Auth)
    API->>DB: 查 Agent (userId 隔离)
    API->>API: checkQuota

    Note over API: 准备上下文
    API->>DB: 新建/复用 Chat
    API->>DB: INSERT user message
    API->>DB: buildContext (近20条消息)

    loop 每个绑定知识库
        API->>RAG: retrieveContext(kbId, query)
        RAG->>RAG: generateEmbedding → DashScope
        RAG->>VEC: Vectorize 余弦检索
        VEC-->>API: Top-K 文本块
    end

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
    API->>API: generateChatTitle (10字)
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
    participant DB as D1

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
│   ├── index.ts              # Hono 应用入口 (CORS + 路由 + onError)
│   ├── routes/
│   │   ├── _middleware.ts     # requireUser 认证 + AuthError
│   │   ├── auth.ts            # /api/auth (Better Auth)
│   │   ├── agents.ts          # /api/agents CRUD
│   │   ├── chat.ts            # /api/chat SSE 流式
│   │   ├── chats.ts           # /api/chats CRUD
│   │   ├── tools.ts           # /api/tools CRUD
│   │   ├── knowledge.ts       # /api/knowledge CRUD + 文档上传
│   │   └── health.ts          # /api/health
│   └── lib/
│       ├── ai/
│       │   ├── provider.ts    # DeepSeek 客户端 + AI SDK
│       │   ├── embedding.ts   # DashScope 嵌入
│       │   ├── chunker.ts     # 分块 (800/100)
│       │   └── retriever.ts   # Vectorize 余弦检索
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
│       │   ├── index.ts           # Drizzle + D1 适配
│       │   ├── helpers.ts         # findById / syncManyToMany
│       │   └── schema/            # 13 张表
│       ├── auth.ts               # Better Auth 配置
│       ├── config.ts             # 统一配置
│       ├── env-holder.ts         # Cloudflare env 注入
│       ├── errors.ts             # 统一错误响应
│       ├── logger.ts             # 日志
│       ├── quota.ts              # 配额
│       ├── rate-limit.ts         # KV 限流
│       ├── validate.ts           # Zod 包装
│       ├── validators.ts         # Zod Schema
│       └── types.ts              # 类型定义
├── scripts/
│   └── seed.ts                   # 管理员初始化（参考）
├── wrangler.jsonc
├── drizzle.config.ts
└── package.json

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
    participant Auth as Better Auth
    participant DB as D1

    U->>B: 访问 /agents
    B->>API: GET /api/agents
    API->>Auth: getSession (cookie)
    Auth-->>API: null
    API-->>B: AuthError → 401

    U->>B: /login 邮箱 + 密码
    B->>API: POST /api/auth/sign-in
    API->>Auth: signIn.email()
    Auth->>DB: 校验用户
    Auth->>DB: INSERT sessions
    Auth-->>B: set cookie + user

    U->>B: 再次访问 /agents
    B->>API: GET /api/agents + cookie
    API->>Auth: getSession ✓
    API->>DB: SELECT ... WHERE user_id = ?

    Note over DB: 后续查询都带 WHERE user_id
```

---

## 环境变量

| 变量 | 必填 | 说明 |
|------|:--:|------|
| `DEEPSEEK_API_KEY` | ✅ | DeepSeek API Key |
| `BETTER_AUTH_SECRET` | ✅ | Auth 加密密钥 (`openssl rand -base64 32`) |
| `BETTER_AUTH_URL` | ✅ | 应用 URL |
| `DEEPSEEK_BASE_URL` | 可选 | DeepSeek API 地址（默认 `https://api.deepseek.com/v1`） |
| `SERPAPI_API_KEY` | 可选 | 网页搜索（不配则工具不可用） |
| `BAILIAN_API_KEY` | 可选 | 文本嵌入（不配则知识库不可用） |

Cloudflare 绑定（通过 `wrangler.jsonc` 配置，非环境变量）：
- `DB` — D1 数据库
- `VECTORIZE` — Vectorize 索引
- `RATE_LIMIT_KV` — 限流 KV
- `QUOTA_KV` — 配额 KV

---

## 部署

参见 [cloudflare-deployment.md](cloudflare-deployment.md)。
