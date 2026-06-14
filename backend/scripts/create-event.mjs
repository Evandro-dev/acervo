import 'dotenv/config';

async function main() {
  const token = process.argv[2];
  if (!token) {
    console.error('Uso: node create-event.mjs <JWT>');
    process.exit(1);
  }

  const payload = {
    title: 'Evento Teste E2E',
    edition: '1',
    year: 2026,
    date: '2026-06-13',
    area: 'Teste',
    type: 'Workshop',
    presentation: 'Apresentação de teste de evento.',
    contact: { email: 'dev-admin@example.com' }
  };

  const res = await fetch('http://127.0.0.1:10000/events', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify(payload),
  });

  console.log('status', res.status);
  const body = await res.text();
  console.log(body);
}

main().catch(err => { console.error(err); process.exit(1); });
