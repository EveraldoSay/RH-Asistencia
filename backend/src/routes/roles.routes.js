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

module.exports = router;
