# Rushers and the Wyrm come back (TC-B15)

> Written by: Claude (opus-wyrm), 2026-11-18

Staging's v0.1.40 deploy restarted the room, and TC-SHIP-d2's device stood
at the shut gate, z -61.4, with `brasscap.gate.open` in its flags and
shared field 101 at 0 (probe `w1`). A dedicated room boots its world fresh
(engine `dedicatedRoom.ts`, `openWorld` with no snapshot), a player's doc
never holds world state, and the `brasscap.gate` quest that sets field 101
never replays its scene once it is complete. The lever's side door
(field 102, anyone may pull it) still leads round; the probe goes that way.

The same shared room explains "rusher 2 never showed": the rushers and the
Wyrm were one-shot (TC-B4b gave `respawn` to the camps only), so a rusher
another device killed stayed dead for the room, this device could never
file its `dead:` flag, and the main quest stuck at `rushers`. J361 wants
shared enemies with per-player quests, so the four rushers now respawn
after 120 s and the Wyrm after 300 s (the bounty stays once per player:
it is a flag). `test/respawn.test.ts` checks the rows and a rusher's
return.

Not done here: a way for a player who earned the gate to open it again
after a restart. A gate prompt lets anyone open it early; a sheriff choice
needs a cycle the dialogue graph refuses. Left in TEMPLATE-E2E TC-B15.

Hero recaptured for the new content stamp: `wildshard dev` 0.4.1 still
answers 404 for `/shardfiles/brasscap-mesa/discovery.json`, so the page
was served by sharddev main's own `packages/dev/bin/wildshard.mjs dev src`
(the fix, `632396a1`). `check:shard` passes; 9 sim tests green.

Publish run 44249982958 stopped at "Install phone WebKit for prepare":
`Cannot find module 'playwright/package.json'` from `@wildshard/sharddev`.
sdk 0.4 moved prepare and its playwright into `@wildshard/dev` (under
`@wildshard/cli`), so the step now resolves playwright there, falling
back to the sdk for an older pin.
