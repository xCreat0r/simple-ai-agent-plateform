const REQUIRED_ENV_VARS = [
  "DATABASE_URL",
  "DEEPSEEK_API_KEY",
  "BETTER_AUTH_SECRET",
  "BETTER_AUTH_URL",
] as const;

const OPTIONAL_ENV_VARS = [
  "DEEPSEEK_BASE_URL",
  "SERPAPI_API_KEY",
  "SERPAPI_PROXY",
  "BAILIAN_API_KEY",
] as const;

const missing: string[] = [];

for (const key of REQUIRED_ENV_VARS) {
  if (!process.env[key]) {
    missing.push(key);
  }
}

if (missing.length > 0) {
  throw new Error(
    `缺少必需环境变量: ${missing.join(", ")}。请检查 .env.local 文件。`
  );
}

export function getEnv(key: (typeof REQUIRED_ENV_VARS)[number]): string {
  return process.env[key]!;
}

export function getOptionalEnv(key: (typeof OPTIONAL_ENV_VARS)[number]): string | undefined {
  return process.env[key];
}
