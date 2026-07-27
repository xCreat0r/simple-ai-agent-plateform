# 架构文档

> 版本: v3.0 | 日期: 2026-07-26

## 概述

Simple AI Agent Platform 是一个轻量级多用户 AI Agent 管理平台。基于 Next.js 16 App Router，提供 Agent 创建/配置、流式对话、工具调用、知识库（RAG）和用户认证功能。

## 技术栈

| 层级 | 技术 | 版本 |
|------|------|------|
| Framework | Next.js (App Router) | 16 |
| UI | React + Tailwind CSS + shadcn/ui | 19 / 4 |
| Language | TypeScript (strict) | 6 |
| Database | PostgreSQL + pgvector | 18 |
| ORM | Drizzle ORM | 0.45 |
| AI SDK | OpenAI SDK (DeepSeek) | 6 |
| Streaming | ReadableStream SSE | — |
| Embedding | 阿里云 DashScope (text-embedding-v3) | 1024 dims |
| Auth | Better Auth (邮箱+密码) | 1.x |
| Validation | Zod | 4 |

---

## 1. 系统分层架构

```mermaid
graph TB
    subgraph 客户端["🖥 客户端层"]
        direction LR
        Browser["浏览器<br/>React 19 客户端组件"]
        PageAgent["agents/page.tsx<br/>服务端直查 DB"]
        PageKB["knowledge/page.tsx"]
        PageTools["tools/page.tsx"]
    end

    subgraph 中间件["🛡 中间件层"]
        MW["middleware.ts<br/>Cookie 认证 · CSRF 校验 · 安全头"]
    end

    subgraph API["🔌 API 编排层"]
        direction LR
        ChatAPI["/api/chat<br/>流式对话 · 限流 · 配额"]
        AgentsAPI["/api/agents<br/>CRUD · 所有权校验"]
        ToolsAPI["/api/tools<br/>CRUD · Headers 过滤"]
        KbAPI["/api/knowledge<br/>CRUD · 文件上传"]
    end

    subgraph 核心逻辑["🧠 核心逻辑层 lib/"]
        direction LR
        subgraph AI["ai/"]
            Provider["provider.ts<br/>DeepSeek 客户端"]
            Embedding["embedding.ts<br/>DashScope 嵌入"]
            Chunker["chunker.ts<br/>文本分块"]
            Retriever["retriever.ts<br/>pgvector 检索"]
        end
        subgraph Chat["chat/"]
            Context["build-context.ts<br/>20 条消息上下文"]
            Retrieve["retrieve.ts<br/>知识库注入"]
            ToolLoop["tool-loop.ts<br/>5 轮工具循环"]
        end
        subgraph Tools["tools/"]
            Builtin["web_search · web_request<br/>内置工具"]
            DBTools["db-tools.ts<br/>动态 HTTP 代理"]
            Guard["url-guard.ts<br/>SSRF 防护"]
        end
        subgraph Shared["共享模块"]
            Auth["auth.ts<br/>Better Auth 配置"]
            Quota["quota.ts<br/>配额 / 限流"]
            Errors["errors.ts<br/>统一错误响应"]
            Validate["validate.ts<br/>Zod 校验包装"]
        end
    end

    subgraph 数据存储["💾 数据存储层"]
        direction LR
        PG["PostgreSQL 18"]
        PGV["pgvector<br/>向量索引 HNSW"]
        DeepSeek["DeepSeek API<br/>LLM 调用"]
        DashScope["DashScope API<br/>文本嵌入"]
        SerpAPI["SerpAPI<br/>网页搜索"]
    end

    Browser --> MW
    PageAgent -->|直查| PG
    MW -->|保护| API
    API --> AI
    API --> Chat
    API --> Tools
    Chat --> AI
    Chat --> Tools
    Tools --> Guard
    Retriever --> Embedding
    Retriever --> PGV
    Provider --> DeepSeek
    Embedding --> DashScope
    Builtin --> SerpAPI

    style 客户端 fill:#e3f2fd,stroke:#1565c0
    style 中间件 fill:#fff3e0,stroke:#e65100
    style API fill:#e8f5e9,stroke:#2e7d32
    style 核心逻辑 fill:#f3e5f5,stroke:#7b1fa2
    style 数据存储 fill:#fce4ec,stroke:#c62828
```

---

## 2. 数据模型 ER 图

```mermaid
erDiagram
    users {
        uuid id PK "默认随机"
        varchar name
        varchar email UK
        bool email_verified
        timestamp created_at
        timestamp updated_at
    }

    agents {
        uuid id PK
        uuid user_id FK "→ users.id"
        varchar name
        text system_prompt
        varchar model "默认 deepseek-chat"
        numeric temperature "默认 0.7"
        int max_tokens "默认 4096"
        timestamp created_at
        timestamp updated_at
    }

    agent_tools {
        uuid agent_id PK_FK "→ agents.id CASCADE"
        uuid tool_id PK_FK "→ tools.id CASCADE"
    }

    chats {
        uuid id PK
        uuid agent_id FK "→ agents.id CASCADE"
        varchar title "默认 新对话"
        timestamp created_at
        timestamp updated_at
    }

    messages {
        uuid id PK
        uuid chat_id FK "→ chats.id CASCADE"
        varchar role "user|assistant|tool"
        text content
        jsonb tool_calls "only assistant"
        jsonb tool_result "only tool"
        timestamp created_at
    }

    tools {
        uuid id PK
        uuid user_id FK "→ users.id"
        varchar name
        text description
        jsonb parameters
        varchar endpoint
        varchar method "GET|POST"
        jsonb headers
        timestamp created_at
        timestamp updated_at
    }

    knowledge_bases {
        uuid id PK
        uuid user_id FK "→ users.id"
        varchar name
        timestamp created_at
    }

    knowledge_documents {
        uuid id PK
        uuid kb_id FK "→ knowledge_bases.id CASCADE"
        varchar filename
        text content "原始全文"
        timestamp created_at
    }

    knowledge_chunks {
        uuid id PK
        uuid doc_id FK "→ knowledge_documents.id CASCADE"
        uuid kb_id FK "→ knowledge_bases.id CASCADE"
        text content
        vector embedding "1024 维"
        int chunk_index
    }

    agent_knowledge {
        uuid agent_id PK_FK "→ agents.id CASCADE"
        uuid kb_id PK_FK "→ knowledge_bases.id CASCADE"
    }

    sessions {
        uuid id PK
        uuid user_id FK "→ users.id CASCADE"
        varchar token
        timestamp expires_at
    }

    accounts {
        uuid id PK
        uuid user_id FK "→ users.id CASCADE"
        varchar provider_id
        varchar password
    }

    verifications {
        uuid id PK
        varchar identifier
        varchar value
        timestamp expires_at
    }

    users ||--o{ agents : "创建"
    users ||--o{ tools : "创建"
    users ||--o{ knowledge_bases : "创建"
    users ||--o{ sessions : "拥有"
    users ||--o{ accounts : "拥有"
    users ||--o| verifications : "验证"

    agents ||--o{ chats : "包含"
    agents ||--o{ agent_tools : "绑定"
    agents ||--o{ agent_knowledge : "绑定"

    tools ||--o{ agent_tools : "被引用"
    knowledge_bases ||--o{ agent_knowledge : "被引用"

    chats ||--o{ messages : "包含"

    knowledge_bases ||--o{ knowledge_documents : "包含"
    knowledge_documents ||--o{ knowledge_chunks : "切片"
```

---

## 3. 对话核心流程

```mermaid
sequenceDiagram
    actor U as 用户
    participant Page as agents/[id]/page.tsx
    participant API as POST /api/chat
    participant MW as middleware.ts
    participant DB as PostgreSQL
    participant LLM as DeepSeek API
    participant RAG as 知识库检索
    participant Tool as 工具系统

    U->>Page: 输入消息 + 点击发送
    Page->>API: fetch POST { agentId, chatId?, content }

    Note over API: ▼ 安全校验层
    API->>API: limitRate (按 userId 限流 30次/分钟)
    API->>DB: requireUser() 认证
    API->>DB: 查 Agent (userId 隔离)
    API->>DB: checkQuota() 配额

    Note over API: ▼ 准备上下文
    alt 新对话
        API->>DB: INSERT chats → chatId
    end
    API->>DB: INSERT messages (role: user)
    API->>DB: buildConversationMessages (最近 20 条)
    API->>DB: 查 agent_knowledge → 绑定知识库列表

    loop 每个绑定的知识库
        API->>RAG: retrieveContext(kbId, query)
        RAG->>RAG: generateEmbedding(query) → DashScope
        RAG->>DB: pgvector 余弦相似度检索 (<=>)
        RAG-->>API: Top-K 文本块
    end
    API->>API: 去重 → 注入 system prompt

    Note over API: ▼ 工具循环 (最多 5 轮)
    loop 每轮 step
        API->>LLM: chat.completions.create(stream=true)
        LLM-->>API: SSE 流式文本块
        API-->>Page: ReadableStream SSE 转发

        alt 无 tool_calls
            API->>DB: INSERT messages (role: assistant)
            Note over API: ✋ 对话结束
        else 有 tool_calls
            API->>DB: INSERT messages (role: assistant, tool_calls)
            loop 每个工具
                API->>Tool: getTool(name) → execute(args)
                Tool->>Tool: SSRF 校验 (URL Guard)
                Tool-->>API: 工具执行结果
                API->>DB: INSERT messages (role: tool, result)
            end
            Note over API: 🔄 下一轮循环
        end
    end

    API->>API: generateChatTitle (LLM 10 字标题)
    Page->>Page: 刷新消息列表、自动滚动
```

---

## 4. RAG 知识库流程

```mermaid
sequenceDiagram
    actor U as 用户
    participant UI as knowledge/[id]/page.tsx
    participant API as POST /api/knowledge/:id/documents
    participant DB as PostgreSQL
    participant Embed as DashScope API
    participant Chunker as chunker.ts

    U->>UI: 选择文件上传
    UI->>API: FormData { file }

    Note over API: ▼ 文件校验
    API->>API: 检查 MIME 类型 (白名单)
    API->>API: 检查扩展名 (.pdf/.txt/.csv/.json/.md)
    API->>API: 检查大小 (≤ 10MB)

    Note over API: ▼ 文本提取
    alt PDF 文件
        API->>API: pdf-parse (30s 超时)
    else CSV 文件
        API->>API: TextDecoder 解码
    else JSON 文件
        API->>API: JSON.parse → 格式化
    else MD/TXT 文件
        API->>API: TextDecoder 解码
    end

    API->>DB: INSERT knowledge_documents (全文)

    Note over API: ▼ 文本分块
    API->>Chunker: splitText(text)
    Chunker->>Chunker: 按段落 → 按句子拆分
    Chunker->>Chunker: MAX 800 / MIN 300 / OVERLAP 100 字符
    Chunker-->>API: chunks[]

    Note over API: ▼ 向量化
    API->>Embed: generateEmbeddings(chunks) 批量
    Embed-->>API: embeddings[][1024]

    API->>DB: INSERT knowledge_chunks (content + embedding)

    API-->>UI: 201 { id, chunkCount }
    UI->>UI: 刷新文档列表
```

---

## 5. 认证流程

```mermaid
sequenceDiagram
    actor U as 用户
    participant Browser as 浏览器
    participant MW as middleware.ts
    participant Login as /login page
    participant API as /api/auth/*
    participant Auth as Better Auth
    participant DB as PostgreSQL

    Note over U,DB: === 首次访问受保护页面 ===
    U->>Browser: 访问 /agents
    Browser->>MW: 请求 /agents
    MW->>MW: 检查 cookie: better-auth.session_token
    MW->>MW: 无 token → 非公开路径
    MW-->>Browser: redirect /login

    Note over U,DB: === 登录 ===
    U->>Login: 输入邮箱 + 密码
    Login->>API: authClient.signIn.email()
    API->>Auth: 校验邮箱 + 密码
    Auth->>DB: 查 users 表
    Auth->>DB: INSERT sessions (token)
    Auth-->>API: session cookie
    API-->>Login: 登录成功
    Login->>Browser: router.push("/agents")

    Note over U,DB: === 后续请求 ===
    Browser->>MW: 请求 /agents + cookie
    MW->>MW: 检查 cookie: better-auth.session_token ✓
    MW->>MW: CSRF 校验 (origin vs host)
    MW->>MW: 设置安全头 (CSP, HSTS, X-Frame-Options)
    MW-->>Browser: 放行

    Note over U,DB: === 数据隔离 ===
    Server->>DB: SELECT * FROM agents WHERE user_id = $1
    Note over Server: 所有查询都带 userId 过滤
```

---

## 6. 工具调用循环

```mermaid
sequenceDiagram
    participant Loop as tool-loop.ts
    participant LLM as DeepSeek API
    participant Tool as getTool()
    participant Builtin as 内置工具
    participant DBTool as 自定义 HTTP 工具
    participant Guard as url-guard.ts
    participant DB as PostgreSQL

    Note over Loop: 最多 5 轮循环

    Loop->>LLM: openai.chat.completions.create(stream=true, tools)
    LLM-->>Loop: 流式文本块 (逐 token)

    alt 响应文本
        Loop-->>Controller: enqueue 文本到 SSE
    end

    alt 模型返回 tool_calls
        Loop->>DB: 保存 assistant 消息 (含 tool_calls)
        Loop->>LLM: 提交 tool_call 到消息上下文

        loop 每个 tool_call
            Loop->>Tool: getTool(toolName)

            alt 内置工具: web_search
                Tool->>Builtin: search-execute.ts
                Builtin->>Builtin: fetch SerpAPI (x-api-key header)
                Builtin-->>Tool: 搜索结果 top 5
            else 内置工具: web_request
                Tool->>Builtin: web-request-execute.ts
                Builtin->>Guard: validateExternalUrlWithDNS(url)
                Guard->>Guard: 检查 hostname 前缀
                Guard->>Guard: DNS 解析 → 检查 IP
                Guard-->>Builtin: 放行 ✓
                Builtin->>Builtin: fetch(url, redirect: error)
                Builtin-->>Tool: 响应文本 ≤ 2000 字符
            else 自定义工具 (DB)
                Tool->>DBTool: db-tools.ts
                DBTool->>Guard: validateExternalUrlWithDNS(endpoint)
                DBTool->>DBTool: sanitizeHeaders (过滤 Host 等)
                DBTool->>DBTool: GET: 拼 URL params / POST: JSON body
                DBTool->>DBTool: fetch(endpoint, redirect: error)
                DBTool-->>Tool: 响应文本 ≤ 2000 字符
            end

            Tool-->>Loop: 工具执行结果
            Loop-->>Controller: enqueue "🔍 调用 {name}..."
            Loop->>DB: 保存 tool 消息 (role: tool)
        end

        Note over Loop: 🔄 下一轮循环 (tools 结果喂回 LLM)
    end

    Note over Loop: ✋ 无 tool_calls 或达到最大轮数 → 结束
```

---

## 7. 请求安全处理流水线

```mermaid
flowchart TD
    Request["HTTP 请求到达"] --> MW

    subgraph MW["🛡 middleware.ts"]
        direction TB
        PublicCheck{"公开路径?<br/>/login /signup /api/auth /api/health"}
        CookieCheck{"Session Cookie?<br/>better-auth.session_token"}
        CSRFCheck{"API 写请求?<br/>POST PUT DELETE"}
        OriginCheck{"Origin 匹配 Host?"}
        SecurityHeaders["设置安全头<br/>CSP · HSTS · X-Frame-Options<br/>X-Content-Type · Referrer-Policy"]

        PublicCheck -->|是| Router["Next.js 路由"]
        PublicCheck -->|否| CookieCheck
        CookieCheck -->|无| Redirect["redirect /login"]
        CookieCheck -->|有| CSRFCheck
        CSRFCheck -->|GET/HEAD| SecurityHeaders
        CSRFCheck -->|写请求| OriginCheck
        OriginCheck -->|不匹配| Reject403["403 禁止"]
        OriginCheck -->|匹配| SecurityHeaders
        SecurityHeaders --> Router
    end

    subgraph Route["API 路由处理器"]
        direction TB
        Auth["requireUser() 认证"]
        Limit["checkRateLimit() 限流"]
        Zod["parseBody(body, schema) Zod 校验"]
        Owner["所有权校验<br/>WHERE user_id = $1"]
        Business["业务逻辑处理"]

        Auth --> Limit --> Zod --> Owner --> Business
    end

    Router --> Route
    Business --> Response["返回响应"]

    style MW fill:#fff3e0,stroke:#e65100
    style Route fill:#e8f5e9,stroke:#2e7d32
    style Reject403 fill:#ffcdd2,stroke:#c62828
    style Redirect fill:#ffcdd2,stroke:#c62828
```

---

## 目录结构

```
src/
├── app/
│   ├── layout.tsx                  # 根布局 + Header
│   ├── page.tsx                    # / → redirect /agents
│   ├── globals.css                 # Tailwind 入口
│   ├── error.tsx                   # 错误边界
│   ├── global-error.tsx            # 全局错误边界
│   ├── login/page.tsx              # 登录页（客户端）
│   ├── signup/page.tsx             # 注册页（客户端）
│   ├── agents/
│   │   ├── page.tsx                # Agent 列表（服务端直查DB）
│   │   ├── new/page.tsx            # 创建 Agent
│   │   └── [id]/
│   │       ├── page.tsx            # 聊天页（客户端 SSE）
│   │       └── edit/page.tsx       # 编辑 Agent（服务端）
│   ├── tools/
│   │   ├── page.tsx                # 工具列表
│   │   ├── new/page.tsx            # 创建工具
│   │   └── [id]/edit/page.tsx      # 编辑工具
│   ├── knowledge/
│   │   ├── page.tsx                # 知识库列表
│   │   ├── new/page.tsx            # 创建知识库
│   │   └── [id]/page.tsx           # 知识库详情 + 文档
│   └── api/
│       ├── agents/                 # Agent CRUD
│       ├── chat/                   # 流式对话核心
│       ├── chats/                  # 对话管理
│       ├── tools/                  # 工具 CRUD
│       ├── knowledge/              # 知识库 CRUD + 文档
│       ├── health/                 # 健康检查
│       └── auth/[...all]/          # Better Auth 回调
├── components/
│   ├── ui/                         # shadcn/ui 基础组件
│   ├── agents/                     # agent-card, agent-form, selector
│   ├── chat/                       # chat-messages, chat-input, markdown
│   ├── tools/                      # tool-card, tool-form
│   ├── header.tsx                  # 全局导航
│   ├── empty-state.tsx             # 空状态占位
│   └── confirm-dialog.tsx          # 确认删除对话框
├── lib/
│   ├── ai/
│   │   ├── provider.ts             # DeepSeek 客户端
│   │   ├── embedding.ts            # 文本嵌入 (DashScope)
│   │   ├── chunker.ts              # 文本分块
│   │   └── retriever.ts            # pgvector 检索
│   ├── chat/
│   │   ├── build-context.ts        # 消息历史 → LLM 上下文
│   │   ├── retrieve.ts             # 知识库检索注入
│   │   ├── tool-loop.ts            # 多轮工具调用循环
│   │   └── generate-title.ts       # LLM 生成对话标题
│   ├── db/
│   │   ├── index.ts                # Drizzle 实例 + 连接池
│   │   ├── helpers.ts              # findById / syncManyToMany
│   │   └── schema/                 # 13 张表定义
│   ├── tools/
│   │   ├── types.ts                # Tool 接口
│   │   ├── index.ts                # 内置工具注册
│   │   ├── search.ts               # 搜索工具定义
│   │   ├── search-execute.ts       # SerpAPI 执行
│   │   ├── web-request.ts          # 网络请求工具定义
│   │   ├── web-request-execute.ts  # HTTP 请求执行
│   │   ├── db-tools.ts             # 动态自定义工具
│   │   └── url-guard.ts            # SSRF 防护 + DNS 检查
│   ├── __tests__/                  # 单元测试
│   ├── auth.ts                     # Better Auth 配置
│   ├── auth-client.ts              # 客户端 auth 实例
│   ├── quota.ts                    # 配额框架
│   ├── errors.ts                   # 统一错误响应
│   ├── validate.ts                 # Zod 校验包装
│   ├── validators.ts               # Zod Schema
│   ├── types.ts                    # 前端类型
│   ├── utils.ts                    # cn() 工具
│   ├── env.ts                      # 环境校验
│   ├── config.ts                   # 统一配置
│   ├── logger.ts                   # Pino 日志
│   ├── rate-limit.ts               # 限流
│   └── util/text.ts                # 文本去重
├── middleware.ts                    # 路由保护 + CSRF + 安全头
└── scripts/
    └── seed.ts                     # 管理员初始化
```

---

## API 参考

### Agents

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/agents` | Agent 列表（按 userId 过滤） |
| POST | `/api/agents` | 创建 Agent（校验 tools/kb 所有权） |
| GET | `/api/agents/:id` | Agent 详情（含 tools + kbs） |
| PUT | `/api/agents/:id` | 更新 Agent（校验关联所有权） |
| DELETE | `/api/agents/:id` | 删除 Agent（级联） |

### Chat

| Method | Endpoint | Body | Description |
|--------|----------|------|-------------|
| POST | `/api/chat` | `{ agentId, chatId?, content, regenerate? }` | 流式 SSE |

### Chats

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/chats?agentId=` | 对话列表 |
| POST | `/api/chats` | 创建对话 |
| PATCH | `/api/chats/:id` | 重命名对话 |
| DELETE | `/api/chats/:id` | 删除对话（级联消息） |
| GET | `/api/chats/:id/messages` | 消息历史 |

### Tools

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/tools` | 工具列表 |
| POST | `/api/tools` | 创建工具 |
| GET | `/api/tools/:id` | 工具详情 |
| PUT | `/api/tools/:id` | 更新工具 |
| DELETE | `/api/tools/:id` | 删除工具（清理关联） |

### Knowledge Bases

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/knowledge` | 知识库列表 |
| POST | `/api/knowledge` | 创建知识库 |
| GET | `/api/knowledge/:id` | 知识库详情 |
| DELETE | `/api/knowledge/:id` | 删除知识库 |
| GET | `/api/knowledge/:id/documents` | 文档列表 |
| POST | `/api/knowledge/:id/documents` | 上传文档（FormData） |
| GET | `/api/knowledge/:id/documents/:docId/content` | 文档内容 |
| DELETE | `/api/knowledge/:id/documents/:docId` | 删除文档 |

### Health

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/health` | 健康检查（DB 连通性） |

---

## 环境变量

| 变量 | 必填 | 说明 |
|------|:--:|------|
| `DATABASE_URL` | ✅ | PostgreSQL 连接串 |
| `DEEPSEEK_API_KEY` | ✅ | DeepSeek API Key |
| `BETTER_AUTH_SECRET` | ✅ | Auth 加密密钥 (`openssl rand -base64 32`) |
| `BETTER_AUTH_URL` | ✅ | 应用 URL |
| `SERPAPI_API_KEY` | 可选 | 网页搜索（不配则工具不可用） |
| `BAILIAN_API_KEY` | 可选 | 文本嵌入（不配则知识库不可用） |

---

## 部署

### 本地开发

```bash
docker compose up -d          # 启动 PostgreSQL + pgvector
cp .env.example .env.local    # 填入 API Key
npm install
npm run db:push               # 建表
npm run db:seed               # 管理员账号
npm run dev                   # http://localhost:3000
```

### 生产 (Vercel + Neon)

```bash
vercel deploy
# 环境变量: DATABASE_URL, DEEPSEEK_API_KEY, BETTER_AUTH_SECRET, BETTER_AUTH_URL
# Neon 创建 PostgreSQL + pgvector
# npm run db:push (指向 Neon)
```
