import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { AuthService } from './auth.service';

export interface Turno {
  id: number;
  nombre_turno: string;
  hora_inicio: string;
  tipo: 'FIJO' | 'ROTATIVO' | '24x72' | '12x36' | 'PERSONALIZADO';
  tipo_turno?: string;
  hora_fin: string;
  minutos_descanso: number;
  tolerancia_entrada_minutos: number;
  tolerancia_salida_minutos: number;
  cruza_medianoche: boolean;
  duracion_horas: number;
  dias_trabajo: number[];
  dias_descanso: number[];
  color?: string;
}

export interface Asignacion {
  id: number;
  fecha: string;
  empleado_id: number;
  nombre_completo: string;
  numero_empleado: string;
  turno_id: number;
  nombre_turno: string;
  hora_inicio: string;
  hora_fin: string;
  cruza_medianoche: boolean;
  fecha_inicio: string;
  fecha_fin: string;
  tipo_turno: string;
  estado: 'ACTIVO' | 'PENDIENTE' | 'COMPLETADO' | 'CANCELADO';
  reemplazo_id?: number;
  motivo_reemplazo?: string;
  creado_en: string;

}

export interface DiaTrabajo {
  fecha_inicio: string;
  fecha: string;
  empleado_id: number;
  turno_id: number;
  hora_entrada: string;
  hora_salida: string;
  necesita_reemplazo: boolean;
  reemplazo_id?: number;
  estado: string;
}

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
}

@Injectable({ providedIn: 'root' })
export class TurnosService {
  guardarTurnosFijos(payload: any) {
    return this.http.post(`${this.base}/asignaciones/fijos`, payload);
  }

  private API = `${environment.apiBase}/turnos`;

  guardarAsignaciones(payload: { asignaciones: any[] }): Observable<any> {
    const token = this.authService.getToken(); // o como obtengas tu token
    const headers = new HttpHeaders().set('Authorization', `Bearer ${token}`);

    return this.http.post<any>(
      `${this.base}/asignaciones/bulk`,
      payload,
      { headers }
    );
  }

  getEmpleadosDisponibles(desde: string, hasta: string, arg2: string | undefined) {
    throw new Error('Method not implemented.');
  }
  private base = environment.apiBase; //ej. http://localhost:3000/api

  constructor(
    private http: HttpClient,
    private authService: AuthService
  ) { }

  //  helpers 
  // Normaliza el payload que espera el backend (nombre_turno en vez de nombre)
  private toTurnoPayload(body: Partial<Turno> & { nombre?: string }) {
    return {
      nombre_turno: body.nombre_turno ?? body.nombre ?? '',
      hora_inicio: body.hora_inicio,
      hora_fin: body.hora_fin,
      minutos_descanso: body.minutos_descanso ?? 0,
      tolerancia_entrada_minutos: body.tolerancia_entrada_minutos ?? 10,
      tolerancia_salida_minutos: body.tolerancia_salida_minutos ?? 10,
      cruza_medianoche: !!body.cruza_medianoche,
      tipo_turno: body.tipo ?? 'ROTATIVO',
    };
  }

  // turnos.service.ts
  getTurnosDisponibles(): Observable<any> {
    return this.http.get<any>(`${this.API}/turnos`);
  }

  //  Turnos 
  getTurnos() {
    return this.http.get<any>(this.API);
  }

  createTurno(body: Partial<Turno> & { nombre?: string }) {
    const payload = this.toTurnoPayload(body);
    // tu backend devuelve { id } dentro de data
    return this.http.post<ApiResponse<{ id: number }>>(`${this.base}/turnos`, payload);
  }

  updateTurno(id: number, body: Partial<Turno> & { nombre?: string }) {
    const payload = this.toTurnoPayload(body);
    return this.http.put<ApiResponse>(`${this.base}/turnos/${id}`, payload);
  }

  // NUEVO: Eliminar múltiples turnos
  deleteTurnos(ids: number[]): Observable<ApiResponse> {
    return this.http.delete<ApiResponse>(`${this.base}/turnos`, {
      body: { ids }
    });
  }

  eliminarLote(loteId: number) {
    const token = localStorage.getItem('token'); // o el nombre que uses para guardarlo
    const headers = token ? new HttpHeaders({ Authorization: `Bearer ${token}` }) : undefined;

    return this.http.delete<any>(`${this.base}/asignaciones/lote/${loteId}`, headers ? { headers } : {});
  }



  getCandidatosJefe(areaId: number): Observable<ApiResponse<any[]>> {
    return this.http.get<ApiResponse<any[]>>(
      `${this.base}/areas/${areaId}/candidatos-jefe`
    );
  }


  // turnos.service.ts
  getDisponibles(desde: string, hasta: string, areaId?: number, rol?: string, q?: string) {
    let params = new HttpParams()
      .set('desde', desde)
      .set('hasta', hasta);

    if (areaId) params = params.set('areaId', areaId);
    if (rol) params = params.set('rol', rol);
    if (q) params = params.set('q', q);

    return this.http.get<ApiResponse<any[]>>(`${this.base}/asignaciones/disponibles`, { params });
  }

  // En turnos.service.ts
  crearTurnoSiNoExiste(turnoData: any): Observable<ApiResponse> {
    return this.http.post<ApiResponse>(`${this.base}/turnos`, turnoData);
  }

  // NUEVO: Verificar si un turno puede ser eliminado
  canDeleteTurno(id: number): Observable<ApiResponse<{ can_delete: boolean; asignaciones_count: number }>> {
    return this.http.get<ApiResponse<{ can_delete: boolean; asignaciones_count: number }>>(
      `${this.base}/turnos/${id}/can-delete`
    );
  }

  //  Asignaciones 
  getAsignaciones(q: { desde?: string; hasta?: string; empleado_id?: number; area_id?: number }) {
    let p = new HttpParams();
    (Object.keys(q) as Array<keyof typeof q>).forEach(k => {
      const v = q[k];
      if (v !== undefined && v !== null && v !== '') p = p.set(k, String(v));
    });
    return this.http.get<ApiResponse<Asignacion[]>>(`${this.base}/asignaciones`, { params: p });
  }

  assignOne(body: { empleado_id: number; turno_id: number; fecha: string }) {
    return this.http.post<ApiResponse>(`${this.base}/asignaciones`, body);
  }

  assignBulk(body: { empleado_id: number; turno_id: number; desde: string; hasta: string; diasSemana?: number[] }) {
    return this.http.post<ApiResponse>(`${this.base}/asignaciones/bulk`, body);
  }

  //  Endpoints nuevos de la vista 4 pasos 
  previsualizar(body: {
    turno_id: number; area_id: number; jefe_id: number;
    empleados_ids: number[]; fecha_inicio: string; fecha_fin: string;
    patron: 'NORMAL' | '24x72'; dias_descanso: number[];
  }) {
    return this.http.post<ApiResponse>(`${this.base}/asignaciones/previsualizar`, body);
  }

  asignarLote(body: {
    turno_id: number; area_id: number; jefe_id: number;
    empleados_ids: number[]; fecha_inicio: string; fecha_fin: string;
    patron: 'NORMAL' | '24x72'; dias_descanso: number[];
  }) {
    return this.http.post<ApiResponse>(`${this.base}/asignaciones/lote`, body);
  }

  // Nuevos métodos para gestión de turnos rotativos
  generarCalendarioRotativo(body: {
    empleados_ids: number[];
    fecha_inicio: string;
    fecha_fin: string;
    tipo_turno: '24x72' | '12x36' | 'PERSONALIZADO';
    configuracion_personalizada?: any;
  }): Observable<ApiResponse<{ calendario: DiaTrabajo[] }>> {
    return this.http.post<ApiResponse<{ calendario: DiaTrabajo[] }>>(
      `${this.base}/asignaciones/generar-calendario`,
      body
    );
  }

  asignarTurnosRotativos(body: {
    empleados_ids: number[];
    fecha_inicio: string;
    fecha_fin: string;
    tipo_turno: string;
    dias_trabajo: number[];
    dias_descanso: number[];
    turno_config_id: number;
  }): Observable<ApiResponse<{ asignaciones: Asignacion[] }>> {
    return this.http.post<ApiResponse<{ asignaciones: Asignacion[] }>>(
      `${this.base}/asignaciones/rotativos`,
      body
    );
  }

  getEmpleadosDisponiblesParaReemplazo(fecha: string, turno_id: number): Observable<ApiResponse<any[]>> {
    return this.http.get<ApiResponse<any[]>>(
      `${this.base}/asignaciones/reemplazos/disponibles`,
      { params: { fecha, turno_id: turno_id.toString() } }
    );
  }

  solicitarReemplazo(body: {
    dia_trabajo_id: number;
    empleado_original_id: number;
    empleado_reemplazo_id: number;
    motivo: string;
  }): Observable<ApiResponse> {
    return this.http.post<ApiResponse>(`${this.base}/asignaciones/reemplazos/solicitar`, body);
  }

  confirmarReemplazo(reemplazo_id: number): Observable<ApiResponse> {
    return this.http.put<ApiResponse>(`${this.base}/asignaciones/reemplazos/${reemplazo_id}/confirmar`, {});
  }

  getCalendarioEmpleado(empleadoId: number, mes: number, anio: number): Observable<any> {
    return this.http.get<any>(
      `${this.base}/asignaciones/empleado/${empleadoId}/calendario?mes=${mes}&año=${anio}`
    );
  }

  crearTurno(turno: any) {
    return this.http.post<any>(this.API, turno);
  }

  eliminarTurno(id: number) {
    return this.http.delete<any>(`${this.API}/${id}`);
  }

  getAsignacionesEmpleado(empleadoId: number, desde: string, hasta: string) {
    return this.http.get<any>(`${this.base}/asignaciones/empleado/${empleadoId}?desde=${desde}&hasta=${hasta}`);
  }

  guardarAsignacionesTurnoFijo(payload: { asignaciones: any[] }): Observable<any> {
    const token = this.authService.getToken(); // o como obtengas tu token
    const headers = new HttpHeaders().set('Authorization', `Bearer ${token}`);
    return this.http.post<any>(
      `${this.base}/asignaciones/bulk`,
      payload,
      { headers }
    );
  }

  getConfiguraciones() {
    return this.http.get<any>(`${this.base}/asignaciones/configuraciones`, {
      headers: {
        Authorization: `Bearer ${localStorage.getItem('access_token')}`
      }
    });
  }



}