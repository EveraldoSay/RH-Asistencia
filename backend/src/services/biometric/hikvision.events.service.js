import xml2js from 'xml2js';
import { makeClient } from './hikvision.client.cjs';
import db from '../../db.js';

// Construye config de dispositivos
function buildConfig(prefix) {
  return {
    host: process.env[`${prefix}_HOST`],
    port: process.env[`${prefix}_PORT`] || '80',
    user: process.env[`${prefix}_USER`],
    pass: process.env[`${prefix}_PASS`],
    proto: process.env[`${prefix}_PROTOCOL`] || 'http'
  };
}

const devices = [buildConfig('HIK1'), buildConfig('HIK2')].filter(d => d.host);

// Extraer eventos de marcaje (entradas y salidas)
export async function syncEventosDesdeBiometricos() {
  console.log('Iniciando sincronización de eventos desde biométricos...');
  let totalEventos = 0;

  for (const dev of devices) {
    try {
      const client = makeClient({
        baseUrl: `${dev.proto}://${dev.host}:${dev.port}`,
        user: dev.user,
        pass: dev.pass
      });

      console.log(`Consultando eventos desde ${dev.host}...`);

      const body = {
        AcsEventCond: {
          searchID: "1",
          maxResults: 500,
          searchResultPosition: 0,
          major: 0,
          minor: 0,
          startTime: "2025-01-01T00:00:00",
          endTime: "2025-12-31T23:59:59"
        }
      };

      // Intentar formato JSON
      let data;
      try {
        data = await client.post(`/ISAPI/AccessControl/AcsEventTotalNum?format=json`, body);
      } catch (jsonErr) {
        // Fallback XML
        const xmlBody = `
          <AcsEventCond>
            <searchID>1</searchID>
            <maxResults>500</maxResults>
            <searchResultPosition>0</searchResultPosition>
          </AcsEventCond>
        `;
        const xmlResp = await client.post(`/ISAPI/AccessControl/AcsEvent`, xmlBody, {
          headers: { 'Content-Type': 'application/xml' }
        });
        data = await xml2js.parseStringPromise(xmlResp, { explicitArray: false });
      }

      const eventos = data?.AcsEvent?.InfoList || data?.AcsEventNotificationList || [];

      const lista = Array.isArray(eventos) ? eventos : [eventos];
      console.log(`${lista.length} eventos recibidos desde ${dev.host}`);

      // Procesar y guardar en la BD
      for (const ev of lista) {
        const empNo = ev?.EmployeeNoString || ev?.employeeNo || ev?.EmployeeNo || null;
        const fechaHora = ev?.dateTime || ev?.time || null;
        if (!empNo || !fechaHora) continue;

        const fecha = fechaHora.split('T')[0];
        const hora = new Date(fechaHora);

        // buscar el empleado en la BD
        const [rows] = await db.query('SELECT id FROM empleados WHERE numero_empleado = ?', [empNo]);
        if (!rows.length) continue;

        const empleado_id = rows[0].id;

        // Buscar turno actual del empleado
        const [[turno]] = await db.query(`
          SELECT t.id, t.hora_inicio, t.hora_fin
          FROM asignacion_turnos a
          INNER JOIN turnos t ON t.id = a.turno_id
          WHERE a.empleado_id = ? AND ? BETWEEN a.fecha_inicio AND a.fecha_fin
          LIMIT 1;
        `, [empleado_id, fecha]);

        if (!turno) continue;

        // Verificar si ya existe registro para esa fecha
        const [[existente]] = await db.query(`
          SELECT id, entrada_real, salida_real FROM asistencias
          WHERE empleado_id = ? AND fecha = ?;
        `, [empleado_id, fecha]);

        if (!existente) {
          // crear primera marca como entrada
          await db.query(`
            INSERT INTO asistencias (empleado_id, fecha, turno_id, entrada_real, estado)
            VALUES (?, ?, ?, ?, 'INCOMPLETO')
          `, [empleado_id, fecha, turno.id, hora]);
        } else if (!existente.salida_real) {
          // actualizar como salida
          await db.query(`
            UPDATE asistencias
            SET salida_real = ?, estado = 'COMPLETO'
            WHERE id = ?;
          `, [hora, existente.id]);
        }
      }

      totalEventos += lista.length;
    } catch (err) {
      console.error(` Error procesando ${dev.host}:`, err.message);
    }
  }

  console.log(`Total de eventos procesados: ${totalEventos}`);
  return { success: true, total: totalEventos };
}
