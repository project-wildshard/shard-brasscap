// SHARD-SOURCE AP16: brasscap-cleanroom src/actors.js (e311139), the Tin Bandit, the second player and the Dust Wyrm, as
// static poses (a shard's creatures are posed meshes until stage 6's states). The viewmodel, rifle and dust sprites are
// the cleanroom's runtime, not world, and stay out.
import * as THREE from 'three';
import { groundY } from './terrain';
import { Batch, box, cyl, facet, halo, paint, place } from './util';

const std = (o: THREE.MeshStandardMaterialParameters = {}): THREE.MeshStandardMaterial => new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6, flatShading: true, ...o });

export type BanditPose = 'sit' | 'stand' | 'hit' | 'down';

/** Tin Bandit: a riveted tin can of a robot in a hat and a red bandana. */
export function bandit(x: number, z: number, ry: number, pose: BanditPose = 'stand', y: number | null = null): THREE.Group {
  const g = new THREE.Group();
  const b = new Batch();
  const tin = '#8a9198', dark = '#4b4f55';
  const sit = pose === 'sit';
  const legY = sit ? 0.45 : 0.9;
  if (!sit) for (const k of [-1, 1]) b.add(box(0.16, 0.85, 0.18, dark, k * 0.14, 0.42, pose === 'hit' ? k * 0.12 : 0, 0, { rx: pose === 'hit' ? k * 0.3 : 0 }));
  else for (const k of [-1, 1]) { b.add(box(0.16, 0.16, 0.5, dark, k * 0.14, 0.45, 0.25)); b.add(box(0.16, 0.45, 0.16, dark, k * 0.14, 0.22, 0.5)); }
  b.add(cyl(0.3, 0.27, 0.75, 9, tin, 0, legY + 0.38, 0, { vary: 0.08 }));
  for (const yy of [0.12, 0.55]) b.add(cyl(0.31, 0.31, 0.05, 9, dark, 0, legY + yy, 0));
  b.add(box(0.42, 0.36, 0.38, tin, 0, legY + 0.98, 0, 0, { vary: 0.06 }));
  // bandana and hat
  b.add(cyl(0.02, 0.3, 0.3, 6, '#c8352a', 0, legY + 0.72, 0.05, { rx: Math.PI }));
  b.add(cyl(0.48, 0.48, 0.04, 12, '#2b2522', 0, legY + 1.18, 0));
  b.add(cyl(0.2, 0.24, 0.32, 10, '#2b2522', 0, legY + 1.36, 0));
  b.add(cyl(0.245, 0.245, 0.05, 10, '#8a2a20', 0, legY + 1.24, 0));
  const armRx = pose === 'hit' ? -2.2 : sit ? -0.7 : -0.9;
  for (const k of [-1, 1]) {
    const a = box(0.12, 0.6, 0.12, dark, 0, -0.3, 0); place(a, 0, 0, 0, 0, armRx, k * (pose === 'hit' ? 0.9 : 0.15)); place(a, k * 0.36, legY + 0.65, 0); b.add(a);
  }
  if (!sit && pose !== 'hit') b.add(box(0.06, 0.08, 0.55, '#2a2a2e', 0.36, legY + 0.42, 0.45));
  g.add(b.mesh(std({ metalness: 0.45, roughness: 0.45 })));
  // glowing eyes
  const eyeMat = new THREE.MeshBasicMaterial({ color: new THREE.Color('#ffc030').multiplyScalar(3) });
  for (const k of [-1, 1]) {
    const e = new THREE.Mesh(new THREE.SphereGeometry(0.045, 8, 6), eyeMat); e.position.set(k * 0.1, legY + 1.0, 0.2); g.add(e);
    const egl = halo(0.3, '#ffc030', 0.5); egl.position.copy(e.position); egl.position.z += 0.03; g.add(egl);
  }
  if (pose === 'hit') g.rotation.x = -0.45;
  if (pose === 'down') { g.rotation.z = Math.PI / 2; g.position.y = 0.3; }
  g.position.set(x, (y ?? groundY(x, z)) + g.position.y, z); g.rotation.y = ry;
  return g;
}

/** A second player: a cowboy in a long duster with a rifle. */
export function cowboy(x: number, z: number, ry: number): THREE.Group {
  const b = new Batch();
  for (const k of [-1, 1]) b.add(box(0.17, 0.9, 0.2, '#3d2f28', k * 0.13, 0.45, 0));
  b.add(cyl(0.25, 0.42, 1.0, 8, '#7b5a3c', 0, 0.95, 0));
  b.add(box(0.48, 0.55, 0.3, '#6e4f34', 0, 1.42, 0));
  b.add(box(0.22, 0.24, 0.22, '#c99a74', 0, 1.82, 0));
  b.add(cyl(0.38, 0.38, 0.04, 12, '#4a3326', 0, 1.97, 0));
  b.add(cyl(0.15, 0.19, 0.22, 10, '#4a3326', 0, 2.08, 0));
  for (const k of [-1, 1]) b.add(box(0.13, 0.6, 0.13, '#6e4f34', k * 0.3, 1.35, 0.12, 0, { rx: -0.6 }));
  b.add(box(0.06, 0.08, 1.0, '#5a3820', 0.1, 1.2, 0.35, 0, { rx: 0.3 }));
  const g = new THREE.Group(); g.add(b.mesh(std({ roughness: 0.85 }))); g.position.set(x, groundY(x, z), z); g.rotation.y = ry;
  return g;
}

/** The Dust Wyrm: plated segments along a curve, a toothed maw, a glowing core when weak. */
export function wyrm(points: readonly (readonly [number, number, number])[], { weak = false } = {}): THREE.Group {
  const g = new THREE.Group();
  const curve = new THREE.CatmullRomCurve3(points.map((p) => new THREE.Vector3(...p)));
  const b = new Batch();
  const N = 14;
  const body = '#b9532f', plate = '#d77446', belly = '#8f3a24';
  const up = new THREE.Vector3(0, 1, 0);
  for (let i = 0; i < N; i++) {
    const t = i / (N - 1);
    const p = curve.getPoint(t), tan = curve.getTangent(t);
    const r = 1.35 + Math.sin(t * Math.PI) * 0.45 + t * 0.4;
    const segL = curve.getLength() / (N - 1) * 0.92;
    const q = new THREE.Quaternion().setFromUnitVectors(up, tan);
    const seg = facet(new THREE.CylinderGeometry(r, r * 0.86, segL, 9, 1), 0.1, i);
    paint(seg, i % 2 === 1 ? body : plate, 0.08, i);
    seg.applyQuaternion(q); seg.translate(p.x, p.y, p.z); b.add(seg);
    const rim = facet(new THREE.CylinderGeometry(r * 1.06, r, 0.3, 9, 1), 0.04, i + 50);
    paint(rim, belly, 0.05, i);
    rim.applyQuaternion(q); rim.translate(p.x + tan.x * segL * 0.42, p.y + tan.y * segL * 0.42, p.z + tan.z * segL * 0.42); b.add(rim);
    // dorsal spikes
    if (i < N - 1) {
      const sp = new THREE.ConeGeometry(0.22, 0.6, 4); sp.translate(0, r + 0.15, 0);
      const f = sp.toNonIndexed(); f.computeVertexNormals(); paint(f, '#e8d6b0', 0.05); f.deleteAttribute('uv');
      f.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(up, new THREE.Vector3(0, 0, 1)));
      f.applyQuaternion(q); f.translate(p.x, p.y, p.z); b.add(f);
    }
  }
  // head: a wide ring of plates with teeth pointing in, opening along the end tangent
  const end = curve.getPoint(1), et = curve.getTangent(1);
  const hq = new THREE.Quaternion().setFromUnitVectors(up, et);
  const R = 2.5;
  const head = facet(new THREE.CylinderGeometry(R, 1.6, 1.4, 10, 1, true), 0.1, 99); paint(head, plate, 0.1, 9);
  head.applyQuaternion(hq); head.translate(end.x, end.y, end.z); b.add(head);
  const lip = facet(new THREE.TorusGeometry(R, 0.28, 5, 10), 0.05, 7); paint(lip, body, 0.1, 3);
  lip.rotateX(Math.PI / 2); lip.translate(0, 0.7, 0); lip.applyQuaternion(hq); lip.translate(end.x, end.y, end.z); b.add(lip);
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    const t = new THREE.ConeGeometry(0.16, 0.75, 4); t.rotateZ(Math.PI / 2 + 0.35); t.translate(-R + 0.35, 0.75, 0); t.rotateY(a);
    const f = t.toNonIndexed(); f.computeVertexNormals(); paint(f, '#f2e6c8', 0.05); f.deleteAttribute('uv');
    f.applyQuaternion(hq); f.translate(end.x, end.y, end.z); b.add(f);
  }
  const throat = new THREE.CircleGeometry(R * 0.9, 10); throat.rotateX(-Math.PI / 2); throat.translate(0, 0.2, 0);
  const tf = throat.toNonIndexed(); tf.computeVertexNormals(); paint(tf, '#2a120c', 0); tf.deleteAttribute('uv');
  tf.applyQuaternion(hq); tf.translate(end.x, end.y, end.z); b.add(tf);
  g.add(b.mesh(std({ roughness: 0.7 })));
  if (weak) {
    const core = new THREE.Mesh(new THREE.IcosahedronGeometry(0.75, 0), new THREE.MeshBasicMaterial({ color: new THREE.Color('#ffb428').multiplyScalar(4) }));
    core.position.copy(end).addScaledVector(et, 0.35); g.add(core);
    const l = new THREE.PointLight('#ffa020', 40, 14, 2); l.position.copy(end).addScaledVector(et, 1.6); g.add(l);
  }
  return g;
}
