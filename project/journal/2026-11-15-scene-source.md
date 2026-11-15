# 2026-11-15: Brasscap Mesa as a three.js scene (AP16 prep)

Meta SHARD-SOURCE AP16, lane opus-ss4d. brasscap-cleanroom `src/`
(`e311139`) ported to the sdk's scene API the way Mossgate was
(sharddev `src/shards/mossgate`): `src/generators/` holds util, sky,
terrain, world, actors and the `defineShard` entry.

- Creatures are static poses at the cleanroom's default shot: camp 1
  sitting, camp 2 on the ledge, camp 3 fighting, gate shut, no Wyrm.
  The viewmodel, AO bake, lamp bake and dust sprites stay out.
- Cell limits: the horizon mesas ring at 150 to 195 m (was 150 to
  320), clouds at 200 m (was 900), the sand flattens to road height
  past 190 m, and a mesa over an entryway is left out.
- `shard.config.ts` is still the data shard on main: the scene entry
  needs the sdk's scene API (sharddev `plan/ss4d`, not released), so
  the switch, gameplay rows through `extend`, and the 20-camera board
  wait for engine v0.1.21 and the sdk release after it.
- Built locally with the sdk linked to sharddev `.worktrees/ss4d`:
  a scratch project whose `shard.config.ts` re-exports `brasscap`,
  19.7 MB, valid, 176 files.
