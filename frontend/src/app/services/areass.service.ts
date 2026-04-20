import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';
import { Observable } from 'rxjs';

export interface Area {
  id: number;
  nombre_area: string;
  descripcion: string;
}

@Injectable({ providedIn: 'root' })
export class AreasService {
  private base = environment.apiBase;
  constructor(private http: HttpClient) {}

  getAreas(): Observable<{ success: boolean, data: Area[] }> {
    return this.http.get<{ success: boolean, data: Area[] }>(`${this.base}/areas`);
  }

  createArea(nombre: string, descripcion: string): Observable<{ success: boolean, data: Area }> {
    return this.http.post<{ success: boolean, data: Area }>(`${this.base}/areas`, { nombre_area: nombre, descripcion });
  }

  addSupervisor(areaId: number, empleadoId: number, esTitular: boolean, desde?: string|null, hasta?: string|null) {
    return this.http.post(`${this.base}/areas/${areaId}/supervisores`, {
      empleado_id: empleadoId,
      es_titular: esTitular ? 1 : 0,
      desde: desde ?? null,
      hasta: hasta ?? null
    });
  }
  asignarAreaLote(areaId: number, empleadosIds: number[], jefeId?: number, incluirJefe = true) {
  return this.http.post(`${this.base}/areas/${areaId}/empleados/lote`, {
      empleados_ids: empleadosIds,
      jefe_empleado_id: jefeId ?? null,
      incluir_jefe: incluirJefe
    });
  }


  removeSupervisor(areaId: number, empleadoId: number) {
    return this.http.delete(`${this.base}/areas/${areaId}/supervisores/${empleadoId}`);
  }

  candidatosJefe(areaId: number) {
    return this.http.get<any>(`${this.base}/areas/${areaId}/candidatos-jefe`);
  }
}
