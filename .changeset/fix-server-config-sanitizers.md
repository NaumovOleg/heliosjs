---
"@heliosjs/http": patch
---

Fix `@Server({ sanitizers: [...] })` being silently ignored. `resolveConfig`
read global sanitizers from `Reflect.getMetadata(SANITIZE, ...)`, a metadata
key nothing in this codebase ever writes to — the `@Sanitize` decorator uses
a different mechanism entirely — so the documented `ServerConfig.sanitizers`
option had no effect regardless of what was passed. It now reads directly
from the resolved config object, like `cors` and `controllers` already do.
