import type { APIContext } from 'astro';
import { getLocalizedProjects } from '../../../i18n/content';
import { LOCALES, localePath } from '../../../i18n/utils';
import { serializePostsForLocale } from '../posts.json';

export async function getStaticPaths() {
  const projects = await getLocalizedProjects('en');
  return projects.map((p) => ({
    params: { project: p.slug },
  }));
}

export async function GET(context: APIContext) {
  const site = context.site ?? new URL('https://santtu.fyi');
  const slug = context.params.project!;
  const projectUrl = Object.fromEntries(
    LOCALES.map((loc) => [loc, new URL(localePath(loc, `/projects/${slug}`), site).href]),
  );
  const locales = Object.fromEntries(
    await Promise.all(LOCALES.map(async (loc) => [loc, await serializePostsForLocale(loc, site, slug)])),
  );
  return new Response(
    JSON.stringify(
      {
        project: slug,
        site: site.href.replace(/\/$/, ''),
        projectUrl,
        locales,
      },
      null,
      2,
    ),
    { headers: { 'Content-Type': 'application/json; charset=utf-8' } },
  );
}
