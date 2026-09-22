---
phase: 03-docs-overhaul
plan: 01
status: done
commits:
  - 4a1c0ec docs: refresh stale benchmark numbers and fix the DI/version claims (pre-plan accuracy fixes)
  - fd6d757 docs(site): rewrite homepage for competitive positioning (pre-plan, Task 1)
  - 8fec2ab docs(planning): add docs-overhaul plan
  - 2b4fe27 docs(intro): add a why-Helios section linking to benchmarks (Task 2)
  - 1db017b docs(grpc): document credentials/TLS, metadata auth, and the no-guard-layer boundary (Task 3)
  - ebed9e9 docs(grpc): fold api.md into module.md, de-duplicate the guide pages (Task 4)
  - c7c1952 docs(core): de-duplicate error.md's @Catch section against middlewares/catch.md (Task 5)
  - c472b35 docs(middlewares): add a composed guard+pipe+validation example (Task 6)
  - f067e77 docs: add Purpose sections to core-module and http-module pages (Tasks 7+8)
  - 47c3d8d docs: add Related sections to logging, cors, and use (Task 7)
  - 8fab7ae docs: cross-link aws/azure integration and plugins pages (Task 7)
---

## Result

Full pass triggered by the user's request: fix accuracy, expand thin pages with
more examples/use-cases and "why" explanations, verify docs against reality,
rewrite the landing page for competitive positioning, bring the docs toward
production-grade/marketing quality. Two audits (content-gap + accuracy, both
against current source) scoped the work; all 8 plan tasks shipped, plus the
accuracy fixes and homepage rewrite that were done before the plan was written.

## What shipped

**Accuracy** (`4a1c0ec`): benchmarks.md's main table was reporting the
2026-09-11 run, not the current one already in `results.csv` — refreshed, and
the "closed part of the Fastify gap" claim was rederived (the gap actually
widened on fresh data, 21-25%→27%, not narrowed — reported honestly rather
than kept). benchmarks-middleware.md's dedicated-process rationale cited the
pre-trie linear scan as the reason, now stale — rewritten, same fix applied to
its source comment. README.md had an empty "Version" column and described
core as providing "DI" (there is no DI container anywhere in this codebase).

**Homepage** (`fd6d757`): replaced 5 unbacked feature adjectives with a real
comparison section (reusing the existing `BenchChart` component, not a new
one), real current numbers, and one honest limitation stated plainly instead
of selling only upside. Caught and fixed a real CSS bug along the way (a
flexbox `gap` doubled up with a negative-margin gutter compensation, wrapping
4 feature cards 3+1 instead of one row).

**intro.md** (`2b4fe27`): added the same why-Helios evidence, verified
independently against benchmarks-validation.md/benchmarks-serialization.md
before citing (not just trusted the audit's paraphrase).

**gRPC** (`1db017b`, `ebed9e9`): documented credentials/TLS and metadata-based
auth (previously absent from all 4 files despite being a real, warned-about
config option) and the explicit absence of a guard/RBAC layer — every API
signature used (`ServerCredentials.createSsl`, `Metadata.get`, the
`(request, metadata, call)` handler signature) verified against the installed
`@grpc/grpc-js` `.d.ts` and `server.ts`'s `executeHandler` before writing the
snippets. Folded `api.md` (a bare export list) into `module.md` as a real
reference for its two previously-undocumented utilities (`normalizeError`,
`toPromise`), removing a whole file and de-duplicating the ~60%-overlapping
setup boilerplate across the remaining 3 gRPC guide pages.

**error.md / catch.md** (`c7c1952`): trimmed error.md's near-duplicate
`@Catch` walkthrough to one example + a pointer to catch.md's full guide
(async handlers, the contextual factory pattern — previously unreferenced
from error.md). Net shorter (438→409 lines) with no unique content lost.

**Composed example** (`c472b35`): pipe.md now shows `@Guard` + `@Pipe` +
`@Body(Dto)` together on one realistic route, with the causal explanation
(guards run before pipes before validation) — the one combination the audit
found completely absent from the whole doc set.

**Purpose + Related** (`f067e77`, `47c3d8d`, `8fab7ae`): added real,
page-specific Purpose openings to the 8 core-module/http-module pages that
lacked one, and Related sections wiring together every pair the audit
identified (validation↔parameter-decorators↔sanitize↔pipe,
rate-limiting↔fingerprint, error↔catch, cors↔server, use↔intercept,
websockets↔server-sent-events, aws/azure plugins↔their integration pages,
all 4→3 gRPC pages).

## Numbers

- Doc files with a `## Purpose` heading: 10→18 of 35 (middlewares/ already
  had 10/10; added to all 8 target core-module/http-module pages).
- Doc files with a `## Related` heading: 5→27 of 35.
- Files with zero outbound relative links: 19→1 (`http-module/graph-ql.md` —
  see Deviations).
- grpc: 4 files→3 (api.md folded into module.md).
- `yarn workspace docs build` run and clean after every single edit in this
  phase, not just at the end — `onBrokenLinks: 'throw'` was the real safety
  net for ~15 files' worth of new cross-links.

## Deviations from the plan

1. **`http-module/graph-ql.md` was NOT expanded**, despite being the content
   audit's #2-ranked thinnest file and #6 top-10 recommendation. It was never
   actually in this plan's task file lists (Tasks 3-8) — a scoping gap in the
   plan itself, not a skipped task. It's the one remaining file with zero
   outbound links. Worth its own follow-up: the `playground` config option
   (listed in server.md's own table, never explained), error-handling
   pattern for resolvers, and whether `@Guard`/`@Roles` apply to GraphQL at
   all are all still undocumented.
2. **Frontmatter standardization** (`description:` vs `sidebar_position`,
   audit's #10, lowest priority) — not done; cosmetic, no functional impact
   since `sidebars.ts` hardcodes ordering regardless.
3. **grpc/api.md fold vs expand**: plan left this as a judgment call. Chose
   fold (into module.md) over expand-in-place, since most of what api.md
   listed (config/client-shape types) is structural and never named directly
   by users — only `normalizeError`/`toPromise`/the `GrpcError` family
   actually needed real documentation, and those fit naturally as a short
   section on module.md rather than justifying their own page.

## Not done (out of scope per the plan, unchanged)

- DI/module-system documentation (there isn't one to document).
- A dedicated "vs Express/Fastify/NestJS" comparison page (the homepage +
  intro.md sections cover the actual ask).
- gRPC plugin/lifecycle system documentation (doesn't exist in source either
  — see the architecture-hardening phase).

## Verify

```
yarn workspace docs build && yarn lint && yarn test
```
All green as of commit `8fab7ae`.
