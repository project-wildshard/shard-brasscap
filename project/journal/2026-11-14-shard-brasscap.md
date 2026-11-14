# 2026-11-14: shard-brasscap, out of shard-format (SS3)

Meta SHARD-SOURCE SS3 (J342): Brasscap Mesa leaves shard-format's
corpus for a repo of its own, as TypeScript shard source on the sdk.

- Staged from shard-format `corpus/brasscap-mesa` and
  `corpus/sources/brasscap-mesa` at `e45b368` (the gate's straps and
  studs). The authored sections are `src/rows/`; the cooked ones
  (`world/tiles`, `collision`, `props`) are left for sharddev to cook
  from the canyon bake input. `ui/level` is left out too: sharddev
  derives it from `manifest.json`.
- The generators (`canyon`, `rifle`, `bandit`, `wyrm`) are
  shard-format's `src/tools/brasscap/` as they were, now in `tools/`
  (build-time tools, not shard source, so the author lint leaves them
  alone), importing `@wildshard/format/glbCost` and `skinAssets` from
  the package and writing into `src/sources/`. `rebake.ts` and `subjects.ts` stay in
  shard-format: they rebake its corpus.
- It needed an sdk on shard-format 0.5.x (Brasscap's look rides 0.5's
  render hosts), so the sdk moved to format 0.5.3 and engine 0.1.19
  and was released as 0.3.0 first.
- Two numbers changed to build on the sdk. `budgets.sim.resident` in
  `src/rows/files.json` was 0, and sharddev adds only the cooked
  files' cost to it, so the sim scripts (the gate and the Wyrm's
  decision script) had no room: "script memory budget understated or
  above host cap". It is 4 MiB now. `serverBudget.memory` is the
  corpus's own after the gate, 17,258,340.
- The hero is the corpus's card art, stamped with `--stamp-existing`
  (it shows Brasscap; the gate's straps are too small to see in it).
  SS3's board recaptures it at the t2 cameras.
