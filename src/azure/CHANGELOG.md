# @heliosjs/azure

## 2.0.0

### Major Changes

- Harden request processing and transport boundaries across all packages. This release adds fail-closed CORS validation, safer error serialization, security headers, request and message limits, trusted-proxy and canonical-host handling, static-file traversal protection, WebSocket/SSE authentication and backpressure controls, safer multipart and DTO validation, CSRF protection, and hardened AWS, Azure, and gRPC adapters.

### Patch Changes

- Updated dependencies
  - @heliosjs/core@5.0.0

## 1.0.1

### Patch Changes

- 6d4c604: `Plugin`'s dispatch logic (register/run hooks/run `onInit`) is now built on `@heliosjs/core`'s new shared `PluginDispatch`, shared with `@heliosjs/http`/`@heliosjs/aws`, instead of an independently-maintained copy. Internal refactor — `Plugin`'s public shape and behavior are unchanged.

  Also added a package.json `exports` map restricting the public surface to the package root, matching `@heliosjs/core`'s existing shape — closes a deep-import path (`@heliosjs/azure/dist/...`) that was never intentionally supported.

- Updated dependencies [6d4c604]
- Updated dependencies [4dedaeb]
  - @heliosjs/core@4.0.7
