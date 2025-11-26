import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-canvas-meta',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './canvas-meta.html',
  styleUrls: ['./canvas-meta.scss'],
})
export class CanvasMetaComponent {
  @Input() title = '';
  @Output() titleChange = new EventEmitter<string>();

  @Input() description = '';
  @Output() descriptionChange = new EventEmitter<string>();

  @Input() validationErrors: { title: string; description: string } = { title: '', description: '' };

  @Input() errorMessage: string | null = null;
  @Input() successMessage: string | null = null;
  @Input() isSaving = false;
  @Input() canDelete = false;

  @Output() save = new EventEmitter<void>();
  @Output() download = new EventEmitter<void>();
  @Output() deleteCurrent = new EventEmitter<void>();

  /* nuevo: para disparar la IA desde el parent */
  @Output() requestAIDescription = new EventEmitter<void>();

  onTitleInput(value: string) { this.titleChange.emit(value); }
  onDescriptionInput(value: string) { this.descriptionChange.emit(value); }
}
