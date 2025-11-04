const db = require('../db.js');

async function audit({ evento, entidad, entidad_id = null, antes = null, despues = null, req }) {
  try {
    const actor_id = req.actorId ?? null;
    const actor_username = req.actorUsername ?? null;
    const ip = (req.headers['x-forwarded-for'] || '').split(',')[0] || req.ip || null;
    const ua = req.headers['user-agent'] || null;
    const request_id = req.id || null; 
    await db.query(
      `INSERT INTO audit_log (evento, entidad, entidad_id, antes, despues, actor_id, actor_username, ip, user_agent, request_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        evento,
        entidad,
        entidad_id,
        antes ? JSON.stringify(antes) : null,
        despues ? JSON.stringify(despues) : null,
        actor_id,
        actor_username,
        ip,
        ua,
        request_id
      ]
    );
  } catch (e) {
    console.error('audit() error:', e.message);
   
  }
}

module.exports = { audit };
