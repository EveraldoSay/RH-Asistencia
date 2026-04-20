import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule, FormsModule } from '@angular/forms';
import { AreasService, Area } from '../../../services/areass.service';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-departamentos',
  standalone: true,
  imports: [ReactiveFormsModule, CommonModule, FormsModule],
  templateUrl: './departamentos.component.html',
  styleUrls: ['./departamentos.component.scss']
})
export class DepartamentosComponent implements OnInit {
  departamentos: Area[] = [];
  filteredDepartamentos: Area[] = [];
  paginatedDepartamentos: Area[] = [];

  departamentoForm: FormGroup;
  loading = false;
  error: string | null = null;
  success: string | null = null;

  showForm = false;
  editingDepartamento: Area | null = null;
  searchTerm = '';

  // Pagination
  currentPage = 1;
  itemsPerPage = 10;
  totalPages = 1;

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
    this.loading = true;
    this.areasService.getAreas().subscribe({
      next: (response) => {
        if (response.success) {
          this.departamentos = response.data;
          this.filterDepartamentos();
        }
        this.loading = false;
      },
      error: (err) => {
        this.error = 'Error al cargar los departamentos.';
        this.loading = false;
      }
    });
  }

  // Search & Filter
  onSearch(): void {
    this.currentPage = 1;
    this.filterDepartamentos();
  }

  clearSearch(): void {
    this.searchTerm = '';
    this.onSearch();
  }

  filterDepartamentos(): void {
    const term = this.searchTerm.toLowerCase().trim();
    if (!term) {
      this.filteredDepartamentos = [...this.departamentos];
    } else {
      this.filteredDepartamentos = this.departamentos.filter(d =>
        d.nombre_area.toLowerCase().includes(term) ||
        (d.descripcion && d.descripcion.toLowerCase().includes(term))
      );
    }
    this.updatePagination();
  }

  // Pagination Logic
  updatePagination(): void {
    this.totalPages = Math.ceil(this.filteredDepartamentos.length / this.itemsPerPage) || 1;
    const startIndex = (this.currentPage - 1) * this.itemsPerPage;
    const endIndex = startIndex + this.itemsPerPage;
    this.paginatedDepartamentos = this.filteredDepartamentos.slice(startIndex, endIndex);
  }

  prevPage(): void {
    if (this.currentPage > 1) {
      this.currentPage--;
      this.updatePagination();
    }
  }

  nextPage(): void {
    if (this.currentPage < this.totalPages) {
      this.currentPage++;
      this.updatePagination();
    }
  }

  // Form Management
  showCreateForm(): void {
    this.showForm = true;
    this.editingDepartamento = null;
    this.departamentoForm.reset();
    this.error = null;
    this.success = null;
  }

  cancelForm(): void {
    this.showForm = false;
    this.editingDepartamento = null;
    this.departamentoForm.reset();
  }

  onSubmit(): void {
    if (this.departamentoForm.valid) {
      this.loading = true;
      const { nombre, descripcion } = this.departamentoForm.value;
      this.areasService.createArea(nombre, descripcion).subscribe({
        next: (response) => {
          if (response.success) {
            this.loadDepartamentos();
            this.cancelForm();
            this.success = 'Departamento creado con éxito.';
            this.error = null;
          }
          this.loading = false;
        },
        error: (err) => {
          this.error = err.error.error || 'Error al crear el departamento.';
          this.success = null;
          this.loading = false;
        }
      });
    }
  }
}
