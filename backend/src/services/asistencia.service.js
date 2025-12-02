const db = require('../db');

async function procesarAsistenciaDia(fecha) {
  // 1. obtener todas las asignaciones del día
  const [asignaciones] = await db.query(`
    SELECT at.id as asig_id, at.empleado_id, at.turno_id, 
           t.hora_inicio, t.hora_fin, 
           t.tolerancia_entrada_minutos, t.tolerancia_salida_minutos,
           t.cruza_medianoche,
           c.configuracion as config_json
    FROM asignacion_turnos at
    JOIN turnos t ON at.turno_id = t.id
    LEFT JOIN configuraciones_turnos c ON c.turno_id = t.id AND c.area_id = (SELECT area_id FROM empleados WHERE id = at.empleado_id)
    WHERE ? BETWEEN at.fecha_inicio AND at.fecha_fin
      AND at.eliminado_en IS NULL
      AND at.empleado_id IS NOT NULL
  `, [fecha]);

  for (const asig of asignaciones) {
    const { empleado_id, turno_id, hora_inicio, hora_fin,
      tolerancia_entrada_minutos, tolerancia_salida_minutos, config_json } = asig;

    // 1.1 Validar días de descanso
    if (config_json) {
      try {
        const conf = JSON.parse(config_json);
        const diaSemana = new Date(fecha).getDay(); // 0=Domingo, 1=Lunes...
        // Backend usa 0=Domingo, 1=Lunes (JS standard)
        if (conf.dias_descanso && conf.dias_descanso.includes(String(diaSemana))) {
          continue; // Es día de descanso, no procesar
        }
      } catch (e) {
        console.warn(`Error parsing config for assignment ${asig.asig_id}`, e);
      }
    }

    // 2. buscar eventos de ese empleado en registros_asistencia
    const eventos = await db.query(`
      SELECT * FROM registros_asistencia
      WHERE empleado_id = ? 
        AND DATE(fecha_hora) = ?
      ORDER BY fecha_hora ASC
    `, [empleado_id, fecha]);

    const entrada = eventos.find(e => e.tipo_evento === 'ENTRADA');
    const salida = [...eventos].reverse().find(e => e.tipo_evento === 'SALIDA');

    // 3. calcular estado
    const entradaEsperada = new Date(`${fecha}T${hora_inicio}`);
    const salidaEsperada = new Date(`${fecha}T${hora_fin}`);

    let estado = 'FALTA';
    let minutos_retraso = 0;
    let minutos_extra = 0;

    if (entrada) {
      const diffMin = Math.floor((entrada.fecha_hora - entradaEsperada) / 60000);
      if (diffMin > tolerancia_entrada_minutos) {
        estado = 'TARDE';
        minutos_retraso = diffMin;
      } else {
        estado = 'COMPLETO'; // provisional
      }
    }

    if (salida) {
      const diffOut = Math.floor((salida.fecha_hora - salidaEsperada) / 60000);
      if (diffOut > tolerancia_salida_minutos) {
        minutos_extra = diffOut;
      }
      if (!entrada) {
        estado = 'INCOMPLETO';
      }
    } else if (entrada) {
      estado = 'INCOMPLETO';
    }

    // 4. guardar en asistencias (upsert)
    await db.query(`
      INSERT INTO asistencias 
        (empleado_id, fecha, turno_id, entrada_real, salida_real, estado, minutos_retraso, minutos_extra)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        entrada_real = VALUES(entrada_real),
        salida_real  = VALUES(salida_real),
        estado       = VALUES(estado),
        minutos_retraso = VALUES(minutos_retraso),
        minutos_extra   = VALUES(minutos_extra)
    `, [
      empleado_id, fecha, turno_id,
      entrada ? entrada.fecha_hora : null,
      salida ? salida.fecha_hora : null,
      estado, minutos_retraso, minutos_extra
    ]);

    // 5. alertas opcionales
    if (estado === 'TARDE' || estado === 'FALTA' || estado === 'INCOMPLETO') {
      await db.query(`
        INSERT INTO alertas (empleado_id, tipo_alerta, descripcion, fecha_hora)
        VALUES (?, ?, ?, NOW())
      `, [
        empleado_id,
        estado,
        `Asistencia irregular el ${fecha} (estado=${estado})`
      ]);
    }
  }
}

module.exports = {
  procesarAsistenciaDia
};
