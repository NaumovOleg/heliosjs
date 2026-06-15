import type { RateLimitConfig } from '../../../types/core/ratelimit';

let config: RateLimitConfig | undefined;

export function setRateLimitConfig(cfg: RateLimitConfig | undefined): void {
  config = cfg;
}

export function getRateLimitConfig(): RateLimitConfig | undefined {
  return config;
}
