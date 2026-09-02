# Change Log

## 3.2.1

### Patch Changes

- yarn version-packages
- route fixes

## 3.2.0

### Minor Changes

- added http query method support

## 4.0.0

### Major Changes

- Add support for the HTTP `QUERY` method.

  - `HTTP_METHODS.QUERY` was added to the method enum.
  - A new `@Query(path, middlewares)` endpoint decorator registers a `QUERY` route.

  **Breaking:** the `@Query()` parameter decorator, which extracts query string
  parameters from the URL, is renamed to `@QueryParam()`. The name `Query` now
  belongs to the endpoint decorator.

  ```diff
  -  @Get('/search')
  -  search(@Query('q') q: string) {}
  +  @Get('/search')
  +  search(@QueryParam('q') q: string) {}
  ```

## 3.1.16

### Patch Changes

- rate limit

## 3.1.15

### Patch Changes

- fingerprint

## 3.1.14

### Patch Changes

- roles guard

## 3.1.13

### Patch Changes

- Stabilyzed dependency
- Improve source-code documentation quality and stabilize dependency management across the monorepo.

  - add comprehensive JSDoc for primary runtime usage methods (HTTP, Lambda, gRPC, WebSocket, SSE)
  - standardize and pin dependency versions for deterministic installs
  - align changesets publishing behavior for public npm packages

## 3.1.12

### Patch Changes

- version fixes

## 3.1.11

### Patch Changes

- removed console

## 3.1.10

### Patch Changes

- fixed error handling

## 3.1.9

### Patch Changes

- route fix

## 3.1.8

### Patch Changes

- fixed pipe type

## 3.1.7

### Patch Changes

- Refactored controller prototype

## 3.1.6

### Patch Changes

- fix

## 3.1.5

### Patch Changes

- fix

## 3.1.4

### Patch Changes

- chore

## 3.1.3

### Patch Changes

- fix

## 3.1.2

### Patch Changes

- fix

## 3.1.3

### Patch Changes

- guard

## 3.1.2

### Patch Changes

- guard

## 3.1.1

### Patch Changes

- feat(guard): added types

## 3.1.0

### Minor Changes

- middlewares order

## 3.0.0

### Major Changes

- restructured dependencies

## 2.4.10

### Patch Changes

- fix

## 2.4.9

### Patch Changes

- fix

## 2.4.8

### Patch Changes

- fix

## 2.4.7

### Patch Changes

- fix

## 2.4.6

### Patch Changes

- fix

## 2.4.5

### Patch Changes

- fic(parser)

## 2.4.4

### Patch Changes

- body parser

## 2.4.3

### Patch Changes

- fix

## 2.4.2

### Patch Changes

- fix

## 2.4.1

### Patch Changes

- fix

## 2.4.0

### Minor Changes

- hashes

## 2.3.0

### Minor Changes

- 3a3127e: added grpc

### Patch Changes

- 3a3127e: chore

## 2.2.0

### Minor Changes

- 6716ef1: added grpc

### Patch Changes

- bump
- 6716ef1: chore

## 2.1.4

### Patch Changes

- chore

## 2.1.3

### Patch Changes

- type fixes

## 2.1.2

### Patch Changes

- chore

## 2.1.1

### Patch Changes

- 38a9d8a: fix

## 2.1.0

### Minor Changes

- refactored controllers

## 2.0.0

### Major Changes

- meta

### Patch Changes

- 266a867: fixes

## 1.4.1

### Patch Changes

- a0ee0fc: http fixes

## 1.4.0

### Minor Changes

- 73d74d9: routing

### Patch Changes

- daf13f1: exported custom errors

## 1.3.5

### Patch Changes

- b396669: test

## 1.3.4

### Patch Changes

- d0a4da9: fixes
- c103eb9: fixes

## 1.3.2

### Patch Changes

- 14def7d: feat(workflow-fixes)

All notable changes to this project will be documented in this file.
See [Conventional Commits](https://conventionalcommits.org) for commit guidelines.

## 1.3.1 (2026-03-29)

### Bug Fixes

- **aws:** fixed lambda handler

## 1.0.16 (2026-03-29)

### Bug Fixes

- **aws:** fixed lambda handler

## 1.0.11 (2026-03-29)

### Bug Fixes

- **aws:** fixed lambda handler
