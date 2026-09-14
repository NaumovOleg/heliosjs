---
"@heliosjs/core": patch
---

Fix `@Catch` handlers running twice for one error. `execute()` called `beforeRequest()` (sanitizers/guards/pipes/middlewares) inside its own try block; `beforeRequest()` already runs the route's error handlers itself on failure and only rethrows when none of them resolve the error, but `execute()`'s catch then ran the exact same handlers a second time on that rethrow. Any `@Catch` handler using a log-and-passthrough pattern (log, then let the error propagate) fired twice for every error originating in the sanitizer/guard/pipe/middleware stage. `beforeRequest()`'s own errors are now finalized directly, without a second dispatch.
