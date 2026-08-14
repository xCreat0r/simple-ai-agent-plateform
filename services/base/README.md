# Base Service

> ⚠️ **已停用（保留参考/回退）**：自 2026-08 起 PDF 解析改为 Worker 内本地解析（`unpdf`，见 `backend/src/lib/ai/pdf.ts`），本服务不再部署/被调用。代码保留供参考与回退。

PDF 文本提取服务，为 Agent 平台知识库提供文档解析能力。

## 技术栈

- **uv** — Python 包管理与运行时
- **FastAPI + uvicorn** — Web 框架
- **PyMuPDF** — PDF 文字层提取（中文友好）

> 当前仅支持含文字层的 PDF（如从 Word/网页导出的）。扫描件/图片型 PDF 无法提取文字，返回 422。

## API

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/health` | 健康检查，返回 `{"status":"ok"}`（无需鉴权） |
| POST | `/doc-parser/parse` | 请求体为 PDF 原始字节，响应为纯文本（HMAC 签名鉴权） |

解析失败（非法 PDF / 扫描件）返回 422；请求体超 50MB 返回 413；鉴权失败返回 401，未配置密钥返回 503。

## 鉴权（HMAC 请求签名）

无 TLS 公网下不传输明文密钥。请求需带四头：

| 头 | 说明 |
|---|---|
| `X-Api-Key` | key 标识（明文，base 用它查对应 secret） |
| `X-Timestamp` | unix 秒，校验 `\|now - ts\| ≤ 300s` |
| `X-Nonce` | 随机串，去重防重放 |
| `X-Signature` | 小写 hex HMAC-SHA256 |

签名串：`{timestamp}\n{nonce}\n{sha256Hex(body)}\n{path}`，密钥 = 该 key 对应的 secret。
校验顺序：查 key → 时间戳窗口 → nonce 去重 → `hmac.compare_digest` 比对。

- 多 key 轮换：`BASE_SERVICE_KEYS="key1:secret1,key2:secret2"`，签名方单 key、验证方多 key，任何单个请求只带一组
- 未配置 `BASE_SERVICE_KEYS` 时 fail-closed（503）
- 测试：`uv run python -m unittest discover -s tests`

## 配置

复制 `.env.example` 为 `.env` 并填写 `BASE_SERVICE_KEYS`（key:secret 对，逗号分隔；至少一组，与后端 Worker 的 `BASE_SERVICE_KEY` / `BASE_SERVICE_SECRET` 对应）：

```bash
cd services/base
cp .env.example .env
# 编辑 .env，填入: BASE_SERVICE_KEYS=key1:<openssl rand -base64 32 生成的 secret>
```

`.env` 不入库。配置优先级：环境变量 > `.env` 文件。`BASE_SERVICE_KEYS` 在启动时解析，修改后需重启。

## 本地开发

```bash
cd services/base
uv sync            # 安装依赖并生成 .venv
uv run uvicorn app.main:app --port 38080
```

后端通过 `BASE_SERVICE_URL` 访问本服务（见 `backend/.dev.vars`），并配置相同的 `BASE_SERVICE_KEY` / `BASE_SERVICE_SECRET` 计算签名。

## 部署

见 `docker/` 目录。镜像通过 GitHub Actions（`.github/workflows/base-service.yml`）
构建并推送到阿里云 ACR。
