require('dotenv').config();
const mysql = require('mysql2/promise');

async function listDbs() {
    const connection = await mysql.createConnection({
        host: process.env.DB_HOST,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
    });
            port: Number(process.env.DB_PORT) || 3307
        });

        const [rows] = await conn.query('SHOW DATABASES');
        console.log(JSON.stringify(rows, null, 2));
        await conn.end();

    } catch (err) {
        console.error(err);
    }
}

listDbs();
