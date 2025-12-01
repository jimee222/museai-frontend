import { CommonModule, NgOptimizedImage } from '@angular/common';
import { Component } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-menu',
  standalone: true,
  imports: [CommonModule, RouterLink, NgOptimizedImage],
  templateUrl: './menu.html',
  styleUrl: './menu.css',
})
export class Menu {

  isLogged = false;
  isSuperAdmin = false;

  constructor(
    private auth: AuthService,
    private router: Router
  ) {
    this.isLogged = this.auth.check();          
    this.isSuperAdmin = this.auth.isSuperAdmin(); 
  }

  goToQuizMenu() {
    if (!this.isLogged) {
      this.router.navigate(['/login']);
      return;
    }

    if (this.isSuperAdmin) {
      this.router.navigate(['/app/quizzes-admin']);
    } else {
      this.router.navigate(['/app/quizzes']);
    }
  }
}
