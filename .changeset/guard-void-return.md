---
"@heliosjs/core": patch
---

`GuardFunction`/`GuardInstance.canActivate`'s "returns nothing" case is now typed as `void` instead of `undefined`. A separately-declared guard function or method with no `return` statement (whether its return type is inferred or explicitly annotated `void`) is inferred as `void`, not `undefined`, by TypeScript outside of inline-callback contextual typing — so assigning one to a `GuardFunction`-typed variable, or implementing `GuardInstance`, previously failed to compile (`Type 'void' is not assignable to type '...'`). Runtime behavior is unchanged: a guard that returns nothing still allows the request.
