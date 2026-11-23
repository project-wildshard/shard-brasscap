// oxlint-disable-next-line import/no-nodejs-modules -- node:test runs this beside the other sim tests.
import { test } from 'node:test';
// oxlint-disable-next-line import/no-nodejs-modules -- Plain assertions, no test framework dependency.
import assert from 'node:assert/strict';
import { Vector3 } from 'three';
import { actRoutes } from '@wildshard/sdk/internal/engine/sim/actRoutes';
import { encounterRows } from '@wildshard/sdk/internal/engine/sim/encounterRows';
import { brasscapSim, kill, killWhenOpen, PLAYER, TICKS } from './sim.ts';

// TEMPLATE-E2E TC-B5 (meta TEMPLATE-E2E-PLAN, J361): the Dust Wyrm at the bar. On the built cell's server a player who
// read the wanted poster walks into the arena: the Wyrm's first phase strikes with its burst and its tail sweep, under half
// health its second phase adds the sand spit, and its death pays the bounty quest's fact `brasscap.wyrm` (the boss
// achievement: a grid data cell's ledger hears only `quest.complete`) and its 20 coins.
const STRIKES = ['brasscap.wyrm.burst', 'brasscap.wyrm.sweep', 'brasscap.wyrm.spit'];

test('the Dust Wyrm strikes with burst and sweep, adds the spit in its second phase, and its death files the bounty', async () => {
  const { shard, sim, filed } = await brasscapSim();
  try {
    const host = sim.host, player = host.players.get(PLAYER), wyrm = host.entities.get('dust-wyrm');
    const fight = shard.encounters.find(row => row.entity === 'dust-wyrm');
    if (player === undefined || wyrm === undefined || fight === undefined) throw new Error('Missing the player or the Wyrm');
    const stand = (x: number, z: number): void => { player.position.set(x, player.position.y, z); player.motor.resetAt(player.position); };
    // The poster starts the bounty ('Wanted: the Dust Wyrm').
    const poster = (shard.targets.talks ?? []).findIndex(talk => talk.dialogue === 'brasscap.poster');
    const at = shard.targets.talks?.[poster]?.at;
    if (at === undefined) throw new Error('Missing the poster');
    stand(at[0], at[2]); host.step();
    actRoutes(host).claims.get(`talk:${String(poster)}.end`)?.(PLAYER); host.step();
    assert.ok(host.flags.has('brasscap.poster.read'), 'the poster was read');

    const seen = new Map<string, number>();
    host.events.on('damage.dealt', ({ req }) => {
      for (const id of STRIKES) if (req.moveId === id || req.sourceTags.includes(id)) seen.set(id, phase());
    }, host.scope);
    const view = encounterRows(host).get(`encounter:${fight.id}`);
    if (view === undefined) throw new Error('Missing the Wyrm encounter view');
    const phase = (): number => view().phase;
    // Inside the arena, 5 m off the Wyrm's mound: in reach of the burst, the sweep and the spit. The player's health is
    // topped up every step so the fight runs on.
    stand(fight.arena.at[0], fight.arena.at[2] + 5);
    const full = player.health.attributes.health;
    const run = (seconds: number, until: () => boolean): void => {
      for (let tick = 0; tick < seconds * TICKS && !until(); tick++) {
        player.health.attributes.health = full;
        stand(fight.arena.at[0], fight.arena.at[2] + 5);
        host.step();
      }
    };
    run(60, () => seen.has(STRIKES[0] ?? '') && seen.has(STRIKES[1] ?? ''));
    assert.equal(phase(), 0, 'first phase');
    assert.deepEqual([...seen.keys()].sort(), ['brasscap.wyrm.burst', 'brasscap.wyrm.sweep'], 'the first phase has no spit');
    // Rounds into the open gullet until it is under half health.
    for (let tick = 0; tick < 60 * TICKS && wyrm.hp > wyrm.maxHp * 0.45; tick++) {
      host.combat.hit({ source: 'env', sourceTags: [PLAYER, 'dmg.ranged'], target: wyrm.combatActor(), amount: 20, point: wyrm.position.clone(), dir: new Vector3(0, 0, 1) });
      player.health.attributes.health = full; host.step();
    }
    assert.ok(wyrm.hp < wyrm.maxHp * 0.5 && wyrm.alive, 'under half health');
    run(60, () => seen.has(STRIKES[2] ?? ''));
    assert.equal(phase(), 1, 'second phase');
    assert.equal(seen.get('brasscap.wyrm.spit'), 1, 'the spit comes in the second phase');
    killWhenOpen(sim, 'dust-wyrm', 30);
    for (let i = 0; i < 10; i++) host.step();
    assert.ok(host.flags.has('dead:dust-wyrm'));
    assert.ok(filed.facts.includes('brasscap.wyrm'), `the boss achievement is filed (${filed.facts.join(', ')})`);
    assert.ok(filed.coins.includes(20), 'the bounty pays 20');
  } finally { sim.dispose(); }
});

// TEMPLATE-E2E TC-SHIP-d2 (opus-te2e5, 2026-11-17): the Wyrm's reach is world metres. Engine scales a strike's shape and
// range by the actor's scale, so at spawn scale 5 the authored burst 7 m and sweep 8 m hit 35 to 40 m out: every spot in
// the 16 m arena took a strike each beat, a player died every ~30 s and the Wyrm reset to full (staging v0.1.37, d2c).
// A player 12 m off the mound, inside the arena, is outside both first-phase strikes and can shoot the gullet.
test('a player 12 m off the mound is out of the burst and the sweep', async () => {
  const { shard, sim } = await brasscapSim();
  try {
    const host = sim.host, player = host.players.get(PLAYER), wyrm = host.entities.get('dust-wyrm');
    const fight = shard.encounters.find(row => row.entity === 'dust-wyrm');
    if (player === undefined || wyrm === undefined || fight === undefined) throw new Error('Missing the player or the Wyrm');
    // the rushers roam to the arena's mouth; only the Wyrm's own strikes count here
    for (const id of ['bandit.rusher.1', 'bandit.rusher.2', 'bandit.rusher.3', 'bandit.rusher.4']) kill(sim, id);
    const struck: string[] = [];
    host.events.on('damage.dealt', ({ req }) => { for (const id of STRIKES) if (req.moveId === id || req.sourceTags.includes(id)) struck.push(id); }, host.scope);
    const view = encounterRows(host).get(`encounter:${fight.id}`);
    if (view === undefined) throw new Error('Missing the Wyrm encounter view');
    for (let tick = 0; tick < 30 * TICKS; tick++) {
      player.position.set(fight.arena.at[0], player.position.y, fight.arena.at[2] + 12); player.motor.resetAt(player.position);
      host.step();
    }
    assert.ok(view().phase === 0 && wyrm.alive, 'the fight runs its first phase');
    assert.deepEqual(struck, [], `no strike reaches 12 m (${struck.join(', ')})`);
  } finally { sim.dispose(); }
});
