require('dotenv').config();
const { procesarAsistenciaDia } = require('../services/asistencia.service');

(async () => {
    try {
        console.log('Iniciando debug de asistencia...');
        await procesarAsistenciaDia('2025-12-02');
        console.log('Debug finalizado con éxito.');
        process.exit(0);
    } catch (err) {
        console.error('Error en debug:', err);
        process.exit(1);
    }
})();
