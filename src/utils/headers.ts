import { AppRequest } from '@types';

export const getOrigin = (req: AppRequest) => {
  let originHeader = req.headers.origin || req.headers.Origin || req.requestUrl.origin;
  const origin = (Array.isArray(originHeader) ? originHeader[0] : originHeader) as string;
  return origin;
};
