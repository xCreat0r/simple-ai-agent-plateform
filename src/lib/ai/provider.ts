import "server-only";
import OpenAI from "openai";
import { createOpenAI } from "@ai-sdk/openai";

const baseURL = process.env.DEEPSEEK_BASE_URL || "https://api.deepseek.com/v1";
const apiKey = process.env.DEEPSEEK_API_KEY!;

export const deepseek = createOpenAI({
  apiKey,
  baseURL,
});

export const openai = new OpenAI({
  apiKey,
  baseURL,
});

export const AI_MODELS = {
  "deepseek-chat": { label: "DeepSeek Chat", provider: "deepseek" },
  "deepseek-reasoner": { label: "DeepSeek Reasoner", provider: "deepseek" },
} as const;

export function getModelForAgent(modelId: string): { model: string; provider: string } {
  const m = AI_MODELS[modelId as keyof typeof AI_MODELS];
  if (m) return { model: modelId, provider: m.provider };
  return { model: "deepseek-chat", provider: "deepseek" };
}
