---
"@heliosjs/middlewares": patch
---

Fix two bugs found in `@Roles` and `@Cors`:

- `@Roles(...)` only checked its *last* argument for an options object, so `@Roles({ mode: 'all' }, 'admin')` silently dropped the options and fell back to the weaker `'any'` mode instead of erroring or applying it. `normalizeArgs` now finds the options object at any argument position.
- `@Cors()`'s default `methods` list included `ANY`, a framework-internal routing marker (not a real HTTP verb), in `Access-Control-Allow-Methods`. It's now filtered out of the default.

Also corrected `@UseFingerprint`'s docs, which claimed a `@Guard` on the same route can read the fingerprint it attaches — guards run before the middleware stage `@UseFingerprint` registers into, so they never see it; a guard that needs the fingerprint should call `getOrComputeFingerprint(req)` directly.
