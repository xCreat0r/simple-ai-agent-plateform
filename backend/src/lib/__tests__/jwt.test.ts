import { describe, it, expect } from "vitest";
import { signAccessToken, verifyAccessToken } from "@/lib/jwt";

describe("jwt", () => {
  it("签名后可验证出正确 userId", async () => {
    const token = await signAccessToken("user-1");
    const payload = await verifyAccessToken(token);
    expect(payload.userId).toBe("user-1");
  });

  it("篡改后的 token 验证失败", async () => {
    const token = await signAccessToken("user-1");
    const tampered = token.slice(0, -4) + "abcd";
    await expect(verifyAccessToken(tampered)).rejects.toThrow();
  });
});
