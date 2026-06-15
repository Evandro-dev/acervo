UPDATE events
SET type = 'Congresso'
WHERE lower(type) = 'congresso';

UPDATE events
SET type = U&'Simp\00F3sio'
WHERE type IN (
  U&'Simp\00F3sio',
  U&'Simp\00C3\00B3sio',
  'Simposio',
  'simposio',
  'SIMPOSIO',
  'Simpasio',
  'simpasio',
  'SIMPASIO'
);

UPDATE events
SET type = U&'Semin\00E1rio'
WHERE type IN (
  U&'Semin\00E1rio',
  U&'Semin\00C3\00A1rio',
  'Seminario',
  'seminario',
  'SEMINARIO'
);

UPDATE events
SET type = 'Workshop'
WHERE lower(type) = 'workshop';

UPDATE events
SET type = 'Expo'
WHERE lower(type) = 'expo';
