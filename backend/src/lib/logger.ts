const isProd = process.env.NODE_ENV === "production";

export const logger = {
  info: (msg: unknown, ...args: unknown[]) => {
    if (!isProd) console.log(msg, ...args);
  },
  warn: (msg: unknown, ...args: unknown[]) => {
    console.warn(msg, ...args);
  },
  error: (msg: unknown, ...args: unknown[]) => {
    console.error(msg, ...args);
  },
  // 结构化事件日志：生产环境也输出，供 wrangler tail / Logpush 观测。
  // 只记录元数据，绝不包含文件内容、密钥等敏感信息。
  metric: (event: string, fields: Record<string, unknown>) => {
    console.log(JSON.stringify({ ts: new Date().toISOString(), event, ...fields }));
  },
};
