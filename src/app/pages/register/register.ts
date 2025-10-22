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

function samePassword(group: AbstractControl): ValidationErrors | null {
  const pwd  = group.get('password')?.value;
  const cpwd = group.get('confirm')?.value;
  return pwd && cpwd && pwd !== cpwd ? { mismatch: true } : null;
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

  submitting = signal(false);
  canSubmit = computed(() => this.form.valid && !this.submitting());

  levels = [
    { value: 'beginner',     label: 'Principiante' },
    { value: 'intermediate', label: 'Intermedio'   },
    { value: 'advanced',     label: 'Avanzado'     },
  ];

  constructor(private fb: FormBuilder) {
    this.form = this.fb.group({
      firstName: ['', [Validators.required, Validators.maxLength(60)]],
      lastName1: ['', [Validators.required, Validators.maxLength(60)]],
      lastName2: ['', [Validators.maxLength(60)]],
      birthDate: ['', [Validators.required]],
      email: ['', [Validators.required, Validators.email]],
      phone: ['', [Validators.pattern(/^[0-9+\-\s]{7,20}$/)]],
      passwords: this.fb.group({
        password: ['', [Validators.required, Validators.minLength(8)]],
        confirm:  ['', [Validators.required]],
      }, { validators: samePassword }),
      artLevel: ['', [Validators.required]],
    });
  }
  googleSignIn() {
    // Por ahora solo UI: aquí luego iría tu flujo real (OAuth / redirección)
    console.log('Simulación: continuar con Google');
    // Opcional: feedback visual
    this.submitting.set(true);
    setTimeout(() => this.submitting.set(false), 600);
  }

  // helpers para el template
  field(name: string) { return this.form.get(name)!; }
  get passwords(): FormGroup { return this.form.get('passwords') as FormGroup; }

  async submit() {
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }
    this.submitting.set(true);

    // 👉 Aquí luego llamarás a tu backend (POST /api/auth/register)
    const payload = {
      firstName: this.field('firstName').value,
      lastName1: this.field('lastName1').value,
      lastName2: this.field('lastName2').value,
      birthDate: this.field('birthDate').value,
      email:     this.field('email').value,
      phone:     this.field('phone').value,
      password:  this.passwords.get('password')?.value,
      artLevel:  this.field('artLevel').value,
    };
    console.log('REGISTER payload:', payload);

    await new Promise(r => setTimeout(r, 600));
    this.submitting.set(false);
  }
}
