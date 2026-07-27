import "server-only";
import { lookup } from "dns/promises";

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

const INTERNAL_IPV4_PREFIXES = [
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

function isInternalHostname(hostname: string): boolean {
  if (INTERNAL_HOSTS.has(hostname)) return true;
  if (INTERNAL_RANGES.some((p) => hostname.startsWith(p))) return true;
  return false;
}

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

  if (hostname.startsWith("[")) {
    throw new Error("不允许纯 IPv6 地址");
  }

  if (isInternalHostname(hostname)) {
    throw new Error("不允许访问内网地址");
  }

  return url;
}

export async function validateExternalUrlWithDNS(rawUrl: string): Promise<URL> {
  const url = validateExternalUrl(rawUrl);
  const hostname = url.hostname.toLowerCase();

  try {
    const addresses = await lookup(hostname, { all: true });
    for (const addr of addresses) {
      if (isInternalIPv4(addr.address) || addr.address === "::1") {
        throw new Error("DNS 解析到内网地址，已拦截");
      }
      if (addr.address.startsWith("fe80:")) {
        throw new Error("DNS 解析到本地链路地址，已拦截");
      }
    }
  } catch (e) {
    if (e instanceof Error && e.message.includes("已拦截")) throw e;
  }

  return url;
}
