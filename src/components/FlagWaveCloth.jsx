import { useRef, useMemo } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import * as THREE from 'three';

// ==========================================================
// CLOTH SIMULATION (Verlet integration + distance constraints)
// Fisika beneran: gravitasi + angin + constraint jarak antar titik.
// ==========================================================

const COLS = 18;        // resolusi horizontal grid kain
const ROWS = 12;        // resolusi vertikal
const ITERATIONS = 6;   // iterasi constraint per frame (lebih = lebih kaku)

class Point {
  constructor(x, y, z, pinned = false) {
    this.pos = new THREE.Vector3(x, y, z);
    this.prevPos = new THREE.Vector3(x, y, z);
    this.pinned = pinned;
    this.pinPos = pinned ? new THREE.Vector3(x, y, z) : null;
  }
  update(dt, force) {
    if (this.pinned) return;
    const vel = this.pos.clone().sub(this.prevPos).multiplyScalar(0.985); // damping
    this.prevPos.copy(this.pos);
    this.pos.add(vel).add(force.clone().multiplyScalar(dt * dt));
  }
}

class Constraint {
  constructor(p1, p2) {
    this.p1 = p1;
    this.p2 = p2;
    this.restLength = p1.pos.distanceTo(p2.pos);
  }
  satisfy() {
    const delta = this.p2.pos.clone().sub(this.p1.pos);
    const dist = delta.length() || 0.0001;
    const diff = (dist - this.restLength) / dist;
    const correction = delta.multiplyScalar(0.5 * diff);
    if (!this.p1.pinned) this.p1.pos.add(correction);
    if (!this.p2.pinned) this.p2.pos.sub(correction);
  }
}

class Cloth {
  constructor(width, height, cols, rows) {
    this.cols = cols;
    this.rows = rows;
    this.points = [];
    this.constraints = [];

    const dx = width / (cols - 1);
    const dy = height / (rows - 1);

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        // pin seluruh kolom kiri (x=0) -> sisi yang nempel tiang
        const pinned = c === 0;
        const p = new Point(c * dx, -r * dy, 0, pinned);
        // Perturbasi awal: kasih kecepatan vertikal & depth kecil biar
        // kain langsung bergelombang (bukan mulai datar sempurna).
        if (!pinned) {
          p.prevPos.y = p.pos.y + Math.sin(c * 0.45) * 2.2;
          p.prevPos.z = p.pos.z - Math.sin(c * 0.6) * 1.8;
        }
        this.points.push(p);
      }
    }

    const at = (c, r) => this.points[r * cols + c];

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (c < cols - 1) this.constraints.push(new Constraint(at(c, r), at(c + 1, r)));
        if (r < rows - 1) this.constraints.push(new Constraint(at(c, r), at(c, r + 1)));
        if (c < cols - 1 && r < rows - 1) {
          this.constraints.push(new Constraint(at(c, r), at(c + 1, r + 1)));
          this.constraints.push(new Constraint(at(c + 1, r), at(c, r + 1)));
        }
      }
    }
  }

  step(dt, time) {
    for (const p of this.points) {
      if (p.pinned) {
        p.pos.copy(p.pinPos);
        p.prevPos.copy(p.pinPos);
        continue;
      }
      // gravitasi ringan (kain tipis)
      const gravity = new THREE.Vector3(0, -9.0, 0);

      // angin: pseudo-turbulence kombinasi sine.
      // PENTING: tambah windY KUAT — gelombang vertikal yang terlihat dari
      // kamera depan (windZ sendirian tidak terlihat dari tampak depan).
      const nx = p.pos.x, ny = p.pos.y;
      const windStrength = 30 + 12 * Math.sin(time * 0.6);
      const windX = windStrength * (0.7 + 0.3 * Math.sin(time * 1.3 + ny * 0.15));
      const windY = 46 * Math.sin(time * 1.7 + nx * 0.16 + ny * 0.1);
      const windZ = windStrength * 0.5 * Math.sin(time * 1.8 + nx * 0.12 + ny * 0.08);

      const force = gravity.clone().add(new THREE.Vector3(windX, windY, windZ));
      p.update(dt, force);
    }

    for (let i = 0; i < ITERATIONS; i++) {
      for (const c of this.constraints) c.satisfy();
      for (const p of this.points) {
        if (p.pinned) p.pos.copy(p.pinPos);
      }
    }
  }
}

// ==========================================================
// REACT THREE FIBER MESH
// ==========================================================
function ClothMesh({ width, height }) {
  const cloth = useMemo(() => new Cloth(width, height, COLS, ROWS), [width, height]);
  const timeRef = useRef(0);

  const geometry = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    const positions = new Float32Array(COLS * ROWS * 3);
    const colors = new Float32Array(COLS * ROWS * 3);
    const uvs = new Float32Array(COLS * ROWS * 2);

    const red = new THREE.Color('#ce1126');
    const white = new THREE.Color('#ffffff');

    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const i = r * COLS + c;
        const col = r < ROWS / 2 ? red : white; // atas merah, bawah putih
        colors[i * 3] = col.r;
        colors[i * 3 + 1] = col.g;
        colors[i * 3 + 2] = col.b;
        uvs[i * 2] = c / (COLS - 1);
        uvs[i * 2 + 1] = r / (ROWS - 1);
      }
    }

    const indices = [];
    for (let r = 0; r < ROWS - 1; r++) {
      for (let c = 0; c < COLS - 1; c++) {
        const a = r * COLS + c;
        const b = r * COLS + c + 1;
        const cIdx = (r + 1) * COLS + c;
        const d = (r + 1) * COLS + c + 1;
        indices.push(a, cIdx, b, b, cIdx, d);
      }
    }

    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geo.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
    geo.setIndex(indices);
    geo.computeVertexNormals();
    return geo;
  }, [width, height]);

  useFrame((_, delta) => {
    const dt = Math.min(0.033, delta);
    timeRef.current += dt;
    cloth.step(dt, timeRef.current);

    const posAttr = geometry.attributes.position;
    for (let i = 0; i < cloth.points.length; i++) {
      const p = cloth.points[i].pos;
      posAttr.setXYZ(i, p.x, p.y, p.z);
    }
    posAttr.needsUpdate = true;
    geometry.computeVertexNormals();
  });

  return (
    <mesh geometry={geometry} position={[0, height, 0]}>
      <meshStandardMaterial
        vertexColors
        side={THREE.DoubleSide}
        roughness={0.85}
        metalness={0.05}
      />
    </mesh>
  );
}

// ==========================================================
// EXPORT — drop-in replacement untuk FlagWaveCanvas lama
// Props sama persis: width, height (orthographic camera supaya
// alignment ke tiang presisi)
// ==========================================================
export default function FlagWaveCloth({ width = 170, height = 113 }) {
  return (
    <div style={{ width, height, overflow: 'visible' }}>
      <Canvas
        orthographic
        camera={{
          position: [0, 0, 200],
          zoom: 1,
          left: -width * 0.15,
          right: width * 1.4,
          top: height * 1.6,
          bottom: -height * 0.6,
          near: 0.1,
          far: 1000,
        }}
        gl={{ alpha: true, antialias: true }}
        style={{ background: 'transparent' }}
      >
        <ambientLight intensity={0.7} />
        <directionalLight position={[60, 80, 100]} intensity={0.8} />
        <ClothMesh width={width} height={height} />
      </Canvas>
    </div>
  );
}
