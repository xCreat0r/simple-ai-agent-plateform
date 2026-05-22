import type { Tool } from "./types";

export const webRequestTool: Tool = {
  id: "web_request",
  name: "网络请求",
  description: "向指定 URL 发起 HTTP GET 请求并返回响应内容",
  parameters: {
    type: "object",
    properties: {
      url: {
        type: "string",
        description: "要请求的 URL",
      },
    },
    required: ["url"],
  },
  async execute(args) {
    const url = args.url as string;
    const res = await fetch(url);
    const text = await res.text();
    return `状态码: ${res.status}\n${text.slice(0, 2000)}`;
  },
};
