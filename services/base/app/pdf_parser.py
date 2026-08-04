"""PDF 文本提取：用 PyMuPDF 提取文字层。"""

import fitz


def extract_pdf(data: bytes) -> str:
    """用 PyMuPDF 逐页提取文字层文本。"""
    doc = fitz.open(stream=data, filetype="pdf")
    try:
        parts = []
        for page in doc:
            parts.append(page.get_text())
        return "\n".join(parts)
    finally:
        doc.close()
