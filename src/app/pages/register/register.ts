import { Component, computed, signal } from '@angular/core';
import { CommonModule, NgOptimizedImage } from '@angular/common';
import {
  FormBuilder,
  FormGroup,
  Validators,
  ReactiveFormsModule,
  AbstractControl,
  ValidationErrors,
} from '@angular/forms';
import { Router } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { AuthService } from '../../services/auth.service'; // ajusta la ruta si cambia
import { GoogleAuthService } from '../../services/google-auth.service';

function samePassword(group: AbstractControl): ValidationErrors | null {
  const pwd = group.get('password')?.value;
  const cpwd = group.get('confirm')?.value;
  return pwd && cpwd && pwd !== cpwd ? { mismatch: true } : null;
}

// Contraseña: al menos 8 caracteres, 2 mayúsculas, minúsculas y números
const PWD_PATTERN = /^(?=(?:.*[A-Z]){2,})(?=.*[a-z])(?=.*\d).{8,}$/;

// Validar edad mínima (12 años)
function minAgeValidator(minYears: number) {
  return (control: AbstractControl): ValidationErrors | null => {
    if (!control.value) return null;
    const birthDate = new Date(control.value);
    const today = new Date();
    const age = today.getFullYear() - birthDate.getFullYear();
    const m = today.getMonth() - birthDate.getMonth();
    const d = today.getDate() - birthDate.getDate();
    const isTooYoung = age < minYears || (age === minYears && (m < 0 || (m === 0 && d < 0)));
    return isTooYoung ? { tooYoung: true } : null;
  };
}

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, NgOptimizedImage],
  templateUrl: './register.html',
  styleUrl: './register.css',
})
export class Register {
  form: FormGroup;
  showPassword = signal(false);
  showConfirm = signal(false);

  submitting = signal(false);
  apiError = signal<string | null>(null);
  apiSuccess = signal<string | null>(null);
  canSubmit = computed(() => this.form.valid && !this.submitting());

  levels = [
    { value: 'beginner', label: 'Principiante' },
    { value: 'intermediate', label: 'Intermedio' },
    { value: 'advanced', label: 'Avanzado' },
  ];

  constructor(
    private fb: FormBuilder,
    private auth: AuthService,
    private router: Router,
     private googleAuth: GoogleAuthService, 
  ) {
    this.form = this.fb.group({
      firstName: ['', [Validators.required, Validators.maxLength(60)]],
      lastName1: ['', [Validators.required, Validators.maxLength(60)]],
      lastName2: ['', [Validators.maxLength(60)]],
      birthDate: ['', [Validators.required, minAgeValidator(12)]],
      email: ['', [Validators.required, Validators.email, Validators.maxLength(100)]],
      phone: ['', [Validators.pattern(/^[0-9+\-\s]{7,20}$/)]],
      passwords: this.fb.group(
        {
          password: ['', [Validators.required, Validators.pattern(PWD_PATTERN)]],
          confirm: ['', [Validators.required]],
        },
        { validators: samePassword }
      ),
      artLevel: ['', [Validators.required]],
    });
  }

  field(name: string) {
    return this.form.get(name)!;
  }

  get passwords(): FormGroup {
    return this.form.get('passwords') as FormGroup;
  }

  toggleShow(field: 'password' | 'confirm') {
    if (field === 'password') this.showPassword.set(!this.showPassword());
    else this.showConfirm.set(!this.showConfirm());
  }

  googleSignIn() {
    this.submitting.set(true);
    setTimeout(() => this.submitting.set(false), 600);
  }

  submit() {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.submitting.set(true);
    this.apiError.set(null);
    this.apiSuccess.set(null);

    const payload = {
      firstName: this.field('firstName').value,
      lastName1: this.field('lastName1').value,
      lastName2: this.field('lastName2').value || '',
      birthDate: this.field('birthDate').value,
      email: this.field('email').value,
      phone: this.field('phone').value || '',
      password: this.passwords.get('password')?.value,
      artLevel: this.field('artLevel').value,
    };

    this.auth.register(payload).subscribe({
      next: (res) => {
        this.apiSuccess.set(res.message ?? 'Cuenta creada correctamente. Bienvenido a MuseAI');
        setTimeout(() => this.router.navigateByUrl('/login'), 900);
        this.submitting.set(false);
      },
      error: (err: HttpErrorResponse) => {
        const msg =
          (err?.error && (err.error.message || err.error)) ||
          err?.message ||
          'No se pudo registrar. Intenta de nuevo.';
        this.apiError.set(typeof msg === 'string' ? msg : 'Error de registro');
        this.submitting.set(false);
      },
    });
  }

    ngOnInit(): void {
    // Pinta el botón oficial de Google en el div del registro
    this.googleAuth.renderGoogleButton('googleRegisterBtn');
  }

}
