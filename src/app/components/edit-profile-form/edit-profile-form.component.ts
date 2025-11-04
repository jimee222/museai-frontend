import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { FormGroup, ReactiveFormsModule } from '@angular/forms';
import { IUser } from '../../interfaces';

@Component({
  selector: 'edit-profile-form',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './edit-profile-form.component.html',
  styleUrl: './edit-profile-form.component.scss'
})
export class EditProfileFormComponent {
  @Input() form!: FormGroup;
  @Input() showArtLevelSelector: boolean = true;
  @Output() callSaveMethod: EventEmitter<IUser> = new EventEmitter<IUser>();

  get passwords(): FormGroup {
  return this.form.get('passwords') as FormGroup;
}


  levels = [
    { value: 'beginner', label: 'Principiante' },
    { value: 'intermediate', label: 'Intermedio' },
    { value: 'advanced', label: 'Avanzado' },
  ];
}
