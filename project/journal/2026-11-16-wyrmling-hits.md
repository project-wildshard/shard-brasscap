# A dust wyrmling takes the rounds aimed at it (TC-B13)

A wyrmling wears the Dust Wyrm's skin at spawn scale 0.5: a coil drawn
1.1 m tall. Its body capsule was the default horizontal one (bodyY 0.5,
radius 0.45), centred 0.19 m up and topping out at 0.42 m, so 30 rounds
at its middle missed and only shots at 0.3 m landed.

An upright capsule (`capsuleAxis: 'y'`) is what the coil wants, but the
format's `rows.species` dims refuse that key (shard-format 0.7.0 and
main), so the capsule stays horizontal and grows round instead:
bodyY 1.1, radius 1.05, half length 0.2, about a 1.05 m ball from the
sand to 92% of the crest.

`test/wyrmling-hits.test.ts` reads the skin's height from wyrm.glb and
checks that each wyrmling's capsule spans it, and that a round from a
player's eye 10 m off meets it at 0.2 m, the middle and 0.9 m. On a
local `wildshard dev` page the probe killed a wyrmling at its default
0.9 m aim (6 shots) and at 0.5 m (3 shots). Hero recaptured.
