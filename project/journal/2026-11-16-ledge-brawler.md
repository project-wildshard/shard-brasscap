# 2026-11-16: ledge marksmen and a bandit brawler (TC-B3b, TC-B4c)

> Written by: Claude (opus-brassgun11)

Camp 2's marksmen fell off their ledge in the server cell: a data cell's creatures walked the heightfield (engine
TC-B3b fixes that), the mesa solid sat 0.5 m above the drawn ledge (`col` ignored `y0`), one marksman stood off the
west edge and one inside the mesa behind the ledge. Mesa solids now span the drawn block; both marksmen stand at the
lip, the only place a chest-high sightline clears the ledge down to the trail.

The sand drakes' removal (TC-B11) left two brain kinds and three armed species. The bandit brawler at camp 3 (its own
species on the bandit skin, 60 hp) is a `challenge-grazer`: a 7 m lane tackle and a 2.6 m arc club. It pays 6 to 10 coins.
