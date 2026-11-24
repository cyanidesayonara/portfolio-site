---
title: "The rope is the constraint: replacing pivot bookkeeping with a Verlet leash"
description: "Why separate wrap-pivot state kept breaking on multi-wraps and detaching in Path of Leash Resistance, and how a 24-point Verlet rope solved poles, tangles, and slip-off with one solver."
date: 2026-10-20
tags: [godot, physics, verlet, testing]
project: path-of-leash-resistance
cover: /img/projects/leash-street.jpg
coverAlt: A dog pulling its human on a long red leash across La Rambla's wavy paving
---

In a game called *Path of Leash Resistance*, the leash cannot be decorative. If the drawn strap curves around a lamppost while the physics pulls along the straight line between dog and human, every wrap feels fake.

Early builds tried the standard top-down shortcut: maintain a list of pivot points whenever the dog-to-human segment crosses an obstacle, then shorten the remaining tether accordingly. In practice, that split brain failed repeatedly.

## Where pivot bookkeeping broke

Three bugs kept coming back across early commits:

1. **Visual vs. physical drift.** The rendered curve used one smoothing pass while the pivot stack tracked intersections in another. Under fast turns, the strap could appear wrapped while tension still aimed straight through a pole.
2. **Multi-wrap detaching.** Winding twice around a post and backing out in the opposite order often popped the wrong pivot or left a phantom corner pinned after the dog walked clear.
3. **Other walkers' leashes.** Adding NPC dog-walker pairs meant two movable ropes crossing in open space. Pivot-point lists assume static circle centers; they have no clean answer when the "pole" is another moving strap.

## Making the visible rope the constraint

The fix in `entities/leash.gd` was to delete the separate wrap state altogether. The leash is a single 24-point Verlet chain (`N = 24`, `ITER = 11` constraint passes per tick), and the points rendered on screen are the exact points driving the forces:

- **Segment-vs-circle collision.** Each iteration pushes both segments (`_collide_circles`) and points out of nearby obstacles (`POLE_PAD = 13 px` or per-obstacle radii). Because segments themselves collide, stretched segments cannot tunnel across thin lampposts.
- **Stick-slip around obstacles.** Touched points resist sliding at low stretch (`STATIC_SLIP_MIN = 0.15` for poles) so intentional wraps cinch tight. Past rest length, pole slip ramps gradually while furniture and dynamic rope snags ramp all the way to `1.0` by `STRETCH_CAP = 1.15`, letting snags pull loose cleanly instead of locking the human onto café tables.
- **Tangent pull + smooth taut onset.** `tension_force()` eases spring force in over the first 5% of stretch (`TAUT_ONSET_END = 1.05`) via `taut_amount()`, reading end tangents across `TANGENT_RUN = 3` segments (or the immediate contact segment when coiled). When wrapped around a pole, the human's pull tangent naturally steers in an arc around it.
- **NPC tangling for free.** Dynamic obstacles simply feed points from neighboring leashes into the exact same circle collision array with `K_DYNAMIC` slip, so two leashes cross and drape with zero special-case state machine.

## Pinning the physics with headless tests

Because rope regressions used to hide behind feel tweaks, the invariants now live in headless Godot test scripts (`tests/test_wrap.gd` and `tests/test_leash_taut_transition.gd`):

- Straight-line pulls track chord length and aim end tangents back along the rope.
- Spiraling inward wraps a pole cleanly, cinches contacts once taut, and curves the human's pull vector away from the straight chord.
- Pulling hard to the same side slips the coil back off rather than gluing the owner to the pole.
- Dynamic snags register `winding()` without accumulating `static_winding()`, so tangles with passersby never trigger the pole pulley multiplier.

Nothing guarantees game physics never surprises you, but making the rendered rope and the physical constraint the same array eliminated an entire class of desync bugs at once.
