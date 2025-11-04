const mysql = require('mysql2/promise');

const pool = mysql.createPool({
  host:     process.env.DB_HOST || 'localhost',
  user:     process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || 'Qwerty123',   
  database: process.env.DB_NAME || 'HRO_Q',
  port:     Number(process.env.DB_PORT) || 3307,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

(async () => {
  try {
    const conn = await pool.getConnection();
    await conn.ping();
    conn.release();
    console.log('Conectado a MySQL');
  } catch (e) {
    console.error('Error conectando a MySQL:', e.message);
  }
})();

module.exports = pool; 