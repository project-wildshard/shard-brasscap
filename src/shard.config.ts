// Brasscap Mesa's shard source (meta SHARD-SOURCE SS3, J342). Moved from shard-format's corpus/brasscap-mesa/ as it was:
// the authored rows are rows/ (one file per shardfile section), the canyon world is tools/canyon.ts's bake GLB,
// the gate's behaviour is sources/gate.as, and the subjects (lever rifle, tin bandit, Dust Wyrm) are the GLBs and skin
// files the tools/ generators write into sources/. AP16 later moves it onto the scene API.
import { emptyShardfile } from '@wildshard/sharddev/author';
import { emitPlatformSections } from '@wildshard/sharddev/platformSections';
import type { GeneratedProject, ProjectGenerationContext } from '@wildshard/sharddev/projectGeneration';
import decisionScripts from './rows/sim/scripts.json' with { type: 'json' };
import identity from './identity.json' with { type: 'json' };
import creatures from './rows/actors/creatures.json' with { type: 'json' };
import crowds from './rows/actors/crowds.json' with { type: 'json' };
import species from './rows/actors/species.json' with { type: 'json' };
import audio from './rows/audio/audio.json' with { type: 'json' };
import encounters from './rows/combat/encounters.json' with { type: 'json' };
import items from './rows/combat/items.json' with { type: 'json' };
import strikes from './rows/combat/strikes.json' with { type: 'json' };
import ledger from './rows/economy/ledger.json' with { type: 'json' };
import loot from './rows/economy/loot.json' with { type: 'json' };
import look from './rows/look/look.json' with { type: 'json' };
import materials from './rows/look/materials.json' with { type: 'json' };
import quests from './rows/quests/quests.json' with { type: 'json' };
import clientScripts from './rows/sim/client-scripts.json' with { type: 'json' };
import hooks from './rows/sim/hooks.json' with { type: 'json' };
import plumbing from './rows/sim/plumbing.json' with { type: 'json' };
import sim from './rows/sim/sim.json' with { type: 'json' };
import migrations from './rows/state/migrations.json' with { type: 'json' };
import state from './rows/state/state.json' with { type: 'json' };
import card from './rows/ui/card.json' with { type: 'json' };
import compendium from './rows/ui/compendium.json' with { type: 'json' };
import ui from './rows/ui/ui.json' with { type: 'json' };
import days from './rows/world/days.json' with { type: 'json' };
import edge from './rows/world/edge.json' with { type: 'json' };
import movers from './rows/world/movers.json' with { type: 'json' };
import navigation from './rows/world/navigation.json' with { type: 'json' };
import spawn from './rows/world/spawn.json' with { type: 'json' };
import terrain from './rows/world/terrain.json' with { type: 'json' };
import traversal from './rows/world/traversal.json' with { type: 'json' };
import water from './rows/world/water.json' with { type: 'json' };
import weather from './rows/world/weather.json' with { type: 'json' };
import authored from './rows/files.json' with { type: 'json' };

/** The subjects the authored rows name by hash (the lever rifle, the tin bandit and the Dust Wyrm, with their skin
 *  files) and the sand ring's client script: authored bytes, not cooked. Their `files` rows are rows/files.json. */
const SUBJECTS = ['sources/rifle.glb', 'sources/bandit.glb', 'sources/wyrm.glb', 'sources/bandit.skin.json', 'sources/wyrm.skin.json', 'assets/wasm/sand.wasm'] as const;

/** The declaration and its authored bytes; sharddev cooks the canyon world, the gate and the Wyrm's decision script. */
export async function generate(ctx: ProjectGenerationContext): Promise<GeneratedProject> {
  const subjects = await ctx.cached({ id: 'brasscap-subjects', inputs: SUBJECTS }, inputs => new Map([...inputs].map(([file, bytes]) => [file.replaceAll('/', '-'), bytes])));
  const assets = new Map([...subjects.values()].map(bytes => [ctx.asset(bytes), bytes]));
  const base = emptyShardfile(identity);
  const shard = {
    ...base,
    ...creatures, ...crowds, ...audio, ...encounters, ...items, ...ledger, ...look, ...quests, ...clientScripts, ...hooks,
    ...plumbing, ...sim, ...migrations, ...state, ...card, ...ui, ...edge, ...movers, ...navigation, ...spawn,
    ...terrain, ...traversal, ...water,
    files: [...base.files, ...authored.files], library: [...base.library, ...authored.library], critical: [...base.critical, ...authored.critical],
    budgets: authored.budgets, serverBudget: authored.serverBudget,
    rows: { ...species.rows, ...strikes.rows, ...loot.rows, ...days.rows, ...weather.rows, ...materials.rows, ...compendium.rows },
    world: {
      glb: 'world/canyon.glb', materials: { Mesa: 'mesa', Glow: 'glow', Metal: 'metal' }, colliders: 'mesh', far: 'far.', farMode: 'replace',
      detail: 'dress', coarse: 'coarse.',
      interactive: [
        { node: 'gate.door', id: 'brasscap.gate', colliderId: 'brasscap.gate' },
        { node: 'rack.rifle', id: 'brasscap.rack.rifle', colliderId: 'brasscap.rack.rifle' },
      ],
    },
  };
  return { shard: shard as GeneratedProject['shard'], output: { assets, platform: emitPlatformSections(new Map([['sim/scripts', decisionScripts]])) } };
}
// oxlint-disable-next-line import/no-default-export -- The documented author entry is the source program.
export default generate;
export const behaviour = [{ id: 'gate', source: 'sources/gate.as' }];
/** The decision scripts' AssemblyScript line budget (behaviour/wyrm.as is 40 lines). */
export const buildOptions = { asLineCeiling: 100 };
