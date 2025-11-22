import {
  AfterViewInit,
  Component,
  ElementRef,
  Input,
  OnDestroy,
  ViewChild,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import * as fabric from 'fabric';

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
  selector: 'app-canvas-board',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './canvas-board.html',
  styleUrls: ['./canvas-board.scss'],
})
export class CanvasBoardComponent implements AfterViewInit, OnDestroy {
  @ViewChild('fabricCanvas', { static: true }) canvasRef!: ElementRef<HTMLCanvasElement>;

  @Input() set tool(t: Tool) {
    this._tool = t;
    this.applyTool();
  }
  @Input() set color(c: string) {
    this._color = c;
    this.applyBrushStyle();
  }
  @Input() set lineWidth(w: number) {
    this._lineWidth = w;
    this.applyBrushStyle();
  }

  private _tool: Tool = 'pencil';
  private _color = '#000000';
  private _lineWidth = 8;

  private canvas!: fabric.Canvas;
  private resizeObserver?: ResizeObserver;
  private readonly fallbackEraseColor = '#FFFFFF';
  private readonly targetHeight = 520;

  private drawingShape = false;
  private shapeOriginX = 0;
  private shapeOriginY = 0;
  private currentShape?: fabric.Object;

  private readonly handleMouseDown = (e: any) => this.onMouseDown(e);
  private readonly handleMouseMove = (e: any) => this.onMouseMove(e);
  private readonly handleMouseUp = (e: any) => this.onMouseUp(e);
  private readonly handlePathCreated = (e: any) => this.onPathCreated(e);

  ngAfterViewInit(): void {
    this.initCanvas();

    const container = this.canvasRef.nativeElement.parentElement!;
    this.resizeObserver = new ResizeObserver(() => this.fitToContainer());
    this.resizeObserver.observe(container);
    this.fitToContainer();

    // aplicar tool inicial
    this.applyTool();
    this.applyBrushStyle();
  }

  ngOnDestroy(): void {
    this.resizeObserver?.disconnect();
    if (this.canvas) {
      this.canvas.off('mouse:down', this.handleMouseDown);
      this.canvas.off('mouse:move', this.handleMouseMove);
      this.canvas.off('mouse:up', this.handleMouseUp);
      this.canvas.off('path:created', this.handlePathCreated);
      this.canvas.dispose();
    }
  }

  /* ───────── API pública para el parent ───────── */

  clearCanvas() {
    if (!this.canvas) return;
    this.canvas.clear();
    this.canvas.backgroundColor = '#FFFFFF';
    this.canvas.renderAll();
  }

  getSceneJson(): string {
    return JSON.stringify(this.canvas.toJSON());
  }

  getPreviewDataUrl(multiplier = 0.35): string {
    return this.canvas.toDataURL({
      format: 'png',
      quality: 0.85,
      multiplier,
    });
  }

  getExportPng(): string {
    return this.canvas.toDataURL({
      format: 'png',
      quality: 1.0,
      multiplier: 2,
    });
  }

  loadFromSceneJson(sceneJson: string) {
    this.canvas.loadFromJSON(sceneJson, () => {
      this.canvas.renderAll();
    });
  }

  /* ───────── Fabric init ───────── */

  private initCanvas(): void {
    this.canvas = new fabric.Canvas(this.canvasRef.nativeElement, {
      isDrawingMode: true,
      selection: false,
    });

    this.canvas.backgroundColor = '#FFFFFF';

    (fabric.Object.prototype as any).transparentCorners = false;
    (fabric.Object.prototype as any).erasable = true;

    this.canvas.renderAll();

    this.canvas.on('mouse:down', this.handleMouseDown);
    this.canvas.on('mouse:move', this.handleMouseMove);
    this.canvas.on('mouse:up', this.handleMouseUp);
    this.canvas.on('path:created', this.handlePathCreated);
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
      container.style.margin = '0 auto';
    }

    this.canvas.renderAll();
  }

  /* ───────── Herramientas ───────── */

  private isBrushTool(tool: Tool): boolean {
    return tool === 'pencil' || tool === 'marker' || tool === 'spray' || tool === 'eraser';
  }

  private isShapeTool(tool: Tool): boolean {
    return tool === 'line' || tool === 'rect' || tool === 'circle';
  }

  private applyTool(): void {
    if (!this.canvas) return;

    this.canvas.discardActiveObject();

    if (this.isBrushTool(this._tool)) {
      this.canvas.isDrawingMode = true;
      this.canvas.selection = false;
      this.configureBrush(this._tool);
      this.applyBrushStyle();
    } else if (this.isShapeTool(this._tool)) {
      this.canvas.isDrawingMode = false;
      this.canvas.selection = false;
    } else if (this._tool === 'select') {
      this.canvas.isDrawingMode = false;
      this.canvas.selection = true;
    }

    this.canvas.renderAll();
  }

  private configureBrush(tool: Tool): void {
    const anyFabric = fabric as any;

    if (tool === 'eraser') {
      if (anyFabric.EraserBrush) {
        this.canvas.freeDrawingBrush = new anyFabric.EraserBrush(this.canvas);
      } else {
        this.canvas.freeDrawingBrush = this.createFallbackEraserBrush();
      }
      return;
    }

    if (tool === 'spray' && anyFabric.SprayBrush) {
      this.canvas.freeDrawingBrush = new anyFabric.SprayBrush(this.canvas);
      return;
    }

    this.canvas.freeDrawingBrush = new fabric.PencilBrush(this.canvas);
  }

  private createFallbackEraserBrush(): fabric.PencilBrush {
    const brush = new fabric.PencilBrush(this.canvas);
    brush.color = this.fallbackEraseColor;
    (brush as any).isFallbackEraser = true;
    return brush;
  }

  private applyBrushStyle(): void {
    if (!this.canvas || !this.isBrushTool(this._tool)) return;

    const brush: any = this.canvas.freeDrawingBrush;
    if (!brush) return;

    brush.width = this._lineWidth;
    brush.erasable = true;
    brush.shadow = undefined;

    if (this._tool === 'pencil' || this._tool === 'marker' || this._tool === 'spray') {
      brush.color = this._color;

      if (this._tool === 'marker') {
        brush.width = this._lineWidth * 1.9;
        brush.opacity = 0.65;
        brush.shadow = new fabric.Shadow({
          color: this._color,
          blur: 10,
          offsetX: 0,
          offsetY: 0,
        });
      } else {
        brush.opacity = 1;
      }
    } else if (this._tool === 'eraser') {
      const anyFabric = fabric as any;
      const hasNative =
        !!anyFabric.EraserBrush && brush instanceof anyFabric.EraserBrush;

      if (!hasNative) {
        brush.color = this.fallbackEraseColor;
        brush.opacity = 1;
      }
    }

    this.canvas.renderAll();
  }

  /* ───────── Shapes ───────── */

  private onMouseDown(opt: any): void {
    if (!this.isShapeTool(this._tool)) return;

    const pointer = this.canvas.getPointer(opt.e);
    this.drawingShape = true;
    this.shapeOriginX = pointer.x;
    this.shapeOriginY = pointer.y;

    const strokeColor = this._color;

    if (this._tool === 'line') {
      this.currentShape = new fabric.Line(
        [this.shapeOriginX, this.shapeOriginY, this.shapeOriginX, this.shapeOriginY],
        {
          stroke: strokeColor,
          strokeWidth: this._lineWidth,
          selectable: false,
          evented: false,
          erasable: true,
        }
      );
    } else if (this._tool === 'rect') {
      this.currentShape = new fabric.Rect({
        left: this.shapeOriginX,
        top: this.shapeOriginY,
        width: 1,
        height: 1,
        fill: 'rgba(0,0,0,0)',
        stroke: strokeColor,
        strokeWidth: this._lineWidth,
        originX: 'left',
        originY: 'top',
        selectable: false,
        evented: false,
        erasable: true,
      });
    } else if (this._tool === 'circle') {
      this.currentShape = new fabric.Ellipse({
        left: this.shapeOriginX,
        top: this.shapeOriginY,
        rx: 1,
        ry: 1,
        fill: 'rgba(0,0,0,0)',
        stroke: strokeColor,
        strokeWidth: this._lineWidth,
        originX: 'center',
        originY: 'center',
        selectable: false,
        evented: false,
        erasable: true,
      });
    }

    if (this.currentShape) {
      this.canvas.add(this.currentShape);
    }
  }

  private onMouseMove(opt: any): void {
    if (!this.drawingShape || !this.currentShape) return;

    const pointer = this.canvas.getPointer(opt.e);
    const x = pointer.x;
    const y = pointer.y;

    if (this._tool === 'line') {
      (this.currentShape as fabric.Line).set({ x2: x, y2: y });
    } else if (this._tool === 'rect') {
      const left = Math.min(x, this.shapeOriginX);
      const top = Math.min(y, this.shapeOriginY);
      const width = Math.abs(x - this.shapeOriginX);
      const height = Math.abs(y - this.shapeOriginY);
      (this.currentShape as fabric.Rect).set({ left, top, width, height });
    } else if (this._tool === 'circle') {
      const rx = Math.abs(x - this.shapeOriginX) / 2;
      const ry = Math.abs(y - this.shapeOriginY) / 2;
      const left = (this.shapeOriginX + x) / 2;
      const top = (this.shapeOriginY + y) / 2;
      (this.currentShape as fabric.Ellipse).set({ rx, ry, left, top });
    }

    this.canvas.renderAll();
  }

  private onMouseUp(_opt: any): void {
    if (!this.drawingShape || !this.currentShape) return;

    this.drawingShape = false;
    this.currentShape.set({ selectable: true, evented: true });
    this.currentShape = undefined;
    this.canvas.renderAll();
  }

  /* ───────── path created (pinceles) ───────── */

  private onPathCreated(e: any): void {
    const path = e?.path as fabric.Object | undefined;
    if (!path) return;

    const brush: any = this.canvas.freeDrawingBrush;
    const isFallbackEraser =
      this._tool === 'eraser' && brush && brush.isFallbackEraser;

    if (isFallbackEraser) {
      const objectsToRemove = this.canvas
        .getObjects()
        .filter((obj) => obj !== path && obj.intersectsWithObject(path));
      objectsToRemove.forEach((obj) => this.canvas.remove(obj));
      this.canvas.remove(path);
      this.canvas.renderAll();
      return;
    }

    path.set({ erasable: true });

    if (this._tool === 'eraser') {
      path.set({
        selectable: false,
        evented: false,
      });
    }
  }
}
