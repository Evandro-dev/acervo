import 'dotenv/config';

async function main() {
  const token = process.argv[2];
  const eventId = process.argv[3];
  if (!token || !eventId) {
    console.error('Uso: node update-event.mjs <JWT> <EVENT_ID>');
    process.exit(1);
  }

  const payload = {
    title: 'Evento Teste E2E - Atualizado',
    edition: '1',
    year: 2026,
    date: '2026-06-14',
    area: 'Teste Atualizado',
    type: 'Workshop',
    presentation: 'Apresentação atualizada para teste.',
    themes: [],
    committee: [],
    rules: [],
    previousEditions: [],
    contact: { email: 'dev-admin@example.com' },
    catalog: { text: 'Texto de catálogo de teste' }
  };

  const res = await fetch(`http://127.0.0.1:10000/events/${eventId}`, {
    method: 'PUT',
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
