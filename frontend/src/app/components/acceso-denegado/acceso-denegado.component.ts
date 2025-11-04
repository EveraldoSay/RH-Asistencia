import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';

@Component({
  selector: 'app-acceso-denegado',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="acceso-denegado">
      <h2>Acceso Denegado</h2>
      <p>No tiene permiso para acceder a esta página.</p>
      <button (click)="volver()">Volver a la página principal</button>
    </div>
  `,
  styles: [`
    .acceso-denegado {
      text-align: center;
      max-width: 500px;
      margin: 100px auto;
      padding: 20px;
      border: 1px solid #f5c6cb;
      border-radius: 4px;
      background-color: #f8d7da;
      color: #721c24;
    }
    
    button {
      padding: 8px 15px;
      background-color: #6c757d;
      color: white;
      border: none;
      border-radius: 4px;
      cursor: pointer;
    }
    
    button:hover {
      background-color: #5a6268;
    }
  `]
})
export class AccesoDenegadoComponent {
  constructor(private router: Router) {}
  
  volver(): void {
    this.router.navigate(['/']);
  }
}