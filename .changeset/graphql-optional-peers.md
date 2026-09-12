---
"@heliosjs/http": major
---

`graphql-yoga` and `type-graphql` move from regular `dependencies` to optional
`peerDependencies`, alongside `graphql-ws` which is newly declared there.

All three were already loaded lazily via dynamic `import()` only when
`config.graphql` is set, so nothing changes for consumers who don't use the
GraphQL feature. Consumers who do enable it now need to install
`graphql-yoga`, `type-graphql`, and `graphql-ws` themselves — `graphql-ws`
was never actually declared as a dependency of this package (it only worked
inside this monorepo by accident, hoisted from the workspace root); a
standalone install of `@heliosjs/http` with GraphQL enabled would throw
`Cannot find module 'graphql-ws/use/ws'` at runtime.

This matches the peer-optional pattern `@heliosjs/core` already uses for its
own optional validators (`ajv`, `class-validator`, `joi`).
