# Bandits that hold a rifle, a Wyrm that keeps moving

> Written by: Claude (opus-brasscap-combat2). QA 11-19 rows 42 and 44.

Jake on his iPhone (~12:33 to 12:41 Cancún): "enemies are not animated to be holding a gun and shooting a gun", and of
the Dust Wyrm "it moves really slowly, and it's really hard to hit ... There's no feedback on what's a miss ... what is
a damageable zone".

- The tin bandit's revolver in one fist is a two-handed rifle shouldered on the right (stock, blued receiver and barrel,
  fore-end, brass bands). The arms and the rifle ride a `grip` bone at the shoulders, so the hands never leave the gun;
  `rifle` lets it go loose in the fall; `muzzle` at the barrel's end is where engine 8dc63b261 draws the flash and the
  round. New clips: `idle` and `walk` carry it at the low ready (the walk is the poser's own gait), `attack` brings it
  to the shoulder over the windup, `attack.fire` kicks and lowers it as the round leaves, `hit` knocks it down, `die`
  buckles and falls. The brawler has no muzzle: it clubs and tackles, and a muzzle would flash on its charge. The
  bandit's triangle line moves from 400 to 560 for the rifle and arms (J438).
- The Wyrm burrows and surfaces in 0.4 s (from 0.5), its leap falls at 22 m/s² (about 1.8 s up and down, from 2.7), the
  beats are 1 s and 0.7 s (from 1.6 and 1), and before each tail sweep it lunges, a 3 m hop at a player within 8 m of
  the mound. A player standing back at 12 m (TC-SHIP-d2) still gets no lunge and no sweep.
- The gullet burns half again as big with a hot ring of throat round it, and each plate has a glowing seam behind it:
  the open gullet is where rounds count, the plates take half.

The engine half (the creature rounds, the attack.fire clip, the Wyrm's death and the held quest card) is engine
8dc63b261, in v0.1.53.

## Rev 13: the Wyrm comes out of its pit, and the arena has ammo

- The local proof on engine main with rev 12 showed the Wyrm still hugging its mound: `reach` held its surfacing to 4 m
  off the middle. It is 8 m now. The leap still lands it back on the mound, so the burst's 7 m ring stays where it was
  and a player 12 m out keeps room to shoot. The leap test stands its player 10 m out and reads the landing off the body.
- The clip bot ran dry at half the Wyrm's health (96 rounds, most on armour while the gullet was shut), and the arena had
  no ammo. An ammo cache (+30 lever rounds) now sits inside the ring by the arena's mouth, a crate, a tin and a barrel.
  One scene restocks one gun (engine keys item actions by scene), so it restocks the lever.
- The proof bot stops at z -88 (the arena is 16 m round the mound; at -83.4 the fight never started) and switches guns
  when one runs out. With the switch it killed the Wyrm in about 3 minutes.
