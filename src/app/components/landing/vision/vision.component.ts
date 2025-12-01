// src/app/components/landing/vision/vision.component.ts
import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';

@Component({
  selector: 'app-vision',
  standalone: true,
  imports: [CommonModule, MatCardModule],
  templateUrl: './vision.component.html',
  styleUrl: './vision.component.css',
})
export class VisionComponent {}
