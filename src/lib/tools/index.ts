import type { Tool } from "./types";
import { webRequestTool } from "./web-request";
import { searchTool } from "./search";

const builtinTools: Record<string, Tool> = {
  [webRequestTool.id]: webRequestTool,
  [searchTool.id]: searchTool,
};

export function getToolName(id: string): string {
  const builtin = builtinTools[id];
  if (builtin) return builtin.name;
  return id.slice(0, 8);
}

export function getAllBuiltinTools(): Tool[] {
  return Object.values(builtinTools);
}

export function getBuiltinTool(id: string): Tool | undefined {
  return builtinTools[id];
}
