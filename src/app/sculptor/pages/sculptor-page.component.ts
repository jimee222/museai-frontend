import { CommonModule } from '@angular/common';
import {
  AfterViewInit,
  Component,
  OnInit,
  ViewChild,
  effect,
  inject,
  signal,
} from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { toSignal } from '@angular/core/rxjs-interop';
import { ToolbarComponent } from '../components/toolbar/toolbar.component';
import { ViewportComponent } from '../components/viewport/viewport.component';
import { AssetDropzoneComponent } from '../components/asset-dropzone/asset-dropzone.component';
import { SculptureStoreService } from '../services/sculpture-store.service';
import { downloadBlob } from '../utils/download';
import {
  MaterialPreset,
  Sculpture,
  SculptWorkspaceSettings,
  SculptSymmetry,
  SculptorDisplayToggles,
} from '../models/sculpture';
import { BooleanMode, ModifierAction, SculptBrush } from '../models/sculpt-tools';
import { FormsModule } from '@angular/forms';
import { AiDescriptionsService } from '../../services/ai-descriptions.service';
import { LanguagePreferenceService } from '../../services/language-preference.service';
import { LanguageSelectorComponent } from '../../shared/language-selector/language-selector.component';

type PrimitiveType = 'box' | 'sphere' | 'cylinder';
type ExportFormat = 'glb' | 'stl';

const DEFAULT_WORKSPACE: SculptWorkspaceSettings = {
  activeBrush: 'none',
  brushRadius: 0.9,
  brushStrength: 0.35,
  symmetry: 'none',
  material: 'clay',
  snapToGround: true,
};


@Component({
  selector: 'app-sculptor-page',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ToolbarComponent,
    ViewportComponent,
    AssetDropzoneComponent,
    LanguageSelectorComponent,
  ],
  template: `
    <section class="sculptor-layout">
      <app-sculptor-toolbar
        [gridEnabled]="toggles().grid"
        [axesEnabled]="toggles().axes"
        [lightsEnabled]="toggles().lights"
        [activeBrush]="activeBrush()"
        [booleanMode]="booleanMode()"
        [selectionAvailable]="selectionState().available"
        [selectionScale]="selectionState().scale"
        [selectionY]="selectionState().y"
        [brushRadius]="workspaceSettings().brushRadius"
        [brushStrength]="workspaceSettings().brushStrength"
        [symmetry]="workspaceSettings().symmetry"
        [materialPreset]="workspaceSettings().material"
        [snapToGround]="workspaceSettings().snapToGround"
        (primitive)="handlePrimitive($event)"
        (toggleGrid)="onToggle('grid', $event)"
        (toggleAxes)="onToggle('axes', $event)"
        (toggleLights)="onToggle('lights', $event)"
        (resetCamera)="onResetCamera()"
        (saveScene)="onSaveScene()"
        (exportFormat)="onExport($event)"
        (importSelected)="onImport($event)"
        (brushSelected)="onBrushSelected($event)"
        (booleanAction)="onBooleanAction($event)"
        (modifierAction)="onModifierAction($event)"
        (duplicateSelection)="onDuplicateSelection()"
        (selectionScaleChange)="onSelectionScaleChange($event)"
        (selectionYChange)="onSelectionYChange($event)"
        (brushRadiusChange)="onBrushRadiusChange($event)"
        (brushStrengthChange)="onBrushStrengthChange($event)"
        (symmetryChange)="onSymmetryChange($event)"
        (materialPresetChange)="onMaterialPresetChange($event)"
        (snapToGroundChange)="onSnapToGroundChange($event)"
      ></app-sculptor-toolbar>

      <div class="workspace">
        <div class="viewport-wrapper">
          <app-sculptor-viewport
            #viewport
            (statsChange)="updateStats($event)"
            (banner)="showBanner($event.type, $event.text)"
            (booleanModeChange)="onViewportBooleanMode($event)"
            (selectionStateChange)="onSelectionStateChange($event)"
          ></app-sculptor-viewport>
          <app-asset-dropzone
            (filesDropped)="onDropzoneFiles($event)"
            (invalidFiles)="showBanner('error', $event)"
          ></app-asset-dropzone>
          <div class="banner" *ngIf="bannerMessage() as banner" [class.error]="banner.type === 'error'">
            {{ banner.text }}
          </div>
    </div>

        <section class="gallery">
          <div class="gallery-controls">
            <span class="gallery-controls__label">Idioma para Descripción</span>
            <app-language-selector appearance="dark"></app-language-selector>
          </div>
          <header>
            <h3>Galería local</h3>
            <small>{{ sculptures().length }} guardadas</small>
          </header>
          <ul>
            <li *ngFor="let sculpture of sculptures(); trackBy: trackById">
              <div class="meta">
                <strong>{{ sculpture.name }}</strong>
                <small>{{ sculpture.updatedAt | date: 'short' }}</small>
              </div>
              <div class="actions">
                <button type="button" (click)="loadSculpture(sculpture)" aria-label="Cargar escultura">Cargar</button>
                <button type="button" (click)="deleteSculpture(sculpture)" aria-label="Eliminar escultura">✕</button>
              </div>
            </li>
          </ul>
          <div class="gallery-footer">
            <button type="button" class="tutorial-replay" (click)="openTutorial()">
              Ver Tutorial
            </button>
          </div>
        </section>
      </div>
    </section>

    <div class="tutorial-overlay" *ngIf="tutorialVisible()">
      <div class="tutorial-modal">
        <header class="tutorial-modal__header">
          <div>
            <p class="tutorial-modal__eyebrow">Guía rápida</p>
            <h3>{{ tutorialSteps[tutorialStepIndex()].title }}</h3>
          </div>
          <button type="button" class="tutorial-close" (click)="completeTutorial()">
            ✕
          </button>
        </header>
        <p class="tutorial-modal__body">
          {{ tutorialSteps[tutorialStepIndex()].description }}
        </p>
        <div class="tutorial-progress">
          Paso {{ tutorialStepIndex() + 1 }} de {{ tutorialSteps.length }}
        </div>
        <div class="tutorial-actions">
          <button type="button" class="text-button" (click)="skipFutureTutorials()">
            No volver a mostrar
          </button>
          <div class="tutorial-nav">
            <button
              type="button"
              class="secondary-button"
              [disabled]="tutorialStepIndex() === 0"
              (click)="previousTutorialStep()"
            >
              Anterior
            </button>
            <button
              *ngIf="tutorialStepIndex() < tutorialSteps.length - 1"
              type="button"
              class="primary-button"
              (click)="nextTutorialStep()"
            >
              Siguiente
            </button>
            <button
              *ngIf="tutorialStepIndex() === tutorialSteps.length - 1"
              type="button"
              class="primary-button"
              (click)="completeTutorial()"
            >
              Listo
            </button>
          </div>
        </div>
      </div>
    </div>

    <div class="save-dialog-overlay" *ngIf="saveDialogVisible()">
      <form class="save-dialog" (ngSubmit)="submitSaveDialog($event)">
        <h4>{{ isUpdatingExisting() ? 'Actualizar escultura' : 'Guardar escultura' }}</h4>
        <label>
          <span>Nombre</span>
          <input
            type="text"
            name="sculptureName"
            required
            [(ngModel)]="saveDialogModel.name"
            placeholder="Mi escultura"
          />
        </label>
        <label>
          <span>Etiquetas</span>
          <input
            type="text"
            name="sculptureTags"
            [(ngModel)]="saveDialogModel.tags"
            placeholder="fantasía, criatura"
          />
          <small>Separa las etiquetas con comas</small>
        </label>
        <label class="description-field">
          <div class="label-row">
            <span>Descripción</span>
            <button
              type="button"
              (click)="generateSculptureDescription()"
              [disabled]="isGeneratingDescription()"
            >
              {{ isGeneratingDescription() ? 'Generando...' : 'Generar descripción' }}
            </button>
          </div>
          <textarea
            name="sculptureDescription"
            rows="3"
            [(ngModel)]="saveDialogModel.description"
            placeholder="Describe tu escultura (opcional)"
          ></textarea>
        </label>
        <div class="dialog-actions">
          <button type="button" (click)="closeSaveDialog()" [disabled]="isSavingScene()">
            Cancelar
          </button>
          <button type="submit" [disabled]="isSavingScene()">
            {{ isSavingScene() ? 'Guardando...' : isUpdatingExisting() ? 'Actualizar' : 'Guardar' }}
          </button>
        </div>
      </form>
    </div>

    <footer class="status-bar">
      <span>FPS: {{ stats().fps }}</span>
      <span>Triángulos: {{ stats().triangles | number }}</span>
      <span>Atajos: G-mover · R-rotar · S-escalar · Delete-eliminar · Esc-limpiar</span>
    </footer>
  `,
  styles: [
    `
      :host {
        display: flex;
        flex-direction: column;
        height: 100%;
        background: #05060a;
        color: #f8fafc;
        font-family: 'Inter', system-ui, sans-serif;
      }
      .sculptor-layout {
        display: flex;
        flex: 1;
        min-height: 0;
      }
      .workspace {
        display: flex;
        flex: 1;
        gap: 1rem;
        padding: 1rem;
        min-height: 0;
      }
      .viewport-wrapper {
        position: relative;
        flex: 1;
        min-width: 0;
        border-radius: 12px;
        overflow: hidden;
        border: 1px solid rgba(255, 255, 255, 0.08);
      }
      .gallery {
        width: 280px;
        border: 1px solid rgba(255, 255, 255, 0.08);
        border-radius: 12px;
        padding: 1rem;
        background: rgba(255, 255, 255, 0.02);
        display: flex;
        flex-direction: column;
        gap: 0.75rem;
      }
      .gallery-controls {
        display: flex;
        justify-content: center;
        align-items: center;
        gap: 0.5rem;
        margin-bottom: 0.25rem;
      }
      .gallery-controls__label {
        font-size: 1rem;
        font-weight: 700;
        letter-spacing: 0.01em;
        color: #f8fafc;
      }
      .gallery-footer {
        margin-top: 0.75rem;
        display: flex;
        justify-content: center;
      }
      .tutorial-replay {
        background: rgba(255, 255, 255, 0.08);
        color: #e2e8f0;
        border: 1px solid rgba(255, 255, 255, 0.16);
        border-radius: 8px;
        padding: 0.35rem 0.75rem;
        cursor: pointer;
        transition: background 0.18s ease, transform 0.18s ease, border-color 0.18s ease;
      }
      .tutorial-replay:hover {
        background: rgba(255, 255, 255, 0.14);
        border-color: rgba(255, 255, 255, 0.3);
        transform: translateY(-1px);
      }
      .tutorial-overlay {
        position: fixed;
        inset: 0;
        background: rgba(0, 0, 0, 0.6);
        display: grid;
        place-items: center;
        z-index: 12;
        padding: 1rem;
      }
      .tutorial-modal {
        width: min(420px, 100%);
        background: #0c0d13;
        border: 1px solid rgba(255, 255, 255, 0.08);
        border-radius: 14px;
        padding: 1.2rem 1.3rem;
        box-shadow: 0 20px 60px rgba(0, 0, 0, 0.6);
        display: flex;
        flex-direction: column;
        gap: 0.8rem;
      }
      .tutorial-modal__header {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: 0.5rem;
      }
      .tutorial-modal__eyebrow {
        margin: 0;
        text-transform: uppercase;
        letter-spacing: 0.12em;
        font-size: 0.75rem;
        color: rgba(226, 232, 240, 0.7);
      }
      .tutorial-modal h3 {
        margin: 0.2rem 0 0;
        font-size: 1.15rem;
      }
      .tutorial-modal__body {
        margin: 0;
        color: rgba(226, 232, 240, 0.9);
        line-height: 1.5;
      }
      .tutorial-progress {
        font-size: 0.9rem;
        color: rgba(226, 232, 240, 0.8);
      }
      .tutorial-actions {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 0.5rem;
        flex-wrap: wrap;
      }
      .tutorial-nav {
        display: flex;
        gap: 0.5rem;
      }
      .tutorial-close {
        background: rgba(255, 255, 255, 0.06);
        border: 1px solid rgba(255, 255, 255, 0.1);
        border-radius: 50%;
        color: #f8fafc;
        width: 32px;
        height: 32px;
        cursor: pointer;
      }
      .primary-button,
      .secondary-button,
      .text-button {
        font: inherit;
        padding: 0.45rem 0.9rem;
        border-radius: 8px;
        cursor: pointer;
        transition: transform 0.16s ease, background 0.16s ease, border-color 0.16s ease, color 0.16s ease;
      }
      .primary-button {
        background: rgba(34, 197, 94, 0.18);
        border: 1px solid rgba(34, 197, 94, 0.45);
        color: #bbf7d0;
      }
      .primary-button:hover {
        background: rgba(34, 197, 94, 0.24);
      }
      .secondary-button {
        background: rgba(255, 255, 255, 0.06);
        border: 1px solid rgba(255, 255, 255, 0.15);
        color: #e2e8f0;
      }
      .secondary-button:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }
      .secondary-button:hover:not(:disabled) {
        background: rgba(255, 255, 255, 0.1);
      }
      .text-button {
        background: transparent;
        border: none;
        color: rgba(226, 232, 240, 0.75);
        padding: 0.35rem 0;
      }
      .text-button:hover {
        color: #f8fafc;
        transform: translateY(-1px);
      }
      .gallery header {
        display: flex;
        justify-content: space-between;
        align-items: baseline;
      }
      ul {
        list-style: none;
        padding: 0;
        margin: 0;
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
        overflow: auto;
      }
      li {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 0.5rem;
        border-radius: 8px;
        background: rgba(0, 0, 0, 0.3);
      }
      .meta {
        display: flex;
        flex-direction: column;
      }
      .actions {
        display: flex;
        gap: 0.35rem;
      }
      .actions button {
        border: none;
        border-radius: 4px;
        padding: 0.25rem 0.5rem;
        cursor: pointer;
        background: rgba(255, 255, 255, 0.12);
        color: inherit;
      }
      .actions button:hover {
        background: rgba(255, 255, 255, 0.2);
      }
      .banner {
        position: absolute;
        top: 1rem;
        right: 1rem;
        background: rgba(34, 197, 94, 0.9);
        color: #041302;
        padding: 0.5rem 0.75rem;
        border-radius: 6px;
        font-size: 0.9rem;
      }
      .banner.error {
        background: rgba(239, 68, 68, 0.9);
        color: #fff;
      }
      .status-bar {
        display: flex;
        justify-content: space-between;
        padding: 0.35rem 1rem;
        border-top: 1px solid rgba(255, 255, 255, 0.08);
        font-size: 0.85rem;
        background: #030308;
      }
      button {
        font: inherit;
      }
      .save-dialog-overlay {
        position: fixed;
        inset: 0;
        display: flex;
        align-items: center;
        justify-content: center;
        background: rgba(0, 0, 0, 0.5);
        backdrop-filter: blur(2px);
        z-index: 10;
      }
      .save-dialog {
        background: #0c0d13;
        border-radius: 12px;
        padding: 1.5rem;
        width: min(90vw, 360px);
        border: 1px solid rgba(255, 255, 255, 0.08);
        display: flex;
        flex-direction: column;
        gap: 0.75rem;
      }
      .save-dialog h4 {
        margin: 0;
        font-size: 1.1rem;
      }
      .save-dialog label {
        display: flex;
        flex-direction: column;
        gap: 0.35rem;
        font-size: 0.9rem;
      }
      .save-dialog .description-field {
        gap: 0.5rem;
      }
      .save-dialog .label-row {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 0.5rem;
      }
      .save-dialog .label-row button {
        background: rgba(255, 255, 255, 0.08);
        border: 1px solid rgba(255, 255, 255, 0.2);
        border-radius: 6px;
        padding: 0.35rem 0.7rem;
        color: inherit;
        cursor: pointer;
      }
      .save-dialog .label-row button:hover:not(:disabled) {
        background: rgba(255, 255, 255, 0.14);
      }
      .save-dialog .label-row button:disabled {
        opacity: 0.6;
        cursor: not-allowed;
      }
      .save-dialog input {
        border-radius: 6px;
        border: 1px solid rgba(255, 255, 255, 0.12);
        padding: 0.5rem 0.75rem;
        background: rgba(255, 255, 255, 0.05);
        color: inherit;
      }
      .save-dialog textarea {
        border-radius: 6px;
        border: 1px solid rgba(255, 255, 255, 0.12);
        padding: 0.5rem 0.75rem;
        background: rgba(255, 255, 255, 0.05);
        color: inherit;
        resize: vertical;
        min-height: 80px;
        font: inherit;
      }
      .save-dialog small {
        color: rgba(255, 255, 255, 0.6);
        font-size: 0.75rem;
      }
      .dialog-actions {
        display: flex;
        justify-content: flex-end;
        gap: 0.5rem;
        margin-top: 0.5rem;
      }
      .dialog-actions button {
        padding: 0.45rem 0.9rem;
      }
      .dialog-actions button[type='submit'] {
        background: rgba(34, 197, 94, 0.15);
        border: 1px solid rgba(34, 197, 94, 0.4);
        color: #a3ffcc;
      }
      .dialog-actions button[type='submit']:disabled {
        opacity: 0.5;
        cursor: default;
      }
    `,
  ],
})
export class SculptorPageComponent implements AfterViewInit, OnInit {
  @ViewChild(ViewportComponent) viewport?: ViewportComponent;

  private readonly store = inject(SculptureStoreService);
  private readonly route = inject(ActivatedRoute);
  private readonly aiDescriptions = inject(AiDescriptionsService);
  private readonly languagePreference = inject(LanguagePreferenceService);
  private readonly tutorialStorageKey = 'sculptorTutorialDismissed';

  readonly sculptures = toSignal(this.store.sculptures$, { initialValue: [] as Sculpture[] });
  readonly stats = signal({ fps: 0, triangles: 0 });
  readonly toggles = signal<SculptorDisplayToggles>({ grid: true, axes: true, lights: true });
  readonly bannerMessage = signal<{ type: 'success' | 'error'; text: string } | null>(null);
  readonly selectedSculptureId = signal<string | null>(null);
  readonly activeBrush = signal<SculptBrush>('none');
  readonly booleanMode = signal<BooleanMode>('none');
  readonly selectionState = signal<{ available: boolean; scale: number; y: number }>({
    available: false,
    scale: 1,
    y: 0,
  });
  readonly workspaceSettings = signal<SculptWorkspaceSettings>({ ...DEFAULT_WORKSPACE });
  readonly saveDialogVisible = signal(false);
  readonly isSavingScene = signal(false);
  readonly isGeneratingDescription = signal(false);
  readonly tutorialVisible = signal(false);
  readonly tutorialStepIndex = signal(0);
  saveDialogModel: { name: string; tags: string; description: string } = {
    name: 'Nueva escultura',
    tags: '',
    description: '',
  };
  readonly tutorialSteps: Array<{ title: string; description: string }> = [
    {
      title: 'Explora el espacio',
      description: 'Muévete con clic derecho y rueda del ratón. Usa la barra superior para activar la rejilla y los ejes.',
    },
    {
      title: 'Elige un pincel',
      description: 'Selecciona una herramienta en la barra lateral: mover, inflar, suavizar o pellizcar. Ajusta radio e intensidad.',
    },
    {
      title: 'Trabaja con simetría',
      description: 'Activa la simetría y el material que prefieras para ver mejor las formas mientras esculpes.',
    },
    {
      title: 'Guarda y exporta',
      description: 'Guarda tu escultura en la galería local o expórtala en GLB/STL desde el botón de exportación.',
    },
  ];
  private readonly brushLabels: Record<SculptBrush, string> = {
    none: 'transformación',
    grab: 'mover',
    inflate: 'inflar',
    smooth: 'suavizar',
    pinch: 'pellizcar',
    flatten: 'aplanar',
    crease: 'surcar',
  };

  private bannerTimeout: number | null = null;
  constructor() {}

  ngOnInit(): void {
    this.applyQueryParams();
    this.maybeOpenTutorial();
  }

  ngAfterViewInit(): void {

    effect(() => {
      if (!this.viewport) {
        return;
      }
      const options = this.toggles();
      this.viewport.setGridVisible(options.grid);
      this.viewport.setAxesVisible(options.axes);
      this.viewport.setLightsEnabled(options.lights);
    });
    this.syncWorkspaceToViewport();
  }

  handlePrimitive(type: PrimitiveType): void {
    this.viewport?.addPrimitive(type);
  }

  onBrushSelected(tool: SculptBrush): void {
    this.activeBrush.set(tool);
    this.updateWorkspace({ activeBrush: tool });
    const brushName = this.brushLabels[tool] ?? tool;
    const label =
      tool === 'none'
        ? 'Herramientas de transformación activadas'
        : `Pincel ${brushName} listo`;
    this.showBanner('success', label);
  }

  onToggle(key: keyof SculptorDisplayToggles, value: boolean): void {
    this.toggles.update((prev) => ({ ...prev, [key]: value }));
    if (!this.viewport) {
      return;
    }
    if (key === 'grid') {
      this.viewport.setGridVisible(value);
    } else if (key === 'axes') {
      this.viewport.setAxesVisible(value);
    } else if (key === 'lights') {
      this.viewport.setLightsEnabled(value);
    }
  }

  onBooleanAction(mode: BooleanMode): void {
    if (!this.viewport) {
      return;
    }
    const applied = this.viewport.setBooleanMode(mode);
    this.booleanMode.set(applied ? mode : 'none');
  }

  onViewportBooleanMode(mode: BooleanMode): void {
    this.booleanMode.set(mode);
  }

  onSelectionStateChange(state: { hasSelection: boolean; scale: number; y: number }): void {
    this.selectionState.set({ available: state.hasSelection, scale: state.scale, y: state.y });
  }

  async onModifierAction(action: ModifierAction): Promise<void> {
    if (!this.viewport) {
      return;
    }
    await this.viewport.applyModifier(action);
  }

  onDuplicateSelection(): void {
    this.viewport?.duplicateSelection();
  }

  onSelectionScaleChange(scale: number): void {
    this.viewport?.setSelectionScale(scale);
  }

  onSelectionYChange(yValue: number): void {
    this.viewport?.setSelectionY(yValue);
  }

  onBrushRadiusChange(value: number): void {
    this.updateWorkspace({ brushRadius: value });
  }

  onBrushStrengthChange(value: number): void {
    this.updateWorkspace({ brushStrength: value });
  }

  onSymmetryChange(symmetry: SculptSymmetry): void {
    this.updateWorkspace({ symmetry });
  }

  onMaterialPresetChange(preset: MaterialPreset): void {
    this.updateWorkspace({ material: preset });
    this.viewport?.setMaterialPreset(preset, true);
  }

  onSnapToGroundChange(enabled: boolean): void {
    this.updateWorkspace({ snapToGround: enabled });
  }

  onResetCamera(): void {
    this.viewport?.resetCamera();
  }

  onSaveScene(): void {
    if (!this.viewport) {
      return;
    }
    const selected = this.getSelectedSculpture();
    const nextName = selected?.name ?? (this.saveDialogModel.name || 'Nueva escultura');
    const nextTags = selected?.tags?.join(', ') ?? this.saveDialogModel.tags;
    const nextDescription = selected?.description ?? this.saveDialogModel.description;
    this.saveDialogModel = { name: nextName, tags: nextTags, description: nextDescription ?? '' };
    this.saveDialogVisible.set(true);
  }

  async generateSculptureDescription(): Promise<void> {
    if (this.isGeneratingDescription()) {
      return;
    }
    const name = this.saveDialogModel.name.trim();
    const labels = this.parseTags(this.saveDialogModel.tags);
    if (!name && labels.length === 0) {
      this.showBanner('error', 'Agrega un nombre o etiquetas para generar una descripción');
      return;
    }
    this.isGeneratingDescription.set(true);
    try {
      const language = this.languagePreference.language();
      const description = await firstValueFrom(
        this.aiDescriptions.generateSculptureDescription({
          name: name || 'Escultura sin título',
          labels,
          language,
        }),
      );
      if (!description) {
        throw new Error('Descripción vacía');
      }
      this.saveDialogModel.description = description;
      this.showBanner('success', 'Descripción generada');
    } catch (error) {
      console.error('Failed to generate sculpture description', error);
      this.showBanner('error', 'No se pudo generar la descripción');
    } finally {
      this.isGeneratingDescription.set(false);
    }
  }

  async submitSaveDialog(event?: Event): Promise<void> {
    event?.preventDefault();
    if (!this.viewport || this.isSavingScene()) {
      return;
    }
    const trimmedName = this.saveDialogModel.name.trim();
    if (!trimmedName) {
      this.showBanner('error', 'Se requiere un nombre para la escultura');
      return;
    }
    const tags = this.parseTags(this.saveDialogModel.tags);
    const description = this.saveDialogModel.description.trim();
    const scene = this.viewport.getScene();
    const workspace = this.workspaceSettings();
    const updateId = this.selectedSculptureId() ?? this.findSculptureIdByName(trimmedName);
    this.isSavingScene.set(true);
    try {
      const saved = updateId
        ? await this.store.updateScene(updateId, scene, trimmedName, tags, workspace, description)
        : await this.store.saveFromScene(scene, trimmedName, tags, workspace, description);
      this.selectedSculptureId.set(saved.id);
      this.closeSaveDialog();
      this.showBanner('success', updateId ? 'Escultura actualizada' : 'Escultura guardada');
    } catch (error) {
      console.error(error);
      this.showBanner('error', 'No se pudo guardar la escultura');
    } finally {
      this.isSavingScene.set(false);
    }
  }

  closeSaveDialog(): void {
    this.saveDialogVisible.set(false);
  }

  isUpdatingExisting(): boolean {
    if (this.selectedSculptureId()) {
      return true;
    }
    const trimmedName = this.saveDialogModel.name.trim();
    if (!trimmedName) {
      return false;
    }
    return this.findSculptureIdByName(trimmedName) !== null;
  }

  async onExport(format: ExportFormat): Promise<void> {
    if (!this.viewport) {
      return;
    }
    try {
      const blob = await this.viewport.exportScene(format);
      downloadBlob(blob, `sculpture-${Date.now()}.${format}`);
      this.showBanner('success', `${format.toUpperCase()} exportado`);
    } catch (error) {
      console.error(error);
      this.showBanner('error', `Error al exportar ${format.toUpperCase()}`);
    }
  }

  async onImport(files: FileList | null): Promise<void> {
    if (!files?.length) {
      return;
    }
    await this.viewport?.importFiles(files);
  }

  async onDropzoneFiles(files: File[]): Promise<void> {
    await this.viewport?.importFiles(files);
  }

  updateStats(stats: { fps: number; triangles: number }): void {
    this.stats.set(stats);
  }

  loadSculpture(sculpture: Sculpture): void {
    const json = sculpture.sceneJson;
    this.viewport?.loadSceneFromJson(json);
    this.selectedSculptureId.set(sculpture.id);
    if (sculpture.workspace) {
      this.applyWorkspaceSettings(sculpture.workspace);
    } else {
      this.applyWorkspaceSettings(DEFAULT_WORKSPACE);
    }
  }

  async deleteSculpture(sculpture: Sculpture): Promise<void> {
    if (confirm(`¿Eliminar "${sculpture.name}"?`)) {
      try {
        await this.store.remove(sculpture.id);
        if (this.selectedSculptureId() === sculpture.id) {
          this.selectedSculptureId.set(null);
        }
        this.showBanner('success', 'Escultura eliminada');
      } catch (error) {
        console.error(error);
        this.showBanner('error', 'No se pudo eliminar la escultura');
      }
    }
  }

  showBanner(type: 'success' | 'error', text: string): void {
    this.bannerMessage.set({ type, text });
    if (this.bannerTimeout) {
      window.clearTimeout(this.bannerTimeout);
    }
    this.bannerTimeout = window.setTimeout(() => {
      this.bannerMessage.set(null);
    }, 4000);
  }

  openTutorial(): void {
    this.tutorialStepIndex.set(0);
    this.tutorialVisible.set(true);
  }

  nextTutorialStep(): void {
    const nextIndex = Math.min(this.tutorialSteps.length - 1, this.tutorialStepIndex() + 1);
    this.tutorialStepIndex.set(nextIndex);
  }

  previousTutorialStep(): void {
    const prevIndex = Math.max(0, this.tutorialStepIndex() - 1);
    this.tutorialStepIndex.set(prevIndex);
  }

  completeTutorial(markDismissed = true): void {
    if (markDismissed) {
      this.persistTutorialDismissal();
    }
    this.tutorialVisible.set(false);
  }

  skipFutureTutorials(): void {
    this.persistTutorialDismissal();
    this.tutorialVisible.set(false);
  }

  trackById(_: number, sculpture: Sculpture): string {
    return sculpture.id;
  }

  private applyQueryParams(): void {
    const params = this.route.snapshot.queryParamMap;
    const preset = params.get('preset');
    const light = params.get('light');
    const next: SculptorDisplayToggles = { grid: true, axes: true, lights: true };
    switch (preset) {
      case 'gridOff':
        next.grid = false;
        break;
      case 'gridOn':
        next.grid = true;
        break;
      case 'axesOff':
        next.axes = false;
        break;
      case 'axesOn':
        next.axes = true;
        break;
    }
    if (light === 'off') {
      next.lights = false;
    }
    this.toggles.set(next);
  }

  private updateWorkspace(partial: Partial<SculptWorkspaceSettings>): void {
    this.workspaceSettings.update((prev) => ({ ...prev, ...partial }));
    this.syncWorkspaceToViewport();
  }

  private applyWorkspaceSettings(settings: SculptWorkspaceSettings): void {
    this.workspaceSettings.set({ ...DEFAULT_WORKSPACE, ...settings });
    this.activeBrush.set(settings.activeBrush);
    this.syncWorkspaceToViewport();
  }

  private syncWorkspaceToViewport(): void {
    if (!this.viewport) {
      return;
    }
    const ws = this.workspaceSettings();
    this.viewport.setBrushSettings({ radius: ws.brushRadius, strength: ws.brushStrength });
    this.viewport.setSymmetry(ws.symmetry);
    this.viewport.setMaterialPreset(ws.material, false);
    this.viewport.setSnapToGround(ws.snapToGround);
    this.viewport.setBrush(ws.activeBrush);
  }

  private getSelectedSculpture(): Sculpture | undefined {
    const selectedId = this.selectedSculptureId();
    if (!selectedId) {
      return undefined;
    }
    return this.sculptures().find((item) => item.id === selectedId);
  }

  private parseTags(raw: string): string[] {
    return raw
      .split(',')
      .map((tag) => tag.trim())
      .filter(Boolean);
  }

  private findSculptureIdByName(name: string): string | null {
    const target = name.trim().toLowerCase();
    if (!target) {
      return null;
    }
    return this.sculptures().find((item) => item.name.trim().toLowerCase() === target)?.id ?? null;
  }

  private maybeOpenTutorial(): void {
    if (this.loadTutorialDismissed()) {
      return;
    }
    this.openTutorial();
  }

  private persistTutorialDismissal(): void {
    try {
      localStorage.setItem(this.tutorialStorageKey, 'true');
    } catch (error) {
      console.warn('No se pudo guardar preferencia del tutorial', error);
    }
  }

  private loadTutorialDismissed(): boolean {
    try {
      return localStorage.getItem(this.tutorialStorageKey) === 'true';
    } catch {
      return false;
    }
  }
}
