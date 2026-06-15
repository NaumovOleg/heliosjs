import type { Request } from './request';

export type FingerprintComponent =
  | 'ip'
  | 'userAgent'
  | 'acceptLanguage'
  | 'acceptEncoding';

export interface FingerprintConfig {
  /** When set, components are HMAC-SHA-256'd with this secret; else plain SHA-256. */
  secret?: string;
  /** Component set to hash. Defaults to DEFAULT_COMPONENTS when omitted. */
  components?: FingerprintComponent[];
  /** Full override: compute the fingerprint string directly, bypassing components + hashing. */
  compute?: (req: Request) => string;
}
