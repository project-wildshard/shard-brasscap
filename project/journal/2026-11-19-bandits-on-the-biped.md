# The bandits on the biped skin

> Written by: Claude

> **State:** checked 2026-11-19 (ONE-FORMAT CC13, lane opus-of-cc).

The Tin Bandit is rebuilt limb by limb on the kit biped: 18 bones,
attack, hit and die clips, compiled by `world.creature` into one
skinned mesh. The brawler is the same body at 1.15. The checked-in
`bandit.glb`, its skin and the 700-line `tools/bandit.ts` are gone;
`src/generators/bandit.ts` and `rows/actors/bandits.json` replace
them. This needs SDK 0.4.15 (sharddev `9ac135df`, one skinned mesh
with parts merged by material), so the pins move to SDK 0.4.15,
format 0.45.0 and engine 0.1.47, with the engine's wire held at
1.2.0 as sharddev holds it.

`test/sim.ts` now loads the skin GLBs the server reads
(`serverSkinRigs`), as the engine's real servers do; without it the
sim refuses the bandit's species. The bandit source test moved to
`test/`, where the sim loader runs it, and decodes the meshopt GLB.

Proof: `wildshard check`, the shard tests and `pnpm check` pass, and
a local `wildshard dev` shot at two cameras shows the bandits walking
and shooting with no page errors. Twenty bandits hold the CC53 budget
on the phone and desktop tiers (CC54c).
