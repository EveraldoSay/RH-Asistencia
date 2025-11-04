const nodemailer = require('nodemailer');
const { crearPlantillaRenovacionAgrupada } = require('./emailTemplates');

//Configuración del transporte con variables de entorno
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: process.env.SMTP_PORT || 587, 
  secure: false, // true para 465, false para otros
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

/**
 * Enviar correo de notificación de asignación de turno
 * @param {string} to Correo del empleado
 * @param {string} subject Asunto
 * @param {string} html Contenido en HTML
 */
async function sendEmail(to, subject, html) {
  try {
    await transporter.sendMail({
      from: `"Hospital Regional" <${process.env.SMTP_USER}>`,
      to,
      subject,
      html,
    });
    (`Email enviado a ${to}`);
    return true;
  } catch (error) {
    console.error("Error enviando email:", error);
    return false;
  }
}

async function enviarCorreosRenovacionAgrupada(empleadosTurnos, mesRenovado) {
  // empleadosTurnos: [{ empleado, turnos: [{ fecha, turno, horario }] }]
  for (const empleado of empleadosTurnos) {
    const { email, nombre_completo } = empleado;
    const turnos = empleado.turnos;

    if (!email) continue;

    const asunto = `Renovación de turnos rotativos — ${mesRenovado}`;
    const html = crearPlantillaRenovacionAgrupada(nombre_completo, turnos, mesRenovado);

    try {
      await transporter.sendMail({
        from: 'Sistema de Asistencia <notificaciones@hospitaloccidente.gt>',
        to: email,
        subject: asunto,
        html
      });

      (`Correo agrupado enviado a ${nombre_completo}`);
    } catch (error) {
      console.error(`Error enviando correo agrupado a ${nombre_completo}:`, error);
    }
  }
}

module.exports = { sendEmail, enviarCorreosRenovacionAgrupada };
module.exports = { sendEmail };
