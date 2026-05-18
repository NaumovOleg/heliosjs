import type { ControllerMeta, IController } from '../types/core';

import { reflectControllerMeta, reflectMiddlewaresMetadata } from '../utils/shared';
import { CONTROLLER_PRECOMPILED } from '../constants';
import { collectRoutes } from '../utils/core';

export const meta = function (
  this: IController,
  parent: Omit<ControllerMeta, 'controllers'>
): ControllerMeta {
  const controller = reflectControllerMeta(this.constructor.prototype);
  const functions = reflectMiddlewaresMetadata(this.constructor);

  const prefix = (parent.prefix + '/' + controller.prefix).replaceAll(/\/+/g, '/');

  const meta: Omit<ControllerMeta, 'controllers'> = {
    routes: [],
    functions: [...parent.functions, ...functions],
    prefix,
    name: controller.name,
  };

  meta.routes = collectRoutes(this, meta, prefix);

  const children = controller.controllers.map(
    (Controller: new (...args: unknown[]) => IController) => {
      const instance = new Controller(meta);
      return instance[CONTROLLER_PRECOMPILED];
    }
  );
  meta.children = children;

  return { ...controller, ...meta, controllers: controller.controllers };
};
