---
'@heliosjs/core': patch
'@heliosjs/http': patch
---

Performance optimizations closing ~20% of the gap to Fastify:

- **Compiled route regex**: Pre-compile route regex patterns at startup (`compileRouteRegex`), stored as `route.compiledRegex` for fast matching in `matchRoutes()`
- **Pre-partitioned middleware**: Build `CompiledMiddleware` (guards, pipes, middlewares, interceptors, error handlers, CORS, rate limits) once at startup instead of filtering per-request
- **Lazy body parsing**: Skip `collectRawBody()` for GET/HEAD/OPTIONS requests that don't need it
- **Single URL allocation**: Pass pre-allocated `requestUrl` into `Request` constructor to avoid repeated `new URL()` calls
- **Pre-compiled param extractor**: Build regex-based param extractor once per route at startup, stored as `route.compiledParamExtractor`

Results: Helios ~80.5k req/s (was ~72.9k, +10.5%), now at ~78% of Fastify's throughput (was ~72%). All 1349 tests passing.
