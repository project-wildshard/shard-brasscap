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

## TC-B6: Sheriff Brass gives the quest (opus-brassgun2, 2026-11-15)

- One file per NPC (J361): `rows/npcs/sheriff.json` holds his dialogue and talk target; `shard.config.ts` merges every
  NPC file into `quests.dialogue` and `targets.talks`.
- He stands on the porch facing the spawn (the scene's `cowboy` figure, part `folk`). The main quest waits for his talk
  (`startWhen: brasscap.sheriff.met`; its `intro` points at him). His lines follow the quest: the offer, camp tips once
  camp 1 falls, and his thanks once the Dust Wyrm is dead (that choice sets `brasscap.sheriff.reported`).

## TC-B7a: stuff in the world (opus-brassgun2, 2026-11-15)

- A strongbox at camp 3 (the crate at 21.5, -53): its prompt restocks 30 lever rounds; walking up to it the first time
  pays 15 coins (a region trigger and an untracked quest, so the coins are per player, J361).
- A wanted poster on the trail signpost (`rows/npcs/poster.json`, a one-node dialogue): reading it starts the Dust Wyrm
  bounty early (the gate's opening still starts it too).
- Each camp pays a 5-coin bounty when its third bandit falls (untracked quests).
- Still open (TC-B7b): the lever by the gate and a moving side door. A mover row needs a baked hinge module
  (`MoverBakeSchema`, driver `hinge`), which this source has no step for yet.

## TC-B8: the quest and the map at the bar (opus-brassgun2, 2026-11-15)

- "Brasscap Mesa" now has 8 steps, each with a marker and a hint: the target posts, camps 1 to 3, the canyon gate, the
  rusher pack (a 0 to 4 count), the Dust Wyrm and the report back to Sheriff Brass. His talk starts it (TC-B6).
- Two achievements: the quest's `brasscap.mesa` and the bounty's `brasscap.wyrm` (TC-B5).
- 9 POIs in `manifest.json`: depot, target range, the three camps, strongbox, gate, rusher hollow and the Wyrm's pit.

## The Wyrm at the cleanroom size (opus-brassgun2, 2026-11-15)

Jake (Scene Board t2-14): "why does the brasscap boss get soe small bruv". The live Wyrm was the 2.1 m rig at spawn scale 2 on bear dims. Now spawn and variant scale 5 (about 10.5 m to the maw top; the cleanroom's emerge arch tops out near 11 m), dims bodyRadius 0.55, bodyY 1.0, headRadius 0.6 (capsule 2.75 m by 10 m, lock point 8 m up, at the maw). Reach grew with it: burst 7 m (radius 3), sweep 8 m (arc 7), spit wedge 18 m; arena radius 16. From the t2-14 spot (2, -84, yaw 0) the Wyrm fills 51% of the frame height against 56% in the cleanroom's t2-14 ([capture](2026-11-15-wyrm-t2-14.jpg), local dev, spawn moved there for the shot only).
