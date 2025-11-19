import { CommonModule } from '@angular/common';
import { Component, EventEmitter, HostListener, Output, signal } from '@angular/core';

const ACCEPTED_EXTENSIONS = ['glb', 'gltf', 'obj', 'stl'];


@Component({
  selector: 'app-asset-dropzone',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="overlay" [class.active]="active()" aria-hidden="true">
      <div class="panel">
        <p>Suelta archivos GLB, GLTF, OBJ o STL para agregarlos a la escena.</p>
        <p class="hint">{{ hintMessage() }}</p>
      </div>
    </div>
  `,
  styles: [
    `
      :host {
        position: absolute;
        inset: 0;
        pointer-events: none;
      }
      .overlay {
        position: absolute;
        inset: 0;
        background: rgba(15, 18, 26, 0.75);
        opacity: 0;
        transition: opacity 0.2s ease;
        display: flex;
        justify-content: center;
        align-items: center;
      }
      .overlay.active {
        opacity: 1;
        pointer-events: all;
      }
      .panel {
        border: 1px dashed rgba(255, 255, 255, 0.5);
        padding: 1.5rem;
        border-radius: 8px;
        text-align: center;
        color: #f4f4f5;
        background: rgba(0, 0, 0, 0.45);
        max-width: 420px;
      }
      .hint {
        font-size: 0.85rem;
        opacity: 0.8;
        margin-top: 0.35rem;
      }
    `,
  ],
})
export class AssetDropzoneComponent {
  @Output() filesDropped = new EventEmitter<File[]>();
  @Output() invalidFiles = new EventEmitter<string>();

  readonly active = signal(false);
  readonly hintMessage = signal('Arrastra archivos desde tu escritorio');
  private dragDepth = 0;

  @HostListener('window:dragenter', ['$event'])
  onDragEnter(event: DragEvent): void {
    if (!this.containsFiles(event)) {
      return;
    }
    event.preventDefault();
    this.dragDepth++;
    this.active.set(true);
  }

  @HostListener('window:dragover', ['$event'])
  onDragOver(event: DragEvent): void {
    if (!this.active()) {
      return;
    }
    event.preventDefault();
  }

  @HostListener('window:dragleave', ['$event'])
  onDragLeave(event: DragEvent): void {
    if (!this.containsFiles(event)) {
      return;
    }
    this.dragDepth = Math.max(0, this.dragDepth - 1);
    if (this.dragDepth === 0) {
      this.active.set(false);
    }
  }

  @HostListener('window:drop', ['$event'])
  onDrop(event: DragEvent): void {
    if (!this.active()) {
      return;
    }
    if (!event.defaultPrevented) {
      event.preventDefault();
    }
    this.dragDepth = 0;
    this.active.set(false);
    const files = Array.from(event.dataTransfer?.files ?? []);
    if (!files.length || event.defaultPrevented) {
      return;
    }
    const invalid = files.filter((file) => !this.isValidExtension(file.name));
    if (invalid.length) {
      this.invalidFiles.emit(`Archivos no compatibles: ${invalid.map((f) => f.name).join(', ')}`);
      return;
    }
    this.filesDropped.emit(files);
  }

  private containsFiles(event: DragEvent): boolean {
    return Array.from(event.dataTransfer?.types ?? []).includes('Files');
  }

  private isValidExtension(name: string): boolean {
    const ext = name.split('.').pop()?.toLowerCase() ?? '';
    return ACCEPTED_EXTENSIONS.includes(ext);
  }
}
