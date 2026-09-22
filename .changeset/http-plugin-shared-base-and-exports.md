---
"@heliosjs/http": patch
---

`Plugin`'s dispatch logic (register/run hooks/run lifecycle methods) is now built on `@heliosjs/core`'s new shared `PluginDispatch`, shared with `@heliosjs/aws`/`@heliosjs/azure`, instead of an independently-maintained copy. Internal refactor — `Plugin`'s public shape and behavior are unchanged.

Also added a package.json `exports` map restricting the public surface to the package root, matching `@heliosjs/core`'s existing shape — closes a deep-import path (`@heliosjs/http/dist/...`) that was never intentionally supported.
