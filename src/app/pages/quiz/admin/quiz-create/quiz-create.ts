import { Component, OnInit, CUSTOM_ELEMENTS_SCHEMA, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import Swal from 'sweetalert2';
import { AuthService } from '../../../../services/auth.service';
import { QuizService } from '../../../../services/quiz.service'; 
import { IUser, IRoleType } from '../../../../interfaces';
import { AnimationOptions } from 'ngx-lottie';

@Component({
  selector: 'app-quiz-create',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './quiz-create.html',
  styleUrls: ['./quiz-create.css'],
  schemas: [CUSTOM_ELEMENTS_SCHEMA]
})
export class QuizCreate implements OnInit {

  form: any;
  user = signal<IUser | null>(null);
  loading = signal(false);
  error = signal<string | null>(null);

  imagePreview = signal<string | null>(null);
  uploadingImage = signal(false);

  
  placeholderOptions: AnimationOptions = {
    path: '/assets/lottie/image.json',
    autoplay: true,
    loop: true
  };

  cloudinaryUrl = 'https://api.cloudinary.com/v1_1/dfakn2ntb/image/upload';
  uploadPreset = 'muse_ai';

  constructor(
    private fb: FormBuilder,
    private auth: AuthService,
    private quizService: QuizService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.form = this.fb.group({
      title: ['', [Validators.required, Validators.minLength(3)]],
      description: [''], 
      level: ['', Validators.required],
      imageUrl: ['']
    });

    this.form.get('imageUrl')?.valueChanges.subscribe((url: string) => {
      this.imagePreview.set(url || null);
    });

    const currentUser = this.auth.getUser();
    if (!currentUser) {
      this.router.navigateByUrl('/login');
      return;
    }

    const roleName = currentUser.role?.name?.toUpperCase() || '';
    const normalized = `ROLE_${roleName}`;
    if (normalized !== IRoleType.superAdmin && normalized !== IRoleType.admin) {
      this.router.navigateByUrl('/app/menu');
      return;
    }

    this.user.set(currentUser);
  }

  async onFileSelected(event: any) {
    const file = event.target.files[0];
    if (!file) return;

    this.uploadingImage.set(true);

    const formData = new FormData();
    formData.append('file', file);
    formData.append('upload_preset', this.uploadPreset);

    try {
      const response = await fetch(this.cloudinaryUrl, { method: 'POST', body: formData });
      const data = await response.json();
      this.form.patchValue({ imageUrl: data.secure_url });
      this.imagePreview.set(data.secure_url);
    } catch (err) {
      console.error('Error al subir imagen:', err);
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: 'No se pudo subir la imagen. Intente nuevamente.'
      });
    } finally {
      this.uploadingImage.set(false);
    }
  }

submit() {
  if (this.form.invalid) {
    this.form.markAllAsTouched();
    return;
  }

  this.loading.set(true);
  this.error.set(null);

  const newQuiz = this.form.value;

  this.quizService.createQuiz(newQuiz).subscribe({
    next: (response: any) => {
      this.loading.set(false);

     const quizId = response?.data?.id;

      Swal.fire({
        icon: 'success',
        title: 'Quiz creado',
        text: '¡El quiz fue creado exitosamente!',
        confirmButtonText: 'Continuar',
        confirmButtonColor: '#d7b25a',
        didOpen: () => {
          const confirmBtn = document.querySelector<HTMLButtonElement>('.swal2-confirm');
          if (confirmBtn) {
            confirmBtn.addEventListener('mouseenter', () => {
              confirmBtn.style.backgroundColor = '#403E3D';
            });
            confirmBtn.addEventListener('mouseleave', () => {
              confirmBtn.style.backgroundColor = '#d7b25a';
            });
          }
        }
      }).then(() => {

Swal.fire({
  title: 'Agregar preguntas',
  text: 'Ahora debe agregar preguntas para este quiz.',
  icon: 'info',
  showCancelButton: true,
  confirmButtonText: 'Ir ahora',
  cancelButtonText: 'Luego',
  confirmButtonColor: '#d7b25a',
  cancelButtonColor: '#403E3D',
}).then(result => {
  if (result.isConfirmed) {
    this.router.navigateByUrl(`/app/quiz/questions/${quizId}`);
  } else {
    this.router.navigateByUrl('/app/quizzes-admin');
  }
});




      });
    },
    error: (err) => {
      console.error('Error al crear el quiz:', err);
      this.error.set('No se pudo crear el quiz. Intente nuevamente.');
      this.loading.set(false);
    }
  });
}

  cancel() {
    this.router.navigateByUrl('/app/quizzes-admin');
  }
}
