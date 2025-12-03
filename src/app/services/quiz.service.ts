import { inject, Injectable, signal } from '@angular/core';
import { BaseService } from './base-service';
import { ISearch, IQuiz } from '../interfaces';
import { AlertService } from './alert.service';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { AuthService } from './auth.service';

@Injectable({ providedIn: 'root' })
export class QuizService extends BaseService<IQuiz> {

  protected override source: string = 'quizzes';

  private quizListSignal = signal<any[]>([]);
  get quizzes$() {
    return this.quizListSignal;
  }

 
  userQuizProgress = signal<any[]>([]);

  public search: ISearch & { keyword?: string } = {
    page: 1,
    size: 12,
    keyword: ''
  };

  public totalItems: number[] = [];
  private alertService: AlertService = inject(AlertService);
  private authService: AuthService = inject(AuthService);

  
  getAll() {
  const params: any = { page: this.search.page, size: this.search.size };

  this.findAllWithParams(params).subscribe({
    next: (response: any) => {

      const user = this.authService.getUser();
      const isAdmin = user?.role?.name === 'SUPER_ADMIN';

      let quizzes = response?.data ?? [];

      if (!isAdmin) {
  quizzes = quizzes.filter((q: IQuiz) => Array.isArray(q.questions) && q.questions.length > 0);
}


      this.search = { ...this.search, ...response.meta };
      this.totalItems = Array.from({ length: this.search.totalPages ?? 0 }, (_, i) => i + 1);

      this.quizListSignal.set(quizzes);
    },
    error: (err) => console.error('Error loading quizzes', err)
  });
}



  loadUserQuizProgress(userId: number) {
    this.http.get<any>(`/quiz-attempts/user/${userId}/progress`).subscribe({
      next: (res) => {
        const progress = Array.isArray(res?.data) ? res.data : [];
        this.userQuizProgress.set(progress);
        this.quizListSignal.set(progress);
      },
      error: (err) => {
        console.error('Error loading quiz progress:', err);
        this.alertService.displayAlert(
          'error',
          err?.error?.message || 'No fue posible cargar tu progreso'
        );
      }
    });
  }

  userAttemptsList = signal<any[]>([]);

loadAllAttempts(userId: number) {

  this.http.get<any>(`/quiz-attempts/user/${userId}/all`).subscribe({
    next: (res) => {
      

      const attempts = Array.isArray(res?.data) ? res.data : [];
      

      
      this.userAttemptsList.set(attempts);

      
    },
    error: (err) => {
     
    }
  });
}




  getById(id: number) {
    return this.http.get<{ data: IQuiz }>(`${this.source}/${id}`)
      .pipe(map(response => response.data));
  }

  createQuiz(quiz: IQuiz): Observable<any> {
    return this.add(quiz);
  }

  update(quiz: IQuiz): Observable<any> {
    return this.editCustomSource(`${quiz.id}`, quiz);
  }

  delete(quiz: IQuiz): Observable<any> {
    if (!quiz?.id) return new Observable(o => o.error('Quiz id is missing'));
    return this.delCustomSource(`${quiz.id}`);
  }


  submitAttempt(payload: {
    quizId: number;
    userId: number;
    answers: { questionId: number; selectedOptionId: number }[];
  }): Observable<any> {
    return this.http.post(`/quiz-attempts`, payload);
  }
}
