import { Component, ElementRef, OnDestroy, OnInit, ViewChild } from '@angular/core';
import * as THREE from 'three';
import { PointerLockControls } from 'three/examples/jsm/controls/PointerLockControls.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

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

  private walls: THREE.Mesh[] = [];

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

  private initScene(): void {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0xffffff);

    // cámara
    this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
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
    const wallMaterial = new THREE.MeshStandardMaterial({ color: 0xffffff });
    const wallGeometry = new THREE.BoxGeometry(20, 5, 0.2);

    const backWall = new THREE.Mesh(wallGeometry, wallMaterial);
    backWall.position.set(0, 2.5, -10);
    this.scene.add(backWall);
    this.walls.push(backWall);

    const frontWall = new THREE.Mesh(wallGeometry, wallMaterial);
    frontWall.position.set(0, 2.5, 10);
    this.scene.add(frontWall);
    this.walls.push(frontWall);

    const leftWall = new THREE.Mesh(new THREE.BoxGeometry(0.2, 5, 20), wallMaterial);
    leftWall.position.set(-10, 2.5, 0);
    this.scene.add(leftWall);
    this.walls.push(leftWall);

    const rightWall = new THREE.Mesh(new THREE.BoxGeometry(0.2, 5, 20), wallMaterial);
    rightWall.position.set(10, 2.5, 0);
    this.scene.add(rightWall);
    this.walls.push(rightWall);


    // 🧱 Paredes interiores (centrales)
    const innerWallMaterial = new THREE.MeshStandardMaterial({ color: 0xffffff });
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


        // 🎨 Displays en paredes interiores (8 en total: 2 por cada cara)
    const innerFrameMaterial = new THREE.MeshStandardMaterial({ color: 0x5a3825 });
    const innerFrameGeometry = new THREE.BoxGeometry(2.5, 2.5, 0.2);

    // ---------------------- PARED INTERIOR IZQUIERDA ----------------------

    // Exterior (cara que mira al centro)
    const leftOuterTop = new THREE.Mesh(innerFrameGeometry, innerFrameMaterial);
    leftOuterTop.position.set(-3.55, 2.5, -2.5);
    leftOuterTop.rotation.y = Math.PI / 2;
    this.scene.add(leftOuterTop);

    const leftOuterBottom = new THREE.Mesh(innerFrameGeometry, innerFrameMaterial);
    leftOuterBottom.position.set(-3.55, 2.5, 2.5);
    leftOuterBottom.rotation.y = Math.PI / 2;
    this.scene.add(leftOuterBottom);

    // Interior (cara opuesta)
    const leftInnerTop = new THREE.Mesh(innerFrameGeometry, innerFrameMaterial);
    leftInnerTop.position.set(-3.05, 2.5, -2.5);
    leftInnerTop.rotation.y = -Math.PI / 2;
    this.scene.add(leftInnerTop);

    const leftInnerBottom = new THREE.Mesh(innerFrameGeometry, innerFrameMaterial);
    leftInnerBottom.position.set(-3.05, 2.5, 2.5);
    leftInnerBottom.rotation.y = -Math.PI / 2;
    this.scene.add(leftInnerBottom);

    // ---------------------- PARED INTERIOR DERECHA ----------------------

    // Exterior (cara que mira al centro)
    const rightOuterTop = new THREE.Mesh(innerFrameGeometry, innerFrameMaterial);
    rightOuterTop.position.set(3.55, 2.5, -2.5);
    rightOuterTop.rotation.y = -Math.PI / 2;
    this.scene.add(rightOuterTop);

    const rightOuterBottom = new THREE.Mesh(innerFrameGeometry, innerFrameMaterial);
    rightOuterBottom.position.set(3.55, 2.5, 2.5);
    rightOuterBottom.rotation.y = -Math.PI / 2;
    this.scene.add(rightOuterBottom);

    // Interior (cara opuesta)
    const rightInnerTop = new THREE.Mesh(innerFrameGeometry, innerFrameMaterial);
    rightInnerTop.position.set(3.05, 2.5, -2.5);
    rightInnerTop.rotation.y = Math.PI / 2;
    this.scene.add(rightInnerTop);

    const rightInnerBottom = new THREE.Mesh(innerFrameGeometry, innerFrameMaterial);
    rightInnerBottom.position.set(3.05, 2.5, 2.5);
    rightInnerBottom.rotation.y = Math.PI / 2;
    this.scene.add(rightInnerBottom);





    // techo
    const ceilingGeometry = new THREE.PlaneGeometry(20, 20);
    const ceilingMaterial = new THREE.MeshStandardMaterial({ color: 0xfafafa });
    const ceiling = new THREE.Mesh(ceilingGeometry, ceilingMaterial);
    ceiling.rotation.x = Math.PI / 2;
    ceiling.position.y = 5;
    this.scene.add(ceiling);

    // cuadros café (futuros displays)
    const frameMaterial = new THREE.MeshStandardMaterial({ color: 0x5a3825 });
    const frameGeometry = new THREE.BoxGeometry(3, 3, 0.2);

    for (let i = -6; i <= 6; i += 6) {
      const frame = new THREE.Mesh(frameGeometry, frameMaterial);
      frame.position.set(i, 2.5, -9.9);
      this.scene.add(frame);
    }

    for (let i = -6; i <= 6; i += 6) {
      const frameLeft = new THREE.Mesh(frameGeometry, frameMaterial);
      frameLeft.position.set(-9.9, 2.5, i);
      frameLeft.rotation.y = Math.PI / 2;
      this.scene.add(frameLeft);

      const frameRight = new THREE.Mesh(frameGeometry, frameMaterial);
      frameRight.position.set(9.9, 2.5, i);
      frameRight.rotation.y = -Math.PI / 2;
      this.scene.add(frameRight);
    }

        //  Cargador GLTF
    const loader = new GLTFLoader();

    // Banco (bench)
    loader.load('/assets/models/bench.glb', (gltf) => {
      const bench = gltf.scene;
      bench.scale.set(0.5, 2, 6);
      bench.position.set(0, 0, 0); // frente a la pared del fondo
      this.scene.add(bench);
    });

    //Lámpara colgante 
    loader.load('/assets/models/light.glb', (gltf) => {
      const lamp = gltf.scene;
      lamp.scale.set(2, 2, 2);
      lamp.position.set(0, 3.1, 0); // justo arriba del primer display
      this.scene.add(lamp);
    });

    //Lámpara de riel (en vertical en la mitad del pasillo)
    loader.load('/assets/models/ceiling_lamp.glb', (gltf) => {
      const lamp = gltf.scene;
      lamp.scale.set(6, 6, 6);

      // Posicionarla al centro del pasillo
      lamp.position.set(6.5, 4.8, 0);

      // Rotarla 90 grados para ponerla "en vertical" (alineada al eje Z)
      lamp.rotation.y = Math.PI / 2; // 🔄 giro de 90°

      this.scene.add(lamp);
    });

    //Lámpara de riel (en vertical en la mitad del pasillo)
    loader.load('/assets/models/ceiling_lamp.glb', (gltf) => {
      const lamp = gltf.scene;
      lamp.scale.set(6, 6, 6);

      // Posicionarla al centro del pasillo
      lamp.position.set(-6.5, 4.8, 0);

      // Rotarla 90 grados para ponerla "en vertical" (alineada al eje Z)
      lamp.rotation.y = Math.PI / 2; // 🔄 giro de 90°

      this.scene.add(lamp);
    });

     //Lámpara de mandera
      loader.load('/assets/models/large.glb', (gltf) => {
      console.log('✅ Lámpara cargada:', gltf);
      const woodlamp = gltf.scene;

      woodlamp.scale.set(5, 5, 5);

      // Posicionarla al centro del pasillo
      woodlamp.position.set(0, 0, 0);

      // Rotarla 90 grados para ponerla "en vertical" (alineada al eje Z)
      woodlamp.rotation.y = Math.PI / 2; // 🔄 giro de 90°

      this.scene.add(woodlamp);
    });


    // planta
    loader.load('/assets/models/plant.glb', (gltf) => {
      const plant = gltf.scene;
      plant.scale.set(1.2, 1.2, 1.2);
      plant.position.set(-2, 0, 3); // lateral del museo
      this.scene.add(plant);
    });

     // planta
    loader.load('/assets/models/plant.glb', (gltf) => {
      const plant = gltf.scene;
      plant.scale.set(1.5, 1.5, 1.5);
      plant.position.set(2, 0, -3); // lateral del museo
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

    // aplicar movimiento
    const moveX = this.velocity.x * delta * 10;
    const moveZ = this.velocity.z * delta * 10;

    this.controls.moveRight(moveX);
    this.controls.moveForward(moveZ);

    // limitar el movimiento dentro del museo (colisiones básicas)
    const pos = this.controls.object.position;
    const limit = 9.3; // distancia antes de pared
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