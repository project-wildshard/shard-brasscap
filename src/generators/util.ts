// SHARD-SOURCE AP16: brasscap-cleanroom src/util.js (e311139) on the scene API: the same hash, noise, seeded random,
// facet, paint, place, Batch, box and cyl, byte for byte in what they compute. `textTexture` paints through the sdk's
// Canvas 2D subset (5x7 bitmap capitals) in place of a browser canvas; `halo` is the desktop path's empty object (the
// cleanroom draws halos only on its lean phone tier; the engine's bloom takes the glow).
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { paintCanvas } from '@wildshard/sharddev/scene/canvas';

/** Deterministic hash + value noise; every build is the same scene. */
export function hash(x: number, y = 0, z = 0): number {
  const s = Math.sin(x * 127.1 + y * 311.7 + z * 74.7) * 43758.5453;
  return s - Math.floor(s);
}
export function noise2(x: number, y: number): number {
  const xi = Math.floor(x), yi = Math.floor(y);
  const xf = x - xi, yf = y - yi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const a = hash(xi, yi), b = hash(xi + 1, yi), c = hash(xi, yi + 1), d = hash(xi + 1, yi + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
export function fbm(x: number, y: number, oct = 4): number {
  let s = 0, a = 0.5, f = 1;
  for (let i = 0; i < oct; i++) { s += a * noise2(x * f, y * f); f *= 2.03; a *= 0.5; }
  return s;
}
let seedState = 1;
export function rand(): number { seedState = (seedState * 16807) % 2147483647; return (seedState - 1) / 2147483646; }
export function seed(s: number): void { seedState = s; }
export const rr = (a: number, b: number): number => a + (b - a) * rand();

/** Jitter by position (not index) so shared corners stay welded, then go non-indexed for flat facets. */
export function facet(geo: THREE.BufferGeometry, amp = 0, s = 0, keepY0 = false): THREE.BufferGeometry {
  const p = geo.getAttribute('position');
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const k = [Math.round(x * 100), Math.round(y * 100), Math.round(z * 100)] as const;
    const jx = (hash(k[0] + s, k[1], k[2]) - 0.5) * amp;
    const jy = (hash(k[1] + s, k[2], k[0]) - 0.5) * amp;
    const jz = (hash(k[2] + s, k[0], k[1]) - 0.5) * amp;
    p.setXYZ(i, x + jx, keepY0 && y <= 0.001 ? y : y + jy * 0.5, z + jz);
  }
  const g = geo.index === null ? geo : geo.toNonIndexed();
  g.computeVertexNormals();
  return g;
}

/** Paint a geometry one colour, with optional per-face variation. */
export function paint(geo: THREE.BufferGeometry, color: THREE.ColorRepresentation, vary = 0, s = 0): THREE.BufferGeometry {
  const c = new THREE.Color(color);
  const n = geo.getAttribute('position').count;
  const col = new Float32Array(n * 3);
  const tmp = new THREE.Color();
  for (let i = 0; i < n; i += 3) {
    const v = 1 + (hash(i * 0.37 + s, s) - 0.5) * vary;
    tmp.copy(c).multiplyScalar(v);
    for (let k = 0; k < 3 && i + k < n; k++) col.set([tmp.r, tmp.g, tmp.b], (i + k) * 3);
  }
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return geo;
}

export function place(geo: THREE.BufferGeometry, x: number, y: number, z: number, ry = 0, rx = 0, rz = 0, sx = 1, sy = 1, sz = 1): THREE.BufferGeometry {
  const m = new THREE.Matrix4().compose(
    new THREE.Vector3(x, y, z),
    new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz, 'YXZ')),
    new THREE.Vector3(sx, sy, sz));
  geo.applyMatrix4(m);
  return geo;
}

/** A batch collects painted pieces and merges them into one mesh per material. */
export class Batch {
  readonly parts: THREE.BufferGeometry[] = [];
  add(geo: THREE.BufferGeometry): THREE.BufferGeometry {
    const g = geo.index === null ? geo : geo.toNonIndexed();
    if (!g.hasAttribute('normal')) g.computeVertexNormals();
    for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'color'].includes(k)) g.deleteAttribute(k);
    this.parts.push(g);
    return g;
  }
  mesh(material: THREE.Material, { cast = true, receive = true } = {}): THREE.Mesh {
    const m = new THREE.Mesh(mergeGeometries(this.parts), material);
    m.castShadow = cast; m.receiveShadow = receive;
    return m;
  }
}

export interface ShapeOptions { sx?: number; sy?: number; sz?: number; jit?: number; seed?: number; vary?: number; rx?: number; rz?: number; ry?: number; hs?: number; open?: boolean }
export function box(w: number, h: number, d: number, color: THREE.ColorRepresentation, x: number, y: number, z: number, ry = 0, opts: ShapeOptions = {}): THREE.BufferGeometry {
  const g = new THREE.BoxGeometry(w, h, d, opts.sx ?? 1, opts.sy ?? 1, opts.sz ?? 1);
  const f = facet(g, opts.jit ?? 0, opts.seed ?? 0);
  paint(f, color, opts.vary ?? 0.08, opts.seed ?? 0);
  return place(f, x, y, z, ry, opts.rx ?? 0, opts.rz ?? 0);
}
export function cyl(rt: number, rb: number, h: number, seg: number, color: THREE.ColorRepresentation, x: number, y: number, z: number, opts: ShapeOptions = {}): THREE.BufferGeometry {
  const g = new THREE.CylinderGeometry(rt, rb, h, seg, opts.hs ?? 1, opts.open ?? false);
  const f = facet(g, opts.jit ?? 0, opts.seed ?? 0);
  paint(f, color, opts.vary ?? 0.06, opts.seed ?? 0);
  return place(f, x, y, z, opts.ry ?? 0, opts.rx ?? 0, opts.rz ?? 0);
}

/** A painted plank sign: the cleanroom's canvas (wood ground, four shadow lines, a dark border, centred capitals). */
export function textTexture(text: string, { w = 512, h = 128, bg = '#7a4426', fg = '#f4dcae', font = 'bold 84px Georgia, serif', edge = '#4a2414' } = {}): THREE.DataTexture {
  const t = paintCanvas(w, h, (g) => {
    g.fillStyle = bg; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 4; i++) { g.fillStyle = 'rgba(0,0,0,0.12)'; g.fillRect(0, (h / 4) * i, w, 3); }
    g.strokeStyle = edge; g.lineWidth = 10; g.beginPath(); g.rect(5, 5, w - 10, h - 10); g.stroke();
    g.fillStyle = fg; g.font = font; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(text, w / 2, h / 2 + 4);
  }, { colourSpace: 'srgb' });
  t.anisotropy = 8;
  return t;
}

/** The cleanroom's lean-tier halo: nothing on the desktop path (bloom draws the glow). */
export function halo(_size: number, _color: THREE.ColorRepresentation, _opacity = 0.35): THREE.Object3D { return new THREE.Object3D(); }
