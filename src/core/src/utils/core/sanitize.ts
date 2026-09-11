/* eslint-disable no-useless-escape */
import type * as Joi from 'joi';
import type { Request, SanitizerConfig } from '../../types/core';
import { lazyPeer } from '../shared/peer';

// SANITIZER's helpers are the only things here that need the real `joi`
// module (they build schemas); `applyJoiSanitization` only ever calls
// `.validate()` on a schema an app already built, so it needs joi's *types*
// only (erased at compile time, imported above as `import type`).
const getJoi = lazyPeer<typeof Joi>('joi', 'SANITIZER / @Sanitize');

/**
 * Ready-made Joi schema builders for use inside `@Sanitize` configs and DTO
 * validation. Grouped by category:
 * - `string` — `trim()`, `email()` (trim + lowercase), `name()` (2–50 chars,
 *   letters/spaces/hyphens), `slug()` (lowercase `a-z0-9-`), `phone()`.
 * - `number` — `integer()`, `positive()`, `range(min, max)`.
 * - `object` — `stripUnknown(schema)`, `withDefaults(schema)`.
 * - `date` — `iso()`, `timestamp()`.
 * - `xss()` — strips `javascript:` / `data:` URIs, inline `on*=` handlers, and
 *   `<script>` blocks from a string.
 *
 * @example
 * @Sanitize({
 *   type: 'body',
 *   schema: Joi.object({ email: SANITIZER.string.email(), bio: SANITIZER.xss() }),
 * })
 */
export const SANITIZER = {
  string: {
    trim: () => getJoi().string().trim(),
    email: () => getJoi().string().email().trim().lowercase(),
    name: () =>
      getJoi()
        .string()
        .trim()
        .min(2)
        .max(50)
        .pattern(/^[a-zA-Z\s-]+$/),
    slug: () =>
      getJoi()
        .string()
        .trim()
        .lowercase()
        .pattern(/^[a-z0-9-]+$/),
    phone: () =>
      getJoi()
        .string()
        .trim()
        .pattern(/^[\d\s\+\-\(\)]+$/),
  },

  number: {
    integer: () => getJoi().number().integer(),
    positive: () => getJoi().number().positive(),
    range: (min: number, max: number) => getJoi().number().min(min).max(max),
  },

  object: {
    stripUnknown: (schema: Joi.Schema) => getJoi().object(schema).unknown(false),
    withDefaults: (schema: Joi.Schema) => getJoi().object(schema).options({ stripUnknown: true }),
  },

  date: {
    iso: () => getJoi().date().iso(),
    timestamp: () => getJoi().date().timestamp(),
  },

  xss: () =>
    getJoi()
      .string()
      .custom((value) => {
        if (typeof value !== 'string') return value;
        const sanitized = value
          .replace(/javascript:/gi, '')
          .replace(/on\w+=/gi, '')
          .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
          .replace(/data:/gi, '');
        return sanitized;
      }, 'XSS sanitization'),
};

/**
 * @internal Runs one {@link SanitizerConfig} against `value` with Joi, honoring
 * `action` (`'validate'` disables coercion/defaults, `'sanitize'` coerces without
 * failing on required-field absence, `'both'` does a normal validate+convert).
 * Never throws — validation failures come back as `error`.
 */
export function applyJoiSanitization(
  value: unknown,
  config: SanitizerConfig
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): { value: any; error?: Joi.ValidationError } {
  if (!['headers', 'body', 'params', 'query'].includes(config.type)) {
    return { value };
  }
  if (value === null || value === undefined) {
    return { value };
  }

  const action = config.action || 'both';
  const options: Joi.ValidationOptions = {
    convert: true,
    stripUnknown: config.stripUnknown ?? true,
    abortEarly: false,
    ...config.options,
  };

  try {
    let result: Joi.ValidationResult;

    switch (action) {
      case 'validate':
        result = config.schema.validate(value, { ...options, convert: false, noDefaults: true });
        break;

      case 'sanitize':
        result = config.schema.validate(value, {
          ...options,
          convert: true,
          presence: 'optional',
          noDefaults: false,
        });
        break;

      case 'both':
      default:
        result = config.schema.validate(value, options);
        break;
    }

    return {
      value: result.value,
      error: result.error,
    };
  } catch (error) {
    return {
      value,
      error: error as Joi.ValidationError,
    };
  }
}

/**
 * @internal Applies one {@link SanitizerConfig} to the matching part of
 * `request` (`request[config.type]`), writing the sanitized value back and
 * throwing the Joi `ValidationError` on failure. Used by the `@Sanitize`
 * decorator's compiled middleware and the global `sanitizers` config.
 */
export const sanitizeRequest = (request: Request, config: SanitizerConfig) => {
  const { value, error } = applyJoiSanitization(request[config.type], config);

  if (error) throw error;
  request[config.type] = value;
};
