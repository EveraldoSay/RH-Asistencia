require('dotenv').config();
const mysql = require('mysql2/promise');

(async () => {
    try {
        console.log('--- Checking Port 3306 ---');

        const connection = await mysql.createConnection({
            host: process.env.DB_HOST || 'localhost',
            user: process.env.DB_USER || 'root',
            password: process.env.DB_PASSWORD || 'Qwerty123',
            port: 3306,
        });

        const [rows] = await connection.query('SHOW DATABASES');
        console.log('Databases on 3306:', rows.map(r => r.Database));

        await connection.end();
        process.exit(0);
    } catch (err) {
        console.error('Error connecting to 3306:', err.message);
        process.exit(1);
    }
})();
