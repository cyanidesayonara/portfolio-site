# `/walk` re-orientation: a miniature of the real town -- design

Status: direction agreed with Santtu on 2026-11-28 (see "Decisions"). No code has moved yet; each migration step below lands as its own PR.

## Why

The 3D walk is modeled on a real Catalan seafront town (never named on screen). The sea is -z and the default camera faces it, so **+x is the right-hand side when looking out to sea: southwest, toward Barcelona**, and **-x is northeast, toward Montgat**. Today the port (Marina), Gorg (Canal i Galeria) and the C-31 stretch (Ronda i Parc) sit on the -x side, which is the mirror image of the real town. The old oil pier, the old distillery and the horizon's city skyline are mirrored as well. The goal is a miniaturized but still recognizable version of the real town: not photorealistic, but where possible each place should look like the real thing.

## Decisions (Santtu, 2026-11-28)

1. **Rebuild, not mirror.** Marina, Gorg and Ronda are rebuilt at their real positions and in their real shapes, from the map and reference photos, keeping their gameplay (quests, chases, bosses, pipicàs and goal ids). A mirror would be quicker but would keep invented shapes in the wrong places.
2. **Distillery in its real position:** seaward of the tracks, a little way toward Barcelona from the station, at the old pier's root.
3. **Realistic metro:** three L2 entrances where the real stations are (Pompeu Fabra near the town hall, Pep Ventura, Gorg), and maybe a fourth (Santa Coloma) later.
4. **Move the hill** to its real position (it is too far toward +x today).
5. **Montgat side order:** left to this design (see step 6 of the migration).

## The real town, measured from the station

Positions come from OpenStreetMap data (November 2026), projected onto the game's axes with the commuter-rail station as the origin. "Along" is meters along the coast (positive = southwest, toward Barcelona = game +x); "inland" is meters away from the sea (game +z). Rounded; only meant for layout. "Game" is the target position under the scale below.

| Place | Along (m) | Inland (m) | Game x, z | Notes |
| --- | ---: | ---: | --- | --- |
| Commuter-rail station (`Estació`) | 0 | 0 | 47, 17 (unchanged) | Tracks run along the coast between the town and the beach. |
| The Rambla | -250 .. -620 | ~5 | | Runs northeast from the station. The game's Rambla is already a squeezed stand-in. |
| Carrer de Mar | ~-210 | 60 .. 150 | x 0 (unchanged) | Pedestrian shopping street inland from the Rambla. |
| Main market square and market hall | ~-95 | ~270 | ~23, 90 | The game's Plaça del Mercat (x -70..70, z 101..173) already covers it. |
| Town hall square | ~-300 | ~390 | ~-28, 130 | |
| **L2 Pompeu Fabra** (terminus) | ~-35 | ~540 | **~38, 180** | Inland of Carrer Major's +x half, once the hill moves. |
| Museum (Roman city remains) | ~-490 | ~535 | ~-76, 179 | Old town on the hill. |
| Old town church | ~-465 | ~665 | ~-70, 221 | Hilltop finish line. |
| Carrer de Sant Pau / Carrer de Prim | -600 .. -700 | 275 .. 340 | ~-103 .. -128, 92 .. 113 | Old streets on the Montgat side of the center. |
| Beach and promenade, Montgat side | -700 .. -1050 | | ~-128 .. -171 | Continues toward Montgat (station ~2700 m away). |
| **Old distillery** (anise factory) | ~+415 | ~-50 | **~151, -16** | Between the tracks and the promenade. |
| **Old oil pier** | ~+480 (root) | -250 (shore end) | **~167, root at the promenade** | Runs out to sea from the promenade beside the distillery. |
| Covered neighborhood market | ~+485 | ~465 | ~168, 155 | Inland of La Fàbrica. |
| **L2 Pep Ventura** | ~+720 | ~610 | **~225, 203** | |
| Port canal (water) | ~+1210 | ~120 | ~286, 40 | A real canal runs inland from the port basin; the game's canal fits here. |
| Small park pond | ~+1210 | ~290 | ~286, 98 | Possible model for a pond park near the canal. |
| Port / marina pontoons, breakwater | +1260 .. +1370 | -230 .. -290 | ~292 .. 306, -76 .. -96 | The beach runs southwest from the pier to the port. |
| **L2/L10 Gorg** and the T5 tram terminus | ~+1250 .. +1320 | ~650 | **~291 .. 299, 217** | The tram continues southwest along the coast toward Sant Roc. |
| Shopping center | ~+1190 | ~1095 | ~283, 365 | Just inland of the C-31, next to a small hill. |
| C-31 highway | full width | ~1000 (center and +x), 800-950 behind the old town | z ~330 .. 345 at +x, ~300 behind the hill | OSM marks many short bridge segments where it crosses streets (no tunnel or cutting tags), so here it may run at grade or raised rather than sunken. Confirm with photos before modeling. |
| Santa Coloma metro | ~+1630 | ~3070 | off the map | Far inland across the C-31; it is an L1 station, not L2. |

### Scale

The current center already fits roughly: **game x = 47 + along / 4** within 700 m of the station, then **one eighth** beyond that (so the port is not a three-minute walk); **game z = inland / 3**. Every target position in this document comes from that rule, then nudged so districts tile cleanly.

What this means:

- **Keep:** Estació, the Rambla, Carrer del Mar, Plaça del Mercat, the beach pipicà, the boardwalk pavilions and La Fàbrica (Phase 9, PR #35) are on the correct side and roughly in scale.
- **Move:** the old pier, the distillery and its chimney, the hill, the metro, Marina, Gorg and Ronda, and the horizon skyline.

## Target layout

Coordinates assume Phase 9 (La Fàbrica) is merged. Bounds are rough and will be tightened in each step's PR.

| District | Today | Target | What it becomes |
| --- | --- | --- | --- |
| `seafront` | x -104..165 | x -104..272 | The beach and promenade continue past the pier to the port. A second beach stretch (between pier and port) gets its own life spots. |
| Old oil pier | x -50..-46 | x 165..169 | Same deck, legs and length; its root meets the promenade beside the distillery. |
| Old distillery + chimney | in `town`, x -90..-42, z 35..57 | Seaward of the tracks, about x 138..162, z -20..3 | Modeled after the real factory (long low industrial halls, tall brick chimney). The promenade bends seaward around it. The freed `town` slot gets ordinary blocks. |
| `rambla` | x -104..140 | x -104..140 (unchanged) | The -x end, which opens into Gorg today, gets an end rail until the Montgat side is built. |
| `town` | x -104..96 | unchanged | Only the distillery slot changes. |
| `plaza` | x -70..70, z 101..173 | unchanged | Carrer Major's -x end becomes the way up to the moved hill. |
| `hill` | x -48..48, z 173..256 | about x -120..-24, z 173..256 | Museum and church nearly on the same x, museum lower (real: museum slightly toward -x of the church and lower). The climb starts from Carrer Major's -x end. The always-visible church landmark moves with it. |
| Pompeu Fabra metro | Rambla, x -78..-72 | about x 30..46, z 175..185 | In the slot the hill frees behind Carrer Major's +x half. Replaces today's Rambla entrance. |
| `fabrica` | x 96..176, z 33.5..104 | unchanged | Later: grow inland toward the covered neighborhood market (~168, 155). |
| New fill district (Pep Ventura area; on-screen name to pick, not the station name) | -- | about x 176..260, z 104..240 | Plain residential blocks between La Fàbrica and Gorg, with the Pep Ventura metro entrance (~225, 203). Mostly stand-ins at first. |
| `marina` (rebuilt) | x -226..-104, z -120..4 | about x 272..350, z -130..4 | The real port: basin with finger pontoons, quays, a breakwater with a light at its tip, the canal mouth. Keeps the Mico boss, the wake chase, the fourth pipicà and its three quests. |
| `gorg` (rebuilt, split in two) | x -226..-104, z 14..108 | **Canal:** about x 260..340, z 4..120. **Gorg:** about x 260..340, z 120..260 | Canal: the real port canal with its bridges and waterfront arcade (today's canal, twin bridges, Galeria and bag quest). Gorg: the metro entrance, the T5 tram terminus, the streetball court and Pavelló, fifth pipicà, hoop and tram quests, the cart chase. The `gorg` id stays on whichever half keeps the existing quests; the other half gets a new id. |
| `ronda` (rebuilt) | x -226..-104, z 108..196 | about x 200..340, z 290..360 | The C-31 edge of town: the highway (raised or at grade, per photos) with the footbridge, the park and skate area, sixth pipicà, the scooter chase. The shopping center stands just beyond (~283, 365) as a landmark or stand-in. |
| C-31 behind the hill | -- | z ~300, x -200..200 | Distant scenery (horizon or stand-in), not walkable at first. |
| `mapBounds` | x -228..180, z -134..256 | about x -200..352, z -134..380 | Grows as each step lands. |

### The metro line

- **Entrances:** Pompeu Fabra (plaza, behind Carrer Major), Pep Ventura (between La Fàbrica and Gorg), Gorg (next to the tram terminus). Signs stay generic: "Metro", "L2", "SORTIDA". The real station names stay off screen, because together they would identify the town (the same reason `metro.ts` keeps today's station unnamed). The picker and the line map in the car use the game's own district names instead ("Plaça del Mercat", "La Fàbrica", "Canal i Galeria") or plain line dots.
- **Riding:** taking the metro at any entrance offers the other two 3D stations or the 2D street. A short ride reuses the existing L2 car and tunnel cutscene in `transit.ts`, then the arrival walk up the stairs.
- **Arrival:** `?via=metro` gains a station id such as `&at=plaza` (default: the plaza entrance, which is the 2D street's link). Arriving at a station inside a streamed district needs that district built during the loading bar.
- **Santa Coloma (later):** it is on L1 in reality, so it would be a different line color and a transfer, or a separate trip from the 2D street. Off the map for now.

### Montgat side (-x)

Built last, after the +x side and the hill are in place:

1. **Sant Pau i Prim** (about x -104..-200, z 34..170): the old narrow streets northeast of Carrer de Mar, at the foot of the moved hill, so it also gives a second way up. Own pipicà, quests and chase. This comes first because it ties the moved hill, the town and the Rambla together.
2. **Beach toward Montgat** (seafront past x -104, coast bending seaward): beach life, maybe the Dimoni boss's real home turf.

Until then, the Rambla and promenade end at rails at x -104 and the vacated area shows stand-in blocks.

## Migration order

Each step is its own PR and leaves the game playable. Saved progress (`walk3d-progress-v1`) stores only goal ids, counts, bones and `done` keys such as `gorg:bag` or `marina:mico`; it stores no positions. As long as district ids, goal ids, area ids (`progress.ts` `AREAS`) and quest keys stay the same, every save stays valid. Each PR adds a test that loads a saved snapshot from before the move. New districts get new ids and new goals; they never reuse old ones.

0. **Prep, no visible change.** Route absolute coordinates outside the district modules through layout data or `*Geom.ts` constants: minimap POIs and quest markers in `game3d.ts` (around lines 2567-2597), `boneSpots` (two pier spots), the Rambla-to-Gorg fingerpost and walls in `level.ts` (around lines 224-231, 424, 442), `harborWater` (line 274), sand extents, ambient routes in `life.ts`, positional audio (the Ronda honks). Add a test that district bounds do not overlap and each district's POIs and pipicà sit inside its bounds. Gather reference photos for the port, canal, Gorg, the C-31 and the distillery.
1. **Seafront: horizon, pier and distillery.** Flip the skyline to +x and add a Montgat-side coastline at -x (`horizon.ts`). Move the pier to x 165..169 and the distillery and chimney seaward of the tracks; extend the beach and promenade toward the port. Cheap and immediately more recognizable from spawn.
2. **Hill and Pompeu Fabra.** Move Dalt de la Vila toward -x, reconnect the climb at Carrer Major's -x end, and move the metro entrance into the freed slot. Keeps the Home door generic (see Privacy).
3. **Port.** Rebuild `marina` at x 272..350 from photos; it is reached only from the promenade, so it can move on its own. The promenade end at x -104 gets a rail.
4. **Canal, Gorg, Pep Ventura and Ronda together.** Ronda is entered from Gorg today, so they move in one release (one PR or several merged together). Rebuild the canal and Gorg, add the Pep Ventura fill district and the C-31 edge with the shopping center, add the Pep Ventura and Gorg metro entrances and the station picker, and close the Rambla's -x end.
5. **Montgat side:** Sant Pau i Prim, then the beach toward Montgat.
6. **Optional:** C-31 scenery behind the hill, La Fàbrica's inland growth toward the covered market, Santa Coloma.

## Risks and checks

- **Streaming.** `Streamer` in `world.ts` keeps districts live within 80 m, shows stand-ins beyond 100 m and unloads beyond 170 m. Spawn (x -22, z -3.4) is more than 170 m from everything new on the +x side, so spawn is unaffected there. New hot spots: the pier root and distillery (resident seafront next to La Fàbrica), and the canal / Gorg / Pep Ventura junction, where three streamed districts meet. Measure draw calls and slice times at each junction; bias live radii down if needed.
- **Spawn draw calls `<= 770`.** The pier and distillery are part of the resident seafront, so they change what is drawn at spawn (they are 190 m away, mostly in fog). Re-measure spawn, the pier end and Carrer del Mar after step 1.
- **Metro arrivals in streamed districts.** All three entrances sit in streamed districts (plaza, Pep Ventura, Gorg). Each arrival must build its district during the loading bar, and the plaza already measures about 696-724 draw calls. Check every arrival against the 770 budget.
- **Hill move.** The hill has the most hand-placed geometry (terrain, stairs, retaining walls, stray-cat routes, the Senglars chase down the hill, the Mosaic boss outside the Museu). Move it as one offset applied to `HILL` and the terrain grid, then re-run the routes and the stress test.
- **Map size.** The map grows to about 550 x 515 m. `minimap.ts` sizes its canvas from `mapBounds`; check memory and the enlarged (`M`) view on phones, and lower its pixels per meter if needed.
- **Walking distances.** Spawn to the port is about 320 m. The metro picker and the promenade make that fine, but each district should still be reachable on foot.
- **Collider grid.** Cells are hashed, not bounded, so moves need no grid change; colliders must keep their district tag so unloading still drops them.
- **Tests and docs.** `tests/marina.test.ts`, `mico-wake.test.ts`, `gorg.test.ts` and `ronda.test.ts` assert absolute coordinates and change with each rebuild. Update `docs/3d-walk-handover.md` in the same PR as each step.
- **2D street.** Its stop order is its own design. Only the `metro` and `station` links matter; Pompeu Fabra becomes the metro's 3D end of that link.

## Naming and privacy

- The town stays unnamed on screen. Sign text stays generic or uses names common across Catalan towns ("Estació", "the old pier", "Port", "Metro / L2", "Carrer de Sant Pau", "Carrer de Prim").
- Moving the hill to its real position must not make Home more identifying. The Home door stays a generic door at an arbitrary spot on the hilltop, not modeled on any real street, building or doorway near the church.
