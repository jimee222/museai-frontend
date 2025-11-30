import { Component, HostListener } from '@angular/core'; 
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { NgOptimizedImage, CommonModule } from '@angular/common';
import { AuthService } from '../../services/auth.service';
import { IRoleType } from '../../interfaces';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [RouterLink, RouterLinkActive, NgOptimizedImage, CommonModule],
  templateUrl: './header.html',
  styleUrls: ['./header.css']
})
export class HeaderComponent {

  isAuthenticated: boolean = false;
  scrolled = false;
  showBack = false;
  isLoginPage = false;

  constructor(
    public auth: AuthService,
    private router: Router,
  ) {

    this.router.events.subscribe(() => {

      // Detectar si estamos en login / register para quitar línea dorada
      this.isLoginPage =
        this.router.url.includes('/login') ||
        this.router.url.includes('/register');

      // Páginas donde NO debe aparecer botón de regresar
      const noBackPages = [
        "/app/menu",
        "/menu",
        "/",
        "/museum",
        "/create-canvas",
        "/app/profile",
        "/login",
        "/register"
      ];

      this.showBack = !noBackPages.includes(this.router.url);
    });
  }

  ngOnInit() {
    this.auth.isLoggedIn$.subscribe(status => {
      this.isAuthenticated = status;
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
