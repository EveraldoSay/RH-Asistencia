require('dotenv').config();
const DigestFetch = require('digest-fetch').default || require('digest-fetch');
const db = require('../db');

// === Dispositivos ===
const devices = [
  { ip: '192.168.0.45', user: 'admin', pass: '[REDACTED]' },
  { ip: '192.168.0.46', user: 'admin', pass: '[REDACTED]' }
];

// === Función para obtener rango de fechas personalizado ===
function getCustomTimeRange(fechaDesde, fechaHasta) {
  const start = new Date(fechaDesde);
  start.setHours(0, 0, 0, 0);

  const end = new Date(fechaHasta);
  end.setHours(23, 59, 59, 999);

  return { start, end };
}

// === Función para buscar eventos por rango de fechas ===
async function fetchHistoricalEvents(device, fechaDesde, fechaHasta) {
  const client = new DigestFetch(device.user, device.pass);
  const { start, end } = getCustomTimeRange(fechaDesde, fechaHasta);

  const toHikTime = (d) => {
    const iso = d.toISOString().split('.')[0];
    return iso + '-06:00';
  };

  const allEvents = [];
  let position = 0;
  let more = true;
  let intento = 1;

  while (more) {
    // Crear nuevo cliente en cada iteración para renovar nonce
    const client = new DigestFetch(device.user, device.pass);

    const body = {
      AcsEventCond: {
        searchID: `historical_${Date.now()}_${intento}`,
        searchResultPosition: position,
        maxResults: 50, // Aumentar para búsquedas históricas
        major: 5,
        minor: 75,
        startTime: toHikTime(start),
        endTime: toHikTime(end),
        timeReverseOrder: false
      }
    };

    try {
      const res = await client.fetch(
        `http://${device.ip}/ISAPI/AccessControl/AcsEvent?format=json`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
          timeout: 30000 // Aumentar timeout para búsquedas largas
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

      if (status !== 'MORE' || list.length === 0) {
        more = false;
      } else {
        position += list.length;
        intento++;
      }

      await new Promise(r => setTimeout(r, 500)); // Mayor delay para evitar sobrecarga
    } catch (err) {
      console.error(`Error en fetch para ${device.ip}:`, err.message);
      break;
    }
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

// === Guardar eventos históricos evitando duplicados ===
async function saveHistoricalEvents(events) {
  let insertados = 0;
  let duplicados = 0;

  for (const ev of events) {
    if (!ev.empleado || !ev.fechaHora) continue;

    try {
      // Intentar encontrar el empleado en la BD
      const [rows] = await db.query(
        'SELECT id FROM empleados WHERE numero_empleado = ? LIMIT 1',
        [ev.empleado]
      );

      const empleado_id = rows.length ? rows[0].id : null;

      // Verificar si el evento ya existe para evitar duplicados
      const [existing] = await db.query(
        `SELECT id FROM registros_asistencia 
         WHERE empleado_id = ? AND fecha_hora = ? AND dispositivo_ip = ? AND codigo_evento = ?`,
        [empleado_id, new Date(ev.fechaHora), ev.ip, ev.modo]
      );

      if (existing.length > 0) {
        duplicados++;
        continue;
      }

      // Determinar tipo de evento
      let tipo_evento = 'ENTRADA';
      if (ev.evento === 'checkOut') {
        tipo_evento = 'SALIDA';
      }

      // Insertar nuevo evento
      await db.query(
        `INSERT INTO registros_asistencia
          (empleado_id, tipo_evento, fecha_hora, dispositivo_ip, codigo_evento, origen, procesado)
        VALUES (?, ?, ?, ?, ?, 'BIOMETRICO', 0)`,
        [empleado_id, tipo_evento, new Date(ev.fechaHora), ev.ip, ev.modo]
      );

      insertados++;
    } catch (err) {
      console.error(`Error insertando evento histórico ${ev.empleado}: ${err.message}`);
    }
  }

  return { insertados, duplicados };
}

// === Procesar asistencias para el rango de fechas ===
async function processHistoricalAttendance(fechaDesde, fechaHasta) {

  // Obtener todos los empleados que tienen eventos en el rango
  const [empleados] = await db.query(`
    SELECT DISTINCT empleado_id, DATE(fecha_hora) AS fecha
    FROM registros_asistencia
    WHERE DATE(fecha_hora) BETWEEN ? AND ?
      AND empleado_id IS NOT NULL
    ORDER BY empleado_id, fecha
  `, [fechaDesde, fechaHasta]);

  let procesadas = 0;

  for (const emp of empleados) {
    const { empleado_id, fecha } = emp;

    // Obtener todas las marcas del día ordenadas
    const [marcas] = await db.query(`
      SELECT fecha_hora
      FROM registros_asistencia
      WHERE empleado_id = ? AND DATE(fecha_hora) = ?
      ORDER BY fecha_hora ASC
    `, [empleado_id, fecha]);

    if (marcas.length === 0) continue;

    const entrada_real = marcas[0].fecha_hora;
    const salida_real = marcas.length > 1 ? marcas[marcas.length - 1].fecha_hora : null;

    // Buscar turno asignado para esa fecha
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

    // Si no tiene turno asignado, continuar
    if (!turno) {
      continue;
    }

    // Verificar si es día laborable
    let esLaboral = true;
    try {
      if (turno.config_json) {
        const conf = JSON.parse(turno.config_json);
        const diaSemana = new Date(fecha).getDay();
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
    } else if (entrada_real > new Date(horaInicio.getTime() + turno.tolerancia_entrada_minutos * 60000)) {
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
    `, [empleado_id, fecha, turno.turno_id, entrada_real, salida_real, estado, minutos_retraso]);

    procesadas++;
  }

  return procesadas;
}

// === Función principal para búsqueda histórica ===
async function syncHistoricalBiometricLogs(fechaDesde, fechaHasta) {
  try {

    const allEvents = [];

    // Buscar eventos en todos los dispositivos
    for (const dev of devices) {
      try {
        const evs = await fetchHistoricalEvents(dev, fechaDesde, fechaHasta);
        allEvents.push(...evs);
      } catch (err) {
        console.error(`Error en dispositivo ${dev.ip}:`, err.message);
      }
    }

    if (allEvents.length === 0) {
      return { success: true, message: 'No se encontraron eventos', eventos: 0, procesados: 0 };
    }

    // Guardar eventos
    const { insertados, duplicados } = await saveHistoricalEvents(allEvents);

    // Procesar asistencias
    const procesadas = await processHistoricalAttendance(fechaDesde, fechaHasta);
    return {
      success: true,
      message: 'Sincronización histórica completada',
      eventos: insertados,
      duplicados: duplicados,
      asistencias: procesadas
    };

  } catch (err) {
    console.error('Error en sincronización histórica:', err.message);
    return {
      success: false,
      message: `Error: ${err.message}`,
      eventos: 0,
      asistencias: 0
    };
  }
}

// === Ejecución desde línea de comandos ===
if (require.main === module) {
  const args = process.argv.slice(2);

  if (args.length < 2) {
    process.exit(1);
  }

  const [fechaDesde, fechaHasta] = args;

  syncHistoricalBiometricLogs(fechaDesde, fechaHasta)
    .then(result => {
      if (result.success) {
        process.exit(0);
      } else {
        process.exit(1);
      }
    })
    .catch(err => {
      console.error('Error fatal:', err);
      process.exit(1);
    });
}

module.exports = { syncHistoricalBiometricLogs };