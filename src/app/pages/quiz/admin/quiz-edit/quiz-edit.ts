import { Component, OnInit, CUSTOM_ELEMENTS_SCHEMA, signal, computed, } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import Swal from 'sweetalert2';
import { AuthService } from '../../../../services/auth.service';
import { QuizService } from '../../../../services/quiz.service'; 
import { IUser, IRoleType, IQuiz } from '../../../../interfaces';
import { AnimationOptions } from 'ngx-lottie';

@Component({
  selector: 'app-quiz-edit',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './quiz-edit.html',
  styleUrls: ['./quiz-edit.css'],
  schemas: [CUSTOM_ELEMENTS_SCHEMA]
})
export class QuizEdit implements OnInit {

  form: any;
  user = signal<IUser | null>(null);
  loading = signal(false);
  error = signal<string | null>(null);

  quiz = signal<IQuiz | null>(null);
  imagePreview = signal<string | null>(null);
  uploadingImage = signal(false);

  canSubmit = computed(() => this.form?.valid && !this.loading());

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
    private router: Router,
    private route: ActivatedRoute
  ) {}

  ngOnInit() {
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

  const quizId = Number(this.route.snapshot.paramMap.get('id'));
if (!quizId || isNaN(quizId)) {
  this.router.navigateByUrl('/app/quizzes-admin');
  return;
}


    this.loading.set(true);
    this.quizService.getById(quizId).subscribe({
      next: (quizData: IQuiz) => {
        this.quiz.set(quizData);
        this.form.patchValue({
          title: quizData.title,
          description: quizData.description,
          level: quizData.level,
          imageUrl: quizData.imageUrl
        });
        this.imagePreview.set(quizData.imageUrl || null);
        this.loading.set(false);
      },
      error: (err) => {
        console.error('Error al cargar el quiz:', err);
        Swal.fire({
          icon: 'error',
          title: 'Error',
          text: 'No se pudo cargar el quiz. Intenta de nuevo.'
        });
        this.router.navigateByUrl('/app/quizzes-admin');
        this.loading.set(false);
      }
    });
  }

  onFileSelected(event: any) {
    const file = event.target.files[0];
    if (!file) return;

    this.uploadingImage.set(true);
    const formData = new FormData();
    formData.append('file', file);
    formData.append('upload_preset', this.uploadPreset);

    fetch(this.cloudinaryUrl, { method: 'POST', body: formData })
      .then(res => res.json())
      .then(data => {
        this.form.patchValue({ imageUrl: data.secure_url });
        this.imagePreview.set(data.secure_url);
      })
      .catch(err => {
        console.error('Error al subir imagen:', err);
        Swal.fire({
          icon: 'error',
          title: 'Error',
          text: 'No se pudo subir la imagen. Intente nuevamente.'
        });
      })
      .finally(() => this.uploadingImage.set(false));
  }

  submit() {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.loading.set(true);
    this.error.set(null);

    const updatedQuiz: IQuiz = { ...this.quiz(), ...this.form.value };

    this.quizService.update(updatedQuiz).subscribe({
      next: () => {
        this.loading.set(false);
        Swal.fire({
          icon: 'success',
          title: 'Quiz actualizado',
          showConfirmButton: false,
          timer: 1500,
          confirmButtonText: 'Aceptar',
          confirmButtonColor: '#d7b25a',
          background: '#2c1b12',
          color: '#fff',
        });
        this.router.navigateByUrl('/app/quizzes-admin');
      },
      error: (err) => {
        console.error('Error al actualizar quiz:', err);
        const msg = err?.error?.message || err?.message || 'No se pudo actualizar el quiz';
        this.error.set(msg);
        this.loading.set(false);
      }
    });
  }

  goToQuestions() {
  const quizId = this.quiz()?.id;
  this.router.navigateByUrl(`/app/quiz/questions/${quizId}`);
}
return() {
    this.router.navigateByUrl('/app/quizzes-admin');
  }
  cancel() {
    this.router.navigateByUrl('/app/quizzes-admin');
  }
}
