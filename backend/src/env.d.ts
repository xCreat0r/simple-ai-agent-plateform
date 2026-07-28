declare module "pdf-parse" {
  interface PDFData {
    text: string;
    numpages: number;
    info: Record<string, unknown>;
  }
  function pdf(data: Buffer): Promise<PDFData>;
  export default pdf;
}
