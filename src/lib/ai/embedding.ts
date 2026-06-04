import OpenAI from "openai";

let client: OpenAI | null = null;

function getClient() {
  if (!client) {
    client = new OpenAI({
      apiKey: process.env.BAILIAN_API_KEY!,
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
  const res = await getClient().embeddings.create({
    model: "text-embedding-v3",
    input: texts,
  });
  return res.data.map((d) => d.embedding);
}
