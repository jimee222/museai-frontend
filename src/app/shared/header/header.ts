import { Component, HostListener, OnInit } from '@angular/core';
import {
  Router,
  RouterLink,
  RouterLinkActive,
  NavigationEnd
} from '@angular/router';
import { NgOptimizedImage, CommonModule } from '@angular/common';
import { AuthService } from '../../services/auth.service';
import { LanguageSelectorComponent } from '../language-selector/language-selector.component';
import { filter } from 'rxjs';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [RouterLink, RouterLinkActive, NgOptimizedImage, CommonModule, LanguageSelectorComponent],
  templateUrl: './header.html',
  styleUrls: ['./header.css']
})
export class HeaderComponent implements OnInit {
  isAuthenticated: boolean = false;
  scrolled = false;

  // 👉 NUEVO: controla si se muestra o no el header
  hideHeader = false;

  constructor(
    public auth: AuthService,
    private router: Router,
  ) {}

  ngOnInit() {
    // Estado de autenticación
    this.auth.isLoggedIn$.subscribe(status => {
      this.isAuthenticated = status;
    });

    // Estado inicial (por si recargas estando en /museum)
    const current = this.router.url;
    this.hideHeader = current.startsWith('/museum');

    // Escuchar cambios de ruta
    this.router.events
      .pipe(filter((e) => e instanceof NavigationEnd))
      .subscribe((e: any) => {
        const url = e.urlAfterRedirects ?? e.url ?? '';
        this.hideHeader = url.startsWith('/museum');
      });
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
