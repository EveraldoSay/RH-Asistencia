require('dotenv').config();
const DigestFetch = require('digest-fetch').default || require('digest-fetch');
const xml2js = require('xml2js');
const db = require('../db');
const cron = require('node-cron');

const devices = [
  { ip: '192.168.0.45', user: 'admin', pass: '[REDACTED]' },
  { ip: '192.168.0.46', user: 'admin', pass: '[REDACTED]' }
];

// 🔧 Función auxiliar mejorada
function extractValue(obj) {
  if (!obj) return null;
  if (typeof obj === 'string') return obj.trim();
  if (obj._) return obj._.trim();
  if (Array.isArray(obj)) return obj.length > 0 ? extractValue(obj[0]) : null;
  if (typeof obj === 'object') {
    const values = Object.values(obj).filter(v => v !== null && v !== undefined);
    return values.length > 0 ? extractValue(values[0]) : null;
  }
  return String(obj).trim();
}

async function fetchUsersFromDevice(device) {
  const client = new DigestFetch(device.user, device.pass);
  console.log(`🧩 Extrayendo usuarios de ${device.ip}...`);

  const allUsers = [];
  const maxResults = 50;
  const searchId = `SRCH-${Date.now()}`;
  let searchPosition = 0;
  let hasMoreData = true;
  let totalMatches = 0;

  // === 1️⃣ Paginado estándar ===
  while (hasMoreData) {
    try {
      const body = {
        UserInfoSearchCond: {
          searchID: searchId,
          maxResults,
          searchResultPosition: searchPosition,
        },
      };

      const response = await client.fetch(
        `http://${device.ip}/ISAPI/AccessControl/UserInfo/Search?format=json`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
          timeout: 25000,
        }
      );

      if (!response.ok) {
        console.error(`${device.ip}: ❌ HTTP ${response.status}`);
        break;
      }

      const data = await response.json();
      const search = data?.UserInfoSearch || {};
      const status = search.responseStatusStrg || '';
      const usersRaw = Array.isArray(search.UserInfo)
        ? search.UserInfo
        : search.UserInfo
        ? [search.UserInfo]
        : [];

      if (search.totalMatches) totalMatches = search.totalMatches;

      for (const user of usersRaw) {
        const numero_empleado =
          extractValue(user.employeeNo) || extractValue(user.employeeNoString);
        const nombre_completo = extractValue(user.name) || 'SIN NOMBRE';

        if (numero_empleado && !allUsers.some(u => u.numero_empleado === numero_empleado)) {
          allUsers.push({
            device: device.ip,
            numero_empleado,
            nombre_completo,
          });
        }
      }

      console.log(`${device.ip}: Recibidos ${usersRaw.length} | Total acumulado: ${allUsers.length}`);

      if (status === 'MORE') {
        searchPosition += maxResults;
      } else {
        hasMoreData = false;
      }

      await new Promise(r => setTimeout(r, 150));
    } catch (err) {
      console.error(`${device.ip}: ⚠️ Error obteniendo usuarios: ${err.message}`);
      hasMoreData = false;
    }
  }

  // === 2️⃣ Complemento numérico ===
  if (totalMatches > 0 && allUsers.length < totalMatches) {
    console.log(`🔍 Verificando usuarios faltantes (modo numérico)...`);
    const knownIds = new Set(allUsers.map(u => u.numero_empleado));

    for (let i = 1; i <= Math.max(totalMatches, 1500); i++) {
      if (knownIds.has(String(i))) continue;
      try {
        const url = `http://${device.ip}/ISAPI/AccessControl/UserInfo/Detail?format=json&employeeNo=${i}`;
        const res = await client.fetch(url, { method: 'GET', timeout: 8000 });
        if (!res.ok) continue;

        const userData = await res.json();
        const info = userData?.UserInfo;
        if (info) {
          const numero_empleado = extractValue(info.employeeNo) || extractValue(info.employeeNoString);
          const nombre_completo = extractValue(info.name) || 'SIN NOMBRE';

          if (numero_empleado && !knownIds.has(numero_empleado)) {
            allUsers.push({ device: device.ip, numero_empleado, nombre_completo });
            knownIds.add(numero_empleado);
          }
        }
      } catch (_) {}
      await new Promise(r => setTimeout(r, 30));
    }
  }

  // === 3️⃣ Búsqueda alfanumérica extendida ===
  const posiblesPrefijos = [
    'A','B','C','D','E','F','G','H','I','J','K','L','M',
    'N','O','P','Q','R','S','T','U','V','W','X','Y','Z',
    'U-','T-','M-','EMP','USR'
  ];

  if (allUsers.length < totalMatches) {
    console.log(`🔠 Buscando usuarios con IDs alfanuméricos...`);
    const knownIds = new Set(allUsers.map(u => u.numero_empleado));

    for (const pref of posiblesPrefijos) {
      for (let i = 0; i <= 1500; i++) {
        const id = `${pref}${i.toString().padStart(3, '0')}`;
        if (knownIds.has(id)) continue;

        try {
          const url = `http://${device.ip}/ISAPI/AccessControl/UserInfo/Detail?format=json&employeeNo=${encodeURIComponent(id)}`;
          const res = await client.fetch(url, { method: 'GET', timeout: 8000 });
          if (!res.ok) continue;

          const userData = await res.json();
          const info = userData?.UserInfo;
          if (info) {
            const numero_empleado = extractValue(info.employeeNo) || extractValue(info.employeeNoString);
            const nombre_completo = extractValue(info.name) || 'SIN NOMBRE';

            if (numero_empleado && !knownIds.has(numero_empleado)) {
              allUsers.push({ device: device.ip, numero_empleado, nombre_completo });
              knownIds.add(numero_empleado);
              if (allUsers.length % 100 === 0)
                console.log(`${device.ip}: Cargados ${allUsers.length}/${totalMatches}`);
            }
          }
        } catch (_) {}
        await new Promise(r => setTimeout(r, 20));
      }
    }
  }

  // === Resultado final ===
  console.log(`✅ ${device.ip}: ${allUsers.length}/${totalMatches || '?'} usuarios finales`);
  if (allUsers.length < totalMatches) {
    console.warn(`⚠️ ${device.ip}: Faltan ${totalMatches - allUsers.length} usuarios. Puede que existan IDs especiales (con espacios o UTF-8).`);
  }

  return allUsers;
}



async function fetchEventsFromDevice(device, startTime, endTime) {
  const client = new DigestFetch(device.user, device.pass);
  console.log(`📅 Extrayendo eventos de ${device.ip}`);

  const allEvents = [];
  let searchPosition = 0;
  const maxResults = 50;
  const searchId = `EVT-${Date.now()}`;
  let hasMoreData = true;

  while (hasMoreData) {
    try {
      const body = {
        AcsEventCond: {
          searchID: searchId,
          searchResultPosition: searchPosition,
          maxResults,
          startTime,
          endTime,
          major: 5, // acceso
        },
      };

      const res = await client.fetch(
        `http://${device.ip}/ISAPI/AccessControl/AcsEvent?format=json`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
          timeout: 30000,
        }
      );

      const data = await res.json();
      const infoList = data?.AcsEvent?.InfoList || [];

      for (const e of infoList) {
        const employeeNo = extractValue(e.employeeNo);
        const dateTime = extractValue(e.dateTime);
        const major = parseInt(extractValue(e.major), 10);
        const minor = parseInt(extractValue(e.minor), 10);

        // Determinar tipo de evento
        let tipo_evento = null;
        if ([1, 75, 77].includes(minor)) tipo_evento = 'ENTRADA';
        else if ([2, 76, 78].includes(minor)) tipo_evento = 'SALIDA';

        if (employeeNo && dateTime && tipo_evento) {
          allEvents.push({
            device: device.ip,
            employeeNo,
            tipo_evento,
            fecha_hora: new Date(dateTime),
            codigo_evento: `${major}-${minor}`,
          });
        }
      }

      const status = data?.AcsEvent?.responseStatusStrg;
      if (status === 'MORE') {
        searchPosition += maxResults;
      } else {
        hasMoreData = false;
      }
      await new Promise(r => setTimeout(r, 300));
    } catch (error) {
      console.error(`${device.ip}: ⚠️ Error eventos: ${error.message}`);
      hasMoreData = false;
    }
  }

  console.log(`✅ ${device.ip}: ${allEvents.length} eventos capturados`);
  return allEvents;
}

async function saveEventsToDB(events) {
  console.log('💾 Guardando registros de asistencia...');
  let insertados = 0;
  for (const ev of events) {
    try {
      // Buscar empleado por numero_empleado
      const [rows] = await db.query(
        'SELECT id FROM empleados WHERE numero_empleado = ?',
        [ev.employeeNo]
      );
      const empleado_id = rows[0]?.id || null;

      await db.query(
        `INSERT INTO registros_asistencia (empleado_id, tipo_evento, fecha_hora, dispositivo_ip, codigo_evento)
         VALUES (?, ?, ?, ?, ?)`,
        [empleado_id, ev.tipo_evento, ev.fecha_hora, ev.device, ev.codigo_evento]
      );

      insertados++;
    } catch (err) {
      console.error('❌ Error guardando evento:', err.message);
    }
  }
  console.log(`📈 ${insertados} registros insertados correctamente`);
}


// 🔹 Guardar empleados MEJORADO
async function saveEmployeesToDB(users) {
  console.log('💾 Guardando empleados en base de datos...');
  let inserted = 0;
  let updated = 0;
  let errors = 0;

  for (const user of users) {
    try {
      const result = await db.query(
        `INSERT INTO empleados (numero_empleado, nombre_completo, activo)
         VALUES (?, ?, 1)
         ON DUPLICATE KEY UPDATE 
           nombre_completo = VALUES(nombre_completo), 
           activo = 1,
           actualizado_en = NOW()`,
        [user.numero_empleado, user.nombre_completo]
      );

      if (result.affectedRows === 1) inserted++;
      else if (result.affectedRows === 2) updated++;
    } catch (error) {
      console.error(`Error guardando usuario ${user.numero_empleado}:`, error.message);
      errors++;
    }
  }

  console.log(`💾 Empleados: ${inserted} insertados, ${updated} actualizados, ${errors} errores`);
  return { inserted, updated, errors };
}

// 🔹 Función principal MEJORADA
async function syncBiometricData() {
  try {
    console.log('\n🚀 ===== INICIANDO SINCRONIZACIÓN AUTOMÁTICA =====');
    const now = new Date();
    
    // Calcular fecha objetivo (ayer)
    const targetDate = new Date(now);
    targetDate.setDate(targetDate.getDate() - 1);
    const dateString = targetDate.toISOString().split('T')[0];
    
    // Formato de fecha CORREGIDO para eventos
    const startTime = `${dateString}T00:00:00`;
    const endTime = `${dateString}T23:59:59`;
    
    console.log(`📅 Procesando fecha: ${dateString} (${startTime} a ${endTime})`);
    
    // 1. Sincronizar empleados
    console.log('\n👥 === SINCRONIZANDO EMPLEADOS ===');
    const employeeResults = [];
    
    for (const device of devices) {
      console.log(`\n🔧 Procesando dispositivo: ${device.ip}`);
      try {
        const deviceUsers = await fetchUsersFromDevice(device);
        employeeResults.push(deviceUsers);
        
        // Estadísticas por dispositivo
        const uniqueFromDevice = [...new Map(deviceUsers.map(item => [item.numero_empleado, item])).values()];
        console.log(`📊 ${device.ip}: ${uniqueFromDevice.length} usuarios únicos`);
        
      } catch (deviceError) {
        console.error(`💥 Error en dispositivo ${device.ip}:`, deviceError.message);
      }
      
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
    
    // Unificar y guardar empleados
    const allEmployees = employeeResults.flat();
    const uniqueEmployees = [...new Map(allEmployees.map(item => [item.numero_empleado, item])).values()];
    
    console.log(`\n📈 ESTADÍSTICAS FINALES EMPLEADOS:`);
    console.log(`- Total crudos: ${allEmployees.length}`);
    console.log(`- Únicos: ${uniqueEmployees.length}`);
    console.log(`- Por dispositivo: ${devices.map(d => d.ip).join(', ')}`);
    
    if (uniqueEmployees.length > 0) {
      const dbResult = await saveEmployeesToDB(uniqueEmployees);
      console.log(`- Base de datos: ${dbResult.inserted} nuevos, ${dbResult.updated} actualizados`);
    }
    
    // 2. Sincronizar eventos (solo si tenemos empleados)
    if (uniqueEmployees.length > 0) {
      console.log('\n📅 === SINCRONIZANDO EVENTOS ===');
      const eventResults = [];
      
      for (const device of devices) {
        console.log(`\n🔧 Procesando eventos de: ${device.ip}`);
        try {
          const deviceEvents = await fetchEventsFromDevice(device, startTime, endTime);
          eventResults.push(deviceEvents);
        } catch (eventError) {
          console.error(`💥 Error en eventos ${device.ip}:`, eventError.message);
        }
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
      
      // Procesar eventos a asistencias
      const allEvents = eventResults.flat();
      if (allEvents.length > 0) {
        console.log(`\n🔄 Procesando ${allEvents.length} eventos...`);
        // Aquí iría tu función processEventsToAsistencias
      } else {
        console.log('ℹ️  No se encontraron eventos para procesar');
      }
    }
    
    console.log('\n🎯 ===== SINCRONIZACIÓN COMPLETADA =====');
    
  } catch (error) {
    console.error('💥 Error en sincronización automática:', error);
  }
}

// 🕐 Configurar ejecución automática
function setupAutomaticSync() {
  // Ejecutar todos los días a las 00:05 AM
  cron.schedule('5 0 * * *', () => {
    console.log('\n⏰ ===== EJECUCIÓN AUTOMÁTICA INICIADA =====');
    syncBiometricData();
  });
  
  console.log('🕐 Programador configurado: Ejecución diaria a las 00:05 AM');
}

// 🚀 Inicio
(async () => {
  try {
    console.log('🔌 Conectando a base de datos...');
    
    // Ejecutar inmediatamente al iniciar
    await syncBiometricData();
    
    // Configurar ejecución automática para el futuro
    setupAutomaticSync();
    
    // Mantener el proceso activo
    console.log('\n🔮 Servicio de sincronización activo. Esperando próximas ejecuciones...');
    
  } catch (error) {
    console.error('💥 Error inicial:', error);
    process.exit(1);
  }
})();