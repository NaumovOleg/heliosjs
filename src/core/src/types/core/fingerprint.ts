import type { Request } from './request';

/**
 * Request attributes that can be hashed into a fingerprint:
 * `'ip'` (client IP), `'userAgent'`, `'acceptLanguage'`, `'acceptEncoding'`.
 * See {@link DEFAULT_COMPONENTS} for the default set.
 */
export type FingerprintComponent =
  | 'ip'
  | 'userAgent'
  | 'acceptLanguage'
  | 'acceptEncoding';

/** Global fingerprinting policy set via `setFingerprintConfig` / `@Server({ fingerprint })`. */
export interface FingerprintConfig {
  /** When set, components are HMAC-SHA-256'd with this secret; else plain SHA-256. */
  secret?: string;
  /** Component set to hash. Defaults to DEFAULT_COMPONENTS when omitted. */
  components?: FingerprintComponent[];
  /** Full override: compute the fingerprint string directly, bypassing components + hashing. */
  compute?: (req: Request) => string;
}
