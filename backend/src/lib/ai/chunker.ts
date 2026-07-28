const MAX_CHUNK = 800;
const MIN_CHUNK = 300;
const OVERLAP = 100;

export function splitText(text: string): string[] {
  const paragraphs = text.split(/\n\n+/).filter(Boolean);
  const chunks: string[] = [];
  let lastEnd = "";

  for (const para of paragraphs) {
    if (para.length <= MAX_CHUNK) {
      if (lastEnd) {
        const merged = lastEnd + "\n\n" + para;
        if (merged.length <= MAX_CHUNK) {
          lastEnd = merged;
          continue;
        }
        chunks.push(lastEnd);
      }
      lastEnd = para;
      continue;
    }

    if (lastEnd) {
      chunks.push(lastEnd);
      lastEnd = "";
    }

    const sentences = para.split(/(?<=[。！？\n])/);
    let buffer = "";

    for (const s of sentences) {
      if (!s.trim()) continue;
      if (buffer.length + s.length <= MAX_CHUNK) {
        buffer += s;
      } else {
        if (buffer) chunks.push(buffer.trim());
        buffer = s;
      }
    }

    if (buffer.trim().length >= MIN_CHUNK) {
      chunks.push(buffer.trim());
      lastEnd = buffer.trim().slice(-OVERLAP);
    } else if (chunks.length > 0) {
      chunks[chunks.length - 1] += buffer;
      lastEnd = chunks[chunks.length - 1].slice(-OVERLAP);
    } else {
      chunks.push(buffer.trim());
    }
  }

  if (lastEnd) chunks.push(lastEnd);

  return chunks.filter(Boolean);
}
