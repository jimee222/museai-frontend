import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';
import { Router } from '@angular/router';
import { AuthService } from './auth.service';
import { ILoginResponse } from '../interfaces';

declare const google: any;

@Injectable({
  providedIn: 'root'
})
export class GoogleAuthService {
  private clientId = environment.googleClientId;
  private initialized = false;

  constructor(
    private http: HttpClient,
    private router: Router,
    private authService: AuthService
  ) {}

   private ensureInit() {
    if (this.initialized) return;
    if (typeof google === 'undefined') return;

    google.accounts.id.initialize({
      client_id: this.clientId,
      callback: (response: any) => this.handleCredentialResponse(response),
    });
    this.initialized = true;
  }

    /** Pinta el botón oficial de Google dentro del elemento con ese id */
  renderGoogleButton(targetId: string) {
    this.ensureInit();
    const el = document.getElementById(targetId);
    if (!el || typeof google === 'undefined') return;

    google.accounts.id.renderButton(el, {
      theme: 'outline',
      size: 'large',
      // (opcional) otros estilos del botón:
      // type: 'standard', shape: 'rectangular', text: 'continue_with', logo_alignment: 'left'
    });

    // (opcional) mostrar el One Tap
    // google.accounts.id.prompt();
  }

  signInWithGoogle() {
    google.accounts.id.initialize({
      client_id: this.clientId,
      callback: (response: any) => this.handleCredentialResponse(response)
    });

    google.accounts.id.renderButton(
      document.getElementById("googleButtonDiv"),
      { theme: "outline", size: "large" }
    );
  }

  private handleCredentialResponse(response: any) {
    const idToken = response.credential;

    this.http.post<ILoginResponse>(`${environment.apiUrl}/auth/google`, { idToken })
      .subscribe({
        next: (res) => {
          this.authService.setSession(res);
          this.router.navigateByUrl('/museum');
        },
        error: (err) => console.error('Error en login con Google:', err)
      });
  }
}
