const express = require('express');
const db = require('../db.js');
const { audit } = require('../utils/audit.js');
const router = express.Router();

// MODELO - Tipos de Permiso

class TiposPermisoModel {
  static async getAll() {
    const [rows] = await db.query(`
      SELECT id, nombre, dias_permitidos, mensaje_carta, activo, creado_en, actualizado_en
      FROM tipos_permiso
      WHERE activo = 1
      ORDER BY nombre ASC
    `);
    return rows;
  }

  static async getById(id) {
    const [rows] = await db.query(`
      SELECT id, nombre, dias_permitidos, mensaje_carta, activo
      FROM tipos_permiso
      WHERE id = ?
    `, [id]);
    return rows.length ? rows[0] : null;
  }

  static async create({ nombre, dias_permitidos, mensaje_carta }) {
    const [result] = await db.query(`
      INSERT INTO tipos_permiso (nombre, dias_permitidos, mensaje_carta)
      VALUES (?, ?, ?)
    `, [nombre, dias_permitidos, mensaje_carta || null]);

    return {
      id: result.insertId,
      nombre,
      dias_permitidos,
      mensaje_carta
    };
  }

  static async update(id, { nombre, dias_permitidos, mensaje_carta }) {
    const [result] = await db.query(`
      UPDATE tipos_permiso
      SET nombre = ?, dias_permitidos = ?, mensaje_carta = ?
      WHERE id = ?
    `, [nombre, dias_permitidos, mensaje_carta || null, id]);

    if (result.affectedRows === 0) throw new Error('Tipo de permiso no encontrado');
    return this.getById(id);
  }

  static async delete(id) {
    const [result] = await db.query(`UPDATE tipos_permiso SET activo = 0 WHERE id = ?`, [id]);
    if (result.affectedRows === 0) throw new Error('Tipo de permiso no encontrado');
    return true;
  }
}

// ============================================
// MODELO - Permisos
// ============================================
class PermisosModel {
  static async getAll(filtro = 'todos') {
    let sql = `
      SELECT 
        p.id,
        p.empleado_id,
        e.numero_empleado,
        e.nombre_completo,
        e.rol_id,
        e.area_id,
        r.nombre_rol AS rol_nombre,
        a.nombre_area AS area_nombre,
        p.tipo_permiso_id,
        tp.nombre AS tipo_permiso_nombre,
        p.tipo_permiso_otro,
        p.mensaje_otro,
        p.fecha_inicio,
        p.fecha_fin,
        p.dias_solicitados,
        p.estado,
        p.observaciones,
        p.creado_en,
        p.actualizado_en,
        p.autorizado_en
      FROM permisos p
      INNER JOIN empleados e ON p.empleado_id = e.id
      LEFT JOIN roles_empleado r ON e.rol_id = r.id
      LEFT JOIN areas a ON e.area_id = a.id
      LEFT JOIN tipos_permiso tp ON p.tipo_permiso_id = tp.id
    `;

    if (filtro === 'permiso') {
      sql += ` WHERE p.fecha_inicio <= CURDATE() AND p.fecha_fin >= CURDATE()`;
    }

    sql += ` ORDER BY p.fecha_inicio DESC, e.nombre_completo ASC`;

    const [rows] = await db.query(sql);
    return rows;
  }

  static async getById(id) {
    const [rows] = await db.query(`
      SELECT 
        p.*,
        e.nombre_completo,
        e.numero_empleado,
        e.rol_id,
        e.area_id,
        tp.nombre AS tipo_permiso_nombre
      FROM permisos p
      INNER JOIN empleados e ON p.empleado_id = e.id
      LEFT JOIN tipos_permiso tp ON p.tipo_permiso_id = tp.id
      WHERE p.id = ?
    `, [id]);
    return rows.length ? rows[0] : null;
  }

  static async create(data) {
    const {
      empleado_id,
      tipo_permiso_id,
      tipo_permiso_otro,
      mensaje_otro,
      fecha_inicio,
      fecha_fin,
      dias_solicitados,
      estado = 'PENDIENTE',
      creado_por
    } = data;

    const [result] = await db.query(`
      INSERT INTO permisos (
        empleado_id, tipo_permiso_id, tipo_permiso_otro, mensaje_otro,
        fecha_inicio, fecha_fin, dias_solicitados, estado, creado_por
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      empleado_id,
      tipo_permiso_id || null,
      tipo_permiso_otro || null,
      mensaje_otro || null,
      fecha_inicio,
      fecha_fin,
      dias_solicitados,
      estado,
      creado_por || null
    ]);

    return { id: result.insertId, ...data };
  }

  static async update(id, data) {
    const {
      tipo_permiso_id,
      tipo_permiso_otro,
      mensaje_otro,
      fecha_inicio,
      fecha_fin,
      dias_solicitados,
      estado,
      observaciones
    } = data;

    const [result] = await db.query(`
      UPDATE permisos
      SET tipo_permiso_id = ?, tipo_permiso_otro = ?, mensaje_otro = ?,
          fecha_inicio = ?, fecha_fin = ?, dias_solicitados = ?,
          estado = ?, observaciones = ?
      WHERE id = ?
    `, [
      tipo_permiso_id || null,
      tipo_permiso_otro || null,
      mensaje_otro || null,
      fecha_inicio,
      fecha_fin,
      dias_solicitados,
      estado,
      observaciones || null,
      id
    ]);

    if (result.affectedRows === 0) throw new Error('Permiso no encontrado');
    return this.getById(id);
  }

  static async updateEstado(id, estado, autorizado_por = null) {
    const [result] = await db.query(`
      UPDATE permisos
      SET estado = ?, autorizado_por = ?, autorizado_en = NOW()
      WHERE id = ?
    `, [estado, autorizado_por, id]);

    if (result.affectedRows === 0) throw new Error('Permiso no encontrado');
    return this.getById(id);
  }

  static async delete(id) {
    const [result] = await db.query(`DELETE FROM permisos WHERE id = ?`, [id]);
    if (result.affectedRows === 0) throw new Error('Permiso no encontrado');
    return true;
  }
}

// ============================================
// CONTROLADORES - Tipos de Permiso
// ============================================
class TiposPermisoController {
  static async getAll(_req, res) {
    try {
      const tipos = await TiposPermisoModel.getAll();
      return res.json({ success: true, data: tipos });
    } catch (error) {
      return res.status(500).json({ success: false, error: error.message });
    }
  }

  static async create(req, res) {
    try {
      const { nombre, dias_permitidos, mensaje_carta } = req.body;

      if (!nombre || !dias_permitidos) {
        return res.status(400).json({ success: false, error: 'Faltan campos requeridos' });
      }

      const nuevo = await TiposPermisoModel.create({ nombre, dias_permitidos, mensaje_carta });
      await audit({ evento: 'CREATE', entidad: 'tipos_permiso', entidad_id: nuevo.id, antes: null, despues: nuevo, req });

      return res.status(201).json({ success: true, data: nuevo });
    } catch (error) {
      return res.status(500).json({ success: false, error: error.message });
    }
  }

  static async update(req, res) {
    try {
      const { id } = req.params;
      const { nombre, dias_permitidos, mensaje_carta } = req.body;

      const antes = await TiposPermisoModel.getById(id);
      if (!antes) return res.status(404).json({ success: false, error: 'Tipo de permiso no encontrado' });

      const actualizado = await TiposPermisoModel.update(id, { nombre, dias_permitidos, mensaje_carta });
      await audit({ evento: 'UPDATE', entidad: 'tipos_permiso', entidad_id: id, antes, despues: actualizado, req });

      return res.json({ success: true, data: actualizado });
    } catch (error) {
      return res.status(500).json({ success: false, error: error.message });
    }
  }

  static async delete(req, res) {
    try {
      const { id } = req.params;

      const antes = await TiposPermisoModel.getById(id);
      if (!antes) return res.status(404).json({ success: false, error: 'Tipo de permiso no encontrado' });

      await TiposPermisoModel.delete(id);
      await audit({ evento: 'DELETE', entidad: 'tipos_permiso', entidad_id: id, antes, despues: null, req });

      return res.json({ success: true, message: 'Tipo de permiso eliminado' });
    } catch (error) {
      return res.status(500).json({ success: false, error: error.message });
    }
  }
}

// ============================================
// CONTROLADORES - Permisos
// ============================================
class PermisosController {
  static async getAll(req, res) {
    try {
      const { filtro = 'todos' } = req.query;
      const permisos = await PermisosModel.getAll(filtro);
      return res.json({ success: true, data: permisos });
    } catch (error) {
      return res.status(500).json({ success: false, error: error.message });
    }
  }

  static async getById(req, res) {
    try {
      const { id } = req.params;
      const permiso = await PermisosModel.getById(id);

      if (!permiso) return res.status(404).json({ success: false, error: 'Permiso no encontrado' });

      return res.json({ success: true, data: permiso });
    } catch (error) {
      return res.status(500).json({ success: false, error: error.message });
    }
  }

  static async create(req, res) {
    try {
      const data = req.body;

      if (!data.empleado_id || !data.fecha_inicio || !data.fecha_fin) {
        return res.status(400).json({ success: false, error: 'Faltan campos requeridos' });
      }

      const nuevo = await PermisosModel.create(data);
      await audit({ evento: 'CREATE', entidad: 'permisos', entidad_id: nuevo.id, antes: null, despues: nuevo, req });

      return res.status(201).json({ success: true, data: nuevo });
    } catch (error) {
      return res.status(500).json({ success: false, error: error.message });
    }
  }

  static async update(req, res) {
    try {
      const { id } = req.params;
      const data = req.body;

      const antes = await PermisosModel.getById(id);
      if (!antes) return res.status(404).json({ success: false, error: 'Permiso no encontrado' });

      const actualizado = await PermisosModel.update(id, data);
      await audit({ evento: 'UPDATE', entidad: 'permisos', entidad_id: id, antes, despues: actualizado, req });

      return res.json({ success: true, data: actualizado });
    } catch (error) {
      return res.status(500).json({ success: false, error: error.message });
    }
  }

  static async updateEstado(req, res) {
    try {
      const { id } = req.params;
      const { estado } = req.body;

      if (!['PENDIENTE', 'AUTORIZADO', 'RECHAZADO'].includes(estado)) {
        return res.status(400).json({ success: false, error: 'Estado inválido' });
      }

      const antes = await PermisosModel.getById(id);
      if (!antes) return res.status(404).json({ success: false, error: 'Permiso no encontrado' });

      const actualizado = await PermisosModel.updateEstado(id, estado, req.user?.id);
      await audit({ evento: 'UPDATE', entidad: 'permisos', entidad_id: id, antes, despues: actualizado, req });

      return res.json({ success: true, data: actualizado });
    } catch (error) {
      return res.status(500).json({ success: false, error: error.message });
    }
  }

  static async delete(req, res) {
    try {
      const { id } = req.params;

      const antes = await PermisosModel.getById(id);
      if (!antes) return res.status(404).json({ success: false, error: 'Permiso no encontrado' });

      await PermisosModel.delete(id);
      await audit({ evento: 'DELETE', entidad: 'permisos', entidad_id: id, antes, despues: null, req });

      return res.json({ success: true, message: 'Permiso eliminado' });
    } catch (error) {
      return res.status(500).json({ success: false, error: error.message });
    }
  }
}

// ============================================
// RUTAS
// ============================================

// Tipos de permiso
router.get('/tipos', TiposPermisoController.getAll);
router.post('/tipos', TiposPermisoController.create);
router.put('/tipos/:id', TiposPermisoController.update);
router.delete('/tipos/:id', TiposPermisoController.delete);

// Permisos
router.get('/', PermisosController.getAll);
router.get('/:id', PermisosController.getById);
router.post('/', PermisosController.create);
router.put('/:id', PermisosController.update);
router.patch('/:id/estado', PermisosController.updateEstado);
router.delete('/:id', PermisosController.delete);

module.exports = router;
