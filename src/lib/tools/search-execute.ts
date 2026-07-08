import "server-only";

import type { Tool } from "./types";
import { searchToolDef } from "./search";

export const searchTool: Tool = {
  ...searchToolDef,
  async execute(args) {
    const apiKey = process.env.SERPAPI_API_KEY;
    if (!apiKey) {
      return "搜索不可用：未配置 SERPAPI_API_KEY";
    }

    const query = encodeURIComponent(args.query as string);
    const url = `https://serpapi.com/search?q=${query}&api_key=${apiKey}&engine=google`;

    const proxy = process.env.SERPAPI_PROXY;
    const res = proxy ? await fetchWithProxy(url, proxy) : await fetch(url);
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

async function fetchWithProxy(url: string, proxyUrl: string): Promise<Response> {
  const { ProxyAgent } = await import("undici");
  const agent = new ProxyAgent(proxyUrl);
  try {
    return await fetch(url, { dispatcher: agent } as never);
  } finally {
    agent.close();
  }
}
