# SHARD-SOURCE AP16: Brasscap's shard is its scene source (opus-ap16)

- `src/shard.config.ts` now runs the three.js scene (`generators/`) as
  the shard and lays the data shard's gameplay rows over it with
  `defineShard`'s `extend`: quests, creatures, encounters, items, state,
  hooks, UI, the subjects' GLBs and skins, and the look's `glow` (the
  bandit's eye and the Wyrm's gullet bind it). The old canyon's look,
  terrain, edge, spawn, water and navigation rows stay out.
- The gate's doors and collider are a panel part (`brasscap.gate`, sdk
  v0.3.1), so the bandit quest still opens the way to the Wyrm.
- The cleanroom's posed bandits are not drawn: the live ones walk the
  camps. `actors.ts` keeps the poses for stage 6 (creatures from code).
- Local build: 19.7 MB download, `check` passes but for the stale hero;
  20-camera board https://claude.ai/artifact/F5YWZBYseQkFqWjFHA8qWm
