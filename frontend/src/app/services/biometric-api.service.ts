import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';

export interface BiometricConfig {
  enabled: boolean; mock: boolean;
  host: string; port: string; protocol: string;
}
@Injectable({ providedIn: 'root' })
export class BiometricApiService {
  private base = `${environment.apiBase}/biometric`;

  constructor(private http: HttpClient) {}

  getConfig() { return this.http.get<BiometricConfig>(`${this.base}/config`); }
  testConnection() { return this.http.get(`${this.base}/test-connection`); }
  getCapabilities() { return this.http.get(`${this.base}/capabilities`); }
  getEvents(params?: { since?: string; until?: string }) {
    return this.http.get<{count:number; events:any[]}>(`${this.base}/events`, { params: params as any });
  }
}
