// frontend/src/app/services/notificaciones.service.ts
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, timer } from 'rxjs';
import { switchMap } from 'rxjs/operators';
import { environment } from '../../environments/environment';

const API = environment.apiBase + '/notificaciones';

@Injectable({ providedIn: 'root' })
export class NotificacionesService {
  private contadorSubject = new BehaviorSubject<number>(0);
  contador$ = this.contadorSubject.asObservable();

  constructor(private http: HttpClient) {
    // Actualiza el contador cada 20 segundos
    timer(0, 20000)
      .pipe(switchMap(() => this.getContador()))
      .subscribe(count => this.contadorSubject.next(count));
  }

  getAlertas() {
    return this.http.get<any>(`${API}`);
  }

  resolverAlerta(id: number) {
    return this.http.put(`${API}/${id}/resolver`, {});
  }

  getContador() {
    return this.http
      .get<any>(`${API}/contador`)
      .pipe(switchMap(res => [res.total || 0]));
  }
}
