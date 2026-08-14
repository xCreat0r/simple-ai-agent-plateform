
import type { Tool } from "./types";
import { webRequestToolDef } from "./web-request";
import { resolveAndFetch } from "./url-guard";

export const webRequestTool: Tool = {
  ...webRequestToolDef,
  async execute(args) {
    const url = args.url as string;
    // 内置网页请求同样做 SSRF 防护（DNS 解析后校验实际 IP，并锁定连接地址防 rebinding）
    const res = await resolveAndFetch(url, { signal: AbortSignal.timeout(10_000) });
    const text = await res.text();
    return `状态码: ${res.status}\n${text.slice(0, 2000)}`;
  },
};
