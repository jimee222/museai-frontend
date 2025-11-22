import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';

export interface GalleryPainting {
  id: string;
  title: string;
  description: string;
  previewUrl: string;
  updatedAt: string;
}

@Component({
  selector: 'app-canvas-gallery',
  standalone: true,
  imports: [CommonModule, DatePipe],
  templateUrl: './canvas-gallery.html',
  styleUrls: ['./canvas-gallery.scss'],
})
export class CanvasGalleryComponent {
  @Input() paintings: GalleryPainting[] = [];

  @Output() loadPainting = new EventEmitter<GalleryPainting>();
  @Output() deletePainting = new EventEmitter<GalleryPainting>();

  onLoad(p: GalleryPainting) {
    this.loadPainting.emit(p);
  }

  onDelete(p: GalleryPainting, event: MouseEvent) {
    event.stopPropagation();
    event.preventDefault();
    this.deletePainting.emit(p);
  }
}
