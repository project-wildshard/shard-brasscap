# Wait for the SessionEnd fixture to exit

Stamp repo-kit ec8a2459. The real-kill test waits for the marked child
to exit while its fake session owns and reaps it.
