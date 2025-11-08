import { inject, Injectable } from '@angular/core';
import { IAuthority, ILoginResponse, IResponse, IRoleType, IUser, IHttpResponse } from '../interfaces';
import { Observable, firstValueFrom, of, tap } from 'rxjs';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private accessToken!: string;
  private expiresIn! : number;
  private user: IUser = {email: '', authorities: []};
  private http: HttpClient = inject(HttpClient);
  private loggedIn = new BehaviorSubject<boolean>(!!localStorage.getItem('access_token'));
  public isLoggedIn$ = this.loggedIn.asObservable();

  constructor() {
    this.load();
  }

  public save(): void {
    if (this.user) localStorage.setItem('auth_user', JSON.stringify(this.user));

    if (this.accessToken)
      localStorage.setItem('access_token', JSON.stringify(this.accessToken));

    if (this.expiresIn)
      localStorage.setItem('expiresIn',JSON.stringify(this.expiresIn));
  }

    private load(): void {
    const token = localStorage.getItem('access_token');
    if (token) this.accessToken = JSON.parse(token);    // <-- parsea
    const exp = localStorage.getItem('expiresIn');
    if (exp) this.expiresIn = JSON.parse(exp);
    const user = localStorage.getItem('auth_user');
    if (user) this.user = JSON.parse(user);
    }

  public getUser(): IUser | undefined {
    return this.user;
  }

  public getAccessToken(): string | null {
    return this.accessToken;
  }

  public check(): boolean {
    if (!this.accessToken){
      return false;
    } else {
      return true;
    }
  }

  public login(credentials: {
    email: string;
    password: string;
  }): Observable<ILoginResponse> {
    return this.http.post<ILoginResponse>('auth/login', credentials).pipe(
      tap((response: any) => {
        this.accessToken = response.token;
        this.user.email = credentials.email;
        this.expiresIn = response.expiresIn;
        this.user = response.authUser;
        this.save();
        this.loggedIn.next(true);
      })
    );
  }

  public hasRole(role: string): boolean {
    return this.user.authorities ?  this.user?.authorities.some(authority => authority.authority == role) : false;
  }

  public isSuperAdmin(): boolean {
    return this.user.authorities ?  this.user?.authorities.some(authority => authority.authority == IRoleType.superAdmin) : false;
  }

  public hasAnyRole(roles: any[]): boolean {
    return roles.some(role => this.hasRole(role));
  }

  public getPermittedRoutes(routes: any[]): any[] {
    let permittedRoutes: any[] = [];
    for (const route of routes) {
      if(route.data && route.data.authorities) {
        if (this.hasAnyRole(route.data.authorities)) {
          permittedRoutes.unshift(route);
        } 
      }
    }
    return permittedRoutes;
  }

  public signup(user: IUser): Observable<ILoginResponse> {
    return this.http.post<ILoginResponse>('auth/signup', user);
  }

  public register(payload: {
    firstName: string;
    lastName1: string;
    lastName2?: string;
    birthDate: string; // yyyy-MM-dd
    email: string;
    phone?: string;
    password: string;
    artLevel: 'beginner' | 'intermediate' | 'advanced';
    }) {
    return this.http.post<IHttpResponse<IUser>>('auth/register', payload);
    }

  public requestPasswordRecovery(email: string): Observable<IHttpResponse<null>> {
    return this.http.post<IHttpResponse<null>>('auth/password/recovery', { email });
  }

  public resetPassword(payload: {
    email: string;
    code: string;
    newPassword: string;
  }): Observable<IHttpResponse<null>> {
    return this.http.post<IHttpResponse<null>>('auth/password/reset', payload);
  }


  public logout() {
    this.accessToken = '';
    localStorage.removeItem('access_token');
    localStorage.removeItem('expiresIn');
    localStorage.removeItem('auth_user');
    this.loggedIn.next(false);
  }

  public getUserAuthorities (): IAuthority[] | undefined {
    return this.getUser()?.authorities ? this.getUser()?.authorities : [];
  }

  public areActionsAvailable(routeAuthorities: string[]): boolean  {
    
    let allowedUser: boolean = false;
    let isAdmin: boolean = false;
   
    let userAuthorities = this.getUserAuthorities();
    
    for (const authority of routeAuthorities) {
      if (userAuthorities?.some(item => item.authority == authority) ) {
        allowedUser = userAuthorities?.some(item => item.authority == authority)
      }
      if (allowedUser) break;
    }
   
    if (userAuthorities?.some(item => item.authority == IRoleType.admin || item.authority == IRoleType.superAdmin)) {
      isAdmin = userAuthorities?.some(item => item.authority == IRoleType.admin || item.authority == IRoleType.superAdmin);
    }          
    return allowedUser && isAdmin;
  }

public isLoggedIn(): boolean {
  return this.loggedIn.value;
}
  public reload(): void {
  this.load();
}

public setSession(loginResponse: ILoginResponse): void {
  this.accessToken = loginResponse.token;
  this.user = loginResponse.authUser;
  this.expiresIn = loginResponse.expiresIn;
  this.save();
}

}

