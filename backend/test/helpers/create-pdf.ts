import { PDFDocument, StandardFonts } from "pdf-lib";

type PdfLine =
  | string
  | {
      text: string;
      size?: number;
      x?: number;
      gapAfter?: number;
    };

type PdfPage = PdfLine[];

function normalizeLine(line: PdfLine) {
  return typeof line === "string" ? { text: line } : line;
}

export async function createPdfDocument(pages: PdfPage[]) {
  const document = await PDFDocument.create();
  const font = await document.embedFont(StandardFonts.Helvetica);

  for (const pageLines of pages) {
    const page = document.addPage([900, 842]);
    let y = 780;

    for (const rawLine of pageLines) {
      const line = normalizeLine(rawLine);
      const size = line.size ?? 12;

      page.drawText(line.text, {
        x: line.x ?? 48,
        y,
        size,
        font,
      });

      y -= line.gapAfter ?? size + 8;
    }
  }

  return new Uint8Array(await document.save());
}
