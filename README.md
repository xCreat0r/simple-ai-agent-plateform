# Simple AI Agent Platform

一个轻量级 AI Agent 管理平台。通过 Web UI 创建、配置 Agent，赋予工具调用能力，与 DeepSeek 模型流式对话。

## Features

- **Agent 管理** — 创建/编辑/删除 Agent，自定义系统提示词与模型参数
- **流式对话** — 实时流式响应，支持中途停止生成
- **对话历史** — 自动保存会话，支持多轮对话上下文与历史回溯
- **工具调用** — Agent 可自动调用内置工具（网页搜索、网络请求）或自定义 HTTP API
- **自定义工具** — 可视化参数编辑器，无需手写 JSON Schema
- **知识库 (RAG)** — 上传文档（TXT/Markdown/PDF）、自动分块、向量检索、Agent 绑定知识库
- **用户认证** — 邮箱 + 密码登录，Better Auth 驱动，适合多人使用

## Tech Stack

| 层级 | 技术 |
|------|------|
| Framework | Next.js 16 (App Router) |
| UI | React 19 + Tailwind CSS 4 + shadcn/ui v4 |
| Language | TypeScript 6 |
| Database | PostgreSQL 18 |
| ORM | Drizzle ORM |
| AI SDK | OpenAI SDK (DeepSeek 兼容) |
| Streaming | ReadableStream SSE |
| Embedding | 阿里云 DashScope (text-embedding-v3) |
| Auth | Better Auth (邮箱 + 密码) |
| Validation | Zod 4 |

## Quick Start

### Prerequisites

- Node.js ≥ 24
- Docker (for PostgreSQL)
- DeepSeek API Key ([platform.deepseek.com](https://platform.deepseek.com))

### Setup

```bash
# 1. 启动 PostgreSQL
docker run --name pg-agent \
  -e POSTGRES_PASSWORD=postgres \
  -p 5432:5432 \
  -d postgres:18

docker exec pg-agent createdb -U postgres agent_platform

# 2. 配置环境变量
cp .env.example .env.local
# 编辑 .env.local，填入所有 API Key
# 生成 BETTER_AUTH_SECRET: openssl rand -base64 32

# 3. 安装依赖
npm install

# 3. 初始化数据库扩展
npm run db:init

# 4. 推送数据库 Schema
DATABASE_URL=postgres://postgres:postgres@localhost:5432/agent_platform npm run db:push

# 5. 创建 HNSW 索引
npm run db:index

# 6. 创建管理员用户
npm run db:seed

# 7. 启动开发服务器
npm run dev
# → http://localhost:3000
```

### 首次使用

1. 打开 `http://localhost:3000/login`，用管理员账号登录
2. 点击「新建」创建第一个 Agent：填写名称、系统提示词，勾选需要的工具
3. 点击 Agent 进入聊天页面，发送消息开始对话

## Project Structure

```
src/
├── app/
│   ├── page.tsx                    # / → /agents
│   ├── layout.tsx                  # 根布局
│   ├── globals.css                 # Tailwind
│   ├── agents/
│   │   ├── page.tsx                # Agent 列表
│   │   ├── new/page.tsx            # 创建 Agent
│   │   └── [id]/
│   │       ├── page.tsx            # 聊天页面
│   │       └── edit/page.tsx       # 编辑 Agent
│   ├── tools/
│   │   ├── page.tsx                # 工具列表
│   │   ├── new/page.tsx            # 创建工具
│   │   └── [id]/edit/page.tsx      # 编辑工具
│   ├── knowledge/
│   │   ├── page.tsx                # 知识库列表
│   │   ├── new/page.tsx            # 创建知识库
│   │   └── [id]/page.tsx           # 知识库详情 + 文档管理
│   └── api/
│   ├── login/                      # 登录页
│   ├── agents/                 # Agent CRUD
│       ├── chat/                   # 流式对话
│       ├── chats/                  # 对话管理
│       ├── tools/                  # 工具 CRUD
│       ├── knowledge/              # 知识库 CRUD + 文档上传/分块/嵌入
│       └── auth/[...all]/          # Better Auth 回调路由
├── components/
│   ├── ui/                         # shadcn/ui 组件
│   ├── agents/                     # Agent 列表卡片、表单、工具选择器
│   ├── chat/                       # 消息列表、输入框
│   └── tools/                      # 工具卡片、表单
└── lib/
    ├── db/schema/                  # Drizzle Schema (8 张表)
    ├── tools/                      # 内置工具 + 注册表 + DB 查询
    ├── ai/                         # AI 能力 (Provider / Embedding / Chunker / Retriever)
    └── auth.ts                     # Better Auth 配置 + getCurrentUser
```

## API Reference

### Agents

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/agents` | 获取 Agent 列表 |
| `POST` | `/api/agents` | 创建 Agent |
| `GET` | `/api/agents/:id` | 获取 Agent 详情（含启用的工具） |
| `PUT` | `/api/agents/:id` | 更新 Agent 配置 |
| `DELETE` | `/api/agents/:id` | 删除 Agent |

### Chat

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/chat` | 发送消息，流式返回 Agent 响应 |

### Chats

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/chats?agentId=` | 获取对话列表 |
| `POST` | `/api/chats` | 创建新对话 |
| `DELETE` | `/api/chats/:id` | 删除对话（级联删除消息） |
| `GET` | `/api/chats/:id/messages` | 获取消息历史 |

### Tools

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/tools` | 获取自定义工具列表 |
| `POST` | `/api/tools` | 创建自定义工具 |
| `GET` | `/api/tools/:id` | 获取工具详情 |
| `PUT` | `/api/tools/:id` | 更新工具 |
| `DELETE` | `/api/tools/:id` | 删除工具（清理关联引用） |

### Knowledge Bases

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/knowledge` | 获取知识库列表 |
| `POST` | `/api/knowledge` | 创建知识库 |
| `GET` | `/api/knowledge/:id` | 获取知识库详情（含文档列表） |
| `DELETE` | `/api/knowledge/:id` | 删除知识库 |
| `GET` | `/api/knowledge/:id/documents` | 获取文档列表 |
| `POST` | `/api/knowledge/:id/documents` | 上传文档（自动分块 + 嵌入） |
| `GET` | `/api/knowledge/:id/documents/:docId/content` | 查看文档内容 |
| `DELETE` | `/api/knowledge/:id/documents/:docId` | 删除文档

## Environment Variables

```bash
# 数据库
DATABASE_URL=postgres://...                       # PostgreSQL 连接字符串

# AI 服务
DEEPSEEK_API_KEY=sk-your-key                      # DeepSeek API Key
DEEPSEEK_BASE_URL=https://api.deepseek.com/v1      # DeepSeek API 地址
SERPAPI_API_KEY=your-serpapi-key                   # 网页搜索（SerpAPI）
BAILIAN_API_KEY=sk-your-bailian-key                 # 文本嵌入（阿里云 DashScope，知识库功能需要）

# Auth（必填）
BETTER_AUTH_SECRET=                                # openssl rand -base64 32 生成
BETTER_AUTH_URL=http://localhost:3000               # 应用 URL
```

## Deployment

### Vercel + Neon

```bash
# 1. 部署到 Vercel
vercel deploy

# 2. 在 Neon 创建免费 PostgreSQL 数据库（含 pgvector）
# 3. 设置环境变量
# DATABASE_URL → Neon 提供的连接字符串（注意 sslmode=require）
# DEEPSEEK_API_KEY → 你的 API Key
# BETTER_AUTH_SECRET → 随机密钥
# BETTER_AUTH_URL → https://your-app.vercel.app
# 4. 推送 Schema 并创建管理员账户
```

### Docker

使用第一步的 `docker run` 启动 PostgreSQL 即可，无需 `docker-compose`。

## MVP Scope

当前实现的功能：

```
✅ Agent CRUD            ✅ 流式对话
✅ 对话历史              ✅ Tool Calling
✅ 网页搜索 + 网络请求    ✅ 自定义工具
✅ 知识库 (RAG)          ✅ 文档上传 + 向量检索
✅ 用户认证 (Better Auth) ✅ 多用户数据隔离

明确不做的功能（后续迭代考虑）：

✗ 多 Agent 编排          ✗ MCP 协议
✗ 工作流引擎             ✗ 计费 / 统计
✗ 图片 / 语音            ✗ 模板市场
```

## License

MIT
