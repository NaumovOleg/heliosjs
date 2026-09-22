# @heliosjs/azure

## 1.0.1

### Patch Changes

- 6d4c604: `Plugin`'s dispatch logic (register/run hooks/run `onInit`) is now built on `@heliosjs/core`'s new shared `PluginDispatch`, shared with `@heliosjs/http`/`@heliosjs/aws`, instead of an independently-maintained copy. Internal refactor — `Plugin`'s public shape and behavior are unchanged.

  Also added a package.json `exports` map restricting the public surface to the package root, matching `@heliosjs/core`'s existing shape — closes a deep-import path (`@heliosjs/azure/dist/...`) that was never intentionally supported.

- Updated dependencies [6d4c604]
- Updated dependencies [4dedaeb]
  - @heliosjs/core@4.0.7
