import { Request } from '../../types/core';

export const getOrigin = (req: Request) => {
  let originHeader = req.headers.origin || req.headers.Origin || req.requestUrl.origin;
  const origin = (Array.isArray(originHeader) ? originHeader[0] : originHeader) as string;
  return origin;
};
