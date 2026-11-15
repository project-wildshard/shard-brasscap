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

## TC-B3: bandits fight back (opus-brassgun2, 2026-11-15)

- Bandits have 35 hp and a telegraphed pistol shot: a narrow wedge (12 m, 1.1 s windup, 8 damage). Not a `lane`: a data
  strike row always carries `motion`, so a still lane stays live for its length plus 1.2 s and freezes the bandit.
- Camp 2's two ledge bandits are marksmen: a `pursue` brain that never moves (speed 0.01, stop 20 m) and a slow rifle
  shot (20 m, 1.6 s windup, 14 damage). Strike rows cap length and range at 20 m.
- A pack of 4 rushers waits past the gate (`creatures.groups`, `kind: pack`, the data host's pack recipe). Their bite is
  the `rusher` variant's `chargeDamage` (9).
- `guardian` brains need a native port a data shard's server doesn't install (engine `dataCreaturePorts.ts` gives
  ram-grazer, challenge-grazer, the divers and burst-flyer, plus pack and herd groups), so the third brain kind comes in
  TC-B4 from a diver.
- Every skinned body is bound in client scripts (an empty sand-module binding, no pose, no emitters), so a grid data cell
  draws it (J342, Mossgate's way). The tin target posts use `engine.sphere`, which has no neighbour view yet.

## TC-B4a: two more hostile species (opus-brassgun2, 2026-11-15)

- Dust wyrmlings (30 hp, 3 on the trail) ram: a `ram-grazer` brain and a 5 m lane charge at 8 m/s, 10 damage. Sand drakes
  (40 hp, 2 over the camps) circle at 9 m and dive: an `orbit-diver` brain and a 1.9 m sphere, 10 damage. Both wear the
  Dust Wyrm's skin, scaled down (no new art, J357).
- Brasscap now has 4 hostile species (bandit, wyrmling, drake, Dust Wyrm), 21 bodies and 3 brain kinds (`pursue`,
  `ram-grazer`, `orbit-diver`), plus the rusher pack.
- Respawn waits on engine: a data shard's `creatures.spawns` never come back (only native runtime homes refill).

## TC-B5: the Dust Wyrm at the bar (opus-brassgun2, 2026-11-15)

- 440 hp (was 80), three strikes: the burst round its mound, a tail sweep (a 6 m arc at its scale) and, from the second
  phase, a sand spit (a 20 m wedge). `behaviour/wyrm.as` turns them in order (`beat` state); each strike is told by the
  sand ring and opens the gullet after, as the burst did. The pinned sdk's decision compiler builds it (35 of 100 lines).
- A grid data cell's ledger only hears `quest.complete` (engine `grid/durability.ts`), so the boss achievement is a
  bounty: "Wanted: the Dust Wyrm" starts when the gate opens and pays 20 coins and the `brasscap.wyrm` fact on its death.
