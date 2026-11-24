// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

export default defineConfig({
  site: 'https://santtu.fyi',
  trailingSlash: 'ignore',
  integrations: [sitemap()],
  i18n: {
    defaultLocale: 'en',
    locales: ['en', 'es', 'ca'],
    routing: {
      prefixDefaultLocale: false,
    },
  },
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
    '/posts/trivialpurrsuit': '/projects/eat-prey-nap',
    '/projects/trivial-purrsuit': '/projects/eat-prey-nap',
    '/es/projects/trivial-purrsuit': '/es/projects/eat-prey-nap',
    '/ca/projects/trivial-purrsuit': '/ca/projects/eat-prey-nap',
    '/posts/comparing-claude-versions-building-expense-app': '/blog/comparing-claude-versions',
  },
  markdown: {
    shikiConfig: { theme: 'github-dark-dimmed' },
  },
});
