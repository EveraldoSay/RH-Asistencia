require('dotenv').config();
const { procesarAsistenciaDia } = require('../services/asistencia.service');

// Usage: node src/scripts/backfill_attendance.js <startDate> <endDate>
// Example: node src/scripts/backfill_attendance.js 2025-12-01 2025-12-02

(async () => {
    try {
        const args = process.argv.slice(2);
        if (args.length < 2) {
            console.error('Usage: node src/scripts/backfill_attendance.js <YYYY-MM-DD> <YYYY-MM-DD>');
            process.exit(1);
        }

        const startDate = new Date(args[0]);
        const endDate = new Date(args[1]);

        if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
            console.error('Invalid date format. Use YYYY-MM-DD');
            process.exit(1);
        }

        console.log(`Iniciando backfill desde ${args[0]} hasta ${args[1]}...`);

        for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
            const dateStr = d.toISOString().split('T')[0];
            console.log(`Procesando: ${dateStr}`);
            await procesarAsistenciaDia(dateStr);
        }

        console.log('Backfill completado.');
        process.exit(0);
    } catch (err) {
        console.error('Error en backfill:', err);
        process.exit(1);
    }
})();
