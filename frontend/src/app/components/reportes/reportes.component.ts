import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ReportesService } from '../../services/reportes.service';
import jsPDF from 'jspdf';
import * as XLSX from 'xlsx';
import autoTable from 'jspdf-autotable';

@Component({
  selector: 'app-reportes',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './reportes.component.html',
  styleUrls: ['./reportes.component.scss']
})
export class ReportesComponent implements OnInit {
  private repService = inject(ReportesService);
  empleadoBusqueda: string = '';
  empleadosEncontrados: any[] = [];
  empleadoSeleccionado: any = null;
  mostrandoResultados: boolean = false;
  areas: any[] = [];
  registros: any[] = [];
  eventosBiometricos: any[] = [];

  areaSeleccionada: number | null = null;
  mesSeleccionado = '';   // formato YYYY-MM
  semanaSeleccionada: any = null;
  semanas: any[] = [];
  tipoReporte: string = 'semana';
  diaEspecifico: string = '';

  fechaDesde: string = '';
  fechaHasta: string = '';
  tipoFiltroBiometricos: string = 'mes'; // 'mes', 'dia', 'r

  cargando = false;

  ngOnInit() {
    this.repService.getAreas().subscribe({
      next: (res) => {
        this.areas = res.areas;
      },
      error: (err) => {
        console.error('Error cargando áreas:', err);
      }
    });
  }

  obtenerNombreArea() {
    const areaObj = this.areas.find(a => a.id === this.areaSeleccionada);
    return areaObj ? areaObj.nombre_area : 'Área no encontrada';
  }

  generarSemanas() {
    if (!this.mesSeleccionado) return;

    const [year, month] = this.mesSeleccionado.split('-').map(Number);
    const fechaInicioMes = new Date(year, month - 1, 1);
    const diasMes = new Date(year, month, 0).getDate();

    this.semanas = [];

    // Agregar opción "Mes Completo"
    this.semanas.push({
      numero: 0,
      desde: `${year}-${month.toString().padStart(2, '0')}-01`,
      hasta: `${year}-${month.toString().padStart(2, '0')}-${diasMes}`,
      texto: `Mes Completo (1-${diasMes} ${fechaInicioMes.toLocaleString('es', { month: 'short' })})`
    });

    let diaActual = 1;
    let numeroSemana = 1;

    while (diaActual <= diasMes) {
      const inicio = diaActual;
      const fin = Math.min(diaActual + 6, diasMes);
      const desde = new Date(year, month - 1, inicio).toISOString().split('T')[0];
      const hasta = new Date(year, month - 1, fin).toISOString().split('T')[0];
      const texto = `Semana ${numeroSemana}: ${inicio}–${fin} ${fechaInicioMes.toLocaleString('es', { month: 'short' })}`;
      this.semanas.push({ numero: numeroSemana, desde, hasta, texto });
      diaActual += 7;
      numeroSemana++;
    }

    this.semanaSeleccionada = null;
  }

  generarReporte() {
      if (this.tipoReporte === 'biometricos') {
        this.generarReporteBiometricos();
      } else {
        this.generarReporteAsistencia();
      }
    }

  generarReporteAsistencia() {
    if (!this.areaSeleccionada) {
      alert('Seleccione un área.');
      return;
    }

    if (this.tipoReporte === 'semana' && !this.semanaSeleccionada) {
      alert('Seleccione una semana.');
      return;
    }

    let desde: string, hasta: string;

    if (this.tipoReporte === 'todo') {
      // Reporte completo sin filtro de fecha
      desde = '';
      hasta = '';
    } else if (this.tipoReporte === 'mes' && this.mesSeleccionado) {
      // Reporte del mes completo
      const [year, month] = this.mesSeleccionado.split('-').map(Number);
      const diasMes = new Date(year, month, 0).getDate();
      desde = `${year}-${month.toString().padStart(2, '0')}-01`;
      hasta = `${year}-${month.toString().padStart(2, '0')}-${diasMes}`;
    } else {
      // Reporte por semana
      desde = this.semanaSeleccionada.desde;
      hasta = this.semanaSeleccionada.hasta;
    }

    this.cargando = true;

    this.repService.getReporte(this.areaSeleccionada, desde, hasta, this.tipoReporte).subscribe({
      next: (res) => {
        this.registros = res.registros;
        this.eventosBiometricos = []; // Limpiar eventos biométricos
        this.cargando = false;
      },
      error: (err) => {
        console.error('Error al generar reporte:', err);
        this.cargando = false;
        alert('Error al generar el reporte: ' + err.message);
      }
    });
  }

    buscarEmpleados() {
      if (this.empleadoBusqueda.length < 2) {
        this.empleadosEncontrados = [];
        this.mostrandoResultados = false;
        return;
      }

      this.repService.buscarEmpleados(this.empleadoBusqueda).subscribe({
        next: (res) => {
          this.empleadosEncontrados = res.empleados;
          this.mostrandoResultados = true;
        },
        error: (err) => {
          console.error('Error buscando empleados:', err);
          this.empleadosEncontrados = [];
          this.mostrandoResultados = false;
        }
      });
    }

    // Método para seleccionar un empleado
  seleccionarEmpleado(empleado: any) {
    this.empleadoSeleccionado = empleado;
    this.empleadoBusqueda = empleado.nombre_completo;
    this.mostrandoResultados = false;
  }

    // Método para limpiar la selección
    limpiarBusquedaEmpleado() {
      this.empleadoSeleccionado = null;
      this.empleadoBusqueda = '';
      this.empleadosEncontrados = [];
      this.mostrandoResultados = false;
    }


      // Modificar el método generarReporteBiometricos
  generarReporteBiometricos() {
    // Validaciones según el tipo de filtro seleccionado
    if (this.tipoFiltroBiometricos === 'mes' && !this.mesSeleccionado) {
      alert('Seleccione un mes para generar el reporte de eventos biométricos.');
      return;
    }

    if (this.tipoFiltroBiometricos === 'dia' && !this.diaEspecifico) {
      alert('Seleccione un día específico para generar el reporte de eventos biométricos.');
      return;
    }

    if (this.tipoFiltroBiometricos === 'rango' && (!this.fechaDesde || !this.fechaHasta)) {
      alert('Seleccione ambas fechas (desde y hasta) para generar el reporte de eventos biométricos.');
      return;
    }

    if (this.tipoFiltroBiometricos === 'rango') {
      const desde = new Date(this.fechaDesde);
      const hasta = new Date(this.fechaHasta);
      
      if (desde > hasta) {
        alert('La fecha "Desde" no puede ser mayor que la fecha "Hasta".');
        return;
      }

      // Validar que el rango no sea muy extenso (opcional)
      const diffTime = Math.abs(hasta.getTime() - desde.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      
      if (diffDays > 31) {
        if (!confirm(`Está solicitando un reporte de ${diffDays} días. Esto puede generar un archivo muy grande. ¿Desea continuar?`)) {
          return;
        }
      }
    }

    this.cargando = true;

    const parametro = this.tipoFiltroBiometricos === 'dia' ? this.diaEspecifico : 
                    this.tipoFiltroBiometricos === 'mes' ? this.mesSeleccionado : 
                    this.fechaDesde; // Para rango, podemos enviar cualquier fecha como parámetro base

    const empleadoId = this.empleadoSeleccionado ? this.empleadoSeleccionado.id : undefined;

    this.repService.getEventosBiometricos(
      parametro, 
      this.tipoFiltroBiometricos, 
      empleadoId, 
      this.fechaDesde, 
      this.fechaHasta
    ).subscribe({
      next: (res) => {
        this.eventosBiometricos = res.eventos;
        this.registros = [];
        this.cargando = false;
        console.log('Reporte de eventos biométricos generado:', res.eventos.length, 'eventos');
      },
      error: (err) => {
        console.error('Error al generar reporte de eventos biométricos:', err);
        this.cargando = false;
        alert('Error al generar el reporte de eventos biométricos: ' + err.message);
      }
    });
  }

  onTipoFiltroBiometricosChange() {
    // Limpiar campos no utilizados según el tipo de filtro
    if (this.tipoFiltroBiometricos === 'mes') {
      this.diaEspecifico = '';
      this.fechaDesde = '';
      this.fechaHasta = '';
    } else if (this.tipoFiltroBiometricos === 'dia') {
      this.mesSeleccionado = '';
      this.fechaDesde = '';
      this.fechaHasta = '';
    } else if (this.tipoFiltroBiometricos === 'rango') {
      this.mesSeleccionado = '';
      this.diaEspecifico = '';
    }
    
    // Limpiar resultados anteriores
    this.eventosBiometricos = [];
  }

obtenerResumen() {
    if (this.tipoReporte === 'biometricos') {
      const total = this.eventosBiometricos.length;
      const entradas = this.eventosBiometricos.filter(e => e.tipo_evento === 'ENTRADA').length;
      const salidas = this.eventosBiometricos.filter(e => e.tipo_evento === 'SALIDA').length;
      
      return { 
        total, 
        entradas, 
        salidas,
        tipo: 'biometricos'
      };
    } else {
      const total = this.registros.length;
      const presentes = this.registros.filter(r => 
        r.estado_dia === 'Presente' || 
        (r.entrada_real && r.estado_dia !== 'Ausente')
      ).length;
      const ausentes = total - presentes;
      
      return { total, presentes, ausentes, tipo: 'asistencia' };
    }
  }


  // MÉTODOS PARA LAS CLASES DINÁMICAS
  getCumplimientoClass(valor: string): string {
    if (!valor) return '';
    const v = valor.toLowerCase();

    if (v.includes('cumple')) return 'cumplimiento-exito';       
    if (v.includes('retraso')) return 'cumplimiento-advertencia'; 
    if (v.includes('ausente')) return 'cumplimiento-error';       
    if (v.includes('no aplica')) return 'cumplimiento-exento';    
    return '';
  }


  getEstadoClass(estado: string): string {
    if (!estado) return '';
    if (estado.includes('No obligatorio')) return 'estado-exento';
    if (estado.includes('Presente')) return 'estado-presente';
    if (estado.includes('Ausente')) return 'estado-ausente';
    if (estado.includes('Retraso') || estado.includes('Tarde')) return 'estado-retraso';
    
    return '';
  }

descargarExcel() {
    if (this.registros.length === 0 && this.eventosBiometricos.length === 0) {
      alert('No hay datos para exportar.');
      return;
    }

    if (this.tipoReporte === 'biometricos') {
      this.descargarExcelEventosBiometricos();
    } else {
      this.descargarExcelAsistencia();
    }
  }

  descargarExcelAsistencia() {
    if (this.registros.length === 0) {
      alert('No hay datos para exportar.');
      return;
    }

    const nombreArea = this.obtenerNombreArea();
    const fechaGen = new Date().toLocaleDateString('es-GT');
    const rango = this.obtenerRangoSeleccionado();
    
    // Preparar datos para Excel
    const datos = this.registros.map((r, index) => ({
      '#': index + 1,
      'Área': r.area,
      'Jefe de Área': r.jefe_area || 'No asignado',
      'Empleado': r.empleado,
      'Cargo': r.cargo,
      'Fecha': this.formatearFecha(r.fecha),
      'Turno': r.turno_asignado || 'N/A',
      'Tipo Turno': r.tipo_turno || 'N/A',
      'Entrada Programada': r.hora_entrada_programada || 'N/A',
      'Salida Programada': r.hora_salida_programada || 'N/A',
      'Entrada Real': r.entrada_real ? this.formatearHora(r.entrada_real) : '--:--',
      'Salida Real': r.salida_real ? this.formatearHora(r.salida_real) : '--:--',
      'Cumplimiento': r.cumplimiento,
      'Estado': r.estado_dia
    }));

    // Crear workbook y worksheet
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(datos);

    // Agregar encabezado con información del reporte
    const encabezado = [
      ['Hospital Regional de Occidente'],
      ['Reporte de Asistencia por Área'],
      [`Área: ${nombreArea}`],
      [`Período: ${rango}`],
      [`Tipo: ${this.obtenerTipoReporteTexto()}`],
      [`Generado: ${fechaGen}`],
      [`Total registros: ${this.registros.length}`],
      [] // Línea en blanco
    ];

    XLSX.utils.sheet_add_aoa(ws, encabezado, { origin: 'A1' });

    // Estilizar el encabezado
    if (!ws['!merges']) ws['!merges'] = [];
    ws['!merges'].push({ s: { r: 0, c: 0 }, e: { r: 0, c: 12 } });
    ws['!merges'].push({ s: { r: 1, c: 0 }, e: { r: 1, c: 12 } });

    // Ajustar anchos de columnas
    const colWidths = [
      { wch: 5 },   // #
      { wch: 15 },  // Área
      { wch: 20 },  // Jefe de Área
      { wch: 25 },  // Empleado
      { wch: 20 },  // Cargo
      { wch: 12 },  // Fecha
      { wch: 15 },  // Turno
      { wch: 12 },  // Tipo Turno
      { wch: 18 },  // Entrada Programada
      { wch: 18 },  // Salida Programada
      { wch: 15 },  // Entrada Real
      { wch: 15 },  // Salida Real
      { wch: 15 },  // Cumplimiento
      { wch: 15 }   // Estado
    ];
    ws['!cols'] = colWidths;

    // Agregar worksheet al workbook
    XLSX.utils.book_append_sheet(wb, ws, 'Reporte Asistencia');

    // Generar nombre de archivo
    const nombreArchivo = `Reporte_Asistencia_${nombreArea.replace(/\s+/g, '_')}_${fechaGen.replace(/\//g, '-')}.xlsx`;

    // Descargar archivo
    XLSX.writeFile(wb, nombreArchivo);
  }

  descargarExcelEventosBiometricos() {
    if (this.eventosBiometricos.length === 0) {
      alert('No hay eventos biométricos para exportar.');
      return;
    }

    const fechaGen = new Date().toLocaleDateString('es-GT');
    const resumen = this.obtenerResumen();
    
    // Preparar datos para Excel
    const datos = this.eventosBiometricos.map((evento, index) => ({
      '#': index + 1,
      'ID': evento.id,
      'Empleado': evento.empleado || 'No identificado',
      'Tipo Evento': evento.tipo_evento,
      'Fecha': evento.fecha,
      'Hora': evento.hora,
      'Dispositivo IP': evento.dispositivo_ip || 'N/A',
      'Código Evento': evento.codigo_evento || 'N/A',
      'Origen': evento.origen,
      'Procesado': evento.procesado ? 'Sí' : 'No',
      'Registrado En': evento.creado_en ? 
        `${this.formatearFecha(evento.creado_en)} ${this.formatearHora(evento.creado_en)}` : 'N/A'
    }));

    // Crear workbook y worksheet
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(datos);

    // Agregar encabezado con información del reporte
    const periodoInfo = this.diaEspecifico ? 
      `Día: ${this.formatearFecha(this.diaEspecifico)}` : 
      `Mes: ${this.mesSeleccionado}`;

    const encabezado = [
      ['Hospital Regional de Occidente'],
      ['Reporte de Eventos Biométricos'],
      [periodoInfo],
      [`Total eventos: ${resumen.total} | Entradas: ${resumen.entradas} | Salidas: ${resumen.salidas}`],
      [`Generado: ${fechaGen}`],
      [] // Línea en blanco
    ];

    XLSX.utils.sheet_add_aoa(ws, encabezado, { origin: 'A1' });

    // Estilizar el encabezado
    if (!ws['!merges']) ws['!merges'] = [];
    ws['!merges'].push({ s: { r: 0, c: 0 }, e: { r: 0, c: 9 } });
    ws['!merges'].push({ s: { r: 1, c: 0 }, e: { r: 1, c: 9 } });
    ws['!merges'].push({ s: { r: 2, c: 0 }, e: { r: 2, c: 9 } });
    ws['!merges'].push({ s: { r: 3, c: 0 }, e: { r: 3, c: 9 } });

    // Ajustar anchos de columnas
    const colWidths = [
      { wch: 5 },   // #
      { wch: 8 },   // ID
      { wch: 25 },  // Empleado
      { wch: 12 },  // Tipo Evento
      { wch: 12 },  // Fecha
      { wch: 10 },  // Hora
      { wch: 15 },  // Dispositivo IP
      { wch: 15 },  // Código Evento
      { wch: 10 },  // Origen
      { wch: 10 },  // Procesado
      { wch: 20 }   // Registrado En
    ];
    ws['!cols'] = colWidths;

    // Agregar worksheet al workbook
    XLSX.utils.book_append_sheet(wb, ws, 'Eventos Biométricos');

    // Generar nombre de archivo
    const nombreArchivo = `Reporte_Eventos_Biometricos_${this.mesSeleccionado || this.diaEspecifico}_${fechaGen.replace(/\//g, '-')}.xlsx`;

    // Descargar archivo
    XLSX.writeFile(wb, nombreArchivo);
  }

  descargarPDF() {
    if (this.registros.length === 0 && this.eventosBiometricos.length === 0) {
      alert('No hay datos para exportar.');
      return;
    }

    if (this.tipoReporte === 'biometricos') {
      this.descargarPDFEventosBiometricos();
    } else {
      this.descargarPDFAsistencia();
    }
  }



descargarPDFAsistencia() {
  if (this.registros.length === 0) {
    alert('No hay datos para exportar.');
    return;
  }  

  if (!this.areaSeleccionada) {
    console.error('No hay área seleccionada para el PDF');
    alert('Error: No se ha seleccionado un área válida.');
    return;
  }

  let nombreArea = this.obtenerNombreArea();

  if (nombreArea === 'Área no encontrada' && this.registros.length > 0) {
    nombreArea = this.registros[0].area || 'Área_Desconocida';
  }

  const doc = new jsPDF('l', 'mm', 'a4');
  const logo = new Image();
  logo.src = 'assets/logo-hospital.png';

  const fechaGen = new Date().toLocaleDateString('es-GT');
  const rango = this.obtenerRangoSeleccionado();
  const resumen = this.obtenerResumen();

  const nombreArchivo = `Reporte_${nombreArea.replace(/\s+/g, '_')}_${this.tipoReporte}_${fechaGen.replace(/\//g, '-')}.pdf`;

  logo.onload = () => {
    // --- Encabezado ---
    doc.setFontSize(10);
    try {
      doc.addImage(logo, 'PNG', 14, 8, 25, 25);
    } catch (e) {
      console.warn('No se pudo cargar el logo, continuando sin imagen...');
    }

    doc.setFont('helvetica', 'bold');
    doc.text('Hospital Regional de Occidente', 45, 15);
    doc.setFontSize(12);
    doc.text('Reporte de Asistencia por Área', 45, 23);

    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text(`Área: ${nombreArea}`, 14, 38);
    doc.text(`Periodo: ${rango}`, 90, 38);
    doc.text(`Tipo: ${this.obtenerTipoReporteTexto()}`, 140, 38);
    doc.text(`Generado: ${fechaGen}`, 200, 38);

    doc.text(
      `Total: ${resumen.total} | Presentes: ${resumen.presentes} | Ausentes: ${resumen.ausentes}`,
      14,
      45
    );

    // --- Datos de la tabla ---
    const columnas = [
      { header: 'Empleado', dataKey: 'empleado' },
      { header: 'Cargo', dataKey: 'cargo' },
      { header: 'Fecha', dataKey: 'fecha' },
      { header: 'Turno', dataKey: 'turno_asignado' },
      { header: 'Tipo Turno', dataKey: 'tipo_turno' },
      { header: 'Entrada Prog.', dataKey: 'hora_entrada_programada' },
      { header: 'Salida Prog.', dataKey: 'hora_salida_programada' },
      { header: 'Entrada Real', dataKey: 'entrada_real' },
      { header: 'Salida Real', dataKey: 'salida_real' },
      { header: 'Cumplimiento', dataKey: 'cumplimiento' },
      { header: 'Estado', dataKey: 'estado_dia' }
    ];

    const filas = this.registros.map((r) => ({
      empleado: r.empleado,
      cargo: r.cargo,
      fecha: this.formatearFecha(r.fecha),
      turno_asignado: r.turno_asignado || 'N/A',
      tipo_turno: r.tipo_turno || 'N/A',
      hora_entrada_programada: r.hora_entrada_programada || 'N/A',
      hora_salida_programada: r.hora_salida_programada || 'N/A',
      entrada_real: r.entrada_real ? this.formatearHora(r.entrada_real) : '--:--',
      salida_real: r.salida_real ? this.formatearHora(r.salida_real) : '--:--',
      cumplimiento: r.cumplimiento,
      estado_dia: r.estado_dia
    }));

    autoTable(doc, {
      columns: columnas,
      body: filas,
      startY: 50,
      styles: { 
        fontSize: 8, 
        cellPadding: 2,
        font: 'helvetica'
      },
      headStyles: { 
        fillColor: [0, 82, 155], 
        textColor: 255, 
        halign: 'center',
        fontStyle: 'bold'
      },
      alternateRowStyles: { fillColor: [240, 240, 240] },
      columnStyles: { 
        cumplimiento: { halign: 'center' }, 
        estado_dia: { halign: 'center' },
        tipo_turno: { halign: 'center' },
        // Aplicar negritas a horas reales
        entrada_real: { fontStyle: 'bold' },
        salida_real: { fontStyle: 'bold' }
      },
      // Aplicar estilos condicionales a las celdas
      didParseCell: (data) => {
        // Colorear tipo de turno
        if (data.column.dataKey === 'tipo_turno' && data.cell.raw) {
          if (data.cell.raw === 'FIJO') {
            data.cell.styles.fillColor = [40, 167, 69]; // Verde
            data.cell.styles.textColor = 255;
          } else if (data.cell.raw === 'ROTATIVO') {
            data.cell.styles.fillColor = [23, 162, 184]; // Azul
            data.cell.styles.textColor = 255;
          }
        }

        // Colorear estado de cumplimiento
        if (data.column.dataKey === 'cumplimiento' && data.cell.raw) {
          const cumplimiento = typeof data.cell.raw === 'string' ? data.cell.raw.toLowerCase() : '';
          if (cumplimiento.includes('cumple')) {
            data.cell.styles.textColor = [25, 135, 84]; // Verde
            data.cell.styles.fontStyle = 'bold';
          } else if (cumplimiento.includes('retraso')) {
            data.cell.styles.textColor = [230, 126, 34]; // Naranja
            data.cell.styles.fontStyle = 'bold';
          } else if (cumplimiento.includes('ausente')) {
            data.cell.styles.textColor = [220, 53, 69]; // Rojo
            data.cell.styles.fontStyle = 'bold';
          } else if (cumplimiento.includes('no aplica')) {
            data.cell.styles.textColor = [32, 201, 151]; // Verde claro
            data.cell.styles.fontStyle = 'bold';
          }
        }

        // Colorear estado del día
        if (data.column.dataKey === 'estado_dia' && data.cell.raw) {
          const estado = typeof data.cell.raw === 'string' ? data.cell.raw.toLowerCase() : '';
          if (estado.includes('presente') && !estado.includes('no obligatorio')) {
            data.cell.styles.textColor = [25, 135, 84]; // Verde
            data.cell.styles.fontStyle = 'bold';
          } else if (estado.includes('ausente')) {
            data.cell.styles.textColor = [220, 53, 69]; // Rojo
            data.cell.styles.fontStyle = 'bold';
          } else if (estado.includes('retraso') || estado.includes('tarde')) {
            data.cell.styles.textColor = [255, 193, 7]; // Amarillo
            data.cell.styles.fontStyle = 'bold';
          } else if (estado.includes('no obligatorio')) {
            data.cell.styles.textColor = [32, 201, 151]; // Verde claro
            data.cell.styles.fontStyle = 'bold';
          }
        }
      },
      didDrawPage: (data) => {
        const pageSize = doc.internal.pageSize;
        const pageHeight = pageSize.height || pageSize.getHeight();
        doc.setFontSize(8);
        doc.text(
          `Página ${doc.getNumberOfPages()} | Generado: ${fechaGen}`,
          14,
          pageHeight - 5
        );
      }
    });

    doc.save(nombreArchivo);
  };

  setTimeout(() => {
    if (!logo.complete) {
      console.warn('Sin logo, generando PDF...');
      if (typeof logo.onload === 'function') {
        logo.onload(new Event('load'));
      }
    }
  }, 500);
}


  obtenerTipoReporteTexto(): string {
    switch (this.tipoReporte) {
      case 'semana': return 'Por Semana';
      case 'mes': return 'Mes Completo';
      case 'todo': return 'Todo el Historial';
      case 'biometricos': return 'Eventos Biométricos';
      default: return 'No especificado';
    }
  }


  descargarPDFEventosBiometricos() {
    if (this.eventosBiometricos.length === 0) {
      alert('No hay eventos biométricos para exportar.');
      return;
    }

    const doc = new jsPDF('l', 'mm', 'a4');
    const logo = new Image();
    logo.src = 'assets/logo-hospital.png';

    const fechaGen = new Date().toLocaleDateString('es-GT');
    const resumen = this.obtenerResumen();
    const nombreArchivo = `Reporte_Eventos_Biometricos_${this.mesSeleccionado || this.diaEspecifico}.pdf`;

    logo.onload = () => {
      // Encabezado
      doc.setFontSize(10);
      try {
        doc.addImage(logo, 'PNG', 14, 8, 25, 25);
      } catch (e) {
        console.warn('No se pudo cargar el logo...');
      }

      doc.setFont('helvetica', 'bold');
      doc.text('Hospital Regional de Occidente', 45, 15);
      doc.setFontSize(12);
      doc.text('Reporte de Eventos Biométricos', 45, 23);

      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      
      // Mostrar mes o día específico según corresponda
      if (this.diaEspecifico) {
        doc.text(`Día: ${this.formatearFecha(this.diaEspecifico)}`, 14, 38);
      } else {
        doc.text(`Mes: ${this.mesSeleccionado}`, 14, 38);
      }
      
      doc.text(`Total eventos: ${resumen.total}`, 90, 38);
      doc.text(`Entradas: ${resumen.entradas} | Salidas: ${resumen.salidas}`, 140, 38);
      doc.text(`Generado: ${fechaGen}`, 200, 38);

      // Columnas para eventos biométricos
      const columnas = [
        { header: 'Empleado', dataKey: 'empleado' },
        { header: 'Tipo Evento', dataKey: 'tipo_evento' },
        { header: 'Fecha', dataKey: 'fecha' },
        { header: 'Hora', dataKey: 'hora' },
        { header: 'Dispositivo IP', dataKey: 'dispositivo_ip' },
        { header: 'Código Evento', dataKey: 'codigo_evento' },
        { header: 'Origen', dataKey: 'origen' },
        { header: 'Procesado', dataKey: 'procesado' }
      ];

      const filas = this.eventosBiometricos.map((e) => ({
        empleado: e.empleado || 'No identificado',
        tipo_evento: e.tipo_evento,
        fecha: this.formatearFecha(e.fecha),
        hora: e.hora,
        dispositivo_ip: e.dispositivo_ip || 'N/A',
        codigo_evento: e.codigo_evento || 'N/A',
        origen: e.origen,
        procesado: e.procesado ? 'Sí' : 'No'
      }));

      autoTable(doc, {
        columns: columnas,
        body: filas,
        startY: 50,
        styles: { 
          fontSize: 8, 
          cellPadding: 2,
          font: 'helvetica'
        },
        headStyles: { 
          fillColor: [0, 82, 155], 
          textColor: 255, 
          halign: 'center',
          fontStyle: 'bold'
        },
        alternateRowStyles: { fillColor: [240, 240, 240] },
        columnStyles: { 
          tipo_evento: { halign: 'center' },
          procesado: { halign: 'center' },
          // Aplicar negritas a la hora
          hora: { fontStyle: 'bold' }
        },
        // Aplicar estilos condicionales
        didParseCell: (data) => {
          // Colorear tipo de evento (ENTRADA/SALIDA)
          if (data.column.dataKey === 'tipo_evento' && data.cell.raw) {
            if (data.cell.raw === 'ENTRADA') {
              data.cell.styles.fillColor = [40, 167, 69]; // Verde
              data.cell.styles.textColor = 255;
              data.cell.styles.fontStyle = 'bold';
            } else if (data.cell.raw === 'SALIDA') {
              data.cell.styles.fillColor = [23, 162, 184]; // Azul
              data.cell.styles.textColor = 255;
              data.cell.styles.fontStyle = 'bold';
            }
          }

          // Colorear estado de procesado
          if (data.column.dataKey === 'procesado' && data.cell.raw) {
            if (data.cell.raw === 'Sí') {
              data.cell.styles.textColor = [25, 135, 84]; // Verde
              data.cell.styles.fontStyle = 'bold';
            } else {
              data.cell.styles.textColor = [220, 53, 69]; // Rojo
              data.cell.styles.fontStyle = 'bold';
            }
          }
        },
        didDrawPage: (data) => {
          const pageSize = doc.internal.pageSize;
          const pageHeight = pageSize.height || pageSize.getHeight();
          doc.setFontSize(8);
          doc.text(
            `Página ${doc.getNumberOfPages()} | Generado: ${fechaGen}`,
            14,
            pageHeight - 5
          );
        }
      });

      doc.save(nombreArchivo);
    };

    setTimeout(() => {
      if (!logo.complete) {
        if (typeof logo.onload === 'function') {
          logo.onload(new Event('load'));
        }
      }
    }, 500);
  }


  formatearFecha(fechaString: string): string {
    if (!fechaString) return 'N/A';
    
    try {
      const fecha = new Date(fechaString);
      fecha.setMinutes(fecha.getMinutes() + fecha.getTimezoneOffset());
      return fecha.toLocaleDateString('es-GT');
    } catch (e) {
      return 'Fecha inválida';
    }
  }

  formatearHora(fechaHoraString: string): string {
    if (!fechaHoraString) return '--:--';
    
    try { 
      const fecha = new Date(fechaHoraString);
      fecha.setMinutes(fecha.getMinutes() + fecha.getTimezoneOffset());
      return fecha.toLocaleTimeString('es-GT', { 
        hour: '2-digit', 
        minute: '2-digit',
        hour12: false 
      });
    } catch (e) {
      return '--:--';
    }
  }

 obtenerRangoSeleccionado() {
    if (this.tipoReporte === 'biometricos') {
      if (this.tipoFiltroBiometricos === 'dia') {
        return `Día específico: ${this.formatearFecha(this.diaEspecifico)}`;
      } else if (this.tipoFiltroBiometricos === 'rango') {
        return `Rango: ${this.formatearFecha(this.fechaDesde)} a ${this.formatearFecha(this.fechaHasta)}`;
      } else if (this.tipoFiltroBiometricos === 'mes') {
        const [year, month] = this.mesSeleccionado.split('-');
        const fecha = new Date(parseInt(year), parseInt(month) - 1, 1);
        return `Mes completo: ${fecha.toLocaleDateString('es-GT', { month: 'long', year: 'numeric' })}`;
      }
    }

    if (!this.semanaSeleccionada) return 'Sin rango';
    const { desde, hasta } = this.semanaSeleccionada;
    return `${this.formatearFecha(desde)} a ${this.formatearFecha(hasta)}`;
  }

  onAreaChange() {
    this.registros = [];
  }

onTipoReporteChange() {
    if (this.tipoReporte === 'todo' || this.tipoReporte === 'biometricos') {
      this.semanaSeleccionada = null;
    }
    
    // Resetear filtros de eventos biométricos
    if (this.tipoReporte === 'biometricos') {
      this.tipoFiltroBiometricos = 'mes';
      this.diaEspecifico = '';
      this.fechaDesde = '';
      this.fechaHasta = '';
    } else {
      this.diaEspecifico = '';
    }
    
    this.limpiarBusquedaEmpleado();
    this.registros = [];
    this.eventosBiometricos = [];
  }
}
