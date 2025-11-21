import { Component, ElementRef, OnDestroy, OnInit, ViewChild } from '@angular/core';
import * as THREE from 'three';
import { PointerLockControls } from 'three/examples/jsm/controls/PointerLockControls.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { CmaService } from '../../services/cma.service';

@Component({
  selector: 'app-museum',
  templateUrl: './museum.component.html',
  styleUrls: ['./museum.component.css']
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
  private readonly PLAYER_RADIUS = 0.35;  // radio “cintura” del jugador
    // ----- CONFIG PARA LÍMITES DE MOVIMIENTO (añade arriba con el resto de campos) -----
  private minX = -9.3; private maxX =  9.3;
  private minZ = -9.3; private maxZ =  9.3;
  private playerRadius = 0.35;        // “grosor” del jugador
  private colliders: THREE.Box3[] = []; // cajas de colisión estáticas

  private leftFrames: THREE.Mesh[] = [];
  private backFrames: THREE.Mesh[] = [];
  private rightFrames: THREE.Mesh[] = [];
  

  private walls: THREE.Mesh[] = [];
  

  constructor(private cmaService: CmaService) {}

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

private resolveCollisions(attempt: THREE.Vector3) {
  const out = attempt.clone();
  const playerTop = 1.8; // altura de la cabeza aprox

  for (const wall of this.walls) {
    const box = new THREE.Box3().setFromObject(wall);

    // ⬇️ Si TODO el collider está por encima de la cabeza, ignóralo (ej. dinteles)
    if (box.min.y > playerTop) continue;

    const min = box.min, max = box.max;
    this.pushOutFromAABBXZ(out, min.x, max.x, min.z, max.z);
  }

  return out;
}




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

// Colgar glb del techo: centra por AABB y posiciona bajo y=5
private addCeilingLamp(path: string, x: number, z: number, opts?: {clear?: number, scale?: number, rotY?: number}) {
  const loader = new GLTFLoader();
  const clear = opts?.clear ?? 0.12;         // separación del techo
  const scl   = opts?.scale ?? 1.0;
  const rotY  = opts?.rotY ?? 0;

  loader.load(path, (gltf) => {
    const lamp = gltf.scene;

    // 1) Wrapper para mover el modelo al centro sin perder el pivote
    const wrap = new THREE.Group();

    // 2) Calcular AABB y centrar el modelo dentro del wrapper
    const box = new THREE.Box3().setFromObject(lamp);
    const size = new THREE.Vector3(); box.getSize(size);
    const center = new THREE.Vector3(); box.getCenter(center);

    // Mueve el modelo para que su centro quede en (0,0,0) y la base quede en y=0
    lamp.position.sub(center);
    lamp.position.y -= (-size.y / 2);  // sube el modelo medio alto → base en y=0

    // Sombra opcional
    lamp.traverse(o => {
      if ((o as THREE.Mesh).isMesh) {
        const m = o as THREE.Mesh;
        m.castShadow = true;
        m.receiveShadow = false;
      }
    });

    wrap.add(lamp);

    // 3) Escala el WRAPPER (evita mover offsets internos)
    wrap.scale.setScalar(scl);

    // 4) Recalcular alto final (con la escala aplicada)
    const box2 = new THREE.Box3().setFromObject(wrap);
    const size2 = new THREE.Vector3(); box2.getSize(size2);
    const lampH = size2.y;

    // 5) Posicionar bajo el techo (y=5)
    const ceilingY = 5;
    wrap.position.set(x, ceilingY - clear - lampH, z);
    wrap.rotation.y = rotY;

    this.scene.add(wrap);
  },
  undefined,
  (e) => console.error('No se pudo cargar lámpara:', path, e));
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


// Empuja un círculo (jugador) fuera de un AABB en XZ
private pushOutFromAABBXZ(pos: THREE.Vector3, minX: number, maxX: number, minZ: number, maxZ: number) {
  const r = this.PLAYER_RADIUS;

  // Si NO hay intersección, nada que hacer
  if (pos.x + r <= minX || pos.x - r >= maxX || pos.z + r <= minZ || pos.z - r >= maxZ) {
    return pos;
  }

  // Penetraciones en cada lado (positivas = empuje necesario)
  const penLeft   = (maxX - (pos.x - r)); // choca por la izquierda del AABB -> empujar +x
  const penRight  = ((pos.x + r) - minX); // choca por la derecha del AABB  -> empujar -x
  const penTop    = (maxZ - (pos.z - r)); // choca por arriba (en -z/+z depende) -> empujar +z
  const penBottom = ((pos.z + r) - minZ); // choca por abajo -> empujar -z

  // Elegimos el eje con menor empuje necesario
  const minPen = Math.min(penLeft, penRight, penTop, penBottom);

  if (minPen === penLeft)      pos.x += penLeft;
  else if (minPen === penRight) pos.x -= penRight;
  else if (minPen === penTop)   pos.z += penTop;
  else                          pos.z -= penBottom;

  return pos;
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

    // Color azul rey
    const WALL_COLOR = 0xEEEAE6 //0xFAFAFA  //0xDCD4CB  //0xEEEAE6   //0xB0BEC5  //0xCFD8DC    // 0xF5F5F5  //0x2B2B2B
; // royal blue

    // Un SOLO material para TODAS las paredes
    const wallMaterial = new THREE.MeshStandardMaterial({ color: WALL_COLOR });
    
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

    // renderer
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    document.getElementById('museum-container')?.appendChild(this.renderer.domElement);

    // controles tipo juego (pointer lock)
    this.controls = new PointerLockControls(this.camera, this.renderer.domElement);
    this.scene.add(this.controls.object);

    // click para capturar el mouse
    this.renderer.domElement.addEventListener('click', () => this.controls.lock());

    // luces
    const hemiLight = new THREE.HemisphereLight(0xffffff, 0x888888, 1.0);
    this.scene.add(hemiLight);

    const dirLight = new THREE.DirectionalLight(0xffffff, 0.6);
    dirLight.position.set(5, 10, 5);
    this.scene.add(dirLight);

    // piso
    const floorGeometry = new THREE.PlaneGeometry(20, 20);
    const floorMaterial = new THREE.MeshStandardMaterial({ color: 0xdddddd });
    const floor = new THREE.Mesh(floorGeometry, floorMaterial);
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    this.scene.add(floor);

    // paredes blancas (con colisión)
    const wallGeometry = new THREE.BoxGeometry(20, 5, 0.2);

    const backWall = new THREE.Mesh(wallGeometry, wallMaterial);
    backWall.position.set(0, 2.5, -10);
    this.scene.add(backWall);
    this.walls.push(backWall);

    const frontWall = new THREE.Mesh(wallGeometry, wallMaterial);
    frontWall.position.set(0, 2.5, 10);
    this.scene.add(frontWall);
    this.walls.push(frontWall);

    // —— Construye cajas AABB de todas las paredes ——
    // (las hacemos un poco “infinitas” en Y para no preocuparnos por la altura)
    this.colliders = this.walls.map(w => {
      const box = new THREE.Box3().setFromObject(w);
      box.min.y = -9999;
      box.max.y = +9999;
      return box;
    });

 // ====== PUERTA PEGADA A LA ÚLTIMA OBRA DE LA PARED IZQUIERDA ======
{
  const wallThick = 0.2;
  const wallH     = 5;
  const wallLen   = 20;
  const wallX     = -10;

  // Usa los marcos ya creados; si no hay, asume que el último está en z=6
  const lfZs = this.leftFrames.map(f => f.position.z);
  const lastLeftZ = lfZs.length ? Math.max(...lfZs) : 6;
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

  // ====== SALA 2 ALINEADA ======
  const room2Width = 8, room2Depth = 12, room2H = 5, gap = 0.01;
  const room2CenterX = wallX - wallThick/2 - room2Width/2 - gap;
  const room2CenterZ = doorZ;

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

  const west2  = new THREE.Mesh(new THREE.BoxGeometry(0.2, room2H, room2Depth), wallMaterial);
  west2.position.set(room2CenterX - room2Width/2, room2H/2, room2CenterZ);
  this.scene.add(west2); this.walls.push(west2);

  const north2 = new THREE.Mesh(new THREE.BoxGeometry(room2Width, room2H, 0.2), wallMaterial);
  north2.position.set(room2CenterX, room2H/2, room2CenterZ - room2Depth/2);
  this.scene.add(north2); this.walls.push(north2);

  const south2 = new THREE.Mesh(new THREE.BoxGeometry(room2Width, room2H, 0.2), wallMaterial);
  south2.position.set(room2CenterX, room2H/2, room2CenterZ + room2Depth/2);
  this.scene.add(south2); this.walls.push(south2);


  // === PARED ESTE de la sala 2, con el MISMO hueco de puerta ===
{
  const east2X = room2CenterX + room2Width / 2;  // cara Este de la sala 2
  const thick  = 0.2;                            // igual que las demás
  const ezMin  = room2CenterZ - room2Depth / 2;
  const ezMax  = room2CenterZ + room2Depth / 2;
  const ezStart = doorZ - doorW / 2;             // inicio del hueco (Z)
  const ezEnd   = doorZ + doorW / 2;             // fin del hueco (Z)

  // Jamba izquierda (desde zMin hasta el inicio del hueco)
  const leftLen = ezStart - ezMin;
  if (leftLen > 0) {
    const eastLeft = new THREE.Mesh(
      new THREE.BoxGeometry(thick, room2H, leftLen),
      wallMaterial
    );
    eastLeft.position.set(east2X, room2H / 2, (ezMin + ezStart) / 2);
    this.scene.add(eastLeft); this.walls.push(eastLeft);
  }

  // Jamba derecha (desde el fin del hueco hasta zMax)
  const rightLen = ezMax - ezEnd;
  if (rightLen > 0) {
    const eastRight = new THREE.Mesh(
      new THREE.BoxGeometry(thick, room2H, rightLen),
      wallMaterial
    );
    eastRight.position.set(east2X, room2H / 2, (ezEnd + ezMax) / 2);
    this.scene.add(eastRight); this.walls.push(eastRight);
  }

  // Dintel (por encima de la puerta)
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




    const rightWall = new THREE.Mesh(new THREE.BoxGeometry(0.2, 5, 20), wallMaterial);
    rightWall.position.set(10, 2.5, 0);
    this.scene.add(rightWall);
    this.walls.push(rightWall);

    // 🧱 Paredes interiores (centrales)
    const innerWallMaterial = wallMaterial;
    const innerWallGeometry = new THREE.BoxGeometry(0.5, 5, 8);

    // Primera pared interior (alineada con cuadros de la izquierda)
    const innerWall1 = new THREE.Mesh(innerWallGeometry, innerWallMaterial);
    innerWall1.position.set(-3.3, 2.5, 0);
    this.scene.add(innerWall1);
    this.walls.push(innerWall1);

    // Segunda pared interior (alineada con cuadros de la derecha)
    const innerWall2 = new THREE.Mesh(innerWallGeometry, innerWallMaterial);
    innerWall2.position.set(3.3, 2.5, 0);
    this.scene.add(innerWall2);
    this.walls.push(innerWall2);

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
   this.addCeilingLamp('/assets/models/large.glb', 0, -7.8, { scale: 2, rotY: 0, clear: -0.8 });

    //  Cargador GLTF
    const loader = new GLTFLoader();

    // Banco (bench)
    loader.load('/assets/models/bench.glb', (gltf) => {
      const bench = gltf.scene;
      bench.scale.set(0.5, 2, 6);
      bench.position.set(0, 0, 0); // frente a la pared del fondo
      this.scene.add(bench);
    });

    // Lámpara colgante
    loader.load('/assets/models/light.glb', (gltf) => {
      const lamp = gltf.scene;
      lamp.scale.set(2, 2, 2);
      lamp.position.set(0, 3.1, 0); // justo arriba del primer display
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
    case 'KeyW': this.moveForward = true;  break;
    case 'KeyS': this.moveBackward = true; break;
    case 'KeyA': this.moveLeft = true;     break;
    case 'KeyD': this.moveRight = true;    break;
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

 private animate = () => {
  requestAnimationFrame(this.animate);

  const delta = this.clock.getDelta();
  const speed = 4.0;

  this.velocity.x -= this.velocity.x * 10.0 * delta;
  this.velocity.z -= this.velocity.z * 10.0 * delta;

  this.direction.z = Number(this.moveForward) - Number(this.moveBackward);
  this.direction.x = Number(this.moveRight)  - Number(this.moveLeft);
  this.direction.normalize();

  if (this.moveForward || this.moveBackward)
    this.velocity.z -= this.direction.z * speed * delta;
  if (this.moveLeft || this.moveRight)
    this.velocity.x -= this.direction.x * speed * delta;

  // ===== A PARTIR DE AQUÍ, NUEVO BLOQUE =====
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

  // delta en mundo (adelante es -moveForwardAmt)
  const moveVec = new THREE.Vector3()
    .addScaledVector(forward, -moveForwardAmt)
    .addScaledVector(right,    moveRightAmt);

  // intento de posición y resolución de colisiones
  // intento de nueva posición
    const attempt = this.controls.object.position.clone().add(moveVec);

    // colisión + clamps
    const resolved = this.resolveCollisions(attempt);

    // ⬇️ Usa los límites dinámicos, no -10/10 fijos
    resolved.x = Math.max(this.minX, Math.min(this.maxX, resolved.x));
    resolved.z = Math.max(this.minZ, Math.min(this.maxZ, resolved.z));

    this.controls.object.position.copy(resolved);
    this.controls.object.position.y = 1.7;

  // ===== FIN DEL BLOQUE NUEVO =====

  this.renderer.render(this.scene, this.camera);
};

  private onResize = () => {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
  this.renderer.setSize(window.innerWidth, window.innerHeight);
  };
}