import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import Chart from 'chart.js/auto';
import { DashboardService, DashboardSummary } from '../../services/dashboard.service';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.scss']
})
export class DashboardComponent implements OnInit {

  areaColors = [
    '#3b82f6','#22c55e','#f59e0b','#ef4444','#8b5cf6',
    '#14b8a6','#f97316','#6366f1','#ec4899','#0ea5e9'
  ];

  data: DashboardSummary = {
    personalActivo: 0,
    personalInactivo: 0,
    personalTotal: 0,
    totalTurnos: 0,           
    turnosFijos: 0,
    turnosRotativos: 0,
    personalSinTurno: 0,
    personalConPermiso: 0,
    // alertas: 0,
    proximosTurnos: {
      manana: { enfermeros: 0, medicos: 0 },
      tarde: { enfermeros: 0, medicos: 0 },
      noche: { enfermeros: 0, medicos: 0 },
    },
    asistenciaSemanal: [],
    distribucionArea: []
  } as unknown as DashboardSummary;

  loading = true;
  hasData = false;

  constructor(private dash: DashboardService) {}

  ngOnInit(): void {
    this.loadDashboardData();
  }

  /** Carga los datos del dashboard */
  loadDashboardData(): void {
    this.loading = true;

    this.dash.getSummary().subscribe({
      next: (resp) => {
        if (resp.success && resp.data) {
          this.data = resp.data;
          
          // SOBRESCRIBIR con los datos exactos de localStorage (igual que en asignar-turnos)
          const turnosData = this.dash.getTurnosFromLocalStorage();
          this.data.turnosFijos = turnosData.turnosFijos;
          this.data.turnosRotativos = turnosData.turnosRotativos;
          this.data.totalTurnos = turnosData.totalTurnos;

          ( {
            fijos: this.data.turnosFijos,
            rotativos: this.data.turnosRotativos,
            total: this.data.totalTurnos
          });

          this.hasData = this.hasAnyData(this.data);
          setTimeout(() => this.renderCharts(), 300);
        } else {
          this.hasData = false;
        }
        this.loading = false;
      },
      error: (err) => {
        console.error('Error loading dashboard:', err);
        
        // En caso de error, cargar solo datos de turnos desde localStorage
        const turnosData = this.dash.getTurnosFromLocalStorage();
        this.data.turnosFijos = turnosData.turnosFijos;
        this.data.turnosRotativos = turnosData.turnosRotativos;
        this.data.totalTurnos = turnosData.totalTurnos;
        
        this.hasData = this.data.totalTurnos > 0;
        this.loading = false;
      }
    });
  }

  /** Verifica si hay datos válidos */
  private hasAnyData(d: DashboardSummary): boolean {
    if (!d) return false;

    const hasPersonalData = (d.personalActivo || 0) + (d.personalInactivo || 0) + (d.personalTotal || 0) > 0;
    const hasTurnosData = (d.totalTurnos || 0) > 0;
    const hasAsistenciaData = d.asistenciaSemanal?.some(x => x.entradas > 0) || false;
    const hasDistribucionData = d.distribucionArea?.length > 0 || false;

    return hasPersonalData || hasTurnosData || hasAsistenciaData || hasDistribucionData;
  }

  /** Renderiza los gráficos del dashboard */
  private renderCharts(): void {
    // Limpia los gráficos previos
    Chart.getChart("areaChart")?.destroy();
    Chart.getChart("asistenciaChart")?.destroy();

    // Dona — Distribución por Área
    if (this.data.distribucionArea && this.data.distribucionArea.length > 0) {
      const ctx1 = document.getElementById('areaChart') as HTMLCanvasElement;
      const areas = this.data.distribucionArea.map((a: any) => a.area || 'Sin área');
      const cantidades = this.data.distribucionArea.map((a: any) => a.cantidad || 0);
      const total = cantidades.reduce((s: number, v: number) => s + v, 0);

      new Chart(ctx1, {
        type: 'doughnut',
        data: {
          labels: areas,
          datasets: [{
            data: cantidades,
            backgroundColor: this.areaColors,
            borderWidth: 2,
            borderColor: '#fff',
          }]
        },
        options: {
          cutout: '58%',
          animation: { duration: 600 },
          maintainAspectRatio: true,
          plugins: {
            legend: {
              position: 'bottom',
              labels: { font: { size: 9 }, boxWidth: 9, padding: 5 }
            },
            tooltip: {
              callbacks: {
                label: (ctx) => {
                  const pct = total > 0 ? ((ctx.parsed / total) * 100).toFixed(1) : '0';
                  return ` ${ctx.label}: ${ctx.parsed} (${pct}%)`;
                }
              }
            }
          }
        }
      });
    }

    // Línea con área — Asistencia Semanal
    if (this.data.asistenciaSemanal && this.data.asistenciaSemanal.length > 0) {
      const ctx2 = document.getElementById('asistenciaChart') as HTMLCanvasElement;
      const labels = this.data.asistenciaSemanal.map((d: any) => {
        // Mostrar fecha como "Lun 12/05" para que sea legible
        const fecha = new Date(d.fecha + 'T00:00:00');
        const dias = ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'];
        const dd = String(fecha.getDate()).padStart(2,'0');
        const mm = String(fecha.getMonth()+1).padStart(2,'0');
        return `${dias[fecha.getDay()]} ${dd}/${mm}`;
      });
      const entradas = this.data.asistenciaSemanal.map((d: any) => d.entradas);

      new Chart(ctx2, {
        type: 'line',
        data: {
          labels,
          datasets: [{
            label: 'Entradas registradas',
            data: entradas,
            borderColor: '#3b82f6',
            borderWidth: 2,
            pointBackgroundColor: '#3b82f6',
            pointRadius: 3,
            pointHoverRadius: 5,
            fill: true,
            backgroundColor: 'rgba(59,130,246,0.10)',
            tension: 0.35,
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          animation: { duration: 500 },
          scales: {
            y: {
              beginAtZero: true,
              title: { display: true, text: 'Entradas', font: { size: 10 }, color: '#94a3b8' },
              ticks: { font: { size: 10 }, color: '#94a3b8' },
              grid: { color: '#f1f5f9' }
            },
            x: {
              title: { display: true, text: 'Día', font: { size: 10 }, color: '#94a3b8' },
              grid: { display: false },
              ticks: { font: { size: 9 }, color: '#94a3b8', maxRotation: 0 }
            }
          },
          plugins: {
            legend: { display: true, labels: { font: { size: 10 }, boxWidth: 10, color: '#64748b' } },
            tooltip: {
              callbacks: {
                title: (items) => items[0].label,
                label: (ctx) => ` ${ctx.parsed.y} entradas`
              }
            }
          }
        }
      });
    }
  }
}