import type AjvType from 'ajv';
import type { plainToInstance as PlainToInstanceFn } from 'class-transformer';
import type { validate as ValidateFn, ValidationError, ValidatorOptions } from 'class-validator';
import type { ErrorDetails } from '../../types';
import { ValidationError as ValidationFailed } from '../core';
import { redactIfSensitive } from './helpers';
import { lazyPeer } from './peer';

const getClassTransformer = lazyPeer<{ plainToInstance: typeof PlainToInstanceFn }>(
  'class-transformer',
  'Class-based DTO validation (@Body(DtoClass), @Params(DtoClass), …)'
);
const getClassValidator = lazyPeer<{ validate: typeof ValidateFn }>(
  'class-validator',
  'Class-based DTO validation (@Body(DtoClass), @Params(DtoClass), …)'
);
const getAjv = lazyPeer<{ default: typeof AjvType }>('ajv', 'compileSchema()');

// One Ajv instance shared by every compileSchema() call in the process (not
// one per schema) — cheaper, and required for cross-schema $ref to resolve.
// Created lazily on the first schema's first validation, same as the ajv
// module load itself.
let ajvInstance: InstanceType<typeof AjvType> | undefined;
function getAjvInstance(): InstanceType<typeof AjvType> {
  if (!ajvInstance) {
    const Ajv = getAjv().default;
    ajvInstance = new Ajv({ allErrors: true, coerceTypes: true, useDefaults: true });
  }
  return ajvInstance;
}

/**
 * @internal DTO validation used by every `TO_VALIDATE` parameter decorator
 * (`@Body`, `@Params`, `@QueryParam`, `@Headers`, `@Cookies`, `@Files`). Without
 * a `dtoClass` it returns `data` unchanged. With one: calls its static `from()`
 * if defined, otherwise builds an instance via `class-transformer` and runs
 * `class-validator`; throws `ValidationError` on failure.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function validate(dtoClass: any, data: unknown, options?: ValidatorOptions) {
  if (!dtoClass) {
    return data;
  }

  if (typeof dtoClass.from === 'function') {
    return dtoClass.from(data);
  }

  if (typeof dtoClass === 'function') {
    const { plainToInstance } = getClassTransformer();
    const instance = dtoClass.length > 0 ? new dtoClass(data) : plainToInstance(dtoClass, data);

    if (!instance) {
      throw new ValidationFailed([
        { field: 'unknown', value: 'unknown', error: 'Invalid instance' },
      ]);
    }
    const { validate: Validate } = getClassValidator();
    const errors = await Validate(instance, options ?? {});
    if (errors.length > 0) {
      throw new ValidationFailed(formatValidationErrors(errors));
    }

    return instance;
  }

  return data;
}

/**
 * Compiles a JSON Schema once into a fast Ajv validator, wrapped as a `Dto` —
 * pass the result straight to `@Body`, `@Params`, `@QueryParam`, `@Headers`,
 * `@Cookies`, `@Files`. Skips class-transformer/class-validator's per-request
 * reflection entirely; this is the same mechanism Fastify uses for its native
 * schema validation, and closes most of the throughput gap that shows up
 * against it in `benchmarks/results-validation.csv`.
 *
 * Call it once per schema (module scope, e.g. next to the schema itself), not
 * per request — compilation is the expensive part and only needs to happen
 * once. `ajv` is an optional peer dependency: it's only required the first
 * time a compiled schema actually validates something, and only if you use
 * `compileSchema` at all.
 *
 * @example
 * const OrderSchema = compileSchema({
 *   type: 'object',
 *   required: ['name'],
 *   properties: { name: { type: 'string', minLength: 2 } },
 * });
 *
 * @Post('/orders')
 * create(@Body(OrderSchema) body: Order) {}
 */
export function compileSchema<T = unknown>(schema: object): { from(data: unknown): T } {
  let run: ReturnType<AjvType['compile']> | undefined;

  return {
    from(data: unknown): T {
      if (!run) {
        run = getAjvInstance().compile<T>(schema);
      }

      if (!run(data)) {
        throw new ValidationFailed(
          (run.errors ?? []).map(error => {
            const field =
              error.instancePath.replace(/^\//, '') || error.params?.missingProperty || '(root)';
            return {
              field,
              value: redactIfSensitive(field, error.data),
              constraint: error.message,
            };
          })
        );
      }

      return data as T;
    },
  };
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
      value: redactIfSensitive(error.property, error.value),
      constraints: Object.values(constraints),
      children,
    };
  });
}
