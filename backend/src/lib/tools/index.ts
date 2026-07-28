import type { Tool } from "./types";
import { searchToolDef } from "./search";
import { webRequestToolDef } from "./web-request";

const builtinDefs = [searchToolDef, webRequestToolDef];

const builtinToolMap = Object.fromEntries(
  builtinDefs.map((d) => [d.id, d])
);

export function getToolName(id: string): string {
  return builtinToolMap[id]?.name ?? id.slice(0, 8);
}

export function getAllBuiltinTools(): Tool[] {
  return builtinDefs.map((d) => ({
    ...d,
    execute: async () => "",
  }));
}

export function getBuiltinDef(id: string) {
  return builtinToolMap[id];
}
