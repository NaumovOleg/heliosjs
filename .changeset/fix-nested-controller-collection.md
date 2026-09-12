---
"@heliosjs/http": patch
---

Fix `Helios.collectControllers` never discovering nested controllers declared
via `@Controller({ controllers: [Child] })`. It read sub-controllers from a
standalone `CONTROLLERS` metadata key that nothing in the codebase ever
writes to — `@Controller` actually stores nested controllers alongside its
other config, read via `reflectControllerMeta` (the same helper core itself
uses). The practical effect: SSE handlers (`@OnSSE`) declared on a nested
child controller were never registered, since `SSEServer.registerControllers`
is fed from this same flat list. Route dispatch itself was unaffected — the
core request pipeline builds its own nested `children` independently.
