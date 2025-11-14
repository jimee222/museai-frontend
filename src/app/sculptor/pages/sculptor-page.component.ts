import { CommonModule } from '@angular/common';
import {
  AfterViewInit,
  Component,
  ViewChild,
  effect,
  inject,
  signal,
} from '@angular/core';
import { ActivatedRoute } from '@angular/router';
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
  imports: [CommonModule, ToolbarComponent, ViewportComponent, AssetDropzoneComponent],
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
          <header>
            <h3>Local Gallery</h3>
            <small>{{ sculptures().length }} saved</small>
          </header>
          <ul>
            <li *ngFor="let sculpture of sculptures(); trackBy: trackById">
              <div class="meta">
                <strong>{{ sculpture.name }}</strong>
                <small>{{ sculpture.updatedAt | date: 'short' }}</small>
              </div>
              <div class="actions">
                <button type="button" (click)="loadSculpture(sculpture)" aria-label="Load sculpture">Load</button>
                <button type="button" (click)="deleteSculpture(sculpture)" aria-label="Delete sculpture">✕</button>
              </div>
            </li>
          </ul>
        </section>
      </div>
    </section>

    <footer class="status-bar">
      <span>FPS: {{ stats().fps }}</span>
      <span>Triangles: {{ stats().triangles | number }}</span>
      <span>Shortcuts: G-move · R-rotate · S-scale · Delete-remove · Esc-clear</span>
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
    `,
  ],
})
export class SculptorPageComponent implements AfterViewInit {
  @ViewChild(ViewportComponent) viewport?: ViewportComponent;

  private readonly store = inject(SculptureStoreService);
  private readonly route = inject(ActivatedRoute);

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

  private bannerTimeout: number | null = null;

  constructor() {
    this.applyQueryParams();
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
    const label = tool === 'none' ? 'Transform tools enabled' : `${tool.charAt(0).toUpperCase()}${tool.slice(1)} brush ready`;
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

  async onSaveScene(): Promise<void> {
    if (!this.viewport) {
      return;
    }
    const name = prompt('Sculpture name', 'New Sculpture');
    if (!name) {
      return;
    }
    const tagsInput = prompt('Tags (comma separated)', '') ?? '';
    const tags = tagsInput
      .split(',')
      .map((tag) => tag.trim())
      .filter(Boolean);

    try {
      const existingId = this.selectedSculptureId();
      const scene = this.viewport.getScene();
      const workspace = this.workspaceSettings();
      const saved = existingId
        ? await this.store.updateScene(existingId, scene, name, tags, workspace)
        : await this.store.saveFromScene(scene, name, tags, workspace);
      this.selectedSculptureId.set(saved.id);
      this.showBanner('success', existingId ? 'Sculpture updated' : 'Sculpture saved');
    } catch (error) {
      console.error(error);
      this.showBanner('error', 'Unable to save sculpture');
    }
  }

  async onExport(format: ExportFormat): Promise<void> {
    if (!this.viewport) {
      return;
    }
    try {
      const blob = await this.viewport.exportScene(format);
      downloadBlob(blob, `sculpture-${Date.now()}.${format}`);
      this.showBanner('success', `Exported ${format.toUpperCase()}`);
    } catch (error) {
      console.error(error);
      this.showBanner('error', `Failed to export ${format.toUpperCase()}`);
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
    if (confirm(`Delete "${sculpture.name}"?`)) {
      try {
        await this.store.remove(sculpture.id);
        if (this.selectedSculptureId() === sculpture.id) {
          this.selectedSculptureId.set(null);
        }
        this.showBanner('success', 'Sculpture removed');
      } catch (error) {
        console.error(error);
        this.showBanner('error', 'Failed to delete sculpture');
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
}
