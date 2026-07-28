let _env: CloudflareEnv = {} as CloudflareEnv;

export function setEnv(env: CloudflareEnv) {
  _env = env;
}

export function getCloudflareContext(): { env: CloudflareEnv } {
  return { env: _env };
}

export function getHyperdriveConnectionString() {
  return _env.HYPERDRIVE?.connectionString || process.env.DATABASE_URL;
}
