const express = require('express');
const db = require('../db.js');
const router = express.Router();

router.get('/', async (_req, res) => {
  try {
    const [rows] = await db.query(
      'SELECT id, nombre_rol, descripcion FROM roles_empleado ORDER BY nombre_rol ASC'
    );
    res.json({ success: true, data: rows });
  } catch (e) {
    res.status(500).json({ success: false, error: 'Error obteniendo roles', message: e.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const nombre_rol  = (req.body?.nombre_rol || '').trim();
    const descripcion = req.body?.descripcion ?? null;
    if (!nombre_rol) {
      return res.status(400).json({ success: false, error: 'nombre_rol requerido' });
    }

    const [r] = await db.query(
      'INSERT INTO roles_empleado (nombre_rol, descripcion) VALUES (?, ?)',
      [nombre_rol, descripcion]
    );
    return res.status(201).json({
      success: true,
      message: 'Rol creado',
      data: { id: r.insertId, nombre_rol, descripcion }
    });
  } catch (e) {
    if (e.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ success: false, error: 'El rol ya existe' });
    }
    return res.status(500).json({ success: false, error: 'Error creando rol', message: e.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!id) {
      return res.status(400).json({ success: false, error: 'ID de rol inválido' });
    }

    // Check if the role is being used by any employee
    const [[{ count }]] = await db.query(
      'SELECT COUNT(*) as count FROM empleados WHERE rol_id = ?',
      [id]
    );

    if (count > 0) {
      return res.status(409).json({ success: false, error: 'El puesto está en uso y no se puede eliminar' });
    }

    const [r] = await db.query(
      'DELETE FROM roles_empleado WHERE id = ?',
      [id]
    );

    if (r.affectedRows === 0) {
      return res.status(404).json({ success: false, error: 'El rol no existe' });
    }

    return res.json({ success: true, message: 'Puesto eliminado' });
  } catch (e) {
    return res.status(500).json({ success: false, error: 'Error eliminando el puesto', message: e.message });
  }
});

module.exports = router;
