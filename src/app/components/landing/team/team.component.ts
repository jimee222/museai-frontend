// src/app/components/landing/team/team.component.ts
import { Component } from '@angular/core';
import { CommonModule, NgOptimizedImage } from '@angular/common';
import { MatCardModule } from '@angular/material/card';

interface TeamMember {
  name: string;
  role: string;
  photo: string;
}

@Component({
  selector: 'app-team',
  standalone: true,
  imports: [CommonModule, NgOptimizedImage, MatCardModule],
  templateUrl: './team.component.html',
  styleUrl: './team.component.css',
})
export class TeamComponent {
  team: TeamMember[] = [
    {
      name: 'Emilio José Conejo Fernández',
      role: 'Coordinador General',
      photo: 'assets/brand/emilio.png',
    },
    {
      name: 'Sebastián Andrés Arrieta Guzmán',
      role: 'Coordinador de Desarrollo 1',
      photo: 'assets/brand/sebastian.png',
    },
    {
      name: 'Samuel Solano Molina',
      role: 'Coordinador de Desarrollo 2',
      photo: 'assets/brand/samuel.png',
    },
    {
      name: 'Jimena Araya Reyes',
      role: 'Coordinadora de Soporte',
      photo: 'assets/brand/jimena.png',
    },
    {
      name: 'Daniel Fernando Cruz Castro',
      role: 'Coordinador de Calidad',
      photo: 'assets/brand/daniel.png',
    },
  ];
}
