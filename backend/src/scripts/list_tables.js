require('dotenv').config();
const db = require('../db');

(async () => {
    try {
        const [rows] = await db.query("SHOW TABLES");
        console.log(rows);
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
})();
