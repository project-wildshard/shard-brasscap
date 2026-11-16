// oxlint-disable-next-line import/no-nodejs-modules -- node:test runs this beside the other sim tests.
import { test } from 'node:test';
// oxlint-disable-next-line import/no-nodejs-modules -- Plain assertions, no test framework dependency.
import assert from 'node:assert/strict';
import { actRoutes } from '@wildshard/engine/sim/actRoutes';
import { shardRows } from '@wildshard/engine/sim/shardRows';
import { brasscapSim, kill, killWhenOpen, PLAYER } from './sim.ts';

// TEMPLATE-E2E TC-B6 (meta TEMPLATE-E2E-PLAN, J361): Sheriff Brass gives the quest and his lines follow it. On the built
// cell's server the player stands at his talk: the offer, then (after the accept) the camps, then (once camp 1 is down) the
// gate, and only after `dead:dust-wyrm` his third line, the thanks. A press the tree does not offer yet is refused.
test('the sheriff offers, sends you to the camps, then the gate, and thanks you only once the Wyrm is dead', async () => {
  const { shard, sim } = await brasscapSim();
  try {
    const host = sim.host, routes = actRoutes(host);
    const index = (shard.targets.talks ?? []).findIndex(talk => talk.dialogue === 'brasscap.sheriff');
    const tree = shard.quests.dialogue.find(row => row.id === 'brasscap.sheriff');
    const talk = shard.targets.talks?.[index];
    if (tree === undefined || talk === undefined) throw new Error('Missing the sheriff talk');
    const player = host.players.get(PLAYER);
    if (player === undefined) throw new Error('Missing the player');
    player.position.set(talk.at[0], player.position.y, talk.at[2] + 1); player.motor.resetAt(player.position);
    const node = (): string | undefined => {
      const out = new Map<string, unknown>();
      shardRows(host).owned.get('talks.declared')?.(PLAYER, out);
      const value = out.get(`dialogue:${tree.id}`);
      return typeof value === 'number' ? tree.nodes[value - 1]?.id : undefined;
    };
    const press = (nodeId: string, choiceId: string): void => {
      const at = tree.nodes.findIndex(row => row.id === nodeId), choice = tree.nodes[at]?.choices.findIndex(row => row.id === choiceId) ?? -1;
      const claim = routes.claims.get(`talk:${String(index)}.${String(at)}.${String(choice)}`);
      if (claim === undefined) throw new Error(`No press for ${nodeId}.${choiceId}`);
      claim(PLAYER); host.step();
    };
    host.step();
    assert.equal(node(), 'offer');
    press('offer', 'accept');
    assert.equal(node(), 'camps');
    const refused = routes.refused;
    press('camps', 'camp-1');
    assert.equal(node(), 'camps', 'camp 1 is still up');
    assert.equal(routes.refused, refused + 1);
    for (const id of ['bandit.camp-1.1', 'bandit.camp-1.2', 'bandit.camp-1.3']) kill(sim, id);
    host.step();
    press('camps', 'camp-1');
    assert.equal(node(), 'gate');
    press('gate', 'wyrm');
    assert.equal(node(), 'gate', 'the Wyrm still lives');
    // The Wyrm wakes when the player walks into its arena, and takes rounds only while its gullet is open.
    const wyrm = shard.encounters.find(row => row.entity === 'dust-wyrm');
    if (wyrm === undefined) throw new Error('Missing the Wyrm encounter');
    player.position.set(wyrm.arena.at[0], player.position.y, wyrm.arena.at[2] + wyrm.arena.radius - 2); player.motor.resetAt(player.position);
    killWhenOpen(sim, 'dust-wyrm', 30);
    for (let i = 0; i < 10; i++) host.step();
    assert.ok(host.flags.has('dead:dust-wyrm'), 'the Wyrm is dead');
    player.position.set(talk.at[0], player.position.y, talk.at[2] + 1); player.motor.resetAt(player.position);
    host.step();
    press('gate', 'wyrm');
    assert.equal(node(), 'thanks');
    assert.match(tree.nodes.find(row => row.id === 'thanks')?.lines[0] ?? '', /The Wyrm, dead/u);
  } finally { sim.dispose(); }
});
