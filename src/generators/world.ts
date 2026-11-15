// SHARD-SOURCE AP16: Brasscap Mesa whole, brasscap-cleanroom src/world.js and main.js (e311139) on the scene API, one part
// per section. The cleanroom's code runs as it is; what changes is said where it changes:
// - the ground is `world.ground(groundY, { colourAt })` (the terrain: heights and vertex colours per point, so the per-face
//   brightness jitter is gone) over the cleanroom's ground material (roughness 0.95); the far sand apron is the cell edge;
// - the sky dome is TSL (`sky.ts`); the PMREM environment is the engine's, filtered from that dome over the sand-lit floor;
// - the cleanroom's `colliders` list is one invisible solid box each (part `colliders`);
// - the horizon mesas ring at 150 to 195 m round (0, -50) (the cleanroom's 150 to 320): a shard's parts stay in its cell,
//   and a mesa over one of the cell's four entryways is left out; the sand flattens to road height past 190 m;
// - the creatures are the shard's live ones (`shard.config.ts`: the tin bandits, targets and the Dust Wyrm from the data
//   shard's rows and GLBs), not the cleanroom's posed meshes; `actors.ts` keeps those poses for stage 6 (AP23, creatures
//   from code); the gate starts shut and the Wyrm under the sand, as the cleanroom's default shot;
// - the gate's doors and their collider are panel `brasscap.gate` (`world.part(..., { panel })`): the bandit quest's
//   `targets.panels` row hides both once the gate opens, as the data shard's `gate.door` node did;
// - the viewmodel, AO bake and lamp bake are the cleanroom's own runtime and lean path, not world.
import * as THREE from 'three';
import { animate, flicker, solid, type ShardWorld } from '@wildshard/sharddev/scene/author';
import { cowboy } from './actors';
import { groundColour, groundY, trailX } from './terrain';
import { clouds, mesaSky, PAL, SUN_DIR } from './sky';
import { Batch, box, cyl, facet, halo, hash, paint, place, rand, rr, seed, textTexture } from './util';

interface Box { x: number; y: number; z: number; hx: number; hy: number; hz: number }
/** The cleanroom's collider list, filled while a build runs (a fresh list per build: watch reruns it on every save). */
let colliders: Box[] = [];
const col = (x: number, y: number, z: number, hx: number, hy: number, hz: number): void => { colliders.push({ x, y, z, hx, hy, hz }); };

// A stepped, strata-banded mesa block.
const BANDS = [PAL.rockA, PAL.rockD, PAL.rockC, PAL.rockB, PAL.rockC, PAL.rockD, PAL.rockA];
interface MesaOptions { tiers?: number; y0?: number; ry?: number; straight?: boolean; noCollide?: boolean }
function mesa(b: Batch, cx: number, cz: number, w: number, d: number, h: number, s = 1, opt: MesaOptions = {}): number {
  seed(s * 97 + 11);
  const tiers = opt.tiers ?? (4 + Math.floor(rand() * 4));
  let y = opt.y0 ?? -0.5, cw = w, cd = d, ox = cx, oz = cz;
  const ry = opt.ry ?? rr(-0.25, 0.25);
  for (let i = 0; i < tiers; i++) {
    const th = opt.straight === true ? h / tiers : (h / tiers) * rr(0.6, 1.4);
    const step = opt.noCollide === true ? 9 : 3;
    const sw = Math.max(2, Math.round(cw / step)), sd = Math.max(2, Math.round(cd / step));
    const f = facet(new THREE.BoxGeometry(cw, th, cd, sw, 1, sd), Math.min(cw, cd) * 0.05 + 0.35, s * 13 + i);
    place(f, ox, y + th / 2, oz, ry + rr(-0.06, 0.06));
    paint(f, BANDS[(i + s) % BANDS.length] ?? PAL.rockA, 0.08, s + i);
    b.add(f);
    y += th;
    // a thin pale seam between strata
    if (opt.straight !== true || i < tiers - 1) {
      const sg = facet(new THREE.BoxGeometry(cw * 1.02, 0.18, cd * 1.02, sw, 1, sd), 0.2, s * 7 + i);
      place(sg, ox, y, oz, ry);
      paint(sg, '#f0a074', 0.06, s + i);
      b.add(sg);
    }
    if (rand() < 0.5) {
      const lw = cw * rr(0.2, 0.45);
      const lh = rr(0.5, 1.2);
      const lg = facet(new THREE.BoxGeometry(lw, lh, cd * rr(0.2, 0.4), 2, 1, 2), 0.5, s + i * 5);
      place(lg, ox + rr(-0.35, 0.35) * cw, y + lh / 2 - 0.1, oz + rr(-0.35, 0.35) * cd, ry);
      paint(lg, BANDS[(i + s + 2) % BANDS.length] ?? PAL.rockA, 0.08, s);
      b.add(lg);
    }
    const th0 = opt.straight === true;
    cw *= th0 ? 1 : rr(0.8, 0.96); cd *= th0 ? 1 : rr(0.8, 0.96);
    if (th0) { ox = cx; oz = cz; }
    ox += rr(-0.06, 0.06) * cw; oz += rr(-0.06, 0.06) * cd;
  }
  if (opt.noCollide !== true) col(cx, h / 2, cz, w / 2, h / 2, d / 2);
  return y;
}

// Lighter tops, deeper undersides: colour by facet normal over the painted bands.
function shadeRock(geo: THREE.BufferGeometry): void {
  const n = geo.getAttribute('normal'), c = geo.getAttribute('color');
  const top = new THREE.Color(PAL.rockTop), tmp = new THREE.Color();
  for (let i = 0; i < n.count; i++) {
    tmp.setRGB(c.getX(i), c.getY(i), c.getZ(i));
    const ny = n.getY(i);
    if (ny > 0.55) tmp.lerp(top, 0.65);
    else if (ny < -0.3) tmp.multiplyScalar(0.7);
    c.setXYZ(i, tmp.r, tmp.g, tmp.b);
  }
}

function canyon(part: THREE.Group): void {
  const b = new Batch();
  let s = 1;
  // West wall: depot back to the arena.
  for (let z = 30; z > -130; z -= rr(9, 14)) {
    const gateNarrow = z < -56 && z > -70;
    const x = gateNarrow ? -9 - rr(0, 2) : (z < -66 ? -24 : -26) + rr(-3, 3);
    mesa(b, x - 6, z, rr(12, 18), rr(10, 15), rr(9, 17), s++);
  }
  // East wall, with the camp 3 side canyon left open (z -44 .. -58).
  for (let z = 30; z > -130; z -= rr(9, 14)) {
    if (z < -42 && z > -58) continue;
    const gateNarrow = z < -56 && z > -70;
    const x = gateNarrow ? 12 + rr(0, 2) : (z < -66 ? 28 : 31) + rr(-3, 3);
    mesa(b, x + 6, z, rr(12, 18), rr(10, 15), rr(9, 17), s++);
  }
  // Side canyon walls around camp 3.
  mesa(b, 22, -40, 18, 6, 12, s++, { ry: 0.05 });
  mesa(b, 34, -52, 8, 22, 14, s++, { ry: 0 });
  mesa(b, 25, -64, 14, 7, 12, s++, { ry: -0.05 });
  // Camp 2 ledge: a flat-topped 6 m block on the trail's east side.
  mesa(b, 18, -34, 16, 18, 6.5, s++, { tiers: 3, straight: true, ry: 0, y0: -0.5 });
  // The arena's far wall behind the sand pit.
  for (let x = -30; x < 40; x += rr(10, 14)) mesa(b, x, -132 + rr(-3, 3), rr(12, 18), rr(10, 14), rr(12, 20), s++);
  // Distant mesas in a broken ring for the horizon (inside the cell: 150 to 195 m round the canyon's middle).
  for (let i = 0; i < 46; i++) {
    const a = (i / 46) * Math.PI * 2 + rr(-0.05, 0.05);
    const r = 150 + (rr(150, 320) - 150) * (45 / 170);
    const mx = Math.sin(a) * r, mz = -50 - Math.cos(a) * r, w = rr(25, 60), d = rr(20, 45), h = rr(18, 55);
    // the four entryways (8 m roads 15 m deep at each edge's middle) stay clear: a mesa over one is left out
    const ext = Math.hypot(w, d) / 2;
    if ((Math.abs(mx) + ext > 233 && Math.abs(mz) - ext < 6) || (Math.abs(mz) + ext > 233 && Math.abs(mx) - ext < 6)) { s++; continue; }
    mesa(b, mx, mz, w, d, h, s++, { noCollide: true });
  }
  // Rubble at the wall feet.
  for (let i = 0; i < 90; i++) {
    const side = i % 2 === 1 ? 1 : -1;
    const z = rr(25, -128);
    const x = side < 0 ? rr(-20, -16) : rr(22, 26);
    if (z < -56 && z > -70) continue;
    const r = rr(0.8, 2.6);
    const g = facet(new THREE.DodecahedronGeometry(r, 0), r * 0.3, i);
    place(g, x, r * 0.3, z, rr(0, 6), 0, 0, 1, rr(0.5, 0.8), 1);
    paint(g, BANDS[i % 4] ?? PAL.rockA, 0.12, i);
    b.add(g);
  }
  const m = b.mesh(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.92, flatShading: true }));
  shadeRock(m.geometry);
  part.add(m);
}

// ---------- props ----------
function plankWall(b: Batch, w: number, h: number, x: number, y: number, z: number, ry: number, color: string = PAL.wood, plank = 0.28): void {
  const n = Math.ceil(w / plank);
  for (let i = 0; i < n; i++) {
    const px = -w / 2 + (i + 0.5) * (w / n);
    const ph = h * (1 - hash(i, x) * 0.04);
    const g = box(w / n - 0.02, ph, 0.08, color, 0, ph / 2, 0, 0, { vary: 0.14, seed: i + Math.round(x * 7) });
    place(g, px, 0, 0);
    place(g, x, y, z, ry);
    b.add(g);
  }
}

function waterTower(b: Batch, x: number, z: number, s = 1): void {
  const h = 6 * s;
  for (const [dx, dz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]] as const) {
    b.add(box(0.22, h, 0.22, PAL.woodDark, x + dx * 1.3 * s, h / 2, z + dz * 1.3 * s, 0, { rx: -dz * 0.05, rz: dx * 0.05 }));
  }
  for (const yy of [1.5, 3.2, 4.8]) {
    for (const [ax, az, ry] of [[0, -1.3, 0], [0, 1.3, 0], [-1.3, 0, Math.PI / 2], [1.3, 0, Math.PI / 2]] as const) {
      b.add(box(2.9 * s, 0.12, 0.1, PAL.woodDark, x + ax * s, yy * s, z + az * s, ry));
      b.add(box(3.6 * s, 0.1, 0.08, PAL.woodDark, x + ax * s, (yy - 0.8) * s, z + az * s, ry, { rz: 0.5 }));
    }
  }
  b.add(cyl(2.0 * s, 2.0 * s, 0.25, 10, PAL.woodDark, x, h + 0.1, z));
  b.add(cyl(1.85 * s, 1.95 * s, 2.6 * s, 12, PAL.wood, x, h + 1.4 * s, z, { vary: 0.12 }));
  for (const yy of [0.5, 1.4, 2.3]) b.add(cyl(1.98 * s, 1.98 * s, 0.1, 12, PAL.iron, x, h + yy * s, z));
  b.add(cyl(0.1, 2.15 * s, 1.1 * s, 12, PAL.tinRust, x, h + 3.2 * s, z));
  col(x, h / 2 + 1.5, z, 1.5 * s, h / 2 + 1.5, 1.5 * s);
}

function barrel(b: Batch, x: number, z: number, y = 0, s = 1): void {
  b.add(cyl(0.36 * s, 0.33 * s, 0.95 * s, 10, PAL.wood, x, y + 0.475 * s, z, { vary: 0.16, seed: Math.round(x * 13 + z) }));
  for (const yy of [0.18, 0.77]) b.add(cyl(0.37 * s, 0.37 * s, 0.05, 10, PAL.iron, x, y + yy * s, z));
  b.add(cyl(0.3 * s, 0.3 * s, 0.02, 10, PAL.woodDark, x, y + 0.955 * s, z));
  col(x, y + 0.48, z, 0.35, 0.48, 0.35);
}
function crate(b: Batch, x: number, z: number, y = 0, s = 0.8, ry = 0): void {
  b.add(box(s, s, s, PAL.woodLight, x, y + s / 2, z, ry, { vary: 0.1 }));
  const e = 0.07;
  for (const [ax, az] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
    const g = box(az === 0 ? 0.05 : 0.08, s * 1.3, az === 0 ? 0.08 : 0.05, PAL.woodDark, 0, 0, 0, 0);
    place(g, 0, 0, 0, 0, az === 0 ? 0.78 : 0, az === 0 ? 0 : 0.78);
    place(g, ax * (s / 2 + 0.01), s / 2, az * (s / 2 + 0.01));
    place(g, x, y, z, ry);
    b.add(g);
    b.add(place(box(az === 0 ? e : s + 0.04, e, az === 0 ? s + 0.04 : e, PAL.woodDark, ax * s / 2, s - e / 2, az * s / 2), x, y, z, ry));
    b.add(place(box(az === 0 ? e : s + 0.04, e, az === 0 ? s + 0.04 : e, PAL.woodDark, ax * s / 2, e / 2, az * s / 2), x, y, z, ry));
  }
  col(x, y + s / 2, z, s / 2, s / 2, s / 2);
}
export function cactus(b: Batch, x: number, z: number, h = 3.2, s = 1): void {
  seed(Math.round(x * 31 + z * 17));
  const w = 0.42 * s;
  b.add(box(w, h, w, PAL.cactus, x, h / 2, z, rr(0, 1.5), { vary: 0.06 }));
  b.add(box(w * 0.8, 0.2, w * 0.8, PAL.cactusDark, x, h + 0.05, z));
  const arms = 1 + Math.floor(rand() * 2);
  for (let i = 0; i < arms; i++) {
    const side = i === 0 ? 1 : -1, ay = h * rr(0.35, 0.55), al = rr(0.6, 0.9) * s, up = h * rr(0.3, 0.45);
    const ry = rand() * 0.6;
    const dx = Math.cos(ry) * side, dz = -Math.sin(ry) * side;
    b.add(box(al, w * 0.8, w * 0.8, PAL.cactus, x + dx * al / 2, ay, z + dz * al / 2, ry));
    b.add(box(w * 0.8, up, w * 0.8, PAL.cactus, x + dx * al, ay + up / 2 - w * 0.4, z + dz * al, ry));
  }
  col(x, h / 2, z, w / 2, h / 2, w / 2);
}
function rock(b: Batch, x: number, z: number, r: number, s: number): void {
  const g = facet(new THREE.DodecahedronGeometry(r, 0), r * 0.35, s);
  place(g, x, groundY(x, z) + r * 0.25, z, s, 0, 0, 1, rr(0.55, 0.8), rr(0.8, 1.2));
  paint(g, [PAL.rockB, PAL.rockD, PAL.rockA][s % 3] ?? PAL.rockB, 0.14, s);
  b.add(g);
  if (r > 0.8) col(x, r * 0.3, z, r * 0.8, r * 0.5, r * 0.8);
}
function fence(b: Batch, x0: number, z0: number, x1: number, z1: number): void {
  const len = Math.hypot(x1 - x0, z1 - z0), n = Math.max(1, Math.round(len / 2.2));
  const ry = Math.atan2(-(z1 - z0), x1 - x0);
  for (let i = 0; i <= n; i++) {
    const t = i / n, x = x0 + (x1 - x0) * t, z = z0 + (z1 - z0) * t;
    b.add(box(0.16, 1.25, 0.16, PAL.woodDark, x, 0.62, z, ry + hash(i, x) * 0.3));
  }
  for (const yy of [0.55, 1.0]) b.add(box(len, 0.12, 0.07, PAL.wood, (x0 + x1) / 2, yy, (z0 + z1) / 2, ry, { rz: (hash(yy, x0) - 0.5) * 0.04 }));
}
function tent(b: Batch, glow: THREE.Material, x: number, z: number, ry: number, s = 1): THREE.Group {
  const g = new THREE.Group();
  const L = 3.6 * s, W = 3.2 * s, H = 2.7 * s;
  const shape = new THREE.Shape([new THREE.Vector2(-W / 2, 0), new THREE.Vector2(W / 2, 0), new THREE.Vector2(0, H)]);
  const pr = new THREE.ExtrudeGeometry(shape, { depth: L, bevelEnabled: false });
  pr.translate(0, 0, -L / 2);
  const f = pr.toNonIndexed(); f.computeVertexNormals(); paint(f, PAL.canvas, 0.04, 3);
  f.deleteAttribute('uv');
  place(f, x, 0, z, ry);
  b.add(f);
  // door flap glow + frame poles
  const dg = new THREE.ShapeGeometry(new THREE.Shape([new THREE.Vector2(-0.55 * s, 0), new THREE.Vector2(0.55 * s, 0), new THREE.Vector2(0, 1.6 * s)]));
  const door = new THREE.Mesh(dg, glow);
  door.position.set(x, 0.02, z); door.rotation.y = ry; door.translateZ(L / 2 + 0.02);
  const lamp = new THREE.PointLight('#ffa040', 3, 6, 2);
  lamp.position.copy(door.position); lamp.position.y = 0.8; const fw = new THREE.Vector3(Math.sin(ry), 0, Math.cos(ry)); lamp.position.addScaledVector(fw, 0.8);
  g.add(door, lamp);
  const dgl = halo(2.4 * s, '#ffa040', 0.3); dgl.position.copy(lamp.position); dgl.position.y = 0.75 * s; g.add(dgl);
  for (const dz of [-1, 1]) {
    const pole = box(0.08, H + 0.5, 0.08, PAL.woodDark, 0, (H + 0.5) / 2, dz * (L / 2 + 0.05));
    b.add(place(pole, x, 0, z, ry));
  }
  // flag
  b.add(place(box(0.05, 1.6, 0.05, PAL.woodDark, 0, H + 0.8, -L / 2 + 0.2), x, 0, z, ry));
  b.add(place(box(0.03, 0.4, 0.65, '#c8352a', 0, H + 1.35, -L / 2 + 0.2 + 0.33), x, 0, z, ry));
  col(x, H / 2, z, W / 2, H / 2, L / 2);
  return g;
}
function campfire(b: Batch, fireMat: readonly THREE.Material[], x: number, z: number): THREE.Group {
  const g = new THREE.Group();
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    b.add(place(facet(new THREE.DodecahedronGeometry(0.2, 0), 0.06, i), x + Math.cos(a) * 0.65, 0.1, z + Math.sin(a) * 0.65));
    const last = b.parts.at(-1); if (last !== undefined) paint(last, '#6d5a50', 0.2, i);
  }
  for (let i = 0; i < 4; i++) b.add(box(0.12, 0.12, 0.9, PAL.woodDark, x, 0.12, z, (i / 4) * Math.PI, { rx: 0.25 }));
  for (let i = 0; i < 3; i++) {
    const fl = new THREE.Mesh(new THREE.ConeGeometry(0.28 - i * 0.06, 0.8 + i * 0.25, 5), fireMat[i]);
    fl.position.set(x + (i - 1) * 0.08, 0.4 + i * 0.1, z + (i % 2) * 0.06);
    g.add(fl);
  }
  // the fire's light flickers (a declared motion: the engine's lamp row plays it)
  const l = animate(new THREE.PointLight('#ff9030', 10, 9, 2), flicker({ rate: 1.3, amount: 0.12 })); l.position.set(x, 1.0, z); g.add(l);
  const fgl = halo(3.4, '#ff9238', 0.7); fgl.position.set(x, 0.95, z); g.add(fgl);
  return g;
}
/** A signpost: the post in the batch, each board a wooden box with its painted face as its own plane (the cleanroom's
 *  six-material box is one material per mesh here). */
function signpost(b: Batch, signs: THREE.Group, x: number, z: number, ry: number): void {
  b.add(box(0.18, 2.6, 0.18, PAL.woodDark, x, 1.3, z, ry));
  const boardMat = new THREE.MeshStandardMaterial({ color: PAL.wood, roughness: 0.9 });
  const make = (txt: string, yy: number, dir: number): void => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.38, 0.06), boardMat);
    m.position.set(x, yy, z); m.rotation.y = ry; m.translateX(dir * 0.55); m.translateZ(0.12);
    m.castShadow = true; signs.add(m);
    const faceMat = new THREE.MeshStandardMaterial({ map: textTexture(txt, { font: 'bold 78px Georgia, serif', bg: '#9a5a31' }), roughness: 0.9 });
    for (const side of [1, -1]) {
      const face = new THREE.Mesh(new THREE.PlaneGeometry(1.3, 0.38), faceMat);
      face.position.copy(m.position); face.rotation.y = ry + (side < 0 ? Math.PI : 0); face.translateZ(0.031);
      signs.add(face);
    }
  };
  make('CAMPS', 2.15, 1); make('GATE', 1.7, 1);
}
function shootTarget(b: Batch, x: number, z: number): void {
  b.add(box(0.1, 1.3, 0.1, PAL.woodDark, x, 0.65, z));
  const rings = ['#f3ece0', '#c8352a', '#f3ece0', '#c8352a'];
  rings.forEach((c, i) => b.add(cyl(0.42 - i * 0.1, 0.42 - i * 0.1, 0.05 + i * 0.01, 14, c, x, 1.45, z, { rx: Math.PI / 2 })));
}

// Lift the last n parts of a batch by dy (used for props set on the camp 2 ledge).
function liftLast(b: Batch, n: number, dy: number): void {
  for (const g of b.parts.slice(-n)) g.translate(0, dy, 0);
  for (const c of colliders.slice(-1)) c.y += dy;
}

/** The depot, trail, camps, gate and scatter (the cleanroom's `makeWorld` after its sky, ground and canyon): one props
 *  batch, the lit and glowing pieces, the painted signs and the gate. */
function town(props: THREE.Group, dyn: THREE.Group, signs: THREE.Group, gate: THREE.Group): void {
  const b = new Batch();
  const glowMat = new THREE.MeshBasicMaterial({ color: new THREE.Color('#ffa84a').multiplyScalar(1.15), side: THREE.DoubleSide });
  const fireMat = ['#ff7a20', '#ffb030', '#ffe080'].map((c, i) => new THREE.MeshBasicMaterial({ color: new THREE.Color(c).multiplyScalar(2.5 + i), transparent: true, opacity: 0.92 }));

  // ----- Depot: building west, porch east over the spawn (-1.6, 2.6) -----
  const DX0 = -11.8, DX1 = -5.0, DZ0 = -4, DZ1 = 8;
  b.add(box(DX1 - DX0 + 0.4, 0.4, DZ1 - DZ0 + 0.4, PAL.woodDark, (DX0 + DX1) / 2, 0.2, (DZ0 + DZ1) / 2));
  plankWall(b, DZ1 - DZ0, 3.6, DX1, 0.35, (DZ0 + DZ1) / 2, Math.PI / 2, PAL.wood);
  plankWall(b, DZ1 - DZ0, 3.6, DX0, 0.35, (DZ0 + DZ1) / 2, Math.PI / 2, PAL.wood);
  plankWall(b, DX1 - DX0, 3.6, (DX0 + DX1) / 2, 0.35, DZ0, 0, PAL.wood);
  plankWall(b, DX1 - DX0, 3.6, (DX0 + DX1) / 2, 0.35, DZ1, 0, PAL.wood);
  // gable roof, tin
  for (const sd of [-1, 1]) b.add(box(DX1 - DX0 + 1.4, 0.12, 7.2, PAL.tin, (DX0 + DX1) / 2, 4.6, (DZ0 + DZ1) / 2 + sd * 3.2, 0, { rx: sd * 0.32, sx: 8, vary: 0.1 }));
  // roof corrugation ribs
  for (let i = 0; i < 18; i++) b.add(box(0.06, 0.06, 7.2, '#a29b94', DX0 - 0.5 + i * 0.45, 4.7, (DZ0 + DZ1) / 2 - 3.2, 0, { rx: -0.32 }));
  plankWall(b, DX1 - DX0, 1.6, (DX0 + DX1) / 2, 3.9, DZ0, 0, PAL.woodLight);
  plankWall(b, DX1 - DX0, 1.6, (DX0 + DX1) / 2, 3.9, DZ1, 0, PAL.woodLight);
  col((DX0 + DX1) / 2, 2.2, (DZ0 + DZ1) / 2, (DX1 - DX0) / 2, 2.2, (DZ1 - DZ0) / 2);
  // door + windows on the east wall (glowing panes)
  b.add(box(0.1, 2.3, 1.3, PAL.woodDark, DX1 + 0.06, 1.5, 4.6));
  for (const wz of [-1.8, 1.6, 6.6]) {
    b.add(box(0.12, 1.2, 1.1, PAL.woodDark, DX1 + 0.06, 2.2, wz));
    const pane = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 1.0), glowMat); pane.position.set(DX1 + 0.13, 2.2, wz); pane.rotation.y = Math.PI / 2; dyn.add(pane);
    for (const k of [-1, 1]) b.add(box(0.16, 0.08, 1.2, PAL.woodDark, DX1 + 0.12, 2.2 + k * 0.6, wz));
    b.add(box(0.15, 1.1, 0.06, PAL.woodDark, DX1 + 0.14, 2.2, wz));
    b.add(box(0.15, 0.06, 1.0, PAL.woodDark, DX1 + 0.14, 2.2, wz));
  }
  // porch deck, posts, roof
  const PX = 0.6;
  const PZ0 = -1.9, PZ1 = DZ1 + 0.5;
  b.add(box(PX - DX1, 0.3, PZ1 - PZ0, PAL.woodLight, (PX + DX1) / 2, 0.2, (PZ0 + PZ1) / 2, 0, { vary: 0.12 }));
  for (let i = 0; i < 32; i++) b.add(box(0.015, 0.012, PZ1 - PZ0, '#7a4628', DX1 + 0.15 + i * 0.175, 0.352, (PZ0 + PZ1) / 2));
  for (let i = 0; i < 2; i++) b.add(box(1.4, 0.12, 0.35, PAL.woodLight, -1.2, 0.06 + i * 0.12, PZ0 - 0.35 + i * 0.18));
  for (const pz of [PZ0 + 0.1, 5.5, PZ1 - 0.1]) b.add(box(0.2, 3.3, 0.2, PAL.woodDark, PX - 0.1, 1.95, pz));
  b.add(box(PX - DX1 + 0.4, 0.14, PZ1 - PZ0 + 0.6, PAL.tin, (PX + DX1) / 2, 3.65, (PZ0 + PZ1) / 2, 0, { rz: -0.12, vary: 0.12 }));
  for (let i = 0; i < 7; i++) b.add(box(PX - DX1 + 0.3, 0.12, 0.14, PAL.woodDark, (PX + DX1) / 2, 3.45, PZ0 + i * 1.7, 0, { rz: -0.12 }));
  b.add(box(0.2, 0.3, PZ1 - PZ0 + 0.6, PAL.woodDark, PX - 0.05, 3.4, (PZ0 + PZ1) / 2));
  // the porch deck the cleanroom walks on (main.js: a 4 x 0.2 x 7 box at (-1.4, 0.15, 2))
  col(-1.4, 0.15, 2, 4, 0.2, 7);
  // BRASSCAP sign on the porch fascia (faces +x)
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(4.6, 1.0), new THREE.MeshStandardMaterial({ map: textTexture('BRASSCAP', { w: 1024, h: 220, font: 'bold 150px Georgia, serif' }), roughness: 0.8 }));
  sign.position.set(PX + 0.07, 4.05, 2.4); sign.rotation.y = Math.PI / 2; sign.castShadow = true; signs.add(sign);
  b.add(box(0.12, 1.15, 4.8, PAL.woodDark, PX, 4.05, 2.4));
  // rail at the porch edge, south end
  for (const px of [-4.6, -2.4]) b.add(box(0.12, 1.0, 0.12, PAL.woodDark, px, 0.85, PZ0 + 0.1));
  b.add(box(2.3, 0.1, 0.1, PAL.wood, -3.5, 1.25, PZ0 + 0.1));
  // rifle counter (rack) facing +z at z -0.92
  const RX = -3.4;
  b.add(box(1.5, 0.8, 0.5, PAL.wood, RX, 0.35 + 0.4, -1.1, 0, { vary: 0.12 }));
  for (let i = 0; i < 3; i++) b.add(box(1.52, 0.03, 0.02, PAL.woodDark, RX, 0.55 + i * 0.25, -0.84));
  b.add(box(1.6, 0.07, 0.6, PAL.woodDark, RX, 1.18, -1.1));
  b.add(box(1.5, 0.32, 0.07, PAL.woodDark, RX, 1.38, -1.36));
  for (const k of [-1, 1]) b.add(box(0.08, 0.12, 0.1, PAL.woodDark, RX + k * 0.55, 1.3, -1.26));
  b.add(box(0.36, 0.09, 0.05, PAL.brass, RX, 1.0, -0.83)); // brass lock plate on the counter front
  col(RX, 1.0, -1.1, 0.85, 0.65, 0.3);
  // bell on a bracket from the south porch post
  b.add(box(0.1, 0.1, 0.9, PAL.woodDark, PX - 0.1, 3.0, PZ0 - 0.25));
  b.add(cyl(0.12, 0.3, 0.42, 10, PAL.brass, PX - 0.1, 2.68, PZ0 - 0.6));
  // lantern on the depot's east wall
  const lantern = (x: number, y: number, z: number): void => {
    b.add(box(0.26, 0.05, 0.26, PAL.iron, x, y + 0.24, z));
    b.add(box(0.26, 0.05, 0.26, PAL.iron, x, y - 0.24, z));
    const glass = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.42, 0.2), glowMat); glass.position.set(x, y, z); dyn.add(glass);
    const l = new THREE.PointLight('#ffa848', 4, 7, 2); l.position.set(x + 0.3, y, z); dyn.add(l);
  };
  b.add(box(0.5, 0.06, 0.06, PAL.iron, DX1 + 0.25, 2.65, 1.0));
  lantern(DX1 + 0.45, 2.35, 1.0);
  // depot clutter
  barrel(b, -2.9, 6.8, 0.35); barrel(b, -2.2, 7.3, 0.35); crate(b, -4.4, -1.4, 0.35, 0.7, 0.2); crate(b, -1.0, -3.4, 0, 0.6, -0.3);
  barrel(b, 2.0, 6.8); crate(b, 1.6, 8.6, 0, 0.8, 0.4);
  // railway along the depot's east side
  for (let z = -30; z < 40; z += 0.9) b.add(box(2.2, 0.12, 0.3, PAL.woodDark, 7.5, 0.06, z, 0, { vary: 0.2 }));
  for (const rx of [6.8, 8.2]) b.add(box(0.08, 0.1, 70, '#5a4c46', rx, 0.17, 5));
  // handcar
  b.add(box(1.6, 0.25, 1.4, PAL.wood, 7.5, 0.55, 9.5)); for (const k of [-1, 1]) b.add(box(0.1, 1.0, 0.1, PAL.iron, 7.5, 1.0, 9.5 + k * 0.3, 0, { rx: k * 0.3 }));
  b.add(box(1.4, 0.08, 0.08, PAL.iron, 7.5, 1.45, 9.5));

  waterTower(b, 5.5, 13, 1);
  waterTower(b, -21, -27, 1.05);

  // ----- Trail dressing -----
  shootTarget(b, 2.5, -9.88); shootTarget(b, 8.5, -6.5); shootTarget(b, -4.5, -12);
  signpost(b, signs, -2.2, -8.5, 0.1);
  fence(b, 4.5, -1, 6.5, -16); fence(b, 6.5, -16, 7.5, -24);
  fence(b, -5.2, -4, -6.5, -12);
  // ----- Camp 1 (-14, -28) -----
  dyn.add(tent(b, glowMat, -11.5, -33, 0.55, 1.05));
  dyn.add(campfire(b, fireMat, -14, -28));
  barrel(b, -17.5, -29); barrel(b, -17.9, -30.2); crate(b, -18.2, -27.4, 0, 0.8, 0.3); crate(b, -18.1, -27.4, 0.8, 0.6, 0.6); crate(b, -16.7, -25.5, 0, 0.7, 0.1);
  fence(b, -7, -25, -4, -35); fence(b, -4, -35, -2.5, -40);
  b.add(box(1.2, 0.35, 0.35, PAL.woodDark, -15.6, 0.18, -27.2, 0.4)); b.add(box(1.2, 0.35, 0.35, PAL.woodDark, -12.5, 0.18, -26.5, -0.6));
  // ----- Camp 2 on the ledge (13.5, 6, -34) -----
  const LY = 6;
  dyn.add((() => { const g = tent(b, glowMat, 18.5, -38, -1.3, 1.0); g.position.y = LY; return g; })());
  // tent geometry was batched at y 0: lift the most recent tent parts
  liftLast(b, 5, LY);
  for (let z = -40; z <= -28; z += 1.7) b.add(box(0.12, 1.3, 1.6, PAL.wood, 10.9, LY + 0.65, z, 0, { vary: 0.2, rz: (hash(z, 1) - 0.5) * 0.15 }));
  b.add(box(0.12, 0.12, 12, PAL.woodDark, 10.95, LY + 1.05, -34));
  crate(b, 12.2, -39.5, LY, 0.8); barrel(b, 12.4, -37.6, LY); barrel(b, 12.3, -30.2, LY);
  // ladder up the west face
  for (const k of [-1, 1]) b.add(box(0.12, 7.2, 0.12, PAL.woodDark, 9.55, 3.4, -28.4 + k * 0.32, 0, { rz: 0.16 }));
  for (let i = 0; i < 11; i++) b.add(box(0.08, 0.08, 0.66, PAL.wood, 9.38 + i * 0.105, 0.5 + i * 0.62, -28.4));
  const ledgeFire = campfire(b, fireMat, 15.5, -32); dyn.add(ledgeFire); liftLast(b, 12, LY); ledgeFire.position.y = LY;
  // ----- Camp 3 (18.4, -50.5) in the side canyon -----
  dyn.add(tent(b, glowMat, 22, -48.5, -2.1, 1.05));
  dyn.add(campfire(b, fireMat, 17, -52.5));
  // covered wagon
  const wx = 13.2, wz = -47.2;
  b.add(box(1.6, 0.6, 3.2, PAL.wood, wx, 1.1, wz, 0.4));
  for (const [dx, dz] of [[-0.9, -1.1], [0.9, -1.1], [-0.9, 1.1], [0.9, 1.1]] as const) {
    const wg = cyl(0.55, 0.55, 0.1, 12, PAL.woodDark, 0, 0, 0, { rz: Math.PI / 2 }); place(wg, dx, 0.55, dz); place(wg, wx, 0, wz, 0.4); b.add(wg);
  }
  const cover = new THREE.CylinderGeometry(0.95, 0.95, 2.8, 10, 1, true, -Math.PI / 2, Math.PI);
  const cf = cover.toNonIndexed(); cf.computeVertexNormals(); paint(cf, PAL.canvas, 0.05); cf.deleteAttribute('uv');
  place(cf, 0, 1.4, 0, 0, Math.PI / 2, 0); place(cf, wx, 0, wz, 0.4); b.add(cf);
  col(wx, 1.2, wz, 0.9, 1.2, 1.6);
  barrel(b, 15.3, -55.5); crate(b, 21.5, -53, 0, 0.8, 0.2); crate(b, 20.5, -54.2, 0, 0.6, 0.5); barrel(b, 11, -50.5);
  fence(b, 8.5, -44, 12.5, -42.5);
  // ----- Gate (2, -62) -----
  const GW = 7.2, GH = 5.6;
  for (const k of [-1, 1]) {
    b.add(box(0.7, GH + 1.8, 0.7, PAL.woodDark, 2 + k * (GW / 2 + 0.35), (GH + 1.8) / 2, -62, 0, { vary: 0.1 }));
    col(2 + k * (GW / 2 + 0.35), 4, -62, 0.35, 4, 0.35);
    b.add(box(1.2, 0.5, 1.2, PAL.iron, 2 + k * (GW / 2 + 0.35), 0.25, -62));
  }
  b.add(box(GW + 2.6, 0.55, 0.6, PAL.woodDark, 2, GH + 1.3, -62));
  b.add(box(GW + 1.6, 0.35, 0.5, PAL.wood, 2, GH + 0.6, -62));
  const gsign = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 1.0), new THREE.MeshStandardMaterial({ map: textTexture('GATE', { w: 640, h: 200, font: 'bold 150px Georgia, serif' }), roughness: 0.85 }));
  gsign.position.set(2, GH + 2.15, -61.62); signs.add(gsign);
  b.add(box(3.4, 1.15, 0.12, PAL.woodDark, 2, GH + 2.15, -61.7));
  for (const k of [-1, 1]) b.add(box(0.08, 0.7, 0.08, PAL.iron, 2 + k * 1.3, GH + 1.45, -61.7));
  const doorMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85, flatShading: true });
  for (const k of [-1, 1]) {
    const pivot = new THREE.Group(); pivot.position.set(2 + k * GW / 2, 0, -62);
    const db = new Batch();
    plankWall(db, GW / 2, GH, -k * GW / 4, 0.05, 0, 0, PAL.wood, 0.42);
    for (const yy of [1.0, 3.2, 5.4]) db.add(box(GW / 2, 0.25, 0.14, PAL.woodDark, -k * GW / 4, yy, 0.08));
    db.add(box(Math.hypot(GW / 2, 2.2), 0.22, 0.12, PAL.woodDark, -k * GW / 4, 2.1, 0.09, 0, { rz: k * Math.atan2(2.2, GW / 2) }));
    for (const yy of [1.0, 3.2, 5.4]) for (let i = 0; i < 5; i++) db.add(box(0.1, 0.1, 0.05, PAL.iron, -k * (0.3 + i), yy, 0.17));
    pivot.add(db.mesh(doorMat));
    gate.add(pivot);
  }
  // the shut gate's own collider: the gate part is panel `brasscap.gate`, hidden with its collider once the gate opens
  const shut = new THREE.Mesh(new THREE.BoxGeometry(GW, GH, 0.4), new THREE.MeshBasicMaterial());
  shut.position.set(2, GH / 2, -62); shut.visible = false; gate.add(solid(shut));
  // bell and lever box beside the gate, lantern on the post
  b.add(box(0.12, 3.2, 0.12, PAL.woodDark, 7.4, 1.6, -60.8)); b.add(box(0.9, 0.1, 0.1, PAL.woodDark, 7.05, 3.2, -60.8));
  b.add(cyl(0.12, 0.3, 0.4, 10, PAL.brass, 6.7, 2.9, -60.8));
  b.add(box(0.4, 0.7, 0.3, PAL.woodDark, 7.0, 1.2, -60.5)); b.add(box(0.06, 0.5, 0.06, '#b8312a', 7.0, 1.7, -60.3, 0, { rz: 0.4 }));
  b.add(box(0.5, 0.06, 0.06, PAL.iron, 2 + GW / 2 + 0.6, 5.2, -61.5));
  lantern(2 + GW / 2 + 0.95, 4.9, -61.5);
  // wagon ruts toward the gate
  for (const k of [-1, 1]) for (let z = -48; z > -62; z -= 0.5) b.add(box(0.18, 0.02, 0.55, PAL.sandDark, 2 + k * 0.9 + Math.sin(z * 0.4) * 0.15, groundY(2, z) + 0.01, z, 0, { vary: 0.05 }));

  // ----- Scatter: cacti, rocks, tufts -----
  const cacti = [[4, 2], [9, -3], [5.5, -6.5], [-5, -15], [-3.5, -24], [10, -18], [-9, -40], [6, -36], [0, -37.5], [-8, -50], [9.5, -52],
    [-3.5, -57], [-2.5, -78], [8, -76], [-8, -96], [14, -92], [-12, -110], [18, -112], [-15, -4], [12, 4], [-12, 14], [16, -10], [-20, -60],
    [24, -80], [-2.5, -55], [-6, -88], [11, -86], [-11, -70], [17, -70]] as const;
  cacti.forEach(([x, z], i) => { cactus(b, x, z, 2.6 + hash(i, 4) * 2.2, 1 + hash(i, 9) * 0.3); });
  seed(5);
  for (let i = 0; i < 260; i++) {
    const x = rr(-22, 26), z = rr(20, -128);
    if (Math.abs(x - trailX(z)) < 2.5) continue;
    if (x < 1 && x > -11 && z > -5 && z < 9) continue;
    const r = rand() < 0.1 ? rr(0.7, 1.6) : rr(0.12, 0.45);
    rock(b, x, z, r, i);
  }
  rock(b, -11.8, -16.8, 1.2, 3); rock(b, -12.5, -18.8, 0.8, 4);
  for (let i = 0; i < 220; i++) {
    const x = rr(-22, 26), z = rr(20, -128);
    if (Math.abs(x - trailX(z)) < 2) continue;
    if (x < 1 && x > -11 && z > -5 && z < 9) continue;
    const y = groundY(x, z);
    for (let k = 0; k < 5; k++) {
      const g = new THREE.ConeGeometry(0.035, rr(0.25, 0.5), 3);
      g.translate(0, 0.15, 0);
      const f = g.toNonIndexed(); f.computeVertexNormals(); paint(f, k % 2 === 1 ? '#c9a640' : '#b18a32', 0.1, k); f.deleteAttribute('uv');
      place(f, x + rr(-0.15, 0.15), y, z + rr(-0.15, 0.15), rr(0, 6), rr(-0.4, 0.4), rr(-0.4, 0.4));
      b.add(f);
    }
  }
  props.add(b.mesh(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85, flatShading: true })));
}

/** The light (main.js 45-79): the low warm sun, the sky / sand hemisphere, the sand's warm bounce, the haze, the post. */
export function desertLight(world: ShardWorld): void {
  // the dome and the environment prefiltered from it over a sunlit sand floor (#ff8a5a) at 0.5
  const floor = new THREE.Color('#ff8a5a');
  world.sky(mesaSky(), { environment: { intensity: 0.5, ground: [floor.r, floor.g, floor.b] } });
  world.scene.fog = new THREE.FogExp2(new THREE.Color(PAL.fog), 0.0052);
  world.part('light', (part) => {
    const sun = new THREE.DirectionalLight('#ffd6a6', 2.6);
    sun.position.copy(SUN_DIR).multiplyScalar(60); sun.castShadow = true;
    part.add(sun, sun.target);
    part.add(new THREE.HemisphereLight('#f4c0ac', '#d06648', 0.6));
    const bounce = new THREE.DirectionalLight('#ff9070', 0.35);
    bounce.position.copy(SUN_DIR).multiplyScalar(-1).setY(0.25);
    part.add(bounce);
  });
  // the cleanroom's composer: neutral tone map at 1.0, bloom 0.32 / 0.55 / 0.92
  world.post({ tone: 'neutral', exposure: 1, bloom: { strength: 0.32, radius: 0.55, threshold: 0.92 } });
}

/** Brasscap Mesa: the light, the ground and every section of the cleanroom, one part each. */
export function buildBrasscap(world: ShardWorld): void {
  colliders = [];
  desertLight(world);
  world.ground(groundY, { colourAt: groundColour, material: new THREE.MeshStandardMaterial({ roughness: 0.95 }) });
  world.part('sky', (part) => { part.add(clouds()); });
  world.part('canyon', (part) => { canyon(part); });
  const props = world.part('props', () => undefined), dyn = world.part('glow', () => undefined), signs = world.part('signs', () => undefined), gate = world.part('gate', () => undefined, { panel: 'brasscap.gate' });
  town(props, dyn, signs, gate);
  const hidden = new THREE.MeshBasicMaterial(), unit = new THREE.BoxGeometry(1, 1, 1);
  world.part('colliders', (part) => {
    for (const c of colliders) {
      const m = new THREE.Mesh(unit, hidden);
      m.position.set(c.x, c.y, c.z); m.scale.set(c.hx * 2, c.hy * 2, c.hz * 2); m.visible = false;
      part.add(solid(m));
    }
  });
  // Sheriff Brass on the porch deck (top 0.25 m), facing the spawn: the quest giver (rows/npcs/sheriff.json, TC-B6)
  world.part('folk', (part) => {
    const sheriff = cowboy(0, 0.6, Math.atan2(-1.6, 2));
    sheriff.position.y = 0.25;
    part.add(sheriff);
  });
  // the cleanroom's player capsule starts on the porch at (-1.6, 2.6), looking down the canyon (yaw 0)
  world.spawn(-1.6, 0.35, 2.6, 0);
}
