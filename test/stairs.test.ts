// QA43: walk the actual cooked camp staircase in both directions at ordinary speed.
// oxlint-disable-next-line import/no-nodejs-modules -- A native regression test.
import assert from 'node:assert/strict';
// oxlint-disable-next-line import/no-nodejs-modules -- A native regression test.
import { test } from 'node:test';
import { brasscapSim, PLAYER, TICKS } from './sim';

test('the camp staircase keeps a continuous walk up and down', async () => {
  const { sim } = await brasscapSim(process.env['WS_BRASSCAP_PRODUCT']);
  try {
    const { host } = sim, player = host.players.get(PLAYER);
    assert.ok(player);
    const feet = player.position, x = 9.3, start = -22.5, end = -33.1, distance = 4.3 / TICKS, gravityStep = -22 / (TICKS * TICKS);
    feet.set(x, host.groundHeightAt(x, start) + 0.05, start);
    player.motor.resetAt(feet);
    for (let i = 0; i < 12; i++) player.motor.move(feet, { x: 0, y: gravityStep, z: 0 });
    const trace = (target: number): { completed: boolean; minSpeed: number; maxRise: number; height: number } => {
      let minSpeed = 4.3, maxRise = 0;
      for (let tick = 0; tick < 300 && Math.abs(target - feet.z) >= distance; tick++) {
        const { y, z } = feet;
        player.motor.move(feet, { x: 0, y: gravityStep, z: Math.sign(target - z) * distance });
        minSpeed = Math.min(minSpeed, Math.abs(z - feet.z) * TICKS);
        maxRise = Math.max(maxRise, Math.abs(y - feet.y));
      }
      return { completed: Math.abs(target - feet.z) < distance, minSpeed, maxRise, height: feet.y };
    };
    const up = trace(end), down = trace(start);
    console.log('Brasscap stair walk', JSON.stringify({ up, down }));
    assert.ok(up.completed && down.completed, 'both walks reach the far end');
    assert.ok(up.height > 5.85 && down.height < 0.3, 'the capsule climbs the ledge and returns to the sand');
    assert.ok(up.minSpeed > 2.5 && down.minSpeed > 2.5, 'there are no stalls');
    assert.ok(up.maxRise < 0.1 && down.maxRise < 0.1, 'there are no step-sized hops');
  } finally { sim.dispose(); }
});
