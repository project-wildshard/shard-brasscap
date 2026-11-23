// The built Brasscap cell's server, headless: the folder `wildshard check .` builds, loaded into the pinned engine's
// simulation with its shipped Rapier. The sim tests (`pnpm test:shard`) share it.
// oxlint-disable-next-line import/no-nodejs-modules -- The tests read the built product and the shipped physics bytes.
import { readFileSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Resolve the built folder from the repo root.
import { resolve } from 'node:path';
import { Vector3 } from 'three';
import { engineRequire } from '@wildshard/sdk/headless';
import { loadRapier } from '@wildshard/sdk/headless/physics/rapier';
import { outputDescriptor, serverReadsFile } from '@wildshard/sdk/headless/game/shardfile/outputDescriptor';
import { serverSkinRigs } from '@wildshard/sdk/internal/engine/game/shardfile/serverSkinRigs';
import { createShardfileSim, type ShardfileSimPorts, type ShardfileSimulation } from '@wildshard/sdk/internal/engine/game/plugin/simulation';
import { loadHeadlessFolder } from '@wildshard/sdk/headless/host/headlessFolder';
import { folderHeadlessSections } from '@wildshard/sdk/headless/host/headlessSections';
import type { Shardfile } from '@wildshard/format/shardSchema';

const ROOT = resolve(import.meta.dirname, '..');
const BUILT = resolve(ROOT, 'public/shardfiles/brasscap-mesa');
export const PLAYER = 'actor.player';
export const TICKS = 60;

export async function product(directory: string = BUILT): Promise<{ shard: Shardfile; assets: Map<string, Uint8Array>; sections: ReadonlyMap<string, unknown> }> {
  const loaded = await loadHeadlessFolder(directory);
  const descriptor = outputDescriptor(loaded.shardfile);
  if (descriptor === undefined) throw new Error('brasscap-mesa has no output descriptor: run `pnpm check:shard` first');
  // the skin rigs too (engine `serverSkinRigs`): a body on a kit skeleton reads its rest rig from its GLB (CC13's bandits)
  const rigs = serverSkinRigs(loaded.shardfile);
  const server = descriptor.index.files.filter(file => rigs.has(file.hash) || (serverReadsFile(file, loaded.shardfile.terrain?.collider)
    && (file.name === undefined || file.kind === 'wasm' || file.kind === 'tile')));
  const assets = new Map(server.map(file => [file.commons === true ? `commons:${file.hash}` : file.hash,
    Uint8Array.from(readFileSync(resolve(directory, file.path)))]));
  // The product's sections carry its decisions, moves and targets, as the cell server reads them (engine `cellWorld.ts`):
  // without them the Wyrm runs no decision and falls back to its native chase.
  return { shard: loaded.shardfile, assets, sections: folderHeadlessSections(loaded) };
}

function physicsBytes(): Uint8Array {
  // The engine's own Rapier, found through the sdk (SHARD-COMPAT SI8b): the sdk's `engineRequire` resolves from the
  // engine this shard pins, so the test never names the engine package or its folder.
  return Uint8Array.from(readFileSync(engineRequire.resolve('@dimforge/rapier3d-simd/rapier_wasm3d_bg.wasm')));
}

export interface Facts { readonly facts: string[]; readonly coins: number[] }
/** The cell's server with every quest fact and coin payment it files kept in `facts`. */
export async function brasscapSim(directory?: string): Promise<{ shard: Shardfile; sim: ShardfileSimulation; filed: Facts; ports: ShardfileSimPorts; assets: Map<string, Uint8Array> }> {
  const input = await product(directory), filed: Facts = { facts: [], coins: [] };
  const ports: ShardfileSimPorts = { rapier: await loadRapier(physicsBytes()), sections: input.sections,
    quest: { fact: (name: string) => { filed.facts.push(name); }, coins: (amount: number) => { filed.coins.push(amount); } } };
  return { shard: input.shard, sim: createShardfileSim(input.shard, input.assets, ports), filed, ports, assets: input.assets };
}

/** A shot from the player that no body survives. */
export function kill(sim: ShardfileSimulation, id: string): void {
  const body = sim.host.entities.get(id);
  if (body === undefined) throw new Error(`Missing ${id}`);
  sim.host.combat.hit({ source: 'env', sourceTags: [PLAYER, 'dmg.ranged'], target: body.combatActor(), amount: 100_000, point: body.position.clone(), dir: new Vector3(0, 0, 1) });
  if (body.alive) throw new Error(`${id} survived`);
}

/** Shoot a guarded body (the Wyrm shuts its guard while it rears) every step until it dies, up to `seconds` of sim time. */
export function killWhenOpen(sim: ShardfileSimulation, id: string, seconds: number): number {
  const body = sim.host.entities.get(id);
  if (body === undefined) throw new Error(`Missing ${id}`);
  const player = sim.host.players.get(PLAYER), full = player?.health.attributes.health;
  for (let tick = 0; tick < seconds * TICKS; tick++) {
    // the player is kept whole: this proves the kill, not the fight
    if (player !== undefined && full !== undefined) player.health.attributes.health = full;
    sim.host.combat.hit({ source: 'env', sourceTags: [PLAYER, 'dmg.ranged'], target: body.combatActor(), amount: 100_000, point: body.position.clone(), dir: new Vector3(0, 0, 1) });
    if (!body.alive) return tick;
    sim.host.step();
  }
  throw new Error(`${id} survived ${String(seconds)} s of shots`);
}
