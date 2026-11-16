// oxlint-disable-next-line import/no-nodejs-modules -- node:test runs this beside the other sim tests.
import { test } from 'node:test';
// oxlint-disable-next-line import/no-nodejs-modules -- Plain assertions, no test framework dependency.
import assert from 'node:assert/strict';
// oxlint-disable-next-line import/no-nodejs-modules -- The test reads the skin's committed GLB.
import { readFileSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Resolve the skin from the repo root.
import { resolve } from 'node:path';
import { Vector3 } from 'three';
import { brasscapSim } from './sim.ts';

// TEMPLATE-E2E TC-B13 (meta TEMPLATE-E2E-PLAN): a dust wyrmling takes the rounds a player aims at it. Its skin is the
// Dust Wyrm's, coiled upright and about 2.1 m tall at scale 1, so its body volume must stand as tall as the drawn coil:
// its old capsule (bodyY 0.5, radius 0.45) sat 0.19 m up at spawn scale 0.5 and topped out at 0.42 m, under a coil
// drawn a metre tall, so 30 rounds at its middle missed. A round from a player's eye 10 m off, aimed anywhere from
// its foot to near its crest, now meets the body capsule.
const EYE = 1.68;

/** Squared distance between the ray `o + t d` (t >= 0, d unit) and the segment a..b. */
function raySegment2(o: Vector3, d: Vector3, a: Vector3, b: Vector3): number {
  let best = Infinity;
  for (let i = 0; i <= 200; i++) {
    const p = a.clone().lerp(b, i / 200), t = Math.max(0, p.clone().sub(o).dot(d));
    best = Math.min(best, o.clone().addScaledVector(d, t).distanceToSquared(p));
  }
  return best;
}

/** The skin's top in model units: its mesh's POSITION accessor's max y, from the GLB's JSON chunk. */
function skinTop(): number {
  const glb = readFileSync(resolve(import.meta.dirname, '../src/sources/wyrm.glb'));
  const json = JSON.parse(glb.subarray(20, 20 + glb.readUInt32LE(12)).toString('utf8')) as {
    accessors: { max?: number[] }[]; meshes: { primitives: { attributes: { POSITION: number } }[] }[] };
  const max = json.accessors[json.meshes[0]?.primitives[0]?.attributes.POSITION ?? -1]?.max?.[1];
  if (max === undefined) throw new Error('wyrm.glb has no position bounds');
  return max;
}

test('a dust wyrmling\'s body capsule spans its drawn coil, so a round at its middle or its crest hits', async () => {
  const top = skinTop();
  const { sim } = await brasscapSim();
  try {
    sim.host.step();
    for (const id of ['wyrmling.1', 'wyrmling.2', 'wyrmling.3']) {
      const body = sim.host.entities.get(id);
      if (body === undefined) throw new Error(`Missing ${id}`);
      const a = new Vector3(), b = new Vector3();
      body.bodyCapsule(a, b);
      const r = body.dims.bodyRadius * body.scale, feet = body.position.y, drawn = top * body.scale;
      assert.ok(drawn > 0.9, `${id} is drawn ${drawn.toFixed(2)} m tall`);
      assert.ok(Math.min(a.y, b.y) - r <= feet + 0.1, `${id}'s capsule reaches its feet`);
      assert.ok(Math.max(a.y, b.y) + r >= feet + drawn * 0.9, `${id}'s capsule reaches ${(Math.max(a.y, b.y) + r - feet).toFixed(2)} of ${drawn.toFixed(2)} m`);
      for (const height of [0.2, drawn / 2, 0.9]) {
        const eye = new Vector3(body.position.x, feet + EYE, body.position.z - 10);
        const dir = new Vector3(body.position.x, feet + height, body.position.z).sub(eye).normalize();
        assert.ok(raySegment2(eye, dir, a, b) < r * r, `a round at ${height.toFixed(2)} m hits ${id}`);
      }
    }
  } finally { sim.dispose(); }
});
