import type { ErrorDetails, IValidationError } from '../../../types/core/error';
import { ErrorCode } from '../../../types/core/error';
import { BaseError } from './base';

/**
 * Request data failed schema/DTO validation. Code `VALIDATION_FAILED`,
 * HTTP **400**, message always `'Validation failed'` with the per-field errors in
 * `details`. Thrown automatically by the `@Body`/`@QueryParam`/… DTO path and by
 * `@Sanitize`; throw it yourself for custom cross-field rules.
 *
 * Unlike 401/403/404/429 this is **not** self-resolving — a route-level `@Catch`
 * always sees it.
 *
 * @example
 * if (start > end) {
 *   throw new ValidationError([
 *     { field: 'start', constraint: 'must be before end', value: start },
 *   ]);
 * }
 */
export class ValidationError extends BaseError implements IValidationError {
  public readonly code = ErrorCode.VALIDATION_FAILED;
  public readonly status = 400;

  /**
   * @param details - One entry per failed field: `{ field?, value?, constraint?,
   *   … }` (also accepts class-validator's `{ property, constraints, children }`
   *   shape). Becomes `error.details` in the response. Why: the client renders
   *   field-level messages from this.
   * @param options - Optional `{ requestId, path }` request context.
   */
  constructor(details: ErrorDetails[], options?: { requestId?: string; path?: string }) {
    super(ErrorCode.VALIDATION_FAILED, 'Validation failed', {
      status: 400,
      details,
      requestId: options?.requestId,
      path: options?.path,
    });
    this.name = 'ValidationError';
  }
}
