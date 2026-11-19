// ONE-FORMAT CC25: the Dust Wyrm's body, a serpent on 14 trail bones, compiled by `world.creature` from the cleanroom's
// builders (`actors.ts`: `wyrmSegment`, `wyrmHead`, `wyrmCore`). No Wyrm code in the engine: its serpent poser lays each
// trail bone on the path the head drew, so the body arches the way the head moves (CC26's burrow, surface and leap).
//
// The rig is the `body` bone every skin has, then the trail chained head first: `head`, `seg1` … `seg12`, `tail`, 1.6 m
// apart in the world. Each bone carries one segment (the head the cleanroom's head-end segment 13, the tail segment 0);
// the head also carries the maw bone: the ring, the lip, 12 teeth, the throat and the glowing core (`Gullet`, drawn in
// the look's glow). Built in world metres under one unnamed 1/5 node: the giant class (4) at body scale 1/4 on a spawn of
// 5 lays it back at 1:1. Bones rest unrotated along -z, the head facing +z.
import * as THREE from 'three';
import type { ShardWorld } from '@wildshard/sharddev/scene/author';
import type { CreatureBinding } from '@wildshard/sharddev/scene/creature';
import wyrmRows from '../rows/actors/wyrm.json' with { type: 'json' };
import { WYRM_CORE_IN, WYRM_MAW, WYRM_SEGMENTS, wyrmCore, wyrmHead, wyrmRadius, wyrmSegment } from './actors';
import { Batch, paint } from './util';

export const WYRM_ID = 'brasscap.wyrm';
/** The rig's units: world metres over the spawn's 5 (the giant class's 4 times body scale 1/4 times the spawn's 5). */
const UNIT = 1 / 5;
/** The bones' spacing in the world, and the trail row's: 14 bones 1.6 m apart (0.32 rig units). */
const SPACING = 1.6;
export const WYRM_TRAIL = { count: WYRM_SEGMENTS, spacing: 0.32 } as const;
/** A segment's drum, as the cleanroom draws one: 0.92 of the bone spacing. */
const SEGMENT_LENGTH = SPACING * 0.92;
const FORWARD = new THREE.Vector3(0, 0, 1);
/** A segment's turn: its axis (+y) onto the body's forward (+z). */
const ALONG = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), FORWARD);
/** The spike's roll before that turn, so the dorsal spikes stand up (+y) on the body lying along z. */
const SPIKE_UP = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, 0, -1));

/** Trail bone `k` (0 the head): `head`, `seg<k>`, `tail`. */
export function wyrmBone(k: number): string {
  if (k === 0) return 'head';
  return k === WYRM_SEGMENTS - 1 ? 'tail' : `seg${String(k)}`;
}

/**
 * The Wyrm's body: a `Group` (the creature's frame) holding an unnamed 1/5 scale node, the `body` bone and the trail
 * chained under it. `plates` draws the segments and the maw with vertex colours; `gullet` (GLB material `Gullet`) the core.
 */
export function wyrmBody(): THREE.Group {
  const plates = new THREE.MeshStandardMaterial({ name: 'Plates', vertexColors: true, roughness: 0.7, flatShading: true });
  const gullet = new THREE.MeshStandardMaterial({ name: 'Gullet', vertexColors: true, roughness: 0.7, flatShading: true });
  const root = new THREE.Group(), scaled = new THREE.Group(), body = new THREE.Group();
  root.name = WYRM_ID; scaled.scale.setScalar(UNIT); body.name = 'body';
  root.add(scaled); scaled.add(body);
  const origin = new THREE.Vector3();
  let parent: THREE.Group = body;
  for (let k = 0; k < WYRM_SEGMENTS; k++) {
    const bone = new THREE.Group();
    bone.name = wyrmBone(k);
    if (k > 0) bone.position.set(0, 0, -SPACING);
    parent.add(bone); parent = bone;
    // the head end's segment (13) on the head, down to the tail's (0)
    const b = new Batch();
    wyrmSegment(b, WYRM_SEGMENTS - 1 - k, SEGMENT_LENGTH, ALONG, origin, FORWARD, SPIKE_UP);
    const mesh = b.mesh(plates); mesh.name = bone.name; bone.add(mesh);
    if (k === 0) bone.add(maw(plates, gullet));
  }
  return root;
}

/** The maw bone on the head: the ring opening forward and the core inside it, the attack clip's one moving part. */
function maw(plates: THREE.Material, gullet: THREE.Material): THREE.Group {
  const bone = new THREE.Group(), b = new Batch();
  bone.name = 'maw';
  wyrmHead(b, ALONG, new THREE.Vector3());
  const ring = b.mesh(plates); ring.name = 'maw'; bone.add(ring);
  const core = wyrmCore().toNonIndexed(); paint(core, '#ffb428', 0);
  core.translate(0, 0, WYRM_CORE_IN);
  const glow = new THREE.Mesh(core, gullet); glow.name = 'gullet'; bone.add(glow);
  return bone;
}

const ID = [0, 0, 0, 1] as const;
const rx = (t: number): number[] => [Math.sin(t / 2), 0, 0, Math.cos(t / 2)];
const quats = (bone: string, times: readonly number[], keys: readonly (readonly number[])[]): THREE.QuaternionKeyframeTrack =>
  new THREE.QuaternionKeyframeTrack(`${bone}.quaternion`, [...times], keys.flat());

/** The attack clip's length, as the look samples it over a strike's windup (the old GLB's 1.5 s). */
export const WYRM_ATTACK_SPAN = 1.5;

/** The maw's clips: `attack` rears it up then slams it down, `hit` a recoil, `die` it sags open. The trail bones are the
 *  poser's, so the clips move only the maw. */
export function wyrmClips(): THREE.AnimationClip[] {
  const rear = [0, 1.1, WYRM_ATTACK_SPAN], recoil = [0, 0.12, 0.45], sag = [0, 0.6, 1.2];
  return [
    new THREE.AnimationClip('attack', WYRM_ATTACK_SPAN, [quats('maw', rear, [ID, rx(-0.55), rx(0.35)])]),
    new THREE.AnimationClip('hit', 0.45, [quats('maw', recoil, [ID, rx(-0.25), ID])]),
    new THREE.AnimationClip('die', 1.2, [quats('maw', sag, [ID, rx(0.3), rx(0.5)])]),
  ];
}

/** The skin's binding: no looping clip, the old GLB's plated pbr, and the gullet in the look's glow. */
export const WYRM_BINDING: CreatureBinding = {
  loops: [],
  material: { envStrength: 0.6, family: 'pbr', metalness: 0.05, occlusion: 0, roughness: 0.7, vertexColours: true },
  materials: { Gullet: 'glow' },
};
type CreatureOptions = Parameters<ShardWorld['creature']>[2];
/** The serpent contract's volumes at the drawn sizes: the head ball round the maw (x2) and a capsule a segment (x0.5). */
export function wyrmVolumes(): NonNullable<CreatureOptions['volumes']> {
  return Array.from({ length: WYRM_SEGMENTS }, (_unused, k) => k === 0
    ? { part: 'head', bone: 'head', at: [0, 0, 0] as const, shape: 'sphere' as const, radius: WYRM_MAW * UNIT, halfLength: 0, axis: 'y' as const, multiplier: 2 }
    : { part: wyrmBone(k), bone: wyrmBone(k), at: [0, 0, 0] as const, shape: 'capsule' as const, radius: wyrmRadius(WYRM_SEGMENTS - 1 - k) * UNIT,
      halfLength: SPACING * UNIT / 2, axis: 'z' as const, multiplier: 0.5 });
}

/** The Dust Wyrm, a giant serpent. Its species row is rows/actors/wyrm.json; its spawn, strikes and decision stay theirs. */
export function wyrmCreature(world: ShardWorld): void {
  world.creature(WYRM_ID, wyrmBody(), {
    species: wyrmRows.species as CreatureOptions['species'],
    size: 'giant', scale: 1 / 4, skeleton: 'serpent', trail: WYRM_TRAIL, volumes: wyrmVolumes(),
    clips: wyrmClips(), attackSpan: WYRM_ATTACK_SPAN, family: 'toon', ...WYRM_BINDING,
  });
}
