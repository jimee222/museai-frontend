import { Routes } from '@angular/router';
import { Login } from './pages/login/login';
import { Register } from './pages/register/register';
import { Recover } from './pages/recover/recover';
import { Menu } from './pages/menu/menu';
import { Profile } from './pages/profile/profile';
import { About } from './pages/about/about';
import { NotFound } from './pages/not-found/not-found';
import { Landing } from './pages/landing/landing';
import { GuestGuard } from './guards/guest.guard';

import { MuseumComponent } from './pages/museum/museum.component';
import { EditProfile } from './pages/edit-profile/edit-profile';
import { AuthGuard } from './guards/auth.guard';
import { CreateCanvasPageComponent } from './pages/create-canvas/create-canvas';
import { SculptorPageComponent } from './sculptor/pages/sculptor-page.component';
import { QuizListAdmin } from './pages/quiz/admin/quiz-list-admin/quiz-list-admin';
import { QuizCreate } from './pages/quiz/admin/quiz-create/quiz-create'; 
import { QuizEdit } from './pages/quiz/admin/quiz-edit/quiz-edit'; 
import { Questions } from './pages/quiz/admin/questions/questions';
import { QuizListUser } from './pages/quiz/user/quiz-list-user/quiz-list-user';
import {QuizAttemptComponent} from './pages/quiz/user/quiz-attempt/quiz-attempt';
import { AdminTokenUsagePage } from './pages/admin-token-usage/admin-token-usage';


export const routes: Routes = [
  {
    path: '',
    pathMatch: 'full',
    redirectTo: 'login',
  },
  {
    path: 'login',
    component: Login,
    canActivate: [GuestGuard],
  },
  {
    path: 'register',
    component: Register,
    canActivate: [GuestGuard],
  },
  {
    path: 'recover',
    component: Recover,
  },
  {
    path: 'landing',
    component: Landing,
  },
  {
    path: 'about',
    component: About,
  },
  {
    path: 'create-canvas',
    component: CreateCanvasPageComponent,
  },
  {
    path: 'admin/token-usage',
    component: AdminTokenUsagePage,
    canActivate: [AuthGuard],
  },

  {
    path: 'app',
canActivate: [AuthGuard], 
children: [
  {
    path: 'menu',
    component: Menu
  },
  {
    path: 'profile',
    component: Profile
  },
  {
    path: 'edit-profile',
    component: EditProfile
  },

  {
    path: 'quizzes',
  component: QuizListUser 
  },
  {
  path: 'quizzes/:id/attempt',
  component: QuizAttemptComponent
},
  {
    path: 'quizzes-admin',
    component: QuizListAdmin
  },

  {
    path: 'quiz',
    children: [
      { path: 'create', component: QuizCreate },
      { path: 'edit/:id', component: QuizEdit },
      { path: 'questions/:id', component: Questions },
      { path: '', redirectTo: 'create', pathMatch: 'full' }
    ]
  }
]

    },

      {
        path: '',
        pathMatch: 'full',
        redirectTo: 'menu',
      },
    
  {
      path: 'museum',
      component: MuseumComponent,
      canActivate: [AuthGuard] 
    },  
  {
    path: 'sculptor',
    component: SculptorPageComponent,
  },
  
  {
    path: '**',
    component: NotFound,
  },
];
