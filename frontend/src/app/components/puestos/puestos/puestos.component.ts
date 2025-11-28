import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule, FormsModule } from '@angular/forms';
import { PuestosService, Puesto } from '../../../services/puestos.service';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-puestos',
  standalone: true,
  imports: [ReactiveFormsModule, CommonModule, FormsModule],
  templateUrl: './puestos.component.html',
  styleUrls: ['./puestos.component.scss']
})
export class PuestosComponent implements OnInit {
  puestos: Puesto[] = [];
  filteredPuestos: Puesto[] = [];
  paginatedPuestos: Puesto[] = [];
  
  puestoForm: FormGroup;
  loading = false;
  error: string | null = null;
  success: string | null = null;
  
  showForm = false;
  editingPuesto: Puesto | null = null;
  searchTerm = '';

  // Pagination
  currentPage = 1;
  itemsPerPage = 10;
  totalPages = 1;

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
    this.loading = true;
    this.puestosService.getPuestos().subscribe({
      next: (response) => {
        if (response.success) {
          this.puestos = response.data;
          this.filterPuestos();
        }
        this.loading = false;
      },
      error: (err) => {
        this.error = 'Error al cargar los puestos.';
        this.loading = false;
      }
    });
  }

  // Search & Filter
  onSearch(): void {
    this.currentPage = 1;
    this.filterPuestos();
  }

  clearSearch(): void {
    this.searchTerm = '';
    this.onSearch();
  }

  filterPuestos(): void {
    const term = this.searchTerm.toLowerCase().trim();
    if (!term) {
      this.filteredPuestos = [...this.puestos];
    } else {
      this.filteredPuestos = this.puestos.filter(p => 
        p.nombre_rol.toLowerCase().includes(term) || 
        (p.descripcion && p.descripcion.toLowerCase().includes(term))
      );
    }
    this.updatePagination();
  }

  // Pagination Logic
  updatePagination(): void {
    this.totalPages = Math.ceil(this.filteredPuestos.length / this.itemsPerPage) || 1;
    const startIndex = (this.currentPage - 1) * this.itemsPerPage;
    const endIndex = startIndex + this.itemsPerPage;
    this.paginatedPuestos = this.filteredPuestos.slice(startIndex, endIndex);
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
    this.editingPuesto = null;
    this.puestoForm.reset();
    this.error = null;
    this.success = null;
  }

  cancelForm(): void {
    this.showForm = false;
    this.editingPuesto = null;
    this.puestoForm.reset();
  }

  onSubmit(): void {
    if (this.puestoForm.valid) {
      this.loading = true;
      const { nombre, descripcion } = this.puestoForm.value;
      
      // Note: Assuming create only for now as per original code
      this.puestosService.createPuesto(nombre, descripcion).subscribe({
        next: (response) => {
          if (response.success) {
            this.loadPuestos();
            this.cancelForm();
            this.success = 'Puesto creado con éxito.';
            this.error = null;
          }
          this.loading = false;
        },
        error: (err) => {
          this.error = err.error.error || 'Error al crear el puesto.';
          this.success = null;
          this.loading = false;
        }
      });
    }
  }

  onDelete(id: number): void {
    if (confirm('¿Está seguro de que desea eliminar este puesto?')) {
      this.loading = true;
      this.puestosService.deletePuesto(id).subscribe({
        next: (response) => {
          if (response.success) {
            this.loadPuestos();
            this.success = 'Puesto eliminado con éxito.';
            this.error = null;
          }
          this.loading = false;
        },
        error: (err) => {
          this.error = err.error.error || 'Error al eliminar el puesto.';
          this.success = null;
          this.loading = false;
        }
      });
    }
  }
}
