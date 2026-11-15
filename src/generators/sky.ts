// SHARD-SOURCE AP16: brasscap-cleanroom src/world.js `makeSky` (e311139) in TSL: the GLSL dome line for line (horizon to
// mid to zenith bands, the sun's low glow under 0.3 of height), and its long-lens clouds as the same vertex-coloured
// low-poly mesh, unlit and unfogged.
import * as THREE from 'three';
import { dot, max, mix, normalize, pow, smoothstep, vec3 } from 'three/tsl';
import { skyRay } from '@wildshard/sharddev/scene/author';
import type { GraphValue } from '@wildshard/sharddev/materials';
import { Batch, facet, place, rand, rr, seed } from './util';

/** The cleanroom's palette (world.js PAL). */
export const PAL = {
  zenith: '#2f9fbe', skyMid: '#86cfd2', horizon: '#ffc58e', sunGlow: '#ffd9a0',
  fog: '#f6b994',
  sand: '#df825a', sandLight: '#e8946a', sandDark: '#cf6c4a', trail: '#eca07a',
  rockA: '#c24a32', rockB: '#d8623c', rockC: '#9e3427', rockD: '#e2784a', rockTop: '#ee9a6c',
  wood: '#8c522c', woodDark: '#5e3420', woodLight: '#a8683a', tin: '#8f8a86', tinRust: '#9b5a3d',
  canvas: '#f0dfc4', cactus: '#6d8b2c', cactusDark: '#58731f', brass: '#d9a13a', iron: '#3a3432',
} as const;
export const SUN_DIR = new THREE.Vector3(-0.75, 0.5, -0.3).normalize();
const vec = (r: number, g: number, b: number) => vec3(r, g, b);
const lin = (hex: string): ReturnType<typeof vec> => { const c = new THREE.Color(hex); return vec(c.r, c.g, c.b); };

/** The dome's colour along the view ray (the cleanroom's fragment shader). */
export function mesaSky(): GraphValue {
  const d = skyRay, h = max(d.y, 0);
  let c = mix(lin(PAL.horizon), lin(PAL.skyMid), smoothstep(0.02, 0.3, h));
  c = mix(c, lin(PAL.zenith), smoothstep(0.22, 0.7, h));
  const s = max(dot(d, normalize(vec3(SUN_DIR.x, 0.05, SUN_DIR.z))), 0);
  return c.add(lin(PAL.sunGlow).mul(pow(s, 6).mul(0.35)).mul(smoothstep(0, 0.3, h).oneMinus()));
}

/** Long lens clouds, salmon with a lit peach top: flattened low-poly blobs at 900 m (unlit, no fog). */
export function clouds(): THREE.Mesh {
  const b = new Batch();
  seed(77);
  const cloud = (ang: number, el: number, len: number, dist: number): void => {
    const cx = Math.sin(ang) * dist, cz = -Math.cos(ang) * dist, cy = Math.tan(el) * dist;
    const n = 3 + Math.floor(rand() * 3);
    for (let i = 0; i < n; i++) {
      const f = facet(new THREE.IcosahedronGeometry(1, 1), 0.15, i);
      const pos = f.getAttribute('position'), nor = f.getAttribute('normal');
      const colr = new Float32Array(pos.count * 3);
      const lo = new THREE.Color('#ee8a7c'), hi = new THREE.Color('#ffc0a0');
      for (let k = 0; k < pos.count; k++) { const t = THREE.MathUtils.clamp(nor.getY(k) * 0.8 + 0.4, 0, 1); const c = lo.clone().lerp(hi, t); colr.set([c.r, c.g, c.b], k * 3); }
      f.setAttribute('color', new THREE.BufferAttribute(colr, 3));
      const off = (i - n / 2) * len * 0.28;
      place(f, cx + Math.cos(ang) * off, cy + rr(-1, 1) * len * 0.03, cz + Math.sin(ang) * off, -ang, 0, 0, len * rr(0.3, 0.55), len * 0.07, len * 0.16);
      b.add(f);
    }
  };
  const C = [[-1.2, 0.2, 170], [-0.62, 0.27, 150], [-0.25, 0.14, 200], [0.12, 0.22, 140], [0.45, 0.16, 190], [0.85, 0.25, 160], [1.3, 0.18, 170],
    [2.0, 0.2, 180], [2.6, 0.15, 170], [3.2, 0.23, 150], [3.9, 0.18, 190], [4.6, 0.24, 140], [5.3, 0.17, 170], [-0.9, 0.1, 220], [0.6, 0.09, 230],
    [-0.05, 0.33, 120], [0.3, 0.42, 110], [-0.45, 0.38, 130], [1.0, 0.36, 120], [-1.5, 0.33, 140], [3.0, 0.35, 130]] as const;
  // the cleanroom hangs them at 900 m; a shard's parts stay inside its 500 m cell and off its entryways, so they hang at
  // 200 m, the same angles
  for (const [a, e, l] of C) cloud(a, e, l * 200 / 900, 200);
  const m = b.mesh(new THREE.MeshBasicMaterial({ vertexColors: true, fog: false }), { cast: false, receive: false });
  m.renderOrder = -9;
  return m;
}
