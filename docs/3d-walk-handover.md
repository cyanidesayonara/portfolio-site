# Handover: the 3D walk (`/walk`)

For the next agent picking up the 3D "Path of Leash Resistance" walk on Santtu's portfolio site. Read this first, then `src/scripts/walk/game3d.ts` from the top.

## Ground rules

- **Branch:** everything is on `main` and deployed: PR #4 (Phase 4 hill), PR #5 (fullscreen modes and the train handoff), PR #6 (the metro link between both games), PR #7 (Phase 5), PR #8 (this handover) and PR #9 (swimming, booths, module split, blog posts and CI tests). Branch from an up-to-date `main` for new work, commit as you go and push.
- **Never merge to `main` without Santtu's explicit go-ahead.** Merging deploys the site to GitHub Pages (`.github/workflows/pages-deploy.yml`).
- **Commit messages & PRs:** authored only by Santtu Nykänen. Never add `Co-authored-by` trailers or any AI/agent attribution anywhere (see `AGENTS.md`).
- **Copy:** American English, professional. Santtu is a generalist developer, not a "game maker". Never invent stats or facts.
- **Blog drafts** stay `draft: true` until Santtu approves each one.
- **Keep the town unnamed on screen.** The level is modeled on a real Catalan seafront town, but the game never names it: the station is just "Estació", the pier is "the old pier", the arch says "Carrer del Mar / Eix comercial".
- **Privacy:** Santtu's home is near the hilltop church in the real town. When the map gets there, the "home" stop must be a generic door. Nothing on the site should identify the actual street or house.

## Running and testing

- **Node:** 22.23.4 or newer. On this Windows machine, use `npx.cmd -y node@22.23.5 node_modules/astro/bin/astro.mjs check` and `... build`, `npx.cmd -y node@22.23.5 --test tests\leash.test.ts` (`npm test`), and `npx.cmd -y node@22.23.5 tools/smoke-check.mjs` (`npm run test:smoke`). Both `npm test` and `npm run test:smoke` run in `.github/workflows/pages-deploy.yml`.
- **Preview:** `.claude/launch.json` runs `astro preview` on port 4321. Rebuild `dist/` to see changes, then reload `http://127.0.0.1:4321/walk?walktest`.
- **`?walktest`** adds a perf readout (fps, worst frame, draw calls, triangles, geometries, build time, district, streaming slice time) and `window.__walk`:
  - **State:** `dog`, `human`, `leash`, `level`, `goals`, `quest`, `chase`, `sweeper`, `life`, `riders`, `beachDevils`, `streamer`, `loadStats`, `info`, `dogSwimming`, `humanSwimming`, `booths`.
  - **Driving the game:** `key(code, down)`, `tick(frames)` (runs fixed 60 Hz updates and renders), `teleport(x, z)` (also snaps the camera), `collide(p, r, y)`.
  - **`camera` + `render()`:** aim the camera by hand and render one frame (then `canvas.gl.toDataURL()` in the same task) to inspect distant scenery.
  - **`plaza`:** the Plaça del Mercat runtime (`plazaLife.ts`): `quests()`, `chasing()`, and `debug` (`butcher`, `boti`, `fris`, `paper`, `pigeons`).
  - **Metro:** `/walk?via=metro` arrives at the head of the metro stairs; on the 2D street, `?via=metro&streettest` arrives across the road and `__street.teleport(1750, 375)` puts Millie at its stairs (Enter boards at once in test mode).
  - **Phase 5:** `area` (current goals area) and `strays` (`debug.cats`, `debug.scared`). `?walktest` starts with no saved progress and never saves; add `&walksave` to test saving.
  - **`hill`:** the Dalt de la Vila runtime (`hillLife.ts`): `quests()`, `bubbles()`, and `debug` (`bellRingT`, `miradorT`, `homeDone`, `pigeons`, `parkDog`).
  - **`marina` / `gorg` / `ronda` / `fabrica`:** district runtimes with `quests()`, `busy()`, pickup/drop/bark hooks, and chase debug. Boss/chase hooks: `mico`, `wake`, `dimoni`, `castellers`, `tabalers`, `mosaic`, `senglars`.
  - **Street camera keys:** the default camera looks out to sea, so `W` heads toward the sea (-Z) and `S` inland (+Z); `A` is -X, `D` is +X.
  - **`addTestDistrict()`:** a streamable district far off the map (x 400–460) for exercising build, bake and unload through `streamer.update(x, z)`.
- **Stress test:** previous sessions used a snippet that drives Millie with random keys from many spots and checks for NaNs, leaving the bounds and safety "hops" (`debug.hops`). It isn't saved in the repo; rebuild it from the `__walk` API above. For routes, a small steering helper works well: each 5 frames, hold `KeyW`/`KeyS`/`KeyA`/`KeyD` toward the next waypoint, `tick(5)`, and log `dog.x/z/y`.
- **Manual camera shots:** after moving `camera` by hand, the see-through dither (`fade.ts`) still uses the last game-camera position, so walls can show a speckled hole. Use the game camera (`teleport` + `tick`, `[`/`]` to orbit) for visual checks.
- **Browser pane:** when hidden, rAF is throttled. Timings look worse (the load's `build` readout can show ~7 s instead of ~1.5 s) and screenshots can lag a frame. If Santtu is playing in the preview tab, test in a separate tab instead of reloading theirs.

## Architecture (`src/scripts/walk/`)

| File | What it does |
| --- | --- |
| `game3d.ts` | Core runtime orchestrator: renderer & context-loss recovery, loading bar, focus-gated input (including `Escape` blur), physics at 120 Hz, human AI, NPCs/cyclists/train, cameras, minimap, fullscreen, and `?walktest` hooks. |
| `particles.ts`, `sky.ts`, `goals.ts`, `boothPanels.ts` | Modules extracted from `game3d.ts`: particle/stain pools, sky dome + sun/rim/rain rig, 17-goal checklist + localStorage persistence, and the four boardwalk booth panels (`Coriolis`, `Eat Prey Nap`, `dopepod`, `stemma`). |
| `level.ts` | `buildLevelSteps()`: the level as a generator that yields between sections, so it builds behind a loading bar. It produces geometry, colliders, floor and surface functions, quest and NPC data, and the districts (three resident, plus the streamed plaza and hill). Exports layout constants (`GROUND_Y`, `WATER_Y`, `PIPICA`, `SWIM`, …), `pipicaAt()`, `pipicaBenches`, and `churchLandmark`. |
| `plaza.ts` | Phase 3: Plaça del Mercat as a streamable district (`makePlazaDistrict()`): the square, fountain, trees, newsstand, café terrace, market hall, butcher's stall, second pipicà, Carrer Major's signs and north exit fingerpost, built in small steps with colliders added straight to the grid (tagged `plaza`). `PLAZA` holds the shared positions. |
| `plazaLife.ts` | The plaza at runtime: vendor, grandpa, waiter, dog-park regular and butcher; the newspaper, terrace and fetch quests; the botifarra chase (with simple alley routing). Hooks into `game3d.ts` for pickup/drop, bark, prompts, bubbles and the shared one-chase-at-a-time rule. |
| `terrain.ts` | Phase 4 terrain primitives: `HeightGrid` (bilinear height sampling, flat/blended pads, vertex-colored smooth terrain mesh marked `userData.baked = true`) and `StairDef` (`stairFloor()`, `addStairsToBuilder()` for treads, risers and stepped cheek walls). |
| `hill.ts` | Phase 4: Dalt de la Vila as a streamable hillside district (`makeHillDistrict()`) north of Carrer Major (`z >= 173`), plus `makeChurchLandmark()` (always-visible distant silhouette with fog-haze lerp, hidden when the live district is visible). Includes `hillFloor()`, sloped cobble street, east stone stairs, mid-terrace, `Museu`, third pipicà (`pipica3`), upper west ramp, grand church stairs, `Església` & `Campanar`, Mirador balustrade and a generic wooden Home door. `HILL` holds shared positions. |
| `progress.ts` | Phase 5: goal areas (`AREAS`, `areaOfDistrict()`, `AREA_BONUS`) and saved progress in `localStorage` (`loadProgress()`, `saveProgress()`, `clearProgress()`). |
| `goalDefs.ts` | The goal list (ids, labels, targets, areas) as pure data. Saved progress stores these ids, so never rename or reuse one. |
| `placements.ts` | Absolute positions outside the district modules: the minimap's fixed place and threat markers (looked up from `data/seafront.json` POIs and district logic constants) and the scattered bones, grouped by district. Together with `EDGE` / `HARBOR_WATER` in `level.ts` (the seams where the resident seafront and Rambla meet streamed districts) and the `*_CLAMP` constants in the district geometry modules, this is what the map re-orientation edits when a district moves. `tests/walk-layout.test.ts` checks districts do not overlap, everything sits in its district, and pre-move saves stay valid. |
| `strays.ts` | Phase 5: stray cats on the hill that bolt when Millie charges, gets close or barks; feeds the `cats` goal. |
| `hillLife.ts` | Dalt de la Vila at runtime: museum guide, church caretaker, swinging bronze belfry bell, hilltop pigeons, third pipicà dog, bell-ring bark quest, mirador overlook quest and the generic Home door finish line. |
| `horizon.ts` | Distant silhouettes faded into the fog color: inland hills running down to a headland to the northeast (-x), and the city skyline down the coast to the southwest (+x), behind the three chimneys. |
| `data/seafront.json`, `layout.ts` | Portable town layout data (bounds, zones, tracks, streets, blocks with optional `baseY`, pavilions, landmarks with optional `baseY`/`alwaysVisible`, POIs) plus `buildDistrictBlocksSteps()` and colored `buildDistrictStandin()`. |
| `meshbuilder.ts` | `DirectBuilder`: accumulates non-indexed triangles straight into chunked, vertex-colored material buckets so static blocks and stand-ins need no intermediate `Mesh`/`BoxGeometry` allocations. |
| `world.ts` | `District`, `ColliderGrid` (8 m cells; colliders tagged by district) and `Streamer`: live within 80 m, stand-in beyond 100 m, unload beyond 170 m for streamable districts, with build and bake jobs under a 4 ms per-frame budget. |
| `bake.ts` | `bakeSteps()` merges static meshes into chunked, vertex-colored meshes as a generator, swapping in one step at the end. `collapseRig()` merges the rigid parts of animated models. |
| `life.ts` | Ambient NPCs: dog walkers whose dogs sniff and bark back, joggers, a coconut seller, palas players, swimmers, a paddle boarder, neighbors on chairs, kids playing tag. Reacts to rain and night, hidden beyond 48 m. |
| `models.ts`, `props.ts` | Procedural models: dogs, people (poses, with gait phases that accumulate), bikes and scooters, sweeper, train, street furniture, fingerposts, Tofu, devils. |
| `leash.ts` | A port of the real game's leash: Verlet rope, tug, stretch cap, pole-whirl detector. |
| `fade.ts` | See-through dither for anything between the camera and Millie. Millie and her human are exempt. |
| `minimap.ts` | A top-down plan drawn once from level data, plus live markers. Turns with the follow camera; `M` enlarges it. |
| `hud.ts`, `audio.ts`, `theme.ts`, `textures.ts` | HUD DOM, Web Audio (stemma jukebox stems; recorded CC0 effects from `public/audio/sfx` with positional panning, distance falloff and synth fallback; `N` skips songs), day/rain/night presets, procedural canvas textures. |
| `transit.ts` | Animated R1 commuter-train loading cutscene and sliding-door reveal connecting the 2D street `Estació` stop to 3D `Estació` and back (`?via=train`), plus the metro's own ride (an L2-style car through the tunnel into an underground platform) and its walk-down-the-stairs departure (`?via=metro`). |
| `metro.ts` | The metro entrance at the west end of the Rambla, placed from `metro` in `data/seafront.json`: an open stairwell cut into the Rambla's slabs (`groundAroundMetro()`), stairs down to a lit landing, railings and glass, a lintel and a totem. Signs only say "Metro" and "L2"; the real station stays unnamed. A railing collider keeps Millie at the head, where the `metro` stop links to the 2D street's metro entrance (across the road from its `Estació`). |
| `marinaGeom.ts`, `marina.ts`, `marinaLife.ts` | Phase 6: El Port / Marina as a streamable western harbor (`makeMarinaDistrict()`): stone quays, canal footbridge to Moll de Ponent, pontoons, breakwater lighthouse (Far del Port), fourth pipicà. Runtime: buoy / gull / playmate quests, El Mico de Bronze boss (`micoLogic.ts`, `micoBoss.ts`), Harbor Boat Wake Surge chase (`wakeLogic.ts`). |
| `gorgGeom.ts`, `gorg.ts`, `gorgLogic.ts`, `gorgLife.ts` | Phase 7: Canal i Galeria / Gorg west of the Rambla (`x: -104 .. -220`, `z: 14 .. 102`): turquoise canal & twin bridges, Mediterranean tramway (Parada Canal), Galeria del Canal arcade, Pista streetball + Pavelló, fifth pipicà (Nala), bag/hoop/tram quests, Runaway Shopping Carts chase (`CartRushState`). |
| `fabricaGeom.ts`, `fabrica.ts`, `fabricaLogic.ts`, `fabricaLife.ts` | Phase 9: La Fàbrica past the Rambla's +x end (`x: 96 .. 176`, `z: 33.5 .. 104`): Avinguda de la Fàbrica, chimney square, seventh pipicà, bread/ball/shutter quests (`ShutterState`), runaway recycling bins chase (`BinRushState`; the tree line down the middle is the refuge). Blocks can set `groundFloorSkip` ranges in `data/seafront.json` to keep generated shop fronts off hand-built ones. |
| `rondaGeom.ts`, `ronda.ts`, `rondaLogic.ts`, `rondaLife.ts` | Phase 8: Ronda i Parc north of Gorg (`x: -226 .. -104`, `z: 108 .. 196`): sunken highway trench with ambient traffic, Pont de vianants overpass, urban park + skate ramp, sixth pipicà, deck/bridge/fetch quests, runaway delivery scooters chase (`ScooterRushState`). |
| `telegraph.ts`, `hud.ts` (boss bar) | Shared telegraph pool / feel state for boss and chase telegraphs. `Hud.setBoss` shows a boss bar; call sites guard `setBoss(null)` with a `wasBossBarOn` flag so dormant bosses never clear another boss's bar. |
| `dimoniLogic.ts`, `dimoniBoss.ts` | Boss #2: El Dimoni Gegant on the beach. |
| `castellersLogic.ts`, `castellers.ts` | Interactive Plaça Castellers tower on Plaça del Mercat. |
| `tabalersLogic.ts`, `tabalers.ts` | Marching Rambla Tabalers drum squad (`audio.drum`). |
| `mosaicLogic.ts`, `mosaicBoss.ts` | Boss #3: Roman Mosaic Guardian outside Museu on Dalt de la Vila. |
| `senglarsLogic.ts`, `senglars.ts` | Chase #2: Senglars wild boars down the cobbled hill. |
| `booths.ts` | Boardwalk pavilion live screens (Coriolis, Eat Prey Nap, dopepod, stemma) plus Leash booth 2D/3D mirror and booth Tofu. |

`src/scripts/viewport.ts` sizes both games' window-filling fullscreen mode from `visualViewport`. `src/components/Walk3D.astro` holds the markup, toolbar, panels and all HUD CSS, and lazy-loads `game3d`. `src/pages/walk.astro` is the page. The home page (`src/pages/index.astro`) still uses the 2D `StreetMap.astro`.

## Map expansion plan (where this is heading)

Santtu wants the level to grow, district by district, over the real town:
- **Inland:** from the beach up to the C-31 highway.
- **One side:** the shopping center, Gorg square and the marina with its harbor.
- **Other side:** Carrer de Sant Pau or Carrer de Prim.
- **Old town:** on the hill (the museum and the church). It's the natural finish line.

Squeezing distances (roughly a quarter scale) and skipping side streets is fine. Each district should get its own pipicà, chases and quests. Use reference photos of each area for the look.

| Phase | Status | What |
| --- | --- | --- |
| 0 | done (`e96692d`) | Districts, collider grid, floor and surface dispatch, perf readout. |
| 1 | done (`cab9081`) | Streamer, sliced build behind a loading bar, sliced baking, stand-ins, unloading (tested with the synthetic district). |
| 2 | done | Layout as data: districts described in `data/seafront.json` (zones, street lines, block outlines with heights and facade style, pavilions, landmarks, POIs), with procedural facades (`layout.ts`). The minimap and colliders come from the same data, stand-ins carry block/pavilion/landmark colors, and `DirectBuilder` builds merged geometry directly instead of meshes-then-bake. |
| 3 | done (`fcc520f`) | Plaça del Mercat north of Carrer del Mar: a square with a fountain, a market hall, a second pipicà, Carrer Major (shopping street), three quests (newspaper, terrace, fetch) and the botifarra chase. Generic Catalan look for now; refine from reference photos later. Two goals added (14 in all). |
| 4 | done (merged in PR #4) | Terrain (`HeightGrid`, sloped streets, two stone stairways, upper ramp) and Dalt de la Vila (`hill.ts`, `hillLife.ts`): `Museu`, third pipicà, `Església` & always-visible `Campanar` landmark, Mirador overlook, generic wooden Home door, two new goals (16 in all). Verified in `?walktest` (routes, quests, pipicà, stress test, unloading); see the measured costs below. |
| 5 | done (merged in PR #7) | Goals grouped by area (`progress.ts` `AREAS`: seafront, Rambla and Carrer del Mar, Plaça del Mercat, Dalt de la Vila, anywhere); the goals card shows the area Millie is in, the others summed up, and finishing an area pays +5 bones. Progress (goals, partial counts, bones) is saved in `localStorage` (`walk3d-progress-v1`) with a reset button beside the open goals card. More life: stray cats on the hill (`strays.ts`, a new `cats` goal, 17 goals in all) and pigeons circling the bell tower. |
| 6 | done (merged in PR #20) | Streamable Marina & Breakwater (`marinaGeom.ts`, `marina.ts`, `marinaLife.ts`): quays, pontoons, Far del Port, fourth pipicà, three marina quests. Follow-ups: boardwalk Leash booth mirror & lighting (PR #22); Boss #1 El Mico de Bronze + Chase #1 Harbor Boat Wake Surge (PR #23); Boss #2 El Dimoni Gegant, Plaça Castellers, Rambla Tabalers (PR #24); Boss #3 Roman Mosaic Guardian + Chase #2 Senglars (PR #25). |
| 7 | done (merged in PR #26) | Streamable Canal i Galeria / Gorg west of the Rambla: turquoise canal & twin bridges, tramway, Galeria arcade, Pista + Pavelló, fifth pipicà (Nala), three quests, Runaway Shopping Carts chase. |
| 8 | done (merged in PR #27) | Streamable Ronda i Parc north of Gorg: sunken highway trench with ambient cars/buses, Pont de vianants overpass, urban park + skate ramp, sixth pipicà, three quests (skateboard, timid walker, park fetch), runaway delivery scooters chase. |
| 9 | in progress (`feat/walk-phase9-fabrica`) | Streamable La Fàbrica past the Rambla's +x end (`x 96..176`, `z 33.5..104`): the Rambla is walkable to a new end rail at `x 140`; pedestrianized Avinguda de la Fàbrica with a tree line, Forn / Farmàcia / Ferreteria shop fronts, a chimney square with an old brick factory chimney, seventh pipicà, three quests (bread bag, kid's ball, Ferreteria shutter), runaway recycling bins chase. Draw calls 408-561 around the district once baked; it does not build at spawn. |

**Measured costs (headless SwiftShader `?walktest`):**
- **Build:** ~1.5 s total build time (`LEVEL_STEPS = 53`), longest single step ~54 ms (`Districts`). Streaming slices stay ~0.2 ms at rest and ~1.5 ms max step when streaming `addTestDistrict()`.
- **Baking:** the three districts bake during the loading bar; town blocks and `addTestDistrict()` build chunked merged geometry directly via `DirectBuilder`.
- **Draw calls:** ~589–761 depending on the view (642 at start, 761 in Carrer del Mar, 172 facing sea from the pier end with stand-ins, 634–671 looking back toward land from the pier end); ~696 on Plaça del Mercat.
- **Hill (Phase 4):** ~54k triangles of its own; 724 draw calls looking inland from the north passage (plaza and hill both live), ~408 on the church square, 141 from the pier end with the hill unloaded. Longest streaming step ~7.3 ms (`bake hill`), longest slice ~11 ms (one step over the 4 ms budget); it builds within ~24 streamer updates. Unloading drops ~100 geometries.
- **Plaza streaming:** 30 build steps, longest ~2.7 ms cold (plane trees share one bark material and sign textures are spread over steps); it streams in during the first seconds of play, not during the loading screen.
- **Godot:** if the town outgrows the web, the plan is to move PoLR 2 there; keep layout data portable for that.

## Next up

0. **Re-orient the map to match the real town (redesign, Santtu 2026-11-28):** the goal is a miniaturized but still recognizable version of the real town. The sea is -z and the default camera faces it, so +x is southwest (toward Barcelona) and -x is northeast (toward Montgat). The port/marina, Gorg and the old oil pier lie southwest of the station along the tracks, so they belong on the +x side; today Marina, Gorg and Ronda are on -x, which is backwards. Plan the overall layout from a real map before adding more districts. La Fàbrica (Phase 9) is named neutrally and fits the +x side. The agreed plan is `docs/superpowers/specs/2026-11-28-walk-reorientation-design.md` (PR #36). Step 0 (prep, no visible change) routes the seams, minimap markers, bones and safety clamps through `level.ts` `EDGE`, `placements.ts` and the district `*_CLAMP` constants; step 1 moves the old pier to x 165..169 (with the bronze monkey and the fish bucket), the old distillery and its chimney between the tracks and the promenade beside it (`seafront` landmarks), flips the horizon, and runs the promenade, boardwalk, beach and railway on to an end rail and rock groin at x 200. Next is step 2 (the hill and the Pompeu Fabra metro entrance).
1. **Move the metro entrance (later):** it sits at the west end of the Rambla (`metro` in `data/seafront.json`; the 2D street has its own across the road from `Estació`). Santtu wants it deeper in town, where the real station is, once the level spreads that far. All its signs stay generic ("Metro", "L2", "SORTIDA").
2. **Test on real phones and tablets:** fullscreen modes, touch buttons, audio by ear. Nothing has been verified on hardware yet. Also check that real fullscreen comes back on the first key press or tap after the train (automation can't produce a real user gesture).
3. **Plaça del Mercat and Dalt de la Vila reference pass:** cream/ochre renders and dark green shutters on plaza and hill blocks; Noucentista market hall (arched porch, round windows, wavy parapet); ochre church with pale portal and octagon campanar + tile cupola. Stall glimpse only — no walkable market interior.
4. **Sounds (done):** dig / pee / flutter / firework / honk / howl / whine clips in `public/audio/sfx` (see `CREDITS.md`) are wired in the 3D walk; dig scrapes while digging and Ronda trench traffic honks occasionally. The 2D street keeps its synthesized 8-bit effects on purpose (it now also scrapes while digging).
5. **Share the audio findings with the real Path of Leash Resistance game:** sources and processing are in `public/audio/sfx/CREDITS.md`.
6. **Next phases:** after the re-orientation above; continuous texture, lighting, NPC animation and booth polish while keeping spawn draw calls `<= 770`. Metro relocation deeper inland once the map reaches the real station area.

## Polish backlog (from Santtu's playtesting)

- **Done (swimming, whirl, progress & plaza/hill polish):**
  - **Swimming:** past the shoreline (`SHORE_Z` in `level.ts`), the seabed slopes down faster (`0.095`) so Millie (`SWIM_DEPTH`) and her human (`HUMAN_SWIM_DEPTH`) reach swimming depth a short walk from shore, with dog-paddle and breaststroke animations (`models.ts`), wakes, and full animated `makePerson` NPC swimmers (`life.ts`).
  - **Leash whirl direction:** `Leash.poleWinding()` and contact-aware `ends()` (`leash.ts`) pair with `-Math.sign(coil)` unwinding in `startWhirl()` and active-whirl gating on `WhirlDetector` (`game3d.ts`) so the human always unwinds around the pole instead of spinning into tighter wraps.
  - **Saved progress:** `walk3d-progress-v1` (`progress.ts`) persists completed quest, find, hurdle, stray cat, and Home finish keys (`done[]`, compatible with older v1 saves) so repeated favors and the Home door bones cannot be double-counted after reload.
  - **Plaça & hill polish:** added a market clock gable, east flower/produce stall and florist, terracotta planters, fountain/mirador/church-square seated locals, extra pedestrian loops, church threshold and gable cross; wired plaza and hilltop pigeons to the `birds` goal (`plazaLife.ts`, `hillLife.ts`); and raised hillside retaining/cheek wall colliders (`terrain.ts`, `hill.ts`) to prevent jumping onto the grass bank behind the Museu.
- **Done (booths, idling boardwalk screens, non-blocking mobile HUD & 8/16-bit 2D street):**
  - **Boardwalk pavilions:** added `Eat Prey Nap` (`x: -57`) and `dopepod` (`x: -72`) pavilions to `data/seafront.json` and `level.ts`; mounted live idling screens across all boardwalk pavilions (`booths.ts`: `EatPreyNapSim`, `DopepodSim`, `createBoardwalkBoothScreens()`), alongside a booth Tofu (`makeTofu()`) at `level.boothTofuAnchor` who stalks and leaps at the mouse on screen and raycast screen clicks.
  - **Non-blocking mobile booth controllers:** opening any booth (`Coriolis`, `stemma`, `Eat Prey Nap`, `dopepod`) toggles `.panel-open` on the stage (hiding overlapping `.touch`, `.toolbar`, `.prompts`, and `.minimap` layers), docks panels as compact bottom drawers on small viewports, and frames the 3D screen above the drawer via `frameBooth()` camera pull + look offset (`Walk3D.astro`, `game3d.ts`).
  - **2D street retro polish:** added `dopepod` and `eat-prey-nap` stops (`ui.ts`), dark CRT bezels (`world.ts`), live 8/16-bit shop-window animations plus a pouncing pixel Tofu outside `Eat Prey Nap`, and a compact pixelated mini-booth drawer (`X` / `TRY`) in `StreetMap.astro` and `street/game.ts`.

- **Metro entrance (PR #6):** Santtu would like it deeper in town, where the real station is, once the level spreads out that far; fine where it is for now.

- **Done (PR #3 follow-up):** rope segments are pushed out of poles to the side they were on last frame (`Leash.pushSegment()`), so fast pulls no longer tunnel through thin poles; the pole whirl spins the way the rope pulls the hand around the pole (`startWhirl()`); the old green horizon slab is replaced by two hazy inland ridges and a distant city skyline down the coast (`horizon.ts`, faded into the current fog color each frame; camera far plane is 1800).
- **Fullscreen modes and the train (Santtu's playtest):** both games have two modes, "Fill window" (the `immersive` class, works everywhere) and "Fullscreen" (also asks the browser for real fullscreen; hidden where the API is missing). The train is a page change, which always drops real fullscreen and focus, so the mode rides along as `?fs=window|screen`: the arriving page fills the window at once, takes keyboard focus, and upgrades to real fullscreen on the first key or tap (browsers only allow it from a user gesture). The 3D toolbar wraps before the minimap (`right: 192px`). The upgrade-on-key step needs a real key press, so it has not been verified by automation.
- **Leash correction:** when the human's patience first drops low, a toast warns that pulling wears it down; when it runs out, the human says so, the shout reads "YANKED BACK", and a toast explains it the first two times (`patienceWarned`, `corrections` in `game3d.ts`; `hud.toast()` takes an optional time to live).
- **Mobile fullscreen:** both games size their window-filling mode from `visualViewport` (`src/scripts/viewport.ts`, `--vv-h` / `--vv-top`) instead of `100dvh`, which phone browsers could report taller than the visible area (bottom touch controls cut off). On short landscape screens the 3D minimap shrinks and moves up so it no longer covers the action buttons. Still not tested on real phone hardware.
- Articulated human knees, hip/shoulder counter-rotation, `selfie` pose, and multi-segment dog tail wag are in; other models and animations can still use refinement.
- Touch pinch-to-zoom, 1-finger canvas orbit, a compact 2×2 core touch button pad, tappable contextual prompt pills, and a toolbar Restart button are implemented (also added Restart, drag-to-steer, touch hold-prevention, and contextual `GO IN` to the home page's 2D street); not yet verified on real phone hardware (along with true browser fullscreen and audio by ear).
- Stand-ins now use layout facade, roof, pavilion accent, and landmark colors/silhouettes (visually verified from the pier in headless Chrome).
- The home page still runs the 2D map. Santtu wants the 3D walk there once it's solid (`<Walk3D lazy />`, ideally loading only the seafront district).

## Release checklist (first merge of PR #1)

1. Santtu says to merge. Nothing merges without that.
2. `astro check` and `astro build` are clean, and the PR's `build` check passes.
3. Santtu has confirmed the `/how-i-build` description of the AI workflow.
4. The blog drafts stay drafts unless Santtu approves specific ones (one post is already published).
5. After merging, check the deployed site (home, `/walk`, the project pages, the blog) on GitHub Pages.
