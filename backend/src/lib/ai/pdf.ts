import { getDocumentProxy, extractText } from "unpdf";
import { config } from "@/lib/config";

// Worker 内本地 PDF 文本提取（unpdf / PDF.js serverless 构建）。
// 不再依赖独立 base 服务；解析在主事件循环执行，必须自行限时与限制资源。

const PARSE_TIMEOUT_MS = 30_000;
const MAX_IMAGE_SIZE = 16 * 1024 * 1024; // ~16MP，防单图声明导致内存暴涨

// 用户可读错误：message 是白名单文案，可直接回显给前端；
// 底层解析异常（含内部细节）一律转为该错误，避免泄漏
export class PdfUserError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PdfUserError";
  }
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new PdfUserError("PDF 解析超时，请重试")), ms);
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

// 解析 PDF 字节为纯文本；无效 PDF / 页数超限 / 超时均抛出 PdfUserError
export async function parsePdfBytes(arrBuf: ArrayBuffer): Promise<string> {
  const data = new Uint8Array(arrBuf);

  let pdf;
  try {
    pdf = await withTimeout(
      getDocumentProxy(data, { maxImageSize: MAX_IMAGE_SIZE }),
      PARSE_TIMEOUT_MS
    );
  } catch (err) {
    // 底层解析异常：记录原始错误，仅向用户回显白名单文案
    if (err instanceof PdfUserError) throw err;
    console.error("[pdf] 解析文档失败:", err);
    throw new PdfUserError("PDF 解析失败（文件可能损坏或格式不受支持）");
  }

  if (pdf.numPages > config.knowledge.maxPdfPages) {
    throw new PdfUserError(`PDF 页数超过上限（${config.knowledge.maxPdfPages} 页）`);
  }

  try {
    const { text } = await withTimeout(
      extractText(pdf, { mergePages: true }),
      PARSE_TIMEOUT_MS
    );
    return text;
  } catch (err) {
    if (err instanceof PdfUserError) throw err;
    console.error("[pdf] 提取文本失败:", err);
    throw new PdfUserError("PDF 解析失败（文件可能损坏或格式不受支持）");
  }
}
