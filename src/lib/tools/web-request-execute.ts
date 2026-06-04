import "server-only";

import type { Tool } from "./types";
import { webRequestToolDef } from "./web-request";

export const webRequestTool: Tool = {
  ...webRequestToolDef,
  async execute(args) {
    const url = args.url as string;
    const res = await fetch(url);
    const text = await res.text();
    return `状态码: ${res.status}\n${text.slice(0, 2000)}`;
  },
};
