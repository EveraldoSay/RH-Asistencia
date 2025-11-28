import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { AreasService, Area } from '../../../services/areass.service';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-departamentos',
  standalone: true,
  imports: [ReactiveFormsModule, CommonModule],
  templateUrl: './departamentos.component.html',
  styleUrls: ['./departamentos.component.scss']
})
export class DepartamentosComponent implements OnInit {
  departamentos: Area[] = [];
  departamentoForm: FormGroup;
  error: string | null = null;
  success: string | null = null;

  constructor(
    private areasService: AreasService,
    private fb: FormBuilder
  ) {
    this.departamentoForm = this.fb.group({
      nombre: ['', Validators.required],
      descripcion: ['']
    });
  }

  ngOnInit(): void {
    this.loadDepartamentos();
  }

  loadDepartamentos(): void {
    this.areasService.getAreas().subscribe(response => {
      if (response.success) {
        this.departamentos = response.data;
      }
    });
  }

  onSubmit(): void {
    if (this.departamentoForm.valid) {
      const { nombre, descripcion } = this.departamentoForm.value;
      this.areasService.createArea(nombre, descripcion).subscribe({
        next: (response) => {
          if (response.success) {
            this.loadDepartamentos();
            this.departamentoForm.reset();
            this.success = 'Departamento creado con éxito.';
            this.error = null;
          }
        },
        error: (err) => {
          this.error = err.error.error || 'Error al crear el departamento.';
          this.success = null;
        }
      });
    }
  }
}
