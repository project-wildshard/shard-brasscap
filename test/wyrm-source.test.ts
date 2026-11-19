/* oxlint-disable typescript/no-non-null-assertion, eslint/id-length, typescript/no-unsafe-type-assertion -- A byte-level check of compiled geometry. */
// ONE-FORMAT CC25: the Dust Wyrm's body from the cleanroom's builders. The cleanroom's three posed shots (t2-14 emerge,
// t2-15 weak, t2-16 defeat) draw the same bytes they drew before the split, and the live Wyrm is a giant serpent on 14
// trail bones 1.6 m apart, compiled by `world.creature` with no Wyrm code in the engine.
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { before, describe, it } from 'node:test'

import * as THREE from 'three'
import { trailBoneNames } from '@wildshard/format/creatureSkeletons'
import { prepareGlbBuffers } from '@wildshard/format/glbBuffers'
import { creatureGlb } from '@wildshard/sharddev/scene/creature'
import { lowerShard } from '@wildshard/sharddev/scene/lower'

import { wyrm } from '../src/generators/actors.ts'
import { WYRM_ID, wyrmBody, wyrmClips, wyrmCreature } from '../src/generators/wyrm.ts'

type Points = Parameters<typeof wyrm>[0]
/** brasscap-cleanroom src/main.js (e311139): the three shots' curves. */
const POSES: Record<string, readonly [Points, { weak?: boolean }, string]> = {
  emerge: [[[-4, -3, -100], [-3.5, 3, -100.5], [-1, 7.5, -101], [3, 9, -100], [5.5, 7.5, -98], [6, 5.5, -95.5]], {}, 'e7cc84b613ff3bac'],
  weak: [[[0, -3, -101], [0.4, 1.5, -101], [1.4, 4.5, -100.5], [2, 6.6, -99.2], [2, 7.0, -97.2]], { weak: true }, 'adf01f82bdead9e0'],
  defeat: [[[14, -0.6, -103], [10, 0.6, -101], [6, 1.0, -99], [2, 1.0, -97], [-2, 1.1, -95.5], [-4.5, 1.3, -94.5]], {}, '2be8db9a16033b81'],
}
/** Every mesh's positions, normals and colours, and where it hangs. */
function drawn(group: THREE.Object3D): string {
  const hash = createHash('sha256')
  group.updateMatrixWorld(true)
  group.traverse((node) => {
    if (!(node instanceof THREE.Mesh)) return
    for (const name of ['position', 'normal', 'color']) {
      const attribute = (node.geometry as THREE.BufferGeometry).getAttribute(name)
      if (attribute !== undefined) hash.update(new Uint8Array((attribute.array as Float32Array).buffer.slice(0)))
    }
    hash.update(new Float32Array(node.matrixWorld.elements))
  })
  return hash.digest('hex').slice(0, 16)
}

describe('the Dust Wyrm from the cleanroom builders (CC25)', (): void => {
  before(() => prepareGlbBuffers())
  for (const [name, [points, options, expected]] of Object.entries(POSES)) {
    it(`draws the cleanroom's ${name} shot as before the split`, (): void => {
      assert.equal(drawn(wyrm(points, options)), expected)
    })
  }

  it('is a giant serpent on 14 trail bones 1.6 m apart in the world, its maw and core on the head', (): void => {
    const scene = lowerShard({ slug: 'w', name: 'w' }, (world) => { world.spawn(0, 0, 0); wyrmCreature(world) })
    const creature = scene.creatures?.find(entry => entry.id === WYRM_ID)
    assert.ok(creature !== undefined)
    const body = creature.species.body!
    assert.equal(body.skeleton, 'serpent')
    assert.equal(body.size, 'giant')
    assert.deepEqual(body.trail, { count: 14, spacing: 0.32 })
    // the giant class (4) at body scale 1/4 on the spawn's 5: 1.6 m apart in the world
    assert.ok(Math.abs(body.trail!.spacing * 4 * body.scale * 5 - 1.6) < 1e-9)
    const names = creatureGlb(wyrmBody(), { clips: wyrmClips() }).bones.map(bone => bone.name)
    assert.deepEqual(names.toSorted(), ['body', ...trailBoneNames(14), 'maw'].toSorted())
    assert.equal(creature.bones, 16)
    assert.equal(body.volumes?.length, 14)
    assert.ok(creature.triangles < 2_000, `${creature.triangles} triangles`)
  })
})
