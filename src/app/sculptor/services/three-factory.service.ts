import { Injectable } from '@angular/core';
import {
  ACESFilmicToneMapping,
  AxesHelper,
  Box3,
  Color,
  DirectionalLight,
  Group,
  GridHelper,
  PCFSoftShadowMap,
  PerspectiveCamera,
  Scene,
  SRGBColorSpace,
  Vector3,
  WebGLRenderer,
} from 'three';

@Injectable({ providedIn: 'root' })
export class ThreeFactoryService {
  createRenderer(canvas: HTMLCanvasElement): WebGLRenderer {
    const renderer = new WebGLRenderer({
      canvas,
      antialias: true,
      alpha: false,
      preserveDrawingBuffer: true,
    });
    renderer.outputColorSpace = SRGBColorSpace;
    renderer.toneMapping = ACESFilmicToneMapping;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = PCFSoftShadowMap;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(canvas.clientWidth, canvas.clientHeight, false);
    return renderer;
  }

  createCamera(aspect: number): PerspectiveCamera {
    const camera = new PerspectiveCamera(45, aspect, 0.1, 1000);
    camera.position.set(8, 8, 8);
    return camera;
  }

  createGrid(size = 20, divisions = 20): GridHelper {
    const grid = new GridHelper(size, divisions, 0x444444, 0x222222);
    grid.material.depthWrite = false;
    grid.userData['helper'] = true;
    return grid;
  }

  createAxes(size = 5): AxesHelper {
    const axes = new AxesHelper(size);
    axes.userData['helper'] = true;
    return axes;
  }

  createStudioLights(): Group {
    const group = new Group();
    group.name = 'StudioLights';
    group.userData['helper'] = true;

    const keyLight = new DirectionalLight(0xffffff, 1);
    keyLight.castShadow = true;
    keyLight.position.set(5, 10, 7);
    keyLight.shadow.bias = -0.0001;

    const fillLight = new DirectionalLight(0xfff1e0, 0.45);
    fillLight.position.set(-6, 4, -3);

    const rimLight = new DirectionalLight(0xcfd8ff, 0.35);
    rimLight.position.set(2, 6, -6);

    group.add(keyLight, fillLight, rimLight);
    return group;
  }

  frameScene(scene: Scene, camera: PerspectiveCamera, target: Vector3): void {
    const box = new Box3().setFromObject(scene, false);
    if (!isFinite(box.min.length()) || !isFinite(box.max.length())) {
      return;
    }
    const size = box.getSize(new Vector3());
    const center = box.getCenter(new Vector3());
    const maxDim = Math.max(size.x, size.y, size.z);
    const distance = maxDim === 0 ? 10 : maxDim * 1.5;
    camera.position.copy(center);
    camera.position.add(new Vector3(distance, distance, distance));
    camera.near = distance / 100;
    camera.far = distance * 10;
    camera.updateProjectionMatrix();
    target.copy(center);
  }

  setSceneBackground(scene: Scene, hex = '#0f0f14'): void {
    scene.background = new Color(hex);
  }
}
