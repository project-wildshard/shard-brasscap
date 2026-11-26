# The look loop names its zone outside the address (opus-node26, meta CHUNK-PARAM-REMOVAL CP24)

- J522 deleted `?chunk=`; engine's views.mjs (CP17) enters a zone from `cameras.json`'s `zone` field and refuses a
  query that still names one.
- The nine `art/look-loop/*/cameras.json` move `brasscap-mesa` from their query to `zone`, and the stamped look-loop
  skill (repo-kit 3c8abf5) says the same. These were the repo's last hits of the kit's chunk-param guard.
