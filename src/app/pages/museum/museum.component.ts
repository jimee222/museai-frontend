import { Component, ElementRef, OnDestroy, OnInit, ViewChild, effect } from '@angular/core';
import * as THREE from 'three';
import { PointerLockControls } from 'three/examples/jsm/controls/PointerLockControls.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { CommonModule } from '@angular/common';
import { CmaService } from '../../services/cma.service';
import { DescriptionTranslationService } from '../../services/description-translation.service';
import { LanguagePreferenceService } from '../../services/language-preference.service';
import { HttpClient } from '@angular/common/http';
import { TourService } from '../../services/tour.service';
import { LanguageSelectorComponent } from "../../shared/language-selector/language-selector.component";
import { AuthService } from '../../services/auth.service';
import { Router } from '@angular/router';


// Datos que usa el popup de curaduría (todos vienen de la CMA API)
interface ArtworkPopupData {
  id: string;
  title: string;
  artist: string;
  year?: string;
  technique?: string;
  description?: string;
  image: string; 
}


interface PaintingMeta {
  description: string;
  previewDataUrl: string;
}
interface PaintingResponse {
  id: string;
  name: string;
  metadata: string | null;
  sceneJson: string;
  createdAt: string;
  updatedAt: string;
}

interface SculptureResponse {
  id: string;
  name: string;
  metadata: string | null;
  sceneJson: string | null;
  createdAt: string;
  updatedAt: string;
}

interface SculptureMeta {
  glbUrl?: string;
  scale?: number;
  rotY?: number;
  offsetY?: number;
}
type SculptureWithGlb = SculptureMeta & { glbUrl: string };



@Component({
  selector: 'app-museum',
  standalone: true,
  imports: [CommonModule, LanguageSelectorComponent],
  templateUrl: './museum.component.html',
  styleUrls: ['./museum.component.css'],
  
})



export class MuseumComponent implements OnInit, OnDestroy {
  @ViewChild('langsel') languageSelector!: LanguageSelectorComponent;
  @ViewChild('miniMapCanvas', { static: false })
  private miniCtx!: CanvasRenderingContext2D;
  private miniMapReady = false;
  public showSavedPopup = false;
  public savedPopupText = "";
  resumeIndex: number = 0;
  public savedResumeIndex: number | null = null;
  public showResumePopup = false;
  public showTourCompletedPopup = false;

  private readonly mapMinX = -10;
  private readonly mapMaxX =  10;
  private readonly mapMinZ = -10;
  private readonly mapMaxZ =  10;

  miniMapCanvas !: ElementRef<HTMLCanvasElement>;
  getTimelineProgress(): number {
  const idx = this.tour.currentIndex();
  const total = this.TOUR_ORDER.length;
  if (!total) return 0;
  return ((idx + 1) / total) * 100;
}

  getCategoryOfCurrentArtwork(): string {
    const id = this.TOUR_ORDER[this.tour.currentIndex()];
    if (!id) return "";

    if (['141639', '93014', '135483', '151298', '125249'].includes(id)) {
      return "Paisajes";
    }
    if (['170235', '111702', '135428'].includes(id)) {
      return "Históricas";
    }
    if (['132618', '115067', '1953.155', '380063', '135614'].includes(id)) {
      return "Flores";
    }
    if (['2009.157', '1921.1239', '1921.428', '1942.638'].includes(id)) {
      return "Retratos";
    }

    return "Obra";
  }

  startGuidedTour() {
    const saved = localStorage.getItem('tour-progress');

    if (saved) {
      const idx = parseInt(saved, 10);
      this.savedResumeIndex = idx;

      const artworkId = this.TOUR_ORDER[idx];
      const category = this.getCategoryOfCurrentArtwork();

      this.savedPopupText = `¿Deseas continuar desde la obra ${artworkId} (${category})?`;
      this.showTourDialog = false;
      this.showResumePopup = true;
      return;

    }

    this.startTourFromBeginning();
  }

  startTourFromBeginning() {
    this.showResumePopup = false;
    this.showTourDialog = false;

    this.camera.rotation.set(0, 0, 0);

    const tourPoints = this.generateTourPointsForArtworkOrder(this.TOUR_ORDER);
    this.tour.setup(tourPoints);

    this.tour.start();
    this.disablePlayerMovement();
  }


  continueSavedTour() {
    if (this.savedResumeIndex === null) return;

    this.showResumePopup = false;
    this.showTourDialog = false;

    const tourPoints = this.generateTourPointsForArtworkOrder(this.TOUR_ORDER);
    this.tour.setup(tourPoints);
    this.tour.onTourFinished = () => this.finishTour();

    const p = tourPoints[this.savedResumeIndex];

    this.camera.rotation.set(0, p.rotY, 0);
    this.camera.position.set(p.x, p.y, p.z);

    this.tour.startFrom(this.savedResumeIndex);
    this.disablePlayerMovement();
  }

  finishTour() {
    this.enablePlayerMovement();

    this.showTourCompletedPopup = true;

    this.tour.stop();
  }



private generateTourPointsForArtworkOrder(order: string[]): any[] {
  const idToFrame = new Map<string, THREE.Mesh>();

  for (const frame of this.artFrames) {
    const tid = frame.userData['tourId'] as string | undefined;
    if (tid) idToFrame.set(tid, frame);
  }

  const points: any[] = [];
  const offset = 1.6;
  const camY = 1.7;

  for (const id of order) {
    const frame = idToFrame.get(id);
    if (!frame) continue;

    const wp = new THREE.Vector3();
    frame.getWorldPosition(wp);

    const rotY = frame.rotation.y;
    const normal = new THREE.Vector3(
      Math.sin(rotY),
      0,
      Math.cos(rotY)
    ).normalize();

    const camPos = wp.clone().add(normal.multiplyScalar(offset));

    const lookVec = wp.clone().sub(camPos);
    lookVec.y = 0;
    lookVec.normalize();

    const yaw = Math.atan2(-lookVec.x, -lookVec.z);

    points.push({
      x: camPos.x,
      y: camY,
      z: camPos.z,
      rotY: yaw,
    });
  }

  return points;
}


logoutFromMuseum() {
  this.authService.logout();
  this.router.navigate(['/login']);
}

enterFreeMode() {
  this.showTourDialog = false;
  this.tour.stop();
  this.enablePlayerMovement();
}

stopTour() {
  const index = this.tour.currentIndex();
  localStorage.setItem('tour-progress', index.toString());

  const artworkId = this.TOUR_ORDER[index];
  const category = this.getCategoryOfCurrentArtwork();

  this.savedPopupText = `Tu recorrido se guardó en la obra ${artworkId} (${category}).`;
  this.showSavedPopup = true;

  this.tour.stop();
  this.enablePlayerMovement();
}


private disablePlayerMovement() {
  this.movementEnabled = false;
  this.velocity.set(0, 0, 0);
}

private enablePlayerMovement() {
  this.movementEnabled = true;
}

  //  THREE.js core
  private scene!: THREE.Scene;
  private camera!: THREE.PerspectiveCamera;
  private renderer!: THREE.WebGLRenderer;
  private controls!: PointerLockControls;
  private clock = new THREE.Clock();
  private velocity = new THREE.Vector3();
  private direction = new THREE.Vector3();
  private moveForward = false;
  private moveBackward = false;
  private moveLeft = false;
  private moveRight = false;
  private readonly PLAYER_RADIUS = 0.35;
  private minX = -9.3; private maxX =  9.3;
  private minZ = -9.3; private maxZ =  9.3;
  private playerRadius = 0.35;
  private colliders: THREE.Box3[] = [];
  private walls: THREE.Mesh[] = [];

  private artFrames: THREE.Mesh[] = [];
  private userFrames: THREE.Mesh[] = [];
  private sculptureGroups: THREE.Group[] = [];
 private readonly API_SCULPT = 'http://localhost:8080/api/sculptures';

  private room2NorthWall!: THREE.Mesh;

  private proximityDistance = 2.0;
  private activeFrame: THREE.Mesh | null = null;

  public currentArtwork: ArtworkPopupData | null = null;
  public isPopupVisible = false;
  public translatedDescription: string | null = null;
  public translationError: string | null = null;
  public isTranslating = false;
  showTourStartPopup: any;
  tourActive: any;
  showTourDialog = true;
  movementEnabled = true;
  private readonly tourLerpSpeed = 0.02;


  constructor(
    private cmaService: CmaService,
    private readonly translationService: DescriptionTranslationService,
    private readonly languagePreference: LanguagePreferenceService,
    private http: HttpClient,
    public tour: TourService,
    private authService: AuthService,
    private router: Router,

  ) {
    effect(() => {
      const lang = this.languagePreference.language();
      if (this.isPopupVisible && this.currentArtwork?.description && lang) {
        this.translateCurrentArtwork();
      }
    });
  }
  //  Geometría Sala 2 ( colgar los canvas del usuario)
  private room2Width = 0;
  private room2Depth = 0;
  private room2H = 0;
  private room2CenterX = 0;
  private room2CenterZ = 0;
  private readonly API_BASE = 'http://localhost:8080/api/paintings';

    // Interacción pared-menú
  private raycaster = new THREE.Raycaster();
  private interactables: THREE.Mesh[] = [];
  private hovered?: THREE.Mesh; // para resaltar
  private hintEl!: HTMLDivElement;

  ngOnInit(): void {
  this.initScene();
  this.animate();
  this.enablePlayerMovement();
  this.showTourDialog = false;

  this.addEventListeners();

  // Hint "Presione F"
  this.hintEl = document.createElement('div');
  this.hintEl.textContent = 'Presione F para interactuar';
  this.hintEl.style.position = 'fixed';
  this.hintEl.style.left = '50%';
  this.hintEl.style.bottom = '6%';
  this.hintEl.style.transform = 'translateX(-50%)';
  this.hintEl.style.padding = '10px 16px';
  this.hintEl.style.borderRadius = '10px';
  this.hintEl.style.fontFamily = 'system-ui, sans-serif';
  this.hintEl.style.fontWeight = '700';
  this.hintEl.style.letterSpacing = '.3px';
  this.hintEl.style.fontSize = '14px';
  this.hintEl.style.background = 'rgba(0,0,0,.55)';
  this.hintEl.style.color = '#f5e1ce';
  this.hintEl.style.border = '1px solid #f5e1ce';
  this.hintEl.style.pointerEvents = 'none';
  this.hintEl.style.userSelect = 'none';
  this.hintEl.style.opacity = '0';
  this.hintEl.style.transition = 'opacity .18s ease';
  document.body.appendChild(this.hintEl);
}

  // IDs de la pared del fondo (históricas)
  private readonly BACK_WALL_IDS = ['170235', '111702', '135428'];

  // Orden curatorial del tour
  public readonly TOUR_ORDER: string[] = [
    // 1–5: pasillo izquierdo (paisajes)
    '141639', '93014', '135483', '151298', '125249',

    // 6–8: pared del fondo (históricas)
    '170235', '111702', '135428',

    // 9–13: pasillo derecho (flores)
    '132618', '115067', '1953.155', '380063', '135614',

    // 14–17: muros internos (retratos/personas)
    '2009.157', '1921.1239', '1921.428', '1942.638',
  ];
  ngAfterViewInit(): void {
  if (this.miniMapCanvas) {
    const canvas = this.miniMapCanvas.nativeElement;
    const ctx = canvas.getContext('2d');

    if (ctx) {
      this.miniCtx = ctx;
      this.miniMapReady = true;
    }
  }
}

  ngOnDestroy(): void {
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    window.removeEventListener('resize', this.onResize);
    if (this.hintEl?.parentNode) this.hintEl.parentNode.removeChild(this.hintEl);
  }

  //HELPERS DE CURADURÍA

  private updateTourMovement() {
  if (!this.tour.isActive() || this.tour.isPaused()) return;

  const p = this.tour.currentPoint();
  if (!p) return;

  const target = new THREE.Vector3(p.x, p.y, p.z);

  this.camera.position.lerp(target, this.tourLerpSpeed);

  const targetRot = p.rotY;
  this.camera.rotation.y += (targetRot - this.camera.rotation.y) * 0.05;
  }


  /** Maping del JSON de CMA a la estructura del popup */
  private mapCmaToPopup(data: any, imageUrl: string): ArtworkPopupData {
    const id = String(data?.id ?? data?.objectID ?? data?.object_id ?? '');

    const title: string = data?.title || 'Untitled';

    let artist = 'Unknown artist';
    if (Array.isArray(data?.creators) && data.creators.length > 0) {
      artist =
        data.creators[0].description ||
        data.creators[0].name ||
        artist;
    } else if (typeof data?.creators === 'string') {
      artist = data.creators;
    } else if (data?.artist) {
      artist = data.artist;
    }

    const year: string =
      data?.creation_date ||
      data?.creation_date_earliest ||
      data?.creation_date_latest ||
      data?.date ||
      '';

    const technique: string | undefined =
      data?.technique ||
      data?.work_type ||
      data?.type ||
      undefined;

    const description: string | undefined =
      data?.description ||
      data?.wall_description ||
      data?.didactic_text ||
      undefined;

    return {
      id,
      title,
      artist,
      year,
      technique,
      description,
      image: imageUrl,
    };

  }



  //  MARCOS / CUADROS

private resolveCollisions(attempt: THREE.Vector3) {
  const out = attempt.clone();
  const playerTop = 1.8; 

  for (const wall of this.walls) {
    const box = new THREE.Box3().setFromObject(wall);

    if (box.min.y > playerTop) continue;

    const min = box.min, max = box.max;
    this.pushOutFromAABBXZ(out, min.x, max.x, min.z, max.z);
  }

  return out;
}

private repaintGroup(root: THREE.Object3D, color: THREE.ColorRepresentation) {
  root.traverse(o => {
    if ((o as THREE.Mesh).isMesh) {
      const m = o as THREE.Mesh;
      m.material = new THREE.MeshStandardMaterial({
        color,
        roughness: 0.85,
        metalness: 0.0
      });
      m.castShadow = true;
      m.receiveShadow = true;
    }
  });
}

private tryWallInteract() {
  const dir = new THREE.Vector3();
  this.camera.getWorldDirection(dir);
  this.raycaster.set(this.camera.position, dir.normalize());

  const hits = this.raycaster.intersectObjects(this.interactables, false);
  if (!hits.length) return;

  const hit = hits[0];
  if (hit.distance > 4.0) return;

  const route: string | undefined = hit.object.userData['route'];
  if (!route) return;

  if (route === 'start-tour') {
    this.showTourDialog = true;
    return;
  }
  if (route === '_openTourDialog_') {
    this.showTourDialog = true;
    return;
  }
  if (route === '_openLanguageSelector_') {
    this.languageSelector.openModal();
    return;
  }
  if (route === '_logout_') {
    this.logoutFromMuseum();
    return;
}

  try {
    window.location.href = route;
  } catch {
    window.location.href = route;
  }
}


private recenterXZInParent(obj: THREE.Object3D, parent: THREE.Object3D) {
  const box = new THREE.Box3().setFromObject(obj);
  const worldCenter = new THREE.Vector3();
  box.getCenter(worldCenter);

  const localCenter = worldCenter.clone();
  parent.worldToLocal(localCenter);

  obj.position.x -= localCenter.x;
  obj.position.z -= localCenter.z;
}



private addColliderFromObject(obj: THREE.Object3D, inflate: number | THREE.Vector3 = 0) {
  obj.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(obj);

  if (typeof inflate === 'number' && inflate > 0) {
    box.expandByScalar(inflate);
  } else if (inflate instanceof THREE.Vector3) {
    box.expandByVector(inflate);
  }

  this.colliders.push(box);
}

  private parsePaintingMeta(raw: string | null | undefined): PaintingMeta {
    if (!raw) return { description: '', previewDataUrl: '' };
    try {
      const m = JSON.parse(raw);
      return {
        description: typeof m.description === 'string' ? m.description : '',
        previewDataUrl: typeof m.previewDataUrl === 'string' ? m.previewDataUrl : '',
      };
    } catch {
      return { description: '', previewDataUrl: '' };
    }
  }

  private skinFrameFrontWithImage(frame: THREE.Mesh, imgUrl: string) {
    const loader = new THREE.TextureLoader();
    loader.load(
      imgUrl,
      (texture) => {
        const img = texture.image as HTMLImageElement;
        const aspect = img.width / img.height;

        const box = frame.geometry as THREE.BoxGeometry;
        const frameW = box.parameters.width ?? 2.8;
        const frameH = box.parameters.height ?? 3.0;

        const innerW = frameW * 0.9;
        const innerH = frameH * 0.9;
        const innerAspect = innerW / innerH;

        let artW: number, artH: number;
        if (aspect > innerAspect) { artH = innerH; artW = innerH * aspect; }
        else { artW = innerW; artH = innerW / aspect; }

        const mats = (frame.material as THREE.Material[]).slice();
        mats[4] = new THREE.MeshStandardMaterial({ map: texture, side: THREE.FrontSide });
        frame.material = mats;
      },
      undefined,
      (err) => console.error('Error cargando textura de canvas del usuario', err)
    );
  }

  private stripForeignLighting(root: THREE.Object3D) {
  const toRemove: THREE.Object3D[] = [];
  root.traverse((o) => {
    if ((o as any).isLight || (o as any).isLightProbe) {
      toRemove.push(o);
    }
    if ((o as THREE.Mesh).isMesh) {
      const m = (o as THREE.Mesh).material as THREE.Material | THREE.Material[];
      const fix = (mat: THREE.Material) => {
        if ((mat as any).emissive) {
          (mat as any).emissiveIntensity = Math.min((mat as any).emissiveIntensity ?? 1, 0.2);
        }
        if ((mat as any).isMeshBasicMaterial) {
        }
      };
      Array.isArray(m) ? m.forEach(fix) : fix(m);
    }
  });
  toRemove.forEach(n => n.parent?.remove(n));
}

 private mountUserCanvasesOnRoom2WestWall() {
  if (!this.room2Depth || !this.room2NorthWall) return;

  for (const f of this.userFrames) {
    f.parent?.remove(f);
    const i = this.artFrames.indexOf(f);
    if (i >= 0) this.artFrames.splice(i, 1);
  }
  this.userFrames = [];

  this.http.get<PaintingResponse[]>(this.API_BASE).subscribe({
    next: (list) => {
      const previews = list
        .map(p => this.parsePaintingMeta(p.metadata).previewDataUrl)
        .filter((u): u is string => !!u);

      const maxSlots = 6;
      const count = Math.min(previews.length, maxSlots);
      if (!count) return;

      const FRAME = { w: 1.60, h: 1.80, d: 0.08 };
      const RZ = 0.30;
      const RY = 0.25;
      const EDGE_Z = 0.60;
      const EDGE_Y = 0.80;
      const cols = 3, rows = 2;

      let frameW = FRAME.w;
      let frameH = FRAME.h;

      const halfW = () => frameW / 2;
      const zMinCenter = -this.room2Depth / 2 + EDGE_Z + (halfW() + RZ);
      const zMaxCenter =  this.room2Depth / 2 - EDGE_Z - (halfW() + RZ);
      let span = zMaxCenter - zMinCenter;

      const minPitch = frameW + 2 * RZ;


      const neededSpan = minPitch * (cols - 1);

      if (span < neededSpan) {
        const scale = Math.max(0.6, span / neededSpan);
        frameW = FRAME.w * scale;
        frameH = FRAME.h * scale;

        const zMinCenter2 = -this.room2Depth / 2 + EDGE_Z + (frameW / 2 + RZ);
        const zMaxCenter2 =  this.room2Depth / 2 - EDGE_Z - (frameW / 2 + RZ);
        span = zMaxCenter2 - zMinCenter2;
      }

      const pitch = span / (cols - 1);

      const zCenters: number[] = [];
      for (let c = 0; c < cols; c++) {
        zCenters.push(-span / 2 + c * pitch);
      }

      const pitchY = frameH + 0.5 * RY;
      const yCenterWorld = 2.5;
      const halfH = frameH / 2;

      let topCenterW = yCenterWorld + pitchY / 2;
      let botCenterW = yCenterWorld - pitchY / 2;

      const topMaxW = this.room2H - EDGE_Y - halfH;
      const botMinW = EDGE_Y + halfH;
      if (topCenterW > topMaxW) {
        const d = topCenterW - topMaxW;
        topCenterW -= d;
        botCenterW -= d;
      }
      if (botCenterW < botMinW) {
        const d = botMinW - botCenterW;
        topCenterW += d;
        botCenterW += d;
      }

      const topLocalY = topCenterW - this.room2H / 2;
      const botLocalY = botCenterW - this.room2H / 2;

      const localX = +0.11;

      let placed = 0;
      for (let r = 0; r < rows && placed < count; r++) {
        const y = (r === 0) ? topLocalY : botLocalY;
        for (let c = 0; c < cols && placed < count; c++) {
          const z = zCenters[c];

          const frame = this.createFrame(
            new THREE.Vector3(localX, y, z),
            Math.PI / 2,
            this.room2NorthWall,
            { w: frameW, h: frameH, d: FRAME.d }
          );


     this.skinFrameFrontWithImage(frame, previews[placed]);
          frame.userData['popup'] = {
            id: `user-${placed}`,
            title: 'Obra del usuario',
            artist: 'Tú',
            image: previews[placed]
          };
          this.userFrames.push(frame);
          placed++;
        }
        }
      },
    error: (e) => console.error('Error cargando pinturas del usuario', e),
  });
}



private createModernWallMenu(
  buttons: { label: string; icon: string; route: string }[]
): THREE.Group {

  const TITLE_LINES = [
    "Bienvenido al museo 3D",
    "de MuseAI.",
    "Presiona un botón, el lienzo",
    "o la escultura para navegar", 
    "por la página."
  ];

  const group = new THREE.Group();

  // CONFIGURACIÓN
  const buttonGap = 0.55;
  const titleHeight = 0.80;
  const panelWidth = 2.9;
  const contentOffsetY = -0.30;

  const panelHeight =
    titleHeight +
    (buttons.length * buttonGap) +
    1;

  // PANEL PRINCIPAL
  const panelCanvas = document.createElement("canvas");
  panelCanvas.width = 2048;
  panelCanvas.height = 3072;
  const pctx = panelCanvas.getContext("2d")!;
  pctx.clearRect(0, 0, panelCanvas.width, panelCanvas.height);

  function roundRect(ctx: any, x: number, y: number, w: number, h: number, r: number) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }

  // Fondo glass
  pctx.fillStyle = "rgba(255, 255, 255, 0.12)";
  roundRect(pctx, 0, 0, panelCanvas.width, panelCanvas.height, 260);
  pctx.fill();

  // Borde
  pctx.lineWidth = 26;
  pctx.strokeStyle = "rgba(255, 255, 255, 0.75)";
  roundRect(pctx, 18, 18, panelCanvas.width - 36, panelCanvas.height - 36, 260);
  pctx.stroke();

  const panelTex = new THREE.CanvasTexture(panelCanvas);
  const panel = new THREE.Mesh(
    new THREE.PlaneGeometry(panelWidth, panelHeight),
    new THREE.MeshBasicMaterial({ map: panelTex, transparent: true })
  );
  panel.position.set(0, 0, 0);
  group.add(panel);

  // TÍTULO CON FONDO GLASS
  const titleBGWidth = 2.4;
  const titleBGHeight = 0.95;

  // Canvas del fondo del título
  const titleBGCanvas = document.createElement("canvas");
  titleBGCanvas.width = 1024;
  titleBGCanvas.height = 512;
  const bgctx = titleBGCanvas.getContext("2d")!;
  bgctx.clearRect(0, 0, 1024, 512);

  // Dibujar fondo redondeado
  bgctx.fillStyle = "rgba(255,255,255,0.18)";
  roundRect(bgctx, 0, 0, 1024, 512, 80);
  bgctx.fill();

  // Contorno
  bgctx.lineWidth = 12;
  bgctx.strokeStyle = "rgba(255,255,255,0.45)";
  roundRect(bgctx, 8, 8, 1024 - 16, 512 - 16, 80);
  bgctx.stroke();

  const titleBGTex = new THREE.CanvasTexture(titleBGCanvas);
  const titleBG = new THREE.Mesh(
    new THREE.PlaneGeometry(titleBGWidth, titleBGHeight),
    new THREE.MeshBasicMaterial({ map: titleBGTex, transparent: true })
  );
  titleBG.position.set(0, panelHeight / 2 - 0.45 + contentOffsetY, 0.035);
  group.add(titleBG);

  // Texto del título encima del fondo
  const titleCanvas = document.createElement("canvas");
  titleCanvas.width = 2048;
  titleCanvas.height = 1024;
  const tctx = titleCanvas.getContext("2d")!;
  tctx.clearRect(0, 0, 2048, 1024);

  tctx.font = "bold 128px system-ui";
  tctx.fillStyle = "#ffffff";
  tctx.textAlign = "center";
  tctx.textBaseline = "middle";

  TITLE_LINES.forEach((line, i) => {
    tctx.fillText(line, 1024, 220 + i * 150);
  });

  const titleTex = new THREE.CanvasTexture(titleCanvas);
  const titleMesh = new THREE.Mesh(
    new THREE.PlaneGeometry(2.35, 0.85),
    new THREE.MeshBasicMaterial({ map: titleTex, transparent: true })
  );
  titleMesh.position.set(0, panelHeight / 2 - 0.50 + contentOffsetY, 0.04);
  group.add(titleMesh);

  //  BOTONES CON FONDO GLASS REDONDEADO
  const firstButtonY = (panelHeight / 2) - (titleBGHeight + 0.50) + contentOffsetY;

  buttons.forEach((btn, i) => {
    const b = this.makePrettyButton(btn.label, btn.icon, btn.route);
    b.position.set(0, firstButtonY - i * buttonGap, 0.06);
    group.add(b);
  });

  return group;
}


private makePrettyButton(
  label: string,
  icon: string,
  route: string
): THREE.Group {

  const group = new THREE.Group();

  const w = 2.0;
  const h = 0.55;

  function roundRect(ctx: any, x: number, y: number, w: number, h: number, r: number) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }

  //  Fondo redondeado del botón
  const bgCanvas = document.createElement("canvas");
  bgCanvas.width = 1024;
  bgCanvas.height = 310;
  const bg = bgCanvas.getContext("2d")!;
  bg.clearRect(0, 0, 1024, 310);

  // Fondo
  bg.fillStyle = "rgba(255,255,255,0.22)";
  roundRect(bg, 0, 0, 1024, 310, 70);
  bg.fill();

  bg.lineWidth = 14;
  bg.strokeStyle = "rgba(255,255,255,0.40)";
  roundRect(bg, 8, 8, 1024 - 16, 310 - 16, 70);
  bg.stroke();

  const bgTex = new THREE.CanvasTexture(bgCanvas);
  const bgMesh = new THREE.Mesh(
    new THREE.PlaneGeometry(w, h),
    new THREE.MeshBasicMaterial({ map: bgTex, transparent: true })
  );
  group.add(bgMesh);

  //  Ícono + Texto
  const textCanvas = document.createElement("canvas");
  textCanvas.width = 1024;
  textCanvas.height = 310;
  const ctx = textCanvas.getContext("2d")!;
  ctx.clearRect(0, 0, 1024, 310);

  ctx.fillStyle = "#ffffff";
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";

  ctx.font = "bold 120px system-ui";
  ctx.fillText(icon, 90, 155);

  ctx.font = "600 90px system-ui";
  ctx.fillText(label, 260, 155);

  const tTex = new THREE.CanvasTexture(textCanvas);
  const textMesh = new THREE.Mesh(
    new THREE.PlaneGeometry(w, h),
    new THREE.MeshBasicMaterial({ map: tTex, transparent: true })
  );
  textMesh.position.z = 0.01;
  group.add(textMesh);

  //  HOVER GLOW
  const hoverCanvas = document.createElement("canvas");
  hoverCanvas.width = 1024;
  hoverCanvas.height = 310;
  const hctx = hoverCanvas.getContext("2d")!;
  hctx.clearRect(0, 0, 1024, 310);

  hctx.shadowColor = "#ffffff";
  hctx.shadowBlur = 55;
  hctx.lineWidth = 22;
  hctx.strokeStyle = "#ffffff";
  roundRect(hctx, 20, 20, 1024 - 40, 310 - 40, 70);
  hctx.stroke();

  const hoverTex = new THREE.CanvasTexture(hoverCanvas);
  const hoverMat = new THREE.MeshBasicMaterial({
    map: hoverTex,
    transparent: true,
    opacity: 0,
    depthTest: false
  });

  const hoverPlane = new THREE.Mesh(
    new THREE.PlaneGeometry(w * 1.06, h * 1.12),
    hoverMat
  );
  hoverPlane.position.set(0, 0, 0.02);
  group.add(hoverPlane);

  //  Hotspot invisible
  const hotspot = new THREE.Mesh(
    new THREE.PlaneGeometry(w * 1.06, h * 1.12),
    new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.01 })
  );
  hotspot.position.set(0, 0, 0.03);
  hotspot.userData['route'] = route;
  hotspot.userData['hoverMat'] = hoverMat;

  this.interactables.push(hotspot);
  group.add(hotspot);

  return group;
}




private getOrCreateArtPlane(frame: THREE.Mesh, pad = 0.12): THREE.Mesh {
  let art = frame.userData['artPlane'] as THREE.Mesh | undefined;
  if (art) return art;

  const box = frame.geometry as THREE.BoxGeometry;
  const w = (box.parameters.width  ?? 2.8) - 2 * pad;
  const h = (box.parameters.height ?? 3.0) - 2 * pad;
  const d =  (box.parameters.depth  ?? 0.10);

  const geo = new THREE.PlaneGeometry(w, h);
  const mat = new THREE.MeshBasicMaterial({ color: 0xffffff });
  art = new THREE.Mesh(geo, mat);

  art.position.set(0, 0, d/2 + 0.002);
  frame.add(art);
  frame.userData['artPlane'] = art;
  return art;
}




private loadGLB(path: string): Promise<THREE.Group> {
  return new Promise((resolve, reject) => {
    const p = path.startsWith('/') || path.startsWith('http') ? path : `/${path}`;
    const loader = new GLTFLoader();
    loader.load(p, (g) => resolve(g.scene), undefined, (e) => reject(e));
  });
}

private objectFromSceneJson(sceneJson: string): THREE.Object3D {
  const loader = new THREE.ObjectLoader();
  return loader.parse(JSON.parse(sceneJson));
}

private parseSculptureMeta(raw: string | null | undefined): SculptureMeta {
  if (!raw) return {};
  try {
    const m = JSON.parse(raw);
    const meta: SculptureMeta = {};
    if (typeof m.glbUrl === 'string') meta.glbUrl = m.glbUrl;
    if (typeof m.scale === 'number')  meta.scale  = m.scale;
    if (typeof m.rotY === 'number')   meta.rotY   = m.rotY;
    if (typeof m.offsetY === 'number') meta.offsetY = m.offsetY;
    return meta;
  } catch { return {}; }
}
private hasGlb(m: SculptureMeta): m is SculptureWithGlb {
  return typeof m.glbUrl === 'string' && m.glbUrl.length > 0;
}


private async addPedestalWithSculptureFromData(
  meta: SculptureMeta,
  sceneJson: string | null | undefined,
  position: THREE.Vector3,
  rotY: number,
  opts?: { targetHeight?: number; podiumScale?: number; podiumColor?: THREE.ColorRepresentation, podiumNudgeX?: number;}
): Promise<THREE.Group | null> {
  const targetHeight = opts?.targetHeight ?? 1.2;
  const podiumScale  = opts?.podiumScale  ?? 0.4;
  const userScale    = meta.scale ?? 1.0;
  const userRotY     = meta.rotY  ?? 0;
  const extraOffsetY = meta.offsetY ?? 0;

  const group = new THREE.Group();
  group.position.copy(position);
  group.rotation.y = rotY;

  // 1) Podio
  const podium = await this.loadGLB('/assets/models/lowpoly_podium.glb');
  this.stripForeignLighting(podium);  
const PODIUM_COLOR = new THREE.Color('#f5e1ce');
podium.traverse(o => {
  if ((o as THREE.Mesh).isMesh) {
    const mesh = o as THREE.Mesh;
    const current = mesh.material as THREE.Material | THREE.Material[];
    const apply = (mat: THREE.Material) => {
      if ((mat as any).isMeshStandardMaterial) {
        (mat as any).color = PODIUM_COLOR.clone();
        (mat as any).metalness = 0.0;
        (mat as any).roughness = 0.9;
      } else {
        mesh.material = new THREE.MeshStandardMaterial({
          color: PODIUM_COLOR,
          metalness: 0.0,
          roughness: 0.9,
        });
      }
    };
    Array.isArray(current) ? current.forEach(apply) : apply(current);
  }
});
  {
    const box = new THREE.Box3().setFromObject(podium);
    const size = new THREE.Vector3(); box.getSize(size);
    const center = new THREE.Vector3(); box.getCenter(center);
    podium.position.sub(center);
    podium.position.y += size.y / 2; // base en y=0
    podium.scale.setScalar(podiumScale);
  }

  const podiumNudge = opts?.podiumNudgeX ?? 0.06;
  podium.position.x -= podiumNudge;
  group.add(podium);

  let sculpture: THREE.Object3D | null = null;
  try {
    if (this.hasGlb(meta)) sculpture = await this.loadGLB(meta.glbUrl);
    else if (sceneJson)    sculpture = this.objectFromSceneJson(sceneJson);
  } catch (e) {
    console.error('Error cargando escultura', e);
    sculpture = null;
  }
  if (!sculpture) return null;
  this.stripForeignLighting(sculpture);    

  {
    const box = new THREE.Box3().setFromObject(sculpture);
    const size = new THREE.Vector3(); box.getSize(size);
    const center = new THREE.Vector3(); box.getCenter(center);
    sculpture.position.sub(center);
    sculpture.position.y += size.y / 2;

    const scale = (targetHeight / size.y) * userScale;
    sculpture.scale.setScalar(scale);
  }
  sculpture.rotation.y = userRotY;

  const podiumTopY = new THREE.Box3().setFromObject(podium).max.y;
  sculpture.position.y = podiumTopY + extraOffsetY;
  group.add(sculpture);



  const pad = 0.15;
  const col = new THREE.Box3().setFromObject(group).expandByScalar(pad);
  this.colliders.push(col);

  this.scene.add(group);
  this.sculptureGroups.push(group);
  return group;
}


private mountUserSculpturesInRoom2() {
  if (!this.room2Width || !this.room2Depth) return;

  for (const g of this.sculptureGroups) g.parent?.remove(g);
  this.sculptureGroups = [];

  this.http.get<SculptureResponse[]>(this.API_SCULPT).subscribe({
    next: async (list) => {
      const metas = list.map(s => this.parseSculptureMeta(s.metadata));

      const edgeX = 0.8, wallOffset = 0.55, y = 0;
      const northZ = this.room2CenterZ - this.room2Depth / 2 + wallOffset;
      const southZ = this.room2CenterZ + this.room2Depth / 2 - wallOffset;
      const usableWidth = this.room2Width - 2 * edgeX;
      const xLeft  = this.room2CenterX - usableWidth / 4;
      const xRight = this.room2CenterX + usableWidth / 4;

      const slots = [
        { x: xLeft,  z: northZ, rotY: 0 },
        { x: xRight, z: northZ, rotY: 0 },
        { x: xLeft,  z: southZ, rotY: Math.PI },
        { x: xRight, z: southZ, rotY: Math.PI },
      ];

      const maxTotal = Math.min(4, list.length);
      for (let i = 0; i < maxTotal; i++) {
        const s = slots[i];
        const meta = metas[i] ?? {};
        const sceneJson = list[i].sceneJson ?? null;

        try {
          await this.addPedestalWithSculptureFromData(

            meta,
            sceneJson,
            new THREE.Vector3(s.x, y, s.z),
            s.rotY,
            { targetHeight: 1.2, podiumScale: 0.4, podiumColor: 0xC49A6C,  podiumNudgeX: 0.06     } // café claro
          );
        } catch (e) {
          console.error('No se pudo montar escultura', e);
        }
      }
    },
    
    error: (e) => console.error('Error obteniendo esculturas', e),
  });
}

 private createFrame(
  position: THREE.Vector3,
  rotationY: number,
  parent?: THREE.Object3D,
  size?: { w: number; h: number; d?: number }
): THREE.Mesh {
  const width  = size?.w ?? 2.8;
  const height = size?.h ?? 3.0;
  const depth  = size?.d ?? 0.1;

  const geometry = new THREE.BoxGeometry(width, height, depth);

  const wood = new THREE.MeshStandardMaterial({
    color: 0x4a2c13,
    metalness: 0.0,
    roughness: 0.6,
    emissive: new THREE.Color(0x120a06),
    emissiveIntensity: 0.12
  });

  const frontBlank = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    metalness: 0.0,
    roughness: 0.95
  });

  const materials = [wood, wood, wood, wood, frontBlank, wood];
  const frame = new THREE.Mesh(geometry, materials);

  frame.position.copy(position);
  frame.rotation.y = rotationY;
  (parent ?? this.scene).add(frame);
  this.artFrames.push(frame);
  return frame;
}




private addCeilingLamp(path: string, x: number, z: number, opts?: {clear?: number, scale?: number, rotY?: number}) {
  const loader = new GLTFLoader();
  const clear = opts?.clear ?? 0.12;
  const scl   = opts?.scale ?? 1.0;
  const rotY  = opts?.rotY ?? 0;

  loader.load(path, (gltf) => {
    const lamp = gltf.scene;

    const wrap = new THREE.Group();

    const box = new THREE.Box3().setFromObject(lamp);
    const size = new THREE.Vector3(); box.getSize(size);
    const center = new THREE.Vector3(); box.getCenter(center);

    lamp.position.sub(center);
    lamp.position.y -= (-size.y / 2);

    lamp.traverse(o => {
      if ((o as THREE.Mesh).isMesh) {
        const m = o as THREE.Mesh;
        m.castShadow = true;
        m.receiveShadow = false;
      }
    });

    wrap.add(lamp);

    wrap.scale.setScalar(scl);

    const box2 = new THREE.Box3().setFromObject(wrap);
    const size2 = new THREE.Vector3(); box2.getSize(size2);
    const lampH = size2.y;

    const ceilingY = 5;
    wrap.position.set(x, ceilingY - clear - lampH, z);
    wrap.rotation.y = rotY;

    this.scene.add(wrap);
  },
  undefined,
  (e) => console.error('No se pudo cargar lámpara:', path, e));
}



  private addArtworkToFrame(frame: THREE.Mesh, artworkId: string): void {
    frame.userData['tourId'] = artworkId;
    this.cmaService.getById(artworkId).subscribe({
      next: (resp: any) => {
        const data = resp?.data ?? resp;

        const imgUrl: string | undefined =
          data?.images?.web?.url ||
          data?.images?.print?.url ||
          data?.images?.web?.url360 ||
          data?.images?.primary?.url;

        if (!imgUrl) {
          console.warn('Obra sin imagen en CMA', artworkId);
          return;
        }

        // Usamos el proxy del backend para evitar CORS
        const proxiedUrl = `http://localhost:8080/api/cma/image?url=${encodeURIComponent(
          imgUrl
        )}`;

        const loader = new THREE.TextureLoader();
        loader.load(
          proxiedUrl,
          (texture) => {
            const img = texture.image as HTMLImageElement;
            const aspect = img.width / img.height;

            const box = frame.geometry as THREE.BoxGeometry;
            const frameWidth = box.parameters.width ?? 2.2;
            const frameHeight = box.parameters.height ?? 2.2;
            const depth = box.parameters.depth ?? 0.15;  

            const innerW = frameWidth * 0.9;
            const innerH = frameHeight * 0.9;
            const innerAspect = innerW / innerH;

            let artW: number;
            let artH: number;

            // Modo "cover": la imagen cubre todo el hueco, respetando aspecto.
            if (aspect > innerAspect) {
              artH = innerH;
              artW = innerH * aspect;
            } else {
              artW = innerW;
              artH = innerW / aspect;
            }

            // "zoom" para tapar casi todo el marco café
            const planeW = artW * 1.05;
            const planeH = artH * 1.05;

            const material = new THREE.MeshBasicMaterial({
              map: texture,
              side: THREE.FrontSide,
              polygonOffset: true,
              polygonOffsetFactor: -1,
              polygonOffsetUnits: -1,
            });

            const planeGeo = new THREE.PlaneGeometry(planeW, planeH);
          // Reemplaza el material frontal del marco con la textura
          const mesh = frame as THREE.Mesh;
          const mats = mesh.material as THREE.MeshStandardMaterial[];

          mats[4] = new THREE.MeshStandardMaterial({
            map: texture,
            side: THREE.FrontSide,
          });


            // Guardamos la info de curaduría para el popup
            const popupData = this.mapCmaToPopup(data, proxiedUrl);
            frame.userData['popup'] = popupData;
          },
          undefined,
          (err) => {
            console.error('Error cargando textura de CMA para', artworkId, err);
          }
        );
      },
      error: (err) => {
        console.error('Error obteniendo obra de CMA', artworkId, err);
      },
    });
  }

private pushOutFromAABBXZ(pos: THREE.Vector3, minX: number, maxX: number, minZ: number, maxZ: number) {
  const r = this.PLAYER_RADIUS;

  if (pos.x + r <= minX || pos.x - r >= maxX || pos.z + r <= minZ || pos.z - r >= maxZ) {
    return pos;
  }

  const penLeft   = (maxX - (pos.x - r));
  const penRight  = ((pos.x + r) - minX);
  const penTop    = (maxZ - (pos.z - r));
  const penBottom = ((pos.z + r) - minZ);

  const minPen = Math.min(penLeft, penRight, penTop, penBottom);

  if (minPen === penLeft)      pos.x += penLeft;
  else if (minPen === penRight) pos.x -= penRight;
  else if (minPen === penTop)   pos.z += penTop;
  else                          pos.z -= penBottom;

  return pos;
}


  //    ESCENA 3D (init)
  private initScene(): void {

    // Color azul rey
    const WALL_COLOR = 0xEEEAE6 //0xFAFAFA  //0xDCD4CB  //0xEEEAE6   //0xB0BEC5  //0xCFD8DC    // 0xF5F5F5  //0x2B2B2B
; // royal blue

    // Un SOLO material para TODAS las paredes
    const wallMaterial = new THREE.MeshStandardMaterial({ color: WALL_COLOR });
    
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0xffffff);

    this.camera = new THREE.PerspectiveCamera(
      75,
      window.innerWidth / window.innerHeight,
      0.1,
      1000
    );
    this.camera.position.set(0, 0, 0);
    this.camera.rotation.set(0, Math.PI, 0);


    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setSize(window.innerWidth, window.innerHeight);

    (this.renderer as any).outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.0;
    document
      .getElementById('museum-container')
      ?.appendChild(this.renderer.domElement);

    this.controls = new PointerLockControls(this.camera, this.renderer.domElement);
    this.scene.add(this.controls.object);
    this.renderer.domElement.addEventListener('click', () => this.controls.lock());

    // Luces
    const hemiLight = new THREE.HemisphereLight(0xffffff, 0x888888, 1.0);
    this.scene.add(hemiLight);


    const dirLight = new THREE.DirectionalLight(0xffffff, 0.6);
    dirLight.position.set(5, 10, 5);
    this.scene.add(dirLight);

    // Piso
    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(20, 20),
      new THREE.MeshStandardMaterial({ color: WALL_COLOR })
    );
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    this.scene.add(floor);

    // Paredes exteriores
    const wallMat = new THREE.MeshStandardMaterial({ color: WALL_COLOR });
    // paredes blancas (con colisión)
    const wallGeometry = new THREE.BoxGeometry(20, 5, 0.2);

    const backWall = new THREE.Mesh(new THREE.BoxGeometry(20, 5, 0.2), wallMat);
    backWall.position.set(0, 2.5, -10);
    this.scene.add(backWall);
    this.walls.push(backWall);

    const menu = new THREE.Group();

    //  MENÚ MODERNO EN LA PARED DEL FONDO
    const wallMenu = this.createModernWallMenu([
      { label: 'Traducir Obras', icon: '🌐', route: '_openLanguageSelector_'},
      { label: 'Iniciar Tour',icon: '▶️', route: '_openTourDialog_' },
      { label: 'Realizar Quiz',  icon: '🖼️', route: '/' },
      { label: 'Perfil',      icon: '👤', route: '/app/profile' },
      { label: 'Cerrar sesión', icon: '🚪', route: '_logout_' }

    ]);

    // centrado en la pared frontal
    wallMenu.position.set(0, 2.5, 9.4);
    wallMenu.rotation.y = Math.PI;
    this.scene.add(wallMenu);



//  LIENZO EN BLANCO INTERACTIVO (izquierda del menú)
{
  const zWall = 9.80;   // pared frontal
  const xPos  = 6;
  const yPos  = 2.2;

  const frameW = 2.4, frameH = 2.6, frameD = 0.10;
  const blankFrame = this.createFrame(
    new THREE.Vector3(xPos, yPos, zWall),
    Math.PI, //  ahora mira hacia -Z (a la sala)
    undefined,
    { w: frameW, h: frameH, d: frameD }
  );

      // Lienzo blanco visible
    const innerW = frameW * 0.88;
    const innerH = frameH * 0.88;
    const innerGeo = new THREE.PlaneGeometry(innerW, innerH);
    const innerMat = new THREE.MeshStandardMaterial({
      color: 0xffffff, metalness: 0, roughness: 0.95, side: THREE.DoubleSide
    });
    const innerPlane = new THREE.Mesh(innerGeo, innerMat);
    //  delante de la cara frontal (como el marco está a π, usa -Z)
    innerPlane.position.set(0, 0, -frameD/2 - 0.004);
    blankFrame.add(innerPlane);

    // Hotspot interactivo (invisible)
    const hotspotGeo = new THREE.PlaneGeometry(innerW * 0.98, innerH * 0.98);
    const hotspotMat = new THREE.MeshStandardMaterial({
      color: 0xffffff, transparent: true, opacity: 0.001,
      side: THREE.DoubleSide, depthTest: false
    });
    const hotspot = new THREE.Mesh(hotspotGeo, hotspotMat);
    // aún más al frente que el lienzo
    hotspot.position.set(0, 0, -frameD/2 - 0.006);
    hotspot.userData['route'] = '/create-canvas';
    hotspot.userData['baseMat'] = hotspotMat;
    this.interactables.push(hotspot);
    blankFrame.add(hotspot);

    // Etiqueta bajo el marco
    const tagCanvas = document.createElement('canvas');
    tagCanvas.width = 1024; tagCanvas.height = 256; // más nítido
    const tctx = tagCanvas.getContext('2d')!;
    tctx.clearRect(0,0,tagCanvas.width,tagCanvas.height);
    tctx.fillStyle = '#333';
    tctx.font = 'bold 96px system-ui, sans-serif'; // más pequeño para que quepa
    tctx.textAlign = 'center';
    tctx.textBaseline = 'middle';
    tctx.fillText('Crea tu propio Lienzo!', tagCanvas.width/2, tagCanvas.height/2);

    const tagTex = new THREE.CanvasTexture(tagCanvas);
    const tag = new THREE.Mesh(
      new THREE.PlaneGeometry(1.4, 0.28), // un poco más grande
      new THREE.MeshBasicMaterial({ map: tagTex, transparent: true, side: THREE.DoubleSide })
    );
    tag.position.set(0, -(frameH/2) - 0.22, -frameD/2 - 0.003); // ⬅ -Z, bajo el marco
    blankFrame.add(tag);
}

//  PODIO DE PARED (derecha del menú, mismo look que sala 2)
{
  const zWall   = 9.80;   // misma pared del menú
  const xPos    = -6;     // lado derecho del menú (el lienzo está a +6)
  const yCenter = 1.9;    // misma altura/centro vertical que el lienzo
  const pull    = 0.09;   // “flotar” un poco fuera de la pared hacia la sala

  // Wrapper para posicionar/rotar el conjunto
  const wrap = new THREE.Group();
  wrap.position.set(xPos, yCenter, zWall - pull);
  wrap.rotation.y = Math.PI; // mirando hacia la sala (igual que el menú/lienzo)
  this.scene.add(wrap);

  // Carga mismo podio que sala 2 y “estandariza” materiales/centro
  const loader = new GLTFLoader();
  loader.load('/assets/models/miguel.glb', (gltf) => {
    const podium = gltf.scene;
    this.stripForeignLighting(podium);

    // color café claro idéntico al de sala 2
    const PODIUM_COLOR = new THREE.Color('#8b8b8bff');
    podium.traverse(o => {
      if ((o as THREE.Mesh).isMesh) {
        const m = o as THREE.Mesh;
        const cur = m.material as THREE.Material | THREE.Material[];
        const apply = (mat: THREE.Material) => {
          if ((mat as any).isMeshStandardMaterial) {
            (mat as any).color = PODIUM_COLOR.clone();
            (mat as any).metalness = 0.0;
            (mat as any).roughness = 0.9;
          } else {
            m.material = new THREE.MeshStandardMaterial({
              color: PODIUM_COLOR, metalness: 0.0, roughness: 0.9
            });
          }
        };
        Array.isArray(cur) ? cur.forEach(apply) : apply(cur);
      }
    });

    // Centrar el modelo en su propio origen (para poder “flotarlo” por el centro)
    const box = new THREE.Box3().setFromObject(podium);
    const size = new THREE.Vector3(); box.getSize(size);
    const center = new THREE.Vector3(); box.getCenter(center);
    podium.position.sub(center);

    // Escala como la de podio 2
    podium.scale.setScalar(2.5);

    wrap.add(podium);

    //  Hotspot interactivo al frente (misma UX de “F para interactuar”)
    const box2 = new THREE.Box3().setFromObject(podium);
    const size2 = new THREE.Vector3(); box2.getSize(size2);

    const hotspotGeo = new THREE.PlaneGeometry(0.95, 0.95);
    const hotspotMat = new THREE.MeshStandardMaterial({
      color: 0xffffff, transparent: true, opacity: 0.001,
      side: THREE.DoubleSide, depthTest: false
    });
    const hotspot = new THREE.Mesh(hotspotGeo, hotspotMat);
    hotspot.position.set(0, 0, size2.z / 2 + 0.02);
    hotspot.userData['route'] = '/sculptor';
    hotspot.userData['baseMat'] = hotspotMat;
    this.interactables.push(hotspot);
    wrap.add(hotspot);

    //  Etiqueta “Crea tu propia Escultura!” bajo el podio
    const tagCanvas = document.createElement('canvas');
    tagCanvas.width = 1400; tagCanvas.height = 180;
    const tctx = tagCanvas.getContext('2d')!;
    tctx.fillStyle = '#00000000';
    tctx.fillRect(0, 0, tagCanvas.width, tagCanvas.height);
    tctx.fillStyle = '#333';
    tctx.font = 'bold 80px system-ui, sans-serif';
    tctx.textAlign = 'center';
    tctx.textBaseline = 'middle';
    tctx.fillText('Crea tu propia Escultura!', tagCanvas.width/2, tagCanvas.height/2);

    const tagTex = new THREE.CanvasTexture(tagCanvas);
    const tag = new THREE.Mesh(
      new THREE.PlaneGeometry(2.2, 0.26),
      new THREE.MeshBasicMaterial({
        map: tagTex,
        transparent: true,
        side: THREE.DoubleSide,
        polygonOffset: true,
        polygonOffsetFactor: -1,
        polygonOffsetUnits: -1
      })
    );
    tag.position.set(0, -(size2.y/2) - 0.22, -(pull - 0.006));
    wrap.add(tag);



    // Colisión suave
    this.addColliderFromObject(wrap, 0.03);
  },
  undefined,
  (e) => console.error('No se pudo cargar el podio flotante:', e));
}
    const frontWall = new THREE.Mesh(new THREE.BoxGeometry(20, 5, 0.2), wallMat);
    frontWall.position.set(0, 2.5, 10);
    this.scene.add(frontWall);
    this.walls.push(frontWall);


 //  PUERTA PEGADA A LA ÚLTIMA OBRA DE LA PARED IZQUIERDA
{
  const wallThick = 0.2;
  const wallH     = 5;
  const wallLen   = 20;
  const wallX     = -10;

  // Usa los marcos ya creados; si no hay, asume que el último está en z=6
  const doorW = 2.0;
  const doorZ = -10 + doorW / 2 + 0.05;
  const doorH = 3.0;
  const doorYBottom = 0;

  const zMin = -10;
  const zMax =  10;
  const zStart = doorZ - doorW / 2;
  const zEnd   = doorZ + doorW / 2;

  // Segmento izquierdo
  const leftLen = (zStart - zMin);
  if (leftLen > 0) {
    const leftSeg = new THREE.Mesh(
      new THREE.BoxGeometry(wallThick, wallH, leftLen),
      wallMaterial
    );
    leftSeg.position.set(wallX, wallH / 2, (zMin + zStart) / 2);
    this.scene.add(leftSeg); this.walls.push(leftSeg);
  }

  // Segmento derecho
  const rightLen = (zMax - zEnd);
  if (rightLen > 0) {
    const rightSeg = new THREE.Mesh(
      new THREE.BoxGeometry(wallThick, wallH, rightLen),
      wallMaterial
    );
    rightSeg.position.set(wallX, wallH / 2, (zEnd + zMax) / 2);
    this.scene.add(rightSeg); this.walls.push(rightSeg);
  }

  // Dintel
  const lintelH = wallH - doorH;
  if (lintelH > 0) {
    const lintel = new THREE.Mesh(
      new THREE.BoxGeometry(wallThick, lintelH, doorW),
      wallMaterial
    );
    const lintelYCenter = doorYBottom + doorH + lintelH / 2;
    lintel.position.set(wallX, lintelYCenter, doorZ);
    this.scene.add(lintel); this.walls.push(lintel);
  }

  //  SALA 2 ALINEADA
  const room2Width = 8, room2Depth = 12, room2H = 5, gap = 0.01;
  const room2CenterX = wallX - wallThick/2 - room2Width/2 - gap;
  const room2CenterZ = doorZ;

  // Guarda en campos de clase para usarlos luego
  this.room2Width = room2Width;
  this.room2Depth = room2Depth;
  this.room2H = room2H;
  this.room2CenterX = room2CenterX;
  this.room2CenterZ = room2CenterZ;

  const floor2 = new THREE.Mesh(
    new THREE.PlaneGeometry(room2Width, room2Depth),
    new THREE.MeshStandardMaterial({ color: 0xdddddd })
  );
  floor2.rotation.x = -Math.PI / 2;
  floor2.position.set(room2CenterX, 0, room2CenterZ);
  this.scene.add(floor2);

  const ceil2 = new THREE.Mesh(
    new THREE.PlaneGeometry(room2Width, room2Depth),
    new THREE.MeshStandardMaterial({ color: 0xfafafa })
  );
  ceil2.rotation.x = Math.PI / 2;
  ceil2.position.set(room2CenterX, room2H, room2CenterZ);
  this.scene.add(ceil2);

    // west2 (ya se crea más arriba)
  const west2  = new THREE.Mesh(new THREE.BoxGeometry(0.2, room2H, room2Depth), wallMaterial);
  west2.position.set(room2CenterX - room2Width/2, room2H/2, room2CenterZ);
  this.scene.add(west2); this.walls.push(west2);

  // usa west2 como pared destino
  this.room2NorthWall = west2;

  // y monta AHORA
  this.mountUserCanvasesOnRoom2WestWall();
  this.mountUserSculpturesInRoom2();
  

  const north2 = new THREE.Mesh(new THREE.BoxGeometry(room2Width, room2H, 0.2), wallMaterial);
  north2.position.set(room2CenterX, room2H/2, room2CenterZ - room2Depth/2);
  this.scene.add(north2);
  this.walls.push(north2);




  const south2 = new THREE.Mesh(new THREE.BoxGeometry(room2Width, room2H, 0.2), wallMaterial);
  south2.position.set(room2CenterX, room2H/2, room2CenterZ + room2Depth/2);
  this.scene.add(south2); this.walls.push(south2);


  //  PARED ESTE de la sala 2, con el MISMO hueco de puerta 
{
  const east2X = room2CenterX + room2Width / 2;  // cara Este de la sala 2
  const thick  = 0.2;
  const ezMin  = room2CenterZ - room2Depth / 2;
  const ezMax  = room2CenterZ + room2Depth / 2;
  const ezStart = doorZ - doorW / 2;             // inicio del hueco (Z)
  const ezEnd   = doorZ + doorW / 2;             // fin del hueco (Z)


  const leftLen = ezStart - ezMin;
  if (leftLen > 0) {
    const eastLeft = new THREE.Mesh(
      new THREE.BoxGeometry(thick, room2H, leftLen),
      wallMaterial
    );
    eastLeft.position.set(east2X, room2H / 2, (ezMin + ezStart) / 2);
    this.scene.add(eastLeft); this.walls.push(eastLeft);
  }

  const rightLen = ezMax - ezEnd;
  if (rightLen > 0) {
    const eastRight = new THREE.Mesh(
      new THREE.BoxGeometry(thick, room2H, rightLen),
      wallMaterial
    );
    eastRight.position.set(east2X, room2H / 2, (ezEnd + ezMax) / 2);
    this.scene.add(eastRight); this.walls.push(eastRight);
  }

  // Dintel (encima de la puerta)
  const lintelH = room2H - doorH;
  if (lintelH > 0) {
    const eastLintel = new THREE.Mesh(
      new THREE.BoxGeometry(thick, lintelH, doorW),
      wallMaterial
    );
    eastLintel.position.set(east2X, doorH + lintelH / 2, doorZ);
    this.scene.add(eastLintel); this.walls.push(eastLintel);
  }
}



  // límites de movimiento
  this.minX = Math.min(this.minX, room2CenterX - room2Width/2 - 0.5);
  this.maxX = Math.max(this.maxX,  10);
  this.minZ = Math.min(this.minZ, -10, room2CenterZ - room2Depth/2 - 0.5);
  this.maxZ = Math.max(this.maxZ,  10, room2CenterZ + room2Depth/2 + 0.5);
}






    const rightWall = new THREE.Mesh(new THREE.BoxGeometry(0.2, 5, 20), wallMat);
    rightWall.position.set(10, 2.5, 0);
    this.scene.add(rightWall);

    // Paredes interiores (centrales)
    const innerWallMaterial = wallMaterial;
    const innerWallGeometry = new THREE.BoxGeometry(0.5, 5, 8);

    // Primera pared interior (alineada con cuadros de la izquierda)
    const innerWall1 = new THREE.Mesh(innerWallGeometry, innerWallMaterial);
    innerWall1.position.set(-3.3, 2.5, 0);
    this.scene.add(innerWall1);
    this.walls.push(innerWall1);

    const innerWall2 = new THREE.Mesh(innerWallGeometry, wallMat);
    innerWall2.position.set(3.3, 2.5, 0);
    this.scene.add(innerWall2);
    this.walls.push(innerWall2);

     this.colliders = this.walls.map(w => {
      const box = new THREE.Box3().setFromObject(w);
      box.min.y = -9999;
      box.max.y = +9999;
      return box;
    });


    //     DISPLAYS / MARCOS

    const innerIds = [
      '125249', // leftOuterTop
      '151298', // leftOuterBottom
      '2009.157', // leftInnerTop
      '1921.1239', // leftInnerBottom
      '380063', // rightOuterTop
      '135614',  // rightOuterBottom
      '1921.428', // rightInnerTop
      '1942.638', // rightInnerBottom
    ];

    const backIds = ['170235', '111702', '135428']; // pared del fondo
    const leftIds = ['135483', '93014', '141639']; // pared izquierda
    const rightIds = ['132618', '115067', '1953.155']; // pared derecha

    //  PAREDES INTERIORES
    let idx = 0;

    // Pared interior izquierda
    this.addArtworkToFrame(
      this.createFrame(new THREE.Vector3(-3.55, 2.5, -2.5), -Math.PI / 2),
      innerIds[idx++]
    );
    this.addArtworkToFrame(
      this.createFrame(new THREE.Vector3(-3.55, 2.5, 2.5), -Math.PI / 2),
      innerIds[idx++]
    );

    // Pared interior izquierda
    this.addArtworkToFrame(
      this.createFrame(new THREE.Vector3(-3.05, 2.5, -2.5), Math.PI / 2),
      innerIds[idx++]
    );
    this.addArtworkToFrame(
      this.createFrame(new THREE.Vector3(-3.05, 2.5, 2.5), Math.PI / 2),
      innerIds[idx++]
    );

    // Pared interior derecha
    this.addArtworkToFrame(
      this.createFrame(new THREE.Vector3(3.55, 2.5, -2.5), Math.PI / 2),
      innerIds[idx++]
    );
    this.addArtworkToFrame(
      this.createFrame(new THREE.Vector3(3.55, 2.5, 2.5), Math.PI / 2),
      innerIds[idx++]
    );

    // Pared interior derecha
    this.addArtworkToFrame(
      this.createFrame(new THREE.Vector3(3.05, 2.5, -2.5), -Math.PI / 2),
      innerIds[idx++]
    );
    this.addArtworkToFrame(
      this.createFrame(new THREE.Vector3(3.05, 2.5, 2.5), -Math.PI / 2),
      innerIds[idx++]
    );

    //  PAREDES EXTERIORES 

    // Pared del fondo
    for (let i = 0; i < 3; i++) {
      const x = -6 + i * 6;
      const frame = this.createFrame(new THREE.Vector3(x, 2.5, -9.9), 0);
      frame.userData['isBackWall'] = true;
      this.addArtworkToFrame(frame, backIds[i]);
    }

    // Pared izquierda
    for (let i = 0; i < 3; i++) {
      const z = -6 + i * 6;
      const frame = this.createFrame(
        new THREE.Vector3(-9.9, 2.5, z),
        Math.PI / 2
      );
      this.addArtworkToFrame(frame, leftIds[i]);
    }

    // Pared derecha
    for (let i = 0; i < 3; i++) {
      const z = -6 + i * 6;
      const frame = this.createFrame(
        new THREE.Vector3(9.9, 2.5, z),
        -Math.PI / 2
      );
      this.addArtworkToFrame(frame, rightIds[i]);
    }

    // Techo
    const ceiling = new THREE.Mesh(
      new THREE.PlaneGeometry(20, 20),
      new THREE.MeshStandardMaterial({ color: 0xfafafa })
    );
    ceiling.rotation.x = Math.PI / 2;
    ceiling.position.y = 5;
    this.scene.add(ceiling);

    //MODELOS GLTF
    const loader = new GLTFLoader();

     this.addCeilingLamp('/assets/models/large.glb', 0, -7.8, { scale: 2, rotY: 0, clear: -0.8 });

    loader.load('/assets/models/bench.glb', (g) => {
      const bench = g.scene;
      bench.scale.set(0.5, 2, 6);
      bench.position.set(0, 0, 0);
      this.scene.add(bench);

      this.addColliderFromObject(bench, 0.03);
    });

    loader.load('/assets/models/light.glb', (g) => {
      const lamp = g.scene;
      lamp.scale.set(2, 2, 2);
      lamp.position.set(0, 3.1, 0);
      this.scene.add(lamp);
    });

    loader.load('/assets/models/ceiling_lamp.glb', (g) => {
      const lamp = g.scene;
      lamp.scale.set(6, 6, 6);
      lamp.position.set(6.5, 4.8, 0);
      lamp.rotation.y = Math.PI / 2;
      this.scene.add(lamp);
    });

    loader.load('/assets/models/ceiling_lamp.glb', (g) => {
      const lamp = g.scene;
      lamp.scale.set(6, 6, 6);
      lamp.position.set(-6.5, 4.8, 0);
      lamp.rotation.y = Math.PI / 2;
      this.scene.add(lamp);
    });

    loader.load('/assets/models/large.glb', (g) => {
      const woodlamp = g.scene;
      woodlamp.scale.set(5, 5, 5);
      woodlamp.position.set(0, 0, 0);
      woodlamp.rotation.y = Math.PI / 2;
      this.scene.add(woodlamp);
    });

    // planta 1
    loader.load('/assets/models/plant.glb', (gltf) => {
      const plant = gltf.scene;
      plant.scale.set(1.2, 1.2, 1.2);
      plant.position.set(-2, 0, 3);
      this.scene.add(plant);

       this.addColliderFromObject(plant, 0.02);
    });

    loader.load('/assets/models/plant.glb', (g) => {
      const plant = g.scene;
      plant.scale.set(1.5, 1.5, 1.5);
      plant.position.set(2, 0, -3);
      this.scene.add(plant);

       this.addColliderFromObject(plant, 0.02);
    });

    window.addEventListener('resize', this.onResize);
  }

  // EVENTOS / CONTROLES


  private addEventListeners(): void {
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
  }



  private onKeyDown = (event: KeyboardEvent) => {
  switch (event.code) {
    case 'KeyW': this.moveForward = true;  break;
    case 'KeyS': this.moveBackward = true; break;
    case 'KeyA': this.moveLeft = true;     break;
    case 'KeyD': this.moveRight = true;    break;
    case 'KeyF': this.tryWallInteract();   break;
  }
};

private onKeyUp = (event: KeyboardEvent) => {
  switch (event.code) {
    case 'KeyW': this.moveForward = false;  break;
    case 'KeyS': this.moveBackward = false; break;
    case 'KeyA': this.moveLeft = false;     break;
    case 'KeyD': this.moveRight = false;    break;
  }
};

  // PROXIMIDAD / POPUP

  private checkArtworkProximity(): void {
    let nearestFrame: THREE.Mesh | null = null;
    let nearestDistance = Infinity;
    const camPos = this.camera.position.clone();

    for (const frame of this.artFrames) {
      const worldPos = new THREE.Vector3();
      frame.getWorldPosition(worldPos);
      const dist = camPos.distanceTo(worldPos);

      if (dist < this.proximityDistance && dist < nearestDistance) {
        if (frame.userData['popup']) {
          nearestDistance = dist;
          nearestFrame = frame;
        }
      }
    }

    if (nearestFrame && nearestFrame !== this.activeFrame) {
      // Si se acerca a una obra nueva
      this.activeFrame = nearestFrame;
      this.currentArtwork = nearestFrame.userData['popup'] as ArtworkPopupData;
      this.translateCurrentArtwork();
      this.isPopupVisible = true;
    } else if (!nearestFrame && this.activeFrame) {
      // Cuando se alejamos de todas
      this.activeFrame = null;
      this.currentArtwork = null;
      this.isPopupVisible = false;
    }
  }

  public closePopup(): void {
    this.isPopupVisible = false;
    this.currentArtwork = null;
    this.activeFrame = null;
    this.translatedDescription = null;
    this.translationError = null;
    this.isTranslating = false;
  }

  public onPopupBackdropClick(): void {
    this.closePopup();
  }

  get translationStatusText(): string {
    const lang = this.languagePreference.language();
    if (lang === 'fr') return 'Traduction en cours...';
    if (lang === 'en') return 'Translating...';
    return 'Traduciendo...';
  }

  private translateCurrentArtwork(): void {
    if (!this.currentArtwork?.description) {
      this.translatedDescription = null;
      this.translationError = null;
      return;
    }

    const targetLanguage = this.languagePreference.language();
    const description = this.currentArtwork.description;

    if (targetLanguage === 'en') {
      this.translatedDescription = description;
      this.translationError = null;
      this.isTranslating = false;
      return;
    }

    this.translatedDescription = null;
    this.isTranslating = true;
    this.translationError = null;

    this.translationService
      .translate({
        artworkId: this.currentArtwork.id,
        originalText: description,
        sourceLanguage: 'auto',
        targetLanguage,
      })
      .subscribe({
        next: (res) => {
          this.translatedDescription = res.translatedText;
          this.isTranslating = false;
        },
        error: () => {
          this.translationError = 'Error al traducir, intente nuevamente';
          this.isTranslating = false;
        },
      });
  }

  //  LOOP DE ANIMACIÓN

  private animate = () => {
  requestAnimationFrame(this.animate);
  this.updateTourMovement();

  const delta = this.clock.getDelta();
  const speed = 4.0;

  this.velocity.x -= this.velocity.x * 10.0 * delta;
  this.velocity.z -= this.velocity.z * 10.0 * delta;

  this.direction.z = Number(this.moveForward) - Number(this.moveBackward);
  this.direction.x = Number(this.moveRight)  - Number(this.moveLeft);
  this.direction.normalize();

    if (this.movementEnabled && (this.moveForward || this.moveBackward)) {
      this.velocity.z -= this.direction.z * speed * delta;
    }
    if (this.movementEnabled && (this.moveLeft || this.moveRight)) {
      this.velocity.x -= this.direction.x * speed * delta;
    }

  const moveRightAmt  = -this.velocity.x * delta * 10;
  const moveForwardAmt = this.velocity.z * delta * 10;

  // direcciones según hacia dónde mira la cámara
  const forward = new THREE.Vector3();
  this.camera.getWorldDirection(forward);
  forward.y = 0;
  forward.normalize();

  const right = new THREE.Vector3()
    .crossVectors(forward, new THREE.Vector3(0, 1, 0))
    .normalize();

    this.checkArtworkProximity();

    this.renderer.render(this.scene, this.camera);
  
  // delta en mundo
  const moveVec = new THREE.Vector3()
    .addScaledVector(forward, -moveForwardAmt)
    .addScaledVector(right,    moveRightAmt);


    if (!this.movementEnabled) {
  // No movimiento WASD durante el tour
  return;
}


    const attempt = this.controls.object.position.clone().add(moveVec);

    const resolved = this.resolveCollisions(attempt);

    resolved.x = Math.max(this.minX, Math.min(this.maxX, resolved.x));
    resolved.z = Math.max(this.minZ, Math.min(this.maxZ, resolved.z));

    this.controls.object.position.copy(resolved);
    this.controls.object.position.y = 1.7;


  // Hover highlight
  // Hover + Hint "Presione F..."
{
  const dir = new THREE.Vector3();
  this.camera.getWorldDirection(dir);
  this.raycaster.set(this.camera.position, dir.normalize());

  const hits = this.raycaster.intersectObjects(this.interactables, false);
  const top = hits.length ? (hits[0].object as THREE.Mesh) : undefined;
  const within = hits.length ? hits[0].distance <= 4.0 : false;

  // reset si cambiamos de objetivo
  if (this.hovered && this.hovered !== top) {
    const hm = this.hovered.userData['hoverMat'] as THREE.MeshBasicMaterial | undefined;
    if (hm) hm.opacity = 0;
    this.hovered = undefined;
  }

  // aplicar borde y mostrar hint si está “a tiro”
  if (top && within) {
    this.hovered = top;
    const hm = top.userData['hoverMat'] as THREE.MeshBasicMaterial | undefined;
    if (hm) hm.opacity = 1;
    if (this.hintEl) this.hintEl.style.opacity = '1';
  } else {
    if (this.hintEl) this.hintEl.style.opacity = '0';
  }
}
  this.renderer.render(this.scene, this.camera);
};


  private onResize = () => {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  };
}