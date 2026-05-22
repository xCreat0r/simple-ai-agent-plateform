import type { Tool } from "./types";

export const searchTool: Tool = {
  id: "web_search",
  name: "网页搜索",
  description: "使用 DuckDuckGo 搜索网页内容",
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
    const query = encodeURIComponent(args.query as string);
    const url = `https://html.duckduckgo.com/html/?q=${query}`;
    const res = await fetch(url);
    const html = await res.text();

    const results: string[] = [];
    const snippetRegex = /<a[^>]*class="result__a"[^>]*href="([^"]*)"[^>]*>([^<]*)<\/a>[\s\S]*?<a[^>]*class="result__snippet"[^>]*>([^<]+)/g;

    let match;
    let count = 0;
    while ((match = snippetRegex.exec(html)) !== null && count < 5) {
      const href = match[1];
      const title = match[2].replace(/<[^>]+>/g, "").trim();
      const snippet = match[3].replace(/<[^>]+>/g, "").trim();
      results.push(`${title}\n  ${href}\n  ${snippet}`);
      count++;
    }

    if (results.length === 0) {
      return "未找到搜索结果";
    }

    return results.join("\n\n");
  },
};
