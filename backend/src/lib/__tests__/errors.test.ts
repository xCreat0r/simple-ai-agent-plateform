import { describe, it, expect } from "vitest";
import { badRequest, unauthorized, notFound, tooManyRequests, internalError } from "@/lib/errors";

describe("errors", () => {
  it("badRequest 返回 400", async () => {
    const res = badRequest("请求参数错误");
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("请求参数错误");
  });

  it("unauthorized 返回 401", async () => {
    const res = unauthorized();
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe("未登录");
  });

  it("notFound 返回 404", async () => {
    const res = notFound("Agent not found");
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toBe("Agent not found");
  });

  it("tooManyRequests 返回 429", async () => {
    const res = tooManyRequests("请求过于频繁");
    expect(res.status).toBe(429);
    const body = await res.json();
    expect(body.error).toBe("请求过于频繁");
  });

  it("internalError 返回 500", async () => {
    const res = internalError("服务器内部错误");
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBe("服务器内部错误");
  });
});
