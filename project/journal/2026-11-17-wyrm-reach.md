# Dust Wyrm reach and the probe's gullet gate (opus-te2e5, TEMPLATE-E2E TC-SHIP-d2)

- Probe: the `gun` step held fire while the Wyrm's y was under -0.5; the Wyrm rests at -1.29 in its mound, so three
  staging runs never fired at an open gullet. A named open row now gates fire alone. Its aim height was also under the
  hitboxes (head and body centre at y 3.7): use `@5`. Targets match an id prefix (`bandit.camp-3`) and lead a mover; new
  `pack` and `watch` steps.
- Content: with the probe firing, staging v0.1.37 showed the Wyrm reset to full every ~32 s: engine scales a strike's
  shape and range by the actor's scale (5), so the authored 7 to 8 m strikes reached 35 to 40 m and killed the player
  anywhere in the arena. The three rows are now divided by 5; `test/wyrm.test.ts` checks a player 12 m off is untouched.
