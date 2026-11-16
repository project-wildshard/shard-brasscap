// oxlint-disable-next-line import/no-nodejs-modules -- The test reads the built product and the shipped physics bytes.
import { readFileSync, realpathSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- node:test runs this beside the tools tests.
import { test } from 'node:test';
// oxlint-disable-next-line import/no-nodejs-modules -- Plain assertions, no test framework dependency.
import assert from 'node:assert/strict';
// oxlint-disable-next-line import/no-nodejs-modules -- Resolve the physics package and the built folder.
import { createRequire } from 'node:module';
// oxlint-disable-next-line import/no-nodejs-modules -- Resolve the built folder from the repo root.
import { resolve } from 'node:path';
import { Vector3 } from 'three';
import { loadRapier } from '@wildshard/engine/physics/rapier';
import { outputDescriptor, serverReadsFile } from '@wildshard/engine/game/shardfile/outputDescriptor';
import { createShardfileSim } from '@wildshard/engine/game/plugin/simulation';
import { loadHeadlessProduct } from '@wildshard/engine/host/headlessProduct';

// TEMPLATE-E2E TC-B4b (meta TEMPLATE-E2E-PLAN, J361): Brasscap's camp bandits respawn. Each camp spawn row carries
// `respawn: 90` (shard-format 0.5.8+), so a killed camp bandit stands again at its camp, whole, 90 s later; the rushers,
// the brawler and the wyrmlings carry none and stay dead. Runs on the folder `wildshard check .` builds.
const ROOT = resolve(import.meta.dirname, '..');
const BUILT = resolve(ROOT, 'public/shardfiles/brasscap-mesa');
const PLAYER = 'actor.player';
const SECONDS = 90;
const TICKS = 60;

async function product() {
  const loaded = await loadHeadlessProduct(BUILT);
  const descriptor = outputDescriptor(loaded.shardfile);
  if (descriptor === undefined) throw new Error('brasscap-mesa has no output descriptor: run `pnpm check:shard` first');
  const server = descriptor.index.files.filter(file => serverReadsFile(file, loaded.shardfile.terrain?.collider)
    && (file.name === undefined || file.kind === 'wasm' || file.kind === 'tile'));
  const assets = new Map(server.map(file => [file.commons === true ? `commons:${file.hash}` : file.hash,
    Uint8Array.from(readFileSync(resolve(BUILT, file.path)))]));
  return { shard: loaded.shardfile, assets };
}

function physicsBytes(): Uint8Array {
  // The engine's own Rapier (pnpm links it beside the engine, not into this repo's node_modules).
  const require = createRequire(resolve(realpathSync(resolve(ROOT, 'node_modules/@wildshard/engine')), 'package.json'));
  return Uint8Array.from(readFileSync(require.resolve('@dimforge/rapier3d-simd/rapier_wasm3d_bg.wasm')));
}

test('a killed camp bandit stands again at its camp after 90 s; a rusher stays dead', async () => {
  const input = await product();
  const rows = new Map(input.shard.creatures.spawns.map(row => [row.id, row]));
  for (const [id, row] of rows) {
    if (id.startsWith('bandit.camp-')) assert.equal(row.respawn, SECONDS, `${id} respawns after ${String(SECONDS)} s`);
    else assert.equal(row.respawn, undefined, `${id} does not respawn`);
  }
  const sim = createShardfileSim(input.shard, input.assets, { rapier: await loadRapier(physicsBytes()), quest: { fact: () => undefined, coins: () => undefined } });
  try {
    const player = sim.host.players.get(PLAYER);
    if (player === undefined) throw new Error('Missing the player');
    // Out of every body's reach: the revive is the timer, not a fight.
    player.position.set(400, player.position.y, 400); player.motor.resetAt(player.position);
    const kill = (id: string) => {
      const body = sim.host.entities.get(id);
      if (body === undefined) throw new Error(`Missing ${id}`);
      sim.host.combat.hit({ source: 'env', sourceTags: [PLAYER, 'dmg.ranged'], target: body.combatActor(), amount: 100_000, point: body.position.clone(), dir: new Vector3(0, 0, 1) });
      assert.equal(body.alive, false, `${id} died`);
      return body;
    };
    const bandit = kill('bandit.camp-1.1'), rusher = kill('bandit.rusher.1');
    const steps = (n: number) => { for (let i = 0; i < n; i++) sim.host.step(); };
    steps(SECONDS * TICKS - 2);
    assert.equal(bandit.alive, false, 'still down before its timer');
    steps(4);
    assert.equal(bandit.alive, true, 'back after its timer');
    assert.equal(bandit.hp, bandit.maxHp, 'back whole');
    const at = rows.get('bandit.camp-1.1')?.at;
    if (at === undefined) throw new Error('Missing bandit.camp-1.1 row');
    assert.ok(Math.hypot(bandit.position.x - at[0], bandit.position.z - at[2]) < 0.5, 'back at its camp');
    assert.equal(rusher.alive, false, 'a rusher stays dead');
  } finally { sim.dispose(); }
});
