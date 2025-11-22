import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

type Tool =
  | 'select'
  | 'pencil'
  | 'marker'
  | 'spray'
  | 'eraser'
  | 'line'
  | 'rect'
  | 'circle';

@Component({
  selector: 'app-canvas-toolbar',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './canvas-toolbar.html',
  styleUrls: ['./canvas-toolbar.scss'],
})
export class CanvasToolbarComponent {
  @Input() tool: Tool = 'pencil';
  @Input() color = '#000000';
  @Input() lineWidth = 8;

  @Output() toolChange = new EventEmitter<Tool>();
  @Output() colorChange = new EventEmitter<string>();
  @Output() lineWidthChange = new EventEmitter<number>();
  @Output() clearRequested = new EventEmitter<void>();

  isBrushTool(t: Tool): boolean {
    return t === 'pencil' || t === 'marker' || t === 'spray' || t === 'eraser';
  }

  setTool(tool: Tool) {
    this.toolChange.emit(tool);
  }

  setColor(hex: string) {
    this.colorChange.emit(hex);
  }

  setLineWidth(px: number) {
    this.lineWidthChange.emit(px);
  }

  quickColor(hex: string) {
    this.setColor(hex);
  }

  requestClear() {
    this.clearRequested.emit();
  }
}
