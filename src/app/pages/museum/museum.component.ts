import { Component, ElementRef, OnDestroy, OnInit, ViewChild } from '@angular/core';
import * as THREE from 'three';
import { PointerLockControls } from 'three/examples/jsm/controls/PointerLockControls.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { CURATORIAL_DATA } from '../../data/curatorial-data';
import { CuratorialArtwork } from '../../interfaces/curatorial-artwork.interface';
import { CommonModule } from '@angular/common';
import { CmaService } from '../../services/cma.service';

@Component({
  selector: 'app-museum',
  templateUrl: './museum.component.html',
  styleUrls: ['./museum.component.css'],
  imports: [CommonModule]
})
export class MuseumComponent implements OnInit, OnDestroy {

  @ViewChild('museumContainer', { static: true }) museumContainer!: ElementRef<HTMLDivElement>;

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

  private leftFrames: THREE.Mesh[] = [];
  private backFrames: THREE.Mesh[] = [];
  private rightFrames: THREE.Mesh[] = [];
  

  private walls: THREE.Mesh[] = [];
  

  constructor(private cmaService: CmaService) {}

  private artFrames: THREE.Mesh[] = [];

  private activeArtworkId: number | null = null;
  private proximityDistance = 1.6;

  public currentArtwork: CuratorialArtwork | null = null;
  public isPopupVisible = false;

  private textureLoader = new THREE.TextureLoader();

  private artworkIndex = 0;

  ngOnInit(): void {
    this.initScene();
    this.animate();
    this.addEventListeners();
  }

  ngOnDestroy(): void {
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    cancelAnimationFrame(0);
  }

// ===== Config marco / display =====
private readonly FRAME_W = 2.5;
private readonly FRAME_H = 2.5;
private readonly FRAME_D = 0.04;
private readonly GAP     = 0.01;

// SIN borde interno: la obra debe cubrir todo el display
private readonly BORDER  = 0.0;

// Un sangrado MUY chico, solo para tapar artefactos de mipmaps
private readonly BLEED   = 0.0015;
private readonly SHOW_WRAP = false;  // ← APAGAR tiras de borde


// cambia la firma para devolver frame
private makeFramedDisplay(x: number, y: number, z: number, rotY: number) {
  const group = new THREE.Group();
  group.position.set(x, y, z);
  group.rotation.y = rotY;

  const frameGeom = new THREE.BoxGeometry(this.FRAME_W, this.FRAME_H, this.FRAME_D);
  const frameMat  = new THREE.MeshStandardMaterial({ color: 0x5a3825 });
  const frame = new THREE.Mesh(frameGeom, frameMat);

  // 🔽 si quieres que normalmente se vea el marco, déjalo en true
  frame.visible = true; 
  group.add(frame);

  const anchor = new THREE.Object3D();
  anchor.position.set(0, 0, this.FRAME_D / 2 + this.GAP);
  group.add(anchor);

  this.scene.add(group);
  return { group, anchor, frame };   // <-- ahora devuelve frame
}
// Rellena N anchors con los primeros resultados de una búsqueda CMA
private fillAnchorsFromSearch(term: string, anchors: THREE.Object3D[], limit = anchors.length) {
  this.cmaService.search(term, limit).subscribe({
    next: (res: any) => {
      const items = res?.data ?? res?.results ?? [];
      items.slice(0, anchors.length).forEach((it: any, i: number) => {
        // En CMA el id es numérico (ej: 124089). Puede venir como it.id
        const id = String(it?.id ?? it?.objectID ?? it?.object_id);
        if (id) this.addArtworkToAnchor(anchors[i], id);
      });
    },
    error: (err) => console.error('Error buscando obras CMA', term, err)
  });
}

// 1) CORRECCIÓN: este marco en la cara derecha debe mirar HACIA ADENTRO (−X).
private placeFrameOnRightFace(
  wall: THREE.Mesh,
  zLocal: number,
  yWorld: number,
) {
  const frameGeo = new THREE.BoxGeometry(3, 3, this.FRAME_D);
  const frameMat = new THREE.MeshStandardMaterial({ color: 0x5a3825 });
  const frame = new THREE.Mesh(frameGeo, frameMat);

  // ancho (X local) de la pared
  const w = (wall.geometry as THREE.BoxGeometry).parameters.width ?? 0.5;
  const eps = 0.0; // si ves z-fighting, usa 0.001

  // ⬇️ Centro del marco alineado con la cara derecha de la pared (medio embebido),
  // igual que haces en las otras paredes (x = -9.9, 9.9, etc.).
  const localPos = new THREE.Vector3(w / 2 + eps, 0, zLocal);

  wall.updateMatrixWorld(true);
  const worldPos = localPos.clone();
  wall.localToWorld(worldPos);
  worldPos.y = yWorld;

  // Toma orientación de la pared y gira +90° para que el +Z del marco mire hacia la sala
  const q = new THREE.Quaternion();
  wall.getWorldQuaternion(q);

  frame.position.copy(worldPos);
  frame.setRotationFromQuaternion(q);
  frame.rotateY(+Math.PI / 2);

  this.scene.add(frame);
  return frame;
}

// === NUEVO: marco en la CARA IZQUIERDA de la pared (mirando hacia +X, al pasillo)
private placeFrameOnLeftFace(
  wall: THREE.Mesh,   // ej. innerWall1
  zLocal: number,     // posición a lo largo del eje Z local de la pared
  yWorld: number,     // altura deseada en mundo
) {
  const frameGeo = new THREE.BoxGeometry(3, 3,  this.FRAME_D);
  const frameMat = new THREE.MeshStandardMaterial({ color: 0x5a3825 });
  const frame = new THREE.Mesh(frameGeo, frameMat);

  const w = (wall.geometry as THREE.BoxGeometry).parameters.width ?? 0.5;
  const eps = 0.0;

  // Posición justo fuera de la CARA IZQUIERDA (X local negativa)
  const localPos = new THREE.Vector3(-w / 2 - 0.2 / 2 - eps, 0, zLocal);

  wall.updateMatrixWorld(true);
  const worldPos = localPos.clone();
  wall.localToWorld(worldPos);
  worldPos.y = yWorld;

  // Orienta el marco igual que la pared…
  const q = new THREE.Quaternion();
  wall.getWorldQuaternion(q);
  frame.position.copy(worldPos);
  frame.setRotationFromQuaternion(q);

  // …y ahora gíralo -90° para que su +Z apunte hacia +X (hacia la sala)
  frame.rotateY(-Math.PI / 2);

  this.scene.add(frame);
  return frame;
}




// 2) Método para pegar la obra en el frente del marco (local +Z)
private addArtworkToDisplayFrame(
  frame: THREE.Mesh,
  artworkId: string,
  margin = 0.00,
  bleed  = 0.0015
) {
  this.cmaService.getById(artworkId).subscribe({
    next: (resp: any) => {
      const data = resp?.data ?? resp;
      const imgUrl =
        data?.images?.web?.url ||
        data?.images?.print?.url ||
        data?.images?.web?.url360 ||
        data?.images?.primary?.url;
      if (!imgUrl) { console.warn('Obra sin imagen', artworkId); return; }

      const url = `http://localhost:8080/api/cma/image?url=${encodeURIComponent(imgUrl)}`;
      new THREE.TextureLoader().load(url, (texture) => {
        (texture as any).colorSpace = THREE.SRGBColorSpace;
        texture.anisotropy = this.renderer.capabilities.getMaxAnisotropy();

        // Tamaño visible del display (marco real – margen)
        const box   = frame.geometry as THREE.BoxGeometry;
        const fW    = (box?.parameters?.width  ?? 3);
        const fH    = (box?.parameters?.height ?? 3);
        const depth = (box?.parameters?.depth  ?? 0.2) * (frame.scale?.z ?? 1);
        const eps   = 0.005; // ~1.5 cm hacia fuera del marco

        const displayW = fW - 2 * margin;
        const displayH = fH - 2 * margin;

        // “cover” centrado con repeat/offset
        const img         = texture.image as HTMLImageElement;
        const aspect      = img.width / img.height;
        const innerAspect = displayW / displayH;

        let repX = 1, repY = 1, offX = 0, offY = 0;
        if (aspect > innerAspect) { repX = innerAspect / aspect; offX = (1 - repX) / 2; }
        else { repY = aspect / innerAspect; offY = (1 - repY) / 2; }

        texture.wrapS = THREE.ClampToEdgeWrapping;
        texture.wrapT = THREE.ClampToEdgeWrapping;
        texture.repeat.set(repX, repY);
        texture.offset.set(offX, offY);
        texture.minFilter = THREE.LinearMipmapLinearFilter;
        texture.magFilter = THREE.LinearFilter;

        // Plano ligeramente más grande (bleed)
        const planeW = displayW + 2 * bleed;
        const planeH = displayH + 2 * bleed;

        const mat = new THREE.MeshBasicMaterial({
          map: texture,
          side: THREE.FrontSide,
          transparent: true,
          polygonOffset: true,
          polygonOffsetFactor: -1,
          polygonOffsetUnits: -1,
        });

        const plane = new THREE.Mesh(new THREE.PlaneGeometry(planeW, planeH), mat);
        plane.renderOrder = 10;

        // Anchor local al marco (SIEMPRE en el frente local +Z)
        let anchor = frame.getObjectByName('frontAnchor') as THREE.Object3D | null;
        if (!anchor) {
          anchor = new THREE.Object3D();
          anchor.name = 'frontAnchor';
          anchor.position.set(0, 0, depth / 2 + eps); // delante del marco, respetando su rotación
          frame.add(anchor);
        }

        plane.position.set(0, 0, 0);
        anchor.add(plane);
      });
    },
    error: (err) => console.error('Error backend CMA', artworkId, err)
  });
}





private addArtworkToAnchor(anchor: THREE.Object3D, artworkId: string) {
  this.cmaService.getById(artworkId).subscribe({
    next: (resp: any) => {
      const data = resp?.data ?? resp;
      const imgUrl =
        data?.images?.web?.url ||
        data?.images?.print?.url ||
        data?.images?.web?.url360 ||
        data?.images?.primary?.url;

      if (!imgUrl) { console.warn('Obra sin imagen', artworkId); return; }

      const url = `http://localhost:8080/api/cma/image?url=${encodeURIComponent(imgUrl)}`;
      new THREE.TextureLoader().load(url, (texture) => {
        // calidad
        (texture as any).colorSpace = THREE.SRGBColorSpace;
        texture.anisotropy = this.renderer.capabilities.getMaxAnisotropy();

        const img    = texture.image as HTMLImageElement;
        const aspect = img.width / img.height;

        // El display completo (sin borde)
        const innerW = this.FRAME_W;
        const innerH = this.FRAME_H;
        const innerAspect = innerW / innerH;

        // COVER con la propia textura (recorte centrado)
        let repX = 1, repY = 1, offX = 0, offY = 0;
        if (aspect > innerAspect) {
          repX = innerAspect / aspect;  offX = (1 - repX) / 2;
        } else {
          repY = aspect / innerAspect;  offY = (1 - repY) / 2;
        }
        texture.wrapS = THREE.ClampToEdgeWrapping;
        texture.wrapT = THREE.ClampToEdgeWrapping;
        texture.repeat.set(repX, repY);
        texture.offset.set(offX, offY);
        texture.minFilter = THREE.LinearMipmapLinearFilter;
        texture.magFilter = THREE.LinearFilter;

        // Plano frontal exactamente del tamaño del display (+ micro BLEED)
        const planeW = innerW + 2 * this.BLEED;
        const planeH = innerH + 2 * this.BLEED;

        const front = new THREE.Mesh(
          new THREE.PlaneGeometry(planeW, planeH),
          new THREE.MeshBasicMaterial({
            map: texture,
            side: THREE.FrontSide,
            transparent: true,
            // puedes quitar polygonOffset porque ya no hay tiras detrás
            polygonOffset: true,
            polygonOffsetFactor: -1,
            polygonOffsetUnits: -1,
          })
        );
        front.position.set(0, 0, 0);
        front.renderOrder = 10;
        anchor.add(front);

        // --- SIN WRAP: no crear tiras laterales/superior/inferior ---
        if (this.SHOW_WRAP) {
          // (deja aquí el código del wrap por si lo quieres reactivar en el futuro)
        }
      });
    },
    error: (err) => console.error('Error backend CMA', artworkId, err)
  });
}
  // ---------------------------------------------------
  //  PINTAR UNA OBRA SOBRE UN DISPLAY MOCK (CON PROXY)
  // ---------------------------------------------------
 private addArtworkToFrameMesh(frame: THREE.Mesh, artworkId: string) {
  this.cmaService.getById(artworkId).subscribe({
    next: (resp: any) => {
      const data = resp?.data ?? resp;
      const imgUrl: string | undefined =
        data?.images?.web?.url ||
        data?.images?.print?.url ||
        data?.images?.web?.url360 ||
        data?.images?.primary?.url;
      if (!imgUrl) { console.warn('Obra sin imagen', artworkId); return; }

      const url = `http://localhost:8080/api/cma/image?url=${encodeURIComponent(imgUrl)}`;
      const loader = new THREE.TextureLoader();

      loader.load(url, (texture) => {
        const img = texture.image as HTMLImageElement;
        const aspect = img.width / img.height;
        const height = 2.0;                 // un pelín más chica que el marco (2.5)
        const width  = height * aspect;

        const material = new THREE.MeshBasicMaterial({
          map: texture,
          side: THREE.FrontSide,            // NO dibujar por detrás
          polygonOffset: true,              // evita z-fighting con el marco
          polygonOffsetFactor: -1,
          polygonOffsetUnits: -1
        });
        // MUY IMPORTANTE: deja el Z-buffer normal:
        // material.depthTest = true;  // (por defecto)
        // material.depthWrite = true; // (por defecto)

        const plane = new THREE.Mesh(
          new THREE.PlaneGeometry(width, height),
          material
        );

        // Grosor real del marco (con escala local aplicada)
        const box   = frame.geometry as THREE.BoxGeometry;
        const depth = (box?.parameters?.depth ?? 0.2) * (frame.scale?.z ?? 1);

        // Empuja apenas hacia fuera del marco (1 cm)
        const epsilon = 0.01;
        let sign = 1;
        const ry = frame.rotation.y;
        if (Math.abs(ry - Math.PI / 2) < 1e-3) sign = -1;      // +π/2  -> -Z
        else if (Math.abs(ry + Math.PI / 2) < 1e-3) sign = 1;  // -π/2  -> +Z

        plane.position.set(0, 0, sign * (depth / 2 + epsilon));

        // Deja el orden de render normal (si quieres, un pelito arriba del marco)
        // plane.renderOrder = frame.renderOrder + 1;

        frame.add(plane);
      },
      undefined,
      (err) => console.error('Error cargando textura CMA', artworkId, err));
    },
    error: (err) => console.error('Error backend CMA', artworkId, err)
  });
}

private computeArtSize(
  aspect: number,                  // width / height de la imagen
  innerW: number,
  innerH: number,
  mode: 'contain' | 'cover' | 'stretch'
) {
  if (mode === 'stretch') return { w: innerW, h: innerH }; // llena, deforma

  // Respeta aspecto:
  const wFit = innerH * aspect;     // encajando por alto
  const hFit = innerW / aspect;     // encajando por ancho

  if (mode === 'contain') {
    // quepa completa
    return (wFit <= innerW) ? { w: wFit, h: innerH } : { w: innerW, h: hFit };
  } else { // 'cover' → que cubra todo el hueco
    return (wFit >= innerW) ? { w: wFit, h: innerH } : { w: innerW, h: hFit };
  }
}

private clearArtPlanes(frame: THREE.Mesh) {
  frame.children
    .filter(c => c instanceof THREE.Mesh && (c as THREE.Mesh).geometry instanceof THREE.PlaneGeometry)
    .forEach(c => frame.remove(c));
}




  private initScene(): void {
    
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0xffffff);

    // cámara
    this.camera = new THREE.PerspectiveCamera(
      75,
      window.innerWidth / window.innerHeight,
      0.1,
      1000
    );
    this.camera.position.set(0, 1.7, 0); // altura humana

    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    document.getElementById('museum-container')?.appendChild(this.renderer.domElement);

    this.controls = new PointerLockControls(this.camera, this.renderer.domElement);
    this.scene.add(this.controls.object);

    this.renderer.domElement.addEventListener('click', () => this.controls.lock());

    this.scene.add(new THREE.HemisphereLight(0xffffff, 0x888888, 1));
    const dirLight = new THREE.DirectionalLight(0xffffff, 0.6);
    dirLight.position.set(5, 10, 5);
    this.scene.add(dirLight);

    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(20, 20),
      new THREE.MeshStandardMaterial({ color: 0xdddddd })
    );
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    this.scene.add(floor);

    const wallMaterial = new THREE.MeshStandardMaterial({ color: 0xffffff });

    const backWall = new THREE.Mesh(new THREE.BoxGeometry(20, 5, 0.2), wallMaterial);
    backWall.position.set(0, 2.5, -10);
    this.scene.add(backWall);

    const frontWall = new THREE.Mesh(new THREE.BoxGeometry(20, 5, 0.2), wallMaterial);
    frontWall.position.set(0, 2.5, 10);
    this.scene.add(frontWall);

    const leftWall = new THREE.Mesh(new THREE.BoxGeometry(0.2, 5, 20), wallMaterial);
    leftWall.position.set(-10, 2.5, 0);
    this.scene.add(leftWall);

    const rightWall = new THREE.Mesh(new THREE.BoxGeometry(0.2, 5, 20), wallMaterial);
    rightWall.position.set(10, 2.5, 0);
    this.scene.add(rightWall);

    // 🧱 Paredes interiores (centrales)
    const innerWallMaterial = new THREE.MeshStandardMaterial({ color: 0xffffff });
    const innerWallGeometry = new THREE.BoxGeometry(0.5, 5, 8);

    const innerWall1 = new THREE.Mesh(innerWallGeometry, wallMaterial);
    innerWall1.position.set(-3.3, 2.5, 0);
    this.scene.add(innerWall1);

    const innerWall2 = new THREE.Mesh(innerWallGeometry, wallMaterial);
    innerWall2.position.set(3.3, 2.5, 0);
    this.scene.add(innerWall2);

   // IZQUIERDA: cara que mira al centro (rotY = +π/2)


   

    const FACE_L_TO_CENTER = -3.05;
    const FACE_R_TO_CENTER =  3.05;

    const X_LEFT  = FACE_L_TO_CENTER + (this.FRAME_D / 2 + this.GAP);
    const X_RIGHT = FACE_R_TO_CENTER - (this.FRAME_D / 2 + this.GAP);

    const leftOuterTop = this.makeFramedDisplay(X_LEFT, 2.5, -2.5,  Math.PI / 2);
    const leftOuterBot = this.makeFramedDisplay(X_LEFT, 2.5,  2.5,  Math.PI / 2);

    // Ejemplo si quieres poner también del lado derecho:
    // const rightOuterTop = this.makeFramedDisplay(X_RIGHT, 2.5, -2.5, -Math.PI / 2);
    // const rightOuterBot = this.makeFramedDisplay(X_RIGHT, 2.5,  2.5, -Math.PI / 2);
  

    // Ahora: busca dos obras tipo “campo de flores” y pégalas
   // this.fillAnchorsFromSearch('field of flowers OR flower field OR floral landscape',  
   // [leftOuterTop.anchor, leftOuterBot.anchor], 
   // 2);

 // --- DISPLAYS EN LA PARED INTERIOR QUE MIRA A LA PARED DE FLORES ---
// ---------- Marcos café en la pared interior que MIRA a la pared de flores ----------
// --- DISPLAYS EN LA PARED INTERIOR QUE MIRA A LA PARED DE FLORES ---
const yMid = 2.5;
const zA = -2.2;
const zB =  2.2;

const midFrameA = this.placeFrameOnRightFace(innerWall2, zA, yMid);
const midFrameB = this.placeFrameOnRightFace(innerWall2, zB, yMid);

// cuelga las obras
this.addArtworkToDisplayFrame(midFrameA, '380063'); 
this.addArtworkToDisplayFrame(midFrameB, '135614');






const yFront = 2.5;
const z1 = -2.2;
const z2 =  2.2;

const leftFacingA = this.placeFrameOnLeftFace(innerWall1, z1, yFront);
const leftFacingB = this.placeFrameOnLeftFace(innerWall1, z2, yFront);

// cuelga las obras solicitadas
this.addArtworkToDisplayFrame(leftFacingA, '151298');
this.addArtworkToDisplayFrame(leftFacingB, '135483');


    // techo
    const ceilingGeometry = new THREE.PlaneGeometry(20, 20);
    const ceilingMaterial = new THREE.MeshStandardMaterial({ color: 0xfafafa });
    const ceiling = new THREE.Mesh(ceilingGeometry, ceilingMaterial);
    ceiling.rotation.x = Math.PI / 2;
    ceiling.position.y = 5;
    this.scene.add(ceiling);

    // cuadros café (displays existentes)
    const frameMaterial = new THREE.MeshStandardMaterial({ color: 0x5a3825 });
    const frameGeometry = new THREE.BoxGeometry(3, 3, this.FRAME_D);

    // PARED DEL FONDO (z = -9.9) en x = -6, 0, 6
    this.backFrames = []; // Asegura que esté limpio
    for (const x of [-6, 0, 6]) {
      const frame = new THREE.Mesh(frameGeometry, frameMaterial);
      frame.position.set(x, 2.5, -9.9);
      this.scene.add(frame);
      this.backFrames.push(frame);
    }

    // PARED IZQUIERDA (x = -9.9) en z = -6, 0, 6
    for (let i = -6; i <= 6; i += 6) {
      const frameLeft = new THREE.Mesh(frameGeometry, frameMaterial);
      frameLeft.position.set(-9.9, 2.5, i);
      frameLeft.rotation.y = Math.PI / 2;
      this.scene.add(frameLeft);
      this.leftFrames.push(frameLeft);       // 👈 guardar
    }

    //PARED DERECHA 

    for (let i = -6; i <= 6; i += 6) {
      const frameRight = new THREE.Mesh(frameGeometry, frameMaterial);
      frameRight.position.set(9.9, 2.5, i);
      frameRight.rotation.y = -Math.PI / 2;
      this.scene.add(frameRight);
      this.rightFrames.push(frameRight);
    }

  
    const ids = ['125249', '93014', '141639', '135428', '170235', '111702', '115067', '132618', '127080'];  // 3 izquierda + 1 fondo

    if (this.leftFrames.length >= 3) {
      this.addArtworkToDisplayFrame(this.leftFrames[0], ids[0]); // izquierda 1 (z ≈ -6)
      this.addArtworkToDisplayFrame(this.leftFrames[1], ids[1]); // izquierda 2 (z ≈ 0)
      this.addArtworkToDisplayFrame(this.leftFrames[2], ids[2]); // izquierda 3 (z ≈ 6)
    }

    if (this.backFrames.length >= 1) {
      this.addArtworkToDisplayFrame(this.backFrames[0], ids[3]); // fondo 1 (x ≈ -6)
      this.addArtworkToDisplayFrame(this.backFrames[1], ids[4]);
      this.addArtworkToDisplayFrame(this.backFrames[2], ids[5]);
    }

    
    if (this.rightFrames.length >= 3) {
      this.addArtworkToDisplayFrame(this.rightFrames[0], ids[6]); // derecha-1 (cerca del fondo)
      this.addArtworkToDisplayFrame(this.rightFrames[1], ids[7]); // derecha-2 (centro)
      this.addArtworkToDisplayFrame(this.rightFrames[2], ids[8]); // derecha-3 (cerca del frente)
    }


    //  Cargador GLTF
    const loader = new GLTFLoader();

    loader.load('/assets/models/bench.glb', g => {
      const bench = g.scene;
      bench.scale.set(0.5, 2, 6);
      bench.position.set(0, 0, 0);
      this.scene.add(bench);
    });

    // Lámpara colgante
    loader.load('/assets/models/light.glb', (gltf) => {
      const lamp = gltf.scene;
      lamp.scale.set(2, 2, 2);
      lamp.position.set(0, 3.1, 0);
      this.scene.add(lamp);
    });

    // Lámpara de riel (derecha)
    loader.load('/assets/models/ceiling_lamp.glb', (gltf) => {
      const lamp = gltf.scene;
      lamp.scale.set(6, 6, 6);
      lamp.position.set(6.5, 4.8, 0);
      lamp.rotation.y = Math.PI / 2;
      this.scene.add(lamp);
    });

    // Lámpara de riel (izquierda)
    loader.load('/assets/models/ceiling_lamp.glb', (gltf) => {
      const lamp = gltf.scene;
      lamp.scale.set(6, 6, 6);
      lamp.position.set(-6.5, 4.8, 0);
      lamp.rotation.y = Math.PI / 2;
      this.scene.add(lamp);
    });

    // Lámpara de madera
    loader.load('/assets/models/large.glb', (gltf) => {
      const woodlamp = gltf.scene;
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
    });

    // planta 2
    loader.load('/assets/models/plant.glb', (gltf) => {
      const plant = gltf.scene;
      plant.scale.set(1.5, 1.5, 1.5);
      plant.position.set(2, 0, -3);
      this.scene.add(plant);
    });

    window.addEventListener('resize', this.onResize.bind(this));
  }

  private addEventListeners(): void {
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
  }

  private onKeyDown = (event: KeyboardEvent) => {
    switch (event.code) {
      case 'KeyS': this.moveForward = true; break;
      case 'KeyW': this.moveBackward = true; break;
      case 'KeyD': this.moveLeft = true; break;
      case 'KeyA': this.moveRight = true; break;
    }
  };

  private onKeyUp = (event: KeyboardEvent) => {
    switch (event.code) {
      case 'KeyS': this.moveForward = false; break;
      case 'KeyW': this.moveBackward = false; break;
      case 'KeyD': this.moveLeft = false; break;
      case 'KeyA': this.moveRight = false; break;
    }
  };

  private checkArtworkProximity(): void {
    let nearestId: number | null = null;
    let nearestDistance = Infinity;

    const cameraPos = this.camera.position.clone();

    for (const frame of this.artFrames) {
      const dist = cameraPos.distanceTo(frame.position);

      if (dist < this.proximityDistance && dist < nearestDistance) {
        nearestDistance = dist;
        nearestId = frame.userData['artId'];
      }
    }

    if (nearestId !== null) {
      if (this.activeArtworkId !== nearestId) {
        this.activeArtworkId = nearestId;
        this.showArtworkPopup(nearestId);
      }
    } else {
      if (this.activeArtworkId !== null) {
        this.activeArtworkId = null;
        this.hideArtworkPopup();
      }
    }
  }

  private showArtworkPopup(id: number): void {
    const artwork = CURATORIAL_DATA.find(a => a.id === id) || null;
    this.currentArtwork = artwork;
    this.isPopupVisible = !!artwork;
  }

  private hideArtworkPopup(): void {
    this.isPopupVisible = false;
    this.currentArtwork = null;
  }

  public closePopup(): void {
    this.hideArtworkPopup();
  }

  public onPopupBackdropClick(): void {
    this.hideArtworkPopup();
  }

  private animate = () => {
    requestAnimationFrame(this.animate);

    const delta = this.clock.getDelta();
    const speed = 4.0;

    this.velocity.x -= this.velocity.x * 10.0 * delta;
    this.velocity.z -= this.velocity.z * 10.0 * delta;

    this.direction.z = Number(this.moveForward) - Number(this.moveBackward);
    this.direction.x = Number(this.moveRight) - Number(this.moveLeft);
    this.direction.normalize();

    if (this.moveForward || this.moveBackward)
      this.velocity.z -= this.direction.z * speed * delta;
    if (this.moveLeft || this.moveRight)
      this.velocity.x -= this.direction.x * speed * delta;

    const moveX = this.velocity.x * delta * 10;
    const moveZ = this.velocity.z * delta * 10;

    this.controls.moveRight(moveX);
    this.controls.moveForward(moveZ);

    const pos = this.controls.object.position;
    const limit = 9.3;
    pos.x = Math.max(-limit, Math.min(limit, pos.x));
    pos.z = Math.max(-limit, Math.min(limit, pos.z));
    pos.y = 1.7;

    this.renderer.render(this.scene, this.camera);
  };

  private onResize = () => {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
  this.renderer.setSize(window.innerWidth, window.innerHeight);
  };
}