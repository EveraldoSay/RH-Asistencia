const express = require("express");
const axios = require("axios");
const router = express.Router();
const db = require('../db.js');
const { requireAuth, requireRRHHorJefe } = require('../middlewares/auth.js');
const { plantillaAsignacionNormal, plantillaAsignacionReemplazo } = require('../services/emailTemplates.js');
const { sendEmail } = require('../services/email.service.js');

//  OBTENER MARCAJES POR EMPLEADO 
router.get("/marcajes/:empleadoId", async (req, res) => {
  const { empleadoId } = req.params;

  try {
    // Buscar el employeeNoString del biometrico desde la BD
    const [[emp]] = await db.query(
      "SELECT id, nombre_completo, id_dispositivo FROM empleados WHERE id = ?",
      [empleadoId]
    );

    if (!emp) {
      return res.status(404).json({ success: false, error: "Empleado no encontrado en la BD" });
    }
    if (!emp.id_dispositivo) {
      return res.status(400).json({ success: false, error: "Empleado no tiene id_dispositivo asignado" });
    }

    // Consultar eventos del biometrico
    const { data } = await axios.get(
      `http://${BIOMETRICO_HOST}/ISAPI/AccessControl/AcsEvent?format=json`,
      { auth: { username: BIOMETRICO_USER, password: BIOMETRICO_PASS } }
    );

    const lista = data?.AcsEvent?.InfoList || [];

    // Filtrar por el id_dispositivo
    const filtrados = lista.filter(
      (e) => e.employeeNoString === String(emp.id_dispositivo)
    );

    res.json({
      success: true,
      empleado: emp.nombre_completo,
      id_bd: emp.id,
      id_dispositivo: emp.id_dispositivo,
      total: filtrados.length,
      marcajes: filtrados.map((m) => ({
        fecha_hora: m.time,
        evento: m.attendanceStatus,
        dispositivo: m.cardReaderNo,
        nombre: m.name
      })),
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: "Error consultando biométrico",
      message: err.message,
    });
  }
});

// ========================= GENERAR CALENDARIO DE ASIGNACIONES ROTATIVAS =========================
router.post("/generar-calendario", async (req, res) => {
  try {
    const { empleados_ids, fecha_inicio, fecha_fin, tipo_turno, configuracion_personalizada } = req.body;

    // Lógica para generar calendario
    const calendario = await generarCalendarioRotativo(
      empleados_ids,
      fecha_inicio,
      fecha_fin,
      tipo_turno,
      configuracion_personalizada
    );

    res.json({ success: true, data: { calendario } });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ========================= OBTENER CALENDARIO DE ASIGNACIONES DE UN EMPLEADO =========================
router.get('/empleado/:id/calendario', requireAuth, async (req, res) => {
  const { id } = req.params;
  const { mes, año } = req.query;
  if (!id || !mes || !año) {
    return res.status(400).json({ success: false, message: 'Faltan parámetros' });
  }

  try {
    const [rows] = await db.query(
      `SELECT a.fecha_inicio, a.fecha_fin, a.turno_id, 
              t.nombre_turno, t.hora_inicio, t.hora_fin
      FROM asignacion_turnos a
      JOIN turnos t ON a.turno_id = t.id
      WHERE a.empleado_id = ? 
        AND (
          (YEAR(a.fecha_inicio) = ? AND MONTH(a.fecha_inicio) = ?)
          OR
          (YEAR(a.fecha_fin) = ? AND MONTH(a.fecha_fin) = ?)
        )`,
      [id, año, mes, año, mes]
    );

    // Expandir rangos
    const asignaciones = [];
    rows.forEach(r => {
      let f = new Date(r.fecha_inicio);
      const fin = new Date(r.fecha_fin);
      while (f <= fin) {
        asignaciones.push({
          fecha: f.toISOString().split("T")[0],
          turno_id: r.turno_id,
          nombre_turno: r.nombre_turno,
          hora_inicio: r.hora_inicio,
          hora_fin: r.hora_fin
        });
        f.setDate(f.getDate() + 1);
      }
    });

    res.json({ success: true, data: asignaciones });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Error al obtener calendario', error: err.message });
  }
});

// ========================= FUNCIONES AUXILIARES =========================
async function generarCalendarioRotativo(empleadosIds, fechaInicio, fechaFin, tipoTurno, config) {
  const calendario = [];
  const fechaInicioObj = new Date(fechaInicio);
  const fechaFinObj = new Date(fechaFin);

  let fechaActual = new Date(fechaInicioObj);

  while (fechaActual <= fechaFinObj) {
    for (const empleadoId of empleadosIds) {
      const diaTrabajo = {
        fecha: fechaActual.toISOString().split('T')[0],
        empleado_id: empleadoId,
        turno_id: null, // Se asignará después
        hora_entrada: '08:00', // Por defecto
        hora_salida: '16:00', // Por defecto
        necesita_reemplazo: false,
        estado: 'ASIGNADO'
      };

      // Aplicar lógica según tipo de turno
      if (tipoTurno === '24x72') {
        // Lógica para turnos 24x72
      } else if (tipoTurno === '12x36') {
        // Lógica para turnos 12x36
      }

      calendario.push(diaTrabajo);
    }

    fechaActual.setDate(fechaActual.getDate() + 1);
  }

  return calendario;
}

async function buscarEmpleadosDisponiblesParaReemplazo(fecha, turnoId = null) {
  const [empleados] = await db.query(`
        SELECT 
          e.id,
          e.nombre_completo,
          e.email,
          e.rol_id,
          e.area_id,
          ar.nombre_area
        FROM empleados e
        LEFT JOIN areas ar ON e.area_id = ar.id
        WHERE e.activo = 1
          -- 🔸 No debe tener asignaciones que cubran la fecha seleccionada
          AND e.id NOT IN (
            SELECT a.empleado_id
            FROM asignacion_turnos a
            WHERE ? BETWEEN a.fecha_inicio AND a.fecha_fin
              AND a.eliminado_en IS NULL
          )
          -- 🔸 Solo empleados sin área o sin asignación vigente
          AND (e.area_id IS NULL OR e.area_id = 0)
        ORDER BY e.nombre_completo ASC
      `, [fecha]);

  return empleados;
}

async function actualizarAreaEmpleados(empleadosIds, areaId, conn) {
  if (!empleadosIds || empleadosIds.length === 0 || !areaId) {
    console.warn('⚠️ No hay empleados o área para actualizar');
    return;
  }

  try {
    const placeholders = empleadosIds.map(() => '?').join(',');
    const [result] = await conn.query(
      `UPDATE empleados SET area_id = ? WHERE id IN (${placeholders})`,
      [areaId, ...empleadosIds]
    );

  } catch (error) {
    console.error('❌ Error actualizando área de empleados:', error);
    throw error;
  }
}

// ========================= ASIGNACIONES MASIVAS (BULK) =========================
router.post('/bulk', requireAuth, async (req, res) => {
  let conn;
  try {
    const { asignaciones, actor_id, area_id: areaDesdeFrontend } = req.body;


    if (!asignaciones?.length) {
      return res.status(400).json({ success: false, message: "No se recibieron asignaciones." });
    }

    conn = await db.getConnection();
    await conn.beginTransaction();


    // Obtener área y jefe desde el primer empleado
    const primerEmpleadoId = asignaciones[0]?.empleado_id;

    const [[empArea]] = await db.query(`
            SELECT e.area_id, a.nombre_area
            FROM empleados e
            LEFT JOIN areas a ON e.area_id = a.id
            WHERE e.id = ?;
          `, [primerEmpleadoId]);

    const area_id = areaDesdeFrontend || empArea?.area_id || null;
    const nombreArea = empArea?.nombre_area || 'Sin área';

    if (!area_id) {
      throw new Error(`No se pudo determinar el área (empleado ${primerEmpleadoId} no tiene área asignada y no se envió area_id).`);
    }


    const [[jefeData]] = await db.query(`
          SELECT e.id AS jefe_id, e.nombre_completo AS jefe_nombre
          FROM area_supervisores s
          JOIN empleados e ON e.id = s.empleado_id
          WHERE s.area_id = ? AND s.es_titular = 1
          LIMIT 1;
        `, [area_id]);

    const jefe_id = jefeData?.jefe_id || null;

    // Fechas y turno base
    const primeraAsig = asignaciones[0];
    const turno_id = primeraAsig?.turno_id || null;
    const fecha_inicio = primeraAsig?.fecha_inicio || null;
    const fecha_fin = primeraAsig?.fecha_fin || null;
    const dias_descanso = primeraAsig?.dias_descanso || [];
    const patron = primeraAsig?.patron || 'NORMAL';

    // ========================= CREAR LOTE DE ASIGNACIÓN =========================
    const [loteResult] = await conn.query(`
          INSERT INTO asignaciones_lote (area_id, jefe_id, turno_id, fecha_inicio, fecha_fin, patron, dias_descanso, creado_por)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `, [
      area_id, jefe_id, turno_id, fecha_inicio, fecha_fin,
      patron, dias_descanso?.join(',') || null, actor_id
    ]);

    const lote_id = loteResult.insertId;
    // ========================= INSERTAR ASIGNACIONES ROTATIVAS =========================
    for (const asig of asignaciones) {
      await conn.query(`
            INSERT IGNORE INTO asignacion_turnos 
              (empleado_id, turno_id, fecha_inicio, fecha_fin, creado_por, lote_id)
            VALUES (?, ?, ?, ?, ?, ?)
          `, [
        asig.empleado_id,
        asig.turno_id,
        asig.fecha_inicio,
        asig.fecha_fin,
        actor_id,
        lote_id
      ]);

    }

    // ========================= ENVÍO DE CORREOS =========================
    const empleadosMap = new Map();

    for (const asig of asignaciones) {
      if (!empleadosMap.has(asig.empleado_id)) empleadosMap.set(asig.empleado_id, []);
      empleadosMap.get(asig.empleado_id).push(asig);
    }

    for (const [empleado_id, asignacionesEmpleado] of empleadosMap.entries()) {
      try {
        if (req.isReemplazo || req.fromFijos) {
          continue;
        }

        // Obtener datos del empleado
        const [[emp]] = await db.query(`
              SELECT e.nombre_completo AS empleado_nombre, e.email, ar.nombre_area AS area_nombre
              FROM empleados e
              LEFT JOIN areas ar ON e.area_id = ar.id
              WHERE e.id = ?;
            `, [empleado_id]);

        const [[jefe]] = await db.query(`
              SELECT es.nombre_completo AS jefe_nombre
              FROM area_supervisores s
              JOIN empleados es ON es.id = s.empleado_id
              WHERE s.area_id = ? AND s.es_titular = 1
              LIMIT 1;
            `, [area_id]);

        const turnosIds = asignacionesEmpleado.map(a => a.turno_id);
        const placeholdersTurnos = turnosIds.map(() => '?').join(',');
        const [turnos] = await db.query(
          `SELECT id, nombre_turno, hora_inicio, hora_fin FROM turnos WHERE id IN (${placeholdersTurnos})`,
          turnosIds
        );

        const listaTurnosHTML = asignacionesEmpleado.map(a => {
          const turno = turnos.find(t => t.id === a.turno_id);
          return `
                <tr>
                  <td>${a.fecha_inicio}</td>
                  <td>${turno?.nombre_turno || '—'}</td>
                  <td>${turno?.hora_inicio || '—'} - ${turno?.hora_fin || '—'}</td>
                </tr>`;
        }).join('');

        const htmlMensaje = `
              <div style="font-family: Arial, sans-serif; color: #333;">
                <h2>📅 Nuevos turnos rotativos asignados</h2>
                <p>Hola <strong>${emp.empleado_nombre}</strong>,</p>
                <p>Se te ha asignado a nuevos turnos en el área <strong>${emp.area_nombre || 'Sin área'}</strong>.</p>
                <table border="1" cellpadding="6" cellspacing="0" style="border-collapse:collapse; margin-top:1rem; width:100%;">
                  <thead style="background:#f3f3f3;">
                    <tr><th>Fecha</th><th>Turno</th><th>Horario</th></tr>
                  </thead>
                  <tbody>${listaTurnosHTML}</tbody>
                </table>
                <p style="margin-top:1rem;"><strong>Jefe responsable:</strong> ${jefe?.jefe_nombre || 'No asignado'}</p>
                <hr>
                <small>Hospital Regional de Occidente<br>Sistema de Gestión de Asistencia</small>
              </div>`;
        await sendEmail(emp.email, '📅 Nuevos turnos rotativos asignados', htmlMensaje);
      } catch (err) {
        console.error('❌ Error enviando correo agrupado:', err.message);
      }
    }

    // ========================= CONFIGURACIÓN ROTATIVA =========================
    const empleadosIds = [...new Set(asignaciones.map(a => a.empleado_id))];
    const configuracionJSON = JSON.stringify({
      rango_fechas: { inicio: fecha_inicio, fin: fecha_fin },
      dias_descanso,
      patron
    });

    const [existe] = await db.query(`
          SELECT id FROM configuraciones_turnos
          WHERE tipo = 'ROTATIVO'
            AND area_id = ?
            AND jefe_id = ?
            AND turno_id = ?
            AND DATE(fecha_inicio) = ?
            AND DATE(fecha_fin) = ?
            AND activo = 1
          LIMIT 1;
        `, [area_id, jefe_id, turno_id, fecha_inicio, fecha_fin]);

    if (existe.length === 0) {
      await db.query(`
            INSERT INTO configuraciones_turnos 
              (tipo, nombre_configuracion, area_id, jefe_id, turno_id, empleados_ids, configuracion, fecha_inicio, fecha_fin, activo, creado_por)
            VALUES (
              'ROTATIVO',
              ?,
              ?, ?, ?, 
              JSON_ARRAY(${empleadosIds.join(',')}),
              ?, ?, ?, 1, ?
            )
          `, [
        `Turno rotativo - Área ${nombreArea}`,
        area_id,
        jefe_id,
        turno_id,
        configuracionJSON,
        fecha_inicio,
        fecha_fin,
        actor_id
      ]);
    }

    await conn.commit();

    res.json({
      success: true,
      message: "Asignaciones rotativas guardadas, correos enviados y configuración registrada correctamente."
    });

  } catch (error) {
    if (conn) await conn.rollback();
    console.error("Error en /bulk:", error);
    res.status(500).json({ success: false, message: error.message });
  } finally {
    if (conn) conn.release();
  }
});

// ========================= ASIGNAR TURNOS FIJOS (VERSIÓN MEJORADA) =========================
router.post('/fijos', requireAuth, async (req, res) => {
  let { area_id, jefe_id, turno_id, empleados, empleados_ids, dias_descanso } = req.body;

  // Unificar formato entre 'empleados' y 'empleados_ids'
  if (!empleados && Array.isArray(empleados_ids)) {
    empleados = empleados_ids.map(id => ({ id }));
  }

  // Normalizar los días de descanso (puede venir como string)
  if (typeof dias_descanso === 'string') {
    dias_descanso = dias_descanso.split(',').map(d => d.trim());
  }

  // Validaciones iniciales
  if (!area_id || !jefe_id || !turno_id || !Array.isArray(empleados) || empleados.length === 0) {
    console.warn('Datos incompletos recibidos en /fijos:', req.body);
    return res.status(400).json({
      success: false,
      message: 'Debe seleccionar el área, jefe, turno fijo y al menos un empleado.'
    });
  }

  let conn;
  try {
    conn = await db.getConnection();

    // Configurar timeout más alto para la transacción
    await conn.query('SET SESSION innodb_lock_wait_timeout = 120'); // 120 segundos

    await conn.beginTransaction();

    const creadorId = req.user?.id ?? null;
    const creadorUsuario = req.user?.username || req.user?.preferred_username || 'keycloak_user';

    // ========================= Definir fechas de vigencia =========================
    const fechaInicio = new Date(); // Hoy
    const fechaFin = new Date();
    fechaFin.setFullYear(fechaInicio.getFullYear() + 1); // Un año de vigencia

    // ========================= ACTUALIZAR ÁREA DE LOS EMPLEADOS =========================
    const empleadosIds = empleados.map(e => e.id);

    // Incluir también al jefe si no está en la lista
    if (!empleadosIds.includes(jefe_id)) {
      empleadosIds.push(jefe_id);
    }

    await actualizarAreaEmpleados(empleadosIds, area_id, conn);

    // ========================= Crear registro del lote =========================
    const [loteResult] = await conn.query(
      `INSERT INTO asignaciones_lote 
            (area_id, jefe_id, turno_id, fecha_inicio, fecha_fin, patron, dias_descanso, creado_por)
          VALUES (?, ?, ?, ?, ?, 'NORMAL', ?, ?)`,
      [area_id, jefe_id, turno_id, fechaInicio, fechaFin, dias_descanso?.join(',') || null, creadorId]
    );

    const loteId = loteResult.insertId;

    // ========================= Insertar asignaciones base =========================
    const placeholders = empleados.map(() => '(?, ?, ?, ?, ?, ?)').join(',');
    const values = empleados.flatMap(emp => [
      emp.id,
      turno_id,
      fechaInicio,
      fechaFin,
      creadorId,
      loteId
    ]);

    await conn.query(
      `INSERT IGNORE INTO asignacion_turnos 
            (empleado_id, turno_id, fecha_inicio, fecha_fin, creado_por, lote_id)
          VALUES ${placeholders}`,
      values
    );

    // ========================= Registrar configuración global =========================
    // PRIMERO: Obtener el nombre del área para la configuración
    const [[areaInfo]] = await conn.query(
      `SELECT nombre_area FROM areas WHERE id = ?`,
      [area_id]
    );

    const nombreArea = areaInfo?.nombre_area || area_id;
    const configuracionJSON = JSON.stringify({
      dias_descanso: dias_descanso || [],
      rango: {
        inicio: fechaInicio.toISOString().split('T')[0],
        fin: fechaFin.toISOString().split('T')[0]
      }
    });

    // Insertar en configuraciones_turnos usando la misma conexión
    await conn.query(`
          INSERT INTO configuraciones_turnos 
            (tipo, nombre_configuracion, area_id, jefe_id, turno_id, empleados_ids, configuracion, fecha_inicio, fecha_fin, activo, creado_por)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)
        `, [
      'FIJO',
      `Turno fijo - Área ${nombreArea}`,
      area_id,
      jefe_id,
      turno_id,
      JSON.stringify(empleadosIds),
      configuracionJSON,
      fechaInicio,
      fechaFin,
      creadorId
    ]);

    await conn.commit();

    // ========================= Enviar correos (FUERA DE LA TRANSACCIÓN) =========================
    const resultadosCorreos = await enviarCorreosTurnoFijo(empleadosIds, area_id, fechaInicio, fechaFin, dias_descanso);

    // ========================= Registrar en bitácora =========================
    await db.query(
      `INSERT INTO audit_log (evento, entidad, entidad_id, actor_id, actor_username, ip, user_agent)
          VALUES ('CREATE', 'asignaciones_lote', ?, ?, ?, ?, ?)`,
      [loteId, creadorId, creadorUsuario, req.ip || null, req.headers['user-agent'] || null]
    );

    res.json({
      success: true,
      message: `Turnos fijos asignados correctamente.`,
      lote_id: loteId,
      total_empleados: empleadosIds.length,
      resultadosCorreos
    });

  } catch (error) {
    if (conn) {
      try {
        await conn.rollback();
      } catch (rollbackError) {
        console.error('Error durante rollback:', rollbackError);
      }
    }

    console.error('Error en /fijos:', error);
    res.status(500).json({
      success: false,
      message: 'Error al asignar turnos fijos',
      error: error.message
    });
  } finally {
    if (conn) {
      try {
        conn.release();
      } catch (releaseError) {
        console.error('Error liberando conexión:', releaseError);
      }
    }
  }
});

// ========================= FUNCIÓN AUXILIAR PARA ENVIAR CORREOS =========================
async function enviarCorreosTurnoFijo(empleadosIds, area_id, fechaInicio, fechaFin, dias_descanso) {
  const resultadosCorreos = [];

  for (const empId of empleadosIds) {
    try {
      const [[infoEmpleado]] = await db.query(`
            SELECT e.nombre_completo, e.email, ar.nombre_area AS area_nombre
            FROM empleados e
            LEFT JOIN areas ar ON e.area_id = ar.id
            WHERE e.id = ?`, [empId]);

      if (infoEmpleado?.email) {
        const htmlMensaje = `
              <div style="font-family: Arial, sans-serif; color: #333;">
                <h2>📅 Turno fijo asignado</h2>
                <p>Hola <strong>${infoEmpleado.nombre_completo}</strong>,</p>
                <p>Se te ha asignado un turno fijo en el área 
                  <strong>${infoEmpleado.area_nombre || 'Sin área'}</strong>.</p>
                <p>Vigencia: ${fechaInicio.toLocaleDateString()} — ${fechaFin.toLocaleDateString()}</p>
                <p>Días de descanso: <strong>${dias_descanso?.length ? dias_descanso.join(', ') : 'Ninguno'}</strong></p>
                <hr>
                <small>Hospital Regional de Occidente<br>
                Sistema de Gestión de Asistencia</small>
              </div>
            `;
        const enviado = await sendEmail(
          infoEmpleado.email,
          '📅 Turno fijo asignado',
          htmlMensaje
        );
        resultadosCorreos.push({ empleado_id: empId, correo: infoEmpleado.email, enviado });
      } else {
        resultadosCorreos.push({ empleado_id: empId, correo: null, enviado: false });
      }
    } catch (err) {
      console.error(`Error enviando correo a empleado ${empId}:`, err.message);
      resultadosCorreos.push({ empleado_id: empId, error: err.message });
    }
  }

  return resultadosCorreos;
}

// ========================= EMPLEADOS DISPONIBLES PARA REEMPLAZO (SOLO SIN ÁREA) =========================
router.get("/reemplazos/disponibles", async (req, res) => {
  try {
    const { fecha, turno_id } = req.query;

    if (!fecha) {
      return res.status(400).json({ success: false, message: "Falta la fecha" });
    }

    // 🔹 CORREGIDO: Solo empleados SIN área asignada (area_id IS NULL)
    const [rows] = await db.query(`
          SELECT 
            e.id, 
            e.nombre_completo, 
            e.email, 
            e.rol_id, 
            r.nombre_rol,
            e.area_id, 
            ar.nombre_area
          FROM empleados e
          LEFT JOIN areas ar ON e.area_id = ar.id
          LEFT JOIN roles_empleado r ON e.rol_id = r.id
          WHERE e.activo = 1
            AND e.rol_id IS NOT NULL         -- Con rol asignado
            AND e.area_id IS NULL            -- 🔥 SOLO EMPLEADOS SIN ÁREA ASIGNADA
            AND e.id NOT IN (                -- Que no tengan asignaciones en esa fecha
              SELECT a.empleado_id
              FROM asignacion_turnos a
              WHERE ? BETWEEN a.fecha_inicio AND a.fecha_fin
                AND a.eliminado_en IS NULL
            )
          ORDER BY e.nombre_completo ASC;
        `, [fecha]);

    res.json({ success: true, data: rows });

  } catch (error) {
    console.error("Error en /reemplazos/disponibles:", error.message);
    res.status(500).json({ success: false, message: error.message });
  }
});

// ========================== SOLICITAR REEMPLAZO DE TURNO =========================
router.post("/reemplazos/solicitar", async (req, res) => {
  const conn = await pool.getConnection();
  try {
    const {
      dia_trabajo_id,
      empleado_original_id,
      empleado_reemplazo_id,
      turno_id,
      motivo,
      fechas
    } = req.body;

    if (!empleado_original_id || !empleado_reemplazo_id || !turno_id || !fechas || fechas.length === 0) {
      return res.status(400).json({ ok: false, message: "Faltan datos para crear el reemplazo." });
    }

    ("Iniciando solicitud de reemplazo para fechas:", fechas);
    req.isReemplazo = true;

    await conn.beginTransaction();

    // 🔹 Obtener información de la persona que será reemplazada
    const [reemplazadoData] = await conn.query(
      `SELECT id, nombre_completo, email, area_id 
          FROM empleados 
          WHERE id = ?`,
      [empleado_original_id]
    );

    const reemplazado = reemplazadoData[0] || null;

    // 🔹 Obtener información del reemplazo
    const [reemplazoData] = await conn.query(
      `SELECT id, nombre_completo, email, area_id 
          FROM empleados 
          WHERE id = ?`,
      [empleado_reemplazo_id]
    );

    const reemplazo = reemplazoData[0] || null;

    // 🔹 Obtener datos del turno
    const [turnoData] = await conn.query(
      `SELECT id, nombre_turno, hora_inicio, hora_fin 
          FROM turnos 
          WHERE id = ?`,
      [turno_id]
    );

    const turno = turnoData[0] || null;

    if (!reemplazo || !turno) {
      await conn.rollback();
      return res.status(400).json({ ok: false, message: "No se encontró información válida para el reemplazo o turno." });
    }

    // 🔹 Insertar las asignaciones (una por fecha)
    for (const fecha of fechas) {
      await conn.query(
        `INSERT INTO asignacion_turnos (
              empleado_id, turno_id, fecha_inicio, fecha_fin, creado_por, es_reemplazo
            ) VALUES (?, ?, ?, ?, ?, 1)`,
        [empleado_reemplazo_id, turno_id, fecha, fecha, req.user?.id || null]
      );
    }

    await conn.commit();

    (`Reemplazo asignado correctamente: ${reemplazo.nombre_completo} cubre a ${reemplazado?.nombre_completo || "Empleado desconocido"}`);
    return res.json({ ok: true, message: "Reemplazo asignado correctamente." });

  } catch (error) {
    console.error("Error en /reemplazos/solicitar:", error);
    await conn.rollback();
    return res.status(500).json({ ok: false, message: "Error al asignar el reemplazo.", error: error.message });
  } finally {
    conn.release();
  }
});

// =================== OBTENER ASIGNACIONES EXISTENTES DE UN EMPLEADO ===================
router.get('/empleado/:id', requireAuth, async (req, res) => {
  const { id } = req.params;
  const { desde, hasta } = req.query;

  if (!id || !desde || !hasta) {
    return res.status(400).json({
      success: false,
      message: 'Faltan parámetros (id, desde, hasta)',
    });
  }

  try {
    const [rows] = await db.query(
      `SELECT a.id, a.empleado_id, a.turno_id, 
                  a.fecha_inicio, a.fecha_fin,
                  t.nombre_turno, t.hora_inicio, t.hora_fin
          FROM asignacion_turnos a
          INNER JOIN turnos t ON t.id = a.turno_id
          WHERE a.empleado_id = ?
            AND a.fecha_inicio BETWEEN ? AND ?
            AND a.eliminado_en IS NULL`,
      [id, desde, hasta]
    );

    // Expandir días dentro de los rangos
    const asignaciones = [];
    rows.forEach(r => {
      let f = new Date(r.fecha_inicio);
      const fin = new Date(r.fecha_fin);
      while (f <= fin) {
        asignaciones.push({
          fecha: f.toISOString().split('T')[0],
          turno_id: r.turno_id,
          nombre_turno: r.nombre_turno,
          hora_inicio: r.hora_inicio,
          hora_fin: r.hora_fin
        });
        f.setDate(f.getDate() + 1);
      }
    });

    res.json({ success: true, asignaciones });
  } catch (error) {
    console.error('Error al obtener asignaciones:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener asignaciones del empleado',
      error: error.message,
    });
  }
});

// ========================= OBTENER EMPLEADOS DISPONIBLES PARA ASIGNACIÓN =========================
router.get('/empleados/disponibles/:areaId', requireAuth, async (req, res) => {
  try {
    const { areaId } = req.params;

    const [rows] = await db.query(`
          SELECT 
            e.id,
            e.nombre_completo,
            e.email,
            e.rol_id,
            r.nombre_rol AS rol_nombre,
            e.area_id,
            a.nombre_area AS area_nombre,

            -- Marcar si el empleado tiene asignación activa
            CASE 
              WHEN EXISTS (
                SELECT 1 FROM asignacion_turnos at
                WHERE at.empleado_id = e.id
                  AND at.eliminado_en IS NULL
                  AND CURDATE() BETWEEN at.fecha_inicio AND at.fecha_fin
              ) THEN 1
              ELSE 0
            END AS ocupado,

            -- Estado de selección: 1 = seleccionable, 0 = no seleccionable
            CASE 
              WHEN e.rol_id IS NULL THEN 0                          -- Sin rol → no seleccionable
              WHEN e.area_id IS NULL THEN 1                         -- Sin área → disponible
              WHEN e.area_id = ? THEN 1                             -- Misma área → disponible
              WHEN e.area_id <> ? AND EXISTS (                      -- Otra área
                  SELECT 1 FROM asignacion_turnos at
                  WHERE at.empleado_id = e.id
                    AND at.eliminado_en IS NULL
                    AND CURDATE() BETWEEN at.fecha_inicio AND at.fecha_fin
              ) THEN 0                                              -- Ocupado en otra área → no seleccionable
              ELSE 1                                                -- Otra área pero sin asignación activa → disponible
            END AS seleccionable

          FROM empleados e
          LEFT JOIN roles_empleado r ON e.rol_id = r.id
          LEFT JOIN areas a ON e.area_id = a.id
          WHERE e.activo = 1
            AND e.rol_id IS NOT NULL          -- Solo empleados con rol asignado
          ORDER BY e.nombre_completo ASC;
        `, [areaId, areaId]);

    res.json({ success: true, data: rows });
  } catch (err) {
    console.error('Error al obtener empleados disponibles:', err);
    res.status(500).json({ message: 'Error al obtener empleados disponibles', error: err.message });
  }
});

// ========================= RENOVAR TURNOS ROTATIVOS (SIGUIENTE MES) =========================
router.post('/renovar-rotativos', requireAuth, async (req, res) => {
  const { area_id, mes_actual, anio_actual } = req.body;

  if (!area_id || !mes_actual || !anio_actual) {
    return res.status(400).json({
      success: false,
      message: 'Faltan parámetros: area_id, mes_actual, anio_actual son requeridos.'
    });
  }

  let conn;
  try {
    conn = await db.getConnection();
    await conn.beginTransaction();

    ('Renovando turnos rotativos para área:', area_id, 'Mes:', mes_actual, 'Año:', anio_actual);

    // 🔹 Calcular fechas del próximo mes
    const nuevoMes = mes_actual == 12 ? 1 : mes_actual + 1;
    const nuevoAnio = mes_actual == 12 ? anio_actual + 1 : anio_actual;

    const fechaInicioNuevo = new Date(nuevoAnio, nuevoMes - 1, 1);
    const fechaFinNuevo = new Date(nuevoAnio, nuevoMes, 0);

    // 🔹 Buscar asignaciones actuales de este mes y área
    const [asignaciones] = await conn.query(`
          SELECT a.empleado_id, a.turno_id, t.nombre_turno, t.hora_inicio, t.hora_fin
          FROM asignacion_turnos a
          JOIN turnos t ON a.turno_id = t.id
          JOIN empleados e ON e.id = a.empleado_id
          WHERE e.area_id = ?
            AND MONTH(a.fecha_inicio) = ?
            AND YEAR(a.fecha_inicio) = ?
            AND t.tipo_turno = 'ROTATIVO'
            AND a.eliminado_en IS NULL
          GROUP BY a.empleado_id, a.turno_id
        `, [area_id, mes_actual, anio_actual]);

    if (asignaciones.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'No se encontraron turnos rotativos en el mes actual para esta área.'
      });
    }

    // 🔹 Crear nuevas asignaciones para el próximo mes
    for (const a of asignaciones) {
      await conn.query(`
            INSERT INTO asignacion_turnos (empleado_id, turno_id, fecha_inicio, fecha_fin, creado_por)
            VALUES (?, ?, ?, ?, ?)
          `, [a.empleado_id, a.turno_id, fechaInicioNuevo, fechaFinNuevo, req.user?.id || null]);
    }

    await conn.commit();

    (`Se generaron ${asignaciones.length} nuevas asignaciones rotativas para el mes ${nuevoMes}/${nuevoAnio}`);

    // 🔹 Registrar evento en bitácora
    await db.query(`
          INSERT INTO audit_log (evento, entidad, entidad_id, actor_id, actor_username)
          VALUES ('CREATE', 'renovacion_rotativos', NULL, ?, ?)
        `, [req.user?.id || null, req.user?.preferred_username || 'sistema']);

    // 🔹 Enviar correo a cada empleado
    for (const a of asignaciones) {
      try {
        const [[emp]] = await db.query(`SELECT nombre_completo, email FROM empleados WHERE id = ?`, [a.empleado_id]);
        if (emp?.email) {
          const html = `
                <div style="font-family: Arial, sans-serif; color: #333;">
                  <h2>Renovación de turno rotativo</h2>
                  <p>Hola <strong>${emp.nombre_completo}</strong>,</p>
                  <p>Tu turno <strong>${a.nombre_turno}</strong> se ha renovado automáticamente para el mes de 
                  <strong>${nuevoMes}/${nuevoAnio}</strong>.</p>
                  <p>Horario: ${a.hora_inicio} - ${a.hora_fin}</p>
                  <hr><small>Hospital Regional de Occidente — Sistema de Asistencia</small>
                </div>`;
          await sendEmail(emp.email, 'Renovación de turnos rotativos', html);
        }
      } catch (err) {
        console.warn('No se pudo enviar correo a empleado', a.empleado_id, err.message);
      }
    }

    res.json({
      success: true,
      message: `Turnos rotativos renovados correctamente para ${nuevoMes}/${nuevoAnio}`,
      total_asignaciones: asignaciones.length
    });

  } catch (error) {
    if (conn) await conn.rollback();
    console.error('Error en /renovar-rotativos:', error);
    res.status(500).json({ success: false, message: error.message });
  } finally {
    if (conn) conn.release();
  }
});

// ========================= RESUMEN DE TURNOS - MEJORADO =========================
router.get('/resumen', async (req, res) => {
  try {
    ('Generando resumen de asignaciones...');

    // TURNOS FIJOS: Asignaciones que no tienen fecha fin o son permanentes
    const [[{ fijos }]] = await db.query(`
            SELECT COUNT(DISTINCT a.id) AS fijos
            FROM asignacion_turnos a
            WHERE a.eliminado_en IS NULL
              AND (a.fecha_fin IS NULL OR a.fecha_fin > CURDATE())
              AND a.fecha_inicio <= CURDATE()
              AND NOT EXISTS (
                SELECT 1 FROM turnos t 
                WHERE t.id = a.turno_id 
                AND t.tipo_turno = 'ROTATIVO'
              )
          `);

    // TURNOS ROTATIVOS: Asignaciones con tipo rotativo y vigentes
    const [[{ rotativos }]] = await db.query(`
            SELECT COUNT(DISTINCT a.id) AS rotativos
            FROM asignacion_turnos a
            JOIN turnos t ON t.id = a.turno_id
            WHERE a.eliminado_en IS NULL
              AND t.tipo_turno = 'ROTATIVO'
              AND CURDATE() BETWEEN a.fecha_inicio AND a.fecha_fin
          `);

    // ASIGNACIONES ACTIVAS HOY (para el total de "Turnos Hoy")
    const [[{ activos_hoy }]] = await db.query(`
            SELECT COUNT(DISTINCT a.id) AS activos_hoy
            FROM asignacion_turnos a
            WHERE a.eliminado_en IS NULL
              AND CURDATE() BETWEEN a.fecha_inicio AND a.fecha_fin
          `);

    const resultado = {
      fijos: parseInt(fijos) || 0,
      rotativos: parseInt(rotativos) || 0,
      activos_hoy: parseInt(activos_hoy) || 0
    };

    ('Resumen de asignaciones:', resultado);

    res.json({
      success: true,
      data: resultado
    });
  } catch (e) {
    console.error('Error generando resumen de asignaciones:', e);
    res.status(500).json({
      success: false,
      error: 'Error al generar resumen',
      details: e.message
    });
  }
});

// ========================= OBTENER TODAS LAS CONFIGURACIONES DE TURNOS =========================
router.get('/configuraciones', requireAuth, async (req, res) => {
  try {
    const [rows] = await db.query(`
          SELECT 
            c.id,
            c.tipo,
            c.nombre_configuracion,
            c.area_id,
            a.nombre_area AS areaNombre,
            c.jefe_id,
            e.nombre_completo AS jefeNombre,
            c.turno_id,
            t.nombre_turno AS nombreTurno,
            c.empleados_ids,                         -- Incluye los IDs completos
            JSON_LENGTH(c.empleados_ids) AS empleadosCount,
            c.configuracion,
            c.fecha_inicio,
            c.fecha_fin,
            c.creado_en AS fechaCreacion
          FROM configuraciones_turnos c
          LEFT JOIN areas a ON a.id = c.area_id
          LEFT JOIN empleados e ON e.id = c.jefe_id
          LEFT JOIN turnos t ON t.id = c.turno_id
          WHERE c.activo = 1
          ORDER BY c.creado_en DESC;
        `);

    res.json({ success: true, data: rows });
  } catch (err) {
    console.error('Error al obtener configuraciones:', err);
    res.status(500).json({
      success: false,
      message: 'Error al obtener configuraciones',
      error: err.message
    });
  }
});

// ========================= ELIMINAR CONFIGURACIÓN DE TURNOS =========================
router.delete('/configuraciones/:id', requireAuth, async (req, res) => {
  const { id } = req.params;
  try {
    // 1. Obtener información de la configuración antes de eliminar
    const [[conf]] = await db.query(`
      SELECT c.id, c.nombre_configuracion, a.nombre_area, c.empleados_ids, c.turno_id, c.fecha_inicio, c.fecha_fin
      FROM configuraciones_turnos c
      LEFT JOIN areas a ON c.area_id = a.id
      WHERE c.id = ?
    `, [id]);

    if (!conf) {
      return res.status(404).json({ success: false, message: 'Configuración no encontrada' });
    }

    const nombreArea = conf.nombre_area || 'Desconocida';

    // 2. Soft-delete de la configuración
    await db.query('UPDATE configuraciones_turnos SET activo=0 WHERE id=?', [id]);

    // 3. Soft-delete de las asignaciones asociadas en asignacion_turnos
    // Parsear empleados_ids
    let empleadosIds = [];
    try {
      if (typeof conf.empleados_ids === 'string') {
        empleadosIds = JSON.parse(conf.empleados_ids);
      } else if (Array.isArray(conf.empleados_ids)) {
        empleadosIds = conf.empleados_ids;
      }
    } catch (e) {
      console.warn('Error parseando empleados_ids al eliminar:', e);
    }

    if (empleadosIds.length > 0 && conf.turno_id && conf.fecha_inicio && conf.fecha_fin) {
      const placeholders = empleadosIds.map(() => '?').join(',');
      const params = [req.user?.id || null, conf.turno_id, conf.fecha_inicio, conf.fecha_fin, ...empleadosIds];

      await db.query(`
        UPDATE asignacion_turnos 
        SET eliminado_en = NOW(), eliminado_por = ?
        WHERE turno_id = ? 
          AND fecha_inicio = ? 
          AND fecha_fin = ?
          AND eliminado_en IS NULL
          AND empleado_id IN (${placeholders})
      `, params);
    }

    // 4. Registrar en bitácora
    await db.query(
      `INSERT INTO audit_log (evento, entidad, entidad_id, actor_id, actor_username, ip, user_agent)
       VALUES ('DELETE', ?, ?, ?, ?, ?, ?)`,
      [
        `configuraciones_turnos (Área: ${nombreArea})`,
        id,
        req.user?.id || null,
        req.user?.username || req.user?.preferred_username || 'unknown',
        req.ip || null,
        req.headers['user-agent'] || null
      ]
    );

    res.json({ success: true, message: 'Configuración eliminada correctamente' });
  } catch (err) {
    console.error('Error eliminando configuración:', err);
    res.status(500).json({
      success: false,
      message: 'Error al eliminar configuración',
      error: err.message
    });
  }
});


// ========================= OBTENER EMPLEADOS POR IDS =========================
router.post('/empleados/por-ids', async (req, res) => {
  try {
    const { ids } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ success: false, message: "No se enviaron IDs válidos" });
    }

    const placeholders = ids.map(() => '?').join(',');
    const [rows] = await db.query(
      `SELECT e.id, e.nombre_completo, e.email, e.rol_id, e.area_id, r.nombre_rol
       FROM empleados e
       LEFT JOIN roles_empleado r ON e.rol_id = r.id
       WHERE e.id IN (${placeholders})`,
      ids
    );

    res.json({ success: true, data: rows });
  } catch (error) {
    console.error('Error en /empleados/por-ids:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});


module.exports = router;