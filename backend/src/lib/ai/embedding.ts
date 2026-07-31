import { getCloudflareContext } from "@/lib/env-holder";

export async function generateEmbedding(text: string): Promise<number[]> {
  const { env } = getCloudflareContext();
  const res = await env.AI.run("@cf/baai/bge-m3", {
    text: [text],
  }) as { data: number[][] };
  return res.data[0];
}

export async function generateEmbeddings(texts: string[]): Promise<number[][]> {
  try {
    const { env } = getCloudflareContext();
    const res = await env.AI.run("@cf/baai/bge-m3", {
      text: texts,
    }) as { data: number[][] };
    return res.data;
  } catch (err) {
    throw new Error(
      `向量嵌入生成失败: ${err instanceof Error ? err.message : "未知错误"}`
    );
  }
}
