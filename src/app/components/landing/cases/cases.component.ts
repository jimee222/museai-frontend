// src/app/components/landing/cases/cases.component.ts
import { Component } from '@angular/core';
import { CommonModule, NgOptimizedImage } from '@angular/common';
import { MatCardModule } from '@angular/material/card';

interface CaseStudy {
  image: string;
  name: string;
  description: string;
}

@Component({
  selector: 'app-cases',
  standalone: true,
  imports: [CommonModule, NgOptimizedImage, MatCardModule],
  templateUrl: './cases.component.html',
  styleUrl: './cases.component.css',
})
export class CasesComponent {
  cases: CaseStudy[] = [
    {
      image: 'assets/brand/museo.png',
      name: 'MuseAI',
      description: 'Museo 3D con inteligencia artificial para curaduría de obras digitales.',
    },
    {
      image: 'assets/brand/NutriAgenda.png',
      name: 'NutriAgenda',
      description:
        'Sistema de gestión de citas, expedientes y seguimiento de pacientes para consultorios de salud.',
    },
    {
      image: 'assets/brand/ExploraCR.png',
      name: 'ExploraCR',
      description:
        'Aplicación web con mapas, retos y recompensas para explorar Costa Rica de forma diferente.',
    },
  ];
}
