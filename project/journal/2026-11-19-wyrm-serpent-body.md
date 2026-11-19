# The Dust Wyrm's serpent body

> Written by: Claude

> **State:** checked 2026-11-19 (ONE-FORMAT CC25, lane opus-of-cc).

`wyrm()` in `actors.ts` splits into builders (`wyrmSegment`,
`wyrmHead`, `wyrmCore`), and `src/generators/wyrm.ts` hangs them on a
serpent rig: the `body` bone, then 14 trail bones head first, 1.6 m
apart in the world, with the maw bone on the head carrying the ring
and the glowing gullet. `world.creature` compiles it as a giant at
body scale 1/4 on the spawn's 5, so it lays back at 1:1. The engine's
serpent poser lays each trail bone on the head's path; there is no
Wyrm code in the engine.

The species row moves to `rows/actors/wyrm.json` with serpent dims in
place of the bear's. The old `wyrm.glb` and skin stay for the
wyrmling. The cleanroom's three posed shots (emerge, weak, defeat)
hash as they did before the split (`test/wyrm-source.test.ts`).

Proof: check, the shard tests and `pnpm check` pass; 16 bones, 14
volumes, 1,358 triangles. A local `wildshard dev` shot shows the maw,
the gullet and the plated body with its dorsal spikes. It lies flat
until CC26's moves make it arch.
