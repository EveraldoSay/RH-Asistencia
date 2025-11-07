import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { environment } from '../../environments/environment';

const API = environment.apiBase + '/reportes';

@Injectable({ providedIn: 'root' })
export class ReportesService {
  constructor(private http: HttpClient) {}

  getAreas() {
    return this.http.get<any>(`${API}/areas`);
  }

  getReporte(areaId: number, desde: string, hasta: string, tipoReporte: string = 'semana') {
    let params = new HttpParams()
      .set('area_id', areaId.toString())
      .set('tipo_reporte', tipoReporte);

    if (desde && hasta) {
      params = params
        .set('desde', desde)
        .set('hasta', hasta);
    }

    return this.http.get<any>(`${API}/asistencia`, { params });
  }

// Modificar el método getEventosBiometricos()
getEventosBiometricos(fecha: string, tipo: string = 'mes') {
  let params = new HttpParams();
  if (tipo === 'dia') {
    params = params.set('dia', fecha);
  } else {
    params = params.set('mes', fecha);
  }
  return this.http.get<any>(`${API}/eventos-biometricos`, { params });
}
}