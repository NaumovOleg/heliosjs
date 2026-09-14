---
"@heliosjs/http": patch
"@heliosjs/aws": patch
---

Fix an unhandled promise rejection in `Plugin.usePlugin()`: `plugin.onInit?.(this)` discarded the returned promise, so an async `onInit` that rejected produced an unhandled rejection instead of a logged error. `usePlugin` now attaches a `.catch` that logs through the global logger, matching the fix already applied to `@heliosjs/azure`'s `Plugin`.
