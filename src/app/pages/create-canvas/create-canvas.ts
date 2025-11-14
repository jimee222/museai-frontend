import { Component, ElementRef, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  Canvas,
  PencilBrush,
  CircleBrush,
  BaseBrush,
  Object as FabricObject,
} from 'fabric';

type BrushKey = 'Pencil' | 'Circle';

@Component({
  selector: 'app-create-canvas',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './create-canvas.html',
  styleUrls: ['./create-canvas.css'],
})
export class CreateCanvasComponent {
  @ViewChild('fabricCanvas', { static: true }) canvasRef!: ElementRef<HTMLCanvasElement>;

  // UI
  brushType: BrushKey = 'Pencil';
  color = '#000000';
  lineWidth = 5;

  private canvas!: Canvas;

  ngAfterViewInit(): void {
    this.initCanvas();
    this.applyBrushFromSelection();
    this.applyBrushStyle();
  }

  private initCanvas() {
    this.canvas = new Canvas(this.canvasRef.nativeElement, {
      isDrawingMode: true,               // siempre en modo dibujo (como el demo)
      selection: false,                  // desactiva selección de área
    });

    // ¡OJO! usa el Object de Fabric, no el nativo
    (FabricObject.prototype as any).transparentCorners = false;

    // Cursor por claridad (opcional)
    this.canvas.defaultCursor = 'crosshair';
    this.canvas.freeDrawingCursor = 'crosshair';
  }

  clearCanvas() {
    this.canvas.clear();
  }

  onBrushTypeChange() {
    this.applyBrushFromSelection();
    this.applyBrushStyle();
  }

  onStyleChange() {
    this.applyBrushStyle();
  }

  /**
   * Aplica el tipo de pincel seleccionado al canvas de dibujo libre.
   * 
   * This method configures the brush that will be used to draw on the canvas
   * based on the user's selection (brushType). Depending on the value:
   * - 'Pencil': Creates a PencilBrush that draws continuous lines like a pencil
   * - 'Circle': Creates a CircleBrush that draws circular marks at each point
   * 
   * Se ejecuta cuando el usuario cambia el tipo de pincel o al inicializar el componente.
   */
  private applyBrushFromSelection() {
    // Asigna el pincel correspondiente según la selección del usuario
    this.canvas.freeDrawingBrush =
      this.brushType === 'Pencil'
        ? new PencilBrush(this.canvas)  // Pincel tipo lápiz para líneas continuas
        : new CircleBrush(this.canvas); // Pincel tipo círculo para marcas circulares
  }

  private applyBrushStyle() {
    const brush = this.canvas.freeDrawingBrush as BaseBrush & {
      color?: string;
      width?: number;
    };
    if (!brush) return;

    brush.color = this.color;
    brush.width = parseInt(String(this.lineWidth), 10) || 1;
  }
}
