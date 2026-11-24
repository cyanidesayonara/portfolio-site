import rss from '@astrojs/rss';
import type { APIContext } from 'astro';
import { getLocalizedPosts } from '../i18n/content';
import { getUi } from '../i18n/ui';

export async function GET(context: APIContext) {
  const ui = getUi('en');
  const posts = await getLocalizedPosts('en', false);
  return rss({
    title: ui.site.rssTitle,
    description: ui.site.rssDescription,
    site: context.site!,
    items: posts.map((item) => ({
      title: item.entry.data.title,
      description: item.entry.data.description,
      pubDate: item.entry.data.date,
      link: `/blog/${item.slug}/`,
    })),
  });
}
