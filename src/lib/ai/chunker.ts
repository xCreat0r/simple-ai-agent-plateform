const CHUNK_SIZE = 500;
const CHUNK_OVERLAP = 100;

export function splitText(text: string): string[] {
  const chunks: string[] = [];
  let start = 0;

  while (start < text.length) {
    const end = start + CHUNK_SIZE;
    let chunk = text.slice(start, end);

    if (end < text.length) {
      const lastPeriod = chunk.lastIndexOf("。");
      const lastNewline = chunk.lastIndexOf("\n");
      const splitPoint = Math.max(lastPeriod, lastNewline);
      if (splitPoint > CHUNK_SIZE / 2) {
        chunk = chunk.slice(0, splitPoint + 1);
      }
    }

    if (chunk.trim()) {
      chunks.push(chunk.trim());
    }

    start += chunk.length - CHUNK_OVERLAP;
    if (start < 0) start = 0;
  }

  return chunks;
}
