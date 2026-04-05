import 'reflect-metadata';
import { DECORATOR } from '../../constants';
import { ControllerMeta, MiddlewaresMetadata, RouteMetadata } from '../../types/core/controller';

export const generateUniqueId = () => {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
};

export function reflectControllerMeta(target: object): ControllerMeta {
  const data = Reflect.getMetadata(DECORATOR.controller, target) ?? {};

  if (!data['controllers']) {
    data['controllers'] = [];
  }
  return data;
}
export function defineControllerMeta(meta: Partial<ControllerMeta>, target: object): void {
  const existed = reflectControllerMeta(target);

  const merged = Object.entries(meta).reduce((acc, [key, value]) => {
    if (Array.isArray(acc[key])) {
      acc[key] = acc[key].concat(value);
    } else {
      acc[key] = value;
    }

    return acc;
  }, existed as any);
  Reflect.defineMetadata(DECORATOR.controller, merged, target);
}

export function reflectMiddlewaresMetadata(target: any, propertie?: string): MiddlewaresMetadata {
  let data;
  if (propertie) {
    data = Reflect.getMetadata(DECORATOR.middlewares, target, propertie) ?? {};
  } else {
    data = Reflect.getMetadata(DECORATOR.middlewares, target) ?? {};
  }

  ['middlewares', 'errors', 'guards', 'pipes', 'cors', 'sanitizers', 'interceptors'].forEach(
    (prop) => {
      if (!data[prop]?.length) {
        data[prop] = [];
      }
    },
  );

  return data;
}
export function reflectRouteMetadata(target: object, popertie: string): RouteMetadata {
  const data = Reflect.getMetadata(DECORATOR.route, target, popertie) ?? {};

  ['parameters', 'middlewares'].forEach((prop) => {
    if (!data[prop]?.length) {
      data[prop] = [];
    }
  });

  return data;
}

export function defineMiddlewaresMeta(meta: Partial<MiddlewaresMetadata>, target: object): void;
export function defineMiddlewaresMeta(
  meta: Partial<MiddlewaresMetadata>,
  target: object,
  propertie?: string,
): void;
export function defineMiddlewaresMeta(
  meta: Partial<MiddlewaresMetadata>,
  target: object,
  propertie?: string,
) {
  const existed = reflectMiddlewaresMetadata(target, propertie);

  const merged = Object.entries(meta).reduce((acc, [key, value]) => {
    if (Array.isArray(acc[key])) {
      acc[key] = acc[key].concat(value);
    } else {
      acc[key] = value;
    }

    return acc;
  }, existed as any);
  if (propertie) {
    Reflect.defineMetadata(DECORATOR.middlewares, merged, target, propertie);
  } else {
    Reflect.defineMetadata(DECORATOR.middlewares, merged, target);
  }
}
export function defineRouteMeta(
  meta: Partial<RouteMetadata>,
  target: object,
  propertie: string,
): void;
export function defineRouteMeta(meta: Partial<RouteMetadata>, target: object, propertie: string) {
  const existed = reflectRouteMetadata(target, propertie);
  const merged = Object.entries(meta).reduce((acc, [key, value]) => {
    if (Array.isArray(acc[key])) {
      acc[key] = acc[key].concat(value);
    } else {
      acc[key] = value;
    }

    return acc;
  }, existed as any);

  Reflect.defineMetadata(DECORATOR.route, merged, target, propertie);
}
