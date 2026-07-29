# Cloudflare 部署方案

## 部署架构

```
用户请求
  │
  ├── https://app.your-domain.com (Pages 自定义域名)
  │     └── Cloudflare Pages (静态资源: React SPA)
  │
  └── https://api.your-domain.com (Worker 自定义域名)
        └── Cloudflare Workers (Hono API)
              │
              ├── Hyperdrive → Supabase PostgreSQL
              │     ├── 关系数据（13 张表）
              │     └── 向量数据（pgvector, 1024维, cosine）
              │
              ├── KV (限流 + 配额)
              │     RATE_LIMIT_KV — 滑动窗口限流
              │     QUOTA_KV — 日配额计数
              │
              └── 外部 API
                    DeepSeek (LLM)
                    Workers AI (文本嵌入)
                    SerpAPI (网页搜索)
```

## 前置依赖

1. **Cloudflare 账号** — 建议 Workers Paid Plan（免费版 Worker 3MB 限制可能不够）
2. **域名**（可选）— 或用 `*.workers.dev` / `*.pages.dev` 子域名
3. **DeepSeek API Key** — LLM 调用
4. **SerpAPI Key**（可选）— 网页搜索工具
5. **Bailian / DashScope API Key**（可选）— 文本嵌入（知识库功能需要）

---

## 第一步：创建 Cloudflare 资源

### 1.1 KV Namespaces

```bash
cd backend
npx wrangler kv namespace create rate-limit-kv
npx wrangler kv namespace create quota-kv
```

将输出的 `id` 填入 `backend/wrangler.jsonc`：

```jsonc
"kv_namespaces": [
  { "binding": "RATE_LIMIT_KV", "id": "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx" },
  { "binding": "QUOTA_KV",      "id": "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx" }
]
```

### 1.2 创建 Supabase 数据库

1. 在 [supabase.com](https://supabase.com) 注册并创建项目
2. 项目创建后，在 Settings → Database → Connection string 获取连接串
3. 格式：`postgresql://postgres:xxxxx@db.xxxxx.supabase.co:5432/postgres`
4. 在 Supabase SQL Editor 中启用 pgvector 扩展：

```sql
CREATE EXTENSION IF NOT EXISTS vector;
```

### 1.3 创建 Hyperdrive

```bash
cd backend
npx wrangler hyperdrive create agent-platform-hyperdrive --connection-string="postgresql://postgres:xxxxx@db.xxxxx.supabase.co:5432/postgres"
```

输出示例：
```
✅ Successfully created Hyperdrive 'agent-platform-hyperdrive'
ID: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
```

将输出的 `id` 填入 `backend/wrangler.jsonc`：

```jsonc
"hyperdrive": [
  {
    "binding": "HYPERDRIVE",
    "id": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
  }
]
```

---

## 第二步：初始化数据库

### 2.1 本地开发（Docker PostgreSQL）

```bash
# 启动 Docker PostgreSQL
docker run --name pg-agent \
  -e POSTGRES_PASSWORD=postgres \
  -p 5432:5432 \
  -d postgres:18

docker exec pg-agent createdb -U postgres agent_platform

# 启用 pgvector 扩展
docker exec pg-agent psql -U postgres -d agent_platform -c "CREATE EXTENSION IF NOT EXISTS vector;"

# 推送 Schema
cd backend
DATABASE_URL=postgres://postgres:YOUR_PASSWORD@localhost:5432/agent_platform npx drizzle-kit push
```

### 2.2 生产（Supabase）

```bash
# 推送 Schema 到 Supabase
cd backend
DATABASE_URL="postgresql://postgres:xxxxx@db.xxxxx.supabase.co:5432/postgres" npx drizzle-kit push
```

### 2.3 创建管理员账号

通过应用注册页面创建，或直接插入 SQL：

```sql
INSERT INTO users (id, name, email, email_verified, created_at, updated_at)
VALUES ('admin-id', '管理员', 'admin@example.com', true, now(), now());
```

---

## 第三步：配置 Secrets

Worker 的 API Key 必须通过 `wrangler secret` 设置，**不能**写在 `wrangler.jsonc` 或 `.env` 文件中。

```bash
cd backend

npx wrangler secret put DEEPSEEK_API_KEY
# 输入: sk-xxxxx

npx wrangler secret put DEEPSEEK_BASE_URL
# 输入: https://api.deepseek.com/v1

npx wrangler secret put JWT_SECRET
# 输入: (openssl rand -base64 32 生成的随机字符串)

npx wrangler secret put VITE_API_URL
# 输入: 前端部署域名（仅在 Cloudflare Pages 中需要）

npx wrangler secret put SERPAPI_API_KEY
# 输入: (可选，按需配置)
```

---

## 第四步：部署后端

### 手动部署

```bash
cd backend
npm run deploy
# 等价于: npx wrangler deploy
```

部署后会输出一个 `*.workers.dev` 域名，如 `https://agent-platform-api.xxxx.workers.dev`。

### 自定义域名

在 Cloudflare Dashboard → Workers & Pages → `agent-platform-api` → Triggers → Custom Domain 添加域名，如 `api.your-domain.com`。

---

## 第五步：部署前端

### 5.1 配置前端环境变量

创建 `frontend/.env.production`：

```bash
# frontend/.env.production
VITE_API_URL=https://api.your-domain.com
```

### 5.2 手动部署到 Pages

方式一：**wrangler pages deploy**

```bash
cd frontend
npm run build
npx wrangler pages deploy dist --project-name agent-platform
```

首次部署会创建 Pages 项目，输出 `https://agent-platform.pages.dev`。

方式二：**Git 集成**（推荐）

在 Cloudflare Dashboard → Workers & Pages → Create → Pages → Connect to Git，选择仓库，设置：

- **Build command**: `cd frontend && npm install && npm run build`
- **Build output directory**: `frontend/dist`
- **Environment variables**:
  - `VITE_API_URL` → `https://api.your-domain.com`

### 5.3 自定义域名

在 Pages 项目 → Custom domains 添加域名，如 `app.your-domain.com`。

### 5.4 更新后端 CORS

部署前确保 `backend/src/index.ts` 的 CORS origin 包含了前端域名：

```ts
app.use("*", cors({
  origin: [
    "http://localhost:5173",
    "https://app.your-domain.com",     // ← 生产前端域名
    "https://agent-platform.pages.dev",  // ← Pages 默认域名
  ],
  credentials: true,
  // ...
}));
```

修改后重新部署后端。

---

## 第六步：CI/CD 自动部署

项目已配置 GitHub Actions（`.github/workflows/ci.yml`），推送 `main` 分支时自动部署。

配置 GitHub Secrets：

| Secret | 值 |
|--------|-----|
| `CLOUDFLARE_API_TOKEN` | Cloudflare API Token（需 Workers + Pages 权限） |
| `CLOUDFLARE_ACCOUNT_ID` | 你的 Cloudflare Account ID（Dashboard 右侧获取） |

CI 流程：
1. `typecheck-backend` — 后端类型检查
2. `typecheck-frontend` — 前端类型检查
3. `build-frontend` — 前端构建验证
4. `deploy`（仅 main）— 部署后端 Worker + 前端 Pages

---

## 环境变量汇总

### 后端 (wrangler secret)

| 变量 | 必填 | 说明 |
|------|:--:|------|
| `DEEPSEEK_API_KEY` | ✅ | DeepSeek API Key |
| `DEEPSEEK_BASE_URL` | ✅ | `https://api.deepseek.com/v1` |
| `JWT_SECRET` | ✅ | 随机密钥 (`openssl rand -base64 32`) |
| `VITE_API_URL` | ✅ | 后端 Worker 域名，如 `https://api.your-domain.com` |

### Cloudflare 绑定 (wrangler.jsonc)

| 绑定 | 类型 | 用途 |
|------|------|------|
| `HYPERDRIVE` | Hyperdrive | 连接 Supabase PostgreSQL（含 pgvector） |
| `RATE_LIMIT_KV` | KV | 限流 |
| `QUOTA_KV` | KV | 配额 |

---

## 本地 wrangler.jsonc 完整示例

```jsonc
{
  "$schema": "node_modules/wrangler/config-schema.json",
  "main": "src/index.ts",
  "name": "agent-platform-api",
  "compatibility_date": "2026-07-28",
  "compatibility_flags": ["nodejs_compat"],
  "hyperdrive": [
    {
      "binding": "HYPERDRIVE",
      "id": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
    }
  ],
  "kv_namespaces": [
    { "binding": "RATE_LIMIT_KV", "id": "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx" },
    { "binding": "QUOTA_KV",      "id": "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx" }
  ]
}
```

---

## 验证清单

部署后验证以下功能：

- [ ] `GET /api/health` 返回 `{"status":"healthy"}`
- [ ] 登录/注册流程正常
- [ ] Agent CRUD 正常
- [ ] 流式对话（SSE）正常
- [ ] 工具调用（搜索/网络请求）正常
- [ ] 知识库上传 + RAG 检索正常
- [ ] 自定义工具管理正常

---

## 已知限制

### 1. Worker 大小
- 免费版: 3MB (compressed)
- 付费版: 10MB (compressed)
- 若超限，考虑 `wrangler deploy --minify` 或升级 Paid Plan

### 2. PDF 解析
- `pdf-parse` 依赖 Node.js Buffer API
- 当前通过 `nodejs_compat` flag 提供兼容性
- 如果出现问题，可替换为 `pdfjs-dist` 或 `@n1ru4l/pdf2text`

### 3. SSE 流式输出
- Cloudflare Workers 支持 ReadableStream
- 已在 `chat.ts` 中使用标准 SSE 模式

### 4. 限流和配额
- 使用 KV 存储，TTL 自动过期
- KV 写入有每秒限制，但通常足够

### 5. 云厂商锁定
- 数据库通过 Drizzle ORM + PostgreSQL，结构性依赖较低
- Hyperdrive 是 Cloudflare 专有服务，迁移到其他平台需绕过它直接连接数据库

---

## 回滚

```bash
# 后端（部署上一个版本）
npx wrangler rollback

# 前端 (Pages → Dashboard → 选择版本 → Rollback)
```
