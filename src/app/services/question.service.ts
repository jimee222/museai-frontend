import { Injectable, inject, signal } from '@angular/core';
import { BaseService } from './base-service';
import { IQuestion, IOption } from '../interfaces';
import { Observable, forkJoin } from 'rxjs';
import { map, switchMap } from 'rxjs/operators';
import { AlertService } from './alert.service';

@Injectable({
  providedIn: 'root',
})
export class QuestionService extends BaseService<IQuestion> {

  protected override source: string = 'questions';
  private alertService: AlertService = inject(AlertService);

  private questionListSignal = signal<IQuestion[]>([]);
  get questions$() { return this.questionListSignal; }


  getByQuizId(quizId: number): Observable<IQuestion[]> {
    return this.http.get<{ data: IQuestion[]}>(`quizzes/${quizId}/questions`)
      .pipe(map(res => res.data));
  }

  getById(quizId: number, id: number): Observable<IQuestion> {
  return this.http.get<{ data: IQuestion }>(`quizzes/${quizId}/questions/${id}`)
    .pipe(map(r => r.data));
}

  
createQuestion(quizId: number, q: IQuestion): Observable<IQuestion> {

  if (q.options.length < 2) throw new Error("La pregunta debe tener mínimo 2 opciones");

  const duplicate = new Set(q.options.map(o => o.text.trim())).size !== q.options.length;
  if (duplicate) throw new Error("Las opciones no pueden ser iguales");

  return this.http.post<{ data: IQuestion }>(`quizzes/${quizId}/questions`, q)
        .pipe(map(r => r.data));
}


updateQuestion(quizId: number, q: IQuestion): Observable<IQuestion> {

  if (q.options.length < 2) throw new Error("La pregunta debe tener mínimo 2 opciones");

  const duplicate = new Set(q.options.map(o => o.text.trim())).size !== q.options.length;
  if (duplicate) throw new Error("Las opciones no pueden repetirse");

  return this.http.put<{ data: IQuestion }>(`quizzes/${quizId}/questions/${q.id}`, q)
        .pipe(map(r => r.data));
}


 
  deleteQuestion(quizId: number, questionId: number): Observable<any> {
    return this.http.delete(`quizzes/${quizId}/questions/${questionId}`);
  }

  saveAllQuestions(quizId: number, questions: IQuestion[]): Observable<any> {

    const requests = questions.map(q =>
      q.id ? this.updateQuestion(quizId, q)
           : this.createQuestion(quizId, q)
    );

    return forkJoin(requests);
  }
}
