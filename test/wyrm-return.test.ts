// oxlint-disable-next-line import/no-nodejs-modules -- node:test runs this beside the other sim tests.
import { test } from 'node:test';
// oxlint-disable-next-line import/no-nodejs-modules -- Plain assertions, no test framework dependency.
import assert from 'node:assert/strict';
import { admittedTerrain } from '@wildshard/engine/game/plugin/simulation';
import { actRoutes } from '@wildshard/engine/sim/actRoutes';
import { encounterRows } from '@wildshard/engine/sim/encounterRows';
import { brasscapSim, kill, PLAYER, TICKS } from './sim.ts';

// TEMPLATE-E2E TC-B14 (meta TEMPLATE-E2E-PLAN): the Wyrm wakes after the gate opens, wherever the player was. The player
// takes the quest, stands off the cell while camp 3 falls and the gate opens (the cell has no ground out there, so they
// fall), then comes back in on the sand and walks to the arena: the Wyrm's intro starts. The earlier report (armed for
// good) was the sim's own: a `stand` that kept the fallen height put the player 187 m under the arena, never inside it.
test('a player off the cell while the gate opens walks back into the arena and the Wyrm\'s intro starts', async () => {
  const { shard, sim, assets } = await brasscapSim();
  try {
    const host = sim.host, routes = actRoutes(host), player = host.players.get(PLAYER), ground = admittedTerrain(shard, assets);
    if (player === undefined) throw new Error('Missing the player');
    const walk = (x: number, z: number): void => { player.position.set(x, ground.heightAt(x, z) + 0.05, z); player.motor.resetAt(player.position); host.step(); };
    const talks = shard.targets.talks ?? [], index = talks.findIndex(talk => talk.dialogue === 'brasscap.sheriff'), talk = talks[index];
    const tree = shard.quests.dialogue.find(row => row.id === 'brasscap.sheriff');
    const fight = shard.encounters.find(row => row.entity === 'dust-wyrm');
    if (talk === undefined || tree === undefined || fight === undefined) throw new Error('Missing the sheriff or the Wyrm');
    const view = encounterRows(host).get(`encounter:${fight.id}`);
    if (view === undefined) throw new Error('Missing the Wyrm encounter view');
    walk(talk.at[0], talk.at[2] + 1);
    const at = tree.nodes.findIndex(row => row.id === 'offer'), choice = tree.nodes[at]?.choices.findIndex(row => row.id === 'accept') ?? -1;
    routes.claims.get(`talk:${String(index)}.${String(at)}.${String(choice)}`)?.(PLAYER);
    for (let i = 0; i < 5; i++) host.step();
    assert.ok(host.flags.has('brasscap.sheriff.met'), 'the talk starts the quest');

    // Off the cell: no ground at (400, 400), so the player falls while the camps fall and the gate opens.
    player.position.set(400, player.position.y, 400); player.motor.resetAt(player.position);
    for (const id of ['target.1', 'target.2']) kill(sim, id);
    for (const camp of [1, 2, 3]) for (const n of [1, 2, 3]) kill(sim, `bandit.camp-${String(camp)}.${String(n)}`);
    for (let i = 0; i < TICKS; i++) host.step();
    assert.ok(host.flags.has('brasscap.gate.open'), 'the gate opens with the player off the cell');
    assert.ok(player.position.y < -1, `the player fell off the cell (y ${player.position.y.toFixed(1)})`);
    assert.equal(view().state, 'armed', 'the Wyrm waits in its arena');

    // Back in on the sand by the depot, then a walk south, a metre a step, to the arena's middle.
    for (let z = 12; z >= fight.arena.at[2]; z -= 1) walk(fight.arena.at[0], z);
    for (let i = 0; i < 10 && view().state === 'armed'; i++) host.step();
    assert.ok(['intro', 'fight'].includes(view().state), `the Wyrm's intro starts (${view().state})`);
  } finally { sim.dispose(); }
});
