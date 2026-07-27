import "server-only";
import { db } from "@/lib/db";
import { tools as toolsTable } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import type { Tool } from "./types";
import { toolParametersSchema } from "@/lib/validators";
import { validateExternalUrlWithDNS } from "./url-guard";
import { searchTool } from "./search-execute";
import { webRequestTool } from "./web-request-execute";

const BLOCKED_HEADERS = new Set([
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
  [searchTool.id]: searchTool,
  [webRequestTool.id]: webRequestTool,
};

export async function getTool(id: string): Promise<Tool | undefined> {
  const serverTool = serverTools[id];
  if (serverTool) return serverTool;

  const [dbTool] = await db
    .select()
    .from(toolsTable)
    .where(eq(toolsTable.id, id));

  if (!dbTool) return undefined;

  const params = toolParametersSchema.parse(dbTool.parameters);

  return {
    id: dbTool.id,
    name: dbTool.name,
    description: dbTool.description,
    parameters: params,
    async execute(args) {
      await validateExternalUrlWithDNS(dbTool.endpoint);
      const headers = sanitizeHeaders(dbTool.headers as Record<string, string> | undefined);
      const endpointUrl = new URL(dbTool.endpoint);
      if (dbTool.method === "GET") {
        const searchParams = new URLSearchParams(args as Record<string, string>);
        for (const [key, value] of searchParams) {
          endpointUrl.searchParams.set(key, value);
        }
      }

      const res = await fetch(endpointUrl.toString(), {
        method: dbTool.method,
        headers: {
          "Content-Type": "application/json",
          ...headers,
        },
        body: dbTool.method === "POST" ? JSON.stringify(args) : undefined,
        redirect: "error",
      });
      const text = await res.text();
      return `状态码: ${res.status}\n${text.slice(0, 2000)}`;
    },
  };
}

export async function getToolDefinitions(toolIds: string[]) {
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

    const [dbTool] = await db
      .select()
      .from(toolsTable)
      .where(eq(toolsTable.id, id));

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
