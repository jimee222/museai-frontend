import { Component, HostListener } from '@angular/core'; 
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { NgOptimizedImage, CommonModule } from '@angular/common';
import { AuthService } from '../../services/auth.service';
import { LanguageSelectorComponent } from '../language-selector/language-selector.component';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [RouterLink, RouterLinkActive, NgOptimizedImage, CommonModule, LanguageSelectorComponent],
  templateUrl: './header.html',
  styleUrls: ['./header.css']
})
export class HeaderComponent {
  isAuthenticated: boolean = false;
  scrolled = false;
  hideHeader = false;

  constructor(
    public auth: AuthService,
    private router: Router,
  ) {
    this.router.events.subscribe(() => {
      this.hideHeader = this.router.url.includes('/museum');
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

  public logout(): void {
    this.auth.logout();
    this.router.navigateByUrl('/login');
  }
}
