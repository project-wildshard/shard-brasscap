# The kit hooks catch up, with the stale-hero guard (meta QA 11-25 row 50)

- opus-fp54c: Brasscap's .githooks predated push-gate-copy.mjs, so the stale-hero guard stamped to the other shard
  repos (repo-kit 664e601, QA 11-25 row 49) couldn't run here. A full `kit.mjs apply` brings the hooks, land and
  worktree scripts to the kit's current copies, adds scripts/main-push.mjs and .githooks/hero-fresh.mjs, and drops
  the retired herdr hooks. A push now refuses a hero stamped for older content (SKIP_HERO=1 bypasses).
- The kit's agent layout came too (`agent-sync --from repo-kit`): the new session-brief test expects the hc peers
  section, so the herdr hooks give way to guard-hc-send.sh and peers.sh, as in the kit's other repos.
