import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';
import { Observable } from 'rxjs';

export interface Puesto {
  id: number;
  nombre_rol: string;
  descripcion: string;
}

@Injectable({
  providedIn: 'root'
})
export class PuestosService {
  private base = `${environment.apiBase}/roles`;

  constructor(private http: HttpClient) { }

  getPuestos(): Observable<{ success: boolean, data: Puesto[] }> {
    return this.http.get<{ success: boolean, data: Puesto[] }>(this.base);
  }

  createPuesto(nombre: string, descripcion: string): Observable<{ success: boolean, data: Puesto }> {
    return this.http.post<{ success: boolean, data: Puesto }>(this.base, { nombre_rol: nombre, descripcion });
  }

  deletePuesto(id: number): Observable<{ success: boolean, message: string }> {
    return this.http.delete<{ success: boolean, message: string }>(`${this.base}/${id}`);
  }
}
