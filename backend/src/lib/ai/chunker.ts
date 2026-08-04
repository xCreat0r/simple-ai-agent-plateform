const MAX_CHUNK = 800;
const MIN_CHUNK = 300;
const OVERLAP = 100;

// 文本分块算法：优先按段落（双换行）切分，大段落内再按中文标点句切分，
// 保留 OVERLAP 字重叠以保持相邻块语义连贯
export function splitText(text: string): string[] {
  const paragraphs = text.split(/\n\n+/).filter(Boolean);
  const chunks: string[] = [];
  let lastEnd = "";
  let overlap = "";

  for (const para of paragraphs) {
    // 段落本身足够小：尝试与上一条"尾巴"合并，否则独立成块
    if (para.length <= MAX_CHUNK) {
      if (lastEnd) {
        const merged = lastEnd + "\n\n" + para;
        if (merged.length <= MAX_CHUNK) {
          lastEnd = merged;
          continue;
        }
        chunks.push(lastEnd);
      }
      // 若上一段是大段落，用其 overlap 尾巴衔接本段开头
      lastEnd = overlap ? overlap + "\n\n" + para : para;
      overlap = "";
      continue;
    }

    // 大段落：先落盘之前的尾巴，再按句子切分
    if (lastEnd) {
      chunks.push(lastEnd);
      lastEnd = "";
    }

    const sentences = para.split(/(?<=[。！？\n])/);
    // 上一段的 overlap 尾巴拼入本段第一块开头，保持相邻块语义连贯
    let buffer = overlap || "";
    overlap = "";

    for (const s of sentences) {
      if (!s.trim()) continue;
      if (buffer.length + s.length <= MAX_CHUNK) {
        buffer += s;
      } else {
        if (buffer) chunks.push(buffer.trim());
        buffer = s;
      }
    }

    // 剩余不足 MIN_CHUNK 的尾巴：并入上一个块，避免产生过碎的分块；
    // 同时截取尾部 OVERLAP 字作为下一段的衔接（不独立成块，避免与上一块内容重复）
    if (buffer.trim().length >= MIN_CHUNK) {
      chunks.push(buffer.trim());
      overlap = buffer.trim().slice(-OVERLAP);
    } else if (chunks.length > 0) {
      chunks[chunks.length - 1] += buffer;
      overlap = chunks[chunks.length - 1].slice(-OVERLAP);
    } else {
      chunks.push(buffer.trim());
    }
  }

  if (lastEnd) chunks.push(lastEnd);

  return chunks.filter(Boolean);
}
