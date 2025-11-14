import { CommonModule, NgIf } from '@angular/common';
import { Component, Input } from '@angular/core';
import { Router, RouterModule } from '@angular/router';
import { IUser } from '../../interfaces';

@Component({
  selector: 'profile-card',
  standalone: true,
  imports: [CommonModule, RouterModule, NgIf],
  templateUrl: './profile-card.component.html',
  styleUrls: ['./profile-card.component.scss']
})
export class ProfileCardComponent {
  @Input() user!: IUser | null;

  constructor(private router: Router) {}

  goToEditProfile() {
    this.router.navigateByUrl('/app/edit-profile');
  }

 getArtLevelLabel(level: string | undefined) {
  if (!level) return 'No especificado';
  const normalized = level.trim().toLowerCase();

  const levels = [
    { value: 'beginner', label: 'Principiante' },
    { value: 'intermediate', label: 'Intermedio' },
    { value: 'advanced', label: 'Avanzado' },
  ];

  const found = levels.find(l => normalized.includes(l.value));
  return found ? found.label : 'No especificado';
}

}
