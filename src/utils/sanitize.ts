import xss, { IFilterXSSOptions } from 'xss';

export const SanitizeXSS = (
  options: IFilterXSSOptions = {
    whiteList: {},
    stripIgnoreTag: true,
    stripIgnoreTagBody: true,
  },
) => {
  return function (target: any, propertyKey: string) {
    let value = target[propertyKey];

    const getter = () => value;
    const setter = (newVal: any) => {
      if (typeof newVal === 'string') {
        value = xss(newVal, options);
      } else {
        value = newVal;
      }
    };

    Object.defineProperty(target, propertyKey, {
      get: getter,
      set: setter,
      enumerable: true,
      configurable: true,
    });
  };
};
