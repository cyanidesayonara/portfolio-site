# Phase 9: La Fàbrica (past the Rambla's +x end) -- design

Status: approved by Santtu on 2026-11-28; built on `feat/walk-phase9-fabrica`.

## Orientation note (read first)

The sea is -z and the default camera faces it, so +x is the right-hand side when looking out to sea. In the real town that is southwest, toward Barcelona; -x is northeast, toward Montgat. The current map has Marina, Gorg and Ronda on the -x side, which is backwards: Santtu wants the level to end up as a miniaturized but recognizable version of the real town, with the port, Gorg and the old oil pier on the +x side of the station. That needs a redesign of the overall layout later. This district is named neutrally ("La Fàbrica", after its chimney square) so it does not bake in a wrong compass name; old factory chimneys fit the +x side of the real town.

## Goal

Grow `/walk` past the old `x = 92` Rambla rail with one streamable district, built the same way as Phases 6-8: its own geometry file, pure geometry/logic modules with `node --test` coverage, a life layer, a pipicà, three quests and one chase. Keep the town unnamed on screen.

## Footprint

- District `fabrica`, `x 96..176`, `z 33.5..104` (inland of the Rambla). The `town` district's bounds shrink to `x <= 96` so the two do not overlap.
- The Rambla itself becomes walkable from `x 92` to a new end rail at `x 140` (its slabs already ran that far). The promenade stays closed: the railway sits between it and the Rambla, so a second join would split the district.

## Contents

1. **Avinguda de la Fàbrica** (`x 110..126`): a pedestrianized avenue with a tree line down the middle and shops on the ground floors (Forn, Farmàcia, Ferreteria). Cream/ochre Catalan blocks on both sides.
2. **Chimney square** (`x 126..172`, `z 58..96`) off the avenue's +x side, with an old brick factory chimney (~32 m). Its stand-in box keeps it on the skyline when the district is not live.
3. **Seventh pipicà** in the square.
4. **Three quests:** return a dropped bread bag to the baker; herd a kid's ball across the avenue into the square; bark before the Ferreteria's roller shutter comes all the way down.
5. **Chase:** runaway recycling bins rolling down the avenue's four lanes in two waves; the tree line down the middle is the refuge. Leaving the avenue calls it off without credit.
6. **Goals:** a `fabrica` area ("La Fàbrica") with three goals: the quests, sniffing out the chimney, and the bins.

## Out of scope

- The overall east/west redesign (see the orientation note).
- Moving the metro entrance.

## Success

- `astro check`, unit tests (including `tests/fabrica.test.ts`) and smoke stay green.
- Spawn draw calls unchanged (the district is more than 110 m from spawn, so it does not build there).
- Verified in `?walktest`: the Rambla join walkable, quests completable, chase fair, unloading drops the district's geometry.
