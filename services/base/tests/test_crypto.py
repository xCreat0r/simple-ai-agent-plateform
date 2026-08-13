"""PDF 应用层解密测试（与 Worker 端 WebCrypto AES-GCM 约定一致）。

golden vector 与 backend/src/lib/__tests__/encrypt.test.ts 一致：
key = 32 字节 0xAB（base64）、nonce = 12 字节 0x07、明文 "hello pdf"。
运行：cd services/base && uv run python -m unittest discover -s tests
"""

import unittest

from app.crypto import decrypt_pdf, load_encryption_key

KEY_B64 = "q6urq6urq6urq6urq6urq6urq6urq6urq6urq6urq6s="  # 32 字节 0xAB
GOLDEN_HEX = "070707070707070707070707c5c1b118636791912cc4b66d6610c2c7f80558ee18ca002f3c"


class DecryptPdfTest(unittest.TestCase):
    def test_golden_vector_matches_worker(self):
        """用 Worker 端加密的 golden vector 解密，证明跨语言格式兼容。"""
        body = bytes.fromhex(GOLDEN_HEX)
        self.assertEqual(decrypt_pdf(body, KEY_B64), b"hello pdf")

    def test_wrong_key_fails(self):
        body = bytes.fromhex(GOLDEN_HEX)
        # 32 字节全 0x00 的 base64，与正确密钥不同
        with self.assertRaises(Exception):
            decrypt_pdf(body, "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=")

    def test_invalid_key_length(self):
        import base64
        with self.assertRaises(ValueError):
            decrypt_pdf(b"x" * 40, base64.b64encode(b"short").decode())

    def test_tampered_body_fails(self):
        body = bytes.fromhex(GOLDEN_HEX)
        tampered = bytes([body[0] ^ 0xFF]) + body[1:]
        with self.assertRaises(Exception):
            decrypt_pdf(tampered, KEY_B64)

    def test_load_key_returns_none_when_unset(self):
        self.assertIsNone(load_encryption_key())


if __name__ == "__main__":
    unittest.main()
