// Brasscap Mesa's shard source (meta SHARD-SOURCE AP16): the canyon is three.js scene source (generators/, brasscap-cleanroom
// e311139 on the sdk's scene API), and the gameplay is the data shard's (SS3): the authored rows are rows/ (one file per
// shardfile section), the gate's behaviour is sources/gate.as, and the subjects (lever rifle, tin bandit, Dust Wyrm) are the
// GLBs and skin files the tools/ generators write into sources/. `wildshard build` runs `generate`; `wildshard watch` reads
// its describe() and streams the scene's parts to a page.
import type { Shardfile } from '@wildshard/format/shardSchema';
import { emitPlatformSections } from '@wildshard/sharddev/platformSections';
import type { GeneratedProject, ProjectGenerationContext } from '@wildshard/sharddev/projectGeneration';
import { defineShard, type SceneShard } from '@wildshard/sharddev/scene/shard';
import { buildBrasscap } from './generators/world';
import { sideDoorMover } from './generators/sideDoor';
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
import looks from './rows/look/materials.json' with { type: 'json' };
import quests from './rows/quests/quests.json' with { type: 'json' };
import poster from './rows/npcs/poster.json' with { type: 'json' };
import sheriff from './rows/npcs/sheriff.json' with { type: 'json' };
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
import movers from './rows/world/movers.json' with { type: 'json' };
import traversal from './rows/world/traversal.json' with { type: 'json' };
import weather from './rows/world/weather.json' with { type: 'json' };
import authored from './rows/files.json' with { type: 'json' };

/** The subjects the authored rows name by hash (the lever rifle, the tin bandit and the Dust Wyrm, with their skin
 *  files) and the sand ring's client script: authored bytes, not cooked. Their `files` rows are rows/files.json. */
const SUBJECTS = ['sources/rifle.glb', 'sources/bandit.glb', 'sources/wyrm.glb', 'sources/bandit.skin.json', 'sources/wyrm.skin.json', 'assets/wasm/sand.wasm'] as const;

/**
 * The gameplay rows over the scene's shardfile. The scene writes the look, ground, edge, spawn, props and colliders; the
 * data shard's look (but its `glow`), terrain, edge, spawn, water and navigation rows are the old canyon's and stay out. The rifle rack's
 * panel row goes (the scene's rack has no rifle on it to hide; the rack's interaction still hands the lever-action over).
 */
function gameplay(shard: Shardfile): Shardfile {
  // one file per NPC (J361): rows/npcs/<name>.json holds its dialogue and its talk target
  const npcs = [sheriff.npc, poster.npc];
  const targets = { ...ui.targets, panels: ui.targets.panels.filter((row) => row.panel !== 'brasscap.rack.rifle'), talks: npcs.map((npc) => npc.talk) };
  const story = { quests: { ...quests.quests, dialogue: [...quests.quests.dialogue, ...npcs.map((npc) => npc.dialogue)] } };
  const library = shard.budgets.library;
  // the bandit's eye and the Wyrm's gullet glow: their skins bind look material `glow`, the data shard's emissive
  const families = shard.look.families.includes('emissive') ? shard.look.families : [...shard.look.families, 'emissive' as const];
  return {
    ...shard,
    look: { ...shard.look, families, materials: { ...shard.look.materials, glow: look.look.materials.glow } },
    ...creatures, ...crowds, ...audio, ...encounters, ...items, ...ledger, ...story, ...clientScripts, ...hooks, ...plumbing,
    ...sim, ...migrations, ...state, ...card, ...ui, targets, movers: [...movers.movers, sideDoorMover()], ...traversal,
    files: [...shard.files, ...authored.files], library: [...shard.library, ...authored.library], critical: [...shard.critical, ...authored.critical],
    budgets: { ...shard.budgets, library: { resident: library.resident + authored.budgets.library.resident, compressed: library.compressed + authored.budgets.library.compressed } },
    serverBudget: authored.serverBudget,
    rows: { ...shard.rows, ...species.rows, ...strikes.rows, ...loot.rows, ...days.rows, ...weather.rows, ...looks.rows, ...compendium.rows },
  } as Shardfile;
}

const scene = defineShard(identity, buildBrasscap, { extend: gameplay });

/** The scene's shardfile plus the subjects' bytes and the Wyrm's decision script (sharddev cooks that and the gate). */
async function build(ctx: ProjectGenerationContext): Promise<GeneratedProject> {
  const subjects = await ctx.cached({ id: 'brasscap-subjects', inputs: SUBJECTS }, inputs => new Map([...inputs].map(([file, bytes]) => [file.replaceAll('/', '-'), bytes])));
  const assets = new Map([...subjects.values()].map(bytes => [ctx.asset(bytes), bytes]));
  const product = await scene(ctx);
  return { ...product, output: { ...product.output, assets, platform: emitPlatformSections(new Map([['sim/scripts', decisionScripts]])) } };
}

/** The generator `wildshard build` runs, with the scene shard's describe() and gameplay() for `wildshard watch`. */
export const generate: SceneShard = Object.assign(build, { describe: scene.describe, identity: scene.identity, gameplay: scene.gameplay });
// oxlint-disable-next-line import/no-default-export -- The documented author entry is the source program.
export default generate;
export const behaviour = [{ id: 'gate', source: 'sources/gate.as' }];
/** The decision scripts' AssemblyScript line budget (behaviour/wyrm.as is 40 lines). */
export const buildOptions = { asLineCeiling: 100 };
