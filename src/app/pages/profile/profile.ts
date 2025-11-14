import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { IUser } from '../../interfaces';
import { ProfileCardComponent } from '../../components/profile-card/profile-card.component';

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [CommonModule, ProfileCardComponent],
  templateUrl: './profile.html',
  styleUrl: './profile.css'
})
export class Profile implements OnInit {

  user = signal<IUser | null>(null);
  loading = signal(true);
  error = signal<string | null>(null);
  activeTab = signal<'info' | 'quizzes' | 'recorridos'>('info'); // 👈 nueva señal

  constructor(
    private auth: AuthService,
    private router: Router
  ) {}

  ngOnInit(): void {
    try {
      const currentUser = this.auth.getUser();

      if (!currentUser) {
        this.router.navigateByUrl('/login');
        return;
      }

      this.user.set(currentUser);
      this.loading.set(false);

    } catch (err) {
      console.error('Error al cargar el perfil:', err);
      this.error.set('Hubo un problema al cargar tu perfil.');
      this.loading.set(false);
    }
  }
}
