# Give the alternate Git fixture its own temp folder

Stamp repo-kit 7e9e964052. The alternate Git store and linked worktree use
one mkdtemp directory per case, which owns its cleanup.
