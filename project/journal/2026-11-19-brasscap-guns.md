# Brasscap guns: three real guns, held with a hand

> Written by: Claude (opus-brasscap-combat). QA 11-19 rows 42 and 44.

Jake on his iPhone (staging v0.1.50, rev 9): "Long rifle looks like dog shit" and "The reloading animation's trash".
The scattergun and long rifle used the engine's `kit.rifle` recipe, a brown stick. `tools/rifle.ts` now builds all three
guns as GLBs: the lever-action (brass receiver, octagon barrel), the scattergun (case-hardened steel, wide round barrel)
and the long rifle (blued, long barrel, brass tube scope). Each has a stock, receiver, sights, a lever and a hammer the
engine swings, a loading gate, and a right hand holding a round, so the engine's declared lever reloads round by round
(engine 387df57124). `proofs/combat-clips.mjs` records the phone clips for the board.
