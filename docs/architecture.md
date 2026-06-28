# 架构文档

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

## 分层架构

```
┌─────────────────────────────────────────┐
│  Browser (React 客户端组件)               │
│  components/ · app/login/ · app/signup/ │
├─────────────────────────────────────────┤
│  app/agents/page.tsx                     │  ← 服务端组件，直查 DB
│  app/api/                                │  ← API 路由，编排层
├─────────────────────────────────────────┤
│  lib/                                    │  ← 核心逻辑（不碰 UI）
│  ├── ai/          AI 能力                │
│  ├── chat/        对话上下文/工具循环      │
│  ├── db/          数据库 + Schema         │
│  ├── tools/       工具系统               │
│  ├── auth.ts      Better Auth 配置       │
│  ├── quota.ts     配额框架               │
│  ├── errors.ts    统一错误响应            │
│  └── validate.ts  Zod 校验包装            │
├─────────────────────────────────────────┤
│  lib/db/schema/                          │  ← 数据模型
│  users · agents · chats · messages       │
│  tools · knowledge · sessions · accounts │
└─────────────────────────────────────────┘
```

**依赖方向**：单向，上层 → 下层，无循环引用。

## 目录结构

```
src/
├── app/
│   ├── layout.tsx                  # 根布局 + Header
│   ├── page.tsx                    # / → redirect /agents
│   ├── globals.css                 # Tailwind 入口
│   ├── login/page.tsx              # 登录页（客户端）
│   ├── signup/page.tsx             # 注册页（客户端）
│   ├── agents/
│   │   ├── page.tsx                # Agent 列表（服务端）
│   │   ├── new/page.tsx            # 创建 Agent
│   │   └── [id]/
│   │       ├── page.tsx            # 聊天页（客户端）
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
│       └── auth/[...all]/          # Better Auth 回调
├── components/
│   ├── ui/                         # shadcn/ui 基础组件
│   ├── agents/                     # agent-card, agent-form, selector
│   ├── chat/                       # chat-messages, chat-input
│   ├── tools/                      # tool-card, tool-form
│   ├── header.tsx                  # 全局导航栏 + 用户状态
│   ├── empty-state.tsx             # 空状态占位
│   └── confirm-dialog.tsx           # 确认删除对话框
├── lib/
│   ├── ai/
│   │   ├── provider.ts             # DeepSeek 客户端（OpenAI SDK）
│   │   ├── embedding.ts            # 文本嵌入（DashScope）
│   │   ├── chunker.ts              # 文本分块
│   │   └── retriever.ts            # 向量检索
│   ├── chat/
│   │   ├── build-context.ts        # 消息历史 → LLM 上下文
│   │   ├── retrieve.ts             # 知识库检索注入
│   │   └── tool-loop.ts            # 多轮工具调用循环
│   ├── db/
│   │   ├── index.ts                # Drizzle 实例
│   │   ├── helpers.ts              # findById / syncManyToMany
│   │   └── schema/
│   │       ├── users.ts            # 用户表
│   │       ├── agents.ts           # Agent 表
│   │       ├── agent-tools.ts      # Agent-工具关联
│   │       ├── chats.ts            # 对话表
│   │       ├── messages.ts         # 消息表
│   │       ├── tools.ts            # 自定义工具表
│   │       ├── knowledge.ts        # 知识库 4 张表
│   │       └── auth.ts             # sessions/accounts/verifications
│   ├── tools/
│   │   ├── types.ts                # Tool 接口
│   │   ├── index.ts                # 内置工具注册中心
│   │   ├── search.ts               # 网页搜索定义
│   │   ├── search-execute.ts       # 网页搜索执行
│   │   ├── web-request.ts          # 网络请求定义
│   │   ├── web-request-execute.ts  # 网络请求执行
│   │   └── db-tools.ts             # 统一工具获取
│   ├── auth.ts                     # Better Auth 配置
│   ├── auth-client.ts              # 客户端 auth 实例
│   ├── quota.ts                    # 配额框架
│   ├── errors.ts                   # 统一错误响应
│   ├── validate.ts                 # Zod 校验包装
│   ├── types.ts                    # 前端类型定义
│   └── validators.ts               # Zod 验证 Schema
├── middleware.ts                    # 路由保护
└── scripts/
    └── seed.ts                     # 管理员账号初始化
```

## 数据库 Schema

### ER 图（逻辑）

```
users ──1:N──→ agents ──1:N──→ chats ──1:N──→ messages
  │               │
  │               ├──M:N──→ tools (agent_tools)
  │               │
  │               └──M:N──→ knowledge_bases (agent_knowledge)
  │                              │
  │                              └──1:N──→ knowledge_documents
  │                                           │
  │                                           └──1:N──→ knowledge_chunks
  │
  ├──1:N──→ tools (自建工具)
  │
  ├──1:N──→ knowledge_bases (知识库)
  │
  ├──1:N──→ sessions
  ├──1:N──→ accounts
  └──1:1──→ verifications (via email)
```

### 表清单

| 表名 | 用途 | 关键列 |
|------|------|--------|
| `users` | 用户 | id(uuid), name, email, email_verified |
| `agents` | Agent 配置 | name, system_prompt, model, temperature, max_tokens |
| `agent_tools` | Agent-工具 多对多 | agent_id, tool_id |
| `chats` | 对话会话 | agent_id, title |
| `messages` | 消息记录 | chat_id, role, content, tool_calls(JSONB), tool_result(JSONB) |
| `tools` | 自定义 HTTP 工具 | name, endpoint, method, parameters(JSONB), headers(JSONB) |
| `knowledge_bases` | 知识库 | user_id, name |
| `knowledge_documents` | 文档 | kb_id, filename, content |
| `knowledge_chunks` | 文本切片 | doc_id, kb_id, content, embedding(vector 1024) |
| `agent_knowledge` | Agent-知识库 多对多 | agent_id, kb_id |
| `sessions` | 登录会话 | user_id, token, expires_at |
| `accounts` | 认证账号 | user_id, provider_id, password |
| `verifications` | 验证请求 | identifier, value, expires_at |

### 外键级联

```
agent_tools.agent_id    → CASCADE DELETE agents
agent_tools.tool_id      → CASCADE DELETE tools
chats.agent_id           → CASCADE DELETE agents
messages.chat_id         → CASCADE DELETE chats
knowledge_documents.kb_id → CASCADE DELETE knowledge_bases
knowledge_chunks.doc_id   → CASCADE DELETE knowledge_documents
knowledge_chunks.kb_id    → CASCADE DELETE knowledge_bases
agent_knowledge.agent_id  → CASCADE DELETE agents
agent_knowledge.kb_id     → CASCADE DELETE knowledge_bases
sessions.user_id          → CASCADE DELETE users
accounts.user_id          → CASCADE DELETE users
```

## 核心流程

### 1. 对话完整流程

```
用户输入消息 (page.tsx handleSend)
  │
  ▼
POST /api/chat { agentId, chatId?, content }
  │
  ├── 输入校验 (长度 4000, 频率 1次/秒)
  ├── 查 Agent + 启用工具列表
  ├── checkQuota(userId)
  ├── 创建/复用 Chat
  ├── 保存 user message
  │
  ├── buildConversationMessages(chatId, systemPrompt)
  │     ├── 读 DB 最近 20 条消息
  │     ├── Zod 校验 toolCalls / toolResult
  │     ├── 检测不完整工具调用序列
  │     └── 拼接 system prompt + 历史 → ChatCompletionMessageParam[]
  │
  ├── injectKnowledgeContext(messages, agentId, query)
  │     ├── 查 Agent 绑定的知识库
  │     ├── generateEmbedding(query) → 阿里云 DashScope
  │     ├── 每个绑定的知识库做 pgvector 余弦相似度检索
  │     └── Top-K 内容块注入 system prompt
  │
  └── runToolLoop(controller, messages, toolDefs, options)
        │
        └── for step in 0..5:
              ├── openai.chat.completions.create(stream: true)
              │     └── 流式输出文本到 SSE
              │     └── 收集 tool_calls
              │
              ├── 无 tool_calls → 保存 assistant 消息 → 结束
              │
              └── 有 tool_calls:
                    ├── 保存 assistant 消息 (含 toolCalls)
                    ├── 逐个执行工具:
                    │     ├── SSE 推送 "🔍 正在调用 {name}..."
                    │     ├── getTool(name) → builtin | DB
                    │     ├── tool.execute(args)
                    │     ├── SSE 推送 "✅ {name} 完成"
                    │     └── 保存 tool 消息
                    └── 下一轮循环
```

### 2. 重新生成流程

```
用户点击"重新生成" (page.tsx handleRegenerate)
  │
  ├── 前端删除最后一条 assistant + tool 消息（UI）
  │
  ▼
POST /api/chat { agentId, chatId, regenerate: true }
  │
  ├── 后端删除最后一条 user 消息之后的所有 assistant + tool 消息（DB）
  ├── 跳过 user message 插入
  ├── 重建上下文（从剩余消息）
  └── 重新执行 tool loop
```

### 3. 认证流程

```
用户访问 /agents
  │
  ▼
middleware.ts 检查 cookie: better-auth.session_token
  │
  ├── 有 → 放行
  │
  └── 无 → redirect /login
            │
            ├── 输入邮箱+密码
            │     └── authClient.signIn.email() → POST /api/auth/sign-in/email
            │           └── Better Auth 校验 → 写入 session cookie
            │
            └── 没有账号 → /signup
                  └── authClient.signUp.email() → POST /api/auth/sign-up/email
                        └── Better Auth 创建用户 → 自动登录
```

### 4. 知识库文档上传流程

```
POST /api/knowledge/:id/documents (FormData file)
  │
  ├── 文件校验 (类型、大小 10MB)
  ├── 提取文本:
  │     ├── .pdf  → pdf-parse
  │     └── 其他  → TextDecoder
  │
  ├── 保存 knowledge_documents (全文)
  ├── splitText(text) → 500 字块 + 100 字重叠
  ├── generateEmbeddings(chunks) → 1024 维向量 (批量)
  └── 写入 knowledge_chunks (每条含向量)
```

## 认证系统

### Better Auth 配置

```typescript
betterAuth({
  database: drizzleAdapter(db, { provider: "pg" }),
  emailAndPassword: { enabled: true },
  user:    { modelName: "users" },
  session: { modelName: "sessions" },
  account: { modelName: "accounts" },
  verification: { modelName: "verifications" },
  advanced: { database: { generateId: false } },  // PostgreSQL UUID
})
```

### getCurrentUser() 机制

```
服务端调用 getCurrentUser()
  │
  ├── auth.api.getSession(headers)
  │     └── 有 session → 返回 { id: session.user.id, name }
  │
  └── 无 session → 降级返回 GUEST_USER_ID
```

所有 API 路由和页面通过 `getCurrentUser()` 获取当前用户，用于数据隔离（`WHERE user_id = $1`）。

### 中间件保护

```
middleware.ts
  publicPaths: ["/login", "/signup", "/api/auth", "/"]
  非公开路由: 检查 cookie better-auth.session_token
    无 → redirect /login
    有 → 放行
```

## 工具系统

### 架构

```
getTool(id)  →  path: builtinTools[id] ? return : DB query
                │
builtinTools:  { web_search → searchTool, web_request → webRequestTool }
DB tools:      tools table → 动态 HTTP 代理
```

### 内置工具

| ID | 功能 | 实现 |
|----|------|------|
| `web_search` | Google 搜索（SerpAPI） | `search-execute.ts` |
| `web_request` | HTTP GET/POST 请求 | `web-request-execute.ts` |

### 自定义工具

通过 Web UI 创建，存储到 `tools` 表：

```
名称 / 描述 / 端点 URL / HTTP Method (GET|POST) / 参数 JSON Schema / Headers
```

运行时：`db-tools.ts` 动态构建 fetch 请求，返回截断到 2000 字符的响应文本。

### 工具定义格式

```typescript
interface Tool {
  id: string;
  name: string;
  description: string;
  parameters: Record<string, unknown>;
  execute: (args: Record<string, unknown>) => Promise<string>;
}
```

## 配额框架

```
lib/quota.ts
  ├── Plan 接口: name, dailyRequests, knowledgeStorageMB, maxAgents, maxTools
  ├── getPlan(userId) → Plan       (当前返回 freePlan)
  └── checkQuota(userId) → { allowed, reason? }    (当前永返回 true)

chat/route.ts 入口:
  const quota = await checkQuota(agent.userId);
  if (!quota.allowed) return tooManyRequests(reason);
```

后续加付费时，只需替换 `getPlan()` 和 `checkQuota()` 的内部实现，其他代码不动。

## 错误处理

### 统一错误响应

```typescript
// lib/errors.ts
badRequest(msg)         → 400
notFound(msg)           → 404
tooManyRequests(msg)    → 429
internalError(msg)      → 500
```

### Zod 校验包装

```typescript
// lib/validate.ts
parseBody(body, schema) → T | throws badRequest()
```

所有 API 路由统一使用这两个模块，错误格式一致。

## API 参考

### Agents

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/agents` | Agent 列表（按 userId 过滤） |
| POST | `/api/agents` | 创建 Agent（含工具+知识库关联） |
| GET | `/api/agents/:id` | Agent 详情（含工具+知识库列表） |
| PUT | `/api/agents/:id` | 更新 Agent（替换关联） |
| DELETE | `/api/agents/:id` | 删除 Agent（级联） |

### Chat

| Method | Endpoint | Body | Description |
|--------|----------|------|-------------|
| POST | `/api/chat` | `{ agentId, chatId?, content, regenerate? }` | 发送消息/重新生成，流式 SSE 返回 |

### Chats

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/chats?agentId=` | 对话列表 |
| POST | `/api/chats` | 创建对话 |
| DELETE | `/api/chats/:id` | 删除对话（级联消息） |
| GET | `/api/chats/:id/messages` | 消息历史 |

### Tools

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/tools` | 自定义工具列表 |
| POST | `/api/tools` | 创建自定义工具 |
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

## 部署

### 本地开发

```bash
docker run --name pg-agent -e POSTGRES_PASSWORD=postgres -p 5432:5432 -d postgres:18
docker exec pg-agent createdb -U postgres agent_platform
cp .env.example .env.local   # 编辑填入 API Key + BETTER_AUTH_SECRET
npm install
npm run db:push
npm run db:seed
npm run dev
```

### 生产部署 (Vercel + Neon)

```bash
vercel deploy
# 设置环境变量: DATABASE_URL, DEEPSEEK_API_KEY, BETTER_AUTH_SECRET, BETTER_AUTH_URL
# Neon 创建 PostgreSQL + pgvector
# npm run db:push (指向 Neon)
```

### 环境变量

| 变量 | 必填 | 说明 |
|------|------|------|
| DATABASE_URL | ✅ | PostgreSQL 连接串 |
| DEEPSEEK_API_KEY | ✅ | DeepSeek API Key |
| BETTER_AUTH_SECRET | ✅ | Auth 加密密钥 (openssl rand -base64 32) |
| BETTER_AUTH_URL | ✅ | 应用 URL (本地 http://localhost:3000) |
| SERPAPI_API_KEY | 可选 | 网页搜索功能需要 |
| BAILIAN_API_KEY | 可选 | 知识库嵌入功能需要 |
| SEED_EMAIL/PASSWORD/NAME | 可选 | db:seed 管理员账号 |
