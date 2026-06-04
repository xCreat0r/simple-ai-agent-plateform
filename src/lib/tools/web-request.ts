export const webRequestToolDef = {
  id: "web_request" as const,
  name: "网络请求",
  description: "向指定 URL 发起 HTTP GET 请求并返回响应内容",
  parameters: {
    type: "object" as const,
    properties: {
      url: {
        type: "string" as const,
        description: "要请求的 URL",
      },
    },
    required: ["url"],
  },
};
