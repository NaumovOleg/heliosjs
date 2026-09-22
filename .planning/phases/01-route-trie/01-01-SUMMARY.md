---
phase: 01-route-trie
plan: 01
status: done
commits:
  - c1df930 test(core): freeze legacy linear router as differential oracle
  - f2a742c test(core): differential test for router parity
  - 8d8a81e chore(bench): add 300-route routing suite with baseline
  - 257f40c perf(core): index routes in a segment trie instead of scanning linearly
  - fa462de test(core): targeted cases for the route trie
  - 3163bc2 chore(bench): fix routing-scale suite structure, record trie results
  - 4dedaeb docs(core): describe trie-backed router; add changeset
---

## Result

`findRoute` (`src/core/src/utils/core/match.ts`) now indexes routes in a per-segment
trie instead of scanning the whole controller/children tree on every request. The
trie only narrows candidates — the actual decision (highest specificity,
first-declared on ties, method match, then the existing regex confirm) is
byte-for-byte the old logic, verified by a differential fuzz test against a frozen
copy of the pre-trie matcher.

## Numbers (300-route table, corrected benchmark — see deviation below)

| URL position | Linear (≤4.0.6) | Trie (≥4.0.7) | % of first-declared |
|---|---:|---:|---|
| first-declared | 72,640 req/s | 89,752 req/s | 100% both |
| middle | 53,912 (74.2%) | 89,392 (99.6%) | |
| last-declared (static) | 45,000 (61.9%) | 90,288 (100.6%) | |
| last-declared (param) | 43,116 (59.4%) | 87,712 (97.7%) | |
| 404 | 30,792 (42.4%) | 43,744 (48.7%) | not routing cost — see below |

Full numbers incl. latency: `benchmarks/results-routes.csv`. Fastify (radix
reference) stays flat ~118k–125k regardless of position, both runs.

## Deviations from the plan

1. **must_haves' "5%" target was a pre-baseline guess (explicitly flagged as such
   in the plan) — actual result is much better**: route position now costs
   effectively nothing (100.6%/97.7% of first-declared vs. a 5% budget). Not
   adjusted after the fact; reporting the real number.

2. **The first benchmark run was itself broken, and that's the most important
   finding of this session.** Task 3's initial `helios-routes.ts` registered
   the 10 route-group controllers as 10 separate top-level entries on `@Server`.
   `Helios.runController` loops over *root* controllers too (a second, unrelated
   linear scan) — so every request to `c9` paid for 9 failed whole-controller
   lookups before findRoute even ran on the right one. That swamped the signal:
   the first trie measurement (Task 4→6, before the fix) showed ~0 benefit
   despite the trie code being correct and all unit/differential tests green.
   Diagnosed by checking how controllers are instantiated/iterated in
   `Helios.ts`, fixed by nesting the 10 controllers as children of one root
   (`@Controller({ controllers })`), and both BEFORE and AFTER were re-measured
   with the corrected harness. The flawed rows were replaced (not kept) in
   `benchmarks/results-routes.csv` since they measured a different, conflated
   thing and would mislead anyone reading that file later. See commit
   `3163bc2` for the full account.

3. **The 404 numbers don't flatten out** (42.4% → 48.7% of first-declared, on
   both linear and trie code) — that's `NotFoundError` construction/
   serialization cost (stack trace, timestamp, request id), not routing, and is
   out of scope for this plan. Documented as such everywhere the numbers appear
   (changeset, CONCERNS.md, benchmarks.md) rather than glossed over.

4. **Accidental `git stash pop` mid-session** pulled in a pre-existing,
   unrelated stash entry (not created this session) and produced merge
   conflicts across several files. Caught immediately, nothing was committed
   in that state; user approved `git reset --hard HEAD` to clean it up. The
   stash entries themselves were never touched/dropped — still sitting in
   `git stash list` (3 entries, pre-dating this session) for the user to deal
   with separately. Sent as feedback (product/model-behavior: reflexive
   `stash pop` after a `stash` that stashed nothing).

5. **Docs**: added a "Routing at scale" section to `helios-docs/docs/benchmarks.md`
   (not in the original plan's file list) per the user's mid-session request to
   document both old and new routing numbers together, keyed to
   `@heliosjs/core` versions (≤4.0.6 linear, ≥4.0.7 trie — deterministic since
   this changeset is the only one pending and it's a patch bump).

## Not done (deferred, per the plan's own "Deferred" section — unchanged)

- Promoting "segment-safe" `:name(regex)` routes into the trie.
- Positional param extraction (currently still one regex exec on the winner).
- Express/NestJS rows in the routes suite.
- Per-method trie roots.

## Verify

```
yarn lint && yarn build && yarn test:coverage
```
All green as of commit `4dedaeb`. Coverage: 98.12%/90.54%/98.99%/98.62%
(stmts/branch/fn/lines), gate is 95/88/96/96. `match.ts` itself: 100% functions,
93.44% branches (up from 90.9%/90.98% pre-plan).
