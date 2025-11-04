import { Component, Input, Output, EventEmitter, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TurnosService } from '../../services/turnos.service';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';

const API = environment.apiBase;

@Component({
  selector: 'app-remplazo',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './remplazo.component.html',
  styleUrls: ['./remplazo.component.scss']
})
export class RemplazoComponent implements OnInit {
  @Input() empleadoOriginalId!: number;
  @Input() empleadoOriginalNombre!: string;
  @Input() fechaInicio!: string;
  @Input() fechaFin!: string;
  @Input() turnoId: number | null = null;
  @Output() reemplazoConfirmado = new EventEmitter<any>();
  @Output() cancelado = new EventEmitter<void>();
  @Output() reemplazoSeleccionado = new EventEmitter<any>();

  // Estado del componente
  mostrarModal = false;
  pasoActual: 'busqueda' | 'seleccion' | 'confirmacion' = 'busqueda';
  
  // Datos de búsqueda
  busquedaEmpleado = '';
  empleadosDisponibles: any[] = [];
  empleadosFiltrados: any[] = [];
  
  // Selecciones
  empleadoReemplazoSeleccionado: any = null;
  motivoReemplazo = '';
  diasSeleccionados: string[] = [];
  
  // Calendario para selección de días
  diasCalendario: any[] = [];
  fechaInicioSeleccionada = '';
  fechaFinSeleccionada = '';
  cargando: boolean | undefined;

  constructor(
    private http: HttpClient,
    private turnosService: TurnosService
  ) {}

  ngOnInit() {
    this.fechaInicioSeleccionada = this.fechaInicio;
    this.fechaFinSeleccionada = this.fechaFin;
    this.generarDiasCalendario();
  }

  // Abrir modal de reemplazo
  abrirModal() {
    this.mostrarModal = true;
    // this.pasoActual = 'busqueda';
    this.buscarEmpleadosDisponibles();
  }

  // Cerrar modal
  cerrarModal() {
    this.mostrarModal = false;
    ('🧩 Modal cerrado manualmente');
  }


  // Buscar empleados disponibles para reemplazo
  async buscarEmpleadosDisponibles() {
    try {
      (`🔍 Buscando empleados disponibles para fecha: ${this.fechaInicioSeleccionada}`);
      
      // Usar el endpoint que ya funciona
      const response: any = await this.http.get(`${API}/asignaciones/reemplazos/disponibles`, {
        params: {
          fecha: this.fechaInicioSeleccionada // Usar 'fecha' como en tu versión anterior
        }
      }).toPromise();

      if (response.success) {
        this.empleadosDisponibles = response.data || [];
        this.empleadosFiltrados = [...this.empleadosDisponibles];
        (`✅ Encontrados ${this.empleadosDisponibles.length} empleados disponibles`);
      } else {
        console.error('❌ Error en respuesta del servidor:', response.error);
        this.empleadosDisponibles = [];
        this.empleadosFiltrados = [];
      }
    } catch (error: any) {
      console.error('❌ Error buscando empleados disponibles:', error);
      this.empleadosDisponibles = [];
      this.empleadosFiltrados = [];
    }
  }

  // Filtrar empleados por búsqueda
  filtrarEmpleados() {
    const term = this.busquedaEmpleado.toLowerCase().trim();
    if (!term) {
      this.empleadosFiltrados = [...this.empleadosDisponibles];
      return;
    }

    this.empleadosFiltrados = this.empleadosDisponibles.filter(emp =>
      emp.nombre_completo.toLowerCase().includes(term)
    );
  }

  // Seleccionar empleado para reemplazo
seleccionarEmpleado(empleado: any) {
  this.empleadoReemplazoSeleccionado = empleado;
}

cancelarSeleccion() {
  this.empleadoReemplazoSeleccionado = null;
}

async guardarReemplazo() {
  if (!this.empleadoReemplazoSeleccionado) {
    alert('Debe seleccionar un empleado para el reemplazo.');
    return;
  }

  if (!this.fechaFinSeleccionada || this.fechaFinSeleccionada.length === 0) {
    alert('Debe seleccionar al menos una fecha en el calendario.');
    return;
  }

  // Obtener el dia_trabajo_id (turno) del empleado original antes de armar el payload
  const diaTrabajoId = await this.obtenerTurnoIdEmpleadoOriginal();
  if (!diaTrabajoId) {
    alert('No se pudo determinar el turno del empleado original para solicitar el reemplazo.');
    return;
  }

  const payload = {
    dia_trabajo_id: diaTrabajoId,
    empleado_original_id: Number(this.empleadoOriginalId),
    empleado_reemplazo_id: this.empleadoReemplazoSeleccionado.id,
    turno_id: this.turnoId,
    motivo: this.motivoReemplazo || ''
  };

  this.turnosService.solicitarReemplazo(payload).subscribe({
    next: (resp) => {
      alert('Reemplazo guardado y correo enviado al reemplazo seleccionado.');
      this.mostrarModal = false;
    },
    error: (err) => {
      console.error('❌ Error al guardar reemplazo:', err);
      alert('Error al guardar el reemplazo.');
    }
  });
}


     
  
  async cargarEmpleadosDisponibles() {
      this.cargando = true;
      try {
        // Llamar al servicio con los tres argumentos que espera: desde, hasta y turnoId
        const res: any = await this.turnosService.getEmpleadosDisponibles(
          this.fechaInicioSeleccionada,
          this.fechaFinSeleccionada,
          this.turnoId !== undefined && this.turnoId !== null ? String(this.turnoId) : undefined
        );

        this.empleadosDisponibles = res.data || [];
        this.empleadosFiltrados = [...this.empleadosDisponibles];
      } catch (err) {
        console.error('Error cargando empleados disponibles:', err);
      } finally {
        this.cargando = false;
      }
  }

  confirmarReemplazo(empleado: any) {
    this.empleadoReemplazoSeleccionado = empleado;
    // Emitir evento al padre con el reemplazo seleccionado
    this.reemplazoConfirmado.emit({
      empleadoReemplazo: empleado,
      empleadoOriginal: this.empleadoOriginalId,
      turnoId: this.turnoId
    });

    // Cerrar el modal
    this.mostrarModal = false;
  }


    generarDiasCalendario() {
    const inicio = new Date(this.fechaInicio);
    const fin = new Date(this.fechaFin);
    const dias = [];
    for (let f = new Date(inicio); f <= fin; f.setDate(f.getDate() + 1)) {
      dias.push({
        fecha: f.toISOString().split('T')[0],
        fechaFormateada: f.toLocaleDateString(),
        seleccionado: false
      });
    }
    this.diasCalendario = dias;
  }



  // Toggle selección de día
  toggleDia(dia: any) {
    dia.seleccionado = !dia.seleccionado;
    
    if (dia.seleccionado) {
      this.diasSeleccionados.push(dia.fecha);
    } else {
      this.diasSeleccionados = this.diasSeleccionados.filter(f => f !== dia.fecha);
    }
  }

  // Confirmar selección de días
  confirmarSeleccionDias() {
    if (this.diasSeleccionados.length === 0) {
      alert('Debe seleccionar al menos un día para el reemplazo');
      return;
    }
    
    this.pasoActual = 'confirmacion';
  }

  // Enviar solicitud de reemplazo
  async enviarSolicitudReemplazo() {
    if (!this.empleadoReemplazoSeleccionado || this.diasSeleccionados.length === 0 || !this.motivoReemplazo) {
      alert('Complete todos los campos requeridos');
      return;
    }

    try {
      // Necesitamos obtener el turno_id del empleado original
      const turnoId = await this.obtenerTurnoIdEmpleadoOriginal();
      
      if (!turnoId) {
        alert('No se pudo determinar el turno del empleado original');
        return;
      }

      const reemplazoData = {
        empleado_original_id: this.empleadoOriginalId,
        empleado_reemplazo_id: this.empleadoReemplazoSeleccionado.id,
        fechas: this.diasSeleccionados,
        turno_id: turnoId
      };

      const response: any = await this.http.post(
        `${API}/asignaciones/reemplazos/solicitar`, 
        reemplazoData
      ).toPromise();

      if (response.success) {
        // Emitir evento de confirmación
        const reemplazoCompleto = {
          empleadoOriginalId: this.empleadoOriginalId,
          empleadoReemplazoId: this.empleadoReemplazoSeleccionado.id,
          fechaInicio: this.diasSeleccionados[0],
          fechaFin: this.diasSeleccionados[this.diasSeleccionados.length - 1],
          motivo: this.motivoReemplazo,
          diasSeleccionados: this.diasSeleccionados,
          turnoId: turnoId
        };

        this.reemplazoConfirmado.emit(reemplazoCompleto);
        
        // Cerrar modal
        this.cerrarModal();
        
        alert('✅ Reemplazo solicitado correctamente. Se envió notificación al empleado.');

      } else {
        throw new Error(response.message || 'Error en la respuesta del servidor');
      }

    } catch (error: any) {
      console.error('❌ Error solicitando reemplazo:', error);
      alert('Error al solicitar el reemplazo: ' + (error.error?.message || error.message));
    }
  }

  // Método auxiliar para obtener el turno_id del empleado original
  private async obtenerTurnoIdEmpleadoOriginal(): Promise<number | null> {
    try {
      if (this.diasSeleccionados.length === 0) return null;
      
      // Usar la primera fecha para buscar el turno del empleado original
      const primeraFecha = this.diasSeleccionados[0];
      
      const response: any = await this.http.get(
        `${API}/asignaciones/empleado/${this.empleadoOriginalId}`, {
          params: {
            desde: primeraFecha,
            hasta: primeraFecha
          }
        }
      ).toPromise();

      if (response.success && response.asignaciones && response.asignaciones.length > 0) {
        // Devolver el turno_id de la primera asignación encontrada
        return response.asignaciones[0].turno_id;
      }
      
      return null;
    } catch (error) {
      console.error('❌ Error obteniendo turno del empleado original:', error);
      return null;
    }
  }

  // // Volver al paso anterior
  // volverPasoAnterior() {
  //   switch (this.pasoActual) {
  //     case 'seleccion':
  //       this.pasoActual = 'busqueda';
  //       this.empleadoReemplazoSeleccionado = null;
  //       break;
  //     case 'confirmacion':
  //       this.pasoActual = 'seleccion';
  //       break;
  //   }
  // }

  // // Resetear estado del componente
  // private resetearEstado() {
  //   this.pasoActual = 'busqueda';
  //   this.busquedaEmpleado = '';
  //   this.empleadosDisponibles = [];
  //   this.empleadosFiltrados = [];
  //   this.empleadoReemplazoSeleccionado = null;
  //   this.motivoReemplazo = '';
  //   this.diasSeleccionados = [];
  //   this.diasCalendario = [];
  // }

  getRolNombre(rolId: number): string {
    switch (rolId) {
      case 1: return 'Administrador';
      case 2: return 'Jefe de Área';
      case 3: return 'Enfermero';
      case 4: return 'Aux. Enfermería';
      case 5: return 'Aux. Hospital';
      default: return 'Empleado';
    }
  }
}