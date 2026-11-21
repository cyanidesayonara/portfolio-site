# santtu.fyi

My personal site, built with [Astro](https://astro.build) and deployed to GitHub Pages at [santtu.fyi](https://santtu.fyi/).

The look ("Eixample") borrows Path of Leash Resistance's Trencadís palette and its fonts, Bricolage Grotesque and Inter. All colours are tokens in `src/styles/global.css`, with a dark theme that follows the system or the header toggle.

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
- `src/components/EixampleMap.astro`: the block map on the home page.
- `public/`: images, favicon, `CNAME` and the social share image (`img/og.png`).

Old Jekyll URLs (`/posts/...`, `/about-me`) redirect to their new homes; the list is in `astro.config.mjs`.

## Deploy

`.github/workflows/pages-deploy.yml` builds every pull request and deploys `main` to GitHub Pages.
