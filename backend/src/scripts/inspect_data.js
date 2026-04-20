require('dotenv').config();
const db = require('../db');

(async () => {
    try {
        console.log('--- VERIFYING ATTENDANCE ---');
        const [employees] = await db.query(`
      SELECT id, nombre_completo 
      FROM empleados 
      WHERE nombre_completo LIKE '%Jose Eduardo Contreras%' OR nombre_completo LIKE '%Gustavo Enrique Barrios%'
    `);

        for (const emp of employees) {
            console.log(`\nNAME: ${emp.nombre_completo}`);
            const [att] = await db.query(`
            SELECT entrada_real, salida_real, estado 
            FROM asistencias 
            WHERE empleado_id = ? AND fecha = '2025-12-02'
        `, [emp.id]);

            if (att.length > 0) {
                console.log(`  In: ${att[0].entrada_real}`);
                console.log(`  Out: ${att[0].salida_real}`);
                console.log(`  State: ${att[0].estado}`);
            } else {
                console.log(`  NO ATTENDANCE RECORD`);
            }
        }
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
})();
