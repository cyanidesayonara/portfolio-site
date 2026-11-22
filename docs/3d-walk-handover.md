# Handover: the 3D walk (`/walk`)

For the next agent picking up the 3D "Path of Leash Resistance" walk on Santtu's portfolio site. Read this first, then `src/scripts/walk/game3d.ts` from the top.

## Ground rules

- **Branch:** PR #1 (`redesign-astro`), PR #2 (`walk-phase2-polish`), and PR #3 (`feat/transit-cutscene-polish`, merged at `f4523a4` and deployed) have all landed on `main`. `feat/walk-phase4-hill` (open PR) holds Phase 4 (`Dalt de la Vila`, terrain grid, slopes, stairs, church landmark, and the generic hilltop home finish). Continue on `feat/walk-phase4-hill` until Santtu merges it, or branch from it. Commit as you go and push.
- **Never merge to `main` without Santtu's explicit go-ahead.** Merging deploys the site to GitHub Pages (`.github/workflows/pages-deploy.yml`).
- **Commit messages & PRs:** authored only by Santtu Nykänen. Never add `Co-authored-by` trailers or any AI/agent attribution anywhere (see `AGENTS.md`).
- **Copy:** American English, professional. Santtu is a generalist developer, not a "game maker". Never invent stats or facts.
- **Blog drafts** stay `draft: true` until Santtu approves each one.
- **Keep the town unnamed on screen.** The level is modeled on a real Catalan seafront town, but the game never names it: the station is just "Estació", the pier is "the old pier", the arch says "Carrer del Mar / Eix comercial".
- **Privacy:** Santtu's home is near the hilltop church in the real town. When the map gets there, the "home" stop must be a generic door. Nothing on the site should identify the actual street or house.

## Running and testing

- **Node:** 22.23.4 or newer. On this Windows machine, use `npx.cmd -y node@22.23.5 node_modules/astro/bin/astro.mjs check` and `... build`.
- **Preview:** `.claude/launch.json` runs `astro preview` on port 4321. Rebuild `dist/` to see changes, then reload `http://127.0.0.1:4321/walk?walktest`.
- **`?walktest`** adds a perf readout (fps, worst frame, draw calls, triangles, geometries, build time, district, streaming slice time) and `window.__walk`:
  - **State:** `dog`, `human`, `leash`, `level`, `goals`, `quest`, `chase`, `sweeper`, `life`, `riders`, `beachDevils`, `streamer`, `loadStats`, `info`.
  - **Driving the game:** `key(code, down)`, `tick(frames)` (runs fixed 60 Hz updates and renders), `teleport(x, z)` (also snaps the camera), `collide(p, r, y)`.
  - **`camera` + `render()`:** aim the camera by hand and render one frame (then `canvas.gl.toDataURL()` in the same task) to inspect distant scenery.
  - **`plaza`:** the Plaça del Mercat runtime (`plazaLife.ts`): `quests()`, `chasing()`, and `debug` (`butcher`, `boti`, `fris`, `paper`, `pigeons`).
  - **`hill`:** the Dalt de la Vila runtime (`hillLife.ts`): `quests()`, `bubbles()`, and `debug` (`bellRingT`, `miradorT`, `homeDone`, `pigeons`, `parkDog`).
  - **Street camera keys:** the default camera looks out to sea, so `W` heads toward the sea (-Z) and `S` inland (+Z); `A` is -X, `D` is +X.
  - **`addTestDistrict()`:** a streamable district far off the map (x 400–460) for exercising build, bake and unload through `streamer.update(x, z)`.
- **Stress test:** previous sessions used a snippet that drives Millie with random keys from many spots and checks for NaNs, leaving the bounds and safety "hops" (`debug.hops`). It isn't saved in the repo; rebuild it from the `__walk` API above. For routes, a small steering helper works well: each 5 frames, hold `KeyW`/`KeyS`/`KeyA`/`KeyD` toward the next waypoint, `tick(5)`, and log `dog.x/z/y`.
- **Manual camera shots:** after moving `camera` by hand, the see-through dither (`fade.ts`) still uses the last game-camera position, so walls can show a speckled hole. Use the game camera (`teleport` + `tick`, `[`/`]` to orbit) for visual checks.
- **Browser pane:** when hidden, rAF is throttled. Timings look worse (the load's `build` readout can show ~7 s instead of ~1.5 s) and screenshots can lag a frame. If Santtu is playing in the preview tab, test in a separate tab instead of reloading theirs.

## Architecture (`src/scripts/walk/`)

| File | What it does |
| --- | --- |
| `game3d.ts` | Everything at runtime: renderer, loading bar, input (focus-gated), physics at 120 Hz, the human's AI, leash, goals, quests, chases (La Neteja, correfoc, Dimoni), NPC walkers and cyclists, train, cameras (street, follow and overhead; wheel and `-`/`=` zoom; drag and `[`/`]` orbit), HUD wiring, minimap, theme and sky, fullscreen, the `?walktest` hooks. |
| `level.ts` | `buildLevelSteps()`: the level as a generator that yields between sections, so it builds behind a loading bar. It produces geometry, colliders, floor and surface functions, quest and NPC data, and the districts (three resident, plus the streamed plaza and hill). Exports layout constants (`GROUND_Y`, `WATER_Y`, `PIPICA`, `SWIM`, …), `pipicaAt()`, `pipicaBenches`, and `churchLandmark`. |
| `plaza.ts` | Phase 3: Plaça del Mercat as a streamable district (`makePlazaDistrict()`): the square, fountain, trees, newsstand, café terrace, market hall, butcher's stall, second pipicà, Carrer Major's signs and north exit fingerpost, built in small steps with colliders added straight to the grid (tagged `plaza`). `PLAZA` holds the shared positions. |
| `plazaLife.ts` | The plaza at runtime: vendor, grandpa, waiter, dog-park regular and butcher; the newspaper, terrace and fetch quests; the botifarra chase (with simple alley routing). Hooks into `game3d.ts` for pickup/drop, bark, prompts, bubbles and the shared one-chase-at-a-time rule. |
| `terrain.ts` | Phase 4 terrain primitives: `HeightGrid` (bilinear height sampling, flat/blended pads, vertex-colored smooth terrain mesh marked `userData.baked = true`) and `StairDef` (`stairFloor()`, `addStairsToBuilder()` for treads, risers and stepped cheek walls). |
| `hill.ts` | Phase 4: Dalt de la Vila as a streamable hillside district (`makeHillDistrict()`) north of Carrer Major (`z >= 173`), plus `makeChurchLandmark()` (always-visible distant silhouette with fog-haze lerp, hidden when the live district is visible). Includes `hillFloor()`, sloped cobble street, east stone stairs, mid-terrace, `Museu`, third pipicà (`pipica3`), upper west ramp, grand church stairs, `Església` & `Campanar`, Mirador balustrade and a generic wooden Home door. `HILL` holds shared positions. |
| `hillLife.ts` | Dalt de la Vila at runtime: museum guide, church caretaker, swinging bronze belfry bell, hilltop pigeons, third pipicà dog, bell-ring bark quest, mirador overlook quest and the generic Home door finish line. |
| `horizon.ts` | Distant silhouettes faded into the fog color: inland hills and the city skyline down the coast. |
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
| `transit.ts` | Animated R1 commuter-train loading cutscene and sliding-door reveal connecting the 2D street `Estació` stop to 3D `Estació` and back (`?via=train`). |

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
| 4 | done (PR #4, awaiting merge) | Terrain (`HeightGrid`, sloped streets, two stone stairways, upper ramp) and Dalt de la Vila (`hill.ts`, `hillLife.ts`): `Museu`, third pipicà, `Església` & always-visible `Campanar` landmark, Mirador overlook, generic wooden Home door, two new goals (16 in all). Verified in `?walktest` (routes, quests, pipicà, stress test, unloading); see the measured costs below. |
| 5 | | Goals per district, progress saved in the browser, more life. |

**Measured costs (headless SwiftShader `?walktest`):**
- **Build:** ~1.5 s total build time (`LEVEL_STEPS = 53`), longest single step ~54 ms (`Districts`). Streaming slices stay ~0.2 ms at rest and ~1.5 ms max step when streaming `addTestDistrict()`.
- **Baking:** the three districts bake during the loading bar; town blocks and `addTestDistrict()` build chunked merged geometry directly via `DirectBuilder`.
- **Draw calls:** ~589–761 depending on the view (642 at start, 761 in Carrer del Mar, 172 facing sea from the pier end with stand-ins, 634–671 looking back toward land from the pier end); ~696 on Plaça del Mercat.
- **Hill (Phase 4):** ~54k triangles of its own; 724 draw calls looking inland from the north passage (plaza and hill both live), ~408 on the church square, 141 from the pier end with the hill unloaded. Longest streaming step ~7.3 ms (`bake hill`), longest slice ~11 ms (one step over the 4 ms budget); it builds within ~24 streamer updates. Unloading drops ~100 geometries.
- **Plaza streaming:** 30 build steps, longest ~2.7 ms cold (plane trees share one bark material and sign textures are spread over steps); it streams in during the first seconds of play, not during the loading screen.
- **Godot:** if the town outgrows the web, the plan is to move PoLR 2 there; keep layout data portable for that.

## Next up

1. **Review and merge the Phase 4 PR (#4)** once Santtu gives the go-ahead. Browser verification is done: no console errors; all three climbs (lower street, east stairs, west ramp, church stairs) are smooth in both directions with `debug.hops === 0`; bell, mirador and Home door quests and both hill goals complete; `pipica3` off-leash works (its bench was moved beside the gate, where it no longer blocks the exit, and the human can reach the seat); a random-input stress test from 14 hill spots found no NaNs, falls or hops; the hill unloads from the pier and `churchLandmark` swaps in. Known quirks: the grass bank behind the Museu is climbable up to the top-square wall (a harmless dead end), scattering the hilltop or plaza pigeons does not count toward the `birds` goal, and the `bake hill` step (~7 ms) is the heaviest streaming step so far.
2. **Test on real phones and tablets:** fullscreen controls, touch buttons, audio by ear. Nothing has been verified on hardware yet.
3. **Plaça del Mercat and Dalt de la Vila polish:** reference photos for the real squares and streets; more ambient walkers and shoppers there; maybe a market interior.
4. **Sounds still synthesized:** digging, peeing, wing flutter, fireworks. The car horn clips exist (`honk-*`) but nothing honks in 3D yet. `howl` and `whine` are loaded but unused. A Freesound login would find CC0 versions quickly.
5. **Share the audio findings with the real Path of Leash Resistance game:** sources and processing are in `public/audio/sfx/CREDITS.md`.
6. **Phase 5:** goals per district, progress saved in the browser, more life.

## Polish backlog (from Santtu's playtesting)

- **Done (PR #3 follow-up):** rope segments are pushed out of poles to the side they were on last frame (`Leash.pushSegment()`), so fast pulls no longer tunnel through thin poles; the pole whirl spins the way the rope pulls the hand around the pole (`startWhirl()`); the old green horizon slab is replaced by two hazy inland ridges and a distant city skyline down the coast (`horizon.ts`, faded into the current fog color each frame; camera far plane is 1800).
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
