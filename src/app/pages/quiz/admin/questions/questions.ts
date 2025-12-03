import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import Swal from 'sweetalert2';
import { QuestionService } from '../../../../services/question.service';
import { QuizService } from '../../../../services/quiz.service';
import { IQuiz, IQuestion } from '../../../../interfaces';

@Component({
  selector: 'app-questions',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './questions.html',
  styleUrls: ['./questions.css']
})
export class Questions implements OnInit {

  quiz = signal<IQuiz | null>(null);
  questions = signal<(IQuestion & { imagePreview?: string | null })[]>([]);
  loading = signal(false);

  cloudinaryUrl = 'https://api.cloudinary.com/v1_1/dfakn2ntb/image/upload';
  uploadPreset = 'muse_ai';

  constructor(
    private route: ActivatedRoute,
    private quizService: QuizService,
    private questionService: QuestionService,
    private router: Router
  ) {}

 
  ngOnInit(): void {
    const id = Number(this.route.snapshot.paramMap.get('id'));
    if (!id) {
      this.router.navigateByUrl('/app/login');
      return;
    }

    this.loading.set(true);
    this.quizService.getById(id).subscribe({
      next: quiz => {
        const loaded = (quiz.questions ?? []).map(q => ({ ...q, imagePreview: q.imageUrl ?? null }));
        this.quiz.set(quiz);
        this.questions.set(loaded);
        this.loading.set(false);
      },
      error: () => {
        Swal.fire({ icon: 'error', title: 'Quiz no encontrado' });
        this.router.navigateByUrl('/app/quizzes-admin');
      }
    });
  }

  private quizId(): number {
    const id = this.quiz()?.id;
    if (!id) throw new Error('Quiz no cargado');
    return id;
  }

  addQuestion(): void {
    this.questions.update(list => [
      ...list,
      {
        id: null,
        quizId: this.quizId(),
        text: '',
        imageUrl: null,
        imagePreview: null,
        options: [
          { id: null, text: '', correct: true },
          { id: null, text: '', correct: false }
        ]
      }
    ]);
  }

 
  saveQuestion(q: IQuestion, index: number): void {

  if (!q.text.trim()) {
    Swal.fire({ icon: 'warning', title: 'Debe ingresar texto para la pregunta' });
    return;
  }

  const texts = q.options.map(o => o.text.trim().toLowerCase());
  const hasDuplicates = texts.some((t, idx) => texts.indexOf(t) !== idx);

  if (hasDuplicates) {
    Swal.fire({
      icon: 'error',
      title: 'Las opciones no pueden ser iguales',
      confirmButtonColor: '#d7b25a'
    });
    return;
  }

  const request = q.id
    ? this.questionService.updateQuestion(this.quizId(), q)
    : this.questionService.createQuestion(this.quizId(), q);

  request.subscribe({
    next: saved => {
      this.questions.update(list =>
        list.map((item, i) => i === index
          ? { ...saved, imagePreview: saved.imageUrl ?? item.imagePreview }
          : item
        )
      );
      Swal.fire({ icon:'success', title:'Pregunta guardada', timer:900, showConfirmButton:false });
    },
    error: ()=> Swal.fire({ icon:'error', title:'Error al guardar' })
  });
}


  deleteQuestion(i: number): void {
    const q = this.questions()[i];

    if (!q.id) {
      this.questions.update(list => list.filter((_, x)=> x!==i));
      return;
    }

    this.questionService.deleteQuestion(this.quizId(), q.id).subscribe({
      next: () => {
        this.questions.update(list => list.filter((_, x)=> x!==i));
        Swal.fire({ icon:'success', title:'Pregunta Eliminada', timer:800, showConfirmButton:false });
      },
      error: () => Swal.fire({ icon:'error', title:'Error eliminando pregunta' })
    });
  }

  saveAll(): void {

  const preguntasConDuplicados: number[] = [];

  this.questions().forEach((q, index) => {
    const textos = q.options.map(o => o.text.trim().toLowerCase());
    const repetidos = textos.some((t, idx) => textos.indexOf(t) !== idx);
    if (repetidos) preguntasConDuplicados.push(index + 1);
  });

  if (preguntasConDuplicados.length > 0) {
    Swal.fire({
      icon: 'error',
      title: 'Hay preguntas con opciones repetidas',
      html: `
        <p>Revisa las opciones en:</p>
        <b>Preguntas: ${preguntasConDuplicados.join(', ')}</b>
      `,
      confirmButtonColor: '#d7b25a'
    });
    return;
  }

  this.loading.set(true);

  const payload = this.questions().map(q => ({
    id: q.id,
    text: q.text,
    imageUrl: q.imageUrl,
    options: q.options
  }));

  this.questionService.saveAllQuestions(this.quizId(), payload).subscribe({
    next: () => {
      Swal.fire({ icon:'success', title:'Cambios guardados', timer:1200, showConfirmButton:false });
      this.loading.set(false);
    },
    error: () => {
      Swal.fire({ icon:'error', title:'Error al guardar todo' });
      this.loading.set(false);
    }
  });
}



  setCorrectOption(q:IQuestion, j:number):void {
    q.options.forEach((o,i)=> o.correct = (i===j));
    this.questions.update(list=> [...list]);
  }

  addOption(i:number):void {
    this.questions.update(list =>
      list.map((q,idx)=> idx!==i? q : { ...q, options:[...q.options,{id:null,text:'',correct:false}] })
    );
  }

 
  removeOption(q:number, op:number):void {
    const item = this.questions()[q];

    if(item.options.length<=2) {
      Swal.fire({icon:'warning',title:'Mínimo 2 respuestas'});
      return;
    }

    item.options.splice(op,1);
    if(!item.options.some(o=>o.correct)) item.options[0].correct = true;
    this.questions.update(list=>[...list]);
  }

  async onQuestionImageSelected(event:any,index:number):Promise<void> {
    const file=event.target?.files?.[0];
    if(!file) return;

    const reader=new FileReader();
    reader.onload=()=>{
      this.questions.update(l=>l.map((q,i)=>i===index?{...q,imagePreview:reader.result as string}:q));
    };
    reader.readAsDataURL(file);

    const data=new FormData();
    data.append('file',file);
    data.append('upload_preset',this.uploadPreset);

    try{
      const res=await fetch(this.cloudinaryUrl,{method:'POST',body:data});
      const img=await res.json();
      this.questions.update(l=>l.map((q,i)=>i===index?{...q,imageUrl:img.secure_url}:q));
    }catch{
      Swal.fire({icon:'error',title:'Error subiendo imagen'});
    }
  }

  autoGrow(e:any):void{
    e.target.style.height="auto";
    e.target.style.height=e.target.scrollHeight+"px";
  }

  back():void {
    const id=this.quiz()?.id;
    if(id) this.router.navigateByUrl(`/app/quiz/edit/${id}`);
  }
}
