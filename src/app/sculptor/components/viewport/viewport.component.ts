import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  EventEmitter,
  NgZone,
  OnDestroy,
  Output,
  ViewChild,
} from '@angular/core';
import {
  Box3,
  BoxGeometry,
  BufferAttribute,
  BufferGeometry,
  CylinderGeometry,
  InterleavedBufferAttribute,
  Mesh,
  MeshStandardMaterial,
  Object3D,
  ObjectLoader,
  PerspectiveCamera,
  Raycaster,
  Scene,
  SphereGeometry,
  Vector2,
  Vector3,
  WebGLRenderer,
} from 'three';
import type { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import type {
  TransformControls,
  TransformControlsEventMap,
} from 'three/examples/jsm/controls/TransformControls.js';
import { BooleanMode, ModifierAction, SculptBrush } from '../../models/sculpt-tools';
import { subdivideGeometry } from '../../utils/simple-subdivision';
import { SimpleCSG } from '../../utils/simple-csg';
import { ThreeFactoryService } from '../../services/three-factory.service';
import { MaterialPreset, SculptSymmetry } from '../../models/sculpture';

type PrimitiveType = 'box' | 'sphere' | 'cylinder';
type ExportFormat = 'glb' | 'stl';

interface BannerEvent {
  type: 'success' | 'error';
  text: string;
}

const MATERIAL_PRESETS: Record<MaterialPreset, { color: string; metalness: number; roughness: number; wireframe?: boolean }> =
  {
    clay: { color: '#d4a373', metalness: 0.05, roughness: 0.8 },
    metal: { color: '#bcc2cd', metalness: 0.9, roughness: 0.2 },
    glass: { color: '#bfe4ff', metalness: 0.1, roughness: 0.05 },
    matte: { color: '#9ca3af', metalness: 0.05, roughness: 0.95 },
    wireframe: { color: '#22d3ee', metalness: 0, roughness: 1, wireframe: true },
  };


const MAX_VERTEX_COUNT = 120_000;
const PLANE_DRAG_ACTIVATION_PX = 8;
const PLANE_DRAG_ACTIVATION_DISTANCE_SQ = PLANE_DRAG_ACTIVATION_PX * PLANE_DRAG_ACTIVATION_PX;

@Component({
  selector: 'app-sculptor-viewport',
  standalone: true,
  template: `
    <div
      class="viewport"
      #containerRef
      (pointerdown)="handlePointerDown($event)"
      (pointermove)="handlePointerMove($event)"
      (pointerup)="handlePointerUp($event)"
      (pointerleave)="handlePointerUp($event)"
      (pointercancel)="handlePointerUp($event)"
      (dragover)="handleDragOver($event)"
      (drop)="handleDrop($event)"
    >
      <canvas #canvasRef aria-label="Sculpting viewport"></canvas>
    </div>
  `,
  styles: [
    `
      :host {
        position: relative;
        display: block;
        flex: 1;
      }
      .viewport {
        position: relative;
        width: 100%;
        height: 100%;
        overflow: hidden;
        background: radial-gradient(circle at top, #151b2b, #05060a 70%);
      }
      canvas {
        width: 100%;
        height: 100%;
        display: block;
      }
    `,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ViewportComponent implements AfterViewInit, OnDestroy {
  @ViewChild('canvasRef', { static: true }) private canvasRef!: ElementRef<HTMLCanvasElement>;
  @ViewChild('containerRef', { static: true }) private containerRef!: ElementRef<HTMLDivElement>;
  @Output() statsChange = new EventEmitter<{ fps: number; triangles: number }>();
  @Output() banner = new EventEmitter<BannerEvent>();
  @Output() booleanModeChange = new EventEmitter<BooleanMode>();
  @Output() selectionStateChange = new EventEmitter<{ hasSelection: boolean; scale: number; y: number }>();

  private renderer!: WebGLRenderer;
  private camera!: PerspectiveCamera;
  private scene = new Scene();
  private orbitControls?: OrbitControls;
  private transformControls?: TransformControls;
  private resizeObserver?: ResizeObserver;
  private frameHandle = 0;
  private lastStatsAt = performance.now();
  private frames = 0;
  private raycaster = new Raycaster();
  private pointer = new Vector2();
  private selected: Object3D | null = null;
  private gridHelper?: Object3D;
  private axesHelper?: Object3D;
  private lightsGroup?: Object3D;
  private activeBrush: SculptBrush = 'none';
  private isBrushing = false;
  private brushPointerId: number | null = null;
  private brushLastPoint = new Vector3();
  private brushRadius = 0.9;
  private brushStrength = 0.35;
  private booleanMode: BooleanMode = 'none';
  private booleanSource: Mesh | null = null;
  private isPlaneDragging = false;
  private planeDragPointerId: number | null = null;
  private planeDragHeight = 0;
  private planeDragOffset = new Vector3();
  private planeDragStarted = false;
  private planeDragStart = new Vector2();
  private transformDragging = false;
  private symmetry: SculptSymmetry = 'none';
  private materialPreset: MaterialPreset = 'clay';
  private snapToGround = true;

  constructor(
    private readonly ngZone: NgZone,
    private readonly threeFactory: ThreeFactoryService,
  ) {}

  async ngAfterViewInit(): Promise<void> {
    this.setupScene();
    await this.setupControls();
    this.setupResizeObserver();
    this.ngZone.runOutsideAngular(() => this.startRenderLoop());
    window.addEventListener('keydown', this.handleKeyDown, { passive: false });
  }

  ngOnDestroy(): void {
    window.removeEventListener('keydown', this.handleKeyDown);
    this.resizeObserver?.disconnect();
    cancelAnimationFrame(this.frameHandle);
    this.transformControls?.dispose();
    this.orbitControls?.dispose();
    this.renderer?.dispose();
  }

  getScene(): Scene {
    return this.scene;
  }

  getSceneJson(): string {
    return JSON.stringify(this.scene.toJSON());
  }

  async loadSceneFromJson(json: string): Promise<void> {
    try {
      const loader = new ObjectLoader();
      const parsed = loader.parse(JSON.parse(json)) as Scene;
      this.removeEditableObjects();
      parsed.children
        .filter((child) => !child.userData?.['helper'])
        .forEach((child) => {
          this.prepareObject(child);
          this.scene.add(child);
        });
      this.resetCamera();
      this.banner.emit({ type: 'success', text: 'Escultura cargada' });
    } catch (error) {
      this.banner.emit({ type: 'error', text: 'No se pudo cargar la escultura' });
      console.error(error);
    }
  }

  addPrimitive(type: PrimitiveType): void {
    const mesh = this.buildPrimitive(type);
    this.scene.add(mesh);
    this.setSelection(mesh);
    const primitiveLabel = this.getPrimitiveLabel(type);
    this.banner.emit({ type: 'success', text: `Se agregó ${primitiveLabel}` });
  }

  setBrush(brush: SculptBrush): void {
    this.activeBrush = brush;
    if (brush === 'none' && !this.isBrushing && this.orbitControls) {
      this.orbitControls.enabled = true;
    }
    if (brush === 'none') {
      this.endBrushSession();
    }
  }

  setBrushSettings(settings: { radius?: number; strength?: number }): void {
    if (typeof settings.radius === 'number') {
      this.brushRadius = settings.radius;
    }
    if (typeof settings.strength === 'number') {
      this.brushStrength = settings.strength;
    }
  }

  setSymmetry(symmetry: SculptSymmetry): void {
    this.symmetry = symmetry;
  }

  setMaterialPreset(preset: MaterialPreset, applyToSelection = true): void {
    this.materialPreset = preset;
    if (applyToSelection) {
      const mesh = this.getEditableMesh(this.selected);
      if (mesh) {
        this.applyMaterialPreset(mesh, preset);
      }
    }
  }

  setSnapToGround(state: boolean): void {
    this.snapToGround = state;
    if (state) {
      const mesh = this.getEditableMesh(this.selected);
      if (mesh) {
        mesh.position.y = Math.max(mesh.position.y, 0);
        mesh.updateMatrixWorld(true);
        this.emitSelectionState();
      }
    }
  }

  setBooleanMode(mode: BooleanMode): boolean {
    if (mode === 'none') {
      this.cancelBooleanMode();
      this.banner.emit({ type: 'success', text: 'Modo booleano desactivado' });
      return true;
    }
    const mesh = this.getEditableMesh(this.selected);
    if (!mesh) {
      this.banner.emit({
        type: 'error',
        text: 'Selecciona una malla antes de usar las herramientas booleanas',
      });
      return false;
    }
    this.booleanSource = mesh;
    this.booleanMode = mode;
    this.booleanModeChange.emit(this.booleanMode);
    this.banner.emit({
      type: 'success',
      text: `Selecciona otra malla para ${mode === 'union' ? 'unir' : 'restar'}`,
    });
    return true;
  }

  async applyModifier(action: ModifierAction): Promise<void> {
    const mesh = this.getEditableMesh(this.selected);
    if (!mesh) {
      this.banner.emit({
        type: 'error',
        text: 'Selecciona una malla antes de aplicar modificadores',
      });
      return;
    }
    try {
      if (action === 'subdivide') {
        mesh.geometry = subdivideGeometry(mesh.geometry as BufferGeometry);
        this.warnIfGeometryTooLarge(mesh.geometry as BufferGeometry);
      } else {
        this.applyBevelModifier(mesh);
      }
      const geometry = mesh.geometry as BufferGeometry;
      geometry.computeVertexNormals();
      geometry.computeBoundingSphere();
      const positionAttr = geometry.getAttribute('position');
      if (positionAttr) {
        positionAttr.needsUpdate = true;
      }
      this.banner.emit({
        type: 'success',
        text: `${action === 'subdivide' ? 'Subdivisión' : 'Bisel'} aplicado`,
      });
    } catch (error) {
      this.banner.emit({ type: 'error', text: 'El modificador falló' });
      console.error(error);
    }
  }

  duplicateSelection(): void {
    const mesh = this.getEditableMesh(this.selected);
    if (!mesh) {
      this.banner.emit({ type: 'error', text: 'Selecciona una malla para duplicar' });
      return;
    }
    const clone = mesh.clone(true);
    clone.traverse((child) => {
      if ((child as Mesh).isMesh) {
        const meshChild = child as Mesh;
        meshChild.geometry = (meshChild.geometry as BufferGeometry).clone();
      }
    });
    clone.position.add(new Vector3(0.75, 0, 0.75));
    if (this.snapToGround) {
      clone.position.y = Math.max(clone.position.y, 0);
    }
    this.prepareObject(clone);
    this.scene.add(clone);
    this.setSelection(clone);
    this.banner.emit({ type: 'success', text: 'Selección duplicada' });
  }

  setSelectionScale(scale: number): void {
    const mesh = this.getEditableMesh(this.selected);
    if (!mesh) {
      return;
    }
    mesh.scale.setScalar(scale);
    mesh.updateMatrix();
    this.emitSelectionState();
  }

  setSelectionY(yValue: number): void {
    const mesh = this.getEditableMesh(this.selected);
    if (!mesh) {
      return;
    }
    mesh.position.y = this.snapToGround ? Math.max(yValue, 0) : yValue;
    mesh.updateMatrixWorld(true);
    this.emitSelectionState();
  }

  setGridVisible(state: boolean): void {
    if (state && !this.gridHelper) {
      this.gridHelper = this.threeFactory.createGrid();
      this.scene.add(this.gridHelper);
    } else if (!state && this.gridHelper) {
      this.scene.remove(this.gridHelper);
      this.gridHelper = undefined;
    }
  }

  setAxesVisible(state: boolean): void {
    if (state && !this.axesHelper) {
      this.axesHelper = this.threeFactory.createAxes();
      this.scene.add(this.axesHelper);
    } else if (!state && this.axesHelper) {
      this.scene.remove(this.axesHelper);
      this.axesHelper = undefined;
    }
  }

  setLightsEnabled(state: boolean): void {
    if (state && !this.lightsGroup) {
      this.lightsGroup = this.threeFactory.createStudioLights();
      this.scene.add(this.lightsGroup);
    } else if (!state && this.lightsGroup) {
      this.scene.remove(this.lightsGroup);
      this.lightsGroup = undefined;
    }
  }

  resetCamera(): void {
    if (!this.orbitControls) {
      return;
    }
    this.threeFactory.frameScene(this.scene, this.camera, this.orbitControls.target);
    this.orbitControls.update();
  }

  async importFiles(fileLike: FileList | File[] | null): Promise<void> {
    if (!fileLike?.length) {
      return;
    }
    const files = Array.from(fileLike);
    for (const file of files) {
      try {
        await this.loadFile(file);
        this.banner.emit({ type: 'success', text: `${file.name} cargado` });
      } catch (error) {
        this.banner.emit({ type: 'error', text: `Error al cargar ${file.name}` });
        console.error(error);
      }
    }
  }

  async exportScene(format: ExportFormat): Promise<Blob> {
    if (format === 'glb') {
      // Loaders/exporters must be imported from 'three/examples/jsm/...'.
      const { GLTFExporter } = await import('three/examples/jsm/exporters/GLTFExporter.js');
      const exporter = new GLTFExporter();
      const arrayBuffer = await new Promise<ArrayBuffer>((resolve, reject) => {
        exporter.parse(
          this.scene,
          (result) => {
            if (result instanceof ArrayBuffer) {
              resolve(result);
            } else if (result instanceof Blob) {
              result.arrayBuffer().then(resolve, reject);
            } else {
              resolve(new TextEncoder().encode(JSON.stringify(result)).buffer);
            }
          },
          (error) => reject(error),
          { binary: true },
        );
      });
      return new Blob([arrayBuffer], { type: 'model/gltf-binary' });
    }

    const { STLExporter } = await import('three/examples/jsm/exporters/STLExporter.js');
    const exporter = new STLExporter();
    const result = exporter.parse(this.scene, { binary: false });
    return new Blob([result], { type: 'model/stl' });
  }

  handlePointerDown(event: PointerEvent): void {
    const hit = this.getPointerHit(event);
    if (!hit) {
      if (this.booleanMode !== 'none') {
        this.cancelBooleanMode();
      }
      this.clearSelection();
      return;
    }
    if (this.booleanMode !== 'none' && this.booleanSource && hit.mesh !== this.booleanSource) {
      this.performBooleanOperation(hit.mesh);
      return;
    }
    if (this.activeBrush !== 'none') {
      this.setSelection(hit.object);
      this.beginBrush(hit.point, hit.mesh, event);
      event.preventDefault();
      return;
    }
    this.setSelection(hit.object);
    const mesh = this.getEditableMesh(hit.object);
    if (mesh && !this.transformDragging) {
      this.beginPlaneDrag(mesh, hit.point, event);
    }
  }

  handlePointerMove(event: PointerEvent): void {
    if (this.isBrushing && this.activeBrush !== 'none') {
      const point = this.getBrushPoint(event);
      const mesh = this.getEditableMesh(this.selected);
      if (!point || !mesh) {
        this.endBrushSession();
        return;
      }
      const delta = new Vector3().subVectors(point, this.brushLastPoint);
      this.applyBrush(point, delta, mesh, this.brushLastPoint.clone());
      this.brushLastPoint.copy(point);
      event.preventDefault();
      return;
    }

    if (this.isPlaneDragging && event.pointerId === this.planeDragPointerId) {
      const mesh = this.getEditableMesh(this.selected);
      if (!mesh) {
        this.endPlaneDrag();
        return;
      }
      const planePoint = this.getPlaneIntersection(event, this.planeDragHeight);
      if (!planePoint) {
        return;
      }
      if (!this.planeDragStarted) {
        const dx = event.clientX - this.planeDragStart.x;
        const dy = event.clientY - this.planeDragStart.y;
        if (dx * dx + dy * dy < PLANE_DRAG_ACTIVATION_DISTANCE_SQ) {
          return;
        }
        this.planeDragStarted = true;
        this.containerRef.nativeElement.setPointerCapture?.(event.pointerId);
      }
      planePoint.add(this.planeDragOffset);
      if (this.snapToGround) {
        planePoint.y = Math.max(planePoint.y, 0);
      }
      mesh.position.copy(planePoint);
      this.transformControls?.object?.updateMatrixWorld(true);
      this.emitSelectionState();
      event.preventDefault();
      return;
    }
  }

  handlePointerUp(event?: PointerEvent): void {
    this.endBrushSession();
    this.endPlaneDrag();
  }

  handleDragOver(event: DragEvent): void {
    event.preventDefault();
  }

  async handleDrop(event: DragEvent): Promise<void> {
    event.preventDefault();
    const files = event.dataTransfer?.files;
    await this.importFiles(files ?? null);
  }

  private beginBrush(point: Vector3, mesh: Mesh, event: PointerEvent): void {
    this.isBrushing = true;
    this.brushPointerId = event.pointerId;
    this.brushLastPoint.copy(point);
    this.ensureEditableGeometry(mesh);
    this.orbitControls && (this.orbitControls.enabled = false);
    this.containerRef.nativeElement.setPointerCapture?.(event.pointerId);
    this.applyBrush(point, new Vector3(), mesh, point.clone());
  }

  private endBrushSession(): void {
    if (!this.isBrushing) {
      return;
    }
    if (this.brushPointerId !== null) {
      this.containerRef.nativeElement.releasePointerCapture?.(this.brushPointerId);
    }
    this.isBrushing = false;
    this.brushPointerId = null;
    this.orbitControls && (this.orbitControls.enabled = true);
  }

  private beginPlaneDrag(mesh: Mesh, point: Vector3, event: PointerEvent): void {
    this.isPlaneDragging = true;
    this.planeDragPointerId = event.pointerId;
    this.planeDragHeight = point.y;
    this.planeDragOffset.copy(mesh.position).sub(new Vector3(point.x, this.planeDragHeight, point.z));
    this.planeDragStarted = false;
    this.planeDragStart.set(event.clientX, event.clientY);
    this.orbitControls && (this.orbitControls.enabled = false);
  }

  private endPlaneDrag(): void {
    if (!this.isPlaneDragging) {
      return;
    }
    if (this.planeDragStarted && this.planeDragPointerId !== null) {
      this.containerRef.nativeElement.releasePointerCapture?.(this.planeDragPointerId);
    }
    this.isPlaneDragging = false;
    this.planeDragPointerId = null;
    this.planeDragStarted = false;
    this.orbitControls && (this.orbitControls.enabled = true);
  }

  private getBrushPoint(event: PointerEvent): Vector3 | null {
    const mesh = this.getEditableMesh(this.selected);
    if (!mesh) {
      return null;
    }
    this.updatePointer(event);
    const intersects = this.raycaster.intersectObject(mesh, true);
    return intersects[0]?.point.clone() ?? null;
  }

  private getPointerHit(event: PointerEvent): { object: Object3D; mesh: Mesh; point: Vector3 } | null {
    this.updatePointer(event);
    const intersects = this.raycaster.intersectObjects(this.getSelectableObjects(), true);
    if (!intersects.length) {
      return null;
    }
    const hit = intersects[0];
    const mesh = this.getEditableMesh(hit.object);
    if (!mesh) {
      return null;
    }
    return { object: hit.object, mesh, point: hit.point.clone() };
  }

  private updatePointer(event: PointerEvent): void {
    const canvas = this.canvasRef.nativeElement;
    const rect = canvas.getBoundingClientRect();
    this.pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this.pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    this.raycaster.setFromCamera(this.pointer, this.camera);
  }

  private getPlaneIntersection(event: PointerEvent, height: number): Vector3 | null {
    this.updatePointer(event);
    const origin = this.raycaster.ray.origin;
    const direction = this.raycaster.ray.direction;
    const denom = direction.y;
    if (Math.abs(denom) < 1e-5) {
      return null;
    }
    const t = (height - origin.y) / denom;
    if (t < 0) {
      return null;
    }
    return direction.clone().multiplyScalar(t).add(origin);
  }

  private applyBrush(point: Vector3, delta: Vector3, mesh: Mesh, previousPoint: Vector3): void {
    if (this.activeBrush === 'none') {
      return;
    }
    if (this.exceedsVertexBudget(mesh.geometry as BufferGeometry)) {
      this.banner.emit({
        type: 'error',
        text: 'La malla es demasiado densa; reduce las subdivisiones antes de seguir esculpiendo',
      });
      return;
    }
    const geometry = this.ensureEditableGeometry(mesh);
    let normalAttr = this.ensureBufferAttribute(geometry, 'normal');
    if (!normalAttr) {
      geometry.computeVertexNormals();
      normalAttr = this.ensureBufferAttribute(geometry, 'normal');
    }
    const positionAttr = this.ensureBufferAttribute(geometry, 'position');
    if (!positionAttr) {
      return;
    }
    mesh.updateMatrixWorld(true);

    const variants = this.createSymmetryVariants(point, delta, previousPoint);
    for (const variant of variants) {
      this.applyBrushVariant(variant.point, variant.delta, variant.previousPoint, mesh, positionAttr, normalAttr);
    }

    positionAttr.needsUpdate = true;
    geometry.computeVertexNormals();
    geometry.computeBoundingSphere();
    this.warnIfGeometryTooLarge(geometry);
  }

  private applyBrushVariant(
    point: Vector3,
    delta: Vector3,
    previousPoint: Vector3,
    mesh: Mesh,
    positionAttr: BufferAttribute,
    normalAttr: BufferAttribute | null,
  ): void {
    const worldVertex = new Vector3();
    const vertex = new Vector3();
    const normal = new Vector3();
    const localPoint = mesh.worldToLocal(point.clone());
    const localDelta = delta.lengthSq() > 0 ? this.worldDeltaToLocal(mesh, delta, previousPoint) : new Vector3();

    for (let i = 0; i < positionAttr.count; i++) {
      vertex.fromBufferAttribute(positionAttr, i);
      worldVertex.copy(vertex).applyMatrix4(mesh.matrixWorld);
      const distance = worldVertex.distanceTo(point);
      if (distance > this.brushRadius) {
        continue;
      }
      const falloff = 1 - distance / this.brushRadius;
      if (this.activeBrush === 'grab') {
        vertex.addScaledVector(localDelta, falloff);
      } else if (this.activeBrush === 'inflate') {
        if (normalAttr) {
          normal.fromBufferAttribute(normalAttr, i).normalize();
        } else {
          normal.set(0, 1, 0);
        }
        vertex.addScaledVector(normal, this.brushStrength * falloff);
      } else if (this.activeBrush === 'smooth') {
        vertex.lerp(localPoint, this.brushStrength * falloff);
      }
      positionAttr.setXYZ(i, vertex.x, vertex.y, vertex.z);
    }
  }

  private worldDeltaToLocal(mesh: Mesh, delta: Vector3, previousPoint: Vector3): Vector3 {
    const from = mesh.worldToLocal(previousPoint.clone());
    const toWorld = previousPoint.clone().add(delta);
    const to = mesh.worldToLocal(toWorld);
    return to.sub(from);
  }

  private ensureEditableGeometry(mesh: Mesh): BufferGeometry {
    let geometry = mesh.geometry as BufferGeometry;
    if (geometry.index) {
      geometry = geometry.toNonIndexed();
      mesh.geometry = geometry;
    }
    return geometry;
  }

  private ensureBufferAttribute(
    geometry: BufferGeometry,
    key: string,
  ): BufferAttribute | null {
    const attribute = geometry.getAttribute(key);
    if (!attribute) {
      return null;
    }
    if (attribute instanceof BufferAttribute) {
      return attribute;
    }
    if (this.isInterleavedAttribute(attribute)) {
      const converted = attribute.clone();
      geometry.setAttribute(key, converted);
      return converted;
    }
    return null;
  }

  private isInterleavedAttribute(
    attribute: BufferAttribute | InterleavedBufferAttribute,
  ): attribute is InterleavedBufferAttribute {
    return (attribute as InterleavedBufferAttribute).isInterleavedBufferAttribute === true;
  }

  private createSymmetryVariants(point: Vector3, delta: Vector3, previousPoint: Vector3): Array<{
    point: Vector3;
    delta: Vector3;
    previousPoint: Vector3;
  }> {
    const variants = [
      {
        point: point.clone(),
        delta: delta.clone(),
        previousPoint: previousPoint.clone(),
      },
    ];
    const axes = this.getSymmetryAxes();
    for (const axis of axes) {
      const current = [...variants];
      for (const variant of current) {
        const mirroredPoint = variant.point.clone();
        const mirroredDelta = variant.delta.clone();
        const mirroredPrev = variant.previousPoint.clone();
        this.mirrorVector(mirroredPoint, axis);
        this.mirrorVector(mirroredDelta, axis);
        this.mirrorVector(mirroredPrev, axis);
        variants.push({
          point: mirroredPoint,
          delta: mirroredDelta,
          previousPoint: mirroredPrev,
        });
      }
    }
    return variants;
  }

  private getSymmetryAxes(): Array<'x' | 'y' | 'z'> {
    switch (this.symmetry) {
      case 'x':
        return ['x'];
      case 'y':
        return ['y'];
      case 'z':
        return ['z'];
      case 'xy':
        return ['x', 'y'];
      case 'xz':
        return ['x', 'z'];
      case 'yz':
        return ['y', 'z'];
      default:
        return [];
    }
  }

  private mirrorVector(vector: Vector3, axis: 'x' | 'y' | 'z'): void {
    if (axis === 'x') {
      vector.x *= -1;
    } else if (axis === 'y') {
      vector.y *= -1;
    } else {
      vector.z *= -1;
    }
  }

  private emitSelectionState(): void {
    const mesh = this.getEditableMesh(this.selected);
    if (!mesh) {
      this.selectionStateChange.emit({ hasSelection: false, scale: 1, y: 0 });
      return;
    }
    const scale = (mesh.scale.x + mesh.scale.y + mesh.scale.z) / 3;
    this.selectionStateChange.emit({
      hasSelection: true,
      scale: Number(scale.toFixed(2)),
      y: Number(mesh.position.y.toFixed(2)),
    });
  }

  private getEditableMesh(object: Object3D | null): Mesh | null {
    const target = this.findMeshAncestor(object);
    if (target && (target as Mesh).isMesh && !target.userData?.['helper']) {
      return target as Mesh;
    }
    return null;
  }

  private applyBevelModifier(mesh: Mesh): void {
    const geometry = this.ensureEditableGeometry(mesh);
    let normalAttr = this.ensureBufferAttribute(geometry, 'normal');
    if (!normalAttr) {
      geometry.computeVertexNormals();
      normalAttr = this.ensureBufferAttribute(geometry, 'normal');
    }
    const positionAttr = this.ensureBufferAttribute(geometry, 'position');
    if (!positionAttr) {
      return;
    }
    const vertex = new Vector3();
    const normal = new Vector3();
    const intensity = this.brushStrength * 0.5;
    for (let i = 0; i < positionAttr.count; i++) {
      vertex.fromBufferAttribute(positionAttr, i);
      if (normalAttr) {
        normal.fromBufferAttribute(normalAttr, i).normalize();
      } else {
        normal.set(0, 1, 0);
      }
      vertex.addScaledVector(normal, intensity);
      positionAttr.setXYZ(i, vertex.x, vertex.y, vertex.z);
    }
    positionAttr.needsUpdate = true;
    this.warnIfGeometryTooLarge(geometry);
  }

  private performBooleanOperation(targetMesh: Mesh): void {
    void this.runBooleanOperation(targetMesh);
  }

  private async runBooleanOperation(targetMesh: Mesh): Promise<void> {
    if (!this.booleanSource) {
      return;
    }
    try {
      const sourceMesh = this.booleanSource;
      sourceMesh.updateMatrixWorld(true);
      targetMesh.updateMatrixWorld(true);
      const sourceCSG = SimpleCSG.fromMesh(sourceMesh);
      const targetCSG = SimpleCSG.fromMesh(targetMesh);
      const resultCSG =
        this.booleanMode === 'union'
          ? sourceCSG.union(targetCSG)
          : sourceCSG.subtract(targetCSG);
      const resultGeometry = SimpleCSG.toMesh(resultCSG, sourceMesh.matrixWorld);
      this.warnIfGeometryTooLarge(resultGeometry);
      const resultMesh = new Mesh(resultGeometry, (sourceMesh as Mesh).material);
      resultMesh.castShadow = true;
      resultMesh.receiveShadow = true;
      resultMesh.position.copy(sourceMesh.position);
      resultMesh.quaternion.copy(sourceMesh.quaternion);
      resultMesh.scale.copy(sourceMesh.scale);
      this.scene.remove(sourceMesh);
      this.scene.remove(targetMesh);
      this.scene.add(resultMesh);
      this.setSelection(resultMesh);
      this.banner.emit({ type: 'success', text: 'Operación booleana aplicada' });
    } catch (error) {
      this.banner.emit({ type: 'error', text: 'Operación booleana fallida' });
      console.error(error);
    } finally {
      this.cancelBooleanMode();
    }
  }

  private cancelBooleanMode(): void {
    this.booleanSource = null;
    if (this.booleanMode !== 'none') {
      this.booleanMode = 'none';
      this.booleanModeChange.emit('none');
    }
  }

  private exceedsVertexBudget(geometry: BufferGeometry): boolean {
    const count = geometry.getAttribute('position')?.count ?? 0;
    return count > MAX_VERTEX_COUNT;
  }

  private warnIfGeometryTooLarge(geometry: BufferGeometry): void {
    if (this.exceedsVertexBudget(geometry)) {
      this.banner.emit({
        type: 'error',
        text: 'La malla supera el conteo seguro de vértices; las exportaciones pueden ser inestables',
      });
    }
  }

  private applyMaterialPreset(mesh: Mesh, preset: MaterialPreset): void {
    mesh.traverse((child) => {
      if ((child as Mesh).isMesh) {
        (child as Mesh).material = this.createMaterialFromPreset(preset);
      }
    });
  }

  private createMaterialFromPreset(preset: MaterialPreset): MeshStandardMaterial {
    const config = MATERIAL_PRESETS[preset];
    return new MeshStandardMaterial({
      color: config.color,
      metalness: config.metalness,
      roughness: config.roughness,
      wireframe: config.wireframe ?? false,
      transparent: preset === 'glass',
      opacity: preset === 'glass' ? 0.5 : 1,
    });
  }

  private setupScene(): void {
    const canvas = this.canvasRef.nativeElement;
    this.renderer = this.threeFactory.createRenderer(canvas);
    this.scene = new Scene();
    this.threeFactory.setSceneBackground(this.scene);
    this.camera = this.threeFactory.createCamera(this.getAspect());
    this.setGridVisible(true);
    this.setAxesVisible(true);
    this.setLightsEnabled(true);
  }

  private async setupControls(): Promise<void> {
    // Note: controls also come from 'three/examples/jsm/...'.
    const [{ OrbitControls }, { TransformControls }] = await Promise.all([
      import('three/examples/jsm/controls/OrbitControls.js'),
      import('three/examples/jsm/controls/TransformControls.js'),
    ]);
    this.orbitControls = new OrbitControls(this.camera, this.renderer.domElement);
    this.orbitControls.enableDamping = true;

    this.transformControls = new TransformControls(this.camera, this.renderer.domElement);
    this.transformControls.addEventListener(
      'dragging-changed',
      (event: TransformControlsEventMap['dragging-changed']) => {
        this.transformDragging = Boolean((event as unknown as { value: boolean }).value);
        if (this.orbitControls) {
          this.orbitControls.enabled = !event.value;
        }
      },
    );
    this.transformControls.addEventListener('objectChange', () => this.invalidate());
    // Cast is necessary because TransformControls type definition does not extend Object3D.
    this.scene.add(this.transformControls as unknown as Object3D);
    this.resetCamera();
  }

  private setupResizeObserver(): void {
    const container = this.containerRef.nativeElement;
    this.resizeObserver = new ResizeObserver(() => {
      const { clientWidth, clientHeight } = container;
      this.camera.aspect = clientWidth / clientHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(clientWidth, clientHeight, false);
    });
    this.resizeObserver.observe(container);
  }

  private startRenderLoop(): void {
    const render = () => {
      this.frameHandle = requestAnimationFrame(render);
      this.orbitControls?.update();
      this.renderer.render(this.scene, this.camera);
      this.frames++;
      const now = performance.now();
      if (now - this.lastStatsAt >= 1000) {
        const fps = Math.round((this.frames * 1000) / (now - this.lastStatsAt));
        this.frames = 0;
        this.lastStatsAt = now;
        const triangles = this.renderer.info?.render?.triangles ?? 0;
        this.statsChange.emit({ fps, triangles });
      }
    };
    render();
  }

  private buildPrimitive(type: PrimitiveType): Mesh {
    let geometry;
    switch (type) {
      case 'sphere':
        geometry = new SphereGeometry(1, 32, 32);
        break;
      case 'cylinder':
        geometry = new CylinderGeometry(0.75, 0.75, 2, 32);
        break;
      default:
        geometry = new BoxGeometry(1.5, 1.5, 1.5);
    }
    const material = this.createMaterialFromPreset(this.materialPreset);
    const mesh = new Mesh(geometry, material);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.position.set(0, 1, 0);
    return mesh;
  }

  private getPrimitiveLabel(type: PrimitiveType): string {
    switch (type) {
      case 'box':
        return 'un cubo';
      case 'sphere':
        return 'una esfera';
      case 'cylinder':
        return 'un cilindro';
      default:
        return 'una figura';
    }
  }

  private getAspect(): number {
    const container = this.containerRef.nativeElement;
    return container.clientWidth / container.clientHeight || 1;
  }

  private invalidate(): void {
    // Placeholder for additional reactivity hooks if needed later.
  }

  private getSelectableObjects(): Object3D[] {
    return this.scene.children.filter((child) => !child.userData?.['helper']);
  }

  private setSelection(object: Object3D): void {
    const target = this.findMeshAncestor(object);
    if (!target) {
      return;
    }
    this.selected = target;
    this.transformControls?.attach(target);
    if (this.booleanMode !== 'none') {
      const mesh = this.getEditableMesh(target);
      if (mesh) {
        this.booleanSource = mesh;
      } else {
        this.cancelBooleanMode();
      }
    }
    this.emitSelectionState();
  }

  private clearSelection(): void {
    this.selected = null;
    this.transformControls?.detach();
    this.cancelBooleanMode();
    this.emitSelectionState();
  }

  private findMeshAncestor(object: Object3D | null): Object3D | null {
    let current: Object3D | null = object;
    while (current && current !== this.scene) {
      if (!current.userData?.['helper']) {
        return current;
      }
      current = current.parent;
    }
    return null;
  }

  private handleKeyDown = (event: KeyboardEvent): void => {
    if (!this.transformControls) {
      return;
    }
    if (event.key === 'g' || event.key === 'G') {
      this.transformControls.setMode('translate');
    } else if (event.key === 'r' || event.key === 'R') {
      this.transformControls.setMode('rotate');
    } else if (event.key === 's' || event.key === 'S') {
      this.transformControls.setMode('scale');
    } else if (event.key === 'Delete' || event.key === 'Backspace') {
      if (this.selected) {
        this.scene.remove(this.selected);
        this.banner.emit({ type: 'success', text: 'Malla eliminada' });
        this.clearSelection();
      }
    } else if (event.key === 'Escape') {
      this.clearSelection();
      this.transformControls.setMode('translate');
    }
  };

  private removeEditableObjects(): void {
    this.scene.children
      .filter((child) => !child.userData?.['helper'])
      .forEach((child) => this.scene.remove(child));
    this.clearSelection();
  }

  private prepareObject(object: Object3D): void {
    object.traverse((child) => {
      if ((child as Mesh).isMesh) {
        const mesh = child as Mesh;
        mesh.castShadow = true;
        mesh.receiveShadow = true;
      }
    });
  }

  private async loadFile(file: File): Promise<void> {
    const ext = file.name.split('.').pop()?.toLowerCase();
    if (!ext) {
      throw new Error('Extensión ausente');
    }
    switch (ext) {
      case 'glb':
      case 'gltf':
        await this.loadGltf(file);
        break;
      case 'obj':
        await this.loadObj(file);
        break;
      case 'stl':
        await this.loadStl(file);
        break;
      default:
        throw new Error(`Unsupported type: ${ext}`);
    }
  }

  private async loadGltf(file: File): Promise<void> {
    const { GLTFLoader } = await import('three/examples/jsm/loaders/GLTFLoader.js'); // Use examples loaders.
    const loader = new GLTFLoader();
    const url = URL.createObjectURL(file);
    try {
      const gltf = await loader.loadAsync(url);
      const root = gltf.scene ?? gltf.scenes?.[0];
      if (root) {
        this.normalizeObject(root);
        this.prepareObject(root);
        this.scene.add(root);
        this.setSelection(root);
      }
    } finally {
      URL.revokeObjectURL(url);
    }
  }

  private async loadObj(file: File): Promise<void> {
    const { OBJLoader } = await import('three/examples/jsm/loaders/OBJLoader.js');
    const text = await file.text();
    const root = new OBJLoader().parse(text);
    this.normalizeObject(root);
    this.prepareObject(root);
    this.scene.add(root);
    this.setSelection(root);
  }

  private async loadStl(file: File): Promise<void> {
    const { STLLoader } = await import('three/examples/jsm/loaders/STLLoader.js');
    const geometry = new STLLoader().parse(await file.arrayBuffer());
    const mesh = new Mesh(
      geometry,
      new MeshStandardMaterial({ color: '#fef3c7', metalness: 0, roughness: 0.8 }),
    );
    this.normalizeObject(mesh);
    this.prepareObject(mesh);
    this.scene.add(mesh);
    this.setSelection(mesh);
  }

  private normalizeObject(object: Object3D): void {
    const box = new Box3().setFromObject(object);
    const size = box.getSize(new Vector3());
    const maxAxis = Math.max(size.x, size.y, size.z) || 1;
    const scale = 5 / maxAxis;
    object.scale.multiplyScalar(scale);
    box.setFromObject(object);
    const center = box.getCenter(new Vector3());
    object.position.sub(center);
  }
}
