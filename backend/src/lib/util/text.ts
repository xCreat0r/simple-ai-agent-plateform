// 计算两个文本基于字符集合的重叠比例（字符级相似度）
export function overlapRatio(a: string, b: string): number {
  const shorter = a.length < b.length ? a : b;
  const longer = a.length < b.length ? b : a;
  if (shorter.length === 0) return 0;
  const common = new Set(shorter.split(""));
  const intersection = [...longer].filter((ch) => common.has(ch)).length;
  return intersection / longer.length;
}

// 去重：相似度超过阈值（默认 0.7）的后续分块会被丢弃，
// 用于消除 RAG 检索结果中高度重复的内容
export function deduplicateChunks(chunks: string[], threshold = 0.7): string[] {
  const result: string[] = [];
  for (const chunk of chunks) {
    if (!result.some((r) => overlapRatio(r, chunk) > threshold)) {
      result.push(chunk);
    }
  }
  return result;
}
