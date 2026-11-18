# The gate reopens by a prompt

> Written by: Claude (opus-te2e7), 2026-11-18

A room boots its world fresh, so after a restart the canyon gate stands
shut (shared field 101 = 0) while a player who cleared the camps holds
`brasscap.gate.open`; the quest never replays its scene, so that player
stood at a shut gate (TC-SHIP-d2, run `w1`). `brasscap.gate.use` is a
prompt on the gate's town face that runs the same `brasscap.gate.open`
scene. Its `unless` names the `brasscap.gate.open` condition, so a page
drops the prompt while the gate stands open (engine TE-ENG6).

Anyone may use it, not only a player who earned the gate: the lever's
side door already makes the gate no lock, and a sheriff choice needs a
dialogue cycle the format refuses. `test/gate-prompt.test.ts` proves the
fresh room's gate is shut, the prompt is seen and opens it.
