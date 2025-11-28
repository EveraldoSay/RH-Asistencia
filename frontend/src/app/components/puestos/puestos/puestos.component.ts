import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { PuestosService, Puesto } from '../../../services/puestos.service';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-puestos',
  standalone: true,
  imports: [ReactiveFormsModule, CommonModule],
  templateUrl: './puestos.component.html',
  styleUrls: ['./puestos.component.scss']
})
export class PuestosComponent implements OnInit {
  puestos: Puesto[] = [];
  puestoForm: FormGroup;
  error: string | null = null;
  success: string | null = null;

  constructor(
    private puestosService: PuestosService,
    private fb: FormBuilder
  ) {
    this.puestoForm = this.fb.group({
      nombre: ['', Validators.required],
      descripcion: ['']
    });
  }

  ngOnInit(): void {
    this.loadPuestos();
  }

  loadPuestos(): void {
    this.puestosService.getPuestos().subscribe(response => {
      if (response.success) {
        this.puestos = response.data;
      }
    });
  }

  onSubmit(): void {
    if (this.puestoForm.valid) {
      const { nombre, descripcion } = this.puestoForm.value;
      this.puestosService.createPuesto(nombre, descripcion).subscribe({
        next: (response) => {
          if (response.success) {
            this.loadPuestos();
            this.puestoForm.reset();
            this.success = 'Puesto creado con éxito.';
            this.error = null;
          }
        },
        error: (err) => {
          this.error = err.error.error || 'Error al crear el puesto.';
          this.success = null;
        }
      });
    }
  }

  onDelete(id: number): void {
    if (confirm('¿Está seguro de que desea eliminar este puesto?')) {
      this.puestosService.deletePuesto(id).subscribe({
        next: (response) => {
          if (response.success) {
            this.loadPuestos();
            this.success = 'Puesto eliminado con éxito.';
            this.error = null;
          }
        },
        error: (err) => {
          this.error = err.error.error || 'Error al eliminar el puesto.';
          this.success = null;
        }
      });
    }
  }
}
