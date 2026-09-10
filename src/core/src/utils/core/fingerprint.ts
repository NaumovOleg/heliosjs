import { createHash, createHmac } from 'node:crypto';
import type { Request } from '../../types/core/request';
import type {
  FingerprintComponent,
  FingerprintConfig,
} from '../../types/core/fingerprint';

/**
 * Request attributes hashed into a fingerprint when no component set is
 * configured: `['ip', 'userAgent', 'acceptLanguage']`. `acceptEncoding` is
 * available but excluded by default (too coarse). Override per-scope with
 * `@UseFingerprint({ components })` or globally with `setFingerprintConfig`.
 */
export const DEFAULT_COMPONENTS: FingerprintComponent[] = [
  'ip',
  'userAgent',
  'acceptLanguage',
];

const toStr = (v: string | string[] | undefined): string =>
  Array.isArray(v) ? v.join(',') : (v ?? '');

const COMPONENT_EXTRACTORS: Record<FingerprintComponent, (req: Request) => string> = {
  ip: (req) => req.getClientIp(),
  userAgent: (req) => req.userAgent ?? '',
  acceptLanguage: (req) => toStr(req.getHeader('accept-language')),
  acceptEncoding: (req) => toStr(req.getHeader('accept-encoding')),
};

let config: FingerprintConfig | undefined;

/**
 * Sets the process-wide fingerprinting policy used by `@Fingerprint()` and
 * `@UseFingerprint()` (and, by default, as the `@RateLimit` bucket key). Adapters
 * call this from `@Server({ fingerprint })` / `new Helios(ctrl, { fingerprint })`.
 *
 * @param cfg - {@link FingerprintConfig}:
 *   - `secret` — when set, components are HMAC-SHA-256'd with it instead of a
 *     plain SHA-256. Why: makes fingerprints unforgeable and non-correlatable
 *     across deployments.
 *   - `components` — which attributes to hash, from `'ip'`, `'userAgent'`,
 *     `'acceptLanguage'`, `'acceptEncoding'`. Defaults to {@link DEFAULT_COMPONENTS}.
 *     Why: trade stability vs uniqueness (more components = more unique but more
 *     churn).
 *   - `compute` — `(req) => string` full override that bypasses components and
 *     hashing entirely. Why: fingerprint by an app-specific value (device id,
 *     API key).
 *   Pass `undefined` to reset to defaults.
 */
export function setFingerprintConfig(cfg: FingerprintConfig | undefined): void {
  config = cfg;
}

/**
 * Returns the current fingerprint config, or `undefined` when defaults apply.
 */
export function getFingerprintConfig(): FingerprintConfig | undefined {
  return config;
}

/**
 * Computes the fingerprint string for a request from the configured policy
 * (or the given `overrideComponents`). Does **not** cache — use
 * {@link getOrComputeFingerprint} inside the request pipeline.
 *
 * @param req - The request to fingerprint.
 * @param overrideComponents - Component subset for this call only, overriding the
 *   configured/default set. Ignored when a `compute` override is configured.
 * @returns Hex digest (HMAC-SHA-256 if a `secret` is set, else SHA-256), or the
 *   raw string from a configured `compute` override.
 */
export function computeFingerprint(
  req: Request,
  overrideComponents?: FingerprintComponent[],
): string {
  const cfg = config ?? {};
  if (cfg.compute) return cfg.compute(req);

  const components = overrideComponents ?? cfg.components ?? DEFAULT_COMPONENTS;
  const raw = components.map((c) => COMPONENT_EXTRACTORS[c](req)).join('|');

  return cfg.secret
    ? createHmac('sha256', cfg.secret).update(raw).digest('hex')
    : createHash('sha256').update(raw).digest('hex');
}

/**
 * Returns the request's fingerprint, computing and caching it in request state
 * (`getState('fingerprint')`) on first call. Idempotent and cheap to call from
 * multiple places (guards, interceptors, rate limiter, `@Fingerprint()`).
 *
 * @param req - The request.
 * @param overrideComponents - Component subset used only if the fingerprint is
 *   not already cached.
 * @returns The cached-or-freshly-computed fingerprint string.
 */
export function getOrComputeFingerprint(
  req: Request,
  overrideComponents?: FingerprintComponent[],
): string {
  const existing = req.getState<string>('fingerprint');
  if (existing !== undefined) return existing;
  const fp = computeFingerprint(req, overrideComponents);
  req.setState('fingerprint', fp);
  return fp;
}
