function numEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw === undefined || raw.trim() === "") return fallback;
  const n = Number(raw);
  return Number.isFinite(n) ? n : fallback;
}

export function boolEnv(name: string, fallback: boolean): boolean {
  const raw = process.env[name];
  if (raw === undefined || raw.trim() === "") return fallback;
  return raw.trim().toLowerCase() === "true";
}

export const config = {
  chat: {
    maxContentLength: numEnv("CHAT_MAX_CONTENT_LENGTH", 4000),
    maxToolLoopSteps: numEnv("CHAT_MAX_TOOL_LOOP_STEPS", 5),
    conversationHistoryLimit: numEnv("CHAT_CONVERSATION_HISTORY_LIMIT", 20),
  },

  rateLimit: {
    windowMs: numEnv("RATE_LIMIT_WINDOW_MS", 60_000),
    maxRequestsPerWindow: numEnv("RATE_LIMIT_MAX_REQUESTS_PER_WINDOW", 30),
  },

  auth: {
    // 是否开放注册：默认关闭，仅当显式配置 ALLOW_SIGNUP=true 时开放。
    // 关闭时需通过 seed 脚本或 SQL 创建账号
    allowSignup: boolEnv("ALLOW_SIGNUP", false),
    minPasswordLength: numEnv("AUTH_MIN_PASSWORD_LENGTH", 8),
  },

  ai: {
    defaultModel: "deepseek-v4-flash",
    defaultTemperature: 0.7,
    defaultMaxTokens: numEnv("AI_DEFAULT_MAX_TOKENS", 4096),
    requestTimeoutMs: numEnv("AI_REQUEST_TIMEOUT_MS", 30_000),
    maxRetries: numEnv("AI_MAX_RETRIES", 3),
    retryDelayMs: numEnv("AI_RETRY_DELAY_MS", 1000),
  },

  knowledge: {
    maxFileSize: numEnv("KNOWLEDGE_MAX_FILE_SIZE", 5 * 1024 * 1024),
    maxPdfPages: numEnv("KNOWLEDGE_MAX_PDF_PAGES", 100),
    chunkMaxChars: numEnv("KNOWLEDGE_CHUNK_MAX_CHARS", 800),
    chunkMinChars: numEnv("KNOWLEDGE_CHUNK_MIN_CHARS", 300),
    chunkOverlap: numEnv("KNOWLEDGE_CHUNK_OVERLAP", 100),
    topK: numEnv("KNOWLEDGE_TOP_K", 3),
    similarityThreshold: numEnv("KNOWLEDGE_SIMILARITY_THRESHOLD", 0.6),
    embeddingBatchSize: numEnv("KNOWLEDGE_EMBEDDING_BATCH_SIZE", 8),
  },

  db: {
    poolMin: numEnv("DB_POOL_MIN", 2),
    poolMax: numEnv("DB_POOL_MAX", 10),
    idleTimeoutMs: numEnv("DB_IDLE_TIMEOUT_MS", 30_000),
  },

  quota: {
    freeDailyRequests: numEnv("QUOTA_FREE_DAILY_REQUESTS", 200),
    freeKnowledgeStorageMB: numEnv("QUOTA_FREE_KNOWLEDGE_STORAGE_MB", 50),
    freeMaxAgents: numEnv("QUOTA_FREE_MAX_AGENTS", 20),
    freeMaxTools: numEnv("QUOTA_FREE_MAX_TOOLS", 10),
  },
};
