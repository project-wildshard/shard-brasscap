// oxlint-disable-next-line import/no-nodejs-modules -- node:test runs this beside the other sim tests.
import { test } from 'node:test';
// oxlint-disable-next-line import/no-nodejs-modules -- Plain assertions, no test framework dependency.
import assert from 'node:assert/strict';
import { brasscapSim, PLAYER, TICKS } from './sim.ts';

// TEMPLATE-E2E TC-B15 (meta TEMPLATE-E2E-PLAN): a room boots its world fresh, so after a restart the gate stands shut
// (shared field 101 = 0) while a player who cleared the camps holds `brasscap.gate.open`, and the quest that opened it
// never replays its scene. A prompt at the gate opens it again: it runs the gate's own scene, and its `unless` names the
// `brasscap.gate.open` condition, so a page drops the prompt once the gate stands open (TE-ENG6).
test('a prompt at the shut gate opens it, and hides while it is open', async () => {
  const { shard, sim } = await brasscapSim();
  try {
    const gate = shard.targets.interactions.find(row => row.id === 'brasscap.gate.use');
    if (gate === undefined) throw new Error('Missing the gate prompt brasscap.gate.use');
    assert.equal(gate.scene, 'brasscap.gate.open', "the prompt runs the quest's own gate scene");
    assert.equal(gate.unless, 'brasscap.gate.open', 'the prompt goes while the gate stands open');
    const condition = shard.hooks.conditions.find(row => row.id === gate.unless);
    assert.deepEqual(condition && { scope: condition.scope, fieldId: condition.fieldId, equals: condition.equals }, { scope: 'shared', fieldId: 101, equals: 1 });

    const steps = (n: number): void => { for (let i = 0; i < n; i++) sim.host.step(); };
    steps(30);
    const collider = sim.colliders.get('brasscap.gate');
    if (collider === undefined) throw new Error('Missing the gate collider');
    assert.equal(collider.active(), true, 'a fresh room boots with the gate shut');

    const player = sim.host.players.get(PLAYER);
    if (player === undefined) throw new Error('Missing the player');
    // Stand on the town side of the gate where the prompt is seen: its eye (feet + 1.68) beside the prompt.
    const stand = [[0, 0.9], [0.9, 0.9], [-0.9, 0.9], [0, 1.4]].find(([dx = 0, dz = 0]) => {
      player.position.set(gate.at[0] + dx, gate.at[1] - 1.68 + 0.3, gate.at[2] + dz); player.motor.resetAt(player.position);
      return sim.selectedInteraction(PLAYER) === gate.id;
    });
    assert.ok(stand !== undefined, `the gate's prompt is seen near ${gate.at.join(',')}`);
    assert.equal(sim.interact(gate.id, PLAYER), true);
    steps(2 * TICKS);
    assert.equal(collider.active(), false, 'the gate stands open after the prompt');
  } finally { sim.dispose(); }
});
