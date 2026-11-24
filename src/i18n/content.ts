import { getCollection, type CollectionEntry } from 'astro:content';
import type { Locale } from './utils';

export function parseEntryId(id: string): { locale: Locale; slug: string } {
  const norm = id.replace(/\\/g, '/');
  if (norm.startsWith('es/')) return { locale: 'es', slug: norm.slice(3) };
  if (norm.startsWith('ca/')) return { locale: 'ca', slug: norm.slice(3) };
  return { locale: 'en', slug: norm };
}

export interface LocalizedEntry<T extends 'projects' | 'blog'> {
  slug: string;
  entry: CollectionEntry<T>;
  isFallback: boolean;
}

export async function getLocalizedProjects(locale: Locale): Promise<LocalizedEntry<'projects'>[]> {
  const all = await getCollection('projects');
  const bySlug = new Map<string, Partial<Record<Locale, CollectionEntry<'projects'>>>>();

  for (const entry of all) {
    const parsed = parseEntryId(entry.id);
    const group = bySlug.get(parsed.slug) ?? {};
    group[parsed.locale] = entry;
    bySlug.set(parsed.slug, group);
  }

  const canonical = Array.from(bySlug.entries())
    .filter((entry): entry is [string, Partial<Record<Locale, CollectionEntry<'projects'>>> & { en: CollectionEntry<'projects'> }] => Boolean(entry[1].en))
    .sort((a, b) => a[1].en.data.order - b[1].en.data.order);

  return canonical.map(([slug, group]) => {
    const localized = group[locale];
    if (localized) {
      return { slug, entry: localized, isFallback: false };
    }
    return { slug, entry: group.en, isFallback: locale !== 'en' };
  });
}

export async function getLocalizedPosts(
  locale: Locale,
  includeDrafts = import.meta.env.DEV,
): Promise<LocalizedEntry<'blog'>[]> {
  const all = await getCollection('blog');
  const bySlug = new Map<string, Partial<Record<Locale, CollectionEntry<'blog'>>>>();

  for (const entry of all) {
    const parsed = parseEntryId(entry.id);
    const group = bySlug.get(parsed.slug) ?? {};
    group[parsed.locale] = entry;
    bySlug.set(parsed.slug, group);
  }

  const results: LocalizedEntry<'blog'>[] = [];
  for (const [slug, group] of bySlug.entries()) {
    const enEntry = group.en;
    if (!enEntry) continue;
    if (!includeDrafts && enEntry.data.draft) continue;

    const localized = group[locale];
    if (localized && (includeDrafts || !localized.data.draft)) {
      results.push({ slug, entry: localized, isFallback: false });
    } else {
      results.push({ slug, entry: enEntry, isFallback: locale !== 'en' });
    }
  }

  return results.sort((a, b) => b.entry.data.date.valueOf() - a.entry.data.date.valueOf());
}
