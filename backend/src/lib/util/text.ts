export function overlapRatio(a: string, b: string): number {
  const shorter = a.length < b.length ? a : b;
  const longer = a.length < b.length ? b : a;
  if (shorter.length === 0) return 0;
  const common = new Set(shorter.split(""));
  const intersection = [...longer].filter((ch) => common.has(ch)).length;
  return intersection / longer.length;
}

export function deduplicateChunks(chunks: string[], threshold = 0.7): string[] {
  const result: string[] = [];
  for (const chunk of chunks) {
    if (!result.some((r) => overlapRatio(r, chunk) > threshold)) {
      result.push(chunk);
    }
  }
  return result;
}
