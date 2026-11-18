// oxlint-disable-next-line import/no-nodejs-modules -- node:test runs this beside the other sim tests.
import { test } from 'node:test';
// oxlint-disable-next-line import/no-nodejs-modules -- Plain assertions, no test framework dependency.
import assert from 'node:assert/strict';
import { brasscapSim, kill, PLAYER, TICKS } from './sim.ts';

// TEMPLATE-E2E TC-B9 (meta TEMPLATE-E2E-PLAN, opus-brass7): the rushers stay out of the Dust Wyrm's arena. On staging
// v0.1.42 (rev 6) the four rushers, killed at the gate, came back 120 s later (TC-B15) at a pack home 7.5 m from the
// arena's edge, saw the player shooting the gullet and hit for 7 to 9 hp every 2 to 4 s; a player who held still died in
// 25 to 55 s and each death reset the Wyrm. A pack has no leash (it rings its prey wherever it goes, roams 40 to 90 m from
// its home and flees away from the player into the arena), so the rushers are now four leashed pursuers posted just past
// the gate: none takes a target more than 11 m from its post, and the nearest post is 16 m from the arena's edge.
// Here the player kills the four at the gate, walks into the arena, and stands there while they come back and for 120 s
// after: no rusher hit lands and no rusher sets foot in the arena. The gate is still a fight: past it, they come.
const RUSHERS = ['bandit.rusher.1', 'bandit.rusher.2', 'bandit.rusher.3', 'bandit.rusher.4'];
const RESPAWN = 120, WATCH = 120;

test('respawned rushers never enter the Wyrm arena or hit a player standing in it', async () => {
  const { shard, sim } = await brasscapSim();
  try {
    const host = sim.host, player = host.players.get(PLAYER);
    const fight = shard.encounters.find(row => row.entity === 'dust-wyrm');
    if (player === undefined || fight === undefined) throw new Error('Missing the player or the Wyrm');
    const [ax, , az] = fight.arena.at, radius = fight.arena.radius;
    const bodies = RUSHERS.map(id => { const body = host.entities.get(id); if (body === undefined) throw new Error(`Missing ${id}`); return body; });
    const actors = new Set(bodies.map(body => body.combatActor()));
    const hits: string[] = [];
    host.events.on('damage.dealt', ({ req }) => {
      if (req.source !== 'env' && actors.has(req.source) && req.target === player.health) hits.push(`${req.source.id} at ${(host.clock.now).toFixed(1)} s`);
    }, host.scope);
    // 4 m inside the arena's north edge, where the probe stands to shoot the gullet.
    const spot = { x: ax, z: az + radius - 4 };
    const stand = (): void => { player.position.set(spot.x, player.position.y, spot.z); player.motor.resetAt(player.position); };
    for (const id of RUSHERS) kill(sim, id);
    const full = player.health.attributes.health;
    let inside = '';
    for (let tick = 0; tick < (RESPAWN + 2 + WATCH) * TICKS; tick++) {
      // the player is kept whole: a death would move it out of the arena and hide the hits that follow
      player.health.attributes.health = full;
      stand(); host.step();
      for (const body of bodies) {
        if (body.alive && inside === '' && Math.hypot(body.position.x - ax, body.position.z - az) < radius) {
          inside = `${body.entityId} at (${body.position.x.toFixed(1)},${body.position.z.toFixed(1)}) after ${(tick / TICKS).toFixed(1)} s`;
        }
      }
    }
    assert.ok(bodies.every(body => body.alive), 'the four rushers came back');
    assert.equal(inside, '', 'no rusher stands in the arena');
    assert.deepEqual(hits, [], 'no rusher hit lands on a player in the arena');
  } finally { sim.dispose(); }
});

test('the rushers still meet a player who walks past the gate', async () => {
  const { sim } = await brasscapSim();
  try {
    const host = sim.host, player = host.players.get(PLAYER);
    if (player === undefined) throw new Error('Missing the player');
    const actors = new Set(RUSHERS.map(id => { const body = host.entities.get(id); if (body === undefined) throw new Error(`Missing ${id}`); return body.combatActor(); }));
    const hitters = new Set<string>();
    host.events.on('damage.dealt', ({ req }) => { if (req.source !== 'env' && actors.has(req.source) && req.target === player.health) hitters.add(req.source.id); }, host.scope);
    const full = player.health.attributes.health;
    // 5 m past the gate, among the posts
    for (let tick = 0; tick < 20 * TICKS; tick++) {
      player.health.attributes.health = full;
      player.position.set(2, player.position.y, -66); player.motor.resetAt(player.position); host.step();
    }
    assert.ok(hitters.size >= 2, `at least two rushers hit a player past the gate (${[...hitters].join(', ')})`);
  } finally { sim.dispose(); }
});
