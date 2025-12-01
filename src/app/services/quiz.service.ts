import { inject, Injectable, signal } from '@angular/core';
import { BaseService } from './base-service';
import { ISearch, IQuiz, IQuizAttemptResponse } from '../interfaces';
import { AlertService } from './alert.service';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

@Injectable({ providedIn: 'root' })
export class QuizService extends BaseService<IQuiz> {

  protected override source: string = 'quizzes';

  private quizListSignal = signal<IQuiz[]>([]);
  get quizzes$() {
    return this.quizListSignal;
  }

  userAttempts = signal<IQuizAttemptResponse[]>([]);

  public search: ISearch & { keyword?: string } = {
    page: 1,
    size: 12,
    keyword: ''
  };

  public totalItems: number[] = [];
  private alertService: AlertService = inject(AlertService);

  
  getAll() {
    const params: any = { page: this.search.page, size: this.search.size };

    this.findAllWithParams(params).subscribe({
      next: (response: any) => {
        this.search = { ...this.search, ...response.meta };
        this.totalItems = Array.from({ length: this.search.totalPages ?? 0 }, (_, i) => i + 1);
        this.quizListSignal.set(this.mapWithAttempts(response?.data ?? []));
      },
      error: (err) => console.error('Error loading quizzes', err)
    });
  }

 
  getAvailableQuizzes() {
    const params: any = { page: this.search.page, size: this.search.size };

    this.http.get<any>(`${this.source}/valid`, { params }).subscribe({
      next: (res) => {
        const data: IQuiz[] = Array.isArray(res?.data) ? res.data : [];
        const meta = res?.meta ?? {};

       
        this.search = { ...this.search, ...meta };
        this.totalItems = Array.from({ length: this.search.totalPages ?? 0 }, (_, i) => i + 1);

       
        this.quizListSignal.set(this.mapWithAttempts(data, this.userAttempts()));
      },
      error: (err) => {
        console.error('Error fetching available quizzes:', err);
        this.alertService.displayAlert(
          'error',
          err?.error?.message || 'No fue posible cargar los quizzes disponibles'
        );
      }
    });
  }

  
  loadUserAttempts(userId: number) {
    this.http.get<any>(`/quiz-attempts/user/${userId}`).subscribe({
      next: (res) => {
        const attempts: IQuizAttemptResponse[] = Array.isArray(res?.data) ? res.data : [];
        this.userAttempts.set(attempts);

        
        this.quizListSignal.update(quizzes => this.mapWithAttempts(quizzes, attempts));
      },
      error: (err) => console.error('Error loading attempts:', err)
    });
  }

 
  private mapWithAttempts(quizzes: IQuiz[], attempts?: IQuizAttemptResponse[]): IQuiz[] {
    const userAttemptsArray: IQuizAttemptResponse[] = Array.isArray(attempts)
      ? attempts
      : Array.isArray(this.userAttempts())
        ? this.userAttempts()
        : [];

    return quizzes.map(q => {
      const quizAttempts = userAttemptsArray.filter(a => a.quizId === q.id);

      const maxScore = quizAttempts.length
        ? Math.max(...quizAttempts.map(a => a.score))
        : null;

      const lastAttempt = quizAttempts.length
        ? new Date(quizAttempts[quizAttempts.length - 1].timestamp)
        : undefined;

      return {
        ...q,
        hasAttempt: quizAttempts.length > 0,
        maxScore,
        lastAttempt
      };
    });
  }

 
  public updateLocalQuizzes(quizzes: IQuiz[]) {
    this.quizListSignal.set(quizzes);
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
    answers: { questionId: number; selectedOptionId: number }[];
  }): Observable<{ score: number }> {
    return this.http.post<{ score: number }>(`${this.source}/attempt`, payload);
  }
}
