import {
  Component,
  OnInit,
  AfterViewInit,
  computed,
  signal,
  ViewChild,
  ElementRef,
} from '@angular/core';
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
import gsap from 'gsap';

import { AuthService } from '../../services/auth.service';
import { UserService } from '../../services/user.service';

function samePassword(group: AbstractControl): ValidationErrors | null {
  const pwd = group.get('password')?.value;
  const cpwd = group.get('confirm')?.value;
  return pwd && cpwd && pwd !== cpwd ? { mismatch: true } : null;
}

const PWD_PATTERN = /^(?=(?:.*[A-Z]){2,})(?=.*[a-z])(?=.*\d).{8,}$/;

@Component({
  selector: 'app-edit-profile',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, NgOptimizedImage],
  templateUrl: './edit-profile.html',
  styleUrl: './edit-profile.css',
})
export class EditProfile implements OnInit, AfterViewInit {
  /* 🟡 Referencia al anillo IA */
  @ViewChild('aiRing', { static: false })
  private aiRing?: ElementRef<HTMLDivElement>;

  private ringTween?: gsap.core.Tween;

  form: FormGroup;
  userData: any;

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
    private user: UserService,
  ) {
    this.form = this.fb.group({
      firstName: ['', [Validators.required, Validators.maxLength(60)]],
      lastName1: ['', [Validators.required, Validators.maxLength(60)]],
      lastName2: ['', [Validators.maxLength(60)]],
      birthDate: ['', [Validators.required]],
      email: ['', [Validators.required, Validators.email, Validators.maxLength(100)]],
      phone: ['', [Validators.pattern(/^[0-9+\-\s]{7,20}$/)]],
      passwords: this.fb.group(
        {
          password: ['', [Validators.pattern(PWD_PATTERN)]],
          confirm: [''],
        },
        { validators: samePassword },
      ),
      artLevel: ['', [Validators.required]],
    });
  }

  /* ====================== ANILLO IA ====================== */

  ngAfterViewInit(): void {
    if (!this.aiRing) return;
    gsap.set(this.aiRing.nativeElement, { transformOrigin: '50% 50%' });
  }

  public onRingMouseMove(event: MouseEvent): void {
    if (!this.aiRing) return;

    const ring = this.aiRing.nativeElement;
    const rect = ring.getBoundingClientRect();

    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;

    const dx = (event.clientX - cx) / (rect.width / 2);
    const dy = (event.clientY - cy) / (rect.height / 2);
    const nx = Math.max(-1, Math.min(1, dx));
    const ny = Math.max(-1, Math.min(1, dy));

    ring.style.setProperty('--ring-light-x', `${50 + nx * 18}%`);
    ring.style.setProperty('--ring-light-y', `${20 + ny * 18}%`);

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

  public onRingMouseLeave(): void {
    if (!this.aiRing) return;

    const ring = this.aiRing.nativeElement;
    this.ringTween?.kill();

    gsap.to(ring.querySelectorAll('.ai-ring-layer'), {
      duration: 0.5,
      skewX: 0,
      skewY: 0,
      scaleX: 1,
      scaleY: 1,
      ease: 'sine.out',
    });

    gsap.to(ring, {
      duration: 0.6,
      onUpdate: () => {
        ring.style.setProperty('--ring-light-x', '50%');
        ring.style.setProperty('--ring-light-y', '20%');
      },
    });
  }

  /* ====================== FORMULARIO ====================== */

  ngOnInit(): void {
    const currentUser = this.auth.getUser();
    if (!currentUser) {
      this.router.navigateByUrl('/login');
      return;
    }

    this.userData = currentUser;

    this.form.patchValue({
      firstName: currentUser.firstName || '',
      lastName1: currentUser.lastName1 || '',
      lastName2: currentUser.lastName2 || '',
      birthDate: currentUser.birthDate || '',
      email: currentUser.email || '',
      phone: currentUser.phone || '',
      artLevel: currentUser.artLevel || '',
      passwords: {
        password: '',
        confirm: '',
      },
    });
  }

  field(name: string) {
    return this.form.get(name)!;
  }

  get passwords(): FormGroup {
    return this.form.get('passwords') as FormGroup;
  }

  toggleShow(field: 'password' | 'confirm') {
    if (field === 'password') {
      this.showPassword.set(!this.showPassword());
    } else {
      this.showConfirm.set(!this.showConfirm());
    }
  }

  submit() {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.submitting.set(true);
    this.apiError.set(null);
    this.apiSuccess.set(null);

    const payload: any = {
      id: this.userData.id,
      firstName: this.field('firstName').value,
      lastName1: this.field('lastName1').value,
      lastName2: this.field('lastName2').value || '',
      birthDate: this.field('birthDate').value,
      email: this.field('email').value,
      phone: this.field('phone').value || '',
      artLevel: this.field('artLevel').value,
    };

    const pwd = this.passwords.get('password')?.value;
    if (pwd) {
      payload.password = pwd;
    }

    this.user.update(payload);
    this.apiSuccess.set('Perfil editado correctamente.');
    setTimeout(() => this.router.navigateByUrl('app/profile'), 900);
    this.submitting.set(false);
  }
}
