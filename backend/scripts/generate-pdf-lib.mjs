import fs from 'fs';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';

async function main() {
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([600, 800]);
  const helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontSize = 24;
  page.drawText('Ficha Catalográfica - Teste', { x: 50, y: 750, size: fontSize, font: helvetica, color: rgb(0, 0, 0) });
  page.drawText('Autor: Dev Tester', { x: 50, y: 720, size: 12, font: helvetica });
  page.drawText('ISBN: 978-1-23456-789-7', { x: 50, y: 700, size: 12, font: helvetica });

  const pdfBytes = await pdfDoc.save();
  const outPath = './scripts/test-files/catalog_real.pdf';
  await fs.promises.writeFile(outPath, Buffer.from(pdfBytes));
  console.log('Wrote', outPath);
}

main().catch(err => { console.error(err); process.exit(1); });
