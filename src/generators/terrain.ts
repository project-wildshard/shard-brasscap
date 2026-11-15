// SHARD-SOURCE AP16: the sand of brasscap-cleanroom src/world.js (e311139): the trail line, the height and the colour at a
// point, shared by the world and the actors (who stand on it).
import * as THREE from 'three';
import { PAL } from './sky';
import { fbm, noise2 } from './util';

/** Trail centre line (x as a function of z): depot to the sand pit. */
export const trailX = (z: number): number => 1 + Math.sin(z * 0.045) * 2.5 + (z < -60 ? 1 : 0);

/** Height of the sand at (x, z): gentle dunes, a smooth trail, and the wyrm's bowl. */
export function groundY(x: number, z: number): number {
  let y = (fbm(x * 0.05, z * 0.05) - 0.5) * 0.9 + (noise2(x * 0.3, z * 0.3) - 0.5) * 0.12;
  const t = Math.abs(x - trailX(z));
  y *= THREE.MathUtils.smoothstep(t, 2, 7);
  const pr = Math.hypot(x - 2, z + 100);
  if (pr < 16) y -= (1 - pr / 16) ** 2 * 1.4;
  if (Math.hypot(x + 1.6, z - 2) < 9) y *= 0.2;
  // the cell edge stays at road height for its entryways (the cleanroom's sand ran on past the horizon mesas)
  y *= 1 - THREE.MathUtils.smoothstep(Math.hypot(x, z), 190, 230);
  return y;
}

/** The sand's colour at a point (the cleanroom's per-face colour, at the point): dune mottling, the trail, the pit's rings. */
export function groundColour(x: number, z: number): [number, number, number] {
  const cS = new THREE.Color(PAL.sand), cL = new THREE.Color(PAL.sandLight), cD = new THREE.Color(PAL.sandDark), cT = new THREE.Color(PAL.trail);
  const n = fbm(x * 0.08 + 9, z * 0.08);
  const tmp = cS.clone().lerp(n > 0.5 ? cL : cD, Math.abs(n - 0.5) * 1.6);
  const t = Math.abs(x - trailX(z));
  tmp.lerp(cT, (1 - THREE.MathUtils.smoothstep(t, 1.5, 4.5)) * 0.75);
  const pr = Math.hypot(x - 2, z + 100);
  if (pr < 17) { const ring = 0.5 + 0.5 * Math.sin(pr * 2.2 - Math.atan2(z + 100, x - 2) * 0.5); tmp.lerp(cD, ring * 0.45 * (1 - pr / 17)); }
  return [Math.min(1, tmp.r), Math.min(1, tmp.g), Math.min(1, tmp.b)];
}
