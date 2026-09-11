---
"@heliosjs/core": patch
"@heliosjs/http": patch
"@heliosjs/aws": patch
"@heliosjs/middlewares": patch
"@heliosjs/grpc": patch
---

Bug-fix and cleanup pass across the request pipeline (see `.planning/audit-fixes-2026-09.md`
for the full list). Some of these are user-visible behavior changes, not just internal fixes:

- `res.stream()` now actually pipes a readable instead of `JSON.stringify`-ing it; `res.buffer()`
  and Buffer response bodies are no longer corrupted (Lambda responses are base64-encoded when
  the body is binary).
- Lambda: responses now emit `response.cookies` (previously echoed the request's cookies).
- Malformed JSON request bodies now reply `400` instead of passing the raw string through to the
  handler.
- `HEAD` requests now fall back to the matching `GET` handler (body suppressed) instead of 404ing
  when no explicit `@Head` route exists.
- New `trustProxy` option (`http` default `false`, `aws` default `true`): `X-Forwarded-*` headers
  are only trusted when explicitly enabled — previously always trusted, which let a client spoof
  its IP into rate-limit/fingerprint keys.
- `@Headers`/`@Cookies`/`@Files` accept a DTO for validation; header lookups (including CORS) are
  case-insensitive.
- Route-array middlewares (`@Use([a, b])`) now run in declared order (previously reversed).
- Multipart text fields keep their original string type instead of being blanket `JSON.parse`d.
- `MemoryStore` (rate limiting) is now bounded (default 10k entries, drop-oldest) instead of
  growing unboundedly under a large/hostile key space.

Plus perf work (single request pipeline, O(n²)→O(n) param resolution, shared MIME table) and
dead-code removal with no behavior change.
