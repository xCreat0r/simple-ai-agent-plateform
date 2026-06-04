import type { Tool } from "./types";

export const searchTool: Tool = {
  id: "web_search",
  name: "网页搜索",
  description: "使用 SerpAPI 搜索网页内容，返回标题、链接和摘要",
  parameters: {
    type: "object",
    properties: {
      query: {
        type: "string",
        description: "搜索关键词",
      },
    },
    required: ["query"],
  },
  async execute(args) {
    const apiKey = process.env.SERPAPI_API_KEY;
    if (!apiKey) {
      return "搜索不可用：未配置 SERPAPI_API_KEY";
    }

    const query = encodeURIComponent(args.query as string);
    const url = `https://serpapi.com/search?q=${query}&api_key=${apiKey}&engine=google`;

    const proxy = process.env.SERPAPI_PROXY;
    const fetchOptions: Record<string, unknown> = {};
    if (proxy) {
      // @ts-ignore undici is a Node.js built-in, no @types needed
      const { ProxyAgent } = await import("undici");
      fetchOptions.dispatcher = new ProxyAgent(proxy);
    }

    const res = await fetch(url, fetchOptions);
    const data = await res.json();

    const results = (data.organic_results as Array<{
      title: string;
      link: string;
      snippet: string;
    }>) || [];

    if (results.length === 0) {
      return "未找到搜索结果";
    }

    return results
      .slice(0, 5)
      .map((r) => `${r.title}\n  ${r.link}\n  ${r.snippet}`)
      .join("\n\n");
  },
};
