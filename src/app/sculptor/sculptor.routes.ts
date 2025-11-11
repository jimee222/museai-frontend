import { Routes } from '@angular/router';
import { SculptorPageComponent } from './pages/sculptor-page.component';

// Sculptor feature entry point.
// Install peer dependencies before using:
//   npm install three @types/three
export const SCULPTOR_ROUTES: Routes = [
  {
    path: '',
    component: SculptorPageComponent,
    title: 'Sculptor Sandbox',
  },
];
