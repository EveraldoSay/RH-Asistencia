// emailTemplates.js
function crearPlantillaRenovacionAgrupada(nombreEmpleado, turnos, mes) {
  const filasTurnos = turnos.map(t => `
    <tr>
      <td style="padding: 6px 10px; border: 1px solid #ddd;">${t.fecha}</td>
      <td style="padding: 6px 10px; border: 1px solid #ddd;">${t.turno}</td>
      <td style="padding: 6px 10px; border: 1px solid #ddd;">${t.horario}</td>
    </tr>
  `).join('');

  return `
    <div style="font-family: Arial, sans-serif; color: #333;">
      <h3>📅 Renovación de turnos rotativos</h3>
      <p>Hola <strong>${nombreEmpleado}</strong>,</p>
      <p>Se han renovado automáticamente tus turnos para el mes de <strong>${mes}</strong>.</p>

      <table style="border-collapse: collapse; width: 100%; margin-top: 10px;">
        <thead>
          <tr style="background: #f2f2f2;">
            <th style="padding: 8px; border: 1px solid #ddd;">Fecha</th>
            <th style="padding: 8px; border: 1px solid #ddd;">Turno</th>
            <th style="padding: 8px; border: 1px solid #ddd;">Horario</th>
          </tr>
        </thead>
        <tbody>${filasTurnos}</tbody>
      </table>

      <p style="margin-top: 15px;">
        <em>Hospital Regional de Occidente — Sistema de Asistencia</em>
      </p>
    </div>
  `;
}

function plantillaAsignacionNormal(emp, turno, asignacion, area = null, jefe = null) {
  return `
    <div style="font-family: Arial, sans-serif; color: #333; padding: 16px;">
      <h2 style="color: #0066cc;">📅 Nuevo turno asignado</h2>
      <p>Hola <strong>${emp.nombre_completo}</strong>,</p>
      <p>Se te ha asignado un nuevo turno en el sistema del hospital:</p>
      <ul>
        <li><strong>Área:</strong> ${area?.nombre || "No definida"}</li>
        <li><strong>Jefe de área:</strong> ${jefe?.nombre_completo || "No definido"}</li>
        <li><strong>Turno:</strong> ${turno.nombre}</li>
        <li><strong>Horario:</strong> ${turno.hora_inicio} - ${turno.hora_fin}</li>
        <li><strong>Fecha inicio:</strong> ${asignacion.fecha_inicio}</li>
        <li><strong>Fecha fin:</strong> ${asignacion.fecha_fin}</li>
      </ul>
      <p>Por favor, asegúrate de presentarte puntualmente en el horario indicado.</p>
      <hr>
      <small>Este correo es generado automáticamente por el sistema de gestión de turnos del Hospital Regional de Occidente.</small>
    </div>
  `;
}

function plantillaAsignacionReemplazo(emp, turno, asignacion, area = null, jefe = null, reemplazado = null) {
  return `
    <div style="font-family: Arial, sans-serif; color: #333; padding: 16px;">
      <h2 style="color: #cc6600;">🔄 Asignación de reemplazo</h2>
      <p>Hola <strong>${emp.nombre_completo}</strong>,</p>
      <p>Se te ha asignado un turno como <strong>reemplazo</strong> en el sistema del hospital:</p>
      <ul>
        <li><strong>Área:</strong> ${area?.nombre || "No definida"}</li>
        <li><strong>Jefe de área:</strong> ${jefe?.nombre_completo || "No definido"}</li>
        <li><strong>Turno:</strong> ${turno.nombre}</li>
        <li><strong>Horario:</strong> ${turno.hora_inicio} - ${turno.hora_fin}</li>
        <li><strong>Fecha inicio:</strong> ${asignacion.fecha_inicio}</li>
        <li><strong>Fecha fin:</strong> ${asignacion.fecha_fin}</li>
        <li><strong>Reemplazando a:</strong> ${reemplazado?.nombre_completo || "No especificado"}</li>
      </ul>
      <p>Gracias por tu apoyo cubriendo este turno.</p>
      <hr>
      <small>Este correo es generado automáticamente por el sistema de gestión de turnos del Hospital Regional de Occidente.</small>
    </div>
  `;
}

module.exports = {
  crearPlantillaRenovacionAgrupada,
  plantillaAsignacionNormal,
  plantillaAsignacionReemplazo
};
