const router = require('express').Router();
const auth = require('../middlewares/auth');
const svc = require('../services/biometric/hikvision.service.js');
const db = require('../db.js');

const { requireAuth, requireAdmin } = auth;

router.use(requireAuth);

// ===================  PROBAR CONEXIÓN ===================
router.get('/test-connection', requireAdmin, async (_req, res) => {
  try {
    const data = await svc.testConnectionAll();
    res.json({ success: true, devices: data });
  } catch (err) {
    console.error('Hikvision test-connection error:', err.message);
    res.status(502).json({ success: false, message: 'Error probando conexión', detail: err.message });
  }
});

// =================== OBTENER EVENTOS ===================
router.get('/events', requireAdmin, async (req, res) => {
  try {
    const since = req.query.since ? new Date(req.query.since) : null;
    const until = req.query.until ? new Date(req.query.until) : null;
    const limit = Math.max(1, Math.min(parseInt(req.query.limit || '200', 10), 1000));

    const { events, count } = await svc.pullEvents({ since, until, limit });

    if (!events.length) return res.status(204).send();

    res.json({ success: true, count, events });
  } catch (err) {
    console.error('Hikvision events error:', err.message);
    res.status(502).json({ success: false, message: 'Error obteniendo eventos', detail: err.message });
  }
});

// ===================== SINCRONIZAR EMPLEADOS DESDE BIOMÉTRICOS =====================
router.post('/sync-users', requireAdmin, async (_req, res) => {
  try {
    ('Iniciando sincronización de usuarios desde biométricos...');
    const users = await svc.getAllUserNames();
    (`Usuarios obtenidos desde dispositivos: ${users.length}`);

    let insertados = 0;
    for (const u of users) {
      if (!u.nombre_completo || !u.numero_empleado) {
        ('Usuario omitido por datos incompletos:', u);
        continue;
      }

      await db.query(`
        INSERT INTO empleados (numero_empleado, nombre_completo, activo)
        VALUES (?, ?, 1)
        ON DUPLICATE KEY UPDATE nombre_completo = VALUES(nombre_completo), activo = 1
      `, [u.numero_empleado, u.nombre_completo]);

      insertados++;
    }

    (`Total insertados/actualizados: ${insertados}`);
    res.json({ success: true, total: insertados, usuariosEncontrados: users.length });
  } catch (err) {
    console.error('Error sincronizando empleados:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// ===================== DIAGNÓSTICO DE USUARIOS =====================
router.get('/debug-users', requireAdmin, async (_req, res) => {
  try {
    ('Iniciando recopilación de usuarios en modo diagnóstico...');
    const users = await svc.getAllUserNames();
    
    const stats = {
      total: users.length,
      porDispositivo: {},
      sinNumeroEmpleado: 0,
      sinNombre: users.filter(u => !u.nombre_completo || u.nombre_completo === 'SIN NOMBRE').length
    };

    // Contar por dispositivo
    users.forEach(u => {
      stats.porDispositivo[u.device] = (stats.porDispositivo[u.device] || 0) + 1;
    });

    ('Estadísticas de usuarios:', stats);
    
    res.json({
      success: true,
      stats,
      sampleUsers: users.slice(0, 10) // Mostrar primeros 10 para debugging
    });
  } catch (err) {
    console.error('Error en diagnóstico:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// ===================== SINCRONIZAR EVENTOS DE MARCAJES =====================
const { syncEventosDesdeBiometricos } = require('../services/biometric/hikvision.events.service.js');

router.post('/sync-events', requireAdmin, async (_req, res) => {
  try {
    const result = await syncEventosDesdeBiometricos();
    res.json(result);
  } catch (err) {
    console.error('Error sincronizando eventos:', err.message);
    res.status(500).json({ success: false, message: err.message });
  }
});


module.exports = router;