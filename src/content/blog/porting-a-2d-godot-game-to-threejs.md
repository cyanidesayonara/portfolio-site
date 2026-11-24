---
title: "Porting a 2D Godot walk into Three.js without blowing up draw calls"
description: "Notes from building the interactive /walk seafront on this portfolio: translating pixels to meters, merging geometry with DirectBuilder, streaming districts, and porting the leash tests."
date: 2026-11-19
tags: [threejs, typescript, webgl, physics]
project: path-of-leash-resistance
cover: /img/projects/leash-eixample.jpg
coverAlt: A walk through the Eixample in Path of Leash Resistance
---

*Path of Leash Resistance* lives on the portfolio site as a 2D canvas street on the home page and a 3D walkable Catalan seafront town at `/walk`. Bringing the seafront, town blocks, market square, and hillside into a browser WebGL canvas without bundling external 3D art meant solving two problems early: physics scale and draw-call discipline.

## Translating pixels to meters (`68 px = 1 m`)

The 2D Godot game measures a 340 px retractable leash in screen pixels and steps at 60 Hz. In `src/scripts/walk/leash.ts`, the XZ simulation rescales to meters (`68 px = 1 m`, giving a 5 m leash) and steps at 120 Hz.

Two small porting details made the biggest difference in feel:

- **Segment-side anti-tunneling for 3D lampposts.** In 3D, a thin spot mast (`r = 0.06 m`) sits between 0.2 m Verlet vertices. Without checking which side of the pole each segment started on (`pushSegment()`), a fast sprint pulls the rope straight through the post.
- **Unconditional locking was too strict.** When I later ported Godot's wrap and slip-off checks into `tests/leash.test.ts`, the "hard pull-away slips the coil off" assertion failed at first: keeping side-locks active at extreme stretch prevented wraps from sliding off. Relaxing `pushSegment()` side-locks above `1.35x` stretch and during active `whirl` / `freeSlip` kept thin-pole anti-tunneling intact during normal pulls while letting overstretched wraps unwind cleanly.

## Keeping WebGL draw calls flat in code

Everything in `/walk` is built procedurally—panot textures, plaster walls, signage canvases, buildings, palm trees, bicycles, and characters. Spawning separate `THREE.Mesh` objects per brick, step, and window frame would stall mobile GPUs fast.

Three rules kept the scene around ~650–700 draw calls on desktop even with multiple districts loaded:

1. **Direct merged triangle builders (`meshbuilder.ts`).** Static city blocks, terrain grids, and simplified distant stand-ins emit non-indexed triangles directly into vertex-colored chunk buckets via `DirectBuilder` instead of allocating thousands of temporary `BoxGeometry` meshes.
2. **Sliced generators and frame budgets (`world.ts`, `bake.ts`).** Heavy builds (`buildLevelSteps()`, `makePlazaDistrict()`, `makeHillDistrict()`) yield as generators behind the train/metro loading screen and under a 4 ms streaming budget (`Streamer`), swapping distant stand-ins for live baked chunks when Millie gets within 80 m and unloading beyond 170 m.
3. **Line-of-sight dither (`fade.ts`).** Instead of snapping walls invisible between the street camera and Millie, custom shader fading dithers geometry along the camera-to-dog ray while exempting characters and the red leash.

## Splitting the runtime loop

As districts and interactive project pavilions (`Coriolis`, `stemma`, `Eat Prey Nap`, `dopepod`) accumulated inside `game3d.ts`, the orchestrator grew past 3,000 lines. Extracting `particles.ts`, `sky.ts`, `goals.ts`, and `boothPanels.ts` alongside automated unit tests (`tests/leash.test.ts`) and a headless CDP smoke check (`tools/smoke-check.mjs`) brought the 3D showcase closer to the engineering guardrails of the real game.
