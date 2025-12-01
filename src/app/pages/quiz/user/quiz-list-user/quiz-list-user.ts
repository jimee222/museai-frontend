import { Component, OnInit, CUSTOM_ELEMENTS_SCHEMA, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../../../services/auth.service';
import { QuizService } from '../../../../services/quiz.service';
import { IUser, IQuiz } from '../../../../interfaces';
import { showMuseAlert } from '../../../../shared/utils/alert';

@Component({
  selector: 'app-quiz-list-user',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './quiz-list-user.html',
  styleUrls: ['./quiz-list-user.css'],
  schemas: [CUSTOM_ELEMENTS_SCHEMA]
})
export class QuizListUser implements OnInit {

  user = signal<IUser | null>(null);
  loading = signal<boolean>(true);
  error = signal<string | null>(null);

 
  searchTerm = signal<string>('');

 
  filteredQuizzes = computed(() => {
    const term = this.searchTerm().toLowerCase();
    const quizzes = this.quizService.quizzes$(); 
    return term
      ? quizzes.filter(q => q.title.toLowerCase().includes(term))
      : quizzes;
  });

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

    this.user.set(currentUser);

    
    this.quizService.getAvailableQuizzes();

   
    if (currentUser.id !== undefined && currentUser.id !== null) {
      this.quizService.loadUserAttempts(currentUser.id);
    }

    this.loading.set(false);
  }

  startQuiz(quiz: IQuiz) {
    if (!quiz?.questionCount || quiz.questionCount < 1) {
      showMuseAlert(
        'warning',
        'Este quiz no contiene preguntas disponibles.',
        'Quiz sin preguntas'
      );
      return;
    }
    this.router.navigateByUrl(`/app/quizzes/${quiz.id}/attempt`);
  }

  return() {
    this.router.navigateByUrl('/app/menu');
  }
}
