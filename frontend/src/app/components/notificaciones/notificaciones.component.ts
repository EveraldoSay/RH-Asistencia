// frontend/src/app/components/notificaciones/notificaciones.component.ts
import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NotificacionesService } from '../../services/notificaciones.service';

@Component({
  selector: 'app-notificaciones',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './notificaciones.component.html',
  styleUrls: ['./notificaciones.component.scss']
})
export class NotificacionesComponent implements OnInit {
  private notiService = inject(NotificacionesService);
  alertas: any[] = [];
  cargando = false;

  ngOnInit() {
    this.cargarAlertas();
  }

  cargarAlertas() {
    this.cargando = true;
    this.notiService.getAlertas().subscribe({
      next: (res) => {
        this.alertas = res.alertas;
        this.cargando = false;
      },
      error: () => (this.cargando = false)
    });
  }

  resolver(id: number) {
    if (confirm('¿Marcar como resuelta esta alerta?')) {
      this.notiService.resolverAlerta(id).subscribe(() => this.cargarAlertas());
    }
  }
}
