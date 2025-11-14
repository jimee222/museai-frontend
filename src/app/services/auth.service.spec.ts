import { TestBed } from '@angular/core/testing';
import { provideHttpClient, HttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { AuthService } from './auth.service';
import { ILoginResponse, IUser } from '../interfaces';

describe('AuthService', () => {
  let service: AuthService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        AuthService,
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    });

    service = TestBed.inject(AuthService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    localStorage.clear();
    httpMock.verify();
  });

  it('should perform successful login and save data', () => {
    const mockUser: IUser = {
      email: 'test@example.com',
      authorities: [{ authority: 'ROLE_USER' }],
    };

    const mockResponse: ILoginResponse = {
      token: 'fake-jwt-token',
      authUser: mockUser,
      expiresIn: 3600,
    };

  service.login({ email: 'test@example.com', password: '12345' }).subscribe((response) => {
  expect(response).toEqual(mockResponse);
  expect(service.getAccessToken()).toBe('fake-jwt-token');
  expect(service.getUser()?.email).toBe('test@example.com');
});

    const req = httpMock.expectOne('auth/login');
    expect(req.request.method).toBe('POST');
    req.flush(mockResponse);

    
    expect(service.isLoggedIn()).toBeTrue();
  });

  it('should handle login error', () => {
    const mockCredentials = { email: 'wrong@example.com', password: 'wrongpass' };

    service.login(mockCredentials).subscribe({
      next: () => fail('Expected an error, but got success'),
      error: (error) => {
        expect(error.status).toBe(401);
      },
    });

    const req = httpMock.expectOne('auth/login');
    expect(req.request.method).toBe('POST');
    req.flush('Unauthorized', { status: 401, statusText: 'Unauthorized' });

    
    expect(service.isLoggedIn()).toBeFalse();
  });
});
