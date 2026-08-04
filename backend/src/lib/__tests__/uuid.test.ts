import { describe, it, expect } from "vitest";
import { generateId } from "@/lib/util/uuid";

describe("generateId", () => {
  it("返回合法 UUID v4 格式", () => {
    expect(generateId()).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    );
  });

  it("多次调用返回唯一 ID", () => {
    const ids = new Set(Array.from({ length: 100 }, () => generateId()));
    console.log(ids);
    expect(ids.size).toBe(100);
  });
});
