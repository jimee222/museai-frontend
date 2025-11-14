import {
  BufferGeometry,
  Float32BufferAttribute,
  Matrix3,
  Matrix4,
  Mesh,
  Vector3,
} from 'three';

// Minimal BSP-based CSG implementation adapted for Three.js meshes.
class CSGVertex {
  constructor(public position: Vector3, public normal: Vector3) {}

  clone(): CSGVertex {
    return new CSGVertex(this.position.clone(), this.normal.clone());
  }

  flip(): void {
    this.normal.multiplyScalar(-1);
  }

  interpolate(other: CSGVertex, t: number): CSGVertex {
    return new CSGVertex(
      this.position.clone().lerp(other.position, t),
      this.normal.clone().lerp(other.normal, t),
    );
  }
}

class CSGPlane {
  normal: Vector3;
  w: number;

  constructor(normal: Vector3, w: number) {
    this.normal = normal;
    this.w = w;
  }

  static fromPoints(a: Vector3, b: Vector3, c: Vector3): CSGPlane {
    const n = new Vector3().subVectors(b, a).cross(new Vector3().subVectors(c, a)).normalize();
    return new CSGPlane(n, n.dot(a));
  }

  clone(): CSGPlane {
    return new CSGPlane(this.normal.clone(), this.w);
  }

  flip(): void {
    this.normal.multiplyScalar(-1);
    this.w = -this.w;
  }

  splitPolygon(
    polygon: CSGPolygon,
    coplanarFront: CSGPolygon[],
    coplanarBack: CSGPolygon[],
    front: CSGPolygon[],
    back: CSGPolygon[],
  ): void {
    const EPSILON = 1e-5;
    const types: number[] = [];
    const vertices = polygon.vertices;
    let typeMask = 0;
    for (const vertex of vertices) {
      const t = this.normal.dot(vertex.position) - this.w;
      const type = t < -EPSILON ? -1 : t > EPSILON ? 1 : 0;
      types.push(type);
      typeMask |= type;
    }

    switch (typeMask) {
      case 0:
        (this.normal.dot(polygon.plane.normal) > 0 ? coplanarFront : coplanarBack).push(polygon);
        break;
      case 1:
        front.push(polygon);
        break;
      case -1:
        back.push(polygon);
        break;
      default:
        const f: CSGVertex[] = [];
        const b: CSGVertex[] = [];
        for (let i = 0; i < vertices.length; i++) {
          const j = (i + 1) % vertices.length;
          const ti = types[i];
          const tj = types[j];
          const vi = vertices[i];
          const vj = vertices[j];
          if (ti >= 0) {
            f.push(vi);
          }
          if (ti <= 0) {
            b.push(vi);
          }
          if ((ti | tj) === 0 || ti === tj) {
            continue;
          }
          const t = (this.w - this.normal.dot(vi.position)) / this.normal.dot(new Vector3().subVectors(vj.position, vi.position));
          const v = vi.interpolate(vj, t);
          f.push(v);
          b.push(v);
        }
        if (f.length >= 3) {
          front.push(new CSGPolygon(f, polygon.shared));
        }
        if (b.length >= 3) {
          back.push(new CSGPolygon(b, polygon.shared));
        }
        break;
    }
  }
}

class CSGPolygon {
  plane: CSGPlane;

  constructor(public vertices: CSGVertex[], public shared: unknown) {
    this.plane = CSGPlane.fromPoints(vertices[0].position, vertices[1].position, vertices[2].position);
  }

  clone(): CSGPolygon {
    return new CSGPolygon(
      this.vertices.map((v) => v.clone()),
      this.shared,
    );
  }

  flip(): void {
    this.vertices.reverse().forEach((vertex) => vertex.flip());
    this.plane.flip();
  }
}

class CSGNode {
  plane: CSGPlane | null = null;
  front: CSGNode | null = null;
  back: CSGNode | null = null;
  polygons: CSGPolygon[] = [];

  constructor(polygons?: CSGPolygon[]) {
    if (polygons) {
      this.build(polygons);
    }
  }

  clone(): CSGNode {
    const node = new CSGNode();
    node.plane = this.plane && this.plane.clone();
    node.front = this.front && this.front.clone();
    node.back = this.back && this.back.clone();
    node.polygons = this.polygons.map((p) => p.clone());
    return node;
  }

  invert(): void {
    for (const polygon of this.polygons) {
      polygon.flip();
    }
    this.plane?.flip();
    this.front?.invert();
    this.back?.invert();
    const temp = this.front;
    this.front = this.back;
    this.back = temp;
  }

  clipPolygons(polygons: CSGPolygon[]): CSGPolygon[] {
    if (!this.plane) {
      return polygons.slice();
    }
    const front: CSGPolygon[] = [];
    const back: CSGPolygon[] = [];
    for (const polygon of polygons) {
      this.plane.splitPolygon(polygon, front, back, front, back);
    }
    const clippedFront = this.front ? this.front.clipPolygons(front) : front;
    const clippedBack = this.back ? this.back.clipPolygons(back) : [];
    return clippedFront.concat(clippedBack);
  }

  clipTo(node: CSGNode): void {
    this.polygons = node.clipPolygons(this.polygons);
    if (this.front) {
      this.front.clipTo(node);
    }
    if (this.back) {
      this.back.clipTo(node);
    }
  }

  build(polygons: CSGPolygon[]): void {
    if (!polygons.length) {
      return;
    }
    if (!this.plane) {
      this.plane = polygons[0].plane.clone();
    }
    const front: CSGPolygon[] = [];
    const back: CSGPolygon[] = [];
    for (const polygon of polygons) {
      this.plane.splitPolygon(polygon, this.polygons, this.polygons, front, back);
    }
    if (front.length) {
      if (!this.front) {
        this.front = new CSGNode();
      }
      this.front.build(front);
    }
    if (back.length) {
      if (!this.back) {
        this.back = new CSGNode();
      }
      this.back.build(back);
    }
  }

  allPolygons(): CSGPolygon[] {
    let polygons = this.polygons.slice();
    if (this.front) {
      polygons = polygons.concat(this.front.allPolygons());
    }
    if (this.back) {
      polygons = polygons.concat(this.back.allPolygons());
    }
    return polygons;
  }
}

export class SimpleCSG {
  constructor(private node: CSGNode) {}

  clone(): SimpleCSG {
    return new SimpleCSG(this.node.clone());
  }

  static fromMesh(mesh: Mesh): SimpleCSG {
    mesh.updateMatrixWorld(true);
    const matrix = mesh.matrixWorld;
    const normalMatrix = new Matrix3().getNormalMatrix(matrix);
    const geometry = mesh.geometry.clone().toNonIndexed();
    const position = geometry.getAttribute('position');
    const normalAttr = geometry.getAttribute('normal');
    const polygons: CSGPolygon[] = [];
    const v = new Vector3();
    const n = new Vector3();
    for (let i = 0; i < position.count; i += 3) {
      const vertices: CSGVertex[] = [];
      for (let k = 0; k < 3; k++) {
        v.fromBufferAttribute(position, i + k).applyMatrix4(matrix);
        if (normalAttr) {
          n.fromBufferAttribute(normalAttr, i + k).applyMatrix3(normalMatrix).normalize();
        } else {
          n.set(0, 1, 0);
        }
        vertices.push(new CSGVertex(v.clone(), n.clone()));
      }
      polygons.push(new CSGPolygon(vertices, mesh.material));
    }
    return new SimpleCSG(new CSGNode(polygons));
  }

  static toMesh(csg: SimpleCSG, targetMatrix: Matrix4): BufferGeometry {
    const polygons = csg.node.allPolygons();
    const positions: number[] = [];
    for (const polygon of polygons) {
      for (let i = 2; i < polygon.vertices.length; i++) {
        const v0 = polygon.vertices[0];
        const v1 = polygon.vertices[i - 1];
        const v2 = polygon.vertices[i];
        pushVertex(positions, v0.position);
        pushVertex(positions, v1.position);
        pushVertex(positions, v2.position);
      }
    }
    const geometry = new BufferGeometry();
    geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
    // bring geometry back into local space of the target mesh
    const inverse = targetMatrix.clone().invert();
    geometry.applyMatrix4(inverse);
    geometry.computeVertexNormals();
    geometry.computeBoundingSphere();
    return geometry;
  }

  union(other: SimpleCSG): SimpleCSG {
    const a = this.node.clone();
    const b = other.node.clone();
    a.clipTo(b);
    b.clipTo(a);
    b.invert();
    b.clipTo(a);
    b.invert();
    a.build(b.polygons);
    return new SimpleCSG(a);
  }

  subtract(other: SimpleCSG): SimpleCSG {
    const a = this.node.clone();
    const b = other.node.clone();
    a.invert();
    a.clipTo(b);
    b.clipTo(a);
    b.invert();
    b.clipTo(a);
    b.invert();
    a.build(b.polygons);
    a.invert();
    return new SimpleCSG(a);
  }
}

function pushVertex(buffer: number[], vertex: Vector3): void {
  buffer.push(vertex.x, vertex.y, vertex.z);
}
