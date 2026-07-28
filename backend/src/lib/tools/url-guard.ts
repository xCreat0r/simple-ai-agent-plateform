const INTERNAL_IPV4_PREFIXES = [
  "127.", "10.", "192.168.",
  "172.16.", "172.17.", "172.18.", "172.19.",
  "172.20.", "172.21.", "172.22.", "172.23.",
  "172.24.", "172.25.", "172.26.", "172.27.",
  "172.28.", "172.29.", "172.30.", "172.31.",
];

function isInternalIPv4(ip: string): boolean {
  if (ip === "0.0.0.0" || ip === "169.254.169.254") return true;
  return INTERNAL_IPV4_PREFIXES.some((p) => ip.startsWith(p));
}

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

  if (hostname === "localhost" || hostname === "::1" || hostname === "0.0.0.0") {
    throw new Error("不允许访问内网地址");
  }

  if (hostname.startsWith("[")) {
    throw new Error("不允许纯 IPv6 地址");
  }

  if (isInternalIPv4(hostname)) {
    throw new Error("不允许访问内网地址");
  }

  return url;
}
