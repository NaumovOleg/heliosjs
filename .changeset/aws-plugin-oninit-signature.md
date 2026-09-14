---
"@heliosjs/aws": patch
---

Fix `Plugin.onInit`'s type signature and docs: it was declared as `onInit?(app, event, context)`, but `usePlugin()` only ever calls it with `app` — `event`/`context` were always `undefined`. Docs examples that read `context.functionName` inside `onInit` would throw at cold start. Signature is now `onInit?(app: ILambdaAdapter): void | Promise<void>`; docs moved the per-invocation logging examples to `hooks.beforeRequest`, which does get a live event/context.
