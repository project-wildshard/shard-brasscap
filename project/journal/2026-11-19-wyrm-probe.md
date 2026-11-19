# 2026-11-19: the two-player Wyrm probe (ONE-FORMAT CC27)

`proofs/wyrm-probe.mjs` takes two players (desktop Chromium, phone WebKit) through Brasscap on staging to the Dust Wyrm
and fights it down; `proofs/wyrm-board.mjs` lays the t2-14/15/16 shots beside the cleanroom. Run 2 on staging rev 9:
both landed hits, weak and defeat passed at 56 to 60 fps. The trail read found no skinned mesh with `seg` bones, so that
check is still open (`--census` lists what the page draws).
