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
  this.auth.isLoggedIn$.subscribe(status => {
    this.isAuthenticated = status;
  });

  // Rutas donde NO queremos ver el header de MuseAI
  const hideHeaderRoutes = ['/museum', '/landing'];

  const current = this.router.url;
  this.hideHeader = hideHeaderRoutes.some(prefix => current.startsWith(prefix));

  this.router.events
    .pipe(filter((e) => e instanceof NavigationEnd))
    .subscribe((e: any) => {
      const url = e.urlAfterRedirects ?? e.url ?? '';
      this.hideHeader = hideHeaderRoutes.some(prefix => url.startsWith(prefix));
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
