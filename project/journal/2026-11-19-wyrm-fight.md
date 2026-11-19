# The Dust Wyrm's fight on its serpent moves (2026-11-19)

> Written by: Claude (opus-of-cc2, from opus-of-cc's CC26 handoff)

Meta ONE-FORMAT CC26. The burst is now the serpent's own moves, with no Wyrm code in the engine: the Wyrm burrows,
relocates under the nearest player (held 4 m off the mound's middle), surfaces, leaps 9 m up onto the mound spot, turns
to face the player and the burst rings out where it lands. Sweep and spit stay direct strikes.

The decision script, its moves and the mound spot all go through `defineShard`'s options (`decisions`, `moves`,
`spots`), the one way a scene shard declares a fight (sharddev `34dd67b6`, in SDK 0.4.16, beside TR-12b's `decisions`).
`shard.config.ts` no longer writes platform sections by hand.

"The abilities gain `from`" is dropped: engine `decisions.ts` `abilityStrikes` never copies `from`, so it would need an
engine change, and the burst does not need it. `test/wyrm-leap.test.ts` proves the leap; TC-B5's boss test still passes.
Proven headless in `wildshard dev` from two cameras: the head rides 2.9 to 8.2 m up and lands on the mound.
