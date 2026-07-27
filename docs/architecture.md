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
%%{init: {'theme': 'base', 'themeVariables': {'fontSize': '10px'}, 'flowchart': {'useMaxWidth': true, 'nodeSpacing': 30, 'rankSpacing': 40}}}%%
graph TB
    subgraph Client["🖥 客户端层"]
        direction LR
        Browser["浏览器 React 19"]
        PageAgent["agents/page.tsx 服务端"]
    end

    subgraph Middleware["🛡 中间件层"]
        MW["middleware.ts<br/>认证 · CSRF · 安全头"]
    end

    subgraph API["🔌 API 层"]
        direction LR
        ChatAPI["/api/chat 流式"]
        AgentsAPI["/api/agents CRUD"]
        ToolsAPI["/api/tools CRUD"]
        KbAPI["/api/knowledge CRUD"]
    end

    subgraph Core["🧠 核心逻辑层 lib/"]
        direction LR
        subgraph AI_Lib["ai/"]
            Provider["provider.ts 客户端"]
            Embedding["embedding.ts 嵌入"]
            Chunker["chunker.ts 分块"]
            Retriever["retriever.ts 检索"]
        end
        subgraph Chat_Lib["chat/"]
            Context["build-context.ts"]
            Retrieve["retrieve.ts 知识注入"]
            ToolLoop["tool-loop.ts 5轮循环"]
        end
        subgraph Tools_Lib["tools/"]
            Builtin["web_search/web_request"]
            DBTools["db-tools.ts 动态代理"]
            Guard["url-guard.ts SSRF"]
        end
        subgraph Shared["共享模块"]
            Auth["auth.ts"]
            Quota["quota.ts"]
            Errors["errors.ts"]
            Validate["validate.ts"]
        end
    end

    subgraph Data["💾 数据存储"]
        direction LR
        PG["PostgreSQL + pgvector"]
        DeepSeek["DeepSeek API"]
        DashScope["DashScope API"]
        SerpAPI["SerpAPI"]
    end

    Browser --> MW
    PageAgent -->|直查| PG
    MW -->|保护| API
    API --> AI_Lib
    API --> Chat_Lib
    API --> Tools_Lib
    Chat_Lib --> AI_Lib
    Chat_Lib --> Tools_Lib
    Tools_Lib --> Guard
    Retriever --> Embedding
    Retriever --> PG
    Provider --> DeepSeek
    Embedding --> DashScope
    Builtin --> SerpAPI

    style Client fill:#e3f2fd,stroke:#1565c0
    style Middleware fill:#fff3e0,stroke:#e65100
    style API fill:#e8f5e9,stroke:#2e7d32
    style Core fill:#f3e5f5,stroke:#7b1fa2
    style Data fill:#fce4ec,stroke:#c62828
```

---

## 2. 数据模型 ER 图

### 业务数据

```mermaid
%%{init: {'theme': 'base', 'themeVariables': {'fontSize': '10px'}}}%%
erDiagram
    users {
        uuid id PK
        varchar name
        varchar email UK
        timestamp created_at
    }

    agents {
        uuid id PK
        uuid user_id FK
        varchar name
        text system_prompt
        varchar model
        numeric temperature
        int max_tokens
    }

    agent_tools {
        uuid agent_id PK_FK
        uuid tool_id PK_FK
    }

    chats {
        uuid id PK
        uuid agent_id FK
        varchar title
    }

    messages {
        uuid id PK
        uuid chat_id FK
        varchar role
        text content
        jsonb tool_calls
        jsonb tool_result
    }

    tools {
        uuid id PK
        uuid user_id FK
        varchar name
        text description
        jsonb parameters
        varchar endpoint
        varchar method
        jsonb headers
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
        varchar name
        varchar email UK
    }

    knowledge_bases {
        uuid id PK
        uuid user_id FK
        varchar name
    }

    knowledge_documents {
        uuid id PK
        uuid kb_id FK
        varchar filename
        text content
    }

    knowledge_chunks {
        uuid id PK
        uuid doc_id FK
        uuid kb_id FK
        text content
        vector embedding
    }

    agent_knowledge {
        uuid agent_id PK_FK
        uuid kb_id PK_FK
    }

    agents {
        uuid id PK
        uuid user_id FK
    }

    sessions {
        uuid id PK
        uuid user_id FK
        varchar token
        timestamp expires_at
    }

    accounts {
        uuid id PK
        uuid user_id FK
        varchar provider_id
        varchar password
    }

    verifications {
        uuid id PK
        varchar identifier
        timestamp expires_at
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

## 3. 对话核心流程

```mermaid
%%{init: {'theme': 'base', 'themeVariables': {'fontSize': '10px'}, 'sequence': {'width': 650, 'actorMargin': 30, 'messageMargin': 18}}}%%
sequenceDiagram
    actor U as 用户
    participant P as page.tsx
    participant API as /api/chat
    participant DB as PostgreSQL
    participant LLM as DeepSeek
    participant RAG as 知识检索
    participant Tool as 工具系统

    U->>P: 输入消息
    P->>API: POST { agentId, chatId, content }

    Note over API: 安全校验
    API->>API: checkRateLimit
    API->>DB: requireUser 认证
    API->>DB: 查 Agent (userId 隔离)
    API->>DB: checkQuota 配额

    Note over API: 准备上下文
    API->>DB: 新建/复用 Chat
    API->>DB: INSERT user message
    API->>DB: buildContext (近20条消息)

    loop 每个绑定知识库
        API->>RAG: retrieveContext(kbId, query)
        RAG->>RAG: generateEmbedding → DashScope
        RAG->>DB: pgvector 余弦检索
        RAG-->>API: Top-K 文本块
    end

    Note over API: 工具循环 (最多 5 轮)
    loop step 0..4
        API->>LLM: chat.completions.create(stream)
        LLM-->>API: SSE 流式
        API-->>P: SSE 转发

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

## 4. RAG 知识库流程

```mermaid
%%{init: {'theme': 'base', 'themeVariables': {'fontSize': '10px'}, 'sequence': {'width': 650, 'actorMargin': 30, 'messageMargin': 18}}}%%
sequenceDiagram
    actor U as 用户
    participant UI as knowledge/page.tsx
    participant API as POST /documents
    participant DB as PostgreSQL
    participant Embed as DashScope
    participant Chunker as chunker.ts

    U->>UI: 选择文件上传
    UI->>API: FormData { file }

    Note over API: 文件校验
    API->>API: MIME 类型白名单
    API->>API: 扩展名 (.pdf/.txt/.csv/.json/.md)
    API->>API: 大小 ≤ 10MB

    alt PDF
        API->>API: pdf-parse (30s 超时)
    else CSV
        API->>API: TextDecoder 解码
    else JSON
        API->>API: JSON.parse → 格式化
    else MD/TXT
        API->>API: TextDecoder 解码
    end

    API->>DB: INSERT knowledge_documents

    Note over API: 分块
    API->>Chunker: splitText(text)
    Chunker-->>API: chunks[] (MAX 800/OVERLAP 100)

    Note over API: 向量化
    API->>Embed: generateEmbeddings(chunks)
    Embed-->>API: embeddings[][] 1024维

    API->>DB: INSERT knowledge_chunks
    API-->>UI: 201 { id, chunkCount }
```

---

## 5. 认证流程

```mermaid
%%{init: {'theme': 'base', 'themeVariables': {'fontSize': '10px'}, 'sequence': {'width': 600, 'actorMargin': 30, 'messageMargin': 18}}}%%
sequenceDiagram
    actor U as 用户
    participant B as 浏览器
    participant MW as middleware
    participant Login as /login page
    participant Auth as Better Auth
    participant DB as PostgreSQL

    U->>B: 访问 /agents
    B->>MW: 请求
    MW->>MW: Cookie: session_token?
    MW->>MW: 无 → 非公开路径
    MW-->>B: redirect /login

    U->>Login: 邮箱 + 密码
    Login->>Auth: signIn.email()
    Auth->>DB: 校验用户
    Auth->>DB: INSERT sessions
    Auth-->>Login: set cookie
    Login->>B: router.push("/agents")

    B->>MW: 请求 + cookie
    MW->>MW: session_token ✓
    MW->>MW: CSRF origin 校验
    MW->>MW: 安全头 (CSP/HSTS)
    MW-->>B: 放行

    Note over DB: 后续查询都带 WHERE user_id
```

---

## 6. 工具调用循环

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

## 7. 请求安全处理流水线

```mermaid
%%{init: {'theme': 'base', 'themeVariables': {'fontSize': '10px'}, 'flowchart': {'useMaxWidth': true, 'nodeSpacing': 25, 'rankSpacing': 35}}}%%
flowchart TD
    R["HTTP 请求"] --> MW

    subgraph MW["middleware.ts"]
        P{"公开路径?"}
        C{"Session Cookie?"}
        CSRF{"API 写请求?"}
        O{"Origin 匹配 Host?"}
        SH["设置安全头<br/>CSP · HSTS · X-Frame-Options"]

        P -->|是| RT["路由"]
        P -->|否| C
        C -->|无| RD["redirect /login"]
        C -->|有| CSRF
        CSRF -->|GET/HEAD| SH
        CSRF -->|POST/PUT/DEL| O
        O -->|不匹配| R403["403"]
        O -->|匹配| SH
        SH --> RT
    end

    subgraph API["API 路由"]
        A["requireUser 认证"]
        L["checkRateLimit 限流"]
        Z["parseBody Zod 校验"]
        OWN["所有权校验<br/>WHERE user_id"]
        BIZ["业务逻辑"]
        A --> L --> Z --> OWN --> BIZ
    end

    RT --> API
    BIZ --> RESP["响应"]

    style MW fill:#fff3e0,stroke:#e65100
    style API fill:#e8f5e9,stroke:#2e7d32
    style R403 fill:#ffcdd2
    style RD fill:#ffcdd2
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
