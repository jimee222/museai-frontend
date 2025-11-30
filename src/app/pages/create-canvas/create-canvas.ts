<<<<<<< Updated upstream
import { Component, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient, HttpClientModule } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

import { CanvasToolbarComponent } from '../../components/canvas-toolbar/canvas-toolbar';
import { CanvasBoardComponent } from '../../components/canvas-board/canvas-board';
import { CanvasMetaComponent } from '../../components/canvas-meta/canvas-meta';
import {
  CanvasGalleryComponent,
  GalleryPainting,
} from '../../components/canvas-gallery/canvas-gallery';
import { AiDescriptionsService } from '../../services/ai-descriptions.service';
import { LanguagePreferenceService } from '../../services/language-preference.service';

type Tool =
  | 'select'
  | 'pencil'
  | 'marker'
  | 'spray'
  | 'eraser'
  | 'line'
  | 'rect'
  | 'circle';

interface PaintingResponse {
  id: string;
  name: string;
  metadata: string | null;
  sceneJson: string;
  createdAt: string;
  updatedAt: string;
  slug?: string | null;
  tags?: string[] | null;
}

interface PaintingSummary {
  id: string;
  title: string;
  description: string;
  previewUrl: string;
  updatedAt: string;
}

@Component({
  selector: 'app-create-canvas-page',
  standalone: true,
  imports: [
    CommonModule,
    HttpClientModule,
    CanvasToolbarComponent,
    CanvasBoardComponent,
    CanvasMetaComponent,
    CanvasGalleryComponent,
  ],
  templateUrl: './create-canvas.html',
  styleUrls: ['./create-canvas.css'],
})
export class CreateCanvasPageComponent {
  @ViewChild(CanvasBoardComponent) board!: CanvasBoardComponent;

  private readonly API_BASE = 'http://localhost:8080/api/paintings';

  // estado de herramientas
  tool: Tool = 'pencil';
  color = '#000000';
  lineWidth = 8;

  // meta de la obra
  artTitle = '';
  artDescription = '';
  isGeneratingDescription = false;

  // estado de guardado / validación
  isSaving = false;
  validationErrors: { title: string; description: string } = {
    title: '',
    description: '',
  };
  errorMessage: string | null = null;
  successMessage: string | null = null;

  // galería
  gallery: PaintingSummary[] = [];
  currentPaintingId: string | null = null;

  // modal de confirmación reutilizable
  confirmModal = {
    visible: false as boolean,
    mode: 'clear' as 'clear' | 'delete',
  };

  // si viene de la galería, guardamos cuál card se quiere borrar
  pendingGalleryDelete: GalleryPainting | null = null;

  constructor(
    private http: HttpClient,
    private aiDescriptions: AiDescriptionsService,
    private languagePreference: LanguagePreferenceService,
  ) {
    this.loadGallery();
  }

  /* ───────── HANDLERS TOOLBAR ───────── */

  onToolChange(tool: Tool) {
    this.tool = tool;
  }

  onColorChange(color: string) {
    this.color = color;
  }

  onLineWidthChange(width: number) {
    this.lineWidth = width;
  }

  // LIMPIAR (toolbar) → abre modal oscuro
  onClearRequested() {
    this.pendingGalleryDelete = null; 
    this.confirmModal.visible = true;
    this.confirmModal.mode = 'clear';
  }

  cancelConfirmModal() {
    this.confirmModal.visible = false;
    this.pendingGalleryDelete = null;
  }

  // botón principal del modal (Limpiar / Eliminar)
  confirmModalAction() {
    const mode = this.confirmModal.mode;
    this.confirmModal.visible = false;

    if (mode === 'clear') {
      this.performClearCanvas();
    } else if (mode === 'delete') {
      if (this.pendingGalleryDelete) {
        this.performDeleteFromGallery();
      } else {
        this.performDeleteCurrentPainting();
      }
    }
  }

  /* ───────── VALIDACIÓN / MENSAJES ───────── */

  private performClearCanvas() {
    if (!this.board) return;

    this.board.clearCanvas();
    this.tool = 'pencil';
    this.currentPaintingId = null;
    this.artTitle = '';
    this.artDescription = '';
    this.resetMessages();
  }

  private resetMessages() {
    this.errorMessage = null;
    this.successMessage = null;
    this.validationErrors = { title: '', description: '' };
  }

  private validateArtwork(): boolean {
    this.validationErrors = { title: '', description: '' };
    let ok = true;

    if (!this.artTitle || !this.artTitle.trim()) {
      this.validationErrors.title =
        'Agrega un título para poder guardar tu obra.';
      ok = false;
    }
    if (!this.artDescription || !this.artDescription.trim()) {
      this.validationErrors.description =
        'Agrega una breve descripción para poder guardar tu obra.';
      ok = false;
    }

    return ok;
  }

  /* ───────── GUARDAR / DESCARGAR / ELIMINAR ───────── */
  async generateDescriptionFromImage() {
    if (!this.board || this.isGeneratingDescription) return;

    this.resetMessages();
    const previewDataUrl = this.board.getPreviewDataUrl(0.6);
    if (!previewDataUrl) {
      this.errorMessage = 'No se pudo obtener la imagen para describir.';
      return;
    }

    this.isGeneratingDescription = true;
    try {
      const language = this.languagePreference.language();
      const description = await firstValueFrom(
        this.aiDescriptions.describeImage(previewDataUrl, language),
      );
      if (!description) {
        throw new Error('Descripción vacía');
      }
      this.artDescription = description;
      this.successMessage = 'Descripción generada automáticamente.';
    } catch (error) {
      console.error('Error al generar descripción', error);
      this.errorMessage = 'No se pudo generar la descripción automáticamente.';
    } finally {
      this.isGeneratingDescription = false;
    }
  }

  saveArtwork() {
    if (!this.board) return;

    this.resetMessages();

    if (!this.validateArtwork()) {
      this.errorMessage =
        'Completa el título y la descripción antes de guardar tu obra.';
      return;
    }

    const sceneJson = this.board.getSceneJson();
    const previewDataUrl = this.board.getPreviewDataUrl(0.35);

    const metadataObj = {
      description: this.artDescription.trim(),
      previewDataUrl,
    };

    const payload = {
      name: this.artTitle.trim(),
      sceneJson,
      metadata: JSON.stringify(metadataObj),
      tags: [] as string[],
      slug: null as string | null,
    };

    this.isSaving = true;

    const req$ = this.currentPaintingId
      ? this.http.put<PaintingResponse>(
          `${this.API_BASE}/${this.currentPaintingId}`,
          payload
        )
      : this.http.post<PaintingResponse>(this.API_BASE, payload);

    req$.subscribe({
      next: (saved) => {
        this.isSaving = false;
        this.currentPaintingId = saved.id;
        this.successMessage = 'Obra guardada correctamente.';
        this.upsertPaintingInGallery(saved, previewDataUrl);
      },
      error: (err) => {
        console.error('Error al guardar la obra', err);
        this.isSaving = false;
        this.errorMessage =
          'Ocurrió un error al guardar tu obra. Intenta de nuevo.';
      },
    });
  }

  downloadArtwork() {
    if (!this.board) return;
    const url = this.board.getExportPng();
    if (!url) return;

    const a = document.createElement('a');
    a.href = url;
    a.download = 'lienzo.png';
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  // borrar obra ACTUAL (botón de la tarjeta meta) → abre modal oscuro
  deleteCurrentPainting() {
    if (!this.currentPaintingId) return;

    this.pendingGalleryDelete = null;
    this.confirmModal.visible = true;
    this.confirmModal.mode = 'delete';
  }

  // lógica real de borrar la obra actual
  private performDeleteCurrentPainting() {
    if (!this.currentPaintingId) return;
    const id = this.currentPaintingId;

    this.http.delete(`${this.API_BASE}/${id}`).subscribe({
      next: () => {
        this.gallery = this.gallery.filter((p) => p.id !== id);
        this.performClearCanvas();
        this.currentPaintingId = null;
        this.successMessage = 'Obra eliminada correctamente.';
      },
      error: (err) => {
        console.error('Error al eliminar la obra', err);
        this.errorMessage =
          'No se pudo eliminar la obra. Intenta de nuevo.';
      },
    });
  }

  /* ───────── GALERÍA ───────── */

  private parseMetadata(
    raw: string | null | undefined
  ): { description: string; previewDataUrl: string } {
    if (!raw) return { description: '', previewDataUrl: '' };
    try {
      const data = JSON.parse(raw);
      return {
        description:
          typeof data.description === 'string' ? data.description : '',
        previewDataUrl:
          typeof data.previewDataUrl === 'string' ? data.previewDataUrl : '',
      };
    } catch {
      return { description: '', previewDataUrl: '' };
    }
  }

  private upsertPaintingInGallery(p: PaintingResponse, previewDataUrl: string) {
    const meta = this.parseMetadata(p.metadata);
    const summary: PaintingSummary = {
      id: p.id,
      title: p.name,
      description: meta.description,
      previewUrl: previewDataUrl || meta.previewDataUrl,
      updatedAt: p.updatedAt,
    };

    const idx = this.gallery.findIndex((g) => g.id === p.id);
    if (idx >= 0) this.gallery[idx] = summary;
    else this.gallery.unshift(summary);
  }

  private loadGallery() {
    this.http.get<PaintingResponse[]>(this.API_BASE).subscribe({
      next: (list) => {
        this.gallery = list.map((p) => {
          const meta = this.parseMetadata(p.metadata);
          return {
            id: p.id,
            title: p.name,
            description: meta.description,
            previewUrl: meta.previewDataUrl,
            updatedAt: p.updatedAt,
          } as PaintingSummary;
        });
      },
      error: (err) => {
        console.error('Error cargando galería', err);
      },
    });
  }

  onLoadPaintingFromGallery(item: GalleryPainting) {
    this.resetMessages();

    this.http.get<PaintingResponse>(`${this.API_BASE}/${item.id}`).subscribe({
      next: (painting) => {
        if (!this.board) return;

        this.currentPaintingId = painting.id;
        const meta = this.parseMetadata(painting.metadata);
        this.artTitle = painting.name;
        this.artDescription = meta.description;

        try {
          this.board.loadFromSceneJson(painting.sceneJson);
        } catch (err) {
          console.error('Error al cargar la escena', err);
          this.errorMessage = 'No se pudo cargar la obra seleccionada.';
        }
      },
      error: (err) => {
        console.error('Error al obtener pintura', err);
        this.errorMessage = 'No se pudo cargar la obra seleccionada.';
      },
    });
  }

  // borrar desde la GALERÍA (icono de bote de basura) → usa el MISMO modal
  onDeletePaintingFromGallery(item: GalleryPainting) {
    this.pendingGalleryDelete = item;
    this.confirmModal.visible = true;
    this.confirmModal.mode = 'delete';
  }

  // lógica real de borrar la obra seleccionada en la galería
  private performDeleteFromGallery() {
    const item = this.pendingGalleryDelete;
    if (!item) return;

    this.http.delete(`${this.API_BASE}/${item.id}`).subscribe({
      next: () => {
        this.gallery = this.gallery.filter((p) => p.id !== item.id);

        if (this.currentPaintingId === item.id) {
          this.performClearCanvas();
          this.currentPaintingId = null;
        }

        this.pendingGalleryDelete = null;
        this.successMessage = 'Obra eliminada correctamente.';
      },
      error: (err) => {
        console.error('Error al eliminar la obra', err);
        this.errorMessage =
          'No se pudo eliminar la obra. Intenta de nuevo.';
      },
    });
=======
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
>>>>>>> Stashed changes
  }
}
