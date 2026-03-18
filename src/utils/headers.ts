import { IRequest } from '@types';

export const getOrigin = (req: IRequest) => {
  let originHeader = req.headers.origin || req.headers.Origin || req.requestUrl.origin;
  const origin = (Array.isArray(originHeader) ? originHeader[0] : originHeader) as string;
  return origin;
};
