import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-renovacion',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './renovacion.component.html',
  styleUrls: ['./renovacion.component.scss']
})
export class RenovacionComponent {
  @Input() areaId!: number;
  @Input() areaNombre!: string;
  @Input() jefeNombre!: string;
  @Input() empleadosCount!: number;
  @Input() loteId!: number;
  @Input() fechaFin!: string;


  cargando = false;
  mensaje: string | null = null;
  error: string | null = null;

  constructor(private http: HttpClient) {}

  // 🔹 Botón de renovación siempre habilitado (restricción de fin de mes eliminada)
  puedeRenovar(): boolean {
    return true;
  }

  // 🔹 Enviar solicitud de renovación al backend
  renovarTurno(event: Event) {
    event.preventDefault();

    if (!this.areaId) {
      this.error = 'Área no válida.';
      return;
    }

    const hoy = new Date();
    const mesActual = hoy.getMonth() + 1; // enero=0 → +1
    const anioActual = hoy.getFullYear();

    this.cargando = true;
    this.mensaje = null;
    this.error = null;

    this.http.post(`${environment.apiBase}/asignaciones/renovar-rotativos`, {
      area_id: this.areaId,
      mes_actual: mesActual,
      anio_actual: anioActual
    }).subscribe({
      next: (resp: any) => {
        if (resp.success) {
          this.mensaje = `✅ ${resp.message}`;
        } else {
          this.error = resp.message || 'No se pudo renovar.';
        }
        this.cargando = false;
      },
      error: (err) => {
        this.error = err.error?.message || 'Error al renovar turno.';
        this.cargando = false;
      }
    });
  }
}
