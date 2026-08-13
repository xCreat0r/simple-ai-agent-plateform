"""PDF 解析服务入口：FastAPI 提供健康检查与 PDF 文本提取接口。

契约（与旧 Go 服务保持一致）：
- GET  /health              返回 {"status": "ok"}
- POST /doc-parser/parse    请求体为 PDF 原始字节，响应为纯文本

鉴权：HMAC-SHA256 请求签名（无 TLS 公网下不传输明文密钥）。
- 请求头：X-Api-Key（key 标识，明文）/ X-Timestamp（unix 秒）/ X-Nonce（随机串）/ X-Signature
- 签名串：{timestamp}\\n{nonce}\\n{sha256Hex(body)}\\n{path}，密钥 = 该 key 对应的 secret
- 校验：时间戳窗口 ±300s + nonce 去重（防重放）+ hmac.compare_digest
- 多 key 轮换：BASE_SERVICE_KEYS="key1:secret1,key2:secret2"
- 未配置 BASE_SERVICE_KEYS 时 fail-closed（返回 503）
"""

import hashlib
import hmac
import logging
import os
import time
from pathlib import Path

from fastapi import Depends, FastAPI, HTTPException, Request
from fastapi.responses import PlainTextResponse

from .pdf_parser import extract_pdf
from .crypto import load_encryption_key, decrypt_pdf

logger = logging.getLogger(__name__)

app = FastAPI(title="Base Service", docs_url=None, redoc_url=None)

MAX_BODY_SIZE = 50 * 1024 * 1024  # 50MB，与旧服务一致

TIMESTAMP_WINDOW_SECONDS = 300
NONCE_TTL_SECONDS = 600


def _load_env_file() -> None:
    """加载服务根目录 .env（KEY=VALUE，忽略注释/空行）；已存在的环境变量优先。

    本地 uv run 会自动加载 .env；Docker 内通过挂载 .env 到 /app/.env 生效。
    """
    env_path = Path(__file__).resolve().parent.parent / ".env"
    if not env_path.exists():
        return
    for raw in env_path.read_text().splitlines():
        line = raw.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, value = line.partition("=")
        key = key.strip()
        value = value.strip().strip("'\"")
        if key and key not in os.environ:
            os.environ[key] = value


def parse_credentials(raw: str) -> dict[str, str]:
    """解析 BASE_SERVICE_KEYS（逗号分隔的 key:secret 对），非法条目忽略。"""
    credentials: dict[str, str] = {}
    for pair in raw.split(","):
        pair = pair.strip()
        if not pair or ":" not in pair:
            continue
        key, _, secret = pair.partition(":")
        key = key.strip()
        secret = secret.strip()
        if key and secret:
            credentials[key] = secret
    return credentials


_load_env_file()

CREDENTIALS = parse_credentials(os.getenv("BASE_SERVICE_KEYS", ""))

# nonce 去重：{(key, nonce): timestamp}，单实例内存存储（uvicorn 默认单 worker）。
_seen_nonces: dict[tuple[str, str], int] = {}


def _cleanup_nonces(seen: dict[tuple[str, str], int], now: int) -> None:
    expired = [k for k, ts in seen.items() if now - ts > NONCE_TTL_SECONDS]
    for k in expired:
        del seen[k]


def check_signature(
    credentials: dict[str, str],
    seen_nonces: dict[tuple[str, str], int],
    key: str,
    timestamp: str,
    nonce: str,
    signature: str,
    body: bytes,
    path: str,
    now: int,
) -> str | None:
    """HMAC 校验核心逻辑（纯函数，便于测试）。

    通过返回 None，失败返回可读错误信息。
    """
    if not credentials:
        return "服务未配置鉴权"
    if not (key and timestamp and nonce and signature):
        return "鉴权失败"

    secret = credentials.get(key)
    if not secret:
        return "鉴权失败"

    try:
        ts = int(timestamp)
    except ValueError:
        return "鉴权失败"
    if abs(now - ts) > TIMESTAMP_WINDOW_SECONDS:
        return "鉴权失败"

    _cleanup_nonces(seen_nonces, now)
    nonce_key = (key, nonce)
    if nonce_key in seen_nonces:
        return "鉴权失败"
    seen_nonces[nonce_key] = now

    body_hash = hashlib.sha256(body).hexdigest()
    string_to_sign = f"{ts}\n{nonce}\n{body_hash}\n{path}"
    expected = hmac.new(secret.encode(), string_to_sign.encode(), hashlib.sha256).hexdigest()
    if not hmac.compare_digest(expected, signature):
        return "鉴权失败"

    return None


async def verify_signature(request: Request):
    """FastAPI 依赖：读 body 挂 request.state，并调用 check_signature 校验签名。"""
    body = await request.body()
    request.state.body = body

    error = check_signature(
        CREDENTIALS,
        _seen_nonces,
        request.headers.get("X-Api-Key", ""),
        request.headers.get("X-Timestamp", ""),
        request.headers.get("X-Nonce", ""),
        request.headers.get("X-Signature", ""),
        body,
        request.url.path,
        int(time.time()),
    )
    if error:
        status = 503 if error == "服务未配置鉴权" else 401
        raise HTTPException(status_code=status, detail=error)
    return None


@app.get("/health")
async def health():
    return {"status": "ok"}


@app.post("/doc-parser/parse")
async def parse(request: Request, _auth: None = Depends(verify_signature)):
    body = request.state.body

    if len(body) > MAX_BODY_SIZE:
        return PlainTextResponse("文件过大", status_code=413)

    if not body:
        return PlainTextResponse("空请求体", status_code=400)

    # 应用层解密：配置 PDF_ENCRYPTION_KEY 时按密文解密，否则按明文（兼容/回滚）
    encryption_key = load_encryption_key()
    if encryption_key:
        try:
            body = decrypt_pdf(body, encryption_key)
        except Exception as exc:  # noqa: BLE001 - 统一转 422，避免泄漏内部细节
            logger.exception("PDF 解密失败")
            return PlainTextResponse(f"PDF 解密失败: {exc}", status_code=422)

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
