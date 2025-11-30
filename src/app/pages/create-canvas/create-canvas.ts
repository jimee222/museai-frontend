import { AfterViewInit, Component, ElementRef, OnDestroy, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import * as fabric from 'fabric';

type Tool = 'pencil' | 'eraser';

@Component({
  selector: 'app-create-canvas',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './create-canvas.html',
  styleUrls: ['./create-canvas.css'],
})
export class CreateCanvasComponent implements AfterViewInit, OnDestroy {
  @ViewChild('fabricCanvas', { static: true }) canvasRef!: ElementRef<HTMLCanvasElement>;

  tool: Tool = 'pencil';
  color = '#000000';
  lineWidth = 8;
  dataUrl: string | null = null;

  private canvas!: fabric.Canvas;
  private resizeObserver?: ResizeObserver;
  private readonly fallbackEraseColor = '#FFFFFF';
  private readonly targetHeight = 480; // 🔹 lienzo más pequeño

  ngAfterViewInit(): void {
    this.initCanvas();
    this.applyBrush('pencil');
    this.applyBrushStyle();

  
    const container = this.canvasRef.nativeElement.parentElement!;
    this.resizeObserver = new ResizeObserver(() => this.fitToContainer());
    this.resizeObserver.observe(container);
    this.fitToContainer();
  }

  ngOnDestroy(): void {
    this.resizeObserver?.disconnect();
    this.canvas?.dispose();
  }

  private initCanvas(): void {
    this.canvas = new fabric.Canvas(this.canvasRef.nativeElement, {
      isDrawingMode: true,       
      selection: false,
    });
    this.canvas.backgroundColor = '#FFFFFF';
    this.canvas.renderAll();

    (fabric.Object.prototype as any).transparentCorners = false;
  }
  
  private fitToContainer(): void {
    const parent = this.canvasRef.nativeElement.parentElement!;
    const width = Math.floor(parent.clientWidth);

   
    this.canvas.setWidth(width);
    this.canvas.setHeight(this.targetHeight);

    
    const container = this.canvas.getElement().parentElement as HTMLDivElement;
    if (container) {
      container.style.width = '100%';
      container.style.height = `${this.targetHeight}px`;
    }

    this.canvas.renderAll();
  }


  setBrush(tool: Tool): void {
    this.tool = tool;
    this.applyBrush(tool);
    this.applyBrushStyle();
    this.canvas.isDrawingMode = true; // 🔹 por si algo lo cambia
    this.canvas.renderAll();
  }

  private applyBrush(tool: Tool): void {
    if (tool === 'eraser' && (fabric as any).EraserBrush) {
      this.canvas.freeDrawingBrush = new (fabric as any).EraserBrush(this.canvas);
    } else {
      this.canvas.freeDrawingBrush = new fabric.PencilBrush(this.canvas);
    }
  }

  private applyBrushStyle(): void {
    const brush: any = this.canvas.freeDrawingBrush;
    if (!brush) return;

    brush.width = this.lineWidth;

    if (this.tool === 'pencil') {
      brush.color = this.color;
      brush.shadow = undefined;
    } else {
      if ((fabric as any).EraserBrush && this.canvas.freeDrawingBrush instanceof (fabric as any).EraserBrush) {
      } else {
        brush.color = this.fallbackEraseColor;
      }
    }
    this.canvas.renderAll();
  }

  setColor(hex: string): void {
    this.color = hex;
    if (this.tool === 'pencil') {
      const brush: any = this.canvas.freeDrawingBrush;
      if (brush) {
        brush.color = this.color;
        this.canvas.renderAll();
      }
    }
  }

  setLineWidth(px: number): void {
    this.lineWidth = px;
    const brush: any = this.canvas.freeDrawingBrush;
    if (brush) {
      brush.width = this.lineWidth;
      this.canvas.renderAll();
    }
  }

  clearCanvas(): void {
    this.canvas.clear();
    this.canvas.backgroundColor = '#FFFFFF';
    this.canvas.renderAll();
    this.applyBrush(this.tool);
    this.applyBrushStyle();
    this.canvas.isDrawingMode = true;
    this.dataUrl = null;
  }

  exportPNG(): void {
    const url = this.canvas.toDataURL({
      format: 'png',
      quality: 1.0,
      multiplier: 2,
    });
    this.dataUrl = url;
  }

  artTitle = '';
  artDescription = '';

  autoDescribeAI(): void {
    console.log('Auto descripción AI pendiente de implementación');
  }

  saveArtwork(): void {
    console.log('Guardar obra (stub):', {
      titulo: this.artTitle,
      descripcion: this.artDescription,
    });
  }

  downloadArtwork(): void {
    this.exportPNG();
    setTimeout(() => {
      const link = document.querySelector('a[download="lienzo.png"]') as HTMLAnchorElement;
      if (link && this.dataUrl) link.click();
    }, 0);
  }
}
