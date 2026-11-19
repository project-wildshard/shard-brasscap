/* oxlint-disable eslint/no-magic-numbers, eslint/id-length, unicorn/numeric-separators-style, unicorn/number-literal-case, typescript/no-non-null-assertion, eslint/capitalized-comments, eslint/no-inline-comments, eslint/sort-vars, eslint/no-plusplus, eslint/curly, typescript/explicit-function-return-type, eslint/max-params, eslint/max-statements, unicorn/no-zero-fractions, typescript/prefer-readonly-parameter-types, eslint/max-lines-per-function, node/no-sync, import/exports-last, import/group-exports, eslint/max-lines, typescript/explicit-member-accessibility, unicorn/max-nested-calls -- Author-side model data, a stand-in for a Blender export: coordinates and colours, never shipped or imported. */
// Brasscap Mesa's three guns (QA42 adds the scattergun and the long rifle, and parts that move); first the lever-action rifle, BM-3's asset half in meta
// TEMPLATE-E2E-PLAN. An author-side stand-in for the Blender export, like
// canyon.ts (BM-1): a flat-shaded, vertex-coloured low-poly rifle as one GLB,
// walnut stock and fore-end, brass receiver and lever loop, a blued octagonal
// barrel over its magazine tube, and the holder's gloved hands and sleeves
// (LF2-8). Two primitives: matte (wood, steel, leather, cloth) and brass.
// The rifle lies along -Z (the muzzle forward, as a camera-held model points),
// +Y up, the origin at the receiver. Named empties: `muzzle` at the barrel's
// tip, `grip` at the wrist and `fore` under the fore-end, where hands go.
// The output is deterministic (no random numbers); rifle.test.ts holds the
// committed GLB to it.
//   node tools/rifle.ts [out.glb]
import { writeFileSync } from 'node:fs'

import { Geo } from './canyon.ts'

type V3 = readonly [number, number, number]
type Hex = number

const WALNUT = 0x6b3a1f,
  WALNUT_DARK = 0x52301b,
  BRASS = 0xc9a227,
  BRASS_LIGHT = 0xe0b830,
  BRASS_DARK = 0x9c7a1c,
  BLUED = 0x2f3338,
  STEEL = 0x454b52,
  BUTT_PLATE = 0x3a2a20,
  // LF2-8: the holder's brown leather gloves and tan duster sleeves, as t2-03 and t2-07 draw them.
  GLOVE = 0x80553a,
  GLOVE_DARK = 0x60402a,
  CUFF = 0x45291a,
  SLEEVE = 0xc2733c,
  SLEEVE_SHADE = 0xa55d2e

/** The barrel's tip, where rounds and the flash leave. */
export const MUZZLE: V3 = [0, 0.028, -0.74]
const GRIP: V3 = [0, -0.035, 0.14]
const FORE: V3 = [0, -0.02, -0.26]

const sub = (a: V3, b: V3): [number, number, number] => [
  a[0] - b[0],
  a[1] - b[1],
  a[2] - b[2],
]
function centroid(points: readonly V3[]): V3 {
  let x = 0,
    y = 0,
    z = 0
  for (const p of points) {
    x += p[0]
    y += p[1]
    z += p[2]
  }
  return [x / points.length, y / points.length, z / points.length]
}

/** A convex part's faces, each wound so its normal points away from the part's centre. */
class Part {
  readonly g: Geo
  readonly centre: V3
  constructor(g: Geo, centre: V3) {
    this.g = g
    this.centre = centre
  }
  face(points: readonly V3[], hex: Hex): void {
    const c = centroid(points),
      u = sub(points[1]!, points[0]!),
      w = sub(points[2]!, points[0]!)
    const n: V3 = [
      u[1] * w[2] - u[2] * w[1],
      u[2] * w[0] - u[0] * w[2],
      u[0] * w[1] - u[1] * w[0],
    ]
    const out = sub(c, this.centre),
      flip = n[0] * out[0] + n[1] * out[1] + n[2] * out[2] < 0
    const ring = flip ? points.toReversed() : points
    for (let i = 1; i + 1 < ring.length; i++)
      this.g.tri(ring[0]!, ring[i]!, ring[i + 1]!, hex)
  }
}

/**
 * A hexahedron from its eight corners: the back face (b0..b3) then the front (f0..f3), each ring in the same order.
 * Faces are oriented outward from the centre, so the corner order only needs to go round.
 */
function hexa(
  g: Geo,
  back: readonly [V3, V3, V3, V3],
  front: readonly [V3, V3, V3, V3],
  side: Hex,
  top: Hex = side,
  cap: Hex = side,
): void {
  const part = new Part(g, centroid([...back, ...front]))
  part.face(back, cap)
  part.face(front, cap)
  for (let i = 0; i < 4; i++) {
    const j = (i + 1) % 4,
      quad = [back[i]!, back[j]!, front[j]!, front[i]!]
    // The face whose corners sit highest takes the top colour.
    const up = quad.every(p => p[1] >= centroid([...back, ...front])[1])
    part.face(quad, up ? top : side)
  }
}

/** An axis-aligned box from its centre and size. */
function box(g: Geo, c: V3, s: V3, side: Hex, top: Hex = side): void {
  const [x0, x1] = [c[0] - s[0] / 2, c[0] + s[0] / 2],
    [y0, y1] = [c[1] - s[1] / 2, c[1] + s[1] / 2],
    [z0, z1] = [c[2] - s[2] / 2, c[2] + s[2] / 2]
  hexa(
    g,
    [
      [x0, y0, z1],
      [x1, y0, z1],
      [x1, y1, z1],
      [x0, y1, z1],
    ],
    [
      [x0, y0, z0],
      [x1, y0, z0],
      [x1, y1, z0],
      [x0, y1, z0],
    ],
    side,
    top,
  )
}

/** A tube along Z: a regular polygon of `sides` round (x, y), from z0 back to z1 forward, capped. */
function tube(
  g: Geo,
  x: number,
  y: number,
  r: number,
  z0: number,
  z1: number,
  sides: number,
  hex: Hex,
  cap: Hex | null = hex,
): void {
  const ring = (z: number): V3[] =>
    Array.from({ length: sides }, (_, i) => {
      const a = (i / sides) * Math.PI * 2 + Math.PI / sides
      return [x + Math.cos(a) * r, y + Math.sin(a) * r, z] as const
    })
  const back = ring(z0),
    front = ring(z1),
    part = new Part(g, [x, y, (z0 + z1) / 2])
  if (cap !== null) {
    part.face(back, cap)
    part.face(front, cap)
  }
  for (let i = 0; i < sides; i++) {
    const j = (i + 1) % sides
    part.face([back[i]!, back[j]!, front[j]!, front[i]!], hex)
  }
}

/** A prism of `sides` from ring (a, ra) to ring (b, rb), round the axis a to b, capped; faces alternate two shades. */
function limb(
  g: Geo,
  a: V3,
  b: V3,
  ra: number,
  rb: number,
  sides: number,
  hex: Hex,
  shade: Hex = hex,
): void {
  const d = sub(b, a),
    len = Math.hypot(...d),
    t: V3 = [d[0] / len, d[1] / len, d[2] / len],
    pick: V3 = Math.abs(t[0]) < 0.9 ? [1, 0, 0] : [0, 1, 0],
    u0: V3 = [
      t[1] * pick[2] - t[2] * pick[1],
      t[2] * pick[0] - t[0] * pick[2],
      t[0] * pick[1] - t[1] * pick[0],
    ],
    ul = Math.hypot(...u0),
    u: V3 = [u0[0] / ul, u0[1] / ul, u0[2] / ul],
    w: V3 = [
      t[1] * u[2] - t[2] * u[1],
      t[2] * u[0] - t[0] * u[2],
      t[0] * u[1] - t[1] * u[0],
    ]
  const ring = (c: V3, r: number): V3[] =>
    Array.from({ length: sides }, (_, i) => {
      const k = (i / sides) * Math.PI * 2 + Math.PI / sides,
        x = Math.cos(k) * r,
        y = Math.sin(k) * r
      return [
        c[0] + u[0] * x + w[0] * y,
        c[1] + u[1] * x + w[1] * y,
        c[2] + u[2] * x + w[2] * y,
      ] as const
    })
  const back = ring(a, ra),
    front = ring(b, rb),
    part = new Part(g, centroid([a, b]))
  part.face(back, shade)
  part.face(front, shade)
  for (let i = 0; i < sides; i++) {
    const j = (i + 1) % sides
    part.face(
      [back[i]!, back[j]!, front[j]!, front[i]!],
      i % 2 === 0 ? hex : shade,
    )
  }
}

/**
 * The holder's right hand (LF2-8), built round its own node at the wrist (`GRIP`): a glove round the wrist, the thumb
 * across its top, two fingers curled into the lever loop, a dark cuff and the duster sleeve running back out of the
 * frame. QA42: its own node so a reload can take it to the loading gate with a round in its fingers.
 */
function rightHand(g: Geo, at: V3): void {
  const o = (p: V3): V3 => sub(p, at)
  box(g, o([0.005, -0.03, 0.15]), [0.058, 0.08, 0.09], GLOVE, GLOVE)
  box(g, o([0.034, -0.026, 0.135]), [0.012, 0.05, 0.07], GLOVE_DARK)
  box(g, o([-0.012, 0.012, 0.13]), [0.022, 0.018, 0.06], GLOVE_DARK)
  box(g, o([0, -0.08, 0.1]), [0.03, 0.022, 0.03], GLOVE_DARK)
  box(g, o([0, -0.08, 0.135]), [0.03, 0.022, 0.03], GLOVE)
  limb(g, o([0.012, -0.045, 0.185]), o([0.04, -0.105, 0.265]), 0.036, 0.042, 6, CUFF)
  limb(g, o([0.035, -0.095, 0.25]), o([0.12, -0.3, 0.56]), 0.047, 0.058, 6, SLEEVE, SLEEVE_SHADE)
}
/** The left hand under and round the fore-end at `fore`: fingers up its far side, the thumb along its near side. */
function leftHand(g: Geo, fore: V3): void {
  const at = (x: number, y: number, z: number): V3 => [fore[0] + x, fore[1] + y, fore[2] + z]
  box(g, at(0.0, -0.02, -0.01), [0.056, 0.03, 0.1], GLOVE)
  box(g, at(0.026, 0.008, -0.015), [0.014, 0.05, 0.085], GLOVE_DARK)
  box(g, at(-0.026, 0.004, 0.0), [0.012, 0.036, 0.07], GLOVE)
  limb(g, at(-0.006, -0.035, 0.025), at(-0.04, -0.08, 0.1), 0.034, 0.04, 6, CUFF)
  limb(g, at(-0.036, -0.074, 0.085), at(-0.22, -0.34, 0.4), 0.045, 0.058, 6, SLEEVE, SLEEVE_SHADE)
}
/** A cartridge in the fingers: a brass case and its lead nose, along -Z, its base at the node. */
function cartridge(g: Geo, lead: Geo, r: number, length: number): void {
  tube(g, 0, 0, r * 1.15, 0, -0.004, 8, BRASS_DARK)
  tube(g, 0, 0, r, -0.004, -length, 8, BRASS_LIGHT, BRASS)
  tube(lead, 0, 0, r * 0.82, -length, -length - r * 1.6, 6, LEAD)
}

/** One Brasscap gun's shape: its bore, its receiver's metal, its furniture and where things sit (metres, -Z forward). */
export interface GunSpec {
  readonly id: 'lever-action' | 'scattergun' | 'long-rifle'
  /** the barrel's tip (the flash and the round leave here) and its bore radius */
  readonly muzzle: V3
  readonly bore: number
  /** octagonal (8 flats) or round (12) */
  readonly octagon: boolean
  /** the magazine tube under the barrel, to this z */
  readonly tubeTo: number
  /** the receiver's metal and its lighter inset */
  readonly receiver: readonly [Hex, Hex]
  readonly receiverHeight: number
  /** the fore-end's front, and the stock's length and drop */
  readonly foreTo: number
  readonly stockTo: number
  readonly drop: number
  readonly wood: readonly [Hex, Hex, Hex]
  /** a brass tube scope over the receiver (the long rifle) */
  readonly scope: boolean
  /** the round's case radius and length */
  readonly round: readonly [number, number]
}

const WALNUT_LIGHT = 0x7a4526,
  CASE_STEEL = 0x5d6670,
  CASE_STEEL_LIGHT = 0x8a8f93,
  OIL_WALNUT = 0x5a3018,
  OIL_WALNUT_LIGHT = 0x6e3c20,
  LEAD = 0x6d6a66
/** The three guns: Brasscap's rack lever-action, camp 1's scattergun and camp 2's long rifle. */
export const GUNS: readonly GunSpec[] = [
  { id: 'lever-action', muzzle: MUZZLE, bore: 0.012, octagon: true, tubeTo: -0.64, receiver: [BRASS, BRASS_LIGHT], receiverHeight: 0.085,
    foreTo: -0.4, stockTo: 0.46, drop: 0.15, wood: [WALNUT, WALNUT_LIGHT, WALNUT_DARK], scope: false, round: [0.007, 0.045] },
  { id: 'scattergun', muzzle: [0, 0.03, -0.6], bore: 0.019, octagon: false, tubeTo: -0.5, receiver: [CASE_STEEL, CASE_STEEL_LIGHT], receiverHeight: 0.11,
    foreTo: -0.34, stockTo: 0.44, drop: 0.16, wood: [OIL_WALNUT, OIL_WALNUT_LIGHT, WALNUT_DARK], scope: false, round: [0.011, 0.06] },
  { id: 'long-rifle', muzzle: [0, 0.028, -1.0], bore: 0.0125, octagon: true, tubeTo: -0.72, receiver: [BLUED, STEEL], receiverHeight: 0.085,
    foreTo: -0.56, stockTo: 0.5, drop: 0.14, wood: [WALNUT, WALNUT_LIGHT, WALNUT_DARK], scope: true, round: [0.0075, 0.055] },
]
/** Where the right hand rests (its node), and the loading gate on the receiver's right side. */
const GATE: V3 = [0.024, -0.018, -0.03]

/** The lever loop round its pivot (the front tang, under the receiver's front): four bars round a finger hole. */
function leverLoop(g: Geo, big: boolean, metal: Hex): void {
  const w = big ? 0.014 : 0.012,
    t = 0.01,
    s = big ? 1.25 : 1
  box(g, [0, -0.002, 0], [w, t, 0.05], metal) // front tang under the receiver
  box(g, [0, -0.025 * s, 0.045], [w, 0.055 * s, t], metal) // front of the loop
  box(g, [0, -0.055 * s, 0.085 * s], [w, t, 0.09 * s], metal) // bottom of the loop
  box(g, [0, -0.03 * s, 0.128 * s], [w, 0.05 * s, t], metal) // back of the loop
  box(g, [0, -0.005, 0.14], [w, t, 0.03], metal) // back into the wrist
}
const LEVER_PIVOT: V3 = [0, -0.05, 0.03]
const HAMMER_PIVOT: V3 = [0, 0.02, 0.1]

interface GunParts { body: Geo; metal: Geo; lever: Geo; hammer: Geo; hand: Geo; round: Geo; lead: Geo }
let built: GunParts | null = null

/** One gun's parts, each in its own node's frame. */
function gun(spec: GunSpec): GunParts {
  const body = new Geo(), metal = new Geo(), parts: GunParts = { body, metal, lever: new Geo(), hammer: new Geo(), hand: new Geo(), round: new Geo(), lead: new Geo() }
  const [wood, woodTop, woodDark] = spec.wood, [rec, recLight] = spec.receiver, h = spec.receiverHeight
  // Butt stock: a tall wedge narrowing to the wrist, with a dark butt plate.
  hexa(body, [[-0.022, -spec.drop, spec.stockTo], [0.022, -spec.drop, spec.stockTo], [0.022, -0.005, spec.stockTo], [-0.022, -0.005, spec.stockTo]],
    [[-0.017, -0.06, 0.19], [0.017, -0.06, 0.19], [0.017, 0.0, 0.19], [-0.017, 0.0, 0.19]], wood, woodTop, woodDark)
  box(body, [0, -(spec.drop + 0.005) / 2, spec.stockTo + 0.005], [0.046, spec.drop, 0.01], BUTT_PLATE)
  // a comb line and a dark toe line along the stock
  box(body, [0, -0.004, (spec.stockTo + 0.19) / 2], [0.03, 0.006, spec.stockTo - 0.19], woodDark)
  // Wrist into the receiver.
  hexa(body, [[-0.017, -0.06, 0.19], [0.017, -0.06, 0.19], [0.017, 0.0, 0.19], [-0.017, 0.0, 0.19]],
    [[-0.018, -0.045, 0.1], [0.018, -0.045, 0.1], [0.018, 0.02, 0.1], [-0.018, 0.02, 0.1]], wood, woodTop)
  // The receiver: a block with inset side plates, the loading gate on its right, the bolt along its top.
  box(metal, [0, 0.0375 - h / 2, 0.0], [0.04, h, 0.2], rec, recLight)
  box(metal, [0.021, -0.005, 0.01], [0.002, h * 0.6, 0.12], recLight)
  box(metal, [-0.021, -0.005, 0.01], [0.002, h * 0.6, 0.12], recLight)
  box(body, [GATE[0], GATE[1], GATE[2]], [0.003, 0.018, 0.04], BUTT_PLATE) // the loading gate's dark mouth
  box(body, [0, 0.04, 0.035], [0.012, 0.01, 0.06], STEEL) // the bolt's top
  box(body, [0, 0.012, 0.12], [0.008, 0.01, 0.02], STEEL) // the tang behind the hammer
  // The trigger in its guard.
  box(body, [0, -0.05, 0.095], [0.006, 0.03, 0.006], STEEL)
  // The barrel, its magazine tube and the tube's cap.
  tube(body, 0, spec.muzzle[1], spec.bore, -0.1, spec.muzzle[2], spec.octagon ? 8 : 12, BLUED, 0x1c1f22)
  tube(body, 0, spec.muzzle[1], spec.bore * 0.45, spec.muzzle[2] + 0.002, spec.muzzle[2] - 0.0005, 8, 0x0a0a0a) // the bore's dark mouth
  const tubeY = spec.muzzle[1] - spec.bore - 0.012
  tube(body, 0, tubeY, 0.01 * (spec.bore > 0.015 ? 1.4 : 1), -0.1, spec.tubeTo, 8, STEEL)
  tube(metal, 0, tubeY, 0.011 * (spec.bore > 0.015 ? 1.4 : 1), spec.tubeTo, spec.tubeTo - 0.015, 8, BRASS_DARK)
  // The fore-end round the barrel and tube, and the bands.
  const foreTop = spec.muzzle[1] + spec.bore * 0.2, foreBottom = tubeY - 0.018
  hexa(body, [[-0.019, foreBottom, -0.1], [0.019, foreBottom, -0.1], [0.019, foreTop, -0.1], [-0.019, foreTop, -0.1]],
    [[-0.016, foreBottom + 0.006, spec.foreTo], [0.016, foreBottom + 0.006, spec.foreTo], [0.016, foreTop - 0.004, spec.foreTo], [-0.016, foreTop - 0.004, spec.foreTo]], wood, woodTop)
  const band = (z: number): void => box(metal, [0, (foreTop + foreBottom) / 2, z], [0.04, foreTop - foreBottom + 0.012, 0.012], BRASS, BRASS_LIGHT)
  band(spec.foreTo - 0.006)
  band(spec.tubeTo + 0.04)
  // The sights: a notched rear sight and the front bead (a scope stands over the receiver on the long rifle).
  const top = spec.muzzle[1] + spec.bore
  box(body, [-0.006, top + 0.008, -0.2], [0.005, 0.014, 0.008], STEEL)
  box(body, [0.006, top + 0.008, -0.2], [0.005, 0.014, 0.008], STEEL)
  box(metal, [0, top + 0.009, spec.muzzle[2] + 0.02], [0.004, 0.016, 0.01], BRASS_LIGHT)
  if (spec.scope) {
    const y = SCOPE_Y
    for (const z of [-0.02, -0.4]) { box(body, [0, (top + y) / 2, z], [0.01, y - top, 0.014], STEEL); box(metal, [0, y, z], [0.03, 0.03, 0.012], BRASS_DARK) }
    tube(metal, 0, y, 0.0105, 0.06, -0.62, 10, BRASS, null)
    tube(metal, 0, y, 0.016, 0.1, 0.06, 10, BRASS_LIGHT, null) // the eye bell
    tube(metal, 0, y, 0.0135, -0.62, -0.66, 10, BRASS_LIGHT, null) // the objective bell
  }
  // The hammer round its pivot: a spur up and back.
  const hp = (p: V3): V3 => sub(p, HAMMER_PIVOT)
  box(parts.hammer, hp([0, 0.032, 0.105]), [0.008, 0.026, 0.012], STEEL)
  box(parts.hammer, hp([0, 0.048, 0.118]), [0.012, 0.008, 0.018], STEEL)
  // The lever loop round its pivot.
  leverLoop(parts.lever, spec.id === 'scattergun', spec.id === 'lever-action' ? BRASS : spec.id === 'scattergun' ? CASE_STEEL : STEEL)
  // The hands, and the round in the right one's fingers.
  rightHand(parts.hand, GRIP)
  leftHand(body, [0, foreBottom, spec.foreTo * 0.65])
  cartridge(parts.round, parts.lead, spec.round[0], spec.round[1])
  return parts
}
/** The long rifle's scope axis: above the bore, where its sight line runs. */
const SCOPE_Y = 0.088

const node = (name: string, extra: object = {}): object => ({ name, ...extra })
/** One gun as one GLB: the body (matte and metal), the lever, the hammer, the right hand and its round, and the named empties. */
export function buildGun(spec: GunSpec): Buffer {
  const parts = gun(spec)
  built = parts
  const chunks: Buffer[] = [],
    views: object[] = [],
    accessors: object[] = []
  let offset = 0
  const push = (bytes: Buffer): number => {
    const pad = (4 - (bytes.length % 4)) % 4
    views.push({ buffer: 0, byteOffset: offset, byteLength: bytes.length, target: 34962 })
    chunks.push(Buffer.concat([bytes, Buffer.alloc(pad)]))
    offset += bytes.length + pad
    return views.length - 1
  }
  const primitive = (g: Geo, material: number): object => {
    const count = g.pos.length / 3,
      min = [Infinity, Infinity, Infinity],
      max = [-Infinity, -Infinity, -Infinity]
    for (let i = 0; i < g.pos.length; i++) {
      min[i % 3] = Math.min(min[i % 3]!, g.pos[i]!)
      max[i % 3] = Math.max(max[i % 3]!, g.pos[i]!)
    }
    const acc = (view: number, type: string, componentType: number, extra: object = {}): number => {
      accessors.push({ bufferView: view, componentType, count, type, ...extra })
      return accessors.length - 1
    }
    return {
      attributes: {
        POSITION: acc(push(Buffer.from(new Float32Array(g.pos).buffer)), 'VEC3', 5126, { min, max }),
        NORMAL: acc(push(Buffer.from(new Float32Array(g.nor).buffer)), 'VEC3', 5126),
        COLOR_0: acc(push(Buffer.from(new Uint8Array(g.col).buffer)), 'VEC4', 5121, { normalized: true }),
      },
      material,
    }
  }
  const meshes = [
    { name: spec.id, primitives: [primitive(parts.body, 0), primitive(parts.metal, 1)] },
    { name: 'lever', primitives: [primitive(parts.lever, 1)] },
    { name: 'hammer', primitives: [primitive(parts.hammer, 0)] },
    { name: 'handRight', primitives: [primitive(parts.hand, 0)] },
    { name: 'round', primitives: [primitive(parts.round, 1), primitive(parts.lead, 0)] },
  ]
  const sight: V3 = spec.scope ? [0, SCOPE_Y, -0.62] : [0, spec.muzzle[1] + spec.bore + 0.017, spec.muzzle[2] + 0.02]
  const nodes = [
    node(spec.id, { mesh: 0 }),
    node('muzzle', { translation: [...spec.muzzle] }),
    node('frontSight', { translation: [...sight] }),
    node('grip', { translation: [...GRIP] }),
    node('fore', { translation: [...FORE] }),
    node('gate', { translation: [...GATE] }),
    node('lever', { mesh: 1, translation: [...LEVER_PIVOT] }),
    node('hammer', { mesh: 2, translation: [...HAMMER_PIVOT] }),
    node('handRight', { mesh: 3, translation: [...GRIP], children: [9] }),
    // the round between the right hand's thumb and fingers, pointing forward
    node('round', { mesh: 4, translation: [-0.012, 0.012, -0.03] }),
  ]
  const bin = Buffer.concat(chunks)
  const json = {
    asset: { version: '2.0', generator: 'shard-brasscap tools/rifle.ts (BM-3, QA42)' },
    scene: 0,
    scenes: [{ name: `brasscap-${spec.id}`, nodes: nodes.map((_, i) => i).filter(i => i !== 9) }],
    nodes,
    meshes,
    materials: [
      { name: 'Matte', pbrMetallicRoughness: { baseColorFactor: [1, 1, 1, 1], metallicFactor: 0, roughnessFactor: 0.85 } },
      { name: 'Brass', pbrMetallicRoughness: { baseColorFactor: [1, 1, 1, 1], metallicFactor: 0.25, roughnessFactor: 0.45 } },
    ],
    accessors,
    bufferViews: views,
    buffers: [{ byteLength: bin.length }],
  }
  let text = Buffer.from(JSON.stringify(json))
  text = Buffer.concat([text, Buffer.alloc((4 - (text.length % 4)) % 4, 0x20)])
  const header = Buffer.alloc(12),
    jh = Buffer.alloc(8),
    bh = Buffer.alloc(8)
  header.writeUInt32LE(0x46546c67, 0)
  header.writeUInt32LE(2, 4)
  header.writeUInt32LE(12 + 8 + text.length + 8 + bin.length, 8)
  jh.writeUInt32LE(text.length, 0)
  jh.writeUInt32LE(0x4e4f534a, 4)
  bh.writeUInt32LE(bin.length, 0)
  bh.writeUInt32LE(0x004e4942, 4)
  return Buffer.concat([header, jh, text, bh, bin])
}
/** The rack's lever-action (`src/sources/rifle.glb`). */
export function buildRifle(): Buffer {
  return buildGun(GUNS[0]!)
}
/** Triangles in the last build, for the tool's report and the budget test. */
export function rifleTriangles(): number {
  if (built === null) return 0
  return Object.values(built).reduce((sum: number, g: Geo) => sum + g.pos.length / 9, 0)
}
/** Each gun's GLB under src/sources/. */
export const GUN_FILES: Readonly<Record<GunSpec['id'], string>> = {
  'lever-action': 'src/sources/rifle.glb',
  scattergun: 'src/sources/scattergun.glb',
  'long-rifle': 'src/sources/long-rifle.glb',
}

if (process.argv[1] === import.meta.filename) {
  for (const spec of GUNS) {
    const out = GUN_FILES[spec.id],
      file = buildGun(spec)
    writeFileSync(out, file)
    process.stdout.write(`${out}: ${file.length} bytes, ${rifleTriangles()} triangles\n`)
  }
}
