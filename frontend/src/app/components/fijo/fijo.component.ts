import { Component, Input, Output, EventEmitter, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators, FormGroup } from '@angular/forms';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';

const API = environment.apiBase;

interface Area {
  id: number;
  nombre: string;
}

interface Empleado {
  id: number;
  nombre_completo: string;
  area_id: number | null;
  rol_id: number | null;
  email?: string | null;
  activo?: boolean;
  turnoAsignado?: number | null;
  rol_nombre?: string;
}

interface Rol {
  id: number;
  nombre: string;
  nivel?: number;
}

interface Turno {
  id: number;
  nombre: string;
  hora_inicio: string;
  hora_fin: string;
  minutos_descanso: number;
  tolerancia_entrada_minutos: number;
  tolerancia_salida_minutos: number;
  cruza_medianoche: boolean;
}

interface NuevoTurno {
  nombre: string;
  hora_inicio: string;
  hora_fin: string;
  tolerancia_entrada_minutos: number;
  tolerancia_salida_minutos: number;
}

@Component({
  selector: 'app-fijo',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    FormsModule
  ],
  templateUrl: './fijo.component.html',
  styleUrls: ['./fijo.component.scss']
})
export class FijoComponent implements OnInit {
  @Input() areas: Area[] = [];
  @Input() jefesCandidatos: Empleado[] = [];
  @Input() rolesEmpleados: Rol[] = [];
  @Input() empleados: Empleado[] = [];
  @Output() cancelar = new EventEmitter<void>();
  @Output() guardado = new EventEmitter<any>();

  private fb = inject(FormBuilder);
  private http = inject(HttpClient);

  // View Mode
  viewMode: 'list' | 'create' = 'list';

  // Search Filters
  searchMonth: number;
  searchYear: number;
  searchAreaId: number | null = null;
  configuraciones: any[] = [];
  filteredConfiguraciones: any[] = [];
  hasSearched = false;

  // Estado del stepper
  step = 1;

  // Formularios
  areaJefeForm = this.fb.group({
    area_id: [null as number | null, Validators.required],
    jefe_id: [null as number | null, Validators.required],
  });

  // Estado
  loading = false;
  error: string | null = null;
  info: string | null = null;

  // Datos
  jefesFiltrados: Empleado[] = [];
  empleadosFiltrados: Empleado[] = [];
  equipoCompleto: Empleado[] = [];
  turnosDisponibles: Turno[] = [];
  descansoGrupal: boolean[] = [false, false, false, false, false, false, false];
  diasSemana = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];

  // Filtros
  filtroBusqueda: string = '';
  filtroRol: string | null = null;

  // Turno personalizado
  nuevoTurno: NuevoTurno = {
    nombre: '',
    hora_inicio: '08:00',
    hora_fin: '16:00',
    tolerancia_entrada_minutos: 15,
    tolerancia_salida_minutos: 15
  };

  // Turno seleccionado
  turnoSeleccionado: number | null = null;

  constructor() {
    const today = new Date();
    this.searchMonth = today.getMonth() + 1;
    this.searchYear = today.getFullYear();
  }

  ngOnInit(): void {
    this.cargarJefesCandidatos();
    this.cargarTurnosDisponibles();
    this.loadConfiguraciones(); // Load initial list
    if (this.areaJefeForm.controls.area_id.value) {
      this.onAreaChange();
    }
  }

  // ===== LIST & SEARCH LOGIC =====

  loadConfiguraciones(): void {
    this.loading = true;
    this.http.get<any>(`${API}/asignaciones/configuraciones`).subscribe({
      next: (res) => {
        if (res.success) {
          this.configuraciones = res.data
            .filter((c: any) => c.tipo === 'FIJO')
            .map((c: any) => {
              const config = typeof c.configuracion === 'string' ? JSON.parse(c.configuracion) : c.configuracion;
              return {
                ...c,
                diasDescanso: this.getDiasDescansoLabels(config?.dias_descanso || [])
              };
            });
          this.applyDefaultFilter();
        }
        this.loading = false;
      },
      error: (err) => {
        console.error('Error loading configurations:', err);
        this.error = 'Error al cargar el historial de turnos fijos.';
        this.loading = false;
      }
    });
  }

  applyDefaultFilter(): void {
    // Default: Current Month and Next Month
    const today = new Date();
    const currentMonth = today.getMonth();
    const currentYear = today.getFullYear();

    // Calculate next month
    let nextMonth = currentMonth + 1;
    let nextYear = currentYear;
    if (nextMonth > 11) {
      nextMonth = 0;
      nextYear++;
    }

    this.filteredConfiguraciones = this.configuraciones.filter(c => {
      const startDate = new Date(c.fecha_inicio);
      const endDate = new Date(c.fecha_fin);

      // Check overlap with current month
      const startCurrent = new Date(currentYear, currentMonth, 1);
      const endCurrent = new Date(currentYear, currentMonth + 1, 0);

      // Check overlap with next month
      const startNext = new Date(nextYear, nextMonth, 1);
      const endNext = new Date(nextYear, nextMonth + 1, 0);

      const overlapsCurrent = startDate <= endCurrent && endDate >= startCurrent;
      const overlapsNext = startDate <= endNext && endDate >= startNext;

      const configAreaId = c.areaId || c.area_id;
      const matchesArea = this.searchAreaId ? Number(configAreaId) === Number(this.searchAreaId) : true;

      return (overlapsCurrent || overlapsNext) && matchesArea;
    });

    this.hasSearched = false;
  }

  onSearch(): void {
    this.hasSearched = true;
    const startSearch = new Date(this.searchYear, this.searchMonth - 1, 1);
    const endSearch = new Date(this.searchYear, this.searchMonth, 0);

    this.filteredConfiguraciones = this.configuraciones.filter(c => {
      const startDate = new Date(c.fecha_inicio);
      const endDate = new Date(c.fecha_fin);
      const overlaps = startDate <= endSearch && endDate >= startSearch;

      const configAreaId = c.areaId || c.area_id;
      const matchesArea = this.searchAreaId ? Number(configAreaId) === Number(this.searchAreaId) : true;

      return overlaps && matchesArea;
    });
  }

  showCreate(): void {
    this.viewMode = 'create';
    this.step = 1;
    this.resetForm();
  }

  showList(): void {
    this.viewMode = 'list';
    this.loadConfiguraciones(); // Refresh list
  }

  resetForm(): void {
    this.areaJefeForm.reset();
    this.equipoCompleto = [];
    this.turnoSeleccionado = null;
    this.descansoGrupal = [false, false, false, false, false, false, false];
    this.error = null;
    this.info = null;
  }

  // ===== MÉTODOS DE NAVEGACIÓN =====
  prevStep(): void {
    if (this.step > 1) {
      this.step--;
      this.error = null;
    }
  }

  nextStep(): void {
    // Validaciones por paso
    if (this.step === 1) {
      if (!this.areaJefeForm.valid) {
        this.error = 'Debes seleccionar un área y un jefe de área antes de continuar.';
        return;
      }
    }

    if (this.step === 2) {
      if (this.equipoCompleto.length === 0) {
        this.error = 'Debes seleccionar al menos un empleado para el equipo.';
        return;
      }

      // Incluir automáticamente al jefe en el equipo si no está
      const jefeId = this.areaJefeForm.controls.jefe_id.value;
      const jefeSeleccionado = this.jefesCandidatos.find(j => j.id === jefeId);

      if (jefeSeleccionado && !this.equipoCompleto.some(e => e.id === jefeSeleccionado.id)) {
        this.equipoCompleto = [jefeSeleccionado, ...this.equipoCompleto];
      }
    }

    if (this.step === 3) {
      if (!this.turnoSeleccionado) {
        this.error = 'Debes seleccionar o crear un turno antes de continuar.';
        return;
      }
    }

    if (this.step < 4) {
      this.step++;
      this.error = null;
    }
  }

  onAreaChange(): void {
    const areaId = Number(this.areaJefeForm.controls.area_id.value);

    if (!areaId || isNaN(areaId)) {
      this.jefesFiltrados = [];
      this.areaJefeForm.controls.jefe_id.setValue(null);
      this.areaJefeForm.controls.jefe_id.enable();
      console.warn('No hay área seleccionada o ID inválido');
      return;
    }

    // Cargar candidatos a jefe desde el backend (prioriza titulares)
    this.http.get<any>(`${API}/areas/${areaId}/candidatos-jefe`).subscribe({
      next: (res) => {
        if (res.success) {
          this.jefesFiltrados = res.data || [];

          if (this.jefesFiltrados.length > 0) {
            // El backend ya los devuelve ordenados por prioridad (Titular > Específico > Regla)
            const mejorCandidato = this.jefesFiltrados[0];
            this.areaJefeForm.controls.jefe_id.setValue(mejorCandidato.id);
            this.areaJefeForm.controls.jefe_id.enable();
          } else {
            this.areaJefeForm.controls.jefe_id.setValue(null);
            this.areaJefeForm.controls.jefe_id.enable();
          }
        }
        this.filtrarEmpleados();
      },
      error: (err) => {
        console.error('Error cargando candidatos a jefe', err);
        this.jefesFiltrados = [];
        this.filtrarEmpleados();
      }
    });
  }

  cargarJefesCandidatos(): void {
    this.http.get<any>(`${API}/empleados`).subscribe({
      next: (res) => {
        const data = res.data || res || [];

        // Filtrar los que tienen área asignada, están activos Y TIENEN ROL
        this.jefesCandidatos = data.filter((emp: any) =>
          emp.activo &&
          emp.area_id !== null &&
          emp.rol_id !== null // ← ESTO ES OBLIGATORIO AHORA
        );

      },
      error: (err) => {
        console.error('Error cargando jefes candidatos:', err);
        this.error = 'Error cargando jefes candidatos';
      }
    });
  }


  filtrarEmpleados(): void {
    const areaId = this.areaJefeForm.controls.area_id.value;

    if (!areaId) {
      this.empleadosFiltrados = [];
      return;
    }

    // Filtrar empleados que:
    // 1. Estén activos
    // 2. Tengan un rol asignado (rol_id no nulo) ← ESTA ES LA CONDICIÓN CLAVE
    // 3. No tengan área asignada (null) O ya estén en esta área
    // 4. Excluir al jefe seleccionado (usando getRawValue para incluir si está deshabilitado)
    const jefeId = this.areaJefeForm.getRawValue().jefe_id;

    let empleadosDisponibles = this.empleados.filter(emp =>
      emp.activo &&
      emp.rol_id !== null && // ← SOLO EMPLEADOS CON ROL ASIGNADO
      (emp.area_id === null || emp.area_id === areaId) &&
      emp.id !== jefeId
    );

    // Aplicar filtro de búsqueda
    if (this.filtroBusqueda) {
      const search = this.filtroBusqueda.toLowerCase();
      empleadosDisponibles = empleadosDisponibles.filter(e =>
        e.nombre_completo.toLowerCase().includes(search)
      );
    }

    // Aplicar filtro de rol
    if (this.filtroRol) {
      empleadosDisponibles = empleadosDisponibles.filter(e =>
        this.getRolNombre(e.rol_id) === this.filtroRol
      );
    }

    this.empleadosFiltrados = empleadosDisponibles;
  }


  isEmpleadoSeleccionado(id: number): boolean {
    return this.equipoCompleto.some(e => e.id === id);
  }

  isEmpleadoSeleccionable(emp: Empleado): boolean {
    // Si el empleado no tiene rol, no es seleccionable
    if (emp.rol_id === null) {
      return false;
    }

    // Si el empleado ya está en otra área, no se puede seleccionar
    if (emp.area_id && emp.area_id !== this.areaJefeForm.controls.area_id.value) {
      return false;
    }

    return true;
  }

  toggleEmpleadoEquipo(empleado: Empleado): void {
    if (this.isEmpleadoSeleccionado(empleado.id)) {
      this.removerEmpleadoEquipo(empleado.id);
    } else {
      if (this.isEmpleadoSeleccionable(empleado)) {
        this.equipoCompleto.push({ ...empleado });
        this.error = null;
      } else {
        this.error = `${empleado.nombre_completo} ya está asignado a otra área (${this.getAreaNombre(empleado.area_id)})`;
      }
    }
  }

  removerEmpleadoEquipo(id: number): void {
    this.equipoCompleto = this.equipoCompleto.filter(e => e.id !== id);
  }

  // ===== MÉTODOS DE TURNOS =====
  cargarTurnosDisponibles(): void {
    this.http.get<any>(`${API}/turnos`).subscribe({
      next: (res) => {
        this.turnosDisponibles = (res.data || res || []).map((t: any) => ({
          id: t.id,
          nombre: t.nombre || t.nombre_turno,
          hora_inicio: t.hora_inicio,
          hora_fin: t.hora_fin,
          minutos_descanso: t.minutos_descanso ?? 0,
          tolerancia_entrada_minutos: t.tolerancia_entrada_minutos,
          tolerancia_salida_minutos: t.tolerancia_salida_minutos,
          cruza_medianoche: t.cruza_medianoche ?? false
        }));
      },
      error: (err) => {
        console.error('Error cargando turnos:', err);
        this.error = 'Error al cargar los turnos disponibles';
      }
    });
  }

  crearTurnoPersonalizado(): void {
    if (!this.nuevoTurno.nombre || !this.nuevoTurno.hora_inicio || !this.nuevoTurno.hora_fin) {
      this.error = "Debes completar nombre, hora de inicio y hora de fin para crear el turno.";
      return;
    }

    const nuevo = {
      nombre: this.nuevoTurno.nombre,
      hora_inicio: this.nuevoTurno.hora_inicio,
      hora_fin: this.nuevoTurno.hora_fin,
      tolerancia_entrada_minutos: this.nuevoTurno.tolerancia_entrada_minutos ?? 15,
      tolerancia_salida_minutos: this.nuevoTurno.tolerancia_salida_minutos ?? 15,
      tipo_turno: 'FIJO'
    };

    this.http.post<any>(`${API}/turnos`, nuevo).subscribe({
      next: (res) => {
        const turnoGuardado = res.data;

        const nuevoTurno: Turno = {
          id: turnoGuardado.id,
          nombre: turnoGuardado.nombre || turnoGuardado.nombre_turno,
          hora_inicio: turnoGuardado.hora_inicio,
          hora_fin: turnoGuardado.hora_fin,
          minutos_descanso: turnoGuardado.minutos_descanso || 0,
          tolerancia_entrada_minutos: turnoGuardado.tolerancia_entrada_minutos,
          tolerancia_salida_minutos: turnoGuardado.tolerancia_salida_minutos,
          cruza_medianoche: turnoGuardado.cruza_medianoche || false
        };

        this.turnosDisponibles.push(nuevoTurno);

        // Seleccionar automáticamente el nuevo turno
        this.turnoSeleccionado = turnoGuardado.id;

        this.info = 'Turno creado y seleccionado correctamente';

        // Limpiar formulario de nuevo turno
        this.nuevoTurno = {
          nombre: '',
          hora_inicio: '08:00',
          hora_fin: '16:00',
          tolerancia_entrada_minutos: 15,
          tolerancia_salida_minutos: 15
        };
      },
      error: (err) => {
        console.error('Error guardando turno:', err);
        this.error = 'Error al crear el turno';
      }
    });
  }

  // ===== MÉTODOS DE DESCANSO =====
  toggleDiaDescanso(index: number): void {
    this.descansoGrupal[index] = !this.descansoGrupal[index];
  }

  // Mapeo de índices UI (0=Lunes) a Backend (JS getDay: 0=Domingo, 1=Lunes...)
  mapDiaToBackend(uiIndex: number): number {
    // UI: 0=Lunes, 1=Martes, ..., 5=Sábado, 6=Domingo
    // Backend (JS getDay): 1=Lunes, 2=Martes, ..., 6=Sábado, 0=Domingo
    const map = [1, 2, 3, 4, 5, 6, 0];
    return map[uiIndex];
  }

  getDiasDescansoSeleccionados(): string {
    return this.descansoGrupal
      .map((seleccionado, index) => seleccionado ? this.mapDiaToBackend(index).toString() : null)
      .filter(Boolean)
      .join(',');
  }

  getDiasDescansoNombres(): string {
    const mapaDias: Record<string, string> = {
      '2': 'Lunes',
      '3': 'Martes',
      '4': 'Miércoles',
      '5': 'Jueves',
      '6': 'Viernes',
      '7': 'Sábado',
      '1': 'Domingo',
      '0': 'Domingo' // Add 0 for JS getDay compatibility
    };

    // Filtrar los seleccionados y convertirlos a nombres
    const diasSeleccionados = this.descansoGrupal
      .map((seleccionado, index) => (seleccionado ? this.mapDiaToBackend(index).toString() : null))
      .filter(Boolean)
      .map(num => mapaDias[num!] || 'Desconocido')
      .join(', ');

    return diasSeleccionados || 'Ninguno';
  }

  validarSuperposicion(empleadosIds: number[], turnoId: number): string | null {
    // Esta es una validación básica del lado del cliente.
    // Verifica si alguno de los empleados seleccionados ya tiene un turno fijo activo.
    // Nota: Esto asume que 'configuraciones' tiene la lista completa de asignaciones vigentes.

    // Si no tenemos datos suficientes en el cliente, confiamos en el backend.
    if (!this.configuraciones || this.configuraciones.length === 0) return null;

    // TODO: Implementar lógica más compleja si 'configuraciones' tuviera el detalle de empleados.
    // Por ahora, como 'configuraciones' es un resumen por área/turno, no podemos saber
    // qué empleados específicos están en cada grupo solo con esa lista.
    // La validación real debe ocurrir en el backend.

    return null;
  }

  // En fijo.component.ts - método guardarTurnosFijos()
  guardarTurnosFijos(): void {
    if (!this.areaJefeForm.valid || !this.turnoSeleccionado || this.equipoCompleto.length === 0) {
      this.error = 'Por favor complete todos los campos obligatorios antes de guardar';
      return;
    }

    const areaId = this.areaJefeForm.controls.area_id.value;
    // Usar getRawValue para obtener el valor incluso si el control está deshabilitado
    const jefeId = this.areaJefeForm.getRawValue().jefe_id;

    // Incluir al jefe en el equipo completo si no está
    const jefe = this.jefesCandidatos.find(j => j.id === jefeId);
    const todosLosEmpleados = jefe && !this.equipoCompleto.some(e => e.id === jefe.id)
      ? [jefe, ...this.equipoCompleto]
      : this.equipoCompleto;

    const empleadosIds = todosLosEmpleados.map(emp => emp.id);

    // Validar superposición (Client-side check placeholder)
    const conflicto = this.validarSuperposicion(empleadosIds, this.turnoSeleccionado);
    if (conflicto) {
      this.error = `Conflicto de horario: ${conflicto}`;
      return;
    }

    this.loading = true;
    this.error = null;

    const payload = {
      area_id: areaId,
      jefe_id: jefeId,
      turno_id: this.turnoSeleccionado,
      empleados_ids: empleadosIds, // ← Esto ahora incluye al jefe también
      dias_descanso: this.getDiasDescansoSeleccionados(),
      tipo: 'FIJO_PERMANENTE'
    };

    this.http.post(`${API}/asignaciones/fijos`, payload).subscribe({
      next: (res: any) => {
        this.loading = false;

        const configuracionGuardada = {
          id: res.lote_id || Date.now(),
          areaId: areaId,
          jefeId: jefeId,
          turnoId: this.turnoSeleccionado,
          areaNombre: this.getAreaNombre(areaId),
          jefeNombre: this.getEmpleadoNombre(jefeId),
          empleadosCount: empleadosIds.length,
          turnoNombre: this.getTurnoNombre(this.turnoSeleccionado),
          diasDescanso: this.getDiasDescansoNombres(),
          tipo: 'FIJO',
          fechaCreacion: new Date().toISOString(),
          permanente: true
        };

        this.info = `Turno fijo permanente creado para ${empleadosIds.length} empleados`;

        // Emitir evento de guardado
        setTimeout(() => {
          this.guardado.emit(configuracionGuardada);
          this.showList(); // Return to list view
        }, 2000);
      },
      error: (err) => {
        this.loading = false;
        console.error('Error guardando turnos fijos:', err);

        if (err.status === 400) {
          this.error = 'Error en los datos: ' + (err.error?.message || 'Verifique los campos');
        } else if (err.status === 409) { // Conflict
          this.error = 'Conflicto de horario: ' + (err.error?.message || 'Superposición detectada');
        } else if (err.status === 500) {
          this.error = 'Error del servidor: ' + (err.error?.error || 'Intente más tarde');
        } else {
          this.error = 'Error al guardar los turnos fijos: ' + err.message;
        }
      }
    });
  }

  cancelarFormulario(): void {
    if (this.viewMode === 'create') {
      this.showList();
    } else {
      this.cancelar.emit();
    }
  }

  // ===== MÉTODOS UTILITARIOS =====
  getAreaNombre(areaId: number | null): string {
    if (!areaId) return '—';
    return this.areas.find(a => a.id === areaId)?.nombre || '—';
  }

  getEmpleadoNombre(empleadoId: number | null): string {
    if (!empleadoId) return '—';
    const empleado = this.empleados.find(e => e.id === empleadoId) ||
      this.jefesCandidatos.find(e => e.id === empleadoId);
    return empleado?.nombre_completo || '—';
  }

  getRolNombre(rolId: number | null): string {
    if (!rolId) return 'Sin rol';
    return this.rolesEmpleados.find(r => r.id === rolId)?.nombre || `Rol ${rolId}`;
  }

  getTurnoNombre(turnoId: number | null): string {
    if (!turnoId) return 'Sin turno';
    return this.turnosDisponibles.find(t => t.id === turnoId)?.nombre || `Turno ${turnoId}`;
  }

  getTurnoHorario(turnoId: number | null): string {
    if (!turnoId) return '';
    const turno = this.turnosDisponibles.find(t => t.id === turnoId);
    return turno ? `${turno.hora_inicio} a ${turno.hora_fin}` : '';
  }

  getRolesUnicos(): string[] {
    const roles = this.empleadosFiltrados
      .map(emp => this.getRolNombre(emp.rol_id))
      .filter(rol => rol !== 'Sin rol');
    return [...new Set(roles)];
  }

  trackByEmpleadoId(index: number, empleado: any): number {
    return empleado.id;
  }

  trackByTurnoId(index: number, turno: any): number {
    return turno.id;
  }

  trackByAreaId(index: number, area: any): number {
    return area.id;
  }

  trackByDiaIndex(index: number, dia: any): number {
    return index;
  }

  trackByRol(index: number, rol: any): string {
    return rol;
  }

  tieneDiasDescanso(): boolean {
    return this.descansoGrupal.some(d => d);
  }

  getDiasDescansoLabels(dias: any[]): string {
    if (!dias || dias.length === 0) return '';

    const map: Record<string, string> = {
      '0': 'Domingo',
      '1': 'Lunes',
      '2': 'Martes',
      '3': 'Miércoles',
      '4': 'Jueves',
      '5': 'Viernes',
      '6': 'Sábado'
    };

    return dias.map(d => map[d.toString()] || d).join(', ');
  }
}