# Cap push-gate test workers

Stamp repo-kit 40c5f46. The push gate defaults to a quarter of the cores
for Node and Vitest. `WS_GATE_WORKERS` overrides the ceiling.
