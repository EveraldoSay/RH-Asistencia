const express = require('express');
const router = express.Router();
const db = require('../db'); // conexión MySQL
const { requireAuth } = require('../middlewares/auth');

// Obtener alertas (todas o pendientes)

router.get('/', requireAuth, async (req, res) => {
  try {
    const estado = req.query.estado || null;
    let query = `
      SELECT a.id, e.nombre_completo AS empleado, a.tipo_alerta, 
             a.descripcion, a.fecha_hora, a.estado
      FROM alertas a
      INNER JOIN empleados e ON e.id = a.empleado_id
      ORDER BY a.fecha_hora DESC
      LIMIT 100
    `;
    const [rows] = await db.query(query);
    res.json({ success: true, alertas: rows });
  } catch (err) {
    console.error('Error obteniendo alertas:', err);
    res.status(500).json({ success: false, message: 'Error al obtener alertas' });
  }
});

// Marcar alerta como resuelta
router.put('/:id/resolver', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    await db.query('UPDATE alertas SET estado="RESUELTA" WHERE id=?', [id]);
    res.json({ success: true, message: 'Alerta marcada como resuelta' });
  } catch (err) {
    console.error('Error actualizando alerta:', err);
    res.status(500).json({ success: false, message: 'Error al actualizar alerta' });
  }
});


// Obtener conteo de alertas pendientes

router.get('/contador', requireAuth, async (req, res) => {
  try {
    const [rows] = await db.query(
      'SELECT COUNT(*) AS total FROM alertas WHERE estado="PENDIENTE"'
    );
    res.json({ success: true, total: rows[0].total });
  } catch (err) {
    console.error('Error obteniendo contador de alertas:', err);
    res.status(500).json({ success: false, message: 'Error al obtener contador' });
  }
});

module.exports = router;
