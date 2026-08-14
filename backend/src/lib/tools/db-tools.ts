import { getDb } from "@/lib/db";
import { tools as toolsTable } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import type { Tool } from "./types";
import { toolParametersSchema } from "@/lib/validators";
import { resolveAndFetch } from "./url-guard";
import { searchTool } from "./search-execute";
import { webRequestTool } from "./web-request-execute";

const BLOCKED_HEADERS = new Set([
  // 禁止自定义工具伪造代理相关请求头，防止 SSRF/权限绕过
  "host",
  "content-length",
  "transfer-encoding",
  "connection",
  "x-forwarded-for",
  "x-forwarded-host",
  "x-forwarded-proto",
  "x-real-ip",
  "cf-connecting-ip",
  "true-client-ip",
]);

// 过滤用户自定义工具 header 中的受限请求头
function sanitizeHeaders(headers: Record<string, string> | undefined): Record<string, string> {
  if (!headers) return {};
  const safe: Record<string, string> = {};
  for (const [key, value] of Object.entries(headers)) {
    if (!BLOCKED_HEADERS.has(key.toLowerCase())) {
      safe[key] = value;
    }
  }
  return safe;
}

const serverTools: Record<string, Tool> = {
  // 内置工具（搜索、网页请求）优先于数据库自定义工具
  [searchTool.id]: searchTool,
  [webRequestTool.id]: webRequestTool,
};

export async function getTool(id: string, userId?: string): Promise<Tool | undefined> {
  const serverTool = serverTools[id];
  if (serverTool) return serverTool;

  // 自定义工具必须属于传入的 userId；未带 userId 视为无权，
  // 纵深防御：防止越权调用他人工具（即使工具 id 被提示注入或脏数据带入）
  if (!userId) return undefined;
  const [dbTool] = await getDb()
    .select()
    .from(toolsTable)
    .where(and(eq(toolsTable.id, id), eq(toolsTable.userId, userId)));

  if (!dbTool) return undefined;

  const params = toolParametersSchema.parse(dbTool.parameters);

  // 自定义工具：执行时先做 URL 校验（防 SSRF），再按 GET/POST 组装请求
  return {
    id: dbTool.id,
    name: dbTool.name,
    description: dbTool.description,
    parameters: params,
    async execute(args) {
      // 自定义工具：执行时先做 URL 校验（防 SSRF），并锁定连接地址防 DNS rebinding
      const parsedHeaders = typeof dbTool.headers === "string" ? JSON.parse(dbTool.headers) : dbTool.headers;
      const headers = sanitizeHeaders(parsedHeaders as Record<string, string> | undefined);
      const endpointUrl = new URL(dbTool.endpoint);
      if (dbTool.method === "GET") {
        // GET 请求将工具参数拼接到 query string
        const searchParams = new URLSearchParams(args as Record<string, string>);
        for (const [key, value] of searchParams) {
          endpointUrl.searchParams.set(key, value);
        }
      }

      const res = await resolveAndFetch(endpointUrl.toString(), {
        method: dbTool.method,
        headers: {
          "Content-Type": "application/json",
          ...headers,
        },
        body: dbTool.method === "POST" ? JSON.stringify(args) : undefined,
        signal: AbortSignal.timeout(10_000), // 请求超时，避免挂起
      });
      const text = await res.text();
      return `状态码: ${res.status}\n${text.slice(0, 2000)}`;
    },
  };
}

export async function getToolDefinitions(toolIds: string[], userId?: string) {
  const defs: Array<{
    id: string;
    name: string;
    description: string;
    parameters: unknown;
  }> = [];

  for (const id of toolIds) {
    const serverTool = serverTools[id];
    if (serverTool) {
      defs.push({
        id: serverTool.id,
        name: serverTool.name,
        description: serverTool.description,
        parameters: serverTool.parameters,
      });
      continue;
    }

    // 自定义工具同样校验归属，未带 userId 时视为无权
    if (!userId) continue;
    const [dbTool] = await getDb()
      .select()
      .from(toolsTable)
      .where(and(eq(toolsTable.id, id), eq(toolsTable.userId, userId)));

    if (dbTool) {
      defs.push({
        id: dbTool.id,
        name: dbTool.name,
        description: dbTool.description,
        parameters: dbTool.parameters,
      });
    }
  }

  return defs;
}
