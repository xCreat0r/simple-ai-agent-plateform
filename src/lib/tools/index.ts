import type { Tool } from "./types";
import { webRequestTool } from "./web-request";
import { searchTool } from "./search";

const tools: Record<string, Tool> = {
  [webRequestTool.id]: webRequestTool,
  [searchTool.id]: searchTool,
};

export function getTool(id: string): Tool | undefined {
  return tools[id];
}

export function getAllTools(): Tool[] {
  return Object.values(tools);
}

export function getToolDefinitions(toolIds: string[]) {
  return toolIds
    .map((id) => tools[id])
    .filter(Boolean)
    .map(({ id, name, description, parameters }) => ({
      id,
      name,
      description,
      parameters,
    }));
}
