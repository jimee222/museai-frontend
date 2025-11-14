import { Component, ElementRef, OnDestroy, OnInit, ViewChild } from '@angular/core';
import * as THREE from 'three';
import { PointerLockControls } from 'three/examples/jsm/controls/PointerLockControls.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { CURATORIAL_DATA } from '../../data/curatorial-data';
import { CuratorialArtwork } from '../../interfaces/curatorial-artwork.interface';
import { CommonModule } from '@angular/common';

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

  private walls: THREE.Mesh[] = [];

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

  private createArtworkFrame(
    position: THREE.Vector3,
    rotationY: number,
    inner: boolean
  ): void {
    const size = inner ? 2.5 : 3;
    const depth = 0.2;

    const geometry = new THREE.BoxGeometry(size, size, depth);

    const artwork: CuratorialArtwork | undefined = CURATORIAL_DATA[this.artworkIndex];
    if (!artwork) return;

    const texture = this.textureLoader.load(artwork.image);
    const material = new THREE.MeshStandardMaterial({ map: texture });

    const frame = new THREE.Mesh(geometry, material);
    frame.position.copy(position);
    frame.rotation.y = rotationY;

    frame.userData['artId'] = artwork.id;

    this.artFrames.push(frame);
    this.scene.add(frame);

    this.artworkIndex++;
  }

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

    // paredes interiores
    const innerWallGeometry = new THREE.BoxGeometry(0.5, 5, 8);

    const innerWall1 = new THREE.Mesh(innerWallGeometry, wallMaterial);
    innerWall1.position.set(-3.3, 2.5, 0);
    this.scene.add(innerWall1);

    const innerWall2 = new THREE.Mesh(innerWallGeometry, wallMaterial);
    innerWall2.position.set(3.3, 2.5, 0);
    this.scene.add(innerWall2);

    // Displays interiores
    this.createArtworkFrame(new THREE.Vector3(-3.55, 2.5, -2.5), Math.PI / 2, true);
    this.createArtworkFrame(new THREE.Vector3(-3.55, 2.5, 2.5), Math.PI / 2, true);

    this.createArtworkFrame(new THREE.Vector3(-3.05, 2.5, -2.5), -Math.PI / 2, true);
    this.createArtworkFrame(new THREE.Vector3(-3.05, 2.5, 2.5), -Math.PI / 2, true);

    this.createArtworkFrame(new THREE.Vector3(3.55, 2.5, -2.5), -Math.PI / 2, true);
    this.createArtworkFrame(new THREE.Vector3(3.55, 2.5, 2.5), -Math.PI / 2, true);

    this.createArtworkFrame(new THREE.Vector3(3.05, 2.5, -2.5), Math.PI / 2, true);
    this.createArtworkFrame(new THREE.Vector3(3.05, 2.5, 2.5), Math.PI / 2, true);

    // Displays exteriores
    this.createArtworkFrame(new THREE.Vector3(-6, 2.5, -9.9), 0, false);
    this.createArtworkFrame(new THREE.Vector3(0, 2.5, -9.9), 0, false);
    this.createArtworkFrame(new THREE.Vector3(6, 2.5, -9.9), 0, false);

    this.createArtworkFrame(new THREE.Vector3(-9.9, 2.5, -6), Math.PI / 2, false);
    this.createArtworkFrame(new THREE.Vector3(-9.9, 2.5, 0), Math.PI / 2, false);
    this.createArtworkFrame(new THREE.Vector3(-9.9, 2.5, 6), Math.PI / 2, false);

    this.createArtworkFrame(new THREE.Vector3(9.9, 2.5, -6), -Math.PI / 2, false);
    this.createArtworkFrame(new THREE.Vector3(9.9, 2.5, 0), -Math.PI / 2, false);
    this.createArtworkFrame(new THREE.Vector3(9.9, 2.5, 6), -Math.PI / 2, false);

    const ceiling = new THREE.Mesh(
      new THREE.PlaneGeometry(20, 20),
      new THREE.MeshStandardMaterial({ color: 0xfafafa })
    );
    ceiling.rotation.x = Math.PI / 2;
    ceiling.position.y = 5;
    this.scene.add(ceiling);

    const loader = new GLTFLoader();

    loader.load('/assets/models/bench.glb', g => {
      const bench = g.scene;
      bench.scale.set(0.5, 2, 6);
      bench.position.set(0, 0, 0);
      this.scene.add(bench);
    });

    loader.load('/assets/models/light.glb', g => {
      const lamp = g.scene;
      lamp.scale.set(2, 2, 2);
      lamp.position.set(0, 3.1, 0);
      this.scene.add(lamp);
    });

    loader.load('/assets/models/ceiling_lamp.glb', g => {
      const lamp = g.scene;
      lamp.scale.set(6, 6, 6);
      lamp.position.set(6.5, 4.8, 0);
      lamp.rotation.y = Math.PI / 2;
      this.scene.add(lamp);
    });

    loader.load('/assets/models/ceiling_lamp.glb', g => {
      const lamp = g.scene;
      lamp.scale.set(6, 6, 6);
      lamp.position.set(-6.5, 4.8, 0);
      lamp.rotation.y = Math.PI / 2;
      this.scene.add(lamp);
    });

    loader.load('/assets/models/large.glb', g => {
      const wood = g.scene;
      wood.scale.set(5, 5, 5);
      wood.position.set(0, 0, 0);
      wood.rotation.y = Math.PI / 2;
      this.scene.add(wood);
    });

    loader.load('/assets/models/plant.glb', g => {
      const plant = g.scene;
      plant.scale.set(1.2, 1.2, 1.2);
      plant.position.set(-2, 0, 3);
      this.scene.add(plant);
    });

    loader.load('/assets/models/plant.glb', g => {
      const plant = g.scene;
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

    this.checkArtworkProximity();


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