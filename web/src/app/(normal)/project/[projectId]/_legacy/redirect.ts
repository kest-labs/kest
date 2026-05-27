import { redirect } from 'next/navigation';

export type LegacySearchParams = Record<string, string | string[] | undefined>;

export const appendLegacySearchParams = (href: string, searchParams: LegacySearchParams) => {
  const query = new URLSearchParams();

  Object.entries(searchParams).forEach(([key, value]) => {
    if (Array.isArray(value)) {
      value.forEach(item => {
        if (item) {
          query.append(key, item);
        }
      });
      return;
    }

    if (value) {
      query.set(key, value);
    }
  });

  const queryString = query.toString();
  return queryString ? `${href}?${queryString}` : href;
};

export const redirectLegacyProjectRoute = (
  href: string,
  searchParams?: LegacySearchParams
) => {
  redirect(searchParams ? appendLegacySearchParams(href, searchParams) : href);
};
