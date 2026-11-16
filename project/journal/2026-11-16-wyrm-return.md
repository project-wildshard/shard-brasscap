# The Wyrm wakes after the gate opens, wherever the player was (TC-B14)

The quest sim had found that a player standing off the cell at
(400, 400) while the gate opened left the Wyrm `armed` for good. The
cause was the sim, not the game: the cell has no ground out there, so
the player fell, and the test's `stand` moved them back in x and z but
kept the fallen height, 187 m under the arena. `BossBrain` starts the
intro when the player is inside the arena volume, and they never were.

Put back on the sand, the same run starts the intro as soon as the
player walks into the arena. `test/wyrm-return.test.ts` does it the
long way: the quest is taken, the player falls off the cell while the
camps die and the gate opens, then walks a metre a step from the depot
to the arena's middle at ground height, and the Wyrm leaves `armed`
for its intro. A real walk out of a grid cell freezes its host (a lone
player never parks a seat), so nothing there moves while they are gone.
No engine change was needed.
