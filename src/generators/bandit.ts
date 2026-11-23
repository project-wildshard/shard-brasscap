// ONE-FORMAT CC13 (absorbs SHARD-SOURCE AP23c): the Tin Bandit from source, on the kit biped skeleton. The cleanroom's
// bandit (brasscap-cleanroom src/actors.js, `actors.ts` `bandit()` here) is one merged mesh; this is the same can of a
// robot rebuilt limb by limb: every piece hangs from the bone it moves with (legs split at the knee, the arms and the
// rifle on the grip at the shoulders). `world.creature` compiles it to the skinned GLB and skin file that
// `tools/bandit.ts` used to write by hand.
//
// QA 11-19 row 42 (Jake, ~12:35 Cancún: "enemies are not animated to be holding a gun and shooting a gun"): the
// revolver in one fist is now a two-handed rifle shouldered on the right, with a `muzzle` bone at the barrel's end that
// the engine's creature gunfire fires from, and clips that hold it: carried at the low ready in `idle` and `walk`,
// brought up to the shoulder over the shot's windup (`attack`), kicked and lowered as the round leaves (`attack.fire`).
//
// Cleanroom units (legs 0.85 m, hat top 2.42 m) under one unnamed 0.6 scale node: the bandit stands 1.45 m, as the
// species' hit dims and the old GLB had it. Bones rest unrotated; the arms' bend is the meshes' rest shape.
import * as THREE from 'three';
import type { ShardWorld } from '@wildshard/sdk/scene/author';
import type { CreatureBinding } from '@wildshard/sdk/scene/creature';
import bandits from '../rows/actors/bandits.json' with { type: 'json' };
import { box, cyl, place } from './util';

/** The bandit stands at 0.6 of the cleanroom's size. */
const S = 0.6;
const TIN = '#8a9198', DARK = '#4b4f55', HAT = '#2b2522', HAT_BAND = '#8a2a20', BANDANA = '#c8352a', EYE = '#ffc030';
const BLUED = '#26272c', WOOD = '#6b4026', BRASS = '#b8913a', GLOVE = '#3a2c22';
const LEG_Y = 0.9;
/** The shoulders, either side of the chest. */
const SHOULDER_Y = LEG_Y + 0.65, SHOULDER_X = 0.36;

type V3 = readonly [number, number, number];
/**
 * `grip` is the arms' and the rifle's pivot at the shoulders (the arms ride it, so the hands never leave the gun),
 * `rifle` the gun itself (it leaves the hands only in the fall), `muzzle` the barrel's end.
 */
const GRIP: V3 = [-0.1, SHOULDER_Y + 0.05, 0.08];
const BORE_Y = SHOULDER_Y + 0.13, BORE_X = -0.22, MUZZLE_Z = 1.45;
/** The bones' rest positions in cleanroom units (the bandit's frame, +z forward, +x its left), parent first. */
function bones(muzzle: boolean): readonly (readonly [string, string | null, V3])[] {
  const arm = (k: number, along: number): V3 => [k * SHOULDER_X, SHOULDER_Y - along, 0];
  return [
    ['body', null, [0, 0, 0]],
    ['hips', 'body', [0, LEG_Y, 0]],
    ['spine', 'hips', [0, LEG_Y + 0.2, 0]],
    ['chest', 'spine', [0, LEG_Y + 0.55, 0]],
    ['neck', 'chest', [0, LEG_Y + 0.76, 0]],
    ['head', 'neck', [0, LEG_Y + 0.86, 0]],
    ['grip', 'chest', GRIP],
    ['rifle', 'grip', GRIP],
    ...(muzzle ? [['muzzle', 'rifle', [BORE_X, BORE_Y, MUZZLE_Z]] as const] : []),
    ...[['L', 1], ['R', -1]].flatMap(([side, k]) => [
      [`upperArm.${side}`, 'chest', arm(k as number, 0)],
      [`forearm.${side}`, `upperArm.${side}`, arm(k as number, 0.3)],
      [`hand.${side}`, `forearm.${side}`, arm(k as number, 0.6)],
      [`thigh.${side}`, 'hips', [(k as number) * 0.14, 0.85, 0]],
      [`shin.${side}`, `thigh.${side}`, [(k as number) * 0.14, 0.45, 0]],
      [`foot.${side}`, `shin.${side}`, [(k as number) * 0.14, 0.08, 0]],
    ] as (readonly [string, string, V3])[]),
  ];
}

const UP = new THREE.Vector3(0, 1, 0);
/** A square limb `thick` across from `a` to `b` (the box's long axis laid along the segment). */
function limb(a: V3, b: V3, thick: number, colour: string): THREE.BufferGeometry {
  const from = new THREE.Vector3(...a), to = new THREE.Vector3(...b), along = to.clone().sub(from);
  const g = box(thick, along.length(), thick, colour, 0, 0, 0);
  g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(UP, along.normalize()));
  const mid = from.add(to).multiplyScalar(0.5);
  return g.translate(mid.x, mid.y, mid.z);
}

/** The rifle along +z from the butt at the right shoulder: stock, blued receiver, trigger guard, barrel, fore-end, brass. */
function rifleParts(): THREE.BufferGeometry[] {
  const y = BORE_Y, x = BORE_X;
  return [
    box(0.1, 0.17, 0.4, WOOD, x, y - 0.08, 0.3, 0, { vary: 0.05 }),
    box(0.11, 0.13, 0.28, BLUED, x, y - 0.02, 0.62),
    box(0.05, 0.12, 0.06, BLUED, x, y - 0.12, 0.54),
    cyl(0.03, 0.03, 0.72, 6, BLUED, x, y + 0.01, 1.09, { rx: Math.PI / 2, vary: 0.02 }),
    box(0.09, 0.08, 0.44, WOOD, x, y - 0.05, 0.98, 0, { vary: 0.05 }),
    box(0.1, 0.05, 0.04, BRASS, x, y - 0.03, 1.2),
    box(0.04, 0.06, 0.03, BRASS, x, y + 0.06, 1.4),
  ];
}

/** The arms on the gun: the right hand at the wrist of the stock, the left under the fore-end, elbows down and out. */
function armParts(): THREE.BufferGeometry[] {
  const rShoulder: V3 = [-SHOULDER_X, SHOULDER_Y, 0], rElbow: V3 = [-0.44, SHOULDER_Y - 0.22, 0.18], rHand: V3 = [BORE_X - 0.02, BORE_Y - 0.1, 0.46];
  const lShoulder: V3 = [SHOULDER_X, SHOULDER_Y, 0], lElbow: V3 = [0.2, SHOULDER_Y - 0.24, 0.42], lHand: V3 = [BORE_X + 0.02, BORE_Y - 0.1, 0.92];
  return [
    limb(rShoulder, rElbow, 0.12, DARK), limb(rElbow, rHand, 0.11, DARK),
    limb(lShoulder, lElbow, 0.12, DARK), limb(lElbow, lHand, 0.11, DARK),
    box(0.13, 0.12, 0.13, GLOVE, rHand[0], rHand[1], rHand[2]),
    box(0.13, 0.12, 0.13, GLOVE, lHand[0], lHand[1], lHand[2]),
  ];
}

/**
 * The bandit's body: a `Group` (the creature's frame) holding an unnamed 0.6 scale node, then the bones, each carrying
 * its own pieces. `tin` draws the body with vertex colours; `eye` (GLB material `Eye`) the two glowing eyes. `muzzle`
 * adds the barrel's end bone the engine fires from; the brawler, who clubs with the butt, has none.
 */
export function banditBody({ muzzle = true }: { readonly muzzle?: boolean } = {}): THREE.Group {
  const tin = new THREE.MeshStandardMaterial({ name: 'Tin', vertexColors: true, metalness: 0.45, roughness: 0.45, flatShading: true });
  const eye = new THREE.MeshStandardMaterial({ name: 'Eye', vertexColors: true, metalness: 0.45, roughness: 0.45, flatShading: true });
  const root = new THREE.Group(), scaled = new THREE.Group();
  root.name = 'brasscap.bandit'; scaled.scale.setScalar(S); root.add(scaled);
  const nodes = new Map<string, { node: THREE.Group; at: V3 }>();
  for (const [name, parent, at] of bones(muzzle)) {
    const node = new THREE.Group(), up = parent === null ? undefined : nodes.get(parent);
    node.name = name;
    const base = up?.at ?? [0, 0, 0];
    node.position.set(at[0] - base[0], at[1] - base[1], at[2] - base[2]);
    (up?.node ?? scaled).add(node); nodes.set(name, { node, at });
  }
  /** A piece built in the bandit's frame, hung from `bone` (moved into its frame: bones rest unrotated). */
  const hang = (bone: string, geometry: THREE.BufferGeometry, material = tin): void => {
    const owner = nodes.get(bone);
    if (owner === undefined) throw new Error(`No bandit bone ${bone}`);
    geometry.translate(-owner.at[0], -owner.at[1], -owner.at[2]);
    const mesh = new THREE.Mesh(geometry, material); mesh.name = bone;
    owner.node.add(mesh);
  };
  for (const [side, k] of [['L', 1], ['R', -1]] as const) {
    // dark legs, split at the knee, on flat dark feet
    hang(`thigh.${side}`, box(0.16, 0.4, 0.18, DARK, k * 0.14, 0.65, 0));
    hang(`shin.${side}`, box(0.16, 0.37, 0.18, DARK, k * 0.14, 0.265, 0));
    hang(`foot.${side}`, box(0.17, 0.08, 0.24, DARK, k * 0.14, 0.04, 0.03));
    // a shoulder cap over each arm's root
    hang('chest', box(0.17, 0.15, 0.17, DARK, k * SHOULDER_X, SHOULDER_Y, 0));
  }
  // the arms ride the grip, the rifle rides in the hands
  for (const part of armParts()) hang('grip', part);
  for (const part of rifleParts()) hang('rifle', part);
  // the tin can body and its two dark bands
  hang('spine', cyl(0.3, 0.27, 0.75, 9, TIN, 0, LEG_Y + 0.38, 0, { vary: 0.08 }));
  hang('spine', cyl(0.31, 0.31, 0.05, 9, DARK, 0, LEG_Y + 0.12, 0, { open: true }));
  hang('chest', cyl(0.31, 0.31, 0.05, 9, DARK, 0, LEG_Y + 0.55, 0, { open: true }));
  // the red bandana: a cone hung from the neck, point down over the chest
  hang('chest', cyl(0.02, 0.3, 0.3, 6, BANDANA, 0, LEG_Y + 0.72, 0.05, { rx: Math.PI, open: true }));
  // the square tin head on a dark neck
  hang('neck', box(0.18, 0.06, 0.18, DARK, 0, LEG_Y + 0.79, 0));
  hang('head', box(0.42, 0.36, 0.38, TIN, 0, LEG_Y + 0.98, 0, 0, { vary: 0.06 }));
  // the hat: a wide flat brim, a tapered crown, a red band
  hang('head', cyl(0.48, 0.48, 0.04, 12, HAT, 0, LEG_Y + 1.18, 0));
  hang('head', cyl(0.2, 0.24, 0.32, 10, HAT, 0, LEG_Y + 1.36, 0));
  hang('head', cyl(0.245, 0.245, 0.05, 10, HAT_BAND, 0, LEG_Y + 1.24, 0, { open: true }));
  // two glowing amber eyes: the `Eye` part, drawn in the look's `glow`
  for (const k of [-1, 1]) {
    const gem = new THREE.OctahedronGeometry(0.06).toNonIndexed();
    const colours = new Float32Array(gem.getAttribute('position').count * 3), amber = new THREE.Color(EYE);
    for (let i = 0; i < colours.length; i += 3) colours.set([amber.r, amber.g, amber.b], i);
    gem.setAttribute('color', new THREE.BufferAttribute(colours, 3));
    hang('head', place(gem, k * 0.1, LEG_Y + 1.0, 0.2), eye);
  }
  return root;
}

const ID = [0, 0, 0, 1] as const;
const euler = (x: number, y = 0, z = 0): number[] => new THREE.Quaternion().setFromEuler(new THREE.Euler(x, y, z, 'YXZ')).toArray();
const rx = (t: number): number[] => euler(t);
const quats = (bone: string, times: readonly number[], keys: readonly (readonly number[])[]): THREE.QuaternionKeyframeTrack =>
  new THREE.QuaternionKeyframeTrack(`${bone}.quaternion`, [...times], keys.flat());
/** A bone's local translation (the 0.6 node's units, the cleanroom's times 0.6) away from its parent. */
const moves = (bone: string, times: readonly number[], keys: readonly V3[]): THREE.VectorKeyframeTrack =>
  new THREE.VectorKeyframeTrack(`${bone}.position`, [...times], keys.flatMap(([x, y, z]) => [x, y, z]));

/** The aim's length: the attack clip the look samples over each shot's windup (the strike's `windup` is the whole clip). */
export const BANDIT_ATTACK_SPAN = 1;
/** The low ready: the rifle's muzzle tipped down and across while it walks or waits. */
const LOW = euler(0.55, 0.25, 0), LOW_BOB = euler(0.5, 0.25, 0);
/** The gait the engine's biped poser draws (`BipedRigPose.walk`), as a clip on the gait's phase. */
function gait(): THREE.KeyframeTrack[] {
  const times = Array.from({ length: 9 }, (_unused, i) => i / 8);
  const leg = (sign: number, side: string): THREE.KeyframeTrack[] => {
    const swing = times.map(t => sign * Math.sin(t * 2 * Math.PI)), thigh = swing.map(s => 0.55 * s), shin = swing.map(s => 0.6 * Math.max(0, -s));
    return [quats(`thigh.${side}`, times, thigh.map(rx)), quats(`shin.${side}`, times, shin.map(rx)),
      quats(`foot.${side}`, times, thigh.map((t, i) => rx(-(t + (shin[i] ?? 0)) * 0.4)))];
  };
  return [...leg(1, 'L'), ...leg(-1, 'R')];
}

/** The body's rest translation (its bone sits at the frame's origin). */
const BODY: V3 = [0, 0, 0];
const off = (rest: V3, [x, y, z]: V3): V3 => [rest[0] + x, rest[1] + y, rest[2] + z];

/**
 * The bandit's clips. Loops: `idle` (the rifle at the low ready, breathing, looking about) and `walk` (the poser's gait
 * with the rifle carried). One-shots: `attack` (over the shot's windup: the rifle comes up to the shoulder, the head drops
 * to the stock, the feet brace, it holds the aim), `attack.fire` (the engine plays it as the round leaves: the kick, the
 * step back, the lever worked and the rifle lowered), `hit` (a jolt back, the rifle knocked down) and `die` (it jerks,
 * buckles, the rifle loose in its hands, and falls on its back).
 */
export function banditClips(): THREE.AnimationClip[] {
  // lying on its back the hat's brim (0.48 m behind the head, at 0.6) holds the body 0.29 m up
  const down = 0.29, lean = rx(0.1), aimHead = rx(0.14), span = BANDIT_ATTACK_SPAN;
  return [
    new THREE.AnimationClip('idle', 2.4, [
      quats('grip', [0, 1.2, 2.4], [LOW, LOW_BOB, LOW]),
      quats('spine', [0, 1.2, 2.4], [ID, rx(0.03), ID]),
      quats('head', [0, 0.8, 1.8, 2.4], [ID, euler(0, 0.2), euler(0, -0.15), ID]),
    ]),
    new THREE.AnimationClip('walk', 1, [
      ...gait(),
      quats('grip', [0, 0.25, 0.5, 0.75, 1], [LOW, LOW_BOB, LOW, LOW_BOB, LOW]),
      quats('spine', [0, 1], [rx(0.08), rx(0.08)]),
    ]),
    new THREE.AnimationClip('attack', span, [
      quats('grip', [0, 0.28, 0.38, 0.7, span], [LOW, rx(-0.06), ID, rx(0.015), ID]),
      quats('spine', [0, 0.3, span], [ID, lean, lean]),
      quats('head', [0, 0.35, span], [ID, aimHead, aimHead]),
      quats('thigh.L', [0, 0.3, span], [ID, rx(-0.18), rx(-0.18)]),
      quats('thigh.R', [0, 0.3, span], [ID, rx(0.12), rx(0.12)]),
      quats('shin.R', [0, 0.3, span], [ID, rx(0.18), rx(0.18)]),
    ]),
    new THREE.AnimationClip('attack.fire', 0.85, [
      quats('grip', [0, 0.05, 0.2, 0.42, 0.55, 0.85], [ID, rx(-0.3), rx(-0.05), rx(0.05), ID, LOW]),
      quats('rifle', [0, 0.42, 0.5, 0.58, 0.85], [ID, ID, euler(0, 0, 0.35), ID, ID]),
      quats('spine', [0, 0.06, 0.25, 0.85], [lean, rx(-0.14), rx(0.06), ID]),
      quats('head', [0, 0.06, 0.25, 0.85], [aimHead, rx(-0.12), aimHead, ID]),
      moves('body', [0, 0.07, 0.4], [BODY, off(BODY, [0, 0, -0.06]), BODY]),
    ]),
    new THREE.AnimationClip('hit', 0.45, [
      quats('spine', [0, 0.08, 0.45], [ID, rx(-0.42), ID]), quats('head', [0, 0.08, 0.45], [ID, rx(-0.35), ID]),
      quats('grip', [0, 0.08, 0.45], [LOW, euler(1.0, 0.4, 0.2), LOW]),
      moves('body', [0, 0.08, 0.45], [BODY, off(BODY, [0, 0, -0.1]), BODY]),
    ]),
    new THREE.AnimationClip('die', 1.4, [
      quats('spine', [0, 0.1, 0.35, 1.4], [ID, rx(-0.45), rx(0.35), ID]),
      quats('thigh.L', [0, 0.25, 0.5, 1.4], [ID, rx(-0.7), rx(-0.4), ID]), quats('thigh.R', [0, 0.25, 0.5, 1.4], [ID, rx(-0.5), rx(-0.3), ID]),
      quats('shin.L', [0, 0.25, 0.5, 1.4], [ID, rx(1.1), rx(0.6), ID]), quats('shin.R', [0, 0.25, 0.5, 1.4], [ID, rx(0.9), rx(0.5), ID]),
      quats('body', [0, 0.1, 0.4, 0.8, 1.15, 1.4], [ID, rx(-0.2), rx(0.1), rx(-1.0), rx(-1.6), rx(-Math.PI / 2)]),
      moves('body', [0, 0.25, 0.5, 0.8, 1.15, 1.4], [BODY, off(BODY, [0, -0.15, 0.02]), off(BODY, [0, -0.2, 0]), off(BODY, [0, 0.1, -0.15]), off(BODY, [0, down + 0.03, -0.2]), off(BODY, [0, down, -0.2])]),
      quats('head', [0, 0.1, 0.8, 1.4], [ID, rx(-0.5), rx(-0.1), ID]),
      quats('grip', [0, 0.1, 0.6, 1.4], [LOW, euler(-0.6, 0, 0.3), euler(0.9, 0.5, 0.4), euler(0.4, 0.9, 0.9)]),
      quats('rifle', [0, 0.12, 0.7, 1.4], [ID, ID, euler(0.3, 0.4, 0.3), euler(0.2, 0.5, 0.5)]),
    ]),
  ];
}

/** The skin's binding: the idle and the rifle-carrying walk loop, the old GLB's metal tin, and the eye in the look's glow. */
export const BANDIT_BINDING: CreatureBinding = {
  loops: ['idle', 'walk'],
  material: { envStrength: 0.8, family: 'pbr', metalness: 0.45, occlusion: 0, roughness: 0.45, vertexColours: true },
  materials: { Eye: 'glow' },
};
type CreatureOptions = Parameters<ShardWorld['creature']>[2];
/** The can's hit capsule on the spine and the head's sphere, at the old GLB's dims (1.45 m, can middle at 0.77 m). */
const BANDIT_VOLUMES: NonNullable<CreatureOptions['volumes']> = [
  { part: 'body', bone: 'spine', at: [0, 0.11, 0], shape: 'capsule', radius: 0.36, halfLength: 0.3, axis: 'y', multiplier: 1 },
  { part: 'head', bone: 'head', at: [0, 0.07, 0], shape: 'sphere', radius: 0.22, halfLength: 0, axis: 'y', multiplier: 2 },
];
/**
 * The tin bandit and the brawler: one body, the brawler at 1.15 (its hit dims) and with no muzzle (it clubs with the
 * butt and tackles; a muzzle would flash on its charge). Their species rows are rows/actors/bandits.json; their spawns,
 * brains and strikes stay creatures.json's.
 */
export function banditCreatures(world: ShardWorld): void {
  for (const [id, scale] of [['brasscap.bandit', 1], ['brasscap.brawler', 1.15]] as const) {
    world.creature(id, banditBody({ muzzle: id === 'brasscap.bandit' }), {
      species: bandits.bandits[id] as CreatureOptions['species'],
      size: 'medium', scale, skeleton: 'biped', volumes: BANDIT_VOLUMES,
      clips: banditClips(), attackSpan: BANDIT_ATTACK_SPAN, family: 'toon', ...BANDIT_BINDING,
    });
  }
}
