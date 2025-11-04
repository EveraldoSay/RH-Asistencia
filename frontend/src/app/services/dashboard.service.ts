import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';
import { of } from 'rxjs';
import { catchError } from 'rxjs/operators';

export type ProximosTurnos = {
  manana: { enfermeros: number; medicos: number };
  tarde:  { enfermeros: number; medicos: number };
  noche:  { enfermeros: number; medicos: number };
};

export interface DashboardSummary {
  distribucionArea: any;
  personalActivo: number;
  personalInactivo: number;    
  personalTotal: number; 
  totalTurnos: number;        
  turnosFijos: number;
  turnosRotativos: number;
  personalSinTurno: number;
  alertas: number;
  proximosTurnos: ProximosTurnos;
  asistenciaSemanal: Array<{ fecha: string; entradas: number }>;
}

export interface ApiResponse<T=any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

@Injectable({ providedIn: 'root' })
export class DashboardService {
  private base = `${environment.apiBase}/dashboard`;

  constructor(private http: HttpClient) {}

  getSummary() {
    return this.http.get<ApiResponse<DashboardSummary>>(`${this.base}/summary`)
      .pipe(
        catchError(error => {
          console.error('Error loading dashboard summary:', error);
          // Retornar datos vacíos en caso de error
          return of({
            success: false,
            data: this.getEmptyDashboardData()
          });
        })
      );
  }

  // Obtener datos de turnos desde localStorage (igual que en asignar-turnos)
  getTurnosFromLocalStorage() {
    try {
      const configsRotativas = localStorage.getItem('configuracionesRotativas');
      const configsFijas = localStorage.getItem('configuracionesFijas');
      
      const turnosRotativos = configsRotativas ? JSON.parse(configsRotativas).length : 0;
      const turnosFijos = configsFijas ? JSON.parse(configsFijas).length : 0;
      const totalTurnos = turnosFijos + turnosRotativos;

      return {
        turnosFijos,
        turnosRotativos,
        totalTurnos
      };
    } catch (error) {
      console.error('Error obteniendo datos de turnos del localStorage:', error);
      return {
        turnosFijos: 0,
        turnosRotativos: 0,
        totalTurnos: 0
      };
    }
  }

  private getEmptyDashboardData(): DashboardSummary {
    return {
      personalActivo: 0,
      personalInactivo: 0,
      personalTotal: 0,
      totalTurnos: 0,
      turnosFijos: 0,
      turnosRotativos: 0,
      personalSinTurno: 0,
      alertas: 0,
      proximosTurnos: {
        manana: { enfermeros: 0, medicos: 0 },
        tarde: { enfermeros: 0, medicos: 0 },
        noche: { enfermeros: 0, medicos: 0 },
      },
      asistenciaSemanal: [],
      distribucionArea: []
    } as DashboardSummary;
  }
}