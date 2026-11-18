# The rushers keep to the gate

> Written by: Claude (opus-brass7), 2026-11-18

Staging v0.1.42 (rev 6) never let a player kill the Dust Wyrm (meta
TEMPLATE-E2E TC-B9). The four rushers, killed at the gate, came back
120 s later (TC-B15) at a pack home 7.5 m from the arena's edge, saw
the player shooting the gullet, and bit for 7 to 9 hp every 2 to 4 s.
A player who held still died in 25 to 55 s, and each death reset the
Wyrm (engine design, J107).

Moving the pack's home north and cutting its sight was not enough. A
circling pack has no leash: it rings its prey wherever the prey goes,
roams to a point 40 to 90 m from its home (the sim saw it walk into the
arena 220 s in), and in its break phase every member flees away from
the player, which from the gate is straight into the arena. The data
host gives a pack no territory either: a species temperament's
`territorial` clamp binds only single brains.

So the rushers are now four leashed pursuers (`brasscap.bandit.rusher`,
the camp bandits' `pursue` kind): posted 4 to 8 m past the gate, facing
it, notice at 10 m, never take a target more than 11 m from their post,
run at 4.2 m/s (5 with the rusher's speed mod) and cut with a new
melee strike, `brasscap.rusher.knife` (5 hp, 1.8 m arc, 3 s cooldown).
The nearest post is 16 m from the arena's edge and 12 m from the
Wyrm's retry point (2,-80). Past the gate they still come: a player
standing 5 m in takes about 3.5 hp/s from the four (the pack dealt
about 2), so it is a fight to shoot through, not a walk. The "Rusher
hollow" map point moves with them.

`test/rusher-arena.test.ts` was red first on rev 6 (a rusher at the
arena's edge 123 s in, 36 hits in 120 s): it kills the four, holds the
player 4 m inside the arena through their respawn and 120 s more, and
asserts no rusher in the arena and no rusher hit. Its second test keeps
the gate a fight: two or more rushers hit a player 5 m past it.
