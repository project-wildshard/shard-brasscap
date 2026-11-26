# Scripts enter a zone like a player (opus-chunk2, meta CHUNK-PARAM-REMOVAL CP20)

- J522 deletes `?chunk=`. The play probe's one-zone entry is now --entry=tap (the Zone Select tap; it entered brasscap-mesa in 6.6 s on a local engine build); the combat harness and the wyrm probe (--zone=) take the tap too.
- They import `enterZone` from `@wildshard/sdk/headless/scripts/zone-entry.mjs` (the engine's, through the sdk as
  the other harness entries), which the next sdk release carries; until this repo's pin moves they run against a
  linked sdk and engine (J475).
