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
import { IRoleType } from '../../interfaces';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [RouterLink, RouterLinkActive, NgOptimizedImage, CommonModule],
  templateUrl: './header.html',
  styleUrls: ['./header.css']
})
export class HeaderComponent implements OnInit {
  isAuthenticated: boolean = false;
  scrolled = false;
  showBack = false;
  isLoginPage = false;

  // 👉 NUEVO: controla si se muestra o no el header
  hideHeader = false;

  constructor(
    public auth: AuthService,
    private router: Router,
  ) {

    this.router.events.subscribe(() => {
      this.isLoginPage =
        this.router.url.includes('/login') ||
        this.router.url.includes('/register');

      const noBackPages = [
        '/app/menu', 
        '/menu',
        '/',
        '/login'     
      ];

      this.showBack = !noBackPages.includes(this.router.url);
    });
  }

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

  isAdmin(): boolean {
    return this.auth.hasAnyRole([IRoleType.admin, IRoleType.superAdmin]);
  }

  goBack(): void {
    window.history.back();
  }

  public logout(): void {
    this.auth.logout();
    this.router.navigateByUrl('/login');
  }
}
