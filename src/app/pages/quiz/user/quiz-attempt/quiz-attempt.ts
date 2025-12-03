import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import Swal from 'sweetalert2';
import { AuthService } from '../../../../services/auth.service';
import { QuizService } from '../../../../services/quiz.service';
import { AttemptService } from '../../../../services/attempt.service';
import { IQuiz, IQuizAttemptResponse, IUser } from '../../../../interfaces';
import { showMuseAlert } from '../../../../shared/utils/alert';


@Component({
  selector: 'app-quiz-attempt',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './quiz-attempt.html',
  styleUrls: ['./quiz-attempt.css']
})
export class QuizAttemptComponent implements OnInit {

  quiz = signal<IQuiz | null>(null);
  loading = signal(false);
  selectedOptions: (number | null)[] = [];
  user = signal<IUser | null>(null);

  constructor(
    private route: ActivatedRoute,
    private quizService: QuizService,
    private attemptService: AttemptService,
    private authService: AuthService,
    private router: Router
  ) {}

  ngOnInit(): void {
    const storedUser = this.authService.getUser();
     if (!storedUser) {
      this.router.navigateByUrl('/login');
      return;
    }

  this.user.set(storedUser);

    const id = Number(this.route.snapshot.paramMap.get('id'));
    if (!id) {
      this.router.navigateByUrl('/app/login');
      return;
    }

    this.loading.set(true);

    this.quizService.getById(id).subscribe({
      next: (quiz) => {
  this.quiz.set(quiz);

  const totalQuestions = quiz.questions?.length ?? 0; 
  this.selectedOptions = Array(totalQuestions).fill(null);

  this.loading.set(false);
}
,
      error: () => {
        Swal.fire({ icon: 'error', title: 'Quiz no encontrado' });
        this.router.navigateByUrl('/app/quizzes');
      }
    });
  }

submitAttempt(): void {

  const user = this.user();
  if (!user?.id) {
    Swal.fire({ icon: 'warning', title: 'Debes iniciar sesión para continuar' });
    this.router.navigateByUrl('/login');
    return;
  }

  
  const quizData = this.quiz();
  if (!quizData) return;

  if (this.selectedOptions.includes(null)) {
    showMuseAlert( 'info','','Debes responder todas las preguntas' );
    return;
  }

  const payload = {
    quizId: quizData.id!,
    userId: user.id,
    answers: quizData.questions!.map((q, i) => ({
      questionId: q.id!,
      selectedOptionId: this.selectedOptions[i]
    }))
  };

  this.loading.set(true);


  this.attemptService.registerAttempt(payload).subscribe({
  next: (res: any) => {
    const data: IQuizAttemptResponse = res?.data ?? res;
    const score = data.score ?? 0;
    const total = data.totalQuestions ?? quizData.questions?.length ?? 0;
    const percent = total > 0 ? ((score / total) * 100).toFixed(2) : "0.00";

   showMuseAlert(
  'success',
  '',
  '¡Quiz finalizado!',
  `
   <p><b style="color:#b99746;">Respuestas Correctas:</b> 
       <span style="color:#b99746;">${score}/${total}</span></p>
    <p><b>Porcentaje:</b> <span style="color:#775A37">${percent}%</span></p>
  `
).then(() => this.router.navigateByUrl('/app/quizzes'));


    this.loading.set(false);
  },
  error: () => {
    Swal.fire({ icon: 'error', title: 'Error enviando intento' });
    this.loading.set(false);
  }
});
}

return(): void {
  this.router.navigateByUrl('/app/quizzes'); 
}


}
