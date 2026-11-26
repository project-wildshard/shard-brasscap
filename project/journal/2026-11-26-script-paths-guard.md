# The push lane runs the script-paths guard (opus-guard119, meta QA 11-25 row 119)

- `.githooks/run-checks.mjs` was row 113's hand-edited copy, which never ran the script-paths, chunk-param or
  gate-report steps. It is the kit's copy again; the only local edit was a dynamic `branch-restore.mjs` import.
- The guard, its helpers and an empty `.githooks/script-paths.baseline.json` came with `kit.mjs apply`, so a push that
  adds a script pointing where nothing is is refused (`SKIP_SCRIPT_PATHS=1` is the J381 hatch). The same apply brings
  publish.yml without the pre-lean `scripts/select-candidate.mjs` fallback.
- The guard finds nothing here. `agent-sync --from repo-kit` restamped agent-sync.mjs (row 97's wording) with the
  NotebookEdit matcher (row 108). Pushed from a clone: the shared checkout holds another lane's `src/hero.json`.
