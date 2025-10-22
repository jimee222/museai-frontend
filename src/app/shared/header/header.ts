import { Component } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import {NgOptimizedImage} from '@angular/common';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [RouterLink, RouterLinkActive, NgOptimizedImage],
  templateUrl: './header.html',
  styleUrl: './header.css'
})
export class HeaderComponent {}
