// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

export default defineConfig({
  site: 'https://santtu.fyi',
  trailingSlash: 'ignore',
  integrations: [sitemap()],
  // Old Jekyll/Chirpy URLs, so existing links keep working.
  redirects: {
    '/about-me': '/about',
    '/archives': '/blog',
    '/categories': '/blog',
    '/tags': '/blog',
    '/posts/welcome': '/',
    '/posts/borealis': '/projects/coriolis',
    '/projects/borealis': '/projects/coriolis',
    '/posts/dopepod': '/projects/dopepod',
    '/posts/monitorimittari': '/projects/monitorimittari',
    '/posts/noteowl': '/projects/noteowl',
    '/posts/varastolista': '/projects/varastolista',
    '/posts/trivialpurrsuit': '/projects/trivial-purrsuit',
    '/posts/comparing-claude-versions-building-expense-app': '/blog/comparing-claude-versions',
  },
  markdown: {
    shikiConfig: { theme: 'github-dark-dimmed' },
  },
});
