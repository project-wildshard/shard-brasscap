// oxlint-disable-next-line import/no-nodejs-modules -- node:test runs this beside the other sim tests.
import { test } from 'node:test';
// oxlint-disable-next-line import/no-nodejs-modules -- Plain assertions, no test framework dependency.
import assert from 'node:assert/strict';
import { brasscapSim, kill, killWhenOpen, PLAYER, TICKS } from './sim.ts';

// TEMPLATE-E2E TC-B4b (meta TEMPLATE-E2E-PLAN, J361): Brasscap's camp bandits respawn. Each camp spawn row carries
// `respawn: 90` (shard-format 0.5.8+), so a killed camp bandit stands again at its camp, whole, 90 s later. TC-B15: a room is
// shared, so a one-shot rusher or Wyrm another player killed left this player's quest stuck; the rushers come back after
// 120 s and the Wyrm after 300 s. The brawler and the wyrmlings carry none and stay dead. Runs on the folder
// `wildshard check .` builds.
const SECONDS = 90, RUSHER_SECONDS = 120, WYRM_SECONDS = 300;

test('a killed camp bandit stands again at its camp after 90 s, a rusher after 120 s', async () => {
  const { shard, sim } = await brasscapSim();
  const rows = new Map(shard.creatures.spawns.map(row => [row.id, row]));
  for (const [id, row] of rows) {
    const seconds = id.startsWith('bandit.camp-') ? SECONDS : id.startsWith('bandit.rusher.') ? RUSHER_SECONDS : id === 'dust-wyrm' ? WYRM_SECONDS : undefined;
    assert.equal(row.respawn, seconds, `${id} respawns after ${String(seconds)} s`);
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
    assert.equal(rusher.alive, false, 'a rusher is still down at 90 s');
    steps((RUSHER_SECONDS - SECONDS) * TICKS);
    assert.equal(rusher.alive, true, 'a rusher is back after 120 s');
  } finally { sim.dispose(); }
});

test('a killed Dust Wyrm rises again after 300 s, whole', async () => {
  const { shard, sim } = await brasscapSim();
  try {
    const player = sim.host.players.get(PLAYER), wyrm = sim.host.entities.get('dust-wyrm');
    const fight = shard.encounters.find(row => row.entity === 'dust-wyrm');
    if (player === undefined || wyrm === undefined || fight === undefined) throw new Error('Missing the player, the Wyrm or its encounter');
    // It wakes when the player walks into its arena, and takes rounds only while its gullet is open.
    player.position.set(fight.arena.at[0], player.position.y, fight.arena.at[2] + fight.arena.radius - 2); player.motor.resetAt(player.position);
    killWhenOpen(sim, 'dust-wyrm', 30);
    assert.equal(wyrm.alive, false);
    player.position.set(400, player.position.y, 400); player.motor.resetAt(player.position);
    const steps = (n: number) => { for (let i = 0; i < n; i++) sim.host.step(); };
    steps((WYRM_SECONDS - 1) * TICKS);
    assert.equal(wyrm.alive, false, 'still down before its timer');
    steps(2 * TICKS);
    assert.equal(wyrm.alive, true, 'back after 300 s');
    assert.equal(wyrm.hp, wyrm.maxHp, 'back whole');
  } finally { sim.dispose(); }
});
