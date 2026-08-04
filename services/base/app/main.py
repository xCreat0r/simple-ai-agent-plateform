"""PDF 解析服务入口：FastAPI 提供健康检查与 PDF 文本提取接口。

契约（与旧 Go 服务保持一致）：
- GET  /health              返回 {"status": "ok"}
- POST /doc-parser/parse    请求体为 PDF 原始字节，响应为纯文本
"""

import logging

from fastapi import FastAPI, Request
from fastapi.responses import PlainTextResponse

from .pdf_parser import extract_pdf

logger = logging.getLogger(__name__)

app = FastAPI(title="Base Service", docs_url=None, redoc_url=None)

MAX_BODY_SIZE = 50 * 1024 * 1024  # 50MB，与旧服务一致


@app.get("/health")
async def health():
    return {"status": "ok"}


@app.post("/doc-parser/parse")
async def parse(request: Request):
    body = await request.body()

    if len(body) > MAX_BODY_SIZE:
        return PlainTextResponse("文件过大", status_code=413)

    if not body:
        return PlainTextResponse("空请求体", status_code=400)

    try:
        text = extract_pdf(body)
    except Exception as exc:  # noqa: BLE001 - 统一转 422，避免泄漏内部细节
        logger.exception("PDF 解析失败")
        return PlainTextResponse(f"PDF 解析失败: {exc}", status_code=422)

    if not text.strip():
        return PlainTextResponse(
            "PDF 解析失败: 未提取到可读文本（可能是扫描件，当前不支持 OCR）",
            status_code=422,
        )

    return PlainTextResponse(text)
