import iconv from "iconv-lite";

// 将文件字节解码为 UTF-8 文本。
// Workers 的 TextDecoder 仅支持 UTF-8，因此对 GBK/GB2312 等中文字符集
// 需借助 iconv-lite 解码。策略：
// 1. 先按 UTF-8 宽松解码，若结果不含 U+FFFD 替换符说明编码合法，直接返回；
// 2. 否则说明字节不是合法 UTF-8（常见 GBK 编码的中文 txt/csv），按 GBK 解码。
export function decodeTextBuffer(arrBuf: ArrayBuffer): string {
  const bytes = new Uint8Array(arrBuf);

  const utf8 = new TextDecoder("utf-8").decode(bytes);
  if (!utf8.includes("\uFFFD")) return utf8;

  // 非 UTF-8 文本，按 GBK 回退解码
  return iconv.decode(bytes as unknown as Buffer, "gbk");
}
