// oxlint-disable-next-line import/no-nodejs-modules -- node:test runs this beside the other sim tests.
import { test } from 'node:test';
// oxlint-disable-next-line import/no-nodejs-modules -- Plain assertions, no test framework dependency.
import assert from 'node:assert/strict';
import { actRoutes } from '@wildshard/engine/sim/actRoutes';
import { brasscapSim, PLAYER, TICKS } from './sim.ts';

// ONE-FORMAT CC26: the burst is the serpent's own moves. The Wyrm burrows, comes up under the player (held 4 m off the
// mound's middle), leaps 9 m up and lands back on the mound, where the burst rings out; no Wyrm code in the engine. Its
// surfacing point is read at the last ground tick before the leap (the 22 m/s² leap is a few cm on its way by then).
test('the Dust Wyrm comes up under the player, leaps 9 m up and lands its burst on the mound', async () => {
  const { shard, sim } = await brasscapSim();
  try {
    const host = sim.host, player = host.players.get(PLAYER), wyrm = host.entities.get('dust-wyrm');
    const fight = shard.encounters.find(row => row.entity === 'dust-wyrm');
    if (player === undefined || wyrm === undefined || fight === undefined) throw new Error('Missing the player or the Wyrm');
    const stand = (x: number, z: number): void => { player.position.set(x, player.position.y, z); player.motor.resetAt(player.position); };
    const poster = (shard.targets.talks ?? []).findIndex(talk => talk.dialogue === 'brasscap.poster');
    const at = shard.targets.talks?.[poster]?.at;
    if (at === undefined) throw new Error('Missing the poster');
    stand(at[0], at[2]); host.step();
    actRoutes(host).claims.get(`talk:${String(poster)}.end`)?.(PLAYER); host.step();
    const [mx, , mz] = fight.arena.at, ground = wyrm.position.y;
    // where it surfaces: the last ground point before the leap climbs past the lunge's 3 m hop (QA 11-19 row 44)
    let top = -Infinity, under = 0, landed: [number, number] | undefined, grounded: [number, number] = [wyrm.position.x, wyrm.position.z];
    host.events.on('damage.dealt', ({ req }) => {
      if (req.moveId === 'brasscap.wyrm.burst' && landed === undefined) landed = [wyrm.position.x, wyrm.position.z];
    }, host.scope);
    const full = player.health.attributes.health;
    for (let tick = 0; tick < 40 * TICKS && landed === undefined; tick++) {
      player.health.attributes.health = full; stand(mx, mz + 6);
      host.step();
      const high = wyrm.position.y - ground;
      if (high < 0.5) grounded = [wyrm.position.x, wyrm.position.z];
      if (high > 3.5 && top <= 3.5) under = Math.hypot(grounded[0] - mx, grounded[1] - mz);
      top = Math.max(top, high);
    }
    assert.ok(landed !== undefined, 'the burst lands');
    assert.ok(top > 8 && top < 10, `the leap peaks ${top.toFixed(2)} m up`);
    assert.ok(under > 3.6 && under < 4.1, `it comes up ${under.toFixed(2)} m off the mound, toward the player 6 m out`);
    assert.ok(Math.hypot(landed[0] - mx, landed[1] - mz) < 0.1, 'the burst rings out on the mound');
  } finally { sim.dispose(); }
});
