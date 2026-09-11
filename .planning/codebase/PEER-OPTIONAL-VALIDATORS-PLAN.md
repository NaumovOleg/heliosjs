# Plan: make ajv/class-validator/class-transformer/joi peer-optional in core

## Why

`@heliosjs/core` currently hard-`dependencies`-on four validation libraries
(`ajv`, `class-validator`, `class-transformer`, `joi`), all loaded eagerly
(top-level `import`) regardless of whether a given app uses `@Body(DtoClass)`,
`compileSchema()`, or `@Sanitize`. Every consumer installs and loads all four
even if they use none. User wants: core defines the validation *contract*
only (already exists — see below); which concrete validator runs is
something the app opts into by installing it, matching what the
`validation.md` doc already tells people to do ("npm install class-validator
class-transformer") but package.json doesn't currently require.

This is a **breaking change** for `class-validator`/`class-transformer`/`joi`
(already published as hard deps in 3.2.11 — a clean install today gets them
for free, tomorrow it won't). Needs a major changeset for `core` and a call-out
in release notes / the "Installation" doc sections. `ajv` is not breaking —
it was added in this session, never published.

## What's already the contract (no new abstraction needed)

`Dto = (new (...args) => any) | { from(data): any }` (`types/core/validation.ts`)
is already the strategy interface — anything with `.from()` plugs into
`@Body`/`@Params`/etc. with zero core changes. `compileSchema()` (ajv) is
already just one implementation of it. No `ValidationStrategy` interface/registry
needed — would be an unrequested abstraction over what duck-typing already
gives us.

## The actual mechanism: peerDependency + lazy `require`, not dynamic `import()`

Peer + optional in package.json only changes whether the package manager
*auto-installs* it — the code still needs the module *present at runtime* the
moment it's `import`ed, regardless of dependencies vs peerDependencies. So
every eager top-level `import` of these four has to become a **lazy load**,
deferred until the feature is actually used.

Verified: all four ship a working CJS `main` entry (`ajv` → `dist/ajv.js`,
`joi` → `lib/index.js`, `class-validator`/`class-transformer` → `cjs/index.js`),
so `createRequire(import.meta.url)('<pkg>')` works synchronously from this
ESM codebase — no `await import()`, no signature changes, no new async
call sites. This is the reason to prefer it over dynamic `import()`: every
call site (`compileSchema().from()`, `validate()`'s class branch, every
`SANITIZER.*` helper) stays exactly as synchronous/async as it is today.
Verified interop by hand (`node -e ...`):
- `require('ajv')` returns the constructor directly, and it also has
  `.default` pointing at itself (safe to read either way).
- `require('class-validator').validate` / `require('class-transformer').plainToInstance`
  are plain named properties (matches today's named imports).
- `require('joi').object` / `.string` are plain named properties (matches
  today's namespace import).

Type-only imports (`import type Ajv from 'ajv'`, `import type { ValidatorOptions } from 'class-validator'`,
etc.) stay as real `import type` statements — those are erased at compile
time, need the package's `.d.ts` present only when *this repo* builds core
(already true — all four are resolved in this monorepo already), and put no
runtime requirement on downstream consumers.

## Files to touch

1. **`src/core/src/utils/shared/validate.ts`**
   - Add a small `loadPeer<T>(name, feature)` + `lazy<T>(name, feature)` helper
     (module-private, ~10 lines) using `createRequire(import.meta.url)`, with a
     clear thrown error when `require` fails (`"<feature> needs the optional
     '<name>' peer dependency — install it: npm install <name>"`).
   - Replace the eager `import { plainToInstance } from 'class-transformer'`
     and `import { validate as Validate } from 'class-validator'` with two
     lazy getters, called inside `validate()`'s class-instance branch only
     (unreached when `dtoClass` has no constructor branch, i.e. never touched
     by `compileSchema()`/`.from()`-only users).
   - Replace `compileSchema`'s eager `import Ajv from 'ajv'` + module-scope
     `new Ajv(...)` with a lazy getter, constructed on `compileSchema(...)`'s
     first actual `.from()` call, cached in that schema's own closure (matches
     the existing "compiled once, not per request" framing — now "loaded once,
     on first use" too).
   - Keep the public signatures of `validate()` and `compileSchema()` exactly
     as they are — this is purely an internal load-timing change.

2. **`src/core/src/utils/core/sanitize.ts`**
   - Same lazy-load treatment for `joi`. All `Joi.*` calls here are already
     inside thunks (`SANITIZER.string.trim: () => Joi.string().trim()`), so
     swapping the eager `import * as Joi from 'joi'` for a lazy getter called
     inside each thunk is a pure internal change — `SANITIZER`'s public shape
     and the `sanitize()` runtime function's signature don't move.
   - Note: users who write their own `Joi.object({...})` schema already bring
     their own `joi` import today (per the docs example) — core's copy is only
     for `SANITIZER`'s convenience helpers and the internal `.validate()` call.

3. **`src/core/package.json`**
   - Move all four from `dependencies` to `peerDependencies`, add
     `peerDependenciesMeta` marking all four `optional: true`.
   - Add all four to root `package.json` `devDependencies` (pinned, matching
     how `class-transformer`/`class-validator`/`joi`/`reflect-metadata` are
     already mirrored there for this repo's own build/test) — `ajv` is
     missing from root devDependencies today (only present transitively via
     `fastify`); add it explicitly so the repo's own tests/build don't rely on
     that coincidence.

4. **Tests** (`__tests__/core/unit/validate.test.ts`, `__tests__/core/unit/sanitize/sanitize.test.ts`)
   - Existing tests keep passing unchanged (peers are installed in this repo).
   - Add one test per lazy-loaded library asserting the "peer not installed"
     error path fires with a clear message — fake it by requiring a
     nonexistent module name isn't representative, so instead extract
     `loadPeer`/`lazy` and unit-test the failure branch directly (mock
     `createRequire`'s returned `require` to throw), rather than trying to
     literally uninstall a real dependency mid-suite.

5. **Docs** (`helios-docs/docs/core-module/validation.md`, `.../sanitization.md` if present, `benchmarks-validation.md`)
   - "Installation" sections already say `npm install class-validator
     class-transformer` — now accurate instead of redundant. Add the same
     line for `joi` (sanitization doc) and `ajv` (the `compileSchema` section
     already added this session) if not already present.
   - Call out the peer-optional error message so it's not a surprise.

6. **Changeset**
   - `core: major` (peerDependency conversion is breaking per semver and per
     `STABILITY.md`). Do not touch http/aws/middlewares/grpc's changeset
     level for this — core versions independently (see memory: watch the
     "core: minor cascades into a false major on the linked packages" quirk;
     confirm whether "major" has the same cascade before running
     `changeset version`).

## Verification

- `yarn build` (full monorepo) — typecheck.
- `yarn test` — full suite, all 1534+ existing tests plus new peer-missing
  tests green.
- `yarn benchmark:validation` — rerun; expect same numbers as this session's
  already-captured run (67-68k req/s for Helios (Ajv)) since the lazy load
  only moves *when* ajv is required, not the per-request path — the compiled
  validator function is still built once and reused for every request.
- `yarn lint` — pre-existing 189 `any` errors unrelated to this; don't let
  new code add to that count.

## Explicitly not doing

- No `ValidationStrategy` interface/registry — `.from()` duck-typing already
  is the strategy contract.
- No dynamic `import()` / async signature changes — `createRequire` keeps
  every call site's sync/async shape exactly as today.
- No change to `@heliosjs/middlewares` — joi's runtime execution stays in
  `core` (moving it to `middlewares` would need `core` to depend on
  `middlewares`, which already depends on `core` — a cycle).
