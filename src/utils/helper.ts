/* eslint-disable @typescript-eslint/no-explicit-any */

export const matchRoute = (routePattern: string, actualPath: string) => {
  const routeParts = routePattern.split('/').filter(Boolean);
  const pathParts = actualPath.split('/').filter(Boolean);

  if (routeParts.length !== pathParts.length) return null;

  const params: Record<string, string> = {};

  for (let i = 0; i < routeParts.length; i++) {
    const routePart = routeParts[i];
    const pathPart = pathParts[i];

    if (routePart.startsWith(':')) {
      const paramName = routePart.slice(1);
      params[paramName] = decodeURIComponent(pathPart);
    } else if (routePart !== pathPart) {
      return null;
    }
  }

  return params;
};
