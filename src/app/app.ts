import { Component, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { HeaderComponent } from './shared/header/header';
import { HttpClientModule } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { MuseumComponent } from './pages/museum/museum.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    RouterOutlet,
    HeaderComponent,
    FormsModule,     
    MuseumComponent,
  ],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App {
  protected readonly title = signal('MuseAI-FrontEnd');
}
