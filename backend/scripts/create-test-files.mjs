import fs from 'fs';
import path from 'path';

const dir = path.resolve('scripts', 'test-files');
if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

// 1x1 transparent PNG base64
const pngBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR4nGNgYAAAAAMAASsJTYQAAAAASUVORK5CYII=';
const pngPath = path.join(dir, 'catalog.png');
fs.writeFileSync(pngPath, Buffer.from(pngBase64, 'base64'));

// Minimal PDF content that includes %PDF- header
const pdfContent = `%PDF-1.4\n%âãÏÓ\n1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 200 200] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>\nendobj\n4 0 obj\n<< /Length 44 >>\nstream\nBT /F1 24 Tf 72 712 Td (Hello World) Tj ET\nendstream\nendobj\n5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\nxref\n0 6\n0000000000 65535 f \n0000000010 00000 n \n0000000060 00000 n \n0000000117 00000 n \n0000000223 00000 n \n0000000329 00000 n \ntrailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n439\n%%EOF`;
const pdfPath = path.join(dir, 'catalog.pdf');
fs.writeFileSync(pdfPath, pdfContent, 'latin1');

console.log('Wrote:', pdfPath);
console.log('Wrote:', pngPath);
