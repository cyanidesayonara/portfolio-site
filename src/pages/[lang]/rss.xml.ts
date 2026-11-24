import rss from '@astrojs/rss';
import type { APIContext } from 'astro';
import { getLocalizedPosts } from '../../i18n/content';
import { NON_DEFAULT_LOCALES, isLocale } from '../../i18n/utils';
import { getUi } from '../../i18n/ui';

export function getStaticPaths() {
  return NON_DEFAULT_LOCALES.map((lang) => ({ params: { lang } }));
}

export async function GET(context: APIContext) {
  const langParam = context.params.lang;
  const lang = isLocale(langParam) ? langParam : 'es';
  const ui = getUi(lang);
  const posts = await getLocalizedPosts(lang, false);
  return rss({
    title: ui.site.rssTitle,
    description: ui.site.rssDescription,
    site: context.site!,
    items: posts.map((item) => ({
      title: item.entry.data.title,
      description: item.entry.data.description,
      pubDate: item.entry.data.date,
      link: `/${lang}/blog/${item.slug}/`,
    })),
  });
}
