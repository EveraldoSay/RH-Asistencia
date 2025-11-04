// CJS
const express = require('express');
const router = express.Router();
const db = require('../db.js');
const { requireAuth, requireAnyRole } = require('../middlewares/auth.js');

// Solo jefes/admin/auditor pueden ver el log
const requireSupervisor = requireAnyRole('jefe', 'admin', 'auditor');

/**
 * GET /api/audit
 * Filtros:
 *   date=YYYY-MM-DD         (si no envías, usa hoy)
 *   date_from=YYYY-MM-DD    (rango inicio)
 *   date_to=YYYY-MM-DD      (rango fin, inclusivo)
 *   actor_id=number
 *   evento=CREATE|UPDATE|DELETE|ASSIGN|LOGIN|...
 *   entidad=empleados|roles|areas|asignaciones_lote|...
 *   q=texto                 (busca en actor_username o entidad)
 *   limit=50 (max 200)
 *   offset=0
 */
router.get('/', requireAuth, requireSupervisor, async (req, res) => {
  try {
    const {
      date,
      date_from,
      date_to,
      actor_id,
      evento,
      entidad,
      q,
      limit = 50,
      offset = 0
    } = req.query;

    const params = [];
    const where = [];

    // rango de fechas
    if (date) {
      where.push(`DATE(created_at) = ?`);
      params.push(date);
    } else if (date_from && date_to) {
      where.push(`DATE(created_at) BETWEEN ? AND ?`);
      params.push(date_from, date_to);
    } else if (date_from) {
      where.push(`DATE(created_at) >= ?`);
      params.push(date_from);
    } else if (date_to) {
      where.push(`DATE(created_at) <= ?`);
      params.push(date_to);
    } else {
      // por defecto: hoy
      where.push(`DATE(created_at) = CURDATE()`);
    }

    if (actor_id) {
      where.push(`actor_id = ?`);
      params.push(Number(actor_id));
    }
    if (evento) {
      where.push(`evento = ?`);
      params.push(String(evento).toUpperCase());
    }
    if (entidad) {
      where.push(`entidad = ?`);
      params.push(String(entidad));
    }
    if (q) {
      where.push(`(actor_username LIKE ? OR entidad LIKE ?)`);
      params.push(`%${q}%`, `%${q}%`);
    }

    const lim = Math.min(Number(limit) || 50, 200);
    const off = Math.max(Number(offset) || 0, 0);

    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

    const [rows] = await db.query(
      `SELECT id, created_at, evento, entidad, entidad_id,
              actor_id, actor_username, ip, user_agent,
              antes, despues
       FROM audit_log
       ${whereSql}
       ORDER BY created_at DESC
       LIMIT ? OFFSET ?`,
      [...params, lim, off]
    );

    // total para paginacion
    const [[{ total }]] = await db.query(
      `SELECT COUNT(*) AS total FROM audit_log ${whereSql}`,
      params
    );

    res.json({ success:true, data: rows, total, limit: lim, offset: off });
  } catch (e) {
    console.error('GET /api/audit error', e);
    res.status(500).json({ success:false, error:'Error obteniendo auditoría' });
  }
});


//Resumen por evento/entidad en un rango de fechas (o hoy por defecto)

router.get('/stats', requireAuth, requireSupervisor, async (req, res) => {
  try {
    const { date, date_from, date_to } = req.query;
    const params = [];
    const where = [];

    if (date) {
      where.push(`DATE(created_at) = ?`);
      params.push(date);
    } else if (date_from && date_to) {
      where.push(`DATE(created_at) BETWEEN ? AND ?`);
      params.push(date_from, date_to);
    } else {
      where.push(`DATE(created_at) = CURDATE()`);
    }

    const whereSql = `WHERE ${where.join(' AND ')}`;

    const [byEvento] = await db.query(
      `SELECT evento, COUNT(*) c FROM audit_log ${whereSql} GROUP BY evento ORDER BY c DESC`,
      params
    );

    const [byEntidad] = await db.query(
      `SELECT entidad, COUNT(*) c FROM audit_log ${whereSql} GROUP BY entidad ORDER BY c DESC`,
      params
    );

    res.json({ success:true, data: { byEvento, byEntidad } });
  } catch (e) {
    console.error('GET /api/audit/stats error', e);
    res.status(500).json({ success:false, error:'Error obteniendo estadísticas' });
  }
});

module.exports = router;
