import OpenAI from "openai";
import { getCloudflareContext } from "@/lib/env-holder";

const EMBEDDING_DIM = 1024;

type Provider = "workers-ai" | "dashscope" | "mock";

// 按环境变量选择嵌入 provider：workers-ai / dashscope / mock
function getProvider(): Provider {
  const p = (process.env.EMBEDDING_PROVIDER || "workers-ai").toLowerCase();
  if (p === "dashscope" || p === "mock" || p === "workers-ai") return p;
  console.warn(`[embedding] 未知的 EMBEDDING_PROVIDER=${p}，回退为 workers-ai`);
  return "workers-ai";
}

let dashscopeClient: OpenAI | null = null;

function getDashscopeClient(): OpenAI {
  if (dashscopeClient) return dashscopeClient;
  dashscopeClient = new OpenAI({
    apiKey: process.env.DASHSCOPE_API_KEY || "missing",
    baseURL: process.env.DASHSCOPE_BASE_URL || "https://dashscope.aliyuncs.com/compatible-mode/v1",
  });
  return dashscopeClient;
}

async function workersAiEmbedding(text: string): Promise<number[]> {
  const { env } = getCloudflareContext();
  if (!env.AI || typeof env.AI.run !== "function") {
    throw new Error("env.AI binding 不可用");
  }
  // 调用 Cloudflare Workers AI 的 BGE-M3 模型（单文本）
  const res = await env.AI.run("@cf/baai/bge-m3", {
    text: [text],
  }) as { data: number[][] };
  return res.data[0];
}

async function workersAiEmbeddings(texts: string[]): Promise<number[][]> {
  const { env } = getCloudflareContext();
  if (!env.AI || typeof env.AI.run !== "function") {
    throw new Error("env.AI binding 不可用");
  }
  // 调用 Cloudflare Workers AI 的 BGE-M3 模型（批量）
  const res = await env.AI.run("@cf/baai/bge-m3", {
    text: texts,
  }) as { data: number[][] };
  return res.data;
}

async function dashscopeEmbeddings(texts: string[]): Promise<number[][]> {
  // 阿里云 DashScope 兼容 OpenAI SDK 接口，按 index 排序保证与输入顺序一致
  const client = getDashscopeClient();
  const model = process.env.DASHSCOPE_EMBEDDING_MODEL || "text-embedding-v3";
  const res = await client.embeddings.create({
    model,
    input: texts,
    dimensions: EMBEDDING_DIM,
  });
  return res.data
    .sort((a, b) => a.index - b.index)
    .map((d) => d.embedding);
}

// FNV-1a 32bit 哈希，用于确定性播种
function fnv1a(str: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = (h * 0x01000193) >>> 0;
  }
  return h >>> 0;
}

// xorshift32 伪随机数（确定性），输出 [0,1)
function xorshift32(state: number): number {
  state ^= state << 13;
  state ^= state >>> 17;
  state ^= state << 5;
  return ((state >>> 0) % 0xffffffff) / 0xffffffff;
}

// 确定性伪向量：相同文本恒得相同 1024 维向量（仅用于本地链路调试，无语义）
function mockEmbedding(text: string): number[] {
  const seed = fnv1a(text);
  const vec = new Array(EMBEDDING_DIM).fill(0);
  let state = seed || 1;
  for (let i = 0; i < EMBEDDING_DIM; i++) {
    state = (state * 1103515245 + 12345) >>> 0;
    vec[i] = xorshift32(state);
  }
  const norm = Math.sqrt(vec.reduce((s, v) => s + v * v, 0)) || 1;
  return vec.map((v) => v / norm);
}

export async function generateEmbedding(text: string): Promise<number[]> {
  const provider = getProvider();
  if (provider === "mock") return mockEmbedding(text);
  try {
    if (provider === "dashscope") {
      const [e] = await dashscopeEmbeddings([text]);
      return e;
    }
    return await workersAiEmbedding(text);
  } catch (err) {
    // workers-ai 不可用时自动降级为 mock（仅用于本地调试，无语义），保证链路可用
    if (provider === "workers-ai") {
      console.warn(`[embedding] workers-ai 不可用（${err instanceof Error ? err.message : "未知错误"}），降级为 mock`);
      return mockEmbedding(text);
    }
    throw err;
  }
}

export async function generateEmbeddings(texts: string[]): Promise<number[][]> {
  try {
    const provider = getProvider();
    if (provider === "mock") return texts.map(mockEmbedding);
    if (provider === "dashscope") return dashscopeEmbeddings(texts);
    return await workersAiEmbeddings(texts);
  } catch (err) {
    // 批量接口同样支持 workers-ai 降级为 mock
    const provider = getProvider();
    if (provider === "workers-ai") {
      console.warn(`[embedding] workers-ai 不可用（${err instanceof Error ? err.message : "未知错误"}），降级为 mock`);
      return texts.map(mockEmbedding);
    }
    throw new Error(
      `向量嵌入生成失败: ${err instanceof Error ? err.message : "未知错误"}`
    );
  }
}
