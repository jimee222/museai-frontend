import { inject, Injectable, signal } from '@angular/core';
import { BaseService } from './base-service';
import { ISearch, IQuiz } from '../interfaces';
import { AlertService } from './alert.service';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

@Injectable({
  providedIn: 'root',
})
export class QuizService extends BaseService<IQuiz> {

  protected override source: string = 'quizzes';

  private quizListSignal = signal<IQuiz[]>([]);
  get quizzes$() {
    return this.quizListSignal;
  }

  public search: ISearch & { keyword?: string } = { 
    page: 1,
    size: 12,
    keyword: ''
  };
  public totalItems: number[] = [];
  private alertService: AlertService = inject(AlertService);

  
  getAll() {
    const params: any = {
      page: this.search.page,
      size: this.search.size,
    };

    this.findAllWithParams(params).subscribe({
      next: (response: any) => {
        this.search = { ...this.search, ...response.meta };
        this.totalItems = Array.from(
          { length: this.search.totalPages ?? 0 },
          (_, i) => i + 1
        );
        this.quizListSignal.set(response.data);
      },
      error: (err) => {
        console.error('Error loading quizzes', err);
      }
    });
  }

  searchQuizzes(keyword: string) {
    this.search.keyword = keyword;
    this.search.page = 1; 
    this.getAll();
  }

  
 
getById(id: number) {
  return this.http.get<{ data: IQuiz }>(`${this.source}/${id}`)
    .pipe(
      map(response => response.data)
    );
}
 
  createQuiz(quiz: IQuiz): Observable<any> {
    return this.add(quiz);
  }

 
  update(quiz: IQuiz): Observable<any> {
    return this.editCustomSource(`${quiz.id}`, quiz);
  }


delete(quiz: IQuiz): Observable<any> {
  if (!quiz?.id) {
    console.error('Quiz id is missing', quiz);
    return new Observable(observer => observer.error('Quiz id is missing'));
  }
  return this.delCustomSource(`${quiz.id}`);
}
}