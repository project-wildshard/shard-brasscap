# The play probe (TEMPLATE-E2E TC-B0)

> Written by: Claude (opus-brassgun), 2026-11-15

Jake played Brasscap on staging and found nothing: no gun, no enemies. `kit/scripts/play-probe.mjs` enters the shard
the two ways a player does (its Shard Select card, and the grid road from Signal Dunes south into cell (-1, -1)) and
prints what the page holds. On staging (`blender-template` r3, engine v0.1.21) it read:

- **Shard Select:** spawn on the porch (3.6 m from the rack), held `empty`, hotbar `empty`. E at the rack (0.3 m away)
  shows no prompt and takes nothing. The server holds the lever (6 rounds, 30 reserve) but never hands it over.
- **Creatures:** the wire carries all 12 bodies and the page draws none (`drawn {}`, no bandit at camp 1). A grid data
  cell draws only creatures a client script binds (engine `grid/neighbourLife.ts` `admit`); Brasscap binds only its
  sand-ring particles. Mossgate binds its three, which is why Jake met its blob.
- **The rack:** a grid data cell drops item-scene prompts (`grid/copyPrompts.ts`) and holds bare hands (G68), so the
  rifle can't be had at all on the grid, the only way in (`?chunk=` times out on staging).
- **Road entry:** lands at (-1.3, 246), 247 m from the porch.
- The bandits' `strike: null` and 10 hp stand, untested: nobody can see them.

So the fixes are engine first (TC-E1a to TC-E1d), then rows.

## TC-B1 and TC-B2 (opus-brassgun, 2026-11-15)

- Engine `plan/tc-e1` (TC-E1b to TC-E1d) puts a grid data cell's declared items in hand: Brasscap's lever-action (the
  loadout's primary) is held from the spawn and from the road, fires, and its rack restocks. The rack's prompt now reads
  "Restock the lever-action (+30 rounds)".
- Two more guns to pick up, rows only (`kit.lever` rows with their own profiles): a scattergun on camp 1's crate (4 shells,
  18 damage, 25 m, wide) and a long rifle on camp 2's ledge (5 rounds, 30 damage, 200 m). An ammo box at each camp adds
  30 lever rounds. They are untested in a built shard: the source's hero is stale, so `wildshard check` refuses every build
  until TC-B9 captures a new one; the rows pass shard-format's item and target schemas.
- The probe's `face:x,z,y` also pitches to height y, so a shot lands on a target's body.
