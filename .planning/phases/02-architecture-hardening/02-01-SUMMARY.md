---
phase: 02-architecture-hardening
plan: 01
status: done
commits:
  - 691eaa0 chore: add exports maps to http/aws/azure/grpc/middlewares package.json
  - 45c015b chore(lint): reject cross-package src/dist imports between @heliosjs packages
  - 1d93827 refactor(core): share Plugin dispatch across http/aws/azure
  - 8720930 chore(core): shared RequestFactory interface for http/aws/azure
  - ee1bdb6 test(aws): add end-to-end plugin-pipeline coverage
  - 220439a test(azure): add end-to-end plugin-pipeline coverage
  - 112bdb6 test(grpc): add end-to-end wire test
  - 6d4c604 docs: changesets for architecture-hardening work
---

## Result

Closed the P0/P1 tier of the architecture audit (DI/module-system/gRPC-plugin work
stayed explicitly out of scope per the user's own choice). Two enforcement layers now
lock in package boundaries (exports maps + lint), three copy-pasted `Plugin`
dispatchers became one shared `PluginDispatch` in core, `RequestFactory` signatures
are pinned by a compile-time contract, and aws/azure/grpc's previously-empty `e2e`
directories now hold real end-to-end tests.

## Real bug found and fixed (not just architecture score)

AWS's `Plugin.usePlugin()` collected a plugin's `middleware` into a `middlewares`
array that `lambda.ts` never read anywhere — `@heliosjs/aws` has no middleware-chain
concept at all. Setting `middleware` on an AWS plugin silently did nothing. This was
exactly the kind of drift copy-pasted code produces: two existing unit tests
(`__tests__/aws/unit/plugin.test.ts`) were asserting on the dead behavior, which is
how it went unnoticed. Removed (not carried into the shared base), tests rewritten
to document the actual (inert) behavior.

## Numbers

- Plugin triplication: −192/+124 lines net across http/aws/azure/core (one 83-line
  shared implementation replacing ~150 lines of copy-pasted dispatch logic).
- New tests: 2 (aws e2e) + 2 (azure e2e) + 2 (grpc e2e, real wire) = 6 new tests
  across 3 previously-empty `e2e` directories.
- Coverage: 98.1%→98.14% stmts, 90.52% branches (flat), 98.98%→99.15% functions,
  98.61%→98.64% lines — gate is 95/88/96/96, all still comfortably clear.
- 6 changesets, all patch: core 4.0.6→4.0.7, aws/http/middlewares 11.0.3→11.0.4
  (linked group), azure 1.0.0→1.0.1, grpc 2.1.19→2.1.20.

## Deviations from the plan

1. **File layout for the shared Plugin base**: plan speculated
   `utils/shared/plugin.ts`/`types/shared/plugin.ts` ("verify exact path at execution
   time"). Investigated core's actual convention (one file per concern in
   `utils/core/`/`types/core/`, e.g. `cors.ts`, `ratelimit/`) and used
   `utils/core/plugin.ts` instead — no `types/core/plugin.ts` was needed at all; the
   class's own generic parameters (`TPlugin`, `THooks`) were enough, no separate
   shared type interface required.

2. **RequestFactory's `create` is `static`**, so `implements IRequestFactory<...>`
   doesn't apply (TS only checks instance members that way). Used the standard
   assignment idiom instead: `const _x: IRequestFactory<...> = RequestFactory` right
   after each class. Verified it actually catches drift (temporarily changed aws's
   `create` to return `void`, confirmed the assignment failed to compile with the
   expected message, reverted).

3. **PluginHookKeys/PluginKeys type aliases removed** from all three adapters'
   `types/*/plugin.ts` (not in the original file list) — became fully unused after
   the class refactor inlined `keyof THooks`/`keyof TPlugin`, and were never part of
   any package's public root export (confirmed: each `index.ts` uses named
   re-exports, not a wildcard). Small, safe, zero-risk cleanup done in the same
   commit as the refactor that made them dead.

4. **Task 7's judgment call: wrote the gRPC e2e test**, didn't delete the directory.
   Every existing gRPC test (`__tests__/grpc/unit/*`) fully mocks `@grpc/grpc-js` and
   `@grpc/proto-loader` — substantial coverage of the internal glue, but nothing
   proving a real proto + real bound server + real client actually work together
   over a socket. Cost was small (one ~15-line `.proto` fixture), so it was written:
   `__tests__/grpc/e2e/grpc-wire.e2e.test.ts`, a real client/server pair over
   `127.0.0.1:50999` proving both a real request/response round trip and (the part a
   mock can't prove) real gRPC error-status propagation from a thrown handler. Ran it
   4x isolated + 3x as part of the full suite with no flakes before committing.
   `GrpcServer.start()` doesn't expose the OS-assigned port when binding to `:0`, so
   this uses a fixed port (matching how this repo's benchmark suites already pick
   fixed ports) rather than a genuinely-ephemeral one.

5. **Changeset scope**: the plan flagged "check before writing whether http's/azure's
   Plugin type shape actually changed — if unchanged, no changeset needed." Verified
   it's unchanged for both (their public root `index.ts` only re-exports the `Plugin`
   *interface* from `types/`, never the runtime class from `utils/` that actually
   changed) — but wrote changesets for them anyway, plus azure and grpc's
   exports-map-only changes: azure/grpc are version-independent (not in the
   `http`/`aws`/`middlewares` linked group), so without their own changeset the
   exports-map hardening would sit in git history without ever actually publishing to
   npm. http/middlewares get a synced bump regardless via the linked group (aws's
   real fix triggers it), but each still gets its own changeset entry so its
   CHANGELOG line is accurate instead of empty.

## Explicitly not done (per the plan and the user's own P0+P1 scope choice)

- DI/IoC container, `@Injectable`/`@Inject`, provider scopes.
- A NestJS-style `@Module` system.
- A plugin/hook system for gRPC (its streaming/proto request model doesn't map onto
  the existing `Hooks` shape without real design work; no evidence anyone needs it).
- Shared *runtime* normalization logic between http/aws/azure's `RequestFactory`
  (only the type contract is shared — Lambda/Azure/Node event shapes are genuinely
  different).

## Verify

```
yarn lint && yarn build && yarn test:coverage
npx changeset status --verbose   # confirms all 6 bumps are patch, core lands on 4.0.7
```
All green as of commit `6d4c604`.
