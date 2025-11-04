import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';

@Injectable({ providedIn: 'root' })
export class AreasService {
  private base = environment.apiBase;
  constructor(private http: HttpClient) {}

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
