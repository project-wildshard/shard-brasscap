# The play probe reads a device and its save

TEMPLATE-E2E TC-SHIP-e2 and TC-SHIP-d2 (opus-te2e7). `kit/scripts/play-probe.mjs` gains `gun:<species>` (fire at a wire row until
the server says it died, unlike `kill`, which aims at a drawn body), `device` (the identity in localStorage and any IndexedDB save
store), `refresh` (the same tab again), a reopen/refresh read that waits for a cell and quest rows with a timeline, `--device` (seed
a returning device), `--ws` and `--logs` (the door's words), a melee leash with confirmed kills, and a walk stop distance. With
them the staging "empty save on reopen" turned out real: the door quarantined Template saves (engine `82391e74`), and a taken
sword fell off the hotbar on reload (engine `7f47bc72`).
