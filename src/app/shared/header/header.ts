// src/app/components/header/header.ts
import { Component, HostListener } from '@angular/core';
import {
  Router,
  RouterLink,
  RouterLinkActive,
  NavigationEnd,   // 👈 NUEVO
} from '@angular/router';
import { NgOptimizedImage, CommonModule } from '@angular/common';
import { AuthService } from '../../services/auth.service';
import { LanguageSelectorComponent } from '../language-selector/language-selector.component';
import { filter } from 'rxjs/operators'; // 👈 NUEVO

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [RouterLink, RouterLinkActive, NgOptimizedImage, CommonModule, LanguageSelectorComponent],
  templateUrl: './header.html',
  styleUrls: ['./header.css'],
})
export class HeaderComponent {
  isAuthenticated: boolean = false;
  scrolled = false;

  // 👇 bandera para mostrar / ocultar navbar
  showNav = true;

  // rutas donde NO queremos mostrar el navbar
  private hideOnRoutes: string[] = ['/landing']; // aquí puedes agregar más

  constructor(
    public auth: AuthService,
    private router: Router,
  ) {}

  ngOnInit() {
    this.auth.isLoggedIn$.subscribe((status) => {
      this.isAuthenticated = status;
    });

    // Comprobar la URL actual al cargar
    this.updateVisibility(this.router.url);

    // Escuchar cambios de ruta
    this.router.events
      .pipe(filter((event): event is NavigationEnd => event instanceof NavigationEnd))
      .subscribe((event) => {
        this.updateVisibility(event.urlAfterRedirects);
      });
  }

  private updateVisibility(url: string) {
    // Si la URL empieza con alguna de las rutas de hideOnRoutes, ocultamos el navbar
    this.showNav = !this.hideOnRoutes.some((route) => url.startsWith(route));
  }

  @HostListener('window:scroll', [])
  onWindowScroll(): void {
    this.scrolled = window.scrollY > 10;
  }

  public logout(): void {
    this.auth.logout();
    this.router.navigateByUrl('/login');
  }
}
