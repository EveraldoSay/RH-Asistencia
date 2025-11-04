require('dotenv').config();
const DigestFetch = require('digest-fetch').default || require('digest-fetch');
const db = require('../db');

// === Dispositivos ===
const devices = [
  { ip: '192.168.0.45', user: 'admin', pass: 'Hospital0.' },
  { ip: '192.168.0.46', user: 'admin', pass: 'Hospital0.' }
];

// === Ajuste horario Guatemala UTC-6 ===
function getTimeRange() {
  const now = new Date();
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  const end = new Date(now);
  end.setHours(23, 59, 59, 999);
  return { start, end };
}

async function fetchEvents(device) {
  const client = new DigestFetch(device.user, device.pass);
  const { start, end } = getTimeRange();

  // Convierte a formato aceptado por el ISAPI
  const toHikTime = (d) => {
    const iso = d.toISOString().split('.')[0]; // "2025-11-04T06:00:00"
    return iso + '-06:00'; // agrega offset fijo Guatemala
  };

  const makeBody = (major = 5, minor = 75) => ({
    AcsEventCond: {
      searchID: `sync_${Date.now()}`,
      searchResultPosition: 0,
      maxResults: 1000,
      major,
      minor,
      startTime: toHikTime(start),
      endTime: toHikTime(end),
      timeReverseOrder: false
    }
  });

  async function tryFetch(body) {
    return await client.fetch(
      `http://${device.ip}/ISAPI/AccessControl/AcsEvent?format=json`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      }
    );
  }

  console.log(`Consultando eventos de ${device.ip}...`);
  let res = await tryFetch(makeBody(5, 75));

  if (res.status === 400) {
    console.warn(`${device.ip}: reintentando sin filtros de major/minor...`);
    res = await tryFetch(makeBody(0, 0));
  }

  if (!res.ok) {
    console.error(`Error en ${device.ip}: HTTP ${res.status}`);
    const raw = await res.text();
    console.error(raw);
    return [];
  }

  const data = await res.json();
  const list = data?.AcsEvent?.InfoList || [];
  console.log(`${device.ip}: ${list.length} eventos obtenidos`);

  return list.map(ev => ({
    ip: device.ip,
    empleado: ev.employeeNoString,
    nombre: ev.name,
    fechaHora: ev.time,
    modo: ev.currentVerifyMode,
    temperatura: ev.currTemperature,
    evento: ev.attendanceStatus,
    foto: ev.pictureURL
  }));
}


// === Guardar eventos en registros_asistencia ===
async function saveEvents(events) {
  let insertados = 0;

  for (const ev of events) {
    if (!ev.empleado || !ev.fechaHora) continue;

    try {
      const [rows] = await db.query(
        'SELECT id FROM empleados WHERE numero_empleado = ? LIMIT 1',
        [ev.empleado]
      );
      const empleado_id = rows.length ? rows[0].id : null;

      await db.query(
        `
        INSERT INTO registros_asistencia
          (empleado_id, tipo_evento, fecha_hora, dispositivo_ip, codigo_evento, origen, procesado)
        VALUES (?, ?, ?, ?, ?, 'BIOMETRICO', 0)
        ON DUPLICATE KEY UPDATE procesado = procesado
        `,
        [
          empleado_id,
          ev.evento === 'checkOut' ? 'SALIDA' : 'ENTRADA',
          new Date(ev.fechaHora),
          ev.ip,
          ev.modo
        ]
      );

      insertados++;
    } catch (err) {
      console.error(`Error insertando evento ${ev.empleado}: ${err.message}`);
    }
  }

  console.log(`Total registros insertados: ${insertados}`);
}

// === Proceso principal ===
(async () => {
  try {
    console.log('Iniciando sincronización biométrica...');
    const allEvents = [];

    for (const dev of devices) {
      const evs = await fetchEvents(dev);
      allEvents.push(...evs);
    }

    if (!allEvents.length) {
      console.warn('No se encontraron eventos para procesar.');
      process.exit(0);
    }

    await saveEvents(allEvents);
    console.log('Sincronización completada.');
    process.exit(0);
  } catch (err) {
    console.error('Error general:', err.message);
    process.exit(1);
  }
})();
