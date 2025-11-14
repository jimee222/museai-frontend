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
import { AuthGuard } from './guards/auth.guard';
<<<<<<< Updated upstream
<<<<<<< Updated upstream
import { MuseumComponent } from './pages/museum/museum.component';
import { EditProfile } from './pages/edit-profile/edit-profile';
import { SculptorPageComponent } from './sculptor/pages/sculptor-page.component';
=======
import { EditProfile } from './pages/edit-profile/edit-profile';
import { CreateCanvasComponent } from './pages/create-canvas/create-canvas';
>>>>>>> Stashed changes
=======
import { EditProfile } from './pages/edit-profile/edit-profile';
import { CreateCanvasComponent } from './pages/create-canvas/create-canvas';
>>>>>>> Stashed changes

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
    component: CreateCanvasComponent,
  },
  {
    path: 'app',
    canActivate: [AuthGuard],
    children: [
      {
        path: 'menu',
        component: Menu,
      },
      {
        path: 'profile',
        component: Profile,
      },
      {
        path: 'edit-profile',
        component: EditProfile,
      },
      {
        path: '',
        pathMatch: 'full',
        redirectTo: 'menu',
      },
    ],
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
