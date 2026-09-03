import type { Request } from '../../types/core';

export const getOrigin = (req: Request): string | undefined => {
  const originHeader = req.headers.origin || req.headers.Origin;
  if (!originHeader) return undefined;
  return (Array.isArray(originHeader) ? originHeader[0] : originHeader) as string;
};
