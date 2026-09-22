---
"@heliosjs/core": patch
---

Added `PluginDispatch` (`@heliosjs/core/utils`) and `IRequestFactory` (`@heliosjs/core/types`) — internal plumbing shared by `@heliosjs/http`, `@heliosjs/aws`, and `@heliosjs/azure`'s own plugin systems and request factories, replacing three independently-copied implementations. Purely additive; nothing existing in `@heliosjs/core`'s public surface changed.
