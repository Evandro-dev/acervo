import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

async function main() {
  const token = process.argv[2];
  const eventId = process.argv[3];
  if (!token || !eventId) {
    console.error('Uso: node upload-catalog-blob2.mjs <JWT> <EVENT_ID>');
    process.exit(1);
  }

  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const pdfPath = path.join(__dirname, 'test-files', 'catalog.pdf');
  const imgPath = path.join(__dirname, 'test-files', 'catalog.png');

  try {
    const pdf = await fs.promises.readFile(pdfPath);
    const img = await fs.promises.readFile(imgPath);

    const form = new FormData();
    form.append('pdf', new Blob([pdf]), 'catalog.pdf');
    form.append('image', new Blob([img]), 'catalog.png');

    const res = await fetch(`http://127.0.0.1:10000/events/${eventId}/catalog/upload`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
      body: form,
    });

    console.log('status', res.status);
    const contentType = res.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      console.log(await res.json());
    } else {
      console.log(await res.text());
    }
  } catch (err) {
    console.error('ERROR', err);
    process.exit(1);
  }
}

main().catch(err => { console.error(err); process.exit(1); });
