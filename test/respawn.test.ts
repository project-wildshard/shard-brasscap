// oxlint-disable-next-line import/no-nodejs-modules -- node:test runs this beside the other sim tests.
import { test } from 'node:test';
// oxlint-disable-next-line import/no-nodejs-modules -- Plain assertions, no test framework dependency.
import assert from 'node:assert/strict';
import { brasscapSim, kill, PLAYER, TICKS } from './sim.ts';

// TEMPLATE-E2E TC-B4b (meta TEMPLATE-E2E-PLAN, J361): Brasscap's camp bandits respawn. Each camp spawn row carries
// `respawn: 90` (shard-format 0.5.8+), so a killed camp bandit stands again at its camp, whole, 90 s later; the rushers,
// the brawler and the wyrmlings carry none and stay dead. Runs on the folder `wildshard check .` builds.
const SECONDS = 90;

test('a killed camp bandit stands again at its camp after 90 s; a rusher stays dead', async () => {
  const { shard, sim } = await brasscapSim();
  const rows = new Map(shard.creatures.spawns.map(row => [row.id, row]));
  for (const [id, row] of rows) {
    if (id.startsWith('bandit.camp-')) assert.equal(row.respawn, SECONDS, `${id} respawns after ${String(SECONDS)} s`);
    else assert.equal(row.respawn, undefined, `${id} does not respawn`);
  }
  try {
    const player = sim.host.players.get(PLAYER);
    if (player === undefined) throw new Error('Missing the player');
    // Out of every body's reach: the revive is the timer, not a fight.
    player.position.set(400, player.position.y, 400); player.motor.resetAt(player.position);
    const body = (id: string) => { kill(sim, id); const found = sim.host.entities.get(id); if (found === undefined) throw new Error(`Missing ${id}`); return found; };
    const bandit = body('bandit.camp-1.1'), rusher = body('bandit.rusher.1');
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
