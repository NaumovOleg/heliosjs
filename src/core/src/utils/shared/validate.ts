import { plainToInstance } from 'class-transformer';
import type { ValidationError, ValidatorOptions } from 'class-validator';
import { validate as Validate } from 'class-validator';
import type { ErrorDetails } from '../../types';
import { ValidationError as ValidationFailed } from '../core';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function validate(dtoClass: any, data: unknown, options?: ValidatorOptions) {
  if (!dtoClass) {
    return data;
  }

  if (typeof dtoClass.from === 'function') {
    return dtoClass.from(data);
  }

  if (typeof dtoClass === 'function') {
    const instance = dtoClass.length > 0 ? new dtoClass(data) : plainToInstance(dtoClass, data);

    if (!instance) {
      throw new ValidationFailed([
        { field: 'unknown', value: 'unknown', error: 'Invalid instance' },
      ]);
    }
    const errors = await Validate(instance, options ?? {});
    if (errors.length > 0) {
      throw new ValidationFailed(formatValidationErrors(errors));
    }

    return instance;
  }

  return data;
}

function formatValidationErrors(errors: ValidationError[]): ErrorDetails[] {
  return errors.map(error => {
    const constraints = error.constraints || {};

    const children =
      error.children && error.children.length > 0
        ? formatValidationErrors(error.children)
        : undefined;

    return {
      property: error.property,
      value: error.value,
      constraints: Object.values(constraints),
      children,
    };
  });
}
