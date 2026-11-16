// oxlint-disable-next-line import/no-nodejs-modules -- node:test runs this beside the other sim tests.
import { test } from 'node:test';
// oxlint-disable-next-line import/no-nodejs-modules -- Plain assertions, no test framework dependency.
import assert from 'node:assert/strict';
import { brasscapSim, PLAYER, TICKS } from './sim.ts';

// TEMPLATE-E2E TC-B7b (meta TEMPLATE-E2E-PLAN, J361): the lever by the gate opens the side door. On the built cell's server
// the door (`brasscap.side-door`, a declared mover on shared field 102) stays shut; the player pulls the lever
// (`brasscap.lever.use`), the gate script sets the field, and the door slides up past the wall's top.
test('pulling the lever by the gate slides the side door up', async () => {
  const { shard, sim } = await brasscapSim();
  try {
    assert.equal(shard.movers.length, 1, 'one declared mover');
    const movers = sim.movers;
    if (movers === undefined) throw new Error('No mover runtime in the cell');
    const steps = (n: number): void => { for (let i = 0; i < n; i++) sim.host.step(); };
    steps(30);
    const shut = movers.pose('brasscap.side-door').position.y;
    const lever = shard.targets.interactions.find(row => row.id === 'brasscap.lever.use');
    const player = sim.host.players.get(PLAYER);
    if (lever === undefined || player === undefined) throw new Error('Missing the lever or the player');
    // Stand where the lever's prompt is seen: its eye (feet + 1.68) beside the prompt.
    const stand = [[0, 0.9], [0.9, 0], [-0.9, 0], [0, -0.9]].find(([dx = 0, dz = 0]) => {
      player.position.set(lever.at[0] + dx, lever.at[1] - 1.68 + 0.3, lever.at[2] + dz); player.motor.resetAt(player.position);
      return sim.selectedInteraction(PLAYER) === lever.id;
    });
    assert.ok(stand !== undefined, `the lever's prompt is seen near ${lever.at.join(',')}`);
    steps(2 * TICKS);
    assert.equal(movers.pose('brasscap.side-door').position.y, shut, 'shut until the lever is pulled');
    assert.equal(sim.interact(lever.id, PLAYER), true);
    steps(3 * TICKS);
    assert.ok(movers.pose('brasscap.side-door').position.y > shut + 3.4, `open: ${String(movers.pose('brasscap.side-door').position.y)} over ${String(shut)}`);
  } finally { sim.dispose(); }
});
