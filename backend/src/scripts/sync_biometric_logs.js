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

  // 3. Insertar solo los eventos limpios
  for (const ev of cleanEvents) {
    try {
      const [rows] = await db.query(
        'SELECT id FROM empleados WHERE numero_empleado = ? LIMIT 1',
        [ev.empleado]
      );
      
      const empleado_id = rows.length ? rows[0].id : null;

      await db.query(
        `
        INSERT IGNORE INTO registros_asistencia
          (empleado_id, tipo_evento, fecha_hora, dispositivo_ip, codigo_evento, origen, procesado)
        VALUES (?, ?, ?, ?, ?, 'BIOMETRICO', 0)
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
  console.log(`Total insertados en DB: ${insertados}`);
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
async function processDailyAttendance() {

  const [empleados] = await db.query(`
    SELECT DISTINCT empleado_id, DATE(fecha_hora) AS fecha
    FROM registros_asistencia
    WHERE DATE(fecha_hora) = CURDATE()
      AND empleado_id IS NOT NULL
  `);

  let procesadas = 0;

  for (const emp of empleados) {
    const { empleado_id, fecha } = emp;

    // Todas las marcas del día
    const [marcas] = await db.query(`
      SELECT DISTINCT fecha_hora
      FROM registros_asistencia
      WHERE empleado_id = ? AND DATE(fecha_hora) = ?
      ORDER BY fecha_hora ASC
    `, [empleado_id, fecha]);

    if (!marcas.length) continue;

    const entrada_real = marcas[0].fecha_hora;
    const salida_real = marcas.length > 1 ? marcas[marcas.length - 1].fecha_hora : null;

    // Buscar turno asignado y configuración activa
    const [[turno]] = await db.query(`
      SELECT 
        t.id AS turno_id,
        t.hora_inicio,
        t.hora_fin,
        t.tolerancia_entrada_minutos,
        t.tolerancia_salida_minutos,
        c.configuracion AS config_json
      FROM asignacion_turnos a
      INNER JOIN turnos t ON t.id = a.turno_id
      LEFT JOIN configuraciones_turnos c 
        ON c.turno_id = t.id 
       AND c.area_id = (SELECT e.area_id FROM empleados e WHERE e.id = a.empleado_id)
      WHERE a.empleado_id = ?
        AND ? BETWEEN a.fecha_inicio AND a.fecha_fin
      LIMIT 1;
    `, [empleado_id, fecha]);

    // Si no tiene turno asignado
    if (!turno) {
      continue;
    }

    // Verificar si es día laborable
    let esLaboral = true;
    try {
      if (turno.config_json) {
        const conf = JSON.parse(turno.config_json);
        const diaSemana = new Date(fecha).getDay(); // 0=domingo
        if (conf.dias_descanso && conf.dias_descanso.includes(String(diaSemana))) {
          esLaboral = false;
        }
      }
    } catch (e) {
      console.warn(`Configuración JSON inválida para turno ${turno.turno_id}:`, e.message);
    }

    if (!esLaboral) {
      continue;
    }

    // Evaluar cumplimiento
    let estado = 'INCOMPLETO';
    let minutos_retraso = 0;

    const horaInicio = new Date(`${fecha}T${turno.hora_inicio}`);
    const horaFin = new Date(`${fecha}T${turno.hora_fin}`);

    if (!salida_real) {
      estado = 'INCOMPLETO';
    } else if (
      entrada_real > new Date(horaInicio.getTime() + turno.tolerancia_entrada_minutos * 60000)
    ) {
      estado = 'TARDE';
      minutos_retraso = Math.floor((entrada_real - horaInicio) / 60000);
    } else if (entrada_real < horaInicio) {
      estado = 'TEMPRANO';
    } else {
      estado = 'COMPLETO';
    }

    // Insertar o actualizar asistencia
    await db.query(`
      INSERT INTO asistencias
        (empleado_id, fecha, turno_id, entrada_real, salida_real, estado, minutos_retraso)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        entrada_real = VALUES(entrada_real),
        salida_real  = VALUES(salida_real),
        estado       = VALUES(estado),
        minutos_retraso = VALUES(minutos_retraso);
    `, [
      empleado_id,
      fecha,
      turno.turno_id,
      entrada_real,
      salida_real,
      estado,
      minutos_retraso
    ]);

    procesadas++;
  }

}
