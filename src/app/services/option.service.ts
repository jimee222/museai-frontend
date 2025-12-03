import { Injectable } from '@angular/core';
import { BaseService } from './base-service';
import { IOption } from '../interfaces';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

@Injectable({
  providedIn: 'root',
})
export class OptionService extends BaseService<IOption> {

  protected override source = 'options';

  getByQuestionId(questionId: number): Observable<IOption[]> {
    return this.http
      .get<{ data: IOption[] }>(`${this.source}/by-question/${questionId}`)
      .pipe(map(r => r.data));
  }

  createOption(option: IOption): Observable<any> {
    return this.add(option);
  }

  updateOption(option: IOption): Observable<any> {
    return this.editCustomSource(`${option.id}`, option);
  }

  deleteOption(optionId: number): Observable<any> {
    return this.delCustomSource(`${optionId}`);
  }
}
