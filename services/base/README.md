# Base Service

PDF 文本提取服务，为 Agent 平台知识库提供文档解析能力。

## 技术栈

- **uv** — Python 包管理与运行时
- **FastAPI + uvicorn** — Web 框架
- **PyMuPDF** — PDF 文字层提取（中文友好）

> 当前仅支持含文字层的 PDF（如从 Word/网页导出的）。扫描件/图片型 PDF 无法提取文字，返回 422。

## API

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/health` | 健康检查，返回 `{"status":"ok"}` |
| POST | `/doc-parser/parse` | 请求体为 PDF 原始字节，响应为纯文本 |

解析失败（非法 PDF / 扫描件）返回 422；请求体超 50MB 返回 413。

## 本地开发

```bash
cd services/base
uv sync            # 安装依赖并生成 .venv
uv run uvicorn app.main:app --port 38080
```

后端通过 `BASE_SERVICE_URL` 访问本服务（见 `backend/.dev.vars`）。

## 部署

见 `docker/` 目录。镜像通过 GitHub Actions（`.github/workflows/base-service.yml`）
构建并推送到阿里云 ACR。
