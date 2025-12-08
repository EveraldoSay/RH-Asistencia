const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });
// const DigestFetch = require('digest-fetch').default || require('digest-fetch'); // REMOVED
const xml2js = require('xml2js');
const db = require('../db');


const biometricUser = process.env.BIOMETRIC_USER;
const biometricPass = process.env.BIOMETRIC_PASS;
const biometricIps = (process.env.BIOMETRIC_IPS || '').split(',').filter(Boolean);

if (!biometricUser || !biometricPass || biometricIps.length === 0) {
  console.error('Error: Faltan credenciales de biométricos en .env');
  process.exit(1);
}

const devices = biometricIps.map(ip => ({
  ip: ip.trim(),
  user: biometricUser,
  pass: biometricPass
}));

// Función para traer todos los usuarios de un biométrico
async function fetchAllFromDevice(device) {
  const { default: DigestFetch } = await import('digest-fetch');
  const client = new DigestFetch(device.user, device.pass);
  const maxResults = 30;
  let position = 0;
  let allUsers = [];
  let more = true;
  let intentos = 0;

  while (more && intentos < 5000) {
    const body = {
      UserInfoSearchCond: {
        searchID: "1",
        maxResults,
        searchResultPosition: position
      }
    };

    try {
      const res = await client.fetch(
        `http://${device.ip}/ISAPI/AccessControl/UserInfo/Search?format=json`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body)
        }
      );

      const data = await res.json();
      const list = Array.isArray(data?.UserInfoSearch?.UserInfo)
        ? data.UserInfoSearch.UserInfo
        : data?.UserInfoSearch?.UserInfo
          ? [data.UserInfoSearch.UserInfo]
          : [];

      allUsers.push(...list);
      const status = data?.UserInfoSearch?.responseStatusStrg;

      if (status === 'MORE') {
        position += maxResults;
      } else {
        more = false;
      }

      await new Promise(r => setTimeout(r, 200)); // pequeña pausa
      intentos++;
    } catch (err) {
      console.error(`Error en ${device.ip} (lote ${position}):`, err.message);
      break;
    }
  }
  return allUsers;
}

// Unificar usuarios por número de empleado
function unifyUsers(devicesUsers) {
  const merged = new Map();
  for (const list of devicesUsers) {
    for (const u of list) {
      if (!u?.employeeNo) continue;
      merged.set(u.employeeNo, u);
    }
  }
  return Array.from(merged.values());
}

// Guardar en la base de datos (opcional)
async function saveToDatabase(users) {
  let insertados = 0;

  for (const u of users) {
    const numero_empleado = u.employeeNo?.trim();
    const nombre_completo = u.name?.trim();

    if (!numero_empleado || !nombre_completo) continue;

    await db.query(
      `
      INSERT INTO empleados (numero_empleado, nombre_completo, activo)
      VALUES (?, ?, 1)
      ON DUPLICATE KEY UPDATE nombre_completo = VALUES(nombre_completo), activo = 1
      `,
      [numero_empleado, nombre_completo]
    );

    insertados++;
  }
}

// Ejecución principal
(async () => {
  console.log('Iniciando sincronización de usuarios biométricos...');
  try {
    const results = [];
    for (const device of devices) {
      console.log(`Obteniendo usuarios de ${device.ip}...`);
      const users = await fetchAllFromDevice(device);
      results.push(users);
      console.log(`Se obtuvieron ${users.length} usuarios de ${device.ip}`);
    }

    const unified = unifyUsers(results);
    console.log(`Total de usuarios unificados: ${unified.length}`);

    // Si quieres guardar en DB, descomenta la línea siguiente:
    await saveToDatabase(unified);
    console.log('Sincronización de usuarios biométricos completada.');
    process.exit(0);
  } catch (err) {
    console.error('Error general en la sincronización de usuarios:', err);
    process.exit(1);
  }
})();