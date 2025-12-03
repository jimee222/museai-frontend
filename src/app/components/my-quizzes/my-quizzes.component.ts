import { Component, OnInit, signal, computed, CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../services/auth.service';
import { QuizService } from '../../services/quiz.service';
import { IUser } from '../../interfaces';
import { Router } from '@angular/router';


@Component({
  selector: 'app-my-quizzes',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './my-quizzes.component.html',
  styleUrls: ['./my-quizzes.component.css'],
  schemas: [CUSTOM_ELEMENTS_SCHEMA]
})
export class MyQuizzes implements OnInit {

  user = signal<IUser | null>(null);
  searchTerm = signal<string>('');
  selectedAttempt = signal<any | null>(null);
  scrollY: number = 0;

  filteredAttempts = computed(() => {
    const term = this.searchTerm().toLowerCase();
    return this.quizService.userAttemptsList()
      .filter(a => a.quizTitle.toLowerCase().includes(term))
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  });

  constructor(
    private auth: AuthService,
    public quizService: QuizService,
    private router: Router
  ) {}

  ngOnInit(): void {
    const currentUser = this.auth.getUser();
    if (currentUser?.id) {
      this.user.set(currentUser);
      this.quizService.loadAllAttempts(currentUser.id);
    }
  }

  formatDate(timestamp: string): string {
    return new Date(timestamp).toLocaleString();
  }

onStartQuiz(quizId: number) {
  if (!quizId) return;

  this.router.navigate([`/app/quizzes/${quizId}/attempt`]);
}


 
  onReviewAttempt(attempt: any) {
    this.scrollY = window.scrollY; 
    this.selectedAttempt.set(attempt);
  }

  closeModal() {
    this.selectedAttempt.set(null);
  }
}
