import { plainToInstance } from 'class-transformer';
import { validate as Validate, ValidationError } from 'class-validator';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function validate(dtoClass: any, data: unknown) {
  if (!dtoClass) {
    return data;
  }

  if (typeof dtoClass.from === 'function') {
    return dtoClass.from(data);
  }

  if (typeof dtoClass === 'function') {
    const instance = dtoClass.length > 0 ? new dtoClass(data) : plainToInstance(dtoClass, data);

    if (!instance) {
      throw { status: 400, message: 'Validation failed', validationError: 'Empty value' };
    }
    const errors = await Validate(instance);

    if (errors.length > 0) {
      const validationError = formatValidationErrors(errors);
      throw { status: 400, message: 'Validation failed', validationError };
    }

    return data;
  }

  return data;
}

function formatValidationErrors(errors: ValidationError[]): unknown[] {
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
