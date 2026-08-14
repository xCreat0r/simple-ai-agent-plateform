import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// mock node:dns，避免测试依赖真实网络
vi.mock("node:dns", () => ({
  default: {
    promises: {
      resolve4: vi.fn(),
      resolve6: vi.fn(),
    },
  },
  promises: {
    resolve4: vi.fn(),
    resolve6: vi.fn(),
  },
}));

import dns from "node:dns";
import { validateExternalUrl, resolveAndFetch } from "@/lib/tools/url-guard";

const resolve4 = vi.mocked(dns.promises.resolve4);
const resolve6 = vi.mocked(dns.promises.resolve6);

function mockDns(ipv4: string[], ipv6: string[] = []): void {
  resolve4.mockResolvedValue(ipv4);
  resolve6.mockResolvedValue(ipv6);
}

describe("validateExternalUrl", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("通过合法的外网 URL", async () => {
    mockDns(["93.184.216.34"]);
    const url = await validateExternalUrl("https://api.example.com/data");
    expect(url.hostname).toBe("api.example.com");
  });

  it("拒绝无效 URL 格式", async () => {
    await expect(validateExternalUrl("not-a-url")).rejects.toThrow("无效的 URL 格式");
  });

  it("拒绝 localhost", async () => {
    mockDns(["127.0.0.1"]);
    await expect(validateExternalUrl("http://localhost:3000/api")).rejects.toThrow(
      "不允许访问内网地址"
    );
  });

  it("拒绝 127.0.0.1", async () => {
    mockDns(["127.0.0.1"]);
    await expect(validateExternalUrl("http://127.0.0.1:8080")).rejects.toThrow(
      "不允许访问内网地址"
    );
  });

  it("拒绝 10.x 内网 IP", async () => {
    mockDns(["10.0.0.1"]);
    await expect(validateExternalUrl("http://10.0.0.1/api")).rejects.toThrow(
      "不允许访问内网地址"
    );
  });

  it("拒绝 192.168.x 内网 IP", async () => {
    mockDns(["192.168.1.1"]);
    await expect(validateExternalUrl("http://192.168.1.1/api")).rejects.toThrow(
      "不允许访问内网地址"
    );
  });

  it("拒绝 172.16.x 内网 IP", async () => {
    mockDns(["172.16.0.1"]);
    await expect(validateExternalUrl("http://172.16.0.1/api")).rejects.toThrow(
      "不允许访问内网地址"
    );
  });

  it("拒绝 AWS 元数据端点", async () => {
    mockDns(["169.254.169.254"]);
    await expect(validateExternalUrl("http://169.254.169.254/latest/meta-data")).rejects.toThrow(
      "不允许访问内网地址"
    );
  });

  it("拒绝 DNS rebinding（域名解析到内网 IP）", async () => {
    mockDns(["127.0.0.1"]);
    await expect(validateExternalUrl("http://evil.example.com/path")).rejects.toThrow(
      "不允许访问内网地址"
    );
  });

  it("拒绝十进制编码 IP（2130706433 = 127.0.0.1）", async () => {
    await expect(validateExternalUrl("http://2130706433/")).rejects.toThrow(
      "不允许访问内网地址"
    );
  });

  it("拒绝十六进制编码 IP（0x7f000001 = 127.0.0.1）", async () => {
    await expect(validateExternalUrl("http://0x7f000001/")).rejects.toThrow(
      "不允许访问内网地址"
    );
  });

  it("拒绝无法解析的域名", async () => {
    mockDns([]);
    await expect(validateExternalUrl("http://no-such-host.invalid/")).rejects.toThrow(
      "不允许访问内网地址"
    );
  });

  it("拒绝 IPv4-mapped IPv6 内网", async () => {
    mockDns([], ["::ffff:127.0.0.1"]);
    await expect(validateExternalUrl("https://[::ffff:127.0.0.1]/")).rejects.toThrow(
      "不允许访问内网地址"
    );
  });

  it("拒绝非 http/https 协议", async () => {
    await expect(validateExternalUrl("ftp://files.example.com")).rejects.toThrow(
      "仅支持 http/https 协议"
    );
  });

  it("通过 HTTPS 公网 URL", async () => {
    mockDns(["142.250.72.14"]);
    const url = await validateExternalUrl("https://www.google.com");
    expect(url.protocol).toBe("https:");
  });
});

describe("resolveAndFetch", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("http 请求用解析后的 IP 直连并覆盖 Host 头（防 DNS rebinding）", async () => {
    mockDns(["93.184.216.34"]);
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValue(new Response("ok"));

    await resolveAndFetch("http://api.example.com/data");

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("http://93.184.216.34/data");
    const headers = new Headers(init?.headers);
    expect(headers.get("Host")).toBe("api.example.com");
    expect(init?.redirect).toBe("error");
  });

  it("https 请求保持域名（TLS 证书绑定 hostname）", async () => {
    mockDns(["142.250.72.14"]);
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValue(new Response("ok"));

    await resolveAndFetch("https://www.google.com/path");

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://www.google.com/path");
    expect(init?.redirect).toBe("error");
  });

  it("内网地址直接拒绝，不发起 fetch", async () => {
    mockDns(["127.0.0.1"]);
    const fetchMock = vi.mocked(fetch);

    await expect(resolveAndFetch("http://evil.example.com/")).rejects.toThrow(
      "不允许访问内网地址"
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
