import { Component, OnInit, computed, signal } from '@angular/core';
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
import { AuthService } from '../../services/auth.service'; 
import { UserService } from '../../services/user.service';  

function samePassword(group: AbstractControl): ValidationErrors | null {
  const pwd  = group.get('password')?.value;
  const cpwd = group.get('confirm')?.value;
  return pwd && cpwd && pwd !== cpwd ? { mismatch: true } : null;
}

const PWD_PATTERN = /^(?=(?:.*[A-Z]){2,})(?=.*[a-z])(?=.*\d).{8,}$/;

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
  selector: 'app-edit-profile',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, NgOptimizedImage],
  templateUrl: './edit-profile.html',
  styleUrl: './edit-profile.css',
})
export class EditProfile implements OnInit {
  form: FormGroup;
  userData: any; 

  showPassword = signal(false);
  showConfirm = signal(false);


  submitting = signal(false);
  apiError  = signal<string | null>(null);
  apiSuccess= signal<string | null>(null);
  canSubmit = computed(() => this.form.valid && !this.submitting());

  levels = [
    { value: 'BEGINNER',     label: 'Principiante' },
    { value: 'INTERMEDIATE', label: 'Intermedio'   },
    { value: 'ADVANCED',     label: 'Avanzado'     },
  ];

  constructor(
    private fb: FormBuilder,
    private auth: AuthService,
    private router: Router,
    private user: UserService
  ) {
    this.form = this.fb.group({
      firstName: ['', [Validators.required, Validators.maxLength(60)]],
      lastName1: ['', [Validators.required, Validators.maxLength(60)]],
      lastName2: ['', [Validators.maxLength(60)]],
      birthDate: ['', [Validators.required]],
      email: ['', [Validators.required, Validators.email, Validators.maxLength(100)]],
      phone: ['', [Validators.pattern(/^[0-9+\-\s]{7,20}$/)]],
      passwords: this.fb.group({
        password: ['', [Validators.required, Validators.pattern(PWD_PATTERN)]],
        confirm:  ['', [Validators.required]],
      }, { validators: samePassword }),
      artLevel: ['', [Validators.required]],
    });
  }

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
      confirm: ''
    }
  });
}


  field(name: string) { return this.form.get(name)!; }
  get passwords(): FormGroup { return this.form.get('passwords') as FormGroup; }


  toggleShow(field: 'password' | 'confirm') {
    if (field === 'password') this.showPassword.set(!this.showPassword());
    else this.showConfirm.set(!this.showConfirm());
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
      id: this.userData.id,
      firstName: this.field('firstName').value,
      lastName1: this.field('lastName1').value,
      lastName2: this.field('lastName2').value || '',
      birthDate: this.field('birthDate').value, 
      email:     this.field('email').value,
      phone:     this.field('phone').value || '',
      password:  this.passwords.get('password')?.value,
      artLevel:  this.field('artLevel').value as 'beginner'|'intermediate'|'advanced',
    };

    
    if (!payload.password) {
      delete payload.password;
    }

    this.user.update(payload); 
    this.apiSuccess.set('Perfil editado correctamente.'); 
    setTimeout(() => this.router.navigateByUrl('app/profile'), 900); 
    this.submitting.set(false);
  }
}
