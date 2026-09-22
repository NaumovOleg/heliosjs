---
"@heliosjs/core": patch
---

Added `PluginDispatch` (`@heliosjs/core/utils`) and `IRequestFactory` (`@heliosjs/core/types`) — internal plumbing shared by `@heliosjs/http`, `@heliosjs/aws`, and `@heliosjs/azure`'s own plugin systems and request factories, replacing three independently-copied implementations. Purely additive; nothing existing in `@heliosjs/core`'s public surface changed. A plugin's `onInit(app)` runs as a real method call (`this` inside it is the plugin object itself, same as calling `plugin.onInit(app)` directly), and a synchronous throw from `onInit` is caught and logged the same way an async rejection already was — both are now consistent across `@heliosjs/http`/`@heliosjs/aws`/`@heliosjs/azure`.
