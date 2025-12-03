// src/app/components/landing/services/services.component.ts
import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';

interface Service {
  icon: string;
  title: string;
  description: string;
}

@Component({
  selector: 'app-services',
  standalone: true,
  imports: [CommonModule, MatCardModule, MatIconModule],
  templateUrl: './services.component.html',
  styleUrl: './services.component.css',
})
export class ServicesComponent {
  services: Service[] = [
    {
      icon: 'devices',
      title: 'Desarrollo Web & Mobile',
      description:
        'Aplicaciones rápidas, seguras y escalables creadas con tecnologías modernas como Angular, Spring y la nube.',
    },
    {
      icon: 'architecture',
      title: 'Arquitectura & Consultoría',
      description:
        'Diseñamos arquitecturas limpias y mantenibles, listas para crecer con tu negocio.',
    },
    {
      icon: 'auto_awesome',
      title: 'Experiencias impulsadas por IA',
      description:
        'Integración de modelos de IA para asistentes, recomendaciones inteligentes y automatización.',
    },
    {
      icon: 'security',
      title: 'Calidad & Seguridad',
      description:
        'Pruebas automatizadas, buenas prácticas y observabilidad integrada desde el día uno.',
    },
  ];
}
