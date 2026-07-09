const INTERNAL_HOSTS = new Set([
  "localhost",
  "::1",
  "0.0.0.0",
  "169.254.169.254",
  "metadata.google.internal",
]);

const INTERNAL_RANGES = [
  "127.",
  "10.",
  "192.168.",
  "172.16.",
  "172.17.",
  "172.18.",
  "172.19.",
  "172.20.",
  "172.21.",
  "172.22.",
  "172.23.",
  "172.24.",
  "172.25.",
  "172.26.",
  "172.27.",
  "172.28.",
  "172.29.",
  "172.30.",
  "172.31.",
];

export function validateExternalUrl(rawUrl: string): URL {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new Error("无效的 URL 格式");
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("仅支持 http/https 协议");
  }

  const hostname = url.hostname.toLowerCase();

  if (INTERNAL_HOSTS.has(hostname)) {
    throw new Error("不允许访问内网地址");
  }

  if (INTERNAL_RANGES.some((p) => hostname.startsWith(p))) {
    throw new Error("不允许访问内网地址");
  }

  return url;
}
