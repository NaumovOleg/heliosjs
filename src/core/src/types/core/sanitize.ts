import type * as Joi from 'joi';

/** One Joi-backed rule accepted by `@Sanitize` and the global `sanitizers` config. */
export interface SanitizerConfig {
  /** Joi schema to run against the targeted request part. */
  schema: Joi.Schema;
  /**
   * What to do with the schema result: `'validate'` (reject with
   * `ValidationError` on mismatch, request unchanged), `'sanitize'` (apply the
   * coerced/stripped value back onto the request, no rejection), or `'both'`
   * (validate and write back). Default `'both'`.
   */
  action?: 'validate' | 'sanitize' | 'both';
  /** Joi `ValidationOptions` passed through to `schema.validate`. */
  options?: Joi.ValidationOptions;
  /** Drop keys not present in the schema. */
  stripUnknown?: boolean;
  /** Which request part this rule targets. */
  type: 'headers' | 'body' | 'params' | 'query';
}
