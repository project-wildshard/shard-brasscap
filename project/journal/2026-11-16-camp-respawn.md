# Camp bandits come back (TC-B4b)

> Written by: Claude (opus-brassgun12), 2026-11-16

TEMPLATE-E2E TC-B4b waited on an sdk that pins a shard-format with a
spawn row's `respawn` key (0.5.8+). sdk 0.3.3 is on npm and pins format
0.7.0 and engine 0.1.24, so the shard moves to those three pins.

Each of the nine camp bandit rows gets `respawn: 90`. The rushers, the
brawler, the wyrmlings and the Wyrm stay one-shot: the pack and the boss
are the route's set pieces, the camps are where you farm coins.

`test/respawn.test.ts` loads the folder `wildshard check .` builds into
the engine's headless sim (engine's `sim-node-loader.mjs`), kills
`bandit.camp-1.1` and a rusher, and steps 90 s: the bandit stands again
at its camp, whole; the rusher stays down. `pnpm check:shard` runs it
right after the build, so CI runs it too.

The rows changed the content, so the hero was recaptured from
`wildshard dev src`.
