import { Component, ElementRef, OnDestroy, OnInit, ViewChild, effect } from '@angular/core';
import * as THREE from 'three';
import { PointerLockControls } from 'three/examples/jsm/controls/PointerLockControls.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { CommonModule } from '@angular/common';
import { CmaService } from '../../services/cma.service';
import { DescriptionTranslationService } from '../../services/description-translation.service';
import { LanguagePreferenceService } from '../../services/language-preference.service';

// Datos que usa el popup de curaduría (todos vienen de la CMA API)
interface ArtworkPopupData {
  id: string;
  title: string;
  artist: string;
  year?: string;
  technique?: string;
  description?: string;
  image: string; // url (proxy) de la imagen
}

@Component({
  selector: 'app-museum',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './museum.component.html',
  styleUrls: ['./museum.component.css'],
})
export class MuseumComponent implements OnInit, OnDestroy {
  @ViewChild('museumContainer', { static: true }) museumContainer!: ElementRef<HTMLDivElement>;

  // === THREE.js core ===
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
  private walls: THREE.Mesh[] = [];

  private artFrames: THREE.Mesh[] = [];

  private proximityDistance = 2.0;
  private activeFrame: THREE.Mesh | null = null;

  public currentArtwork: ArtworkPopupData | null = null;
  public isPopupVisible = false;
  public translatedDescription: string | null = null;
  public translationError: string | null = null;
  public isTranslating = false;

  constructor(
    private cmaService: CmaService,
    private readonly translationService: DescriptionTranslationService,
    private readonly languagePreference: LanguagePreferenceService
  ) {
    effect(() => {
      const lang = this.languagePreference.language();
      if (this.isPopupVisible && this.currentArtwork?.description && lang) {
        this.translateCurrentArtwork();
      }
    });
  }

  ngOnInit(): void {
    this.initScene();
    this.animate();
    this.addEventListeners();
  }

  ngOnDestroy(): void {
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    window.removeEventListener('resize', this.onResize);
  }

  // ==========================
  //   HELPERS DE CURADURÍA
  // ==========================

  /** Mapea el JSON de CMA a la estructura del popup */
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

  // ==========================
  //   MARCOS / CUADROS
  // ==========================

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

// Crea un AABB del objeto ya transformado y lo añade a colliders.
// Usa "inflate" para dar un pequeño margen (en metros).
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





  private createFrame(position: THREE.Vector3, rotationY: number): THREE.Mesh {
  const width = 2.8;
  const height = 3;
  const depth = 0.1;

  const geometry = new THREE.BoxGeometry(width, height, depth);

  const materials = [
    new THREE.MeshStandardMaterial({ color: 0x4a2c13 }), // right
    new THREE.MeshStandardMaterial({ color: 0x4a2c13 }), // left
    new THREE.MeshStandardMaterial({ color: 0x4a2c13 }), // top
    new THREE.MeshStandardMaterial({ color: 0x4a2c13 }), // bottom
    new THREE.MeshStandardMaterial({ color: 0xffffff }), // front reemplazado por imagen
    new THREE.MeshStandardMaterial({ color: 0x4a2c13 }), // back
  ];

  const frame = new THREE.Mesh(geometry, materials);
  frame.position.copy(position);
  frame.rotation.y = rotationY;

  this.scene.add(frame);
  this.artFrames.push(frame);

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



  /**
   * Llama al backend CMA para una obra por ID y la aplica sobre el marco,
   * además de guardar la info de curaduría para el popup.
   */
  private addArtworkToFrame(frame: THREE.Mesh, artworkId: string): void {
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


  // ==========================
  //    ESCENA 3D (init)
  // ==========================

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
    this.camera.position.set(0, 1.7, 0);

    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
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
      new THREE.MeshStandardMaterial({ color: 0xdddddd })
    );
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    this.scene.add(floor);

    // Paredes exteriores
    const wallMat = new THREE.MeshStandardMaterial({ color: 0xffffff });
    // paredes blancas (con colisión)
    const wallGeometry = new THREE.BoxGeometry(20, 5, 0.2);

    const backWall = new THREE.Mesh(new THREE.BoxGeometry(20, 5, 0.2), wallMat);
    backWall.position.set(0, 2.5, -10);
    this.scene.add(backWall);
    this.walls.push(backWall);

    const frontWall = new THREE.Mesh(new THREE.BoxGeometry(20, 5, 0.2), wallMat);
    frontWall.position.set(0, 2.5, 10);
    this.scene.add(frontWall);
    this.walls.push(frontWall);

    // —— Construye cajas AABB de todas las paredes ——
    // (las hacemos un poco “infinitas” en Y para no preocuparnos por la altura)
  

 // ====== PUERTA PEGADA A LA ÚLTIMA OBRA DE LA PARED IZQUIERDA ======
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




    const rightWall = new THREE.Mesh(new THREE.BoxGeometry(0.2, 5, 20), wallMat);
    rightWall.position.set(10, 2.5, 0);
    this.scene.add(rightWall);

    // 🧱 Paredes interiores (centrales)
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

    // ==========================
    //     DISPLAYS / MARCOS
    // ==========================


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
    const rightIds = ['132618', '115067', '127080']; // pared derecha

    // -------- PAREDES INTERIORES (8) --------
    let idx = 0;

    // Pared interior izquierda (x = -3.55) – CARA HACIA EL CENTRO (+X)
    this.addArtworkToFrame(
      this.createFrame(new THREE.Vector3(-3.55, 2.5, -2.5), -Math.PI / 2),
      innerIds[idx++]
    );
    this.addArtworkToFrame(
      this.createFrame(new THREE.Vector3(-3.55, 2.5, 2.5), -Math.PI / 2),
      innerIds[idx++]
    );

    // Pared interior izquierda (x = -3.05) – CARA HACIA AFUERA (–X)
    this.addArtworkToFrame(
      this.createFrame(new THREE.Vector3(-3.05, 2.5, -2.5), Math.PI / 2),
      innerIds[idx++]
    );
    this.addArtworkToFrame(
      this.createFrame(new THREE.Vector3(-3.05, 2.5, 2.5), Math.PI / 2),
      innerIds[idx++]
    );

    // Pared interior derecha (x = 3.55) – CARA HACIA EL CENTRO (–X)
    this.addArtworkToFrame(
      this.createFrame(new THREE.Vector3(3.55, 2.5, -2.5), Math.PI / 2),
      innerIds[idx++]
    );
    this.addArtworkToFrame(
      this.createFrame(new THREE.Vector3(3.55, 2.5, 2.5), Math.PI / 2),
      innerIds[idx++]
    );

    // Pared interior derecha (x = 3.05) – CARA HACIA AFUERA (+X)
    this.addArtworkToFrame(
      this.createFrame(new THREE.Vector3(3.05, 2.5, -2.5), -Math.PI / 2),
      innerIds[idx++]
    );
    this.addArtworkToFrame(
      this.createFrame(new THREE.Vector3(3.05, 2.5, 2.5), -Math.PI / 2),
      innerIds[idx++]
    );

    // -------- PAREDES EXTERIORES (9) --------

    // Pared del fondo (z = -9.9), x = -6, 0, 6
    for (let i = 0; i < 3; i++) {
      const x = -6 + i * 6;
      const frame = this.createFrame(new THREE.Vector3(x, 2.5, -9.9), 0);
      this.addArtworkToFrame(frame, backIds[i]);
    }

    // Pared izquierda (x = -9.9), z = -6, 0, 6
    for (let i = 0; i < 3; i++) {
      const z = -6 + i * 6;
      const frame = this.createFrame(
        new THREE.Vector3(-9.9, 2.5, z),
        Math.PI / 2
      );
      this.addArtworkToFrame(frame, leftIds[i]);
    }

    // Pared derecha (x = 9.9), z = -6, 0, 6
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

    // ==========================
    //      MODELOS GLTF
    // ==========================
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

  // ==========================
  //   EVENTOS / CONTROLES
  // ==========================

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

  // ==========================
  //   PROXIMIDAD / POPUP
  // ==========================

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
      // Entramos a una nueva obra
      this.activeFrame = nearestFrame;
      this.currentArtwork = nearestFrame.userData['popup'] as ArtworkPopupData;
      this.translateCurrentArtwork();
      this.isPopupVisible = true;
    } else if (!nearestFrame && this.activeFrame) {
      // Nos alejamos de todas
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

  private translateCurrentArtwork(): void {
    if (!this.currentArtwork?.description) {
      this.translatedDescription = null;
      this.translationError = null;
      return;
    }

    const targetLanguage = this.languagePreference.language();
    const description = this.currentArtwork.description;

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

  // ==========================
  //    LOOP DE ANIMACIÓN
  // ==========================

  private animate = () => {
    requestAnimationFrame(this.animate);

  const delta = this.clock.getDelta();
  const speed = 4.0;

  this.velocity.x -= this.velocity.x * 10.0 * delta;
  this.velocity.z -= this.velocity.z * 10.0 * delta;

  this.direction.z = Number(this.moveForward) - Number(this.moveBackward);
  this.direction.x = Number(this.moveRight)  - Number(this.moveLeft);
  this.direction.normalize();

    if (this.moveForward || this.moveBackward) {
      this.velocity.z -= this.direction.z * speed * delta;
    }
    if (this.moveLeft || this.moveRight) {
      this.velocity.x -= this.direction.x * speed * delta;
    }

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

    this.checkArtworkProximity();

    this.renderer.render(this.scene, this.camera);
  
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
