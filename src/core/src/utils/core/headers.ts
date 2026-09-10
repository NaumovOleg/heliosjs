import type { Request } from '../../types/core';

/** Case-insensitive header lookup over a plain headers map. */
export const getHeaderCI = (
  headers: Record<string, string | string[]> | undefined,
  name: string
): string | string[] | undefined => {
  if (!headers) return undefined;
  const lower = name.toLowerCase();
  const key = Object.keys(headers).find((k) => k.toLowerCase() === lower);
  return key !== undefined ? headers[key] : undefined;
};

/** @internal Returns the request's `Origin` header, or `undefined` if absent. */
export const getOrigin = (req: Request): string | undefined => {
  const originHeader = getHeaderCI(req.headers, 'origin');
  if (!originHeader) return undefined;
  return (Array.isArray(originHeader) ? originHeader[0] : originHeader) as string;
};
