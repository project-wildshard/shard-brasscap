// ONE-FORMAT CC13 (absorbs SHARD-SOURCE AP23c): the Tin Bandit from source, on the kit biped skeleton. The cleanroom's
// bandit (brasscap-cleanroom src/actors.js, `actors.ts` `bandit()` here) is one merged mesh; this is the same can of a
// robot rebuilt limb by limb: every piece hangs from the biped bone it moves with (legs split at the knee, arms at the
// elbow, the revolver in the left fist), so the engine's biped poser walks it with no walk clip. `world.creature`
// compiles it to the skinned GLB and skin file that `tools/bandit.ts` used to write by hand.
//
// Cleanroom units (legs 0.85 m, hat top 2.42 m) under one unnamed 0.6 scale node: the bandit stands 1.45 m, as the
// species' hit dims and the old GLB had it. Bones rest unrotated; the raised arms are the meshes' rest rotation.
// Clips: `attack` (the shot's kick), `hit` (a recoil) and `die` (falls on its back). No `idle` or `walk`: a skin with
// either plays it in place of the poser's gait.
import * as THREE from 'three';
import type { ShardWorld } from '@wildshard/sharddev/scene/author';
import type { CreatureBinding } from '@wildshard/sharddev/scene/creature';
import bandits from '../rows/actors/bandits.json' with { type: 'json' };
import { box, cyl, place } from './util';

/** The bandit stands at 0.6 of the cleanroom's size. */
const S = 0.6;
const TIN = '#8a9198', DARK = '#4b4f55', HAT = '#2b2522', HAT_BAND = '#8a2a20', BANDANA = '#c8352a', EYE = '#ffc030', GUN = '#2a2a2e';
const LEG_Y = 0.9;
/** The raised arms: down and forward from the shoulder (the cleanroom's `rx -0.9`, splayed `rz ±0.15`). */
const ARM_RX = -0.9, ARM_RZ = 0.15, ARM = 0.6;

type V3 = readonly [number, number, number];
/** The biped bones' rest positions in cleanroom units (the bandit's frame, +z forward, +x its left), parent first. */
function bones(): readonly (readonly [string, string | null, V3])[] {
  const arm = (k: number, along: number): V3 => {
    const dir = new THREE.Vector3(0, -1, 0).applyEuler(new THREE.Euler(ARM_RX, 0, k * ARM_RZ, 'YXZ'));
    return [k * 0.36 + dir.x * along, LEG_Y + 0.65 + dir.y * along, dir.z * along];
  };
  return [
    ['body', null, [0, 0, 0]],
    ['hips', 'body', [0, LEG_Y, 0]],
    ['spine', 'hips', [0, LEG_Y + 0.2, 0]],
    ['chest', 'spine', [0, LEG_Y + 0.55, 0]],
    ['neck', 'chest', [0, LEG_Y + 0.76, 0]],
    ['head', 'neck', [0, LEG_Y + 0.86, 0]],
    ...[['L', 1], ['R', -1]].flatMap(([side, k]) => [
      [`upperArm.${side}`, 'chest', arm(k as number, 0)],
      [`forearm.${side}`, `upperArm.${side}`, arm(k as number, ARM / 2)],
      [`hand.${side}`, `forearm.${side}`, arm(k as number, ARM)],
      [`thigh.${side}`, 'hips', [(k as number) * 0.14, 0.85, 0]],
      [`shin.${side}`, `thigh.${side}`, [(k as number) * 0.14, 0.45, 0]],
      [`foot.${side}`, `shin.${side}`, [(k as number) * 0.14, 0.08, 0]],
    ] as (readonly [string, string, V3])[]),
  ];
}

/** An arm segment from `from` to `to` of its length down the raised arm, in the cleanroom's frame. */
function armPiece(k: number, from: number, to: number): THREE.BufferGeometry {
  const g = box(0.12, to - from, 0.12, DARK, 0, -(from + to) / 2, 0);
  return place(place(g, 0, 0, 0, 0, ARM_RX, k * ARM_RZ), k * 0.36, LEG_Y + 0.65, 0);
}

/**
 * The bandit's body: a `Group` (the creature's frame) holding an unnamed 0.6 scale node, then the biped bones, each
 * carrying its own pieces. `tin` draws the body with vertex colours; `eye` (GLB material `Eye`) the two glowing eyes.
 */
export function banditBody(): THREE.Group {
  const tin = new THREE.MeshStandardMaterial({ name: 'Tin', vertexColors: true, metalness: 0.45, roughness: 0.45, flatShading: true });
  const eye = new THREE.MeshStandardMaterial({ name: 'Eye', vertexColors: true, metalness: 0.45, roughness: 0.45, flatShading: true });
  const root = new THREE.Group(), scaled = new THREE.Group();
  root.name = 'brasscap.bandit'; scaled.scale.setScalar(S); root.add(scaled);
  const nodes = new Map<string, { node: THREE.Group; at: V3 }>();
  for (const [name, parent, at] of bones()) {
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
    // the raised arms, split at the elbow
    hang(`upperArm.${side}`, armPiece(k, 0, ARM / 2));
    hang(`forearm.${side}`, armPiece(k, ARM / 2, ARM));
  }
  // the revolver in the left fist, held out in front
  hang('hand.L', box(0.06, 0.08, 0.55, GUN, 0.36, LEG_Y + 0.42, 0.45));
  hang('hand.L', box(0.05, 0.14, 0.07, GUN, 0.36, LEG_Y + 0.33, 0.3));
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
const rx = (t: number): number[] => [Math.sin(t / 2), 0, 0, Math.cos(t / 2)];
const quats = (bone: string, times: readonly number[], keys: readonly (readonly number[])[]): THREE.QuaternionKeyframeTrack =>
  new THREE.QuaternionKeyframeTrack(`${bone}.quaternion`, [...times], keys.flat());
/** The body's rest translation (its bone sits at the frame's origin). */
const moves = (bone: string, times: readonly number[], keys: readonly V3[]): THREE.VectorKeyframeTrack =>
  new THREE.VectorKeyframeTrack(`${bone}.position`, [...times], keys.flatMap(([x, y, z]) => [x, y, z]));

/** The shot's length: the attack clip the look samples over each strike's progress. */
export const BANDIT_ATTACK_SPAN = 0.6;

/** The bandit's one-shot clips: the shot's kick, a recoil and its fall, each on the biped bones. */
export function banditClips(): THREE.AnimationClip[] {
  const kick = [0, 0.25, BANDIT_ATTACK_SPAN], recoil = [0, 0.1, 0.4], fall = [0, 0.3, 0.7, 1];
  // lying on its back the hat's brim (0.48 m behind the head, at 0.6) holds the body 0.29 m up
  const down = 0.29;
  return [
    new THREE.AnimationClip('attack', BANDIT_ATTACK_SPAN, [
      quats('spine', kick, [ID, rx(0.3), ID]),
      quats('upperArm.L', kick, [ID, rx(-0.35), ID]), quats('upperArm.R', kick, [ID, rx(-0.2), ID]),
      quats('head', kick, [ID, rx(0.15), ID]),
    ]),
    new THREE.AnimationClip('hit', 0.4, [
      quats('spine', recoil, [ID, rx(-0.32), ID]), quats('head', recoil, [ID, rx(-0.3), ID]),
    ]),
    new THREE.AnimationClip('die', 1, [
      quats('body', fall, [ID, rx(-0.4), rx(-1.35), rx(-Math.PI / 2)]),
      moves('body', fall, [[0, 0, 0], [0, 0, -0.03], [0, 0.15, -0.1], [0, down, -0.1]]),
      quats('head', fall, [ID, rx(-0.25), rx(-0.1), ID]),
    ]),
  ];
}

/** The skin's binding: no looping clip (the poser walks it), the old GLB's metal tin, and the eye in the look's glow. */
export const BANDIT_BINDING: CreatureBinding = {
  loops: [],
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
 * The tin bandit and the brawler: one body on the kit biped, the brawler at 1.15 (its hit dims). Their species rows are
 * rows/actors/bandits.json; their spawns, brains and strikes stay creatures.json's.
 */
export function banditCreatures(world: ShardWorld): void {
  for (const [id, scale] of [['brasscap.bandit', 1], ['brasscap.brawler', 1.15]] as const) {
    world.creature(id, banditBody(), {
      species: bandits.bandits[id] as CreatureOptions['species'],
      size: 'medium', scale, skeleton: 'biped', volumes: BANDIT_VOLUMES,
      clips: banditClips(), attackSpan: BANDIT_ATTACK_SPAN, family: 'toon', ...BANDIT_BINDING,
    });
  }
}
