"""PDF 应用层加密解密：与 Worker 端 WebCrypto AES-256-GCM 约定一致。

传输格式: nonce(12) || ciphertext || tag(16)。
密钥 PDF_ENCRYPTION_KEY 为 base64 编码的 32 字节，两端配置同一把。
"""

import base64
import os

from cryptography.hazmat.primitives.ciphers.aead import AESGCM

NONCE_LENGTH = 12


def load_encryption_key() -> str | None:
    """读取 PDF_ENCRYPTION_KEY；未配置返回 None（明文模式，兼容/回滚）。"""
    return os.getenv("PDF_ENCRYPTION_KEY") or None


def decrypt_pdf(body: bytes, key_b64: str) -> bytes:
    """解密 Worker 加密的 PDF 字节；密钥非法或解密失败抛出异常。"""
    key = base64.b64decode(key_b64)
    if len(key) != 32:
        raise ValueError("PDF_ENCRYPTION_KEY 必须是 base64 编码的 32 字节密钥")

    nonce = body[:NONCE_LENGTH]
    ciphertext_tag = body[NONCE_LENGTH:]
    return AESGCM(key).decrypt(nonce, ciphertext_tag, None)
