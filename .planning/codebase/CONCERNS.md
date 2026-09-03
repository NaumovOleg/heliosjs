# Codebase Concerns

**Analysis Date:** 2026-09-03

## Tech Debt

**NPM Token committed to `.env`:**
- Issue: `NPM_TOKEN` is visible in `.env` file which may be committed
- Files: `.env`
- Impact: Secret exposure in version control
- Fix: Add `.env` to `.gitignore`, use CI secrets

**Minimal test coverage scope:**
- Issue: Coverage thresholds only apply to 3 files out of 100+ source files
- Files: `vitest.config.ts`
- Impact: Most code paths untested, regressions possible
- Fix: Expand coverage scope to all packages

**No E2E tests:**
- Issue: No HTTP server lifecycle or Lambda integration tests
- Files: `__tests__/`
- Impact: Integration issues undetected until deployment
- Fix: Add server startup/shutdown tests, Lambda handler tests

## Known Bugs

**Route matching specificity is dead code:**
- Symptoms: Wildcard routes declared before specific routes always win
- Files: `src/core/src/utils/core/match.ts`
- Test: `__tests__/core/match.test.ts:38-44`
- Trigger: Declaring `/*` before `/users`
- Workaround: Declare specific routes before wildcards

## Security Considerations

**NPM token in repository:**
- Risk: Token exposure allows unauthorized npm package publishing
- Files: `.env`
- Current mitigation: None visible
- Recommendations: Rotate token immediately, add `.env` to `.gitignore`, use GitHub secrets

**No input sanitization framework:**
- Risk: User input not systematically sanitized
- Files: N/A
- Current mitigation: Manual sanitization in handlers
- Recommendations: Add built-in sanitization middleware or decorator

## Performance Bottlenecks

**No performance concerns detected:**
- Framework is lightweight with minimal overhead
- Rate limiting uses in-memory store by default (fine for single instance)

## Fragile Areas

**Controller compilation:**
- Files: `src/core/src/utils/core/controller.ts`, `src/http/src/Helios.ts:319-345`
- Why fragile: Complex metadata reflection and prototype manipulation
- Safe modification: Test with real decorator scenarios
- Test coverage: Partial (`pipeline-execute.test.ts`)

**Decorator metadata dependency:**
- Files: All decorator files
- Why fragile: Requires `reflect-metadata` polyfill; metadata key conflicts possible
- Safe modification: Use existing `defineControllerMeta`/`defineMiddlewaresMeta` helpers
- Test coverage: Good for core decorators

## Scaling Limits

**Single-instance rate limiting:**
- Current capacity: Unlimited (in-memory)
- Limit: Resets on server restart; no cross-instance sync
- Scaling path: Implement `RateLimitStore` interface with Redis (strategy pattern exists)

**No WebSocket horizontal scaling:**
- Current capacity: Single process
- Limit: WebSocket connections tied to one server
- Scaling path: Use sticky sessions or external WebSocket service

## Dependencies at Risk

**`type-graphql` 2.0.0-rc.3:**
- Risk: Release candidate, API may change
- Impact: GraphQL integration in `@heliosjs/http`
- Migration plan: Pin version, monitor releases

**`@grpc/grpc-js` 1.14.3:**
- Risk: Pinned in resolutions, may lag behind releases
- Impact: gRPC server/client functionality
- Migration plan: Update when stable

## Missing Critical Features

**No health check endpoint:**
- Problem: No built-in `/health` or `/ready` endpoint
- Blocks: Kubernetes deployments, load balancer health checks
- Workaround: Add manually in controller

**No graceful shutdown:**
- Problem: `Helios.close()` exists but no signal handling
- Blocks: Clean container/pod termination
- Workaround: Add `SIGTERM`/`SIGINT` handlers manually

## Test Coverage Gaps

**Lambda adapter (`@heliosjs/aws`):**
- What's not tested: Event normalization, response formatting, CORS handling
- Files: `src/aws/src/lambda.ts`, `src/aws/src/utils/aws/*.ts`
- Risk: Lambda deployment failures undetected
- Priority: High

**gRPC server/client (`@heliosjs/grpc`):**
- What's not tested: Service registration, method dispatch, streaming
- Files: `src/grpc/src/server.ts`, `src/grpc/src/client.ts`
- Risk: gRPC integration failures undetected
- Priority: Medium

**HTTP server lifecycle:**
- What's not tested: `listen()`, `close()`, plugin hooks
- Files: `src/http/src/Helios.ts`
- Risk: Server startup/shutdown issues undetected
- Priority: Medium

**WebSocket/SSE:**
- What's not tested: Connection handling, event dispatch
- Files: `src/core/src/utils/socket/`, `src/core/src/utils/sse/`
- Risk: Real-time features undetected
- Priority: Low

---

*Concerns audit: 2026-09-03*
