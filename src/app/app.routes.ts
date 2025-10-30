import { Routes } from '@angular/router';
import { Landing  } from './pages/landing/landing';
import { Login  } from './pages/login/login';
import { Register  } from './pages/register/register';
import { Profile  } from './pages/profile/profile';
import { About  } from './pages/about/about';
import { NotFound  } from './pages/not-found/not-found';
import { GuestGuard } from './guards/guest.guard';


export const routes: Routes = [
  { path: '', component: Landing , pathMatch: 'full' },
  { path: 'about', component: About  },
  { path: 'login', component: Login  },
  { path: 'register', 
    component: Register, 
    canActivate: [GuestGuard],
   },
  { path: 'profile', component: Profile  },
  { path: '**', component: NotFound  },
];
