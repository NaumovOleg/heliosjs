import { createParamDecorator } from '@utils';

/**
 * Parameter decorator to inject AWS lambda event.
 */
export const LambdaEvent = () => createParamDecorator('event');

/**
 * Parameter decorator to inject AWS lambda context.
 */
export const LambdaContext = () => createParamDecorator('context');
