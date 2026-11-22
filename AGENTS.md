# AGENTS.md -- santtu.fyi (portfolio-site)

This file provides context and instructions for AI coding agents working on this project. It follows the AGENTS.md open standard (https://agents.md).

## Project Overview

**santtu.fyi** is Santtu Nykänen's personal portfolio site, built with Astro and deployed as a static site to GitHub Pages.

## Key Paths

- `src/content/projects/*.md`: project pages (`content.config.ts` schema; `featured: true` puts a project on the home page, `order` sorts them).
- `src/content/blog/*.md`: blog posts (`draft: true` hides a post from production builds and RSS).
- `src/pages/`: site routes (home, `projects/`, `blog/`, `about`, `how-i-build`, `walk`, `404`, RSS).
- `src/components/Walk3D.astro` and `src/scripts/walk/`: the 3D "Path of Leash Resistance" walk at `/walk`. Read `docs/3d-walk-handover.md` before working on `/walk`.
- `src/components/StreetMap.astro` and `src/scripts/street/`: the 2D playable street on the home page.
- `public/`: static images, audio stems, favicon, `CNAME`, and `img/og.png`.

## Development & Verification

Needs Node 22.23.4 or newer (see `.nvmrc`). On Windows in this workspace:

```powershell
npx.cmd -y node@22.23.5 node_modules/astro/bin/astro.mjs check
npx.cmd -y node@22.23.5 node_modules/astro/bin/astro.mjs build
```

Preview is configured in `.claude/launch.json` on `http://127.0.0.1:4321` (rebuild `dist/` before reloading). Append `?walktest` on `/walk` for perf readouts and `window.__walk` test hooks.

## Rules

1. **Authorship and attribution:** Commits are authored only by Santtu Nykänen. Never add `Co-authored-by` / `Co-Authored-By` trailers, `Generated with ...` footers, or any AI/agent/tool acknowledgements anywhere (commits, pull requests, code, or docs). CI's `attribution` job fails any push or pull request whose commits carry one, and `deploy` will not run past it. If a tool tries to add one, strip it before committing -- never bypass hooks with `--no-verify`.
2. **Deployment and merging:** Never merge to `main` without Santtu's explicit go-ahead. Pushing to `main` deploys the site to GitHub Pages via `.github/workflows/pages-deploy.yml`. Work on a feature branch and open a pull request for changes.
3. **Copy and accuracy:** Write in American English with a professional tone. Santtu is a generalist developer, not a "game maker". Never invent stats or facts.
4. **Blog drafts:** Keep `draft: true` on draft posts until Santtu explicitly approves each one.
5. **No emojis:** Do not use emojis in code, documentation, or commit messages.
6. **3D walk (`/walk`) naming and privacy:** Keep the Catalan seafront town unnamed on screen (for example, "Estació", "the old pier", "Carrer del Mar / Eix comercial"). When the hilltop "home" stop is built, it must be a generic door -- nothing on the site should identify Santtu's actual street or house. Read `docs/3d-walk-handover.md` before changing `/walk`.
