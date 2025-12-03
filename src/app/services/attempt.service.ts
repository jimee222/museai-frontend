import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { IQuizAttemptResponse } from '../interfaces';

@Injectable({ providedIn: 'root' })
export class AttemptService {

  private base = '/quiz-attempts';

  constructor(private http: HttpClient) {}

  registerAttempt(payload: any) {
    return this.http.post<IQuizAttemptResponse>(this.base, payload);
  }
}
