# An escape hatch is named or refused (meta QA 11-25 row 51)

- opus-fp54c: the kit's J381 rule (repo-kit a223e24): commit-msg refuses a commit made with any SKIP_* or ALLOW_*
  variable set unless its body names it with a reason, and pre-push refuses a push made with one unless an outgoing
  commit names it. SKIP_PEERS is exempt; the test sandbox names the hatches a test sets.
