import { plainToInstance } from 'class-transformer';
import { validate as Validate, ValidationError } from 'class-validator';

export async function validate(dtoClass: any, data: any) {
  if (!dtoClass) {
    return data;
  }

  try {
    if (typeof dtoClass.from === 'function') {
      return dtoClass.from(data);
    }

    if (typeof dtoClass === 'function') {
      const instance = plainToInstance(dtoClass, data);
      const errors = await Validate(instance);

      if (errors.length > 0) {
        const formattedErrors = formatValidationErrors(errors);

        throw {
          status: 400,
          message: 'Validation failed',
          errors: formattedErrors,
        };
      }

      return instance;
    }

    return data;
  } catch (error) {
    throw error;
  }
}

function formatValidationErrors(errors: ValidationError[]): any[] {
  return errors.map((error) => {
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
