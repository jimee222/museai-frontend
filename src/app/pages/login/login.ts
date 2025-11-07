import { CommonModule, NgOptimizedImage } from '@angular/common';
import { Component, ViewChild } from '@angular/core';
import { FormsModule, NgModel } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { GoogleAuthService } from '../../services/google-auth.service';


@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, NgOptimizedImage],
  templateUrl: './login.html',
  styleUrl: './login.css',
})
export class Login {
  public loginError = '';
  public isSubmitting = false;

  @ViewChild('email') private emailModel!: NgModel;
  @ViewChild('password') private passwordModel!: NgModel;

  public loginForm: { email: string; password: string; remember: boolean } = {
    email: '',
    password: '',
    remember: false,
  };

  constructor(
    private router: Router,
    private authService: AuthService,
    private googleAuthService: GoogleAuthService 
  ) {}

  public handleLogin(event: Event): void {
    event.preventDefault();
    this.loginError = '';

    if (!this.emailModel?.valid) {
      this.emailModel?.control.markAsTouched();
    }

    if (!this.passwordModel?.valid) {
      this.passwordModel?.control.markAsTouched();
    }

    if (!this.emailModel?.valid || !this.passwordModel?.valid) {
      return;
    }

    this.isSubmitting = true;
    const { email, password } = this.loginForm;

    this.authService.login({ email, password }).subscribe({
      next: () => {
        this.isSubmitting = false;
        this.router.navigateByUrl('/app/menu');
      },
      error: (err: any) => {
        this.isSubmitting = false;
        this.loginError = err?.error?.description ?? 'No se pudo iniciar sesión.';
      },
    });
  }

  googleSignIn() {
  this.isSubmitting = true;
  this.googleAuthService.signInWithGoogle();
  setTimeout(() => this.isSubmitting = false, 1000);
}

  ngOnInit() {
    this.googleAuthService.signInWithGoogle();
  }


  public goToRecover = (): void => {
  this.router.navigateByUrl('/recover');
  };
}
