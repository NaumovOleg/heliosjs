/* eslint-disable @typescript-eslint/no-explicit-any */
import type {
  ControllerClass,
  ControllerConfig,
  ControllerMeta,
  IController,
  MiddlewareCB,
  SSEControllerHandlers,
  WsControllerHandlers,
} from './types/core';
import {
  CONTROLLER_LOOKUP_SSE,
  CONTROLLER_LOOKUP_WS,
  CONTROLLER_META,
  CONTROLLER_PRECOMPILED,
} from './constants';
import { defineControllerMeta, defineMiddlewaresMeta } from './utils/shared';
import descriptors from './descriptors';

/**
 * Class decorator that turns a plain class into a Helios controller: it fixes the
 * route prefix, attaches controller-level middlewares, and mounts nested
 * controllers. Routes themselves come from the method decorators
 * ({@link Get}, {@link Post}, …).
 *
 * Two call forms:
 * - `@Controller('/users')` or `@Controller('/users', [authMw])` — prefix, plus
 *   an optional middleware array.
 * - `@Controller({ prefix: '/users', middlewares: [authMw], controllers: [ProfileController] })`
 *   — the object form, the only way to declare child controllers.
 *
 * At construction the decorated class is subclassed and given the internal
 * request-handling methods; a child controller inherits its parent's prefix and
 * middleware chain (parent middlewares run first). Invalid input (non-string
 * prefix, a non-class in `controllers`, a non-function in `middlewares`) throws
 * `TypeError` naming the offending class.
 *
 * @param path - Route prefix for every route in the class, e.g. `'/users'`.
 *   Joined with the parent controller's prefix when nested. Why: one place to
 *   version or namespace a whole group of routes.
 * @param middlewares - Controller-scoped middlewares (`(req, res, next) => …`),
 *   run in order before every route in this controller and its children. Why:
 *   cross-cutting concerns (auth, logging) without repeating `@Use` per method.
 *
 * @returns A class decorator that returns the enhanced controller subclass.
 *
 * @example
 * @Controller({
 *   prefix: '/users',
 *   middlewares: [authMiddleware],
 *   controllers: [UserSettingsController],
 * })
 * class UserController {
 *   @Get('/:id')
 *   getOne(@Params('id') id: string) {}
 * }
 */
export function Controller(
  path: string,
  middlewares?: MiddlewareCB[]
): <T extends ControllerClass>(constructor: T) => any;
export function Controller(
  config: ControllerConfig
): <T extends ControllerClass>(constructor: T) => any;

export function Controller(config: string | ControllerConfig, middlewares: MiddlewareCB[] = []) {
  // Handle both string and config object
  const routePrefix = (typeof config === 'string' ? config : config.prefix) ?? '/';
  const controllers = typeof config === 'object' ? config.controllers ?? [] : [];
  const controllerMiddlewares =
    typeof config === 'string' ? middlewares ?? [] : config.middlewares ?? [];

  return function <T extends ControllerClass>(constructor: T) {
    if (typeof routePrefix !== 'string') {
      throw new TypeError(`Error in ${constructor.name}. Invalid route prefix.`);
    }
    if (controllers.some((c) => typeof c !== 'function')) {
      throw new TypeError(`Error in ${constructor.name}. Invalid sub-controllers`);
    }
    if (controllerMiddlewares.some((c) => typeof c !== 'function')) {
      throw new TypeError(`Error in ${constructor.name}. Invalid middlewares`);
    }

    const Wrapped = class extends constructor {
      websocket?: WsControllerHandlers;
      sse?: SSEControllerHandlers;
      [CONTROLLER_PRECOMPILED]: ControllerMeta;

      constructor(...args: any[]) {
        super(...args);
        const controller = this as unknown as IController;
        controller[CONTROLLER_LOOKUP_WS]();
        controller[CONTROLLER_LOOKUP_SSE]();

        this[CONTROLLER_PRECOMPILED] = controller[CONTROLLER_META](args[0]);
      }
    };

    Object.defineProperties(Wrapped.prototype, descriptors);

    const proto = Wrapped.prototype;

    defineControllerMeta({ name: constructor.name, prefix: routePrefix, controllers }, proto);
    defineMiddlewaresMeta(
      controllerMiddlewares.map((middleware) => ({ middleware })),
      constructor
    );

    return Wrapped;
  };
}
