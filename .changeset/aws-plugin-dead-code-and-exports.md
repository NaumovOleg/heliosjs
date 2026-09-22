---
"@heliosjs/aws": patch
---

Removed dead code in the plugin system: a plugin's `middleware` field was collected into a `middlewares` array that nothing in the AWS adapter ever read (`@heliosjs/aws` has no middleware-chain concept anywhere — that's an HTTP-only feature). Setting `middleware` on an AWS plugin silently did nothing before this change and silently does nothing after it; this only removes unused internal state, it isn't a behavior change for any working setup. The plugin dispatcher itself is now shared with `@heliosjs/http`/`@heliosjs/azure` via `@heliosjs/core`'s new `PluginDispatch` — an internal refactor, `Plugin`'s public shape is unchanged.

Also added a package.json `exports` map restricting the public surface to the package root, matching `@heliosjs/core`'s existing shape — closes a deep-import path (`@heliosjs/aws/dist/...`) that was never intentionally supported.
