import { Component, OnInit, signal, CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../../../services/auth.service';
import { QuizService } from '../../../../services/quiz.service';
import { IUser, IRoleType, IQuiz } from '../../../../interfaces';
import Swal from 'sweetalert2';
import { firstValueFrom } from 'rxjs';

@Component({
  selector: 'app-quiz-list-admin',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './quiz-list-admin.html',
  styleUrls: ['./quiz-list-admin.css'],
  schemas: [CUSTOM_ELEMENTS_SCHEMA]
})
export class QuizListAdmin implements OnInit {

  user = signal<IUser | null>(null);
  loading = signal(true);
  error = signal<string | null>(null);

  searchTerm = signal<string>('');

  constructor(
    private auth: AuthService,
    public quizService: QuizService,
    private router: Router
  ) {}

  ngOnInit(): void {
    const currentUser = this.auth.getUser();
    if (!currentUser) {
      this.router.navigateByUrl('/login');
      return;
    }

    const roleName = currentUser.role?.name || '';
    const normalizedRole = `ROLE_${roleName.toUpperCase()}`;
    if (normalizedRole !== IRoleType.superAdmin && normalizedRole !== IRoleType.admin) {
      this.router.navigateByUrl('/app/menu');
      return;
    }

    this.user.set(currentUser);

    this.quizService.getAll();
    this.loading.set(false);
  }

  createNewQuiz() {
    this.router.navigateByUrl('/app/quiz/create');
  }

  get filteredQuizzes(): IQuiz[] {
    const term = this.searchTerm().toLowerCase();
    if (!term) return this.quizService.quizzes$();
    return this.quizService.quizzes$().filter(q => q.title.toLowerCase().includes(term));
  }

  goToQuiz(quizId: number) {
    this.router.navigateByUrl(`/app/quiz/edit/${quizId}`);
  }

  async deleteQuiz(quiz: IQuiz) {
    const result = await Swal.fire({
      title: '¿Estás seguro?',
      text: `Eliminarás el quiz "${quiz.title}"`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Sí, eliminar',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#d7b25a',
      cancelButtonColor: '#6d552a',
      background: '#2c1b12',
      color: '#fff',
    });

    if (!result.isConfirmed) return;

    try {
     
      await firstValueFrom(this.quizService.delete(quiz));

   
      await Swal.fire({
        icon: 'success',
        background: '#2c1b12',
        color: '#fff',
        title: 'Quiz eliminado',
        showConfirmButton: false,
        timer: 1500
      });

      this.quizService.getAll();

    } catch (error) {
     
      console.error('ERROR AL ELIMINAR QUIZ:', error);

      Swal.fire({
        icon: 'error',
        title: 'Error al eliminar',
        text: 'Hubo un problema al eliminar el quiz.'
      });
    }
  }
}
