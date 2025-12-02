require('dotenv').config();
const mysql = require('mysql2/promise');

(async () => {
    const dbConfig = {
        host: process.env.DB_HOST || 'localhost',
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || 'Qwerty123',
        port: Number(process.env.DB_PORT) || 3307,
        database: process.env.DB_NAME || 'sigsa_db'
    };

    let conn;
    try {
        conn = await mysql.createConnection(dbConfig);
        console.log(`Connected to ${dbConfig.database}`);

        console.log('\n--- Describe turnos table ---');
        const [columns] = await conn.query('DESCRIBE turnos');
        console.table(columns);

        console.log('\n--- Check existing turnos types ---');
        const [turnos] = await conn.query('SELECT id, nombre_turno, tipo_turno FROM turnos');
        console.table(turnos);

        await conn.end();
    } catch (err) {
        console.error('Error:', err);
        if (conn) await conn.end();
    }
})();
