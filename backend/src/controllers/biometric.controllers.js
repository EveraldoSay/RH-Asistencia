const router = require('express').Router();
const auth = require('../middlewares/auth');
const svc = require('../services/biometric/hikvision.service.js');
const db = require('../db.js') 

const { requireAuth, requireAdmin } = auth;

router.use(requireAuth);

// ---------- TEST CONEXIÓN ----------
router.get('/test-connection', requireAdmin, async (_req, res) => {
  try {
    const data = await svc.testConnectionAll();
    res.json({ success: true, devices: data });
  } catch (err) {
    console.error('Error probando conexión:', err.message);
    res.status(502).json({ success: false, message: err.message });
  }
});

// ---------- SINCRONIZAR USUARIOS ----------
router.post('/sync-users', requireAdmin, async (_req, res) => {
  try {
    const users = await svc.getAllUserNames();

    let insertados = 0;
    for (const u of users) {
      if (!u.nombre_completo || !u.numero_empleado) continue;

      await db.query(`
        INSERT INTO empleados (numero_empleado, nombre_completo, activo)
        VALUES (?, ?, 1)
        ON DUPLICATE KEY UPDATE nombre_completo = VALUES(nombre_completo), activo = 1
      `, [u.numero_empleado, u.nombre_completo]);

      insertados++;
    }
    res.json({ success: true, total: insertados });
  } catch (err) {
    console.error('Error sincronizando empleados:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
