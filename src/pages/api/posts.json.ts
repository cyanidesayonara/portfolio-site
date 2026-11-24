import type { APIContext } from 'astro';
import { getLocalizedPosts } from '../../i18n/content';
import { LOCALES, localePath, type Locale } from '../../i18n/utils';

export interface SerializedPost {
  slug: string;
  project: string | null;
  title: string;
  description: string;
  date: string;
  tags: string[];
  cover: string | null;
  url: string;
}

export async function serializePostsForLocale(
  locale: Locale,
  site: URL,
  projectSlug?: string,
): Promise<SerializedPost[]> {
  const posts = await getLocalizedPosts(locale, false);
  const filtered = projectSlug ? posts.filter((p) => p.entry.data.project === projectSlug) : posts;
  return filtered.map((item) => {
    const d = item.entry.data;
    return {
      slug: item.slug,
      project: d.project ?? null,
      title: d.title,
      description: d.description,
      date: d.date.toISOString().slice(0, 10),
      tags: d.tags,
      cover: d.cover ? new URL(d.cover, site).href : null,
      url: new URL(localePath(locale, `/blog/${item.slug}`), site).href,
    };
  });
}

export async function GET(context: APIContext) {
  const site = context.site ?? new URL('https://santtu.fyi');
  const locales = Object.fromEntries(
    await Promise.all(LOCALES.map(async (loc) => [loc, await serializePostsForLocale(loc, site)])),
  );
  return new Response(
    JSON.stringify({ site: site.href.replace(/\/$/, ''), locales }, null, 2),
    { headers: { 'Content-Type': 'application/json; charset=utf-8' } },
  );
}
