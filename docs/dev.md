# Developing shard-brasscap

Brasscap Mesa's shard source (meta SHARD-SOURCE SS3, J342), moved
out of shard-format's `corpus/brasscap-mesa/`. One shard, at `src/`
(J317); the kit's tooling is in `kit/` (J329).

## Commands

- `pnpm install --frozen-lockfile` installs the pinned sdk
  (`@wildshard/sharddev` is `@wildshard/sdk`), engine, shard-format
  and three, and turns on `.githooks/`.
- `pnpm check` runs the repo's checks: types, kit lint and format,
  the generator tests, asks, AGENTS.md, agent parity and the hook
  tests. The pre-push hook runs it.
- `pnpm check:shard` is `wildshard check .`: it builds `src/` into
  `public/shardfiles/brasscap-mesa/` and validates, proves and
  reports on it. CI runs it too.
- `node tools/canyon.ts` writes `src/sources/canyon.glb`
  and `depot.glb`; `--bake src/world/canyon.glb` writes the bake
  input that `shard.config.ts` names. `rifle.ts`, `bandit.ts` and
  `wyrm.ts` write the subjects into `src/sources/`. Each generator's
  test fails when its committed GLB is stale.

## Layout

- `src/shard.config.ts`: the build entry. It spreads the authored
  sections in `src/rows/` (one file per shard file section), adds
  the subjects as authored bytes, and lets sharddev cook the canyon
  world, the gate (`sources/gate.as`) and the Dust Wyrm's decision
  script (`behaviour/wyrm.as`).
- Brasscap keeps its slug, `brasscap-mesa`, and its state ids (J197).
- shard-format keeps an exported shard file of a pinned commit of this
  repo for its smoke tests (SS4); nothing here depends on it.

Scratch goes in `tmp/<task>/` and is removed when its result is
kept. Commit only named paths, with a Conventional Commits subject
and the `Assisted-by` trailer.
