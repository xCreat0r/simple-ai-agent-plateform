import { z } from "zod";

export const toolCallSchema = z.object({
  id: z.string(),
  type: z.literal("function"),
  function: z.object({
    name: z.string(),
    arguments: z.string(),
  }),
});

export const toolResultSchema = z.object({
  toolCallId: z.string(),
  content: z.string(),
});

export const toolParametersSchema = z.object({
  type: z.literal("object"),
  properties: z.record(
    z.string(),
    z.object({
      type: z.enum(["string", "number", "boolean"]),
      description: z.string().default(""),
    })
  ),
  required: z.array(z.string()).default([]),
});

export const createToolSchema = z.object({
  name: z.string().min(1),
  description: z.string().default(""),
  parameters: toolParametersSchema,
  endpoint: z.string().url(),
  method: z.enum(["GET", "POST"]).default("POST"),
  headers: z.record(z.string(), z.string()).optional(),
});

export const updateToolSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  parameters: toolParametersSchema.optional(),
  endpoint: z.string().url().optional(),
  method: z.enum(["GET", "POST"]).optional(),
  headers: z.record(z.string(), z.string()).nullable().optional(),
});
