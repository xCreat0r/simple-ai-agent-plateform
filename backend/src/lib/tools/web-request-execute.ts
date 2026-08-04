
import type { Tool } from "./types";
import { webRequestToolDef } from "./web-request";
import { validateExternalUrl } from "./url-guard";

export const webRequestTool: Tool = {
  ...webRequestToolDef,
  async execute(args) {
    const url = args.url as string;
    // 内置网页请求同样做 SSRF 防护校验
    validateExternalUrl(url);
    // 拒绝重定向，防止校验后跳转到内网地址
    const res = await fetch(url, { redirect: "error" });
    const text = await res.text();
    return `状态码: ${res.status}\n${text.slice(0, 2000)}`;
  },
};
