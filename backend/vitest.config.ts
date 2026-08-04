import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    // 部分模块在加载时读取环境变量（如 jwt.ts 的 JWT_SECRET），
    // 统一在测试环境预设默认值，避免测试报错
    env: {
      JWT_SECRET: "test-secret",
      EMBEDDING_PROVIDER: "mock",
      DEEPSEEK_API_KEY: "test-key",
    },
  },
});
