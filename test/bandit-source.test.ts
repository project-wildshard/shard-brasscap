/* oxlint-disable typescript/no-non-null-assertion, eslint/id-length, typescript/no-unsafe-type-assertion, typescript/prefer-readonly-parameter-types, eslint/max-lines-per-function -- A byte-level check of a compiled GLB: indexed reads into typed arrays. */
// ONE-FORMAT CC13: the tin bandit from source (src/generators/bandit.ts), compiled the way `world.creature` compiles it,
// holds what the hand-written tools/bandit.ts GLB held: the same bytes every run, low-poly, about 1.45 m tall with its
// feet on the ground, outward normals, the eye as a second part in the look's glow; and now the kit biped's bones.
import assert from 'node:assert/strict'
import { before, describe, it } from 'node:test'

import { CREATURE_SKELETONS } from '@wildshard/format/creatureSkeletons'
import { glbBuffers, prepareGlbBuffers } from '@wildshard/format/glbBuffers'
import { parseGlbData } from '@wildshard/format/glbCost'
import { creatureGlb, creatureSkin } from '@wildshard/sdk/scene/creature'

import { BANDIT_BINDING, banditBody, banditClips } from '../src/generators/bandit.ts'

/** Nine bandits on screen at once: each a fraction of one tile's prop budget (the BM-4 GLB's line, raised for the
 *  two-handed rifle and its arms, QA 11-19 row 42: content raises its own line, J438). */
const MAX_TRIANGLES = 560
const MAX_BYTES = 96 * 1024
const UNIT_SLACK = 1e-5

interface Gltf {
  readonly accessors: readonly { readonly bufferView: number; readonly byteOffset?: number; readonly count: number; readonly min?: readonly number[]; readonly max?: readonly number[] }[]
  readonly bufferViews: readonly { readonly byteOffset?: number }[]
  readonly meshes: readonly { readonly primitives: readonly { readonly attributes: Record<string, number>; readonly indices?: number; readonly material?: number }[] }[]
  readonly materials: readonly { readonly name: string }[]
  readonly skins: readonly { readonly joints: readonly number[] }[]
  readonly nodes: readonly { readonly name: string }[]
  readonly animations: readonly { readonly name: string }[]
}
/** The compiled GLB, its JSON and its decoded binary: `creatureGlb` writes meshopt-compressed views, and format's
 *  `glbBuffers` decodes them and points the views into the decoded bytes. */
function compile(): { glb: Uint8Array; json: Gltf; bin: Uint8Array } {
  const { glb } = creatureGlb(banditBody(), { clips: banditClips() }),
    file = Buffer.from(glb),
    length = file.readUInt32LE(12),
    doc = JSON.parse(file.subarray(20, 20 + length).toString()) as Record<string, unknown>,
    { bytes } = glbBuffers(doc, file.subarray(20 + length + 8))
  return { glb, json: doc as unknown as Gltf, bin: bytes }
}
function view(json: Gltf, bin: Uint8Array, index: number, width: number, bytesPer: number): DataView {
  const accessor = json.accessors[index]!, offset = (json.bufferViews[accessor.bufferView]!.byteOffset ?? 0) + (accessor.byteOffset ?? 0)
  return new DataView(bin.buffer, bin.byteOffset + offset, accessor.count * width * bytesPer)
}
function floats(json: Gltf, bin: Uint8Array, index: number): Float32Array {
  const data = view(json, bin, index, 3, 4)
  return Float32Array.from({ length: data.byteLength / 4 }, (_, i) => data.getFloat32(i * 4, true))
}
function indices(json: Gltf, bin: Uint8Array, index: number): Uint32Array {
  const data = view(json, bin, index, 1, 2)
  return Uint32Array.from({ length: data.byteLength / 2 }, (_, i) => data.getUint16(i * 2, true))
}

describe('the Brasscap tin bandit from source (CC13)', (): void => {
  before(() => prepareGlbBuffers())
  it('compiles to the same bytes every run', (): void => {
    assert.deepEqual(compile().glb, compile().glb)
  })

  it('stays a low-poly creature, about 1.45 m tall, feet on the ground', (): void => {
    const { glb, json } = compile(), cost = parseGlbData(glb), position = json.accessors[json.meshes[0]!.primitives[0]!.attributes['POSITION']!]!
    assert.ok(glb.length < MAX_BYTES, `${glb.length} bytes`)
    assert.ok(cost.triangles < MAX_TRIANGLES, `${cost.triangles} triangles`)
    assert.ok(Math.abs(position.min![1]!) < UNIT_SLACK, `feet at ${position.min![1]}`)
    assert.ok(position.max![1]! > 1.4 && position.max![1]! < 1.5, `top at ${position.max![1]}`)
  })

  it('is one skin on the kit biped bones plus the rifle\'s grip, rifle and muzzle, with its loops and one-shots', (): void => {
    const { json } = compile(), expected = ['body', 'grip', 'rifle', 'muzzle', ...Object.values(CREATURE_SKELETONS.biped.chains).flatMap(chain => chain.bones)]
    assert.equal(json.skins.length, 1)
    assert.deepEqual(json.skins[0]!.joints.map(j => json.nodes[j]!.name).toSorted(), expected.toSorted())
    assert.deepEqual(json.animations.map(a => a.name).toSorted(), ['attack', 'attack.fire', 'die', 'hit', 'idle', 'walk'])
  })

  it("draws the eye as a second part, mapped to the look's glow", (): void => {
    const rig = creatureGlb(banditBody(), { clips: banditClips() }), { json } = compile(),
      parts = json.meshes[0]!.primitives.map(p => json.materials[p.material!]!.name)
    assert.deepEqual(parts, ['Tin', 'Eye'])
    const skin = creatureSkin(rig, { id: 'brasscap.bandit', family: 'toon', binding: BANDIT_BINDING })
    assert.deepEqual(skin.binding['materials'], { Eye: 'glow' })
    assert.deepEqual(skin.binding['loops'], ['idle', 'walk'])
  })

  it('has unit normals that agree with each triangle’s winding', (): void => {
    const { json, bin } = compile()
    for (const p of json.meshes[0]!.primitives) {
      const pos = floats(json, bin, p.attributes['POSITION']!), nor = floats(json, bin, p.attributes['NORMAL']!), tri = indices(json, bin, p.indices!)
      for (let i = 0; i < nor.length; i += 3) assert.ok(Math.abs(Math.hypot(nor[i]!, nor[i + 1]!, nor[i + 2]!) - 1) < UNIT_SLACK)
      for (let t = 0; t < tri.length; t += 3) {
        const [a, b, c] = [tri[t]! * 3, tri[t + 1]! * 3, tri[t + 2]! * 3],
          u = [pos[b]! - pos[a]!, pos[b + 1]! - pos[a + 1]!, pos[b + 2]! - pos[a + 2]!],
          w = [pos[c]! - pos[a]!, pos[c + 1]! - pos[a + 1]!, pos[c + 2]! - pos[a + 2]!],
          face = [u[1]! * w[2]! - u[2]! * w[1]!, u[2]! * w[0]! - u[0]! * w[2]!, u[0]! * w[1]! - u[1]! * w[0]!]
        assert.ok(face[0]! * nor[a]! + face[1]! * nor[a + 1]! + face[2]! * nor[a + 2]! >= 0, `triangle ${t / 3} faces in`)
      }
    }
  })
})
