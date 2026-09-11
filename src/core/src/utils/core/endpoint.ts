import type { ValidatorOptions } from 'class-validator';
import type { Dto, ParamDecoratorType } from '../../types/core';
import { defineRouteMeta } from '../shared/helpers';

/**
 * Builds a parameter decorator that records what to inject at one handler
 * argument position. This is what `@Body`, `@Params`, `@QueryParam`, `@Headers`,
 * `@Cookies`, `@Files`, `@Req`, `@Res`, `@Fingerprint`, `@InjectWS`, and
 * `@InjectSSE` are implemented with — use it directly to build your own
 * parameter decorator with the same `(nameOrDto?, nameOrOptions?, options?)`
 * calling convention.
 *
 * @param type - What to inject; see {@link ParamDecoratorType}.
 * @param nameOrDto - A field name (`string`) to extract from the resolved value,
 *   or a DTO class to validate/transform the whole value against. Ignored for
 *   types that don't go through validation (`'request'`, `'response'`, `'ws'`,
 *   `'sse'`, `'fingerprint'`).
 * @param nameOrOptions - A field name (`string`), or class-validator
 *   `ValidatorOptions` when `nameOrDto` was a DTO.
 * @param options - class-validator `ValidatorOptions`.
 * @returns A parameter decorator (`(target, propertyKey, index) => void`) that
 *   records a {@link ParamMetadata} entry for the route.
 *
 * @example
 * export const UserId = () => createParamDecorator('headers', 'x-user-id');
 */
export function createParamDecorator(
  type: ParamDecoratorType,
  nameOrDto?: Dto | string,
  nameOrOptions?: ValidatorOptions | string,
  options?: ValidatorOptions
) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return function (target: any, propertyKey: string, index: number) {
    const param = { index, type };
    if (options) {
      Object.assign(param, { options });
    }
    if (nameOrDto) {
      Object.assign(
        param,
        typeof nameOrDto === 'string' ? { name: nameOrDto } : { dto: nameOrDto }
      );
    }

    if (nameOrOptions) {
      Object.assign(
        param,
        typeof nameOrOptions === 'string' ? { name: nameOrOptions } : { options: nameOrOptions }
      );
    }
    const data = { parameters: [param] };
    defineRouteMeta(data, target, propertyKey);
  };
}

/** @internal `true` when `path`'s segments start with `prefix`'s segments. */
export const pathStartsWithPrefix = (path: string, prefix: string): boolean => {
  const pathSegments = path.split('/').filter(Boolean);
  const prefixSegments = prefix.split('/').filter(Boolean);

  if (prefixSegments.length > pathSegments.length) {
    return false;
  }

  for (let i = 0; i < prefixSegments.length; i++) {
    if (pathSegments[i] !== prefixSegments[i]) {
      return false;
    }
  }

  return true;
};
