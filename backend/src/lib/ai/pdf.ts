import { getDocumentProxy, extractText } from "unpdf";
import { config } from "@/lib/config";

// Worker 内本地 PDF 文本提取（unpdf / PDF.js serverless 构建）。
// 不再依赖独立 base 服务；解析在主事件循环执行，必须自行限时与限制资源。

const PARSE_TIMEOUT_MS = 30_000;
const MAX_IMAGE_SIZE = 16 * 1024 * 1024; // ~16MP，防单图声明导致内存暴涨

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("PDF 解析超时")), ms);
    promise.then(
      (v) => {
        clearTimeout(timer);
        resolve(v);
      },
      (e) => {
        clearTimeout(timer);
        reject(e);
      }
    );
  });
}

// 解析 PDF 字节为纯文本；无效 PDF / 页数超限 / 超时均抛出可读错误
export async function parsePdfBytes(arrBuf: ArrayBuffer): Promise<string> {
  const data = new Uint8Array(arrBuf);
  const pdf = await withTimeout(
    getDocumentProxy(data, { maxImageSize: MAX_IMAGE_SIZE }),
    PARSE_TIMEOUT_MS
  );

  if (pdf.numPages > config.knowledge.maxPdfPages) {
    throw new Error(`PDF 页数超过上限（${config.knowledge.maxPdfPages} 页）`);
  }

  const { text } = await withTimeout(
    extractText(pdf, { mergePages: true }),
    PARSE_TIMEOUT_MS
  );
  return text;
}
