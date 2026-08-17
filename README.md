# Simple AI Agent Platform

轻量级 AI Agent 管理平台。通过 Web UI 创建、配置 Agent，赋予工具调用能力，与 DeepSeek 模型流式对话。

## Features

- **Agent 管理** — 创建/编辑/删除 Agent，自定义系统提示词与模型参数
- **流式对话** — 实时流式响应，支持中途停止生成
- **对话历史** — 自动保存会话，支持多轮对话上下文与历史回溯
- **工具调用** — Agent 可自动调用内置工具（网页搜索、网络请求）或自定义 HTTP API
- **自定义工具** — 可视化参数编辑器，无需手写 JSON Schema
- **知识库 (RAG)** — 上传文档（TXT/Markdown/PDF）、自动分块、异步向量化、Agent 绑定知识库、相似度检索并标注来源
- **用户认证** — 邮箱 + 密码登录，自研 JWT + refresh token 轮换，适合多人使用
- **产品落地页** — 未登录访问 `/` 展示产品介绍与界面预览，引导登录/注册

## Tech Stack

| 层级 | 技术 |
|------|------|
| Backend | Hono 4.x (Cloudflare Workers) |
| Frontend | React 19 + Vite 8 + Tailwind CSS 4 + @base-ui/react |
| Language | TypeScript 6 |
| Database | PostgreSQL（Hyperdrive 代理）+ pgvector |
| Vector DB | PostgreSQL pgvector (cosine, 1024d) |
| ORM | Drizzle ORM (postgres-js) |
| AI SDK | OpenAI SDK (DeepSeek) |
| Streaming | ReadableStream SSE |
| Embedding | workers-ai (BGE-M3) / DashScope / mock（EMBEDDING_PROVIDER 切换） |
| Auth | 自研 JWT (jose) + refresh token 轮换 |
| Validation | Zod 4 |
| Cache | Cloudflare KV（限流） |
| Deploy | Cloudflare Workers + Pages |

## Quick Start

### 前置条件

- Node.js ≥ 22
- Docker（用于本地 PostgreSQL）
- DeepSeek API Key ([platform.deepseek.com](https://platform.deepseek.com))
- Cloudflare 账号（可选，本地开发不需要）

### 数据库

```bash
# 启动 PostgreSQL（含 pgvector）
docker run --name pg-agent \
  -e POSTGRES_PASSWORD=postgres \
  -p 5432:5432 \
  -d postgres:18

docker exec pg-agent createdb -U postgres agent_platform

# 启用 pgvector
docker exec pg-agent psql -U postgres -d agent_platform \
  -c "CREATE EXTENSION IF NOT EXISTS vector;"

# 推送 Schema
cd backend
DATABASE_URL=postgres://postgres:YOUR_PASSWORD@localhost:5432/agent_platform \
  npx drizzle-kit push
```

### 后端

```bash
cd backend
cp .env.example .env.local
# 编辑 .env.local，填入 API Key
npm install
npm run dev
# → http://localhost:8787
```

### 前端

```bash
cd frontend
# 如果后端不在本机 8787 端口，创建 frontend/.env.local 并填入：
# VITE_API_URL=http://localhost:8787
npm install
npm run dev
# → http://localhost:5173
```

### 首次使用

1. 创建管理员账号（注册默认关闭，需初始化账号）：

   ```bash
   cd backend
   DATABASE_URL=postgres://postgres:YOUR_PASSWORD@localhost:5432/agent_platform \
     SEED_EMAIL=admin@example.com SEED_PASSWORD=your-password npm run db:seed
   # 支持 SEED_EMAIL / SEED_PASSWORD / SEED_NAME（默认 管理员 / admin@example.com / changeme123）
   ```

   若需开放公开注册，在 `.env.local` 设 `ALLOW_SIGNUP=true` 后重启。
2. 打开 `http://localhost:5173` 浏览产品落地页（未登录可见），或直接打开 `http://localhost:5173/login` 登录管理员账号
3. 点击「新建」创建第一个 Agent：填写名称、系统提示词，勾选需要的工具
4. 点击 Agent 进入聊天页面，发送消息开始对话

## Project Structure

```
├── backend/                     # Hono + Cloudflare Workers
│   ├── src/
│   │   ├── index.ts             # Hono 应用入口（路由 + CORS + 错误处理）
│   │   ├── routes/              # API 路由
│   │   │   ├── _middleware.ts   # requireUser 认证中间件
│   │   │   ├── agents.ts        # /api/agents CRUD
│   │   │   ├── auth.ts          # /api/auth (自研 JWT)
│   │   │   ├── chat.ts          # /api/chat 流式对话
│   │   │   ├── chats.ts         # /api/chats 对话管理
│   │   │   ├── knowledge.ts     # /api/knowledge 知识库 CRUD
│   │   │   ├── tools.ts         # /api/tools 工具 CRUD
│   │   │   └── health.ts        # /api/health 健康检查
│   │   └── lib/
│   │       ├── ai/              # AI 能力 (provider / embedding / chunker / retriever)
│   │       ├── chat/            # 对话逻辑 (build-context / retrieve / tool-loop / generate-title)
│   │       ├── tools/           # 工具系统 (内置工具 + 自定义工具 + url-guard)
│   │       ├── db/              # Drizzle ORM (postgres-js) + 11 张表 schema
│   │       ├── jwt.ts           # access token + refresh token 签发/校验
│   │       ├── config.ts        # 统一配置
│   │       ├── env-holder.ts    # Cloudflare 环境持有者
│   │       ├── errors.ts        # 统一错误响应
│   │       ├── logger.ts        # 日志
│   │       ├── quota.ts         # 配额框架
│   │       ├── rate-limit.ts    # KV 滑动窗口限流
│   │       ├── validate.ts      # Zod 校验包装
│   │       └── validators.ts    # Zod Schema
│   ├── scripts/                 # seed + backup
│   ├── wrangler.jsonc           # Cloudflare Workers 配置
│   └── drizzle.config.ts        # Drizzle ORM 配置
│
├── frontend/                    # Vite + React 19
│   ├── src/
│   │   ├── App.tsx              # 路由 + Auth + QueryClient
│   │   ├── main.tsx             # React 入口
│   │   ├── pages/               # 页面组件 (landing / agents / tools / knowledge / login / signup)
│   │   ├── components/          # UI 组件 (chat / ui / sidebar / empty-state / confirm-dialog / landing)
│   │   ├── hooks/               # useChat SSE Hook
│   │   └── lib/                 # api 客户端 / auth 上下文 / types / utils
│   └── vite.config.ts
│
├── services/                    # 辅助服务（base: PDF 解析，已停用保留参考，Python FastAPI + PyMuPDF）
├── docs/                        # 架构 + 部署文档
├── specs/                       # MVP 规格
├── AGENTS.md                    # AI 编码代理规则
└── package.json                 # Monorepo 脚本调度
```

## API Reference

### Agents

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/agents` | 获取 Agent 列表 |
| `POST` | `/api/agents` | 创建 Agent |
| `GET` | `/api/agents/:id` | 获取 Agent 详情（含启用的工具/知识库） |
| `PUT` | `/api/agents/:id` | 更新 Agent |
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
| `PATCH` | `/api/chats/:id` | 重命名对话 |
| `DELETE` | `/api/chats/:id` | 删除对话 |
| `GET` | `/api/chats/:id/messages` | 获取消息历史 |

### Tools

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/tools` | 获取自定义工具列表 |
| `POST` | `/api/tools` | 创建自定义工具 |
| `GET` | `/api/tools/:id` | 获取工具详情 |
| `PUT` | `/api/tools/:id` | 更新工具 |
| `DELETE` | `/api/tools/:id` | 删除工具 |

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
| `DELETE` | `/api/knowledge/:id/documents/:docId` | 删除文档 |

### Health

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/health` | 健康检查 |

## Environment Variables

```bash
# AI 服务
DEEPSEEK_API_KEY=sk-your-key                      # DeepSeek API Key
DEEPSEEK_BASE_URL=https://api.deepseek.com/v1      # DeepSeek API 地址
SERPAPI_API_KEY=your-serpapi-key                   # 网页搜索（可选）

# 嵌入服务（知识库 RAG）
# EMBEDDING_PROVIDER=workers-ai                    # workers-ai（生产）/ dashscope（本地真实）/ mock（本地链路调试）
DASHSCOPE_API_KEY=sk-your-dashscope-key            # 阿里云百炼 Key（EMBEDDING_PROVIDER=dashscope 时需要）
DASHSCOPE_BASE_URL=https://dashscope.aliyuncs.com/compatible-mode/v1
DASHSCOPE_EMBEDDING_MODEL=text-embedding-v3       # 1024 维，与数据库 schema 匹配

# 检索参数（可选）
# KNOWLEDGE_TOP_K=3
# KNOWLEDGE_SIMILARITY_THRESHOLD=0.6             # cosine 距离阈值，越小越严格（DashScope 实测相关距离约 0.5-0.6）

# PDF 解析（Worker 内本地解析，unpdf；无需 base 服务）
# KNOWLEDGE_MAX_FILE_SIZE=5242880                # 上传文件大小上限（默认 5MB）
# KNOWLEDGE_MAX_PDF_PAGES=100                    # PDF 页数上限

# Auth
JWT_SECRET=                                     # openssl rand -base64 32 生成的签名密钥
# ALLOW_SIGNUP=true                             # 注册开关，默认关闭（未配置即禁止注册，用 npm run db:seed 创建账号）
VITE_API_URL=http://localhost:8787               # 前端 API 地址（frontend/.env）
```

 ## Deployment

参见 [docs/cloudflare-deployment.md](docs/cloudflare-deployment.md)。
PDF 解析在 Worker 内完成，无独立服务；原 base 服务（ECS）已停用，保留参考见 [docs/ecs-deployment.md](docs/ecs-deployment.md)。

## Security

- **认证**：access token 15 分钟（JWT HS256 + issuer），refresh token 随机 256bit、仅存 SHA-256 摘要、一次性轮换、HttpOnly cookie
- **CSRF**：cookie 鉴权的 auth 端点（refresh / sign-out）采用 Double-submit cookie + `X-CSRF-Token` 头校验
- **SSRF 防护**：自定义工具/内置网页请求先 DNS 解析校验实际 IP（拒绝内网/环回/云元数据），http 直连锁定 IP 防 DNS rebinding，拒绝跟随重定向；https 保留域名请求（TLS 绑定，残余风险可接受）
- **提示注入**：外部内容（网页/搜索/知识库）以 `<untrusted_data>` 标签包裹并声明安全规则
- **防枚举**：登录/注册统一错误文案，用户不存在时执行 dummy bcrypt 比较消除时序差异；邮箱规范化（trim + 小写）
- **密钥管理**：API key / JWT_SECRET 通过 `wrangler secret` 配置，禁止写入代码或仓库；任何密钥泄露必须立即轮换
- **限流**：认证接口与对话按用户/IP 基于 KV 限流（阈值含 0.9 容差，缓解 KV 非原子竞态）

## MVP Scope

```
✅ Agent CRUD            ✅ 流式对话
✅ 对话历史              ✅ Tool Calling
✅ 网页搜索 + 网络请求    ✅ 自定义工具
✅ 知识库 (RAG)          ✅ 文档上传 + 向量检索
✅ 用户认证 (自研 JWT)    ✅ 多用户数据隔离

明确不做的功能（后续迭代考虑）：
✗ 多 Agent 编排          ✗ MCP 协议
✗ 工作流引擎             ✗ 计费 / 统计
✗ 图片 / 语音            ✗ 模板市场
```

## License

MIT
