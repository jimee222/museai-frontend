import { Component, computed, signal } from '@angular/core';
import { CommonModule, NgOptimizedImage } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { GoogleAuthService } from '../../services/google-auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, NgOptimizedImage, RouterLink],
  templateUrl: './login.html',
  styleUrl: './login.css'
})
export class Login {
  form: FormGroup;
  submitting = signal(false);
  canSubmit = computed(() => this.form.valid && !this.submitting());

  constructor(private fb: FormBuilder, private googleAuthService: GoogleAuthService) {
    this.form = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(8)]],
      remember: [false]
    });
  }

  get f() { return this.form.controls; }

  async submit() {
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }
    this.submitting.set(true);

    // Aquí luego se hace this.http.post(`${environment.apiBaseUrl}/auth/login`, this.form.value)
    console.log('LOGIN payload:', this.form.value);

    await new Promise(r => setTimeout(r, 600));
    this.submitting.set(false);
  }
  googleSignIn() {
    this.submitting.set(true);
    this.googleAuthService.signInWithGoogle();
    setTimeout(() => this.submitting.set(false), 1000);
  }

}
