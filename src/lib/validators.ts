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

export const createAgentSchema = z.object({
  name: z.string().min(1),
  systemPrompt: z.string().default(""),
  model: z.string().default("deepseek-chat"),
  temperature: z.number().min(0).max(2).default(0.7),
  maxTokens: z.number().min(1).default(4096),
  tools: z.array(z.string()).default([]),
  knowledgeBaseIds: z.array(z.string()).default([]),
});

export const updateAgentSchema = z.object({
  name: z.string().min(1).optional(),
  systemPrompt: z.string().optional(),
  model: z.string().optional(),
  temperature: z.number().min(0).max(2).optional(),
  maxTokens: z.number().min(1).optional(),
  tools: z.array(z.string()).optional(),
  knowledgeBaseIds: z.array(z.string()).optional(),
});
