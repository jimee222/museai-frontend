import { TestBed } from '@angular/core/testing';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { UserService } from './user.service';
import { AlertService } from './alert.service';
import { IUser, IResponse } from '../interfaces';
import { of, throwError } from 'rxjs';

describe('UserService', () => {
  let service: UserService;
  let alertServiceSpy: jasmine.SpyObj<AlertService>;

  beforeEach(() => {
    alertServiceSpy = jasmine.createSpyObj('AlertService', ['displayAlert']);

    TestBed.configureTestingModule({
      providers: [
        UserService,
        { provide: AlertService, useValue: alertServiceSpy },
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    });

    service = TestBed.inject(UserService);
  });

  it('should call alertService.displayAlert on successful save', () => {
    const mockUser: IUser = {
      id: 1,
      firstName: 'Juan',
      lastName1: 'Perez',
      lastName2: 'Test',
      birthDate: '1990-01-01',
      email: 'juan@test.com',
      password: '12345',
      phone: '88888888',
      artLevel: 'advanced',
    };

    const mockResponse: IResponse<IUser> = {
      message: 'User added successfully',
      data: mockUser,
      meta: {} as IUser,
    };


    spyOn(service, 'add').and.returnValue(of(mockResponse));

    service.save(mockUser);

    expect(alertServiceSpy.displayAlert).toHaveBeenCalledWith(
      'success',
      'User added successfully',
      'center',
      'top',
      ['success-snackbar']
    );
  });

  it('should call alertService.displayAlert on error', () => {
    const mockUser: IUser = {
      id: 2,
      firstName: 'Maria',
      lastName1: 'Test',
      email: 'maria@test.com',
      artLevel: 'beginner',
    };

    spyOn(service, 'add').and.returnValue(throwError(() => new Error('Add failed')));

    service.save(mockUser);

    expect(alertServiceSpy.displayAlert).toHaveBeenCalledWith(
      'error',
      'An error occurred adding the user',
      'center',
      'top',
      ['error-snackbar']
    );
  });
});
