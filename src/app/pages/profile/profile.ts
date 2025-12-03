import { Component, OnInit, signal, CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { IUser } from '../../interfaces';
import { ProfileCardComponent } from '../../components/profile-card/profile-card.component';
import { MyQuizzes } from '../../components/my-quizzes/my-quizzes.component';
import { QuizService } from '../../services/quiz.service';

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [CommonModule, ProfileCardComponent, MyQuizzes],
  templateUrl: './profile.html',
  styleUrls: ['./profile.css'], 
  schemas: [CUSTOM_ELEMENTS_SCHEMA]
})
export class Profile implements OnInit {

  user = signal<IUser | null>(null);
  loading = signal(true);
  error = signal<string | null>(null);
  activeTab = signal<'info' | 'quizzes'>('info');

  constructor(
    private auth: AuthService,
    private router: Router,
    private quizService: QuizService
  ) {}

  ngOnInit(): void {
    try {
      const currentUser = this.auth.getUser();

      if (!currentUser) {
        this.router.navigateByUrl('/login');
        return;
      }

      this.user.set(currentUser);

      
      if (currentUser.id != null) {
        this.quizService.loadAllAttempts(currentUser.id);
      }

      this.loading.set(false);

    } catch (err) {
      console.error('Error al cargar el perfil:', err);
      this.error.set('Hubo un problema al cargar tu perfil.');
      this.loading.set(false);
    }
  }
}
