// calendario-turnos.component.ts
import { Component, OnInit, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TurnosService, DiaTrabajo } from '../../services/turnos.service';

interface DiaCalendario {
  hora_salida: any;
  hora_entrada: any;
  turno_id: any;
  asignado: boolean;
  fecha: string;
  diaSemana: string;
  numero: number;
  esHoy: boolean;
  esPasado: boolean;
  asignaciones: (DiaTrabajo & { nombreEmpleado?: string, nombre_turno?: string })[];
  disponible: boolean;
  asignacionesPendientes: DiaTrabajo[];
}

@Component({
  selector: 'app-calendario-turnos',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './calendario-turnos.component.html',
  styleUrls: ['./calendario-turnos.component.scss']
})
export class CalendarioTurnosComponent implements OnInit {

  @Input() empleadoId!: number;
  @Input() equipo: any[] = [];
  @Input() turnosDisponibles: any[] = [];
  @Input() fechaInicio!: string;
  @Input() fechaFin!: string;
  @Input() modoReemplazoActivo: boolean = false;

  @Output() asignacionesGuardadas = new EventEmitter<any>();
  @Output() turnoAsignado = new EventEmitter<any>();

  diaSeleccionado: DiaCalendario | null = null;

  mesActual: number;
  anioActual: number;
  diasCalendario: DiaCalendario[] = [];
  diasSemana = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
  meses = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
  ];

  mostrarModalAsignacion = false;
  fechaSeleccionada = '';
  turnoSeleccionado?: number;
  empleadoSeleccionado?: number;

  filtroActivo: string = 'todos';
  asignacionesPendientes: any[] = [];

  empleadoReemplazo: any = null;
  empleadoOriginal: any = null;
  turnoIdReemplazo: number | null = null;

  activarModoReemplazo(event: any) {
    this.modoReemplazoActivo = true;
    this.empleadoReemplazo = event.empleadoReemplazo;
    this.empleadoOriginal = event.empleadoOriginal;
    this.turnoIdReemplazo = event.turnoId;

    alert(`Seleccione los días que ${this.empleadoReemplazo.nombre_completo} cubrirá a ${this.empleadoOriginal.nombre_completo}`);
  }


  constructor(private turnosService: TurnosService) {
    const hoy = new Date();
    this.mesActual = hoy.getMonth();
    this.anioActual = hoy.getFullYear();
    this.asignacionesPendientes = [];
  }

  @Input() set asignacionesPrevias(value: any[]) {
    this._asignacionesPrevias = value || [];
    this.marcarAsignacionesPrevias();
  }
  get asignacionesPrevias(): any[] {
    return this._asignacionesPrevias;
  }
  private _asignacionesPrevias: any[] = [];

  ngOnInit() {
    this.generarCalendario();
    this.cargarAsignaciones();
    
    // 🔥 NUEVO: Si hay asignaciones previas, marcarlas inmediatamente
    if (this.asignacionesPrevias.length > 0) {
      setTimeout(() => {
        this.marcarAsignacionesPrevias();
      }, 100);
    }
  }

  marcarAsignacionesPrevias() {
    for (const asign of this.asignacionesPrevias) {
      const dia = this.diasCalendario.find(d => d.fecha === asign.fecha);
      if (dia) {
        dia.asignado = true;
        dia.turno_id = asign.turno_id;
        dia.hora_entrada = asign.hora_entrada || asign.hora_inicio;
        dia.hora_salida = asign.hora_salida || asign.hora_fin;
        
        // 🔥 NUEVO: Agregar a las asignaciones visuales
        if (!dia.asignaciones.some(a => a.fecha === asign.fecha && a.turno_id === asign.turno_id)) {
          dia.asignaciones.push({
            fecha: asign.fecha,
            empleado_id: this.empleadoId,
            turno_id: asign.turno_id,
            hora_entrada: asign.hora_entrada || asign.hora_inicio,
            hora_salida: asign.hora_salida || asign.hora_fin,
            necesita_reemplazo: false,
            estado: 'ASIGNADO',
            nombre_turno: asign.nombre_turno || 'Turno asignado',
            fecha_inicio: ''
          });
        }
        
        (`✅ Día ${asign.fecha} marcado como asignado`);
      } else {
        (`❌ Día ${asign.fecha} no encontrado en calendario`);
      }
    }
    
    // Forzar actualización de la vista
    this.diasCalendario = [...this.diasCalendario];
  }

  onDiaClick(dia: any) {
  if (this.modoReemplazoActivo) {
    dia.seleccionadoParaReemplazo = !dia.seleccionadoParaReemplazo;
  } else {
    // comportamiento normal
  }
}


   limpiarAsignacionesPrevias() {
    this.diasCalendario.forEach(dia => {
      dia.asignado = false;
      dia.turno_id = undefined;
      dia.hora_entrada = undefined;
      dia.hora_salida = undefined;
      dia.asignaciones = dia.asignaciones.filter(a => 
        !this.asignacionesPrevias.some(ap => ap.fecha === a.fecha)
      );
    });
  }

  get nombreMes(): string {
    return this.meses[this.mesActual];
  }

  getNombreEmpleado(empleadoId: number): string {
    const empleado = this.equipo.find(e => e.id === empleadoId);
    return empleado ? empleado.nombre_completo : 'Empleado';
  }

  generarCalendario() {
    this.diasCalendario = [];
    
    const primerDia = new Date(this.anioActual, this.mesActual, 1);
    const ultimoDia = new Date(this.anioActual, this.mesActual + 1, 0);
    
    const diaInicio = primerDia.getDay();
    for (let i = diaInicio - 1; i >= 0; i--) {
      const fecha = new Date(this.anioActual, this.mesActual, -i);
      this.agregarDiaCalendario(fecha, true);
    }

    for (let dia = 1; dia <= ultimoDia.getDate(); dia++) {
      const fecha = new Date(this.anioActual, this.mesActual, dia);
      this.agregarDiaCalendario(fecha, false);
    }

    const diasRestantes = 42 - this.diasCalendario.length;
    for (let i = 1; i <= diasRestantes; i++) {
      const fecha = new Date(this.anioActual, this.mesActual + 1, i);
      this.agregarDiaCalendario(fecha, true);
    }
  }

  

  private agregarDiaCalendario(fecha: Date, esExterno: boolean) {
    const hoy = new Date();
    const diaCalendario: DiaCalendario = {
      fecha: fecha.toISOString().split('T')[0],
      diaSemana: this.diasSemana[fecha.getDay()],
      numero: fecha.getDate(),
      esHoy: fecha.toDateString() === hoy.toDateString(),
      esPasado: fecha < hoy && !esExterno,
      asignaciones: [],
      disponible: !esExterno,
      asignacionesPendientes: [],
      hora_salida: undefined,
      hora_entrada: undefined,
      turno_id: undefined,
      asignado: false
    };

    this.diasCalendario.push(diaCalendario);
  }

  mesAnterior() {
    this.mesActual--;
    if (this.mesActual < 0) {
      this.mesActual = 11;
      this.anioActual--;
    }
    this.generarCalendario();
    this.cargarAsignaciones();
  }

  mesSiguiente() {
    this.mesActual++;
    if (this.mesActual > 11) {
      this.mesActual = 0;
      this.anioActual++;
    }
    this.generarCalendario();
    this.cargarAsignaciones();
  }

  cargarAsignaciones() {
    if (this.empleadoId) {
      this.turnosService.getCalendarioEmpleado(this.empleadoId, this.mesActual + 1, this.anioActual)
        .subscribe({
          next: (response) => {
            if (response.success && response.data) {
              this.procesarAsignaciones(response.data);
            }
          },
          error: (error) => {
            console.error('Error cargando asignaciones:', error);
          }
        });
    } 
  }

  private procesarAsignaciones(asignaciones: DiaTrabajo[]) {
    this.diasCalendario.forEach(dia => {
      dia.asignaciones = [];
    });

    asignaciones.forEach(asignacion => {
      // 🔹 Usar fecha_inicio para mapear en calendario
      const dia = this.diasCalendario.find(d => d.fecha === asignacion.fecha_inicio);
      if (dia) {
        dia.asignaciones.push({
          ...asignacion,
          nombreEmpleado: this.getNombreEmpleado(asignacion.empleado_id)
        });
      }
    });
  }

  seleccionarDia(dia: DiaCalendario) {
    if (!dia.disponible) return;
    
    this.fechaSeleccionada = dia.fecha;
    this.diaSeleccionado = dia;
    
    if (dia.disponible) {
      this.abrirModalAsignacion(dia.fecha);
    }
  }

  abrirModalAsignacion(fecha: string) {
    this.fechaSeleccionada = fecha;
    this.empleadoSeleccionado = this.empleadoId;
    this.turnoSeleccionado = undefined;
    this.mostrarModalAsignacion = true;
  }

  confirmarAsignacion() {
    const empleado = this.equipo.find(e => e.id === this.empleadoId);
    const nombreEmpleado = empleado ? empleado.nombre_completo : 'Empleado';

    const horaInicio = this.getHoraInicio(this.turnoSeleccionado);
    const horaFin = this.getHoraFin(this.turnoSeleccionado);
    const nombreTurno = this.turnosDisponibles.find(t => t.id === this.turnoSeleccionado)?.nombre_turno
      || this.turnosDisponibles.find(t => t.id === this.turnoSeleccionado)?.nombre
      || 'Turno asignado';

    // Construir objeto con los campos requeridos por DiaTrabajo
    const asignacion: any = {
      empleado_id: this.empleadoId,
      nombreEmpleado: nombreEmpleado,
      turno_id: this.turnoSeleccionado,
      fecha: this.fechaSeleccionada,
      fecha_inicio: this.fechaSeleccionada,
      hora_entrada: horaInicio,
      hora_salida: horaFin,
      necesita_reemplazo: this.modoReemplazoActivo,
      estado: 'PENDIENTE',
      nombre_turno: nombreTurno,
      esReemplazo: this.modoReemplazoActivo
    };

    // Agregar la asignación al día seleccionado
    const dia = this.diasCalendario.find(d => d.fecha === this.fechaSeleccionada);
    if (dia) {
      dia.asignaciones.push(asignacion);
      // forzar actualización si es necesario
      this.diasCalendario = [...this.diasCalendario];
    }

    // Agregar a pendientes para luego guardar en backend (usa fecha_inicio/fecha_fin)
    this.asignacionesPendientes.push({
      empleado_id: this.empleadoId,
      turno_id: this.turnoSeleccionado,
      fecha_inicio: this.fechaSeleccionada,
      fecha_fin: this.fechaSeleccionada
    });

    this.mostrarModalAsignacion = false;
  }
  getHoraFin(turnoSeleccionado: number | undefined): string | undefined {
    if (!turnoSeleccionado) return undefined;
    const turno = this.turnosDisponibles.find(t => t.id === turnoSeleccionado);
    return turno?.hora_fin ?? turno?.horaFin ?? turno?.hora_finario ?? undefined;
  }
  getHoraInicio(turnoSeleccionado: number | undefined): string | undefined {
    if (!turnoSeleccionado) return undefined;
    const turno = this.turnosDisponibles.find(t => t.id === turnoSeleccionado);
    return turno?.hora_inicio ?? turno?.horaInicio ?? turno?.hora_inicioario ?? undefined;
  }

  guardarAsignaciones() {
  if (this.asignacionesPendientes.length === 0) {
    alert('No hay asignaciones pendientes para guardar');
    return;
  }


  const payload = {
    asignaciones: this.asignacionesPendientes.map(a => ({
      empleado_id: a.empleado_id,
      turno_id: a.turno_id,
      fecha_inicio: a.fecha_inicio,
      fecha_fin: a.fecha_fin
    }))
  };

  this.turnosService.guardarAsignaciones(payload).subscribe({
    next: (res) => {
      if (res.success) {
        alert('Asignaciones guardadas correctamente');

        // ✅ Emitir ANTES de limpiar
        this.asignacionesGuardadas.emit([...this.asignacionesPendientes]);

        // Luego limpiar
        this.asignacionesPendientes = [];
      } else {
        alert(`Error del servidor: ${res.message}`);
      }
    },
    error: (err) => {
      console.error('Error guardando asignaciones en servidor:', err);
      if (err.status === 400) {
        alert(`Error de validación: ${err.error.message}. Turnos inválidos: ${err.error.turnosInvalidos}`);
      } else if (err.status === 401) {
        alert('Error de autenticación. Por favor, inicie sesión nuevamente.');
      } else {
        alert('Error inesperado. Revise la consola.');
      }
    }
  });
}


  cerrarModal() {
    this.mostrarModalAsignacion = false;
    this.fechaSeleccionada = '';
    this.turnoSeleccionado = undefined;
    this.empleadoSeleccionado = undefined;
  }
}