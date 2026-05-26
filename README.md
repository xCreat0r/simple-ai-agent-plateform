# Simple AI Agent Platform

一个轻量级 AI Agent 管理平台。通过 Web UI 创建、配置 Agent，赋予工具调用能力，与 DeepSeek 模型流式对话。

## Features

- **Agent 管理** — 创建/编辑/删除 Agent，自定义系统提示词与模型参数
- **流式对话** — 实时流式响应，支持中途停止生成
- **对话历史** — 自动保存会话，支持多轮对话上下文与历史回溯
- **工具调用** — Agent 可自动调用内置工具（网页搜索、网络请求）或自定义 HTTP API
- **自定义工具** — 可视化参数编辑器，无需手写 JSON Schema
- **单用户 MVP** — 零配置认证，开箱即用

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
# 编辑 .env.local，填入 DEEPSEEK_API_KEY

# 3. 安装依赖
npm install

# 4. 推送数据库 Schema
DATABASE_URL=postgres://postgres:postgres@localhost:5432/agent_platform npm run db:push

# 5. 启动开发服务器
npm run dev
# → http://localhost:3000
```

### 首次使用

1. 打开 `http://localhost:3000/agents`
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
│   └── api/
│       ├── agents/                 # Agent CRUD
│       ├── chat/                   # 流式对话
│       ├── chats/                  # 对话管理
│       └── tools/                  # 工具 CRUD
├── components/
│   ├── ui/                         # shadcn/ui 组件
│   ├── agents/                     # Agent 列表卡片、表单、工具选择器
│   ├── chat/                       # 消息列表、输入框
│   └── tools/                      # 工具卡片、表单
└── lib/
    ├── db/schema/                  # Drizzle Schema (users, agents, agent_tools, chats, messages, tools)
    ├── tools/                      # 内置工具 + 注册表 + DB 查询
    ├── ai/provider.ts              # DeepSeek Client
    └── auth.ts                     # Auth stub (预留)
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

## Environment Variables

```bash
# 必填
DEEPSEEK_API_KEY=sk-your-key       # DeepSeek API Key
DATABASE_URL=postgres://...         # PostgreSQL 连接字符串

# 可选
DEEPSEEK_BASE_URL=https://api.deepseek.com/v1  # DeepSeek API 地址
```

## Deployment

### Vercel + Neon

```bash
# 1. 部署到 Vercel
vercel deploy

# 2. 设置环境变量
# DATABASE_URL → Neon 提供的连接字符串
# DEEPSEEK_API_KEY → 你的 API Key
```

### Docker

```bash
docker compose up -d
```

## MVP Scope

当前实现的功能：

```
✅ Agent CRUD            ✅ 流式对话
✅ 对话历史              ✅ Tool Calling
✅ 网页搜索 + 网络请求    ✅ 自定义工具
```

明确不做的功能（后续迭代考虑）：

```
✗ 多用户 / Auth         ✗ RAG / 知识库
✗ 多 Agent 编排          ✗ MCP 协议
✗ 工作流引擎             ✗ 计费 / 统计
✗ 图片 / 语音            ✗ 模板市场
```

## License

MIT
