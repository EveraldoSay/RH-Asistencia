require('dotenv').config();
const { exec } = require('child_process');
const path = require('path');

// Tiempo en minutos entre ejecuciones (20 o 30 min recomendado)
const INTERVAL_MINUTES = Number(process.env.SYNC_INTERVAL_MINUTES) || 30;

// Ruta de tus scripts 
const USERS_SCRIPT = path.join(__dirname, 'sync_biometric_users.js');
const LOGS_SCRIPT = path.join(__dirname, 'sync_biometric_logs.js');

// ==================== FUNCIÓN AUXILIAR ====================
function runScript(scriptPath, label) {
  const child = exec(`node "${scriptPath}"`, { env: process.env });

  child.stdout.on('data', data => {
    process.stdout.write(`[${label}] ${data}`);
  });

  child.stderr.on('data', data => {
    process.stderr.write(`[${label}][ERROR] ${data}`);
  });

  child.on('exit', code => {
  });
}

// ==================== INICIO INMEDIATO ====================
runScript(USERS_SCRIPT, 'Usuarios Biométricos');
setTimeout(() => runScript(LOGS_SCRIPT, 'Eventos Biométricos'), 3000); // pequeño desfase

// ==================== PROGRAMACIÓN PERIÓDICA ====================
const intervalMs = INTERVAL_MINUTES * 60 * 1000;
setInterval(() => {
  runScript(USERS_SCRIPT, 'Usuarios Biométricos');
  setTimeout(() => runScript(LOGS_SCRIPT, 'Eventos Biométricos'), 5000);
}, intervalMs);
