import * as Joi from 'joi';
import { IRequest, SanitizerConfig } from '../../types/core';

export const SANITIZER = {
  string: {
    trim: () => Joi.string().trim(),
    email: () => Joi.string().email().trim().lowercase(),
    name: () =>
      Joi.string()
        .trim()
        .min(2)
        .max(50)
        .pattern(/^[a-zA-Z\s-]+$/),
    slug: () =>
      Joi.string()
        .trim()
        .lowercase()
        .pattern(/^[a-z0-9-]+$/),
    phone: () =>
      Joi.string()
        .trim()
        .pattern(/^[\d\s\+\-\(\)]+$/),
  },

  number: {
    integer: () => Joi.number().integer(),
    positive: () => Joi.number().positive(),
    range: (min: number, max: number) => Joi.number().min(min).max(max),
  },

  object: {
    stripUnknown: (schema: Joi.Schema) => Joi.object(schema).unknown(false),
    withDefaults: (schema: Joi.Schema) => Joi.object(schema).options({ stripUnknown: true }),
  },

  date: {
    iso: () => Joi.date().iso(),
    timestamp: () => Joi.date().timestamp(),
  },

  xss: () =>
    Joi.string().custom((value, helpers) => {
      if (typeof value !== 'string') return value;
      const sanitized = value
        .replace(/javascript:/gi, '')
        .replace(/on\w+=/gi, '')
        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
        .replace(/data:/gi, '');
      return sanitized;
    }, 'XSS sanitization'),
};

export function applyJoiSanitization(
  value: any,
  config: SanitizerConfig,
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

export const sanitizeRequest = (request: IRequest, config: SanitizerConfig[]) => {
  config.forEach((conf) => {
    const { value, error } = applyJoiSanitization(request[conf.type], conf);

    if (error) throw error;
    request[conf.type] = value;
  });
};
