import fs from 'fs';

async function main() {
  const token = process.argv[2];
  const eventId = process.argv[3];
  if (!token || !eventId) {
    console.error('Uso: node upload-catalog.mjs <JWT> <EVENT_ID>');
    process.exit(1);
  }

  const pdfPath = './scripts/test-files/catalog.pdf';
  const imgPath = './scripts/test-files/catalog.png';

  const pdf = await fs.promises.readFile(pdfPath);
  const img = await fs.promises.readFile(imgPath);

  const form = new FormData();
  form.append('pdf', pdf, 'catalog.pdf');
  form.append('image', img, 'catalog.png');

  const res = await fetch(`http://127.0.0.1:10000/events/${eventId}/catalog/upload`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      // Note: don't set Content-Type; fetch/FormData will add proper boundary
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
}

main().catch(err => { console.error(err); process.exit(1); });
