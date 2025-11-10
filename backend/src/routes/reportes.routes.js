const express = require('express');
const router = express.Router();
const db = require('../db');
const { requireAuth } = require('../middlewares/auth');
const { exec } = require('child_process');
const path = require('path');


  // Listar todas las áreas
  router.get('/areas', requireAuth, async (req, res) => {
    try {
      const [rows] = await db.query(`
        SELECT id, nombre_area FROM areas WHERE eliminado_en IS NULL ORDER BY nombre_area
      `);
      res.json({ success: true, areas: rows });
    } catch (err) {
      console.error('Error obteniendo áreas:', err);
      res.status(500).json({ success: false, message: 'Error al obtener áreas' });
    }
  });

  // GENERAR REPORTE POR ÁREA Y RANGO DE FECHAS
  router.get('/asistencia', requireAuth, async (req, res) => {
    try {
      const { area_id, desde, hasta, tipo_reporte = 'semana' } = req.query;

      if (!area_id || !desde || !hasta) {
        return res.status(400).json({ success: false, message: 'Faltan parámetros: área, desde y hasta son obligatorios.' });
      }

      // ==================== CONSULTA BASE (ROTATIVOS) - VERSIÓN COMPLETA ====================
      const [rotativos] = await db.query(`
        SELECT 
          ar.nombre_area AS area,
          jefe.nombre_completo AS jefe_area,
          e.nombre_completo AS empleado,
          e.renglon,
          re.nombre_rol AS cargo,
          at.fecha_inicio AS fecha,
          t.nombre_turno AS turno_asignado,
          t.tipo_turno,
          DATE_FORMAT(t.hora_inicio, '%H:%i') AS hora_entrada_programada,
          DATE_FORMAT(t.hora_fin, '%H:%i') AS hora_salida_programada,
          a.entrada_real,
          a.salida_real,
          a.estado,
          CASE 
            WHEN e.renglon IN ('182', '189', '186', '183') THEN 'No aplica marcaje'
            WHEN a.estado = 'COMPLETO' THEN 'Cumple horario'
            WHEN a.estado = 'TARDE' THEN 'Retraso'
            WHEN a.estado = 'FALTA' OR a.id IS NULL THEN 'Ausente'
            ELSE 'Ausente'
          END AS cumplimiento,
          CASE 
            WHEN e.renglon IN ('182', '189', '186', '183') THEN 'Presente (No obligatorio)'
            WHEN a.estado IN ('COMPLETO','TARDE') THEN 'Presente'
            WHEN a.estado = 'FALTA' OR a.id IS NULL THEN 'Ausente'
            ELSE 'Ausente'
          END AS estado_dia
        FROM empleados e
        INNER JOIN areas ar ON ar.id = e.area_id
        INNER JOIN roles_empleado re ON re.id = e.rol_id
        LEFT JOIN area_supervisores sup ON sup.area_id = ar.id AND sup.es_titular = 1
        LEFT JOIN empleados jefe ON jefe.id = sup.empleado_id
        LEFT JOIN asignacion_turnos at ON at.empleado_id = e.id AND at.eliminado_en IS NULL
        LEFT JOIN turnos t ON t.id = at.turno_id
        LEFT JOIN asistencias a ON a.empleado_id = e.id AND a.fecha = at.fecha_inicio
        WHERE e.eliminado_en IS NULL
          AND e.activo = 1
          AND ar.id = ?
          AND at.fecha_inicio BETWEEN ? AND ?
        ORDER BY e.nombre_completo, at.fecha_inicio;
      `, [area_id, desde, hasta]);

      let registros = [...rotativos];

      // ==================== CONSULTA TURNOS FIJOS ====================
      const [fijos] = await db.query(`
        SELECT 
          ar.nombre_area AS area,
          jefe.nombre_completo AS jefe_area,
          e.id AS empleado_id,
          e.nombre_completo AS empleado,
          re.nombre_rol AS cargo,
          t.nombre_turno AS turno_asignado,
          t.tipo_turno,
          DATE_FORMAT(t.hora_inicio, '%H:%i') AS hora_entrada_programada,
          DATE_FORMAT(t.hora_fin, '%H:%i') AS hora_salida_programada,
          al.dias_descanso,
          al.fecha_inicio
        FROM asignacion_turnos af
        JOIN turnos t ON af.turno_id = t.id
        JOIN empleados e ON af.empleado_id = e.id
        JOIN areas ar ON e.area_id = ar.id
        LEFT JOIN roles_empleado re ON re.id = e.rol_id
        LEFT JOIN area_supervisores sup ON sup.area_id = ar.id AND sup.es_titular = 1
        LEFT JOIN empleados jefe ON jefe.id = sup.empleado_id
        LEFT JOIN asignaciones_lote al ON al.turno_id = t.id AND al.area_id = ar.id
        WHERE ar.id = ? 
          AND t.tipo_turno = 'FIJO'
          AND af.eliminado_en IS NULL;
      `, [area_id]);

      // ==================== EXPANDIR FECHAS DE FIJOS ====================
      if (fijos.length > 0) {
        const inicio = new Date(desde);
        const fin = new Date(hasta);

        for (const f of fijos) {
          if (!f.empleado_id) continue;
          const diasDescanso = f.dias_descanso ? f.dias_descanso.split(',').map(Number) : [];
          const fechaInicioLote = f.fecha_inicio ? new Date(f.fecha_inicio) : null;

          for (let d = new Date(inicio); d <= fin; d.setDate(d.getDate() + 1)) {
            const diaSemana = d.getDay();
            if (fechaInicioLote && d < fechaInicioLote) continue;
            if (diasDescanso.includes(diaSemana)) continue;

            const [asist] = await db.query(`
              SELECT entrada_real, salida_real, estado 
              FROM asistencias 
              WHERE empleado_id = ? AND fecha = ?`, 
              [f.empleado_id, d.toISOString().split('T')[0]]
            );

            let entrada_real = null;
            let salida_real = null;
            let estado = null;
            if (asist.length > 0) {
              entrada_real = asist[0].entrada_real;
              salida_real = asist[0].salida_real;
              estado = asist[0].estado;
            }

            registros.push({
              area: f.area,
              jefe_area: f.jefe_area,
              empleado: f.empleado,
              cargo: f.cargo,
              fecha: d.toISOString().split('T')[0],
              turno_asignado: f.turno_asignado,
              tipo_turno: f.tipo_turno,
              hora_entrada_programada: f.hora_entrada_programada,
              hora_salida_programada: f.hora_salida_programada,
              entrada_real,
              salida_real,
              cumplimiento: estado ? 
                (estado === 'COMPLETO' ? 'Cumple horario' :
                estado === 'TARDE' ? 'Retraso' :
                estado === 'FALTA' ? 'Ausente' : 'Ausente') 
                : 'No aplica marcaje',
              estado_dia: estado ? 
                (['COMPLETO', 'TARDE'].includes(estado) ? 'Presente' : 'Ausente') 
                : 'Presente (No obligatorio)'
            });
          }
        }
      }

      // ==================== ORDEN FINAL ====================
      registros.sort((a, b) => {
        if (a.empleado < b.empleado) return -1;
        if (a.empleado > b.empleado) return 1;
        return new Date(a.fecha) - new Date(b.fecha);
      });
      res.json({ success: true, registros });

    } catch (err) {
      console.error('Error generando reporte:', err);
      res.status(500).json({ 
        success: false, 
        message: 'Error al generar reporte',
        error: err.message 
      });
    }
  });

  // En reportes.routes.js - modificar la ruta /eventos-biometricos
  router.get('/eventos-biometricos', requireAuth, async (req, res) => {
    try {
      const { mes, dia, empleado_id, desde, hasta } = req.query;
      console.log('Parámetros recibidos para eventos biométricos:', { mes, dia, empleado_id, desde, hasta });

      // Validar que se proporcione al menos un tipo de filtro de fecha
      if (!mes && !dia && !desde) {
        return res.status(400).json({ 
          success: false, 
          message: 'Se requiere al menos un parámetro de fecha: mes, dia o desde/hasta.' 
        });
      }

      let fechaDesde, fechaHasta;
      
      if (desde && hasta) {
        // Filtro por rango de fechas personalizado
        fechaDesde = new Date(desde).toISOString().split('T')[0];
        fechaHasta = new Date(hasta).toISOString().split('T')[0];
        console.log(`Buscando eventos desde ${fechaDesde} hasta ${fechaHasta}`);
      } else if (dia) {
        // Filtro por día específico
        fechaDesde = new Date(dia).toISOString().split('T')[0];
        fechaHasta = fechaDesde;
        console.log(`Buscando eventos para el día específico: ${fechaDesde}`);
      } else {
        // Filtro por mes (comportamiento original)
        const [year, month] = mes.split('-').map(Number);
        fechaDesde = new Date(year, month - 1, 1).toISOString().split('T')[0];
        fechaHasta = new Date(year, month, 0).toISOString().split('T')[0];
        console.log(`Buscando eventos desde ${fechaDesde} hasta ${fechaHasta} (mes completo)`);
      }

      // Construir la consulta dinámicamente
      let query = `
        SELECT 
          ra.id,
          ra.empleado_id,
          e.nombre_completo AS empleado,
          ra.fecha_hora,
          DATE(ra.fecha_hora) AS fecha, 
          TIME(ra.fecha_hora) AS hora,
          ra.dispositivo_ip,
          ra.codigo_evento,
          ra.origen,
          ra.creado_en
        FROM registros_asistencia ra
        LEFT JOIN empleados e ON e.id = ra.empleado_id
        WHERE ra.fecha_hora BETWEEN ? AND ?
      `;
      
      const params = [`${fechaDesde} 00:00:00`, `${fechaHasta} 23:59:59`];

      // Agregar filtro por empleado si se especifica
      if (empleado_id && empleado_id !== '') {
        query += ` AND ra.empleado_id = ?`;
        params.push(empleado_id);
      }

      query += ` ORDER BY e.nombre_completo, ra.fecha_hora ASC`;

      const [rawEventos] = await db.query(query, params);

      console.log(`Total eventos crudos: ${rawEventos.length}`);

      // Agrupar eventos por empleado y fecha
      const agrupados = {};
      for (const ev of rawEventos) {
        const clave = `${ev.empleado_id || 'sin_id'}_${ev.fecha}`;
        if (!agrupados[clave]) agrupados[clave] = [];
        agrupados[clave].push(ev);
      }

      // Construir el resultado filtrando solo entrada/salida
      const eventos = [];
      for (const [clave, lista] of Object.entries(agrupados)) {
        if (lista.length === 1) {
          eventos.push({
            ...lista[0],
            tipo_evento: 'ENTRADA',
          });
        } else if (lista.length > 1) {
          eventos.push({
            ...lista[0],
            tipo_evento: 'ENTRADA',
          });
          eventos.push({
            ...lista[lista.length - 1],
            tipo_evento: 'SALIDA',
          });
        }
      }

      console.log(`Total eventos filtrados (solo entrada/salida): ${eventos.length}`);

      res.json({
        success: true,
        eventos: eventos.sort((a, b) => new Date(b.fecha_hora) - new Date(a.fecha_hora)),
        periodo: { desde: fechaDesde, hasta: fechaHasta }
      });

    } catch (err) {
      console.error('Error generando reporte de eventos biométricos:', err);
      res.status(500).json({
        success: false,
        message: 'Error al generar reporte de eventos biométricos',
        error: err.message
      });
    }
  });
  // En reportes.routes.js - corregir la ruta /buscar-empleados
  router.get('/buscar-empleados', requireAuth, async (req, res) => {
    try {
      const { query } = req.query;
      
      if (!query || query.length < 2) {
        return res.json({ success: true, empleados: [] });
      }

      // Verificar qué columnas existen en tu tabla empleados
      const [empleados] = await db.query(`
        SELECT id, nombre_completo, renglon 
        FROM empleados 
        WHERE (nombre_completo LIKE ? OR renglon LIKE ?) 
          AND eliminado_en IS NULL
          AND activo = 1
        ORDER BY nombre_completo 
        LIMIT 20
      `, [`%${query}%`, `%${query}%`]);

      res.json({ success: true, empleados });
    } catch (err) {
      console.error('Error buscando empleados:', err);
      res.status(500).json({ 
        success: false, 
        message: 'Error al buscar empleados',
        error: err.message 
      });
    }
  });

  // Ruta para ejecutar manualmente la sincronización biométrica
  router.post('/actualizar-biometrico', requireAuth, async (req, res) => {
    try {
      console.log('Ejecutando sincronización biométrica manual...');
      
      // Ruta al script de sincronización
      const scriptPath = path.join(__dirname, '../scripts/sync_biometric_logs.js');
      
      // Ejecutar el script
      exec(`node "${scriptPath}"`, { 
        cwd: path.join(__dirname, '..'),
        env: { ...process.env, NODE_PATH: '.' }
      }, (error, stdout, stderr) => {
        if (error) {
          console.error('Error ejecutando sync_biometric_logs:', error);
          return res.status(500).json({ 
            success: false, 
            message: 'Error ejecutando la sincronización',
            error: error.message 
          });
        }

        console.log('Sincronización biométrica completada:', stdout);
        
        if (stderr) {
          console.warn('Advertencias en sincronización:', stderr);
        }

        // Contar eventos recién insertados (opcional)
        db.query(`
          SELECT COUNT(*) as total 
          FROM registros_asistencia 
          WHERE DATE(creado_en) = CURDATE() 
          AND origen = 'BIOMETRICO'
        `).then(([rows]) => {
          const totalEventos = rows[0]?.total || 0;
          
          res.json({ 
            success: true, 
            message: 'Sincronización completada correctamente',
            totalEventos: totalEventos,
            output: stdout
          });
        }).catch(countError => {
          console.error('Error contando eventos:', countError);
          res.json({ 
            success: true, 
            message: 'Sincronización completada (error contando eventos)',
            output: stdout
          });
        });
      });

    } catch (err) {
      console.error('Error en ruta de actualización biométrica:', err);
      res.status(500).json({ 
        success: false, 
        message: 'Error interno del servidor',
        error: err.message 
      });
    }
  });


module.exports = router;