---
"@heliosjs/core": patch
---

Route lookup (`findRoute`/`matchRoutes`) now uses a per-segment trie, built lazily from the controller tree and cached per root, instead of linearly scanning every route on every request. A route's position in the table no longer costs anything: on a 300-route benchmark table, throughput at the last-declared route went from 61.9% of the first-declared route's to 100.6% (flat, matching Fastify's shape) — see `benchmarks/results-routes.csv` and `.planning/codebase/CONCERNS.md`'s "Route matching" entry for the full before/after numbers. Routes with a `:name(regex)` segment, a mid-route `*`/`?`, or no precompiled regex (hand-built routes) aren't indexed and stay on the old linear path — fine, since real route tables have few of them. Matching behavior (specificity ranking, first-declared-wins ties, HEAD→GET fallback) is unchanged, verified by a differential fuzz test against the old matcher (`__tests__/core/unit/match-differential.test.ts`).
