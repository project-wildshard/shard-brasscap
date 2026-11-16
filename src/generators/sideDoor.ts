/**
 * TEMPLATE-E2E TC-B7b: the lever by the gate and the side door to the pit. A plank wall closes the gap between the gate's
 * west post and the canyon's west wall, with a door in it beside the post. The lever box east of the gate (`world.ts`,
 * 7.0, -60.5) is a prompt (`brasscap.lever.use`) whose scene queues event 302; the gate script (`sources/gate.as`) sets
 * shared field 102 `brasscap.side-door.open` once, for good, and the door, a declared mover (`brasscap.side-door`, a native
 * `track` on that shared field), slides up out of the way. The server steps it and stands on its box; every page draws it as
 * the props panel of the same id (engine TC-E5b), baked here at its rest pose.
 */
import * as THREE from 'three';
import { lowerMoverMotion, type MoverMotion } from '@wildshard/format/moverMotion';
import { parseMovers } from '@wildshard/format/movers';
import { groundY } from './terrain';
import { PAL } from './sky';
import { Batch, box } from './util';

/** The door's panel and mover id, its shared field and its mover entity (clear of the gate binding's and every brain's).
 *  The field is an `i32` 0 or 1, not a `bool`: format checks a shared trigger's `equals` against the field's default type,
 *  and engine against the host's live value, which is a number for every numeric or boolean field. */
export const SIDE_DOOR = 'brasscap.side-door', SIDE_DOOR_FIELD = 102, SIDE_DOOR_ENTITY = 9201;
/** The wall's line (the gate's), its west end in the canyon wall, and the doorway between it and the gate's west post. */
const Z = -62, WALL_WEST = -11, DOOR_WEST = -4.3, DOOR_EAST = -2.3;
/** Wall and door heights: above the best double jump (about 3.0 m) from the sand. */
const WALL_H = 4.2, DOOR_H = 3.4, DOOR_HALF_THICK = 0.12;
/** The slide: rest shut, then up past the wall's top in 1.5 s. */
const RISE = 1.5;

interface Box { x: number; y: number; z: number; hx: number; hy: number; hz: number }

/** The door's centre at rest, on the sand at the doorway's middle. */
function doorRest(): { x: number; y: number; z: number } {
  const x = (DOOR_WEST + DOOR_EAST) / 2;
  return { x, y: groundY(x, Z) + DOOR_H / 2, z: Z };
}

/** The wall west of the doorway into the props batch, with its solid. */
export function sideWall(b: Batch, col: (c: Box) => void): void {
  const w = DOOR_WEST - WALL_WEST, x = (DOOR_WEST + WALL_WEST) / 2, y0 = groundY(x, Z) - 0.3;
  const n = Math.ceil(w / 0.32);
  for (let i = 0; i < n; i++) {
    const px = WALL_WEST + (i + 0.5) * (w / n), h = WALL_H + 0.3 + ((i * 37) % 5) * 0.06;
    b.add(box(w / n - 0.03, h, 0.18, PAL.wood, px, y0 + h / 2, Z, 0, { vary: 0.12, seed: i }));
  }
  for (const yy of [1.0, 2.6, 3.9]) b.add(box(w, 0.22, 0.12, PAL.woodDark, x, y0 + yy, Z + 0.14));
  // the doorway's frame: a post at its west side and a lintel over it
  b.add(box(0.3, WALL_H + 0.4, 0.3, PAL.woodDark, DOOR_WEST - 0.15, y0 + (WALL_H + 0.4) / 2, Z));
  b.add(box(DOOR_EAST - DOOR_WEST + 0.6, 0.3, 0.3, PAL.woodDark, (DOOR_WEST + DOOR_EAST) / 2, y0 + DOOR_H + 0.55, Z));
  col({ x, y: y0 + WALL_H / 2, z: Z, hx: w / 2, hy: WALL_H / 2, hz: 0.2 });
}

/** The door itself, baked where the mover rests: planks, two cross bars and iron studs. */
export function sideDoorLook(): THREE.Mesh {
  const at = doorRest(), w = DOOR_EAST - DOOR_WEST - 0.08, db = new Batch(), n = 6;
  for (let i = 0; i < n; i++) db.add(box(w / n - 0.02, DOOR_H, DOOR_HALF_THICK * 2, PAL.wood, at.x - w / 2 + (i + 0.5) * (w / n), at.y, at.z, 0, { vary: 0.1, seed: 40 + i }));
  for (const dy of [-1.0, 1.0]) db.add(box(w, 0.2, 0.1, PAL.woodDark, at.x, at.y + dy, at.z + DOOR_HALF_THICK + 0.05));
  for (const dy of [-1.0, 1.0]) for (const dx of [-0.7, 0, 0.7]) db.add(box(0.08, 0.08, 0.05, PAL.iron, at.x + dx, at.y + dy, at.z + DOOR_HALF_THICK + 0.12));
  return db.mesh(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85, flatShading: true }));
}

/** The door's mover row: its box about its origin, and the slide up on shared field 102. */
export function sideDoorMover(): ReturnType<typeof parseMovers>[number] {
  const at = doorRest(), rest = { at, euler: { x: 0, y: 0, z: 0 } };
  const shut: [number, number, number] = [at.x, at.y, at.z], open: [number, number, number] = [at.x, at.y + DOOR_H + 0.2, at.z];
  const motion: MoverMotion = { driver: { kind: 'track' }, trigger: { kind: 'shared', field: SIDE_DOOR_FIELD, equals: 1 },
    track: { clip: 'open', duration: RISE, loop: 'once', speed: 1, times: [0, RISE], position: [shut, open] } };
  const [row] = parseMovers([{ id: SIDE_DOOR, entity: SIDE_DOOR_ENTITY, kind: 'platform', ...rest, enabled: true,
    boxes: [{ x: 0, y: 0, z: 0, hx: (DOOR_EAST - DOOR_WEST) / 2, hy: DOOR_H / 2, hz: DOOR_HALF_THICK, rot: { x: 0, y: 0, z: 0, w: 1 } }],
    ...lowerMoverMotion(motion, rest), ...motion, execution: 'native' }]);
  if (row === undefined) throw new Error('Missing the side door mover');
  return row;
}
