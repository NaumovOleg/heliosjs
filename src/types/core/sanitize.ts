import * as Joi from 'joi';

export interface SanitizerConfig {
  schema: Joi.Schema;
  action?: 'validate' | 'sanitize' | 'both';
  options?: Joi.ValidationOptions;
  stripUnknown?: boolean;
  type: 'headers' | 'body' | 'params' | 'query';
}
