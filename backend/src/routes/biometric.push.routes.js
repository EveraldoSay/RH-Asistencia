const express = require("express");
const xml2js = require("xml2js");
const db = require("../db.js");

const router = express.Router();

// Endpoint para recibir eventos PUSH desde los biométricos
router.post("/biometric/event", express.text({ type: "*/*" }), async (req, res) => {
  try {
    const rawBody = req.body;

    // Algunos dispositivos envían JSON, otros XML
    let eventData;
    if (rawBody.trim().startsWith("{")) {
      eventData = JSON.parse(rawBody);
    } else {
      eventData = await xml2js.parseStringPromise(rawBody, {
        explicitArray: false,
        mergeAttrs: true,
        tagNameProcessors: [xml2js.processors.stripPrefix],
      });
    }

    const evento = eventData?.AcsEvent?.Info || eventData?.AcsEventInfo;
    if (!evento) {
      return res.status(200).send("OK");
    }

    const numeroEmpleado = evento.employeeNo || evento.employeeNoString;
    const nombre = evento.name || "Desconocido";
    const fechaHora = evento.time || evento.dateTime || evento.eventTime;
    const deviceIP = req.ip || "desconocido";


    // Buscar empleado en BD
    const [empleado] = await db.query(
      "SELECT id FROM empleados WHERE numero_empleado = ? LIMIT 1",
      [numeroEmpleado]
    );

    if (!empleado.length) {
      console.warn(`Empleado no encontrado (${numeroEmpleado})`);
      return res.status(200).send("Empleado no encontrado");
    }

    const empleado_id = empleado[0].id;

    // Registrar marcaje en asistencias
    await db.query(
      `
      INSERT INTO asistencias (empleado_id, fecha, turno_id, entrada_real, estado)
      VALUES (?, CURDATE(), 1, ?, 'COMPLETO')
      ON DUPLICATE KEY UPDATE salida_real = VALUES(entrada_real)
      `,
      [empleado_id, fechaHora]
    );

    res.status(200).send("OK");
  } catch (err) {
    console.error("Error procesando evento:", err.message);
    res.status(500).send("ERROR");
  }
});

module.exports = router;
