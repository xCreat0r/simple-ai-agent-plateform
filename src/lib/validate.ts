import type { ZodSchema } from "zod";
import { badRequest } from "@/lib/errors";

export function parseBody<T>(body: unknown, schema: ZodSchema<T>): T {
  const result = schema.safeParse(body);
  if (!result.success) {
    const msgs = result.error.issues.map((e) => e.message).join("; ");
    throw badRequest(msgs);
  }
  return result.data;
}
