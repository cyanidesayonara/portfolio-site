# Keeping the Portfolio Synced Across Projects

When multiple projects (`path-of-leash-resistance`, `stemma`, `coriolis`, `eat-prey-nap`, `dop3pod`) move forward in parallel, two mechanisms keep `santtu.fyi` aligned without manually copying files or editing numbers across three languages.

## 1. Syncing project metadata, screenshots, and WASM builds

[tools/sync-projects.mjs](file:///C:/Users/SanttuNyk%C3%A4nen/projects/portfolio-site/tools/sync-projects.mjs) inspects all five upstream repositories and manages:

- `src/data/project-meta.json` (default branches, latest release tags, latest commit dates, and live metrics for `Path of Leash Resistance` used on `/how-i-build` and project fact sidebars)
- Compiled `coriolis.js` and `coriolis.wasm` binaries in `public/coriolis/`
- Project screenshots in `public/img/projects/`

### Running locally against sibling checkouts

```bash
npm run sync:check
npm run sync:apply
```

### Automated weekly & release-triggered sync

[.github/workflows/sync-projects.yml](file:///C:/Users/SanttuNyk%C3%A4nen/projects/portfolio-site/.github/workflows/sync-projects.yml) runs `node tools/sync-projects.mjs --github --apply` every Monday at 08:00 UTC, on manual `workflow_dispatch`, or whenever a project repository fires a `repository_dispatch` event of type `project-updated`. When metadata or assets change, it verifies `npm run build` and opens or updates a PR against `main` on branch `chore/sync-projects`.

To trigger an immediate portfolio refresh from another project's release workflow, send a `repository_dispatch` webhook (with a fine-grained PAT or token with `contents: write` stored as `PORTFOLIO_SYNC_TOKEN`):

```yaml
- name: Notify portfolio-site
  uses: peter-evans/repository-dispatch@v3
  with:
    token: ${{ secrets.PORTFOLIO_SYNC_TOKEN }}
    repository: cyanidesayonara/portfolio-site
    event-type: project-updated
    client-payload: '{"project": "${{ github.event.repository.name }}"}'
```

*(Descriptive prose updates — such as new features, boss names, or release highlights across English, Spanish, and Catalan markdown files — still benefit from a quick human/agent pass whenever a major milestone lands.)*

## 2. Crosslinking app-specific blog posts onto standalone project sites

Blog posts in `src/content/blog/` declare `project: <slug>` in their frontmatter (for example `project: coriolis`, `project: stemma`, or `project: path-of-leash-resistance`). At build time, Astro emits:

- **Bidirectional links on `santtu.fyi`:** project pages list matching posts under **Related posts**, and blog posts link back to their project page.
- **Public static JSON feeds:**
  - `https://santtu.fyi/api/posts.json` (all published posts across `en`, `es`, `ca`)
  - `https://santtu.fyi/api/posts/<project>.json` (filtered to one project across `en`, `es`, `ca`)

Standalone GitHub Pages sites can embed the script below inside their blog/build-log section to render live localized links to every post for that app:

```html
<ul id="santtu-posts"></ul>
<script>
  (async () => {
    const slug = 'coriolis'; // or 'stemma' | 'path-of-leash-resistance'
    const lang = ['es', 'ca'].includes(document.documentElement.lang)
      ? document.documentElement.lang
      : 'en';
    const res = await fetch(`https://santtu.fyi/api/posts/${slug}.json`);
    if (!res.ok) return;
    const data = await res.json();
    const list = document.getElementById('santtu-posts');
    for (const post of data.locales[lang] || data.locales.en || []) {
      const li = document.createElement('li');
      const a = document.createElement('a');
      a.href = post.url;
      a.textContent = `${post.date} — ${post.title}`;
      li.appendChild(a);
      list?.appendChild(li);
    }
  })();
</script>
```
