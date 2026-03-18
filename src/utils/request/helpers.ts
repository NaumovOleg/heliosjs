import { RequestSource } from '@types';

const parseCookie = (cookies: string) => {
  return (cookies as string).split(';').reduce(
    (acc, cookie) => {
      const [name, value] = cookie.trim().split('=');
      if (name && value) {
        acc[name] = decodeURIComponent(value);
      }
      return acc;
    },
    {} as Record<string, string>,
  );
};

export const parseRequestCookie = (
  source: RequestSource,
  cookies?: string | string[],
): Record<string, string> => {
  if (!cookies || source === 'unknown') return {};

  const values = Array.isArray(cookies) ? cookies : [cookies];
  return values.reduce((acc, cookie) => {
    return {
      ...acc,
      ...parseCookie(cookie),
    };
  }, {});
};

export const parseQuesry = (url: URL) => {
  const params = url.searchParams;
  const query: Record<string, string | string[]> = {};

  for (const key of params.keys()) {
    const values = params.getAll(key);

    query[key] = values.length > 1 ? values : values[0];
  }

  return query;
};
