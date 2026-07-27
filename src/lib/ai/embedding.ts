import OpenAI from "openai";

let client: OpenAI | null = null;

function getClient() {
  if (!client) {
    const apiKey = process.env.BAILIAN_API_KEY;
    if (!apiKey) {
      throw new Error("BAILIAN_API_KEY 未配置，无法使用向量嵌入服务");
    }
    client = new OpenAI({
      apiKey,
      baseURL: "https://dashscope.aliyuncs.com/compatible-mode/v1",
    });
  }
  return client;
}

export async function generateEmbedding(text: string): Promise<number[]> {
  const res = await getClient().embeddings.create({
    model: "text-embedding-v3",
    input: text,
  });
  return res.data[0].embedding;
}

export async function generateEmbeddings(texts: string[]): Promise<number[][]> {
  try {
    const res = await getClient().embeddings.create({
      model: "text-embedding-v3",
      input: texts,
    });
    return res.data.map((d) => d.embedding);
  } catch (err) {
    throw new Error(
      `向量嵌入生成失败: ${err instanceof Error ? err.message : "未知错误"}`
    );
  }
}
