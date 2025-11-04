import { Component } from '@angular/core';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import {NgOptimizedImage , CommonModule } from '@angular/common';
import { AuthService } from '../../services/auth.service';


@Component({
  selector: 'app-header',
  standalone: true,
  imports: [RouterLink, RouterLinkActive, NgOptimizedImage, CommonModule],
  templateUrl: './header.html',
  styleUrls: ['./header.css']
})
export class HeaderComponent {
  isAuthenticated: boolean = false;

  constructor(
    public auth: AuthService,
    private router: Router,
  ) {}

 ngOnInit() {
    this.auth.isLoggedIn$.subscribe(status => {
      this.isAuthenticated = status;
    });
  }  

  public logout(): void {
    this.auth.logout();
    this.router.navigateByUrl('/login');
  }
}
