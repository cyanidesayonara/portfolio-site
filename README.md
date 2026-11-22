# santtu.fyi

My personal site, built with [Astro](https://astro.build) and deployed to GitHub Pages at [santtu.fyi](https://santtu.fyi/).

The look borrows Path of Leash Resistance's Trencadís palette and its fonts, Bricolage Grotesque and Inter. All colours are tokens in `src/styles/global.css`, with a dark theme that follows the system or the header toggle.

## Develop

Needs Node 22.23.4 or newer (see `.nvmrc`).

```sh
npm install
npm run dev      # http://localhost:4321
npm run build    # type-checks, then builds to dist/
```

## Where things live

- `src/content/projects/*.md`: one file per project. The frontmatter schema is in `src/content.config.ts`; `featured: true` puts a project on the home page, and `order` sorts them.
- `src/content/blog/*.md`: blog posts. `draft: true` hides one.
- `src/pages/`: home, projects, blog, about, how-i-build, walk (the teaser for the walkable version), 404 and the RSS feed.
- `src/components/StreetMap.astro`: the playable street on the home page and its row of stop links. The game itself is in `src/scripts/street/`: `world.ts` (layout and the pre-rendered static layer), `game.ts` (physics, NPCs, traffic, input, HUD) and `audio.ts` (synthesized music and sound effects, off until the visitor turns them on). Add `?streettest` to the URL to get a frame-stepping test hook on `window.__street`.
- `public/`: images, favicon, `CNAME` and the social share image (`img/og.png`).

Old Jekyll URLs (`/posts/...`, `/about-me`) redirect to their new homes; the list is in `astro.config.mjs`.

## Deploy

`.github/workflows/pages-deploy.yml` builds every pull request and deploys `main` to GitHub Pages.
