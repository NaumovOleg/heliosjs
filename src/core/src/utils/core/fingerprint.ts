import { createHash, createHmac } from 'node:crypto';
import type { Request } from '../../types/core/request';
import type {
  FingerprintComponent,
  FingerprintConfig,
} from '../../types/core/fingerprint';

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

export function setFingerprintConfig(cfg: FingerprintConfig | undefined): void {
  config = cfg;
}

export function getFingerprintConfig(): FingerprintConfig | undefined {
  return config;
}

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
