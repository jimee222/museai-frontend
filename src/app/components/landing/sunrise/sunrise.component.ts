import { Component } from '@angular/core';
import { CommonModule, NgOptimizedImage } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';

@Component({
  selector: 'app-hero',
  standalone: true,
  imports: [CommonModule, NgOptimizedImage, MatButtonModule],
  templateUrl: './sunrise.component.html',
  styleUrl: './sunrise.component.css',
})
export class HeroComponent {
  scrollTo(sectionId: string) {
    const el = document.getElementById(sectionId);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }
}
