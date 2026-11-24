export const LOCALES = ['en', 'es', 'ca'] as const;
export const NON_DEFAULT_LOCALES = ['es', 'ca'] as const;

export type Locale = (typeof LOCALES)[number];

export const LOCALE_LABELS: Record<Locale, string> = {
  en: 'EN',
  es: 'ES',
  ca: 'CA',
};

export const LOCALE_NAMES: Record<Locale, string> = {
  en: 'English',
  es: 'Español',
  ca: 'Català',
};

export const BCP47: Record<Locale, string> = {
  en: 'en-US',
  es: 'es-ES',
  ca: 'ca-ES',
};

export function isLocale(value: string | undefined): value is Locale {
  return value === 'en' || value === 'es' || value === 'ca';
}

export function stripLocale(pathname: string): string {
  const raw = pathname.startsWith('/') ? pathname : `/${pathname}`;
  const clean = raw.replace(/\/+$/, '') || '/';
  if (clean === '/es' || clean === '/ca') return '/';
  if (clean.startsWith('/es/') || clean.startsWith('/ca/')) {
    return clean.slice(3) || '/';
  }
  return clean;
}

export function localePath(locale: Locale, path: string): string {
  const match = /^([^?#]*)(.*)$/.exec(path);
  const base = match?.[1] ?? '/';
  const suffix = match?.[2] ?? '';
  const normalized = base.startsWith('/') ? base : `/${base}`;
  const clean = normalized.replace(/\/+$/, '') || '/';
  if (locale === 'en') return `${clean}${suffix}`;
  return clean === '/' ? `/${locale}/${suffix}` : `/${locale}${clean}${suffix}`;
}

export function switchLocalePath(pathname: string, target: Locale): string {
  return localePath(target, stripLocale(pathname));
}
