import dns from "node:dns";

// SSRF 防护：仅允许 http/https，禁止访问内网/环回地址与云元数据服务。
// 对 hostname 做 DNS 解析（node:dns resolve4/resolve6，workerd 支持）后校验实际 IP，
// 可防 DNS rebinding；并拦截数字/进制编码的 IP 主机名。

const PRIVATE_172_PREFIXES = Array.from({ length: 16 }, (_, i) => `172.${16 + i}.`);

const INTERNAL_IPV4_PREFIXES = [
  "127.", "10.", "192.168.", "169.254.", "0.", ...PRIVATE_172_PREFIXES,
];

function isInternalIPv4(ip: string): boolean {
  if (ip === "0.0.0.0") return true;
  if (INTERNAL_IPV4_PREFIXES.some((p) => ip.startsWith(p))) return true;
  // 100.64.0.0/10 (CGNAT)
  const m = ip.match(/^100\.(\d{1,3})\./);
  if (m) {
    const seg = parseInt(m[1], 10);
    if (seg >= 64 && seg <= 127) return true;
  }
  return false;
}

function isInternalIPv6(ip: string): boolean {
  const lower = ip.toLowerCase();
  if (lower === "::1") return true;
  if (lower.startsWith("fe80")) return true; // link-local
  if (lower.startsWith("fc") || lower.startsWith("fd")) return true; // ULA
  // IPv4-mapped IPv6 ::ffff:a.b.c.d → 提取后段按 IPv4 判断
  const mapped = lower.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (mapped) return isInternalIPv4(mapped[1]);
  return false;
}

function isInternalIp(ip: string): boolean {
  return ip.includes(":") ? isInternalIPv6(ip) : isInternalIPv4(ip);
}

// 数字/进制编码的 IP 主机名（如 2130706433、0x7f000001、017700000001），
// 既非合法域名，又常被用于绕过字符串前缀校验
const ENCODED_IP_HOST = /^(0x[0-9a-fA-F]+|0o[0-7]+|0b[01]+|[0-9]+)$/;

// 解析 hostname 的全部 A/AAAA 记录；解析失败返回空数组
async function resolveHostIps(hostname: string): Promise<string[]> {
  const results: string[] = [];
  try {
    results.push(...(await dns.promises.resolve4(hostname)));
  } catch {}
  try {
    results.push(...(await dns.promises.resolve6(hostname)));
  } catch {}
  return results;
}

// 校验外部 URL 并返回解析出的 IP 列表，阻止 SSRF；
// 异步（涉及 DNS 解析）
export async function resolveExternalUrl(rawUrl: string): Promise<{ url: URL; ips: string[] }> {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new Error("无效的 URL 格式");
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("仅支持 http/https 协议");
  }

  // URL.hostname 对 IPv6 会带方括号，去掉后再判断
  const hostname = url.hostname.toLowerCase().replace(/^\[|\]$/g, "");

  if (!hostname || hostname === "localhost" || hostname === "0.0.0.0") {
    throw new Error("不允许访问内网地址");
  }

  if (ENCODED_IP_HOST.test(hostname)) {
    throw new Error("不允许访问内网地址");
  }

  // 解析 DNS 后校验实际 IP：任一解析结果落在内网/回环即拒绝；
  // 无法解析（域名不存在）同样拒绝，无法确认安全
  const ips = await resolveHostIps(hostname);
  if (ips.length === 0 || ips.some(isInternalIp)) {
    throw new Error("不允许访问内网地址");
  }

  return { url, ips };
}

// 仅校验，返回 URL（兼容既有调用方）
export async function validateExternalUrl(rawUrl: string): Promise<URL> {
  const { url } = await resolveExternalUrl(rawUrl);
  return url;
}

// 校验通过后发起请求（防 DNS rebinding TOCTOU）：
// - http：用解析校验过的 IP 直连并覆盖 Host 头，使 fetch 不再二次解析域名，
//   避免"校验时公网 IP、连接时内网 IP"的绕过
// - https：因 TLS 证书绑定 hostname，无法用 IP 直连，保持域名请求，
//   二次解析的残余风险已在文档中说明（可接受）
// 统一拒绝跟随重定向，防止校验后跳转到内网地址
export async function resolveAndFetch(rawUrl: string, init?: RequestInit): Promise<Response> {
  const { url, ips } = await resolveExternalUrl(rawUrl);

  if (url.protocol === "https:") {
    return fetch(url.toString(), { ...init, redirect: "error" });
  }

  const ip = ips[0];
  const ipPart = ip.includes(":") ? `[${ip}]` : ip;
  const headers = new Headers(init?.headers);
  headers.set("Host", url.host);
  return fetch(`http://${ipPart}${url.pathname}${url.search}`, {
    ...init,
    headers,
    redirect: "error",
  });
}
