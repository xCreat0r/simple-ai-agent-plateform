export const searchToolDef = {
  id: "web_search" as const,
  name: "网页搜索",
  description: "使用 SerpAPI 搜索网页内容，返回标题、链接和摘要",
  parameters: {
    type: "object" as const,
    properties: {
      query: {
        type: "string" as const,
        description: "搜索关键词",
      },
    },
    required: ["query"],
  },
};
