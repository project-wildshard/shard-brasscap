# The probe reads the bodies the page draws (opus-brassgun4, TEMPLATE-E2E)

- Staging's "no creatures" had two halves. The engine one: the staging
  release pinned `blender-template` rev 3, whose spawns no client
  script binds (engine `7836ef04` pins rev 5; `e2b121b5`'s far fix lets
  rev 5 load on the grid). The probe one: `state().creatures` is the
  regional world's animals, empty in a grid data cell, whose creatures
  draw as `neighbour-creature:<look>` skinned meshes in the cell root.
- `bodies` in the probe's JSON counts those meshes, shown up their
  parent chain and in the camera's frustum, by look (bandits draw with
  `brasscap.bandit`; the Wyrm, wyrmlings and drakes with
  `brasscap.wyrm`). `aim`, `shoot` and `kill` fall back to the nearest
  shown body whose look names the kind; a kill is the page's confirmed
  kills growing (`__workerClient().kills`), since a body has no page hp.
- A two-page loopback room on rev 5 (engine online-rig) drew 13
  bandits and 6 wyrm-look bodies on both pages; walking from the
  porch to (-4, -18) did not stall.
