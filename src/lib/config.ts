export const config = {
  chat: {
    maxContentLength: 4000,
    maxToolLoopSteps: 5,
    conversationHistoryLimit: 20,
  },

  rateLimit: {
    windowMs: 60_000,
    maxRequestsPerWindow: 30,
  },

  ai: {
    defaultModel: "deepseek-chat",
    defaultTemperature: 0.7,
    defaultMaxTokens: 4096,
    requestTimeoutMs: 30_000,
    maxRetries: 3,
    retryDelayMs: 1000,
  },

  knowledge: {
    maxFileSize: 10 * 1024 * 1024,
    chunkMaxChars: 800,
    chunkMinChars: 300,
    chunkOverlap: 100,
    topK: 3,
  },

  db: {
    poolMin: 2,
    poolMax: 10,
    idleTimeoutMs: 30_000,
  },

  quota: {
    freeDailyRequests: 200,
    freeKnowledgeStorageMB: 50,
    freeMaxAgents: 20,
    freeMaxTools: 10,
  },
} as const;
