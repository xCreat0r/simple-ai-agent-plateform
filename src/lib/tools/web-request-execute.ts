import "server-only";

import type { Tool } from "./types";
import { webRequestToolDef } from "./web-request";
import { validateExternalUrlWithDNS } from "./url-guard";

export const webRequestTool: Tool = {
  ...webRequestToolDef,
  async execute(args) {
    const url = args.url as string;
    await validateExternalUrlWithDNS(url);
    const res = await fetch(url, { redirect: "error" });
    const text = await res.text();
    return `状态码: ${res.status}\n${text.slice(0, 2000)}`;
  },
};
