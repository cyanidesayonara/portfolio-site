# Handover: the 3D walk (`/walk`)

For the next agent picking up the 3D "Path of Leash Resistance" walk on Santtu's portfolio site. Read this first, then `src/scripts/walk/game3d.ts` from the top.

## Ground rules

- **Branch:** PR #1 (`redesign-astro`) has been merged to `main`; put new work on a feature branch with a PR against `main`. Commit as you go and push.
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
  - **`addTestDistrict()`:** a streamable district far off the map (x 400–460) for exercising build, bake and unload through `streamer.update(x, z)`.
- **Stress test:** previous sessions used a snippet that drives Millie with random keys from many spots and checks for NaNs, leaving the bounds and safety "hops" (`debug.hops`). It isn't saved in the repo; rebuild it from the `__walk` API above.
- **Browser pane:** when hidden, rAF is throttled. Timings look worse and screenshots can lag a frame. If Santtu is playing in the preview tab, test in a separate tab instead of reloading theirs.

## Architecture (`src/scripts/walk/`)

| File | What it does |
| --- | --- |
| `game3d.ts` | Everything at runtime: renderer, loading bar, input (focus-gated), physics at 120 Hz, the human's AI, leash, goals, quests, chases (La Neteja, correfoc, Dimoni), NPC walkers and cyclists, train, cameras (street, follow and overhead; wheel and `-`/`=` zoom; drag and `[`/`]` orbit), HUD wiring, minimap, theme and sky, fullscreen, the `?walktest` hooks. |
| `level.ts` | `buildLevelSteps()`: the level as a generator that yields between sections, so it builds behind a loading bar. It produces geometry, colliders, floor and surface functions, quest and NPC data, and the three districts. Exports layout constants (`GROUND_Y`, `WATER_Y`, `PIPICA`, `SWIM`, …). |
| `world.ts` | `District`, `ColliderGrid` (8 m cells; colliders tagged by district) and `Streamer`: live within 80 m, stand-in beyond 100 m, unload beyond 170 m for streamable districts, with build and bake jobs under a 4 ms per-frame budget. |
| `bake.ts` | `bakeSteps()` merges static meshes into chunked, vertex-colored meshes as a generator, swapping in one step at the end. `collapseRig()` merges the rigid parts of animated models. |
| `life.ts` | Ambient NPCs: dog walkers whose dogs sniff and bark back, joggers, a coconut seller, palas players, swimmers, a paddle boarder, neighbors on chairs, kids playing tag. Reacts to rain and night, hidden beyond 48 m. |
| `models.ts`, `props.ts` | Procedural models: dogs, people (poses, with gait phases that accumulate), bikes and scooters, sweeper, train, street furniture, fingerposts, Tofu, devils. |
| `leash.ts` | A port of the real game's leash: Verlet rope, tug, stretch cap, pole-whirl detector. |
| `fade.ts` | See-through dither for anything between the camera and Millie. Millie and her human are exempt. |
| `minimap.ts` | A top-down plan drawn once from level data, plus live markers. Turns with the follow camera; `M` enlarges it. |
| `hud.ts`, `audio.ts`, `theme.ts`, `textures.ts` | HUD DOM, Web Audio (stemma jukebox stems plus synthesized SFX), day/rain/night presets, procedural canvas textures. |

`src/components/Walk3D.astro` holds the markup, toolbar, panels and all HUD CSS, and lazy-loads `game3d`. `src/pages/walk.astro` is the page. The home page (`src/pages/index.astro`) still uses the 2D `StreetMap.astro`.

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
| 2 | next | Layout as data: districts described in JSON (street lines, block outlines with heights and facade style, landmarks, points of interest), with procedural facades. The minimap and colliders come from the same data. Build merged geometry directly instead of meshes-then-bake, which also cuts the garbage-collection pauses seen while streaming. |
| 3 | | The first new district: the center north of Carrer del Mar (a square, a shopping street, a second pipicà, a new chase, 2–3 quests). |
| 4 | | Terrain (height grid, sloped streets, stairs) and the hill district, with the church as a landmark that's always visible. |
| 5 | | Goals per district, progress saved in the browser, more life. |

**Measured costs:**
- **Build:** about 0.8 s of total work. The longest step is about 70–120 ms (the sea texture and building rows).
- **Baking:** the three districts bake during the loading bar.
- **Draw calls:** about 550–850 depending on the view, and 133 on the pier with stand-ins.
- **Godot:** if the town outgrows the web, the plan is to move PoLR 2 there; keep layout data portable for that.

## Polish backlog (from Santtu's playtesting)

- Many models and animations still look rough. Santtu called out the human's walk earlier; the gait-phase fix and pulled pose helped, but more work is welcome.
- Not verified on real hardware: true browser fullscreen, touch on phones, audio by ear, pinch-to-zoom (not implemented).
- Stand-ins are plain blocks. The town hasn't been visually checked from the pier.
- The home page still runs the 2D map. Santtu wants the 3D walk there once it's solid (`<Walk3D lazy />`, ideally loading only the seafront district).

## Release checklist (first merge of PR #1)

1. Santtu says to merge. Nothing merges without that.
2. `astro check` and `astro build` are clean, and the PR's `build` check passes.
3. Santtu has confirmed the `/how-i-build` description of the AI workflow.
4. The blog drafts stay drafts unless Santtu approves specific ones (one post is already published).
5. After merging, check the deployed site (home, `/walk`, the project pages, the blog) on GitHub Pages.
