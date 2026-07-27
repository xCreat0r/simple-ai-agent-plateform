import { describe, it, expect } from "vitest";
import { URL } from "url";
import { validateExternalUrl } from "@/lib/tools/url-guard";

describe("validateExternalUrl", () => {
  it("通过合法的外网 URL", () => {
    const url = validateExternalUrl("https://api.example.com/data");
    expect(url.hostname).toBe("api.example.com");
  });

  it("拒绝无效 URL 格式", () => {
    expect(() => validateExternalUrl("not-a-url")).toThrow("无效的 URL 格式");
  });

  it("拒绝 localhost", () => {
    expect(() => validateExternalUrl("http://localhost:3000/api")).toThrow(
      "不允许访问内网地址"
    );
  });

  it("拒绝 127.0.0.1", () => {
    expect(() => validateExternalUrl("http://127.0.0.1:8080")).toThrow(
      "不允许访问内网地址"
    );
  });

  it("拒绝 10.x 内网 IP", () => {
    expect(() => validateExternalUrl("http://10.0.0.1/api")).toThrow(
      "不允许访问内网地址"
    );
  });

  it("拒绝 192.168.x 内网 IP", () => {
    expect(() => validateExternalUrl("http://192.168.1.1/api")).toThrow(
      "不允许访问内网地址"
    );
  });

  it("拒绝 172.16.x 内网 IP", () => {
    expect(() => validateExternalUrl("http://172.16.0.1/api")).toThrow(
      "不允许访问内网地址"
    );
  });

  it("拒绝 AWS 元数据端点", () => {
    expect(() => validateExternalUrl("http://169.254.169.254/latest/meta-data")).toThrow(
      "不允许访问内网地址"
    );
  });

  it("拒绝非 http/https 协议", () => {
    expect(() => validateExternalUrl("ftp://files.example.com")).toThrow(
      "仅支持 http/https 协议"
    );
  });

  it("通过 HTTPS URL", () => {
    const url = validateExternalUrl("https://www.google.com");
    expect(url.protocol).toBe("https:");
  });
});
