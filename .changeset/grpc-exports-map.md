---
"@heliosjs/grpc": patch
---

Added a package.json `exports` map restricting the public surface to the package root, matching `@heliosjs/core`'s existing shape — closes a deep-import path (`@heliosjs/grpc/dist/...`) that was never intentionally supported. No behavior change.
