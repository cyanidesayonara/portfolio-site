# `/walk` re-orientation: a miniature of the real town -- design proposal

Status: proposal for Santtu's review (2026-11-28). Nothing in this document is built yet; no code moves until Santtu picks a direction.

## Why

The 3D walk is modeled on a real Catalan seafront town (never named on screen). The sea is -z and the default camera faces it, so **+x is the right-hand side when looking out to sea: southwest, toward Barcelona**, and **-x is northeast, toward Montgat**. Today the port (Marina), Gorg (Canal i Galeria) and the C-31 trench (Ronda i Parc) sit on the -x side, which is the mirror image of the real town. The old oil pier is also on the wrong side of the station (x -48), and so is the old distillery with its chimney. Santtu wants the level to end up as a miniaturized but still recognizable version of the real town, so the overall layout needs to be planned from a real map before more districts are added.

## The real town, measured from the station

Positions below come from OpenStreetMap data (November 2026), projected onto the game's axes with the commuter-rail station as the origin. "Along" is meters along the coast (positive = southwest, toward Barcelona, which is game +x); "inland" is meters away from the sea (game +z). They are rounded and only meant for layout.

| Place | Along (m) | Inland (m) | Notes |
| --- | ---: | ---: | --- |
| Commuter-rail station (game `Estació`) | 0 | 0 | Tracks run along the coast between the town and the beach. |
| The Rambla (seafront promenade street) | -250 .. -620 | ~5 | Runs northeast from the station, alongside the tracks. |
| Carrer de Mar (pedestrian shopping street) | ~-210 | 60 .. 150 | Runs inland from the Rambla. |
| Main market square and its (temporary) market hall | ~-95 | ~270 | Next to the town hall square. |
| Town hall square | ~-300 | ~390 | |
| L2 metro terminus near the town hall | ~-35 | ~540 | The real metro station closest to the center. |
| Museum (Roman city remains) | ~-490 | ~535 | Old town on the hill. |
| Old town church | ~-465 | ~665 | Hilltop; the finish line in the game. |
| Carrer de Sant Pau / Carrer de Prim | -600 .. -700 | 275 .. 340 | The old streets on the Montgat side of the center. |
| Old distillery (anise factory) | ~+415 | ~-50 | Between the tracks and the promenade, at the pier's root. |
| The old oil pier | ~+480 (root) | -250 (shore end) | Runs out to sea from the promenade. |
| A covered neighborhood market | ~+485 | ~465 | Inland, on the Barcelona side of the center. |
| L2 metro stop on the Barcelona side | ~+720 | ~610 | |
| Port / marina (pontoons, breakwater) | +1260 .. +1370 | -230 .. -290 | The beach runs southwest from the pier to the port. |
| Gorg (L2/L10 metro, end of the T5 tram) | ~+1250 | ~655 | Inland of the port. |
| Shopping center | ~+1190 | ~1095 | Just inland of the C-31. |
| C-31 highway | full width | ~1000 (center), 800-950 behind the old town, bends to the coast near Montgat | Runs parallel to the coast and splits the town from the inland neighborhoods. |
| Montgat station | ~-2700 | ~-350 | The coast bends seaward to the northeast. |

What this means for the game:

- **The center is already about right.** The real Carrer de Mar, market square and old town all sit slightly northeast (-x) of the station and climb inland, which is what the game has: `Estació` at x 47, Carrer del Mar at x 0, Plaça del Mercat and Dalt de la Vila straight inland. At roughly quarter scale the hill would sit a bit further toward -x (around x -70), but that is a nice-to-have, not a mismatch.
- **Everything on the -x side is mirrored.** The pier, the distillery, the beach run to the port, the port, Gorg, the shopping center and the C-31 stretch the game uses all belong at +x.
- **La Fàbrica (Phase 9, PR #35) is on the correct side.** At x 96..176 inland of the Rambla it lines up with the real neighborhood market and the streets between the center and Gorg.
- **The horizon is mirrored too.** `horizon.ts` places the big city's skyline "to the southwest (-X)", but southwest is +x. The skyline and the three chimneys belong on the +x side; the -x horizon should show the coast bending seaward toward Montgat and its headland.

## Target layout

Squeezing is fine: the center keeps roughly quarter scale; the run to the port is compressed harder (around one sixth) so the port stays a short walk from the pier. Coordinates assume Phase 9 (La Fàbrica) is merged.

| District | Today | Target | Change |
| --- | --- | --- | --- |
| `seafront` (beach, promenade, boardwalk, pavilions) | x -104..165 | x -104..180 | Promenade and beach extend to the marina at x 180. The beach end at -104 gets an end rail (later it extends toward Montgat, see "Montgat side" below). |
| Old oil pier (`pier` in `seafront.json`) | x -50..-46 | x 128..132 | Moves to the +x side of the station, past the pipicà. Same deck, legs, rise and length. |
| Old distillery and chimney (`town` landmarks) | x -90..-42, z 35..57 | Seaward of the tracks next to the pier root, around x 140..178, z -20..3 | Real factory stands between the tracks and the promenade. Needs the promenade to jog around it; see open questions. The freed `town` slot gets ordinary blocks. |
| `rambla` | x -104..140 (Phase 9) | x -104..180 | The +x end opens into Gorg at x 180 (as the -x end opens into Gorg today). The -x end gets an end rail. |
| `town` (Carrer del Mar) | x -104..96 | unchanged | Only the distillery slot changes. |
| `plaza` (Plaça del Mercat) | x -70..70, z 101..173 | unchanged | Gains the metro entrance (see below). |
| `hill` (Dalt de la Vila) | x -48..48, z 173..256 | unchanged for now | Optional later: slide about 40-60 m toward -x to match the real old town. Expensive (terrain, stairs, Carrer Major join); not needed for recognizability. |
| `fabrica` (La Fàbrica) | x 96..176, z 33.5..104 | unchanged | Already on the correct side. |
| `marina` (El Port) | x -226..-104, z -120..4 | x 180..302, z -120..4 | Mirrored across: `x' = 76 - x`. Its town edge (today x -104) stays the town edge (x 180). |
| `gorg` (Canal i Galeria) | x -226..-104, z 14..108 | x 180..302, z 14..108 | Mirrored the same way; sits inland of the port and +x of La Fàbrica, as in the real town. The tram line keeps running along the coast. |
| `ronda` (Ronda i Parc) | x -226..-104, z 108..196 | x 180..302, z 108..196 | Mirrored the same way. Add the shopping center as a landmark or stand-in on the trench's inland side (real: just inland of the C-31). |
| Metro entrance (`metro`) | Rambla, x -78..-72 | Plaza's +x side by Carrer Major, around x 40..50, z 145..155 | Matches the real L2 terminus (slightly +x of the old town axis, inland of the market square). Signs stay generic ("Metro", "L2", "SORTIDA"). |
| `mapBounds` | x -228..180 (Phase 9) | x -110..306 after the moves; grows again toward -x when the Montgat side is built | See risks. |

Why mirror rather than translate: reflecting x keeps each district's internal relationships. The side that faces the Rambla today keeps facing it, the canal stays on the same side of the arcade relative to town, and the entrances, fingerposts and chase routes keep working without being redesigned. A plain translation would put the marina's far breakwater next to the pier.

How to mirror without breaking text: move positions and negate yaw rotations in code (`x' = 76 - x`, `rotY' = -rotY`, swap `"+x"`/`"-x"` in block `faces`). Never use a negative scale on a group: it flips sign text and triangle winding.

### Montgat side (-x), after the moves

The -x side frees up for what the original expansion plan called "the other side":

- **Sant Pau i Prim:** a district of the old narrow streets northeast of Carrer de Mar (real: 600-700 m northeast, 275-340 m inland; game: around x -104..-200, z 34..150), with its own pipicà, quests and a chase.
- **Beach toward Montgat:** the promenade and beach continue past x -104 with the coast bending slightly seaward. Good place for later beach life.
- Until those are built, the vacated area shows plain stand-in blocks and the Rambla and promenade end at rails at x -104.

## Migration order

Each step lands as its own PR and leaves the game playable. Saved progress (`walk3d-progress-v1`) stores only goal ids, counts, bones and `done` keys such as `gorg:bag` or `marina:mico`; it stores no positions. As long as district ids, goal ids, area ids (`progress.ts` `AREAS`) and quest keys stay the same, every save stays valid through every step. Each PR should keep that explicit: no renamed ids, and a test that loads a saved snapshot from before the move.

0. **Prep, no visible change.** Audit absolute coordinates outside the district modules and route them through the layout data or the `*Geom.ts` constants: the minimap POIs and quest markers in `game3d.ts` (around lines 2567-2597), `boneSpots` (includes two pier spots), the Rambla-to-Gorg fingerpost and walls in `level.ts` (around lines 224-231, 424, 442), `harborWater` (line 274), sand extents, ambient routes in `life.ts`, and positional audio (the Ronda honks). Add a unit test that district bounds do not overlap and each district's POIs and pipicà sit inside its bounds. Needs Phase 9 merged first.
1. **Horizon and pier.** Flip the skyline to +x and add a Montgat-side coastline at -x (`horizon.ts`). Move the pier to x 128..132 and its bone spots; move or extend the swim area if the pier should stay reachable by swimming. Cheap, and immediately more recognizable from spawn.
2. **Marina to +x.** Mirror `marinaGeom.ts`, `marina.ts`, `marinaLife.ts`, the Mico boss and the wake chase to x 180..302. Extend the promenade and beach to x 180; put an end rail on the promenade at x -104. The marina is reached only from the promenade, so it can move on its own.
3. **Gorg and Ronda to +x, together.** Ronda is entered from Gorg, so they move in one step. Open the Rambla's +x end into Gorg at x 180 and close its -x end with a rail; move the tram and the two chases (carts, scooters); add the shopping center landmark beside the trench.
4. **Distillery and chimney** next to the pier root, seaward of the tracks; fill the old `town` slot with blocks.
5. **Metro to the plaza** (Carrer Major's +x side). The 2D street link stays keyed by the `metro` stop id, so only the 3D position changes.
6. **Montgat side:** Sant Pau i Prim district and the beach continuation, as new phases with their own pipicà, quests and chase.
7. **Optional:** slide the hill toward -x.

## Risks and checks

- **Streaming.** `Streamer` in `world.ts` keeps districts live within 80 m, shows stand-ins beyond 100 m, builds as Millie approaches and unloads beyond 170 m. Spawn (x -22, z -3.4) is about 200 m from x 180, so nothing on the new +x side builds at spawn. The new hot spot is the Rambla/promenade junction around x 160..180, where La Fàbrica, Gorg and the marina can all be live at once next to the resident seafront, Rambla and town. Today's worst junction (x -104) has two live districts; this one has three. Measure draw calls and slice times there; if needed, bias Gorg's or the marina's live radius down or leave a few meters of gap at x 176..180.
- **Spawn draw calls `<= 770`.** The pier is part of the resident seafront, so moving it to x 130 changes what is in view at spawn (it is 150 m away and mostly in fog). Re-measure spawn, the pier end and Carrer del Mar after step 1.
- **Metro arrival inside a streamed district.** `?via=metro` spawns at the metro head. After step 5 that is on the plaza, which streams in today; the plaza must build during the loading bar for metro arrivals, and the plaza already measures about 696-724 draw calls. Check the metro arrival against the 770 budget before shipping step 5.
- **Minimap.** `minimap.ts` draws a canvas sized from `mapBounds`. After the moves the width stays close to today's (about 416 m); once the Montgat side is built it grows to about 530 m. Check canvas memory and the enlarged (`M`) view on phones.
- **Collider grid.** Cells are hashed, not bounded, so moving districts needs no grid change, but colliders are tagged by district; each move must keep the tag so unloading still drops them.
- **Tests and test hooks.** `tests/marina.test.ts`, `mico-wake.test.ts`, `gorg.test.ts` and `ronda.test.ts` assert absolute coordinates; they move with the constants. Update `docs/3d-walk-handover.md` (architecture table, `__walk` notes, map plan) in the same PR as each move.
- **2D street.** The 2D street's order of stops is its own design and does not need to mirror the 3D map; only the `metro` and `station` stop links matter, and their ids do not change.

## Naming and privacy

- The town stays unnamed on screen. New sign text stays generic or uses street and place names that appear in many Catalan towns ("Estació", "the old pier", "Port", "Metro / L2", "Carrer de Sant Pau", "Carrer de Prim").
- The hilltop Home stays a generic door. Nothing in this plan places any stop at, or names, a residential street near the church.

## Open questions for Santtu

1. **Mirror or rebuild:** mirror Marina, Gorg and Ronda as described (fast, keeps their content), or rebuild them closer to the real port and Gorg from reference photos?
2. **Distillery:** move it seaward of the tracks next to the pier (true to the real town, but the promenade has to jog around it), or keep it inland at +x next to La Fàbrica's chimney (simpler)?
3. **Metro:** the plaza position (real L2 terminus), or inside Gorg next to the tram stop (the other real L2 stop the map reaches)?
4. **Hill:** leave the hill where it is, or plan the -x slide?
5. **Montgat side:** which comes first after the moves, Sant Pau i Prim or the beach continuation?
