import { CommonModule, NgOptimizedImage } from '@angular/common';
import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-menu',
  standalone: true,
  imports: [CommonModule, RouterLink, NgOptimizedImage],
  templateUrl: './menu.html',
  styleUrl: './menu.css',
})
export class Menu {}
