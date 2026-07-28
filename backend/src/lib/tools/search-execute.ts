
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
    const url = `https://serpapi.com/search?q=${query}&engine=google`;

    const res = await fetch(url, {
      headers: { "x-api-key": apiKey },
    });
    const data: { organic_results?: Array<{ title: string; link: string; snippet: string }> } = await res.json();

    const results = data.organic_results || [];

    if (results.length === 0) {
      return "未找到搜索结果";
    }

    return results
      .slice(0, 5)
      .map((r) => `${r.title}\n  ${r.link}\n  ${r.snippet}`)
      .join("\n\n");
  },
};
