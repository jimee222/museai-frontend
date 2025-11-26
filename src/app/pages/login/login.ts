import {
  CommonModule,
  NgOptimizedImage
} from '@angular/common';
import {
  AfterViewInit,
  Component,
  ElementRef,
  OnInit,
  ViewChild
} from '@angular/core';
import {
  FormsModule,
  NgModel
} from '@angular/forms';
import {
  Router,
  RouterLink
} from '@angular/router';
import gsap from 'gsap';
import { AuthService } from '../../services/auth.service';
import { GoogleAuthService } from '../../services/google-auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, NgOptimizedImage],
  templateUrl: './login.html',
  styleUrl: './login.css',
})
export class Login implements OnInit, AfterViewInit {

  private readonly GOOGLE_SIGNIN_RESET_DELAY_MS = 1000;

  public loginError = '';
  public isSubmitting = false;

  @ViewChild('email') private emailModel!: NgModel;
  @ViewChild('password') private passwordModel!: NgModel;

  /* 🟡 Referencia al anillo IA */
  @ViewChild('aiRing', { static: false })
  private aiRing?: ElementRef<HTMLDivElement>;

  /* Guardar animaciones GSAP para cancelarlas */
  private ringTween?: gsap.core.Tween;

  public loginForm: { email: string; password: string; remember: boolean } = {
    email: '',
    password: '',
    remember: false,
  };

  constructor(
    private readonly router: Router,
    private readonly authService: AuthService,
    private readonly googleAuthService: GoogleAuthService
  ) {}

  /* ============================ INIT ============================ */

  public ngOnInit(): void {
    this.googleAuthService.signInWithGoogle();
  }

  public ngAfterViewInit(): void {
    if (!this.aiRing) return;

    // Ajuste inicial por si quieres escalar luego
    gsap.set(this.aiRing.nativeElement, {
      transformOrigin: '50% 50%',
    });
  }

  /* ====================== ANIMACIONES DEL ANILLO ====================== */

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

  /* ====================== LOGIN METHODS ====================== */

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

  public googleSignIn(): void {
    this.isSubmitting = true;
    this.googleAuthService.signInWithGoogle();
    setTimeout(() => (this.isSubmitting = false), this.GOOGLE_SIGNIN_RESET_DELAY_MS);
  }

  public goToRecover = (): void => {
    this.router.navigateByUrl('/recover');
  };
}
