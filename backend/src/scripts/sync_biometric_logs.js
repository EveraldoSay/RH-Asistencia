require('dotenv').config();
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
  const { default: DigestFetch } = await import('digest-fetch');
  const client = new DigestFetch(device.user, device.pass);
  const { start, end } = getTimeRange();

  const toHikTime = (d) => {
    const iso = d.toISOString().split('.')[0];
    return iso + '-06:00';
  };
  const allEvents = [];
  let position = 0;
  let more = true;
  let intento = 1;

  while (more) {

    //crear nuevo cliente en cada iteración para renovar nonce
    const client = new DigestFetch(device.user, device.pass);

    const body = {
      AcsEventCond: {
        searchID: `sync_${Date.now()}_${intento}`,
        searchResultPosition: position,
        maxResults: 30,
        major: 5,
        minor: 75,
        startTime: toHikTime(start),
        endTime: toHikTime(end),
        timeReverseOrder: false
      }
    };

    const res = await client.fetch(
      `http://${device.ip}/ISAPI/AccessControl/AcsEvent?format=json`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      }
    );

    if (!res.ok) {
      console.error(`Error en ${device.ip}: HTTP ${res.status}`);
      const raw = await res.text();
      console.error(raw);
      break;
    }

    const data = await res.json();
    const list = data?.AcsEvent?.InfoList || [];
    const status = data?.AcsEvent?.responseStatusStrg || '';


    allEvents.push(...list);

    if (status !== 'MORE' || list.length === 0) more = false;
    else {
      position += list.length;
      intento++;
    }

    await new Promise(r => setTimeout(r, 300));
  }

  return allEvents.map(ev => ({
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
// === Guardar eventos en registros_asistencia ===
async function saveEvents(events) {
  let insertados = 0;

  // 1. Ordenar eventos por fecha
  events.sort((a, b) => new Date(a.fechaHora) - new Date(b.fechaHora));

  // 2. Filtrar ráfagas (Debounce)
  const cleanEvents = [];
  const lastSeen = {}; // Mapa para guardar última hora por empleado

  for (const ev of events) {
    if (!ev.empleado) continue;

    const key = `${ev.ip}_${ev.empleado}`;
    const evTime = new Date(ev.fechaHora).getTime();

    // Si ya vimos a este empleado en este dispositivo hace menos de 60 segundos (60000ms), ignorar
    if (lastSeen[key] && (evTime - lastSeen[key] < 60000)) {
      continue;
    }

    lastSeen[key] = evTime;
    cleanEvents.push(ev);
  }

  console.log(`Eventos recibidos: ${events.length} | Eventos únicos (filtrados): ${cleanEvents.length}`);

  // 3. Agrupar por empleado para determinar Entrada/Salida (Lógica Toggle)
  const eventsByEmp = {};
  for (const ev of cleanEvents) {
    if (!eventsByEmp[ev.empleado]) eventsByEmp[ev.empleado] = [];
    eventsByEmp[ev.empleado].push(ev);
  }

  // 4. Procesar y guardar
  for (const empNo in eventsByEmp) {
    const empEvents = eventsByEmp[empNo];
    // Asegurar orden cronológico
    empEvents.sort((a, b) => new Date(a.fechaHora) - new Date(b.fechaHora));

    // Obtener ID de empleado una sola vez
    let empleado_id = null;
    try {
      const [rows] = await db.query(
        'SELECT id FROM empleados WHERE numero_empleado = ? LIMIT 1',
        [empNo]
      );
      if (rows.length) empleado_id = rows[0].id;
    } catch (err) {
      console.error(`Error buscando empleado ${empNo}:`, err.message);
      continue;
    }

    if (!empleado_id) continue;

    // Determinar tipo de evento alternando (Entrada, Salida, Entrada...)
    // Asumimos que el primer evento del día es ENTRADA.
    // TODO: Si se quisiera ser más robusto ante reinicios parciales, se debería consultar el último estado en BD.
    // Pero dado que este script corre para "todo el día" (getTimeRange), reconstruir la secuencia completa es lo mejor.

    for (let i = 0; i < empEvents.length; i++) {
      const ev = empEvents[i];
      // Lógica Toggle: Pares (0, 2, 4...) son ENTRADA, Impares (1, 3...) son SALIDA
      const tipoEvento = (i % 2 === 0) ? 'ENTRADA' : 'SALIDA';

      try {
        await db.query(
          `
              INSERT INTO registros_asistencia
                (empleado_id, tipo_evento, fecha_hora, dispositivo_ip, codigo_evento, origen, procesado)
              VALUES (?, ?, ?, ?, ?, 'BIOMETRICO', 0)
              ON DUPLICATE KEY UPDATE 
                tipo_evento = VALUES(tipo_evento),
                procesado = 0
              `,
          [
            empleado_id,
            tipoEvento,
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
  }
  console.log(`Total procesados en DB: ${insertados}`);
}


// === Proceso principal ===
(async () => {
  console.log('Iniciando sincronización de logs biométricos...');
  try {
    const allEvents = [];

    for (const dev of devices) {
      console.log(`Obteniendo eventos de ${dev.ip}...`);
      const evs = await fetchEvents(dev);
      allEvents.push(...evs);
      console.log(`Se obtuvieron ${evs.length} eventos de ${dev.ip}`);
    }

    if (!allEvents.length) {
      console.warn('No se encontraron eventos nuevos para procesar.');
      process.exit(0);
    }
    console.log(`Total de eventos a procesar: ${allEvents.length}`);

    await saveEvents(allEvents);
    await processDailyAttendance();
    console.log('Sincronización de logs biométricos completada.');
    process.exit(0);
  } catch (err) {
    console.error('Error general en la sincronización de logs:', err.message);
    process.exit(1);
  }
})();

// === Consolidación diaria ===
// === Consolidación diaria ===
const { procesarAsistenciaDia } = require('../services/asistencia.service');

async function processDailyAttendance() {
  const today = new Date().toISOString().split('T')[0];
  console.log(`Procesando asistencia diaria para: ${today}`);
  await procesarAsistenciaDia(today);
}
