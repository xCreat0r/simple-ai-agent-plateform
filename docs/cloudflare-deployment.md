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
              │     ├── 关系数据（11 张表）
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
2. 项目创建后，在 Dashboard → **Connect（连接）** → 数据库 → **Session Pooler（会话池化）** → 复制连接串。
   **务必从 Dashboard 复制，不要手动拼写**（主机名以实际项目为准）。Session Pooler 格式：

   ```
   postgresql://postgres.<project-ref>:<password>@aws-0-<region>.pooler.supabase.com:5432/postgres
   ```

   > 密码包含在连接串内（`用户:密码@主机`），无需单独输入；若密码含特殊字符（`@` `:` `/`）需 URL 编码。
3. 在 Supabase SQL Editor 中启用 pgvector 扩展（schema 推送的前置依赖，缺失会导致向量列创建失败）：

```sql
CREATE EXTENSION IF NOT EXISTS vector;
```

> **为什么用 Session Pooler？** Supabase 直连地址（`db.<project-ref>.supabase.co`）要求 IPv6，多数本地/云网络无法直连，表现为 `db:push` 卡在 "Pulling schema from database..." 或连接超时。Session Pooler 支持 IPv4，下文所有 `DATABASE_URL`、seed、Hyperdrive 均使用它。
>
> 完整的数据库初始化流程见「第二步：初始化数据库」。

### 1.3 创建 Hyperdrive

```bash
cd backend
npx wrangler hyperdrive create agent-platform-hyperdrive --connection-string="<1.2 复制的 Session Pooler 连接串>"
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
DATABASE_URL=postgres://postgres:YOUR_PASSWORD@localhost:5432/agent_platform npm run db:push
```

### 2.2 生产（Supabase）

前置：已完成 Supabase 建库并启用 pgvector（见 1.2）。随后：

```bash
cd backend
# 1. 安装依赖
npm install

# 2. 推送 Schema 到 Supabase（首次初始化；后续变更见 2.5 迁移）
# DATABASE_URL 使用 1.2 复制的 Session Pooler 连接串
DATABASE_URL="postgresql://postgres.<project-ref>:<password>@aws-0-<region>.pooler.supabase.com:5432/postgres" npm run db:push
```

> 首次推送时数据库为空，drizzle 会展示将创建的建表语句并**询问是否应用**，输入 `y` 确认；自动化场景可用 `npm run db:push -- --force` 跳过询问。
>
> **排障**：若卡在 "Pulling schema from database..." 或连接超时，先 `nc -vz <主机名> 5432` 检查连通性，多半是连接串错误或误用了需要 IPv6 的直连地址——确认是从 Dashboard 复制的 Session Pooler 连接串。

3. 在 Supabase SQL Editor 验证 Schema 与扩展已就绪：

```sql
-- 业务表（共 11 张）
SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename;
-- 扩展
SELECT extname FROM pg_extension;
```

预期输出：`users`、`agents`、`agent_tools`、`chats`、`messages`、`tools`、`knowledge_bases`、`knowledge_documents`、`knowledge_chunks`、`agent_knowledge`、`refresh_tokens` 共 11 张表，且含 `vector` 扩展。

### 2.3 创建管理员账号

**注册默认关闭**，首次部署需用 seed 脚本初始化管理员账号（推荐）：

```bash
cd backend
DATABASE_URL="postgresql://postgres.<project-ref>:<password>@aws-0-<region>.pooler.supabase.com:5432/postgres" \
  SEED_EMAIL=admin@your-domain.com SEED_PASSWORD=your-password npm run db:seed
# 可选: SEED_NAME=管理员（默认 admin@example.com / changeme123 / 管理员）
# 脚本幂等：账号已存在时跳过，不会重复创建
# DATABASE_URL 使用 1.2 复制的 Session Pooler 连接串，密码包含在串内，无需单独输入
```

或用 SQL 直接插入（**需要同时写入 bcrypt 哈希后的密码**，否则无法登录）：

```bash
# 先本地生成 bcrypt 哈希（替换成目标密码）
cd backend && node -e "console.log(require('bcryptjs').hashSync('YOUR_PASSWORD', 10))"
```

```sql
INSERT INTO users (id, name, email, email_verified, password_hash, created_at, updated_at)
VALUES ('admin-id', '管理员', 'admin@example.com', true, '上面生成的哈希', now(), now());
```

> **注册开关**：`ALLOW_SIGNUP`（wrangler secret）默认关闭。需要开放公开注册时执行 `npx wrangler secret put ALLOW_SIGNUP` 并输入 `true`；关闭后仅能用 seed/SQL 创建账号。前端注册页会在关闭时自动显示"注册已关闭"提示。

### 2.4 初始化验证

本地与生产通用，按顺序核对：

- [ ] Schema 推送成功，`pg_tables` 查询到 11 张业务表（见 2.2）
- [ ] `vector` 扩展存在（`SELECT extname FROM pg_extension;`）
- [ ] `npm run db:seed` 输出「管理员账号创建成功」（幂等，重复执行显示「已存在」）
- [ ] 启动后端后 `GET /api/health` 返回 `{"status":"healthy"}`（验证数据库连通）
- [ ] 用管理员账号登录成功

### 2.5 Schema 变更（迁移）

两种方式，按场景选择：

| 方式 | 命令 | 适用场景 |
|------|------|---------|
| `push` | `npm run db:push` | 快速同步，适合本地开发 / 初次建表 |
| `generate + migrate` | 见下方 | 生产正式变更：生成 SQL 迁移文件 → 审查 → 应用 |

生产建议使用迁移文件（变更可审计、可回溯）：

```bash
cd backend
# DATABASE_URL 使用 1.2 复制的 Session Pooler 连接串
# 1. 对比 schema 代码与已有迁移，生成新迁移 SQL 到 drizzle/ 目录
DATABASE_URL="postgresql://postgres.<project-ref>:<password>@aws-0-<region>.pooler.supabase.com:5432/postgres" npm run db:generate

# 2. 审查生成的 drizzle/*.sql（确认改动符合预期，无意外 DROP）
git diff drizzle/

# 3. 提交迁移文件后，在目标数据库应用
DATABASE_URL="postgresql://postgres.<project-ref>:<password>@aws-0-<region>.pooler.supabase.com:5432/postgres" npx drizzle-kit migrate
```

> **回滚**：`push` 方式无原生回滚，变更前务必先备份（见「数据库备份」）；迁移文件方式可手动执行逆向 SQL（删除新表/列），或直接从备份恢复。

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

npx wrangler secret put SERPAPI_API_KEY
# 输入: (可选，按需配置)

npx wrangler secret put EMBEDDING_PROVIDER
# 输入: workers-ai（默认，生产推荐）/ dashscope（阿里云百炼）

npx wrangler secret put ALLOW_SIGNUP
# 输入: true（开放公开注册）；不配置即默认关闭注册
```

> **重要**：`wrangler.jsonc` 中的 `CHANGE_ME` 占位符（HYPERDRIVE / KV 的 id）必须在首次部署前全部替换为实际资源 id，否则部署会失败或无法连接。
> `EMBEDDING_PROVIDER` 未显式配置时默认为 `workers-ai`，需要打开 `wrangler.jsonc` 中的 `"ai"` binding（见下）；若使用 `dashscope`，还需 `wrangler secret put DASHSCOPE_API_KEY`。

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

生产推荐 **Pages Functions 同源代理**：前端与 `/api` 完全同源（同一域名），
`refresh_token` / `csrf_token` cookie 全部落在页面域，SameSite 与 Double-submit CSRF
无需任何跨站配置即可正常工作，不依赖自定义域名。

```
用户浏览器 ──同源──> https://agent-platform.pages.dev (Pages: 静态资源 + /api 代理)
                              └── /api/* ──服务器转发──> https://agent-platform-api.xxx.workers.dev (Worker)
```

### 5.1 配置前端环境变量

创建 `frontend/.env.production`，`VITE_API_URL` **留空**（同源相对路径）：

```bash
# frontend/.env.production
VITE_API_URL=
```

> `VITE_API_URL` 是前端**构建时**变量（Vite 编译时注入浏览器），**不是 Worker secret**。
> 留空时前端请求走同源 `/api/*`，由 Pages Function 转发；仅本地开发才填 `http://localhost:8787`。

后端 Worker 地址配置在 Pages 项目环境变量 `API_ORIGIN`（运行时读取，可随时修改，无需重新构建前端）：

- Pages 项目 → Settings → Environment variables → Production → 新增
  - 变量名：`API_ORIGIN`
  - 值：后端 Worker 公开地址，如 `https://agent-platform-api.xxx.workers.dev`

### 5.2 手动部署到 Pages

方式一：**wrangler pages deploy**

```bash
cd frontend
npm run build
npx wrangler pages deploy dist --project-name agent-platform
```

首次部署会创建 Pages 项目，输出 `https://agent-platform.pages.dev`。

> 同源代理位于 `frontend/functions/` 目录，`wrangler pages deploy` 与 Git 集成均会自动包含并部署，无需额外配置。

方式二：**Git 集成**（推荐）

在 Cloudflare Dashboard → Workers & Pages → Create → Pages → Connect to Git，选择仓库，设置：

- **Build command**: `cd frontend && npm install && npm run build`
- **Build output directory**: `frontend/dist`
- **Environment variables**:
  - `VITE_API_URL` → `https://api.your-domain.com`

### 5.3 自定义域名

在 Pages 项目 → Custom domains 添加域名，如 `app.your-domain.com`。

### 5.4 更新后端 CORS

同源代理下浏览器请求与 `/api` 同源，不触发 CORS，`CORS_ORIGINS` 不影响功能。但默认白名单含占位域名
`https://app.agent-platform.com`，若该域名不属于你，建议用 `CORS_ORIGINS` 覆盖为真实前端域名或留空，避免跨源攻击面：

```bash
cd backend
npx wrangler secret put CORS_ORIGINS
# 输入: https://agent-platform.pages.dev（或直接输入空值回车，禁用跨站来源）
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
| `EMBEDDING_PROVIDER` | 可选 | `workers-ai`（默认）/ `dashscope` / `mock`（仅本地调试） |
| `DASHSCOPE_API_KEY` | 按需 | `EMBEDDING_PROVIDER=dashscope` 时必填 |
| `DASHSCOPE_BASE_URL` | 可选 | DashScope 兼容地址（默认官方 `https://dashscope.aliyuncs.com/compatible-mode/v1`） |
| `DASHSCOPE_EMBEDDING_MODEL` | 可选 | 默认 `text-embedding-v3`（1024 维，与 schema 匹配） |
| `ALLOW_SIGNUP` | 可选 | 注册开关，默认关闭；设 `true` 开放公开注册 |
| `CORS_ORIGINS` | 可选 | 逗号分隔的跨站白名单；同源代理下无需配置，仅跨站直连时需要 |

### Pages 项目环境变量

| 变量 | 必填 | 说明 |
|------|:--:|------|
| `API_ORIGIN` | ✅ | 后端 Worker 公开地址，如 `https://agent-platform-api.xxx.workers.dev`；Pages Function 据此转发 `/api/*` |

### Cloudflare 绑定 (wrangler.jsonc)

| 绑定 | 类型 | 用途 |
|------|------|------|
| `HYPERDRIVE` | Hyperdrive | 连接 Supabase PostgreSQL（含 pgvector） |
| `RATE_LIMIT_KV` | KV | 限流 |
| `QUOTA_KV` | KV | 配额 |
| `AI` | Workers AI | 嵌入（`EMBEDDING_PROVIDER=workers-ai` 时需要） |

---

## 本地 wrangler.jsonc 完整示例

```jsonc
{
  "$schema": "node_modules/wrangler/config-schema.json",
  "main": "src/index.ts",
  "name": "agent-platform-api",
  "compatibility_date": "2026-07-28",
  "compatibility_flags": ["nodejs_compat"],
  "triggers": {
    "crons": ["0 */6 * * *"]
  },
  "hyperdrive": [
    {
      "binding": "HYPERDRIVE",
      "id": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
    }
  ],
  "kv_namespaces": [
    { "binding": "RATE_LIMIT_KV", "id": "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx" },
    { "binding": "QUOTA_KV",      "id": "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx" }
  ],
  "ai": { "binding": "AI" }
}
```

> `"triggers"` 是 cron 定时任务（每 6 小时回收超时处理中的知识库文档），部署后自动生效。
> `"ai"` binding 仅在 `EMBEDDING_PROVIDER=workers-ai` 时需要；若用 `dashscope` 可省略。
> `localConnectionString` 仅本地开发用，生产部署前应删除。

---

## 验证清单

部署后验证以下功能：

- [ ] `GET /api/health` 返回 `{"status":"healthy"}`
- [ ] 管理员账号登录正常（注册默认关闭；开放注册时 `/signup` 页显示表单且可注册）
- [ ] Agent CRUD 正常
- [ ] 流式对话（SSE）正常
- [ ] 工具调用（搜索/网络请求）正常
- [ ] 知识库上传 + RAG 检索正常
- [ ] 上传 PDF 返回 202，随后文档状态变为 `ready`（文档列表含 `chunkCount`）
- [ ] Agent 绑定知识库后，对话回答引用来源文件名
- [ ] `wrangler tail` 可看到 `knowledge.*` 结构化指标日志
- [ ] 自定义工具管理正常

---

## 已知限制

### 1. Worker 大小
- 免费版: 3MB (compressed)
- 付费版: 10MB (compressed)
- 若超限，考虑 `wrangler deploy --minify` 或升级 Paid Plan

### 2. PDF 解析
- PDF 文本提取在 Worker 内**本地解析**（`unpdf` / PDF.js serverless 构建，见 `src/lib/ai/pdf.ts`），无需独立服务与 `BASE_SERVICE_*` secrets
- 上传限制：默认 5MB（`KNOWLEDGE_MAX_FILE_SIZE`）、页数上限 100（`KNOWLEDGE_MAX_PDF_PAGES`）；解析在主事件循环执行，内置 30s 超时与资源防护
- ⚠️ 免费版有每请求 CPU 时间限制，大 PDF 可能被截断；生产建议使用付费计划（Bundled）
- 原 base 服务（ECS）已停用，代码保留于 `services/base` 作参考/回退，参见 [ecs-deployment.md](ecs-deployment.md)

### 3. SSE 流式输出
- Cloudflare Workers 支持 ReadableStream
- 已在 `chat.ts` 中使用标准 SSE 模式

### 4. 限流和配额
- 使用 KV 存储，TTL 自动过期
- KV 写入有每秒限制，但通常足够
- KV get-then-put 非原子，高并发下计数可能偏低；阈值内置 0.9 容差系数缓解竞态（尽力而为）

### 5. 安全机制
- **CSRF**：`refresh` / `sign-out` 等 cookie 鉴权端点使用 Double-submit cookie（非 HttpOnly `csrf_token` + `X-CSRF-Token` 请求头），前端 `fetch-with-auth.ts` 自动附加；无匹配头返回 403
- **refresh token 哈希**：落库仅存 SHA-256 摘要（`src/lib/util/hash.ts`），数据库泄露时明文令牌不可复用；旧明文 token 已全部失效（需重新登录）
- **防枚举**：注册统一文案不暴露邮箱存在性；登录时用户不存在也执行 dummy bcrypt 比较消除时序差异；邮箱统一 `trim().toLowerCase()` 后入库（存量数据可用 `backend/scripts/normalize-emails.ts` 修正）
- **SSRF**：自定义工具与内置网页请求先 DNS 解析校验实际 IP（拒绝内网/环回/云元数据），`http://` 锁定已校验 IP 直连并覆盖 `Host` 头防 DNS rebinding，统一拒绝重定向；`https://` 因 TLS 证书绑定 hostname 保持域名请求，二次解析的残余 TOCTOU 风险已接受（见 `src/lib/tools/url-guard.ts`）
- **工具归属**：对话中自定义工具执行前校验 `tools.userId`，仅内置工具与当前用户拥有的工具可被调用
- **密钥泄露应急**：任何密钥（`JWT_SECRET`、`DEEPSEEK_API_KEY` 等）若曾进入代码/仓库，必须立即轮换；涉及 git 历史时用 `git filter-repo` 重写并 `force-push`

### 6. 云厂商锁定
- 数据库通过 Drizzle ORM + PostgreSQL，结构性依赖较低
- Hyperdrive 是 Cloudflare 专有服务，迁移到其他平台需绕过它直接连接数据库

---

## 数据库备份

知识库数据（文档 + 向量分块）存储在 PostgreSQL，生产必须启用自动备份：

- **Supabase**：项目自带每日自动备份 + 定时恢复点（PITR），在 Dashboard → Database → Backups 查看配置
- **自建 PostgreSQL**：使用项目自带脚本 `backend/scripts/backup.sh`（pg_dump，含 pgvector 数据）：

```bash
cd backend
DATABASE_URL="postgres://postgres:YOUR_PASSWORD@localhost:5432/agent_platform" ./scripts/backup.sh
# 可选: BACKUP_DIR=/data/backups 指定目录（默认 ./backups）
# 自动保留最近 7 天备份，建议配合 cron 每日执行，并同步到异地对象存储
```

### 恢复

```bash
# 从备份文件恢复到目标库（先确保目标库存在且启用 vector 扩展）
psql "$DATABASE_URL" -c "CREATE EXTENSION IF NOT EXISTS vector;"
psql "$DATABASE_URL" < backups/agent_platform_YYYYMMDD_HHMMSS.sql
```

> `pg_dump` 备份时使用了 `--no-owner --no-privileges`，恢复时属主/权限沿用目标库，避免跨库恢复报错。

## 回滚

```bash
# 后端（部署上一个版本）
npx wrangler rollback

# 前端 (Pages → Dashboard → 选择版本 → Rollback)
```
