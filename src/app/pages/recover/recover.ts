import { CommonModule, NgOptimizedImage } from '@angular/common';
import {
  Component,
  inject,
  signal,
  AfterViewInit,
  ElementRef,
  ViewChild,
} from '@angular/core';
import {
  AbstractControl,
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { Router, RouterLink } from '@angular/router';
import gsap from 'gsap';
import { AuthService } from '../../services/auth.service';

const PWD_PATTERN = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/;
const CODE_PATTERN = /^[A-Za-z0-9]{6}$/;
const PASSWORD_REDIRECT_DELAY_MS = 900;

function samePassword(group: AbstractControl): ValidationErrors | null {
  const password = group.get('password')?.value;
  const confirm = group.get('confirm')?.value;
  return password && confirm && password !== confirm ? { mismatch: true } : null;
}

@Component({
  selector: 'app-recover',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink, NgOptimizedImage],
  templateUrl: './recover.html',
  styleUrl: './recover.css',
})
export class Recover implements AfterViewInit {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  /* 🟡 Referencia al anillo IA */
  @ViewChild('aiRing', { static: false })
  private aiRing?: ElementRef<HTMLDivElement>;

  /* Guardar animación GSAP para cancelarla */
  private ringTween?: gsap.core.Tween;

  public step = signal<'request' | 'reset'>('request');

  public requesting = signal(false);
  public resetting = signal(false);

  public requestSuccess = signal<string | null>(null);
  public requestError = signal<string | null>(null);

  public resetSuccess = signal<string | null>(null);
  public resetError = signal<string | null>(null);

  public requestForm = this.fb.group({
    email: ['', [Validators.required, Validators.email, Validators.maxLength(100)]],
  });

  public resetForm = this.fb.group({
    email: ['', [Validators.required, Validators.email, Validators.maxLength(100)]],
    code: ['', [Validators.required, Validators.pattern(CODE_PATTERN)]],
    passwords: this.fb.group(
      {
        password: ['', [Validators.required, Validators.pattern(PWD_PATTERN)]],
        confirm: ['', [Validators.required]],
      },
      { validators: samePassword },
    ),
  });

  /* ====================== ANILLO IA – ANIMACIONES ====================== */

  public ngAfterViewInit(): void {
    if (!this.aiRing) return;

    gsap.set(this.aiRing.nativeElement, {
      transformOrigin: '50% 50%',
    });
  }

  /** Evento de movimiento del mouse en el anillo */
  public onRingMouseMove(event: MouseEvent): void {
    if (!this.aiRing) return;

    const ring = this.aiRing.nativeElement;
    const rect = ring.getBoundingClientRect();

    // Centro del anillo
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;

    // Normalizar -1 a 1
    const dx = (event.clientX - cx) / (rect.width / 2);
    const dy = (event.clientY - cy) / (rect.height / 2);
    const nx = Math.max(-1, Math.min(1, dx));
    const ny = Math.max(-1, Math.min(1, dy));

    // Actualizar gradientes (CSS vars)
    const lightX = 50 + nx * 18; // %
    const lightY = 20 + ny * 18; // %
    ring.style.setProperty('--ring-light-x', `${lightX}%`);
    ring.style.setProperty('--ring-light-y', `${lightY}%`);

    // Deformación suave (capas)
    const layers = ring.querySelectorAll('.ai-ring-layer');

    this.ringTween?.kill();
    this.ringTween = gsap.to(layers, {
      duration: 0.35,
      skewX: nx * 10,
      skewY: ny * 10,
      scaleX: 1 + nx * 0.06,
      scaleY: 1 - ny * 0.05,
      ease: 'sine.out',
    });
  }

  /** Evento cuando el mouse sale del anillo */
  public onRingMouseLeave(): void {
    if (!this.aiRing) return;

    const ring = this.aiRing.nativeElement;
    this.ringTween?.kill();

    // Deformación vuelve a estado neutro
    gsap.to(ring.querySelectorAll('.ai-ring-layer'), {
      duration: 0.5,
      skewX: 0,
      skewY: 0,
      scaleX: 1,
      scaleY: 1,
      ease: 'sine.out',
    });

    // Luz vuelve suave al centro superior
    gsap.to(ring, {
      duration: 0.6,
      onUpdate: () => {
        ring.style.setProperty('--ring-light-x', '50%');
        ring.style.setProperty('--ring-light-y', '20%');
      },
    });
  }

  /* ====================== LÓGICA DE RECUPERACIÓN ====================== */

  public field(form: FormGroup, controlName: string) {
    return form.get(controlName)!;
  }

  public passwordsGroup(): FormGroup {
    return this.resetForm.get('passwords') as FormGroup;
  }

  public submitRequest(): void {
    if (this.requestForm.invalid) {
      this.requestForm.markAllAsTouched();
      return;
    }

    const email = this.field(this.requestForm, 'email').value as string;
    this.requesting.set(true);
    this.requestError.set(null);
    this.requestSuccess.set(null);

    this.auth.requestPasswordRecovery(email).subscribe({
      next: (res) => {
        this.requesting.set(false);
        this.requestSuccess.set(res.message ?? 'Enviamos un código a tu correo.');
        this.resetForm.reset({
          email,
          code: '',
          passwords: {
            password: '',
            confirm: '',
          },
        });
        this.step.set('reset');
        this.resetError.set(null);
        this.resetSuccess.set(null);
      },
      error: (err: HttpErrorResponse) => {
        this.requesting.set(false);
        const message =
          (err?.error && (err.error.message || err.error.description || err.error)) ||
          err?.message ||
          'No pudimos enviar el código. Inténtalo de nuevo.';
        this.requestError.set(
          typeof message === 'string' ? message : 'No pudimos enviar el código.',
        );
      },
    });
  }

  public submitReset(): void {
    if (this.resetForm.invalid) {
      this.resetForm.markAllAsTouched();
      this.passwordsGroup().markAllAsTouched();
      return;
    }

    const raw = this.resetForm.getRawValue();
    const password = this.passwordsGroup().get('password')?.value as string;

    this.resetting.set(true);
    this.resetError.set(null);
    this.resetSuccess.set(null);

    this.auth
      .resetPassword({
        email: raw.email ?? '',
        code: raw.code ?? '',
        newPassword: password ?? '',
      })
      .subscribe({
        next: (res) => {
          this.resetting.set(false);
          this.resetSuccess.set(res.message ?? 'Contraseña actualizada correctamente.');
          setTimeout(() => this.router.navigateByUrl('/login'), PASSWORD_REDIRECT_DELAY_MS);
        },
        error: (err: HttpErrorResponse) => {
          this.resetting.set(false);
          const message =
            (err?.error && (err.error.message || err.error.description || err.error)) ||
            err?.message ||
            'No pudimos actualizar la contraseña.';
          this.resetError.set(
            typeof message === 'string' ? message : 'No pudimos actualizar la contraseña.',
          );
        },
      });
  }

  public backToRequest(): void {
    const currentEmail = this.field(this.resetForm, 'email').value as string;
    if (currentEmail) {
      this.requestForm.patchValue({ email: currentEmail });
    }
    this.requestSuccess.set(null);
    this.requestError.set(null);
    this.step.set('request');
    this.resetSuccess.set(null);
    this.resetError.set(null);
  }
}
