"""check_signature 纯函数回归测试（标准库 unittest，零依赖）。

运行：cd services/base && uv run python -m unittest discover -s tests
"""

import hashlib
import hmac
import time
import unittest

from app.main import NONCE_TTL_SECONDS, TIMESTAMP_WINDOW_SECONDS, check_signature


def sign(secret: str, ts: str, nonce: str, body: bytes, path: str) -> str:
    body_hash = hashlib.sha256(body).hexdigest()
    string_to_sign = f"{ts}\n{nonce}\n{body_hash}\n{path}"
    return hmac.new(secret.encode(), string_to_sign.encode(), hashlib.sha256).hexdigest()


class CheckSignatureTest(unittest.TestCase):
    def setUp(self):
        self.credentials = {"key1": "secret-one", "key2": "secret-two"}
        self.now = int(time.time())
        self.body = b"%PDF-1.4 fake"
        self.path = "/doc-parser/parse"

    def _valid(self, key="key1", body=None, ts=None, nonce="n1", path=None, sig=None):
        body = self.body if body is None else body
        ts = str(self.now) if ts is None else ts
        path = self.path if path is None else path
        if sig is None:
            # 默认按"原始值"签名（密钥 secret-one），构造合法签名；覆盖参数用于模拟篡改
            sig = sign("secret-one", str(self.now), nonce, self.body, self.path)
        return check_signature(self.credentials, {}, key, ts, nonce, sig, body, path, self.now)

    def test_valid(self):
        self.assertIsNone(self._valid())

    def test_multi_key_rotation(self):
        # 新旧 key 均可验证：key1 用 secret-one，key2 用 secret-two
        self.assertIsNone(self._valid(key="key1"))
        sig2 = sign("secret-two", str(self.now), "n2", self.body, self.path)
        self.assertIsNone(self._valid(key="key2", nonce="n2", sig=sig2))

    def test_wrong_secret_key(self):
        self.assertEqual(self._valid(key="ghost"), "鉴权失败")

    def test_missing_headers(self):
        self.assertEqual(self._valid(key=""), "鉴权失败")

    def test_invalid_timestamp(self):
        self.assertEqual(self._valid(ts="not-a-number"), "鉴权失败")

    def test_expired_timestamp(self):
        self.assertEqual(self._valid(ts=str(self.now - TIMESTAMP_WINDOW_SECONDS - 1)), "鉴权失败")

    def test_tampered_body(self):
        self.assertEqual(self._valid(body=b"tampered"), "鉴权失败")

    def test_wrong_path(self):
        self.assertEqual(self._valid(path="/other"), "鉴权失败")

    def test_nonce_replay(self):
        seen: dict = {}
        sig = sign("secret-one", str(self.now), "n1", self.body, self.path)
        self.assertIsNone(
            check_signature(self.credentials, seen, "key1", str(self.now), "n1", sig, self.body, self.path, self.now)
        )
        self.assertEqual(
            check_signature(self.credentials, seen, "key1", str(self.now), "n1", sig, self.body, self.path, self.now),
            "鉴权失败",
        )

    def test_no_credentials(self):
        ts = str(self.now)
        sig = sign("secret-one", ts, "n1", self.body, self.path)
        self.assertEqual(
            check_signature({}, {}, "key1", ts, "n1", sig, self.body, self.path, self.now),
            "服务未配置鉴权",
        )

    def test_nonce_cleanup(self):
        seen = {("key1", "old"): self.now - NONCE_TTL_SECONDS - 1}
        ts = str(self.now)
        sig = sign("secret-one", ts, "n1", self.body, self.path)
        self.assertIsNone(
            check_signature(self.credentials, seen, "key1", ts, "n1", sig, self.body, self.path, self.now)
        )
        self.assertNotIn(("key1", "old"), seen)


if __name__ == "__main__":
    unittest.main()
