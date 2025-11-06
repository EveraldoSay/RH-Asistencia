import { Routes } from '@angular/router';
import { DashboardComponent } from './components/dashboard/dashboard.component';
import { AccesoDenegadoComponent } from './components/acceso-denegado/acceso-denegado.component';
import { AuthGuard } from './guards/auth.guard';
import { EmpleadosComponent } from './components/empleados/empleados.component';
import { AsignarTurnosComponent } from './components/asignar-turnos/asignar-turnos.component';
import { ReportesComponent } from './components/reportes/reportes.component';

export const routes: Routes = [
  { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
  { path: 'acceso-denegado', component: AccesoDenegadoComponent },

  {
    path: 'dashboard',
    component: DashboardComponent, 
    canActivate: [AuthGuard],
    data: { roles: ['rrhh', 'jefe'] }
  },

  {
    path: 'empleados',             
    component: EmpleadosComponent,  
    canActivate: [AuthGuard],
    data: { roles: ['rrhh', 'jefe'] }
  },

  {
    path: 'asignar-turnos',             
    component: AsignarTurnosComponent,  
    canActivate: [AuthGuard],
    data: { roles: ['rrhh', 'jefe'] }
  },

  {
    path: 'reportes',             
    component: ReportesComponent,  
    canActivate: [AuthGuard],
    data: { roles: ['rrhh', 'jefe'] }
  },


  { path: '**', redirectTo: 'dashboard' }
];
