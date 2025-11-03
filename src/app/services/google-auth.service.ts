import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';
import { Router } from '@angular/router';

declare const google: any;

@Injectable({
  providedIn: 'root'
})
export class GoogleAuthService {
  private clientId = '951939636581-dsvpc8hdbhi5678d9dpojjbvr0jk5go6.apps.googleusercontent.com'; 

  constructor(private http: HttpClient, private router: Router) {}

  /** Inicializa el SDK de Google */
  initGoogle() {
    if (typeof google !== 'undefined') {
      google.accounts.id.initialize({
        client_id: this.clientId,
        callback: (response: any) => this.handleCredentialResponse(response)
      });
    }
  }

  /** Ejecuta el flujo One Tap (si quieres mostrar popup automático) */
  prompt() {
    if (typeof google !== 'undefined') {
      google.accounts.id.prompt();
    }
  }

  /** Recibe el token y lo envía al backend */
  handleCredentialResponse(response: any) {
    const idToken = response.credential;

    this.http.post(`${environment.apiUrl}/auth/google`, { idToken }).subscribe({
      next: (res: any) => {
        localStorage.setItem('token', res.token);
        this.router.navigate(['/app/dashboard']);
      },
      error: err => {
        console.error('Error en login con Google:', err);
      }
    });
  }

  /** Abre el popup nativo de Google (sin botón renderizado automático) */
 signInWithGoogle() {
  google.accounts.id.initialize({
    client_id: this.clientId,
    callback: (response: any) => this.handleCredentialResponse(response)
  });

  // 🔹 Mostrar botón estándar (evita problemas de CORS)
  google.accounts.id.renderButton(
    document.getElementById("googleButtonDiv"),
    { theme: "outline", size: "large" }
  );
}
}

