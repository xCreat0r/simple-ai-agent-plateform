import "server-only";
import { db } from "@/lib/db";
import { tools as toolsTable } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import type { Tool } from "./types";
import { getBuiltinTool } from "./index";

export async function getTool(id: string): Promise<Tool | undefined> {
  const builtin = getBuiltinTool(id);
  if (builtin) return builtin;

  const [dbTool] = await db
    .select()
    .from(toolsTable)
    .where(eq(toolsTable.id, id));

  if (!dbTool) return undefined;

  const params = dbTool.parameters as {
    type: "object";
    properties: Record<string, { type: string; description: string }>;
    required: string[];
  };

  return {
    id: dbTool.id,
    name: dbTool.name,
    description: dbTool.description,
    parameters: params,
    async execute(args) {
      const headers = dbTool.headers as Record<string, string> | undefined;
      const url = dbTool.method === "GET"
        ? `${dbTool.endpoint}?${new URLSearchParams(args as Record<string, string>)}`
        : dbTool.endpoint;

      const res = await fetch(url, {
        method: dbTool.method,
        headers: {
          "Content-Type": "application/json",
          ...headers,
        },
        body: dbTool.method === "POST" ? JSON.stringify(args) : undefined,
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
    const builtin = getBuiltinTool(id);
    if (builtin) {
      defs.push({
        id: builtin.id,
        name: builtin.name,
        description: builtin.description,
        parameters: builtin.parameters,
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
        parameters: dbTool.parameters as unknown,
      });
    }
  }

  return defs;
}
