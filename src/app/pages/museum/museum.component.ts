import { Component, ElementRef, OnDestroy, OnInit, ViewChild } from '@angular/core';
import * as THREE from 'three';
import { PointerLockControls } from 'three/examples/jsm/controls/PointerLockControls.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { CommonModule } from '@angular/common';
import { CmaService } from '../../services/cma.service';

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

  private artFrames: THREE.Mesh[] = [];

  private proximityDistance = 2.0;
  private activeFrame: THREE.Mesh | null = null;

  public currentArtwork: ArtworkPopupData | null = null;
  public isPopupVisible = false;

  constructor(private cmaService: CmaService) {}

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

  // ==========================
  //    ESCENA 3D (init)
  // ==========================

  private initScene(): void {
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

    const backWall = new THREE.Mesh(new THREE.BoxGeometry(20, 5, 0.2), wallMat);
    backWall.position.set(0, 2.5, -10);
    this.scene.add(backWall);

    const frontWall = new THREE.Mesh(new THREE.BoxGeometry(20, 5, 0.2), wallMat);
    frontWall.position.set(0, 2.5, 10);
    this.scene.add(frontWall);

    const leftWall = new THREE.Mesh(new THREE.BoxGeometry(0.2, 5, 20), wallMat);
    leftWall.position.set(-10, 2.5, 0);
    this.scene.add(leftWall);

    const rightWall = new THREE.Mesh(new THREE.BoxGeometry(0.2, 5, 20), wallMat);
    rightWall.position.set(10, 2.5, 0);
    this.scene.add(rightWall);

    // Paredes interiores
    const innerWallGeom = new THREE.BoxGeometry(0.5, 5, 8);
    const innerWall1 = new THREE.Mesh(innerWallGeom, wallMat);
    innerWall1.position.set(-3.3, 2.5, 0);
    this.scene.add(innerWall1);

    const innerWall2 = new THREE.Mesh(innerWallGeom, wallMat);
    innerWall2.position.set(3.3, 2.5, 0);
    this.scene.add(innerWall2);

    // ==========================
    //     DISPLAYS / MARCOS
    // ==========================


    const innerIds = [
      '380063', // leftOuterTop
      '135614', // leftOuterBottom
      '151298', // leftInnerTop
      '135483', // leftInnerBottom
      '125249', // rightOuterTop
      '93014',  // rightOuterBottom
      '141639', // rightInnerTop
      '135428', // rightInnerBottom
    ];

    const backIds = ['170235', '111702', '115067']; // pared del fondo
    const leftIds = ['132618', '127080', '151298']; // pared izquierda
    const rightIds = ['135483', '93014', '125249']; // pared derecha

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

    loader.load('/assets/models/bench.glb', (g) => {
      const bench = g.scene;
      bench.scale.set(0.5, 2, 6);
      bench.position.set(0, 0, 0);
      this.scene.add(bench);
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

    loader.load('/assets/models/plant.glb', (g) => {
      const plant = g.scene;
      plant.scale.set(1.2, 1.2, 1.2);
      plant.position.set(-2, 0, 3);
      this.scene.add(plant);
    });

    loader.load('/assets/models/plant.glb', (g) => {
      const plant = g.scene;
      plant.scale.set(1.5, 1.5, 1.5);
      plant.position.set(2, 0, -3);
      this.scene.add(plant);
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
      case 'KeyS':
        this.moveForward = true;
        break;
      case 'KeyW':
        this.moveBackward = true;
        break;
      case 'KeyD':
        this.moveLeft = true;
        break;
      case 'KeyA':
        this.moveRight = true;
        break;
    }
  };

  private onKeyUp = (event: KeyboardEvent) => {
    switch (event.code) {
      case 'KeyS':
        this.moveForward = false;
        break;
      case 'KeyW':
        this.moveBackward = false;
        break;
      case 'KeyD':
        this.moveLeft = false;
        break;
      case 'KeyA':
        this.moveRight = false;
        break;
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
  }

  public onPopupBackdropClick(): void {
    this.closePopup();
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
    this.direction.x = Number(this.moveRight) - Number(this.moveLeft);
    this.direction.normalize();

    if (this.moveForward || this.moveBackward) {
      this.velocity.z -= this.direction.z * speed * delta;
    }
    if (this.moveLeft || this.moveRight) {
      this.velocity.x -= this.direction.x * speed * delta;
    }

    const moveX = this.velocity.x * delta * 10;
    const moveZ = this.velocity.z * delta * 10;

    this.controls.moveRight(moveX);
    this.controls.moveForward(moveZ);

    const pos = this.controls.object.position;
    const limit = 9.3;
    pos.x = Math.max(-limit, Math.min(limit, pos.x));
    pos.z = Math.max(-limit, Math.min(limit, pos.z));
    pos.y = 1.7;

    this.checkArtworkProximity();

    this.renderer.render(this.scene, this.camera);
  };

  private onResize = () => {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  };
}
