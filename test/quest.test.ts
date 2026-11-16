// oxlint-disable-next-line import/no-nodejs-modules -- node:test runs this beside the other sim tests.
import { test } from 'node:test';
// oxlint-disable-next-line import/no-nodejs-modules -- Plain assertions, no test framework dependency.
import assert from 'node:assert/strict';
import { bindShardfileSim, type ShardfileSimulation } from '@wildshard/engine/game/plugin/simulation';
import { actRoutes } from '@wildshard/engine/sim/actRoutes';
import { restoreSimHost } from '@wildshard/engine/sim/restore';
import { snapshotSimHost } from '@wildshard/engine/sim/snapshot';
import { brasscapSim, kill, killWhenOpen, PLAYER, TICKS } from './sim.ts';

// TEMPLATE-E2E TC-B8 (meta TEMPLATE-E2E-PLAN, J361): Brasscap Mesa's quest, start to end, on the built cell's server. The
// sheriff's talk starts it; the targets, the three camps, the gate, the rusher pack, the Wyrm and the report back finish its
// eight steps; it pays its 25 coins and fact `brasscap.mesa`, beside the bounty's and the three camp bounties. A save taken
// after the run and restored reads every flag back. (The page's full run and its reload of coins and guns: TC-SHIP.)
test('the quest runs from the sheriff\'s talk to the report, and a reload reads its flags back', async () => {
  const { shard, sim, filed, ports, assets } = await brasscapSim();
  let resumed: ShardfileSimulation | undefined;
  try {
    const host = sim.host, routes = actRoutes(host), player = host.players.get(PLAYER);
    if (player === undefined) throw new Error('Missing the player');
    const stand = (x: number, z: number): void => { player.position.set(x, player.position.y, z); player.motor.resetAt(player.position); };
    const steps = (n: number): void => { for (let i = 0; i < n; i++) host.step(); };
    const talks = shard.targets.talks ?? [], index = talks.findIndex(talk => talk.dialogue === 'brasscap.sheriff'), talk = talks[index];
    const tree = shard.quests.dialogue.find(row => row.id === 'brasscap.sheriff');
    if (talk === undefined || tree === undefined) throw new Error('Missing the sheriff');
    const press = (nodeId: string, choiceId: string): void => {
      stand(talk.at[0], talk.at[2] + 1); host.step();
      const at = tree.nodes.findIndex(row => row.id === nodeId), choice = tree.nodes[at]?.choices.findIndex(row => row.id === choiceId) ?? -1;
      routes.claims.get(`talk:${String(index)}.${String(at)}.${String(choice)}`)?.(PLAYER); steps(5);
    };
    press('offer', 'accept');
    assert.ok(host.flags.has('brasscap.sheriff.met'), 'the talk starts the quest');
    stand(-2, 12); // by the depot: off the cell there is no ground, and `stand` keeps the height a fall leaves (wyrm-return.test.ts)
    for (const id of ['target.1', 'target.2']) kill(sim, id);
    for (const camp of [1, 2, 3]) for (const n of [1, 2, 3]) kill(sim, `bandit.camp-${String(camp)}.${String(n)}`);
    steps(TICKS);
    assert.ok(host.flags.has('brasscap.gate.open'), 'the gate opens once camp 3 falls');
    press('camps', 'camp-1');
    for (const n of [1, 2, 3, 4]) kill(sim, `bandit.rusher.${String(n)}`);
    const wyrm = shard.encounters.find(row => row.entity === 'dust-wyrm');
    if (wyrm === undefined) throw new Error('Missing the Wyrm encounter');
    stand(wyrm.arena.at[0], wyrm.arena.at[2] + wyrm.arena.radius - 2);
    killWhenOpen(sim, 'dust-wyrm', 30);
    steps(10);
    press('gate', 'wyrm');
    steps(TICKS);
    for (const flag of ['brasscap.mesa.done', 'brasscap.bounty.done', 'brasscap.camp-1.paid', 'brasscap.camp-2.paid', 'brasscap.camp-3.paid'])
      assert.ok(host.flags.has(flag), `${flag} after the run`);
    assert.ok(filed.facts.includes('brasscap.mesa'), `fact brasscap.mesa filed (${filed.facts.join(', ')})`);
    assert.deepEqual([...filed.coins].sort((a, b) => a - b), [5, 5, 5, 20, 25], 'the camp bounties, the Wyrm bounty and the quest pay');
    // The save: snapshot, restore into a fresh host, and read the flags back.
    const flags = [...shard.quests.flags].filter(flag => host.flags.has(flag));
    const restored = restoreSimHost(host.level, { rapier: ports.rapier }, snapshotSimHost(host),
      fresh => { resumed = bindShardfileSim(fresh, shard, assets, { ...ports, restoring: true }); });
    for (const flag of flags) assert.ok(restored.flags.has(flag), `${flag} after the reload`);
    assert.ok(flags.length >= 20, `the run set ${String(flags.length)} flags`);
  } finally { sim.dispose(); resumed?.dispose(); }
});
