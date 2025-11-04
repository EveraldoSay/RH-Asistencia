require('dotenv').config();
const DigestFetch = require('digest-fetch').default || require('digest-fetch');
const xml2js = require('xml2js');
const db = require('../db');


const devices = [
  { ip: '192.168.0.45', user: 'admin', pass: 'Hospital0.' },
  { ip: '192.168.0.46', user: 'admin', pass: 'Hospital0.' }
];

// Función para traer todos los usuarios de un biométrico
async function fetchAllFromDevice(device) {
  console.log(`Conectando a dispositivo ${device.ip}...`);
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

      console.log(
        `[${device.ip}] Lote ${position} → ${list.length} usuarios`
      );

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

  console.log(`[${device.ip}] Total usuarios descargados: ${allUsers.length}`);
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
  console.log('Guardando en base de datos...');
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

  console.log(`Total insertados o actualizados: ${insertados}`);
}

// Ejecución principal
(async () => {
  try {
    const results = [];
    for (const device of devices) {
      const users = await fetchAllFromDevice(device);
      results.push(users);
    }

    const unified = unifyUsers(results);
    console.log(`Total unificados (sin duplicados): ${unified.length}`);

    // Si quieres guardar en DB, descomenta la línea siguiente:
    await saveToDatabase(unified);

    console.log('Sincronización completada correctamente');
    process.exit(0);
  } catch (err) {
    console.error('Error general:', err);
    process.exit(1);
  }
})();