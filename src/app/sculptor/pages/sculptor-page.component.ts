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
type SelectionState = { available: boolean; scale: number; y: number };
type BannerState = { type: 'success' | 'error'; text: string } | null;
type SaveDialogModel = { name: string; tags: string; description: string };
type SculptorTutorialStep = { title: string; description: string };

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
  templateUrl: './sculptor-page.component.html',
  styleUrls: ['./sculptor-page.component.css'],
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
  readonly bannerMessage = signal<BannerState>(null);
  readonly selectedSculptureId = signal<string | null>(null);
  readonly activeBrush = signal<SculptBrush>('none');
  readonly booleanMode = signal<BooleanMode>('none');
  readonly selectionState = signal<SelectionState>({
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
  saveDialogModel: SaveDialogModel = {
    name: 'Nueva escultura',
    tags: '',
    description: '',
  };
  readonly tutorialSteps: SculptorTutorialStep[] = [
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
  private readonly bannerDurationMs = 4000;
  private readonly brushLabels: Record<SculptBrush, string> = {
    none: 'transformación',
    grab: 'mover',
    inflate: 'inflar',
    smooth: 'suavizar',
    pinch: 'pellizcar',
    flatten: 'aplanar',
    crease: 'surcar',
  };

  private bannerTimeout: ReturnType<typeof window.setTimeout> | null = null;
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
    }, this.bannerDurationMs);
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
