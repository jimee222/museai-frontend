import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-google-test',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './google-test.html'
})
export class GoogleTestComponent {
  handleCredentialResponse(response: any) {
    console.log('Token recibido:', response.credential);
  }
}
