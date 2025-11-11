import { BufferGeometry, Float32BufferAttribute, Vector3 } from 'three';

// Lightweight triangle subdivision helper. Splits each face into four smaller faces.
export function subdivideGeometry(geometry: BufferGeometry): BufferGeometry {
  const source = geometry.toNonIndexed();
  const positionAttr = source.getAttribute('position');
  if (!positionAttr) {
    return geometry;
  }

  const newPositions: number[] = [];
  const v0 = new Vector3();
  const v1 = new Vector3();
  const v2 = new Vector3();
  const m01 = new Vector3();
  const m12 = new Vector3();
  const m20 = new Vector3();

  for (let i = 0; i < positionAttr.count; i += 3) {
    v0.fromBufferAttribute(positionAttr, i);
    v1.fromBufferAttribute(positionAttr, i + 1);
    v2.fromBufferAttribute(positionAttr, i + 2);

    m01.copy(v0).add(v1).multiplyScalar(0.5);
    m12.copy(v1).add(v2).multiplyScalar(0.5);
    m20.copy(v2).add(v0).multiplyScalar(0.5);

    pushTriangle(newPositions, v0, m01, m20);
    pushTriangle(newPositions, m01, v1, m12);
    pushTriangle(newPositions, m20, m12, v2);
    pushTriangle(newPositions, m01, m12, m20);
  }

  const result = new BufferGeometry();
  result.setAttribute('position', new Float32BufferAttribute(newPositions, 3));
  result.computeVertexNormals();
  result.computeBoundingSphere();
  return result;
}

function pushTriangle(buffer: number[], a: Vector3, b: Vector3, c: Vector3): void {
  buffer.push(a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z);
}
