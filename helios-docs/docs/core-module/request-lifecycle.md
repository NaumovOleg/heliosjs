---
sidebar_position: 3
description: The exact order every HeliosJS request passes through — routing, CORS, rate limiting, guards, pipes, middlewares, the handler, interceptors, and error handling.
---

# Request Lifecycle

Every request — HTTP, Lambda, the same code either way — passes through the
same fixed pipeline, in this order. Knowing the order is what makes it
obvious which tool to reach for: something that must run before the handler
and can reject the request is a guard; something that reshapes input is a
pipe; something that reshapes output is an interceptor; and so on.

## The Pipeline

| # | Stage | Configured by | Can reject / short-circuit? |
|---|-------|----------------|------------------------------|
| 1 | Route matching | `@Controller`, `@Get`/`@Post`/… | 404 if nothing matches |
| 2 | CORS | `@Cors`, `@Server({ cors })` | 403 on a disallowed origin |
| 3 | Rate limiting | `@RateLimit` | 429 on breach |
| 4 | Sanitizers | `@Sanitize`, `@Server({ sanitizers })` | Joi validation error |
| 5 | Guards | `@Guard`, `@Roles` | 403 on denial |
| 6 | Pipes | `@Pipe` | — (transforms only) |
| 7 | Middlewares | `@Use`, `@Server({ middlewares })` | Any error thrown, or simply not calling `next()` |
| 8 | Parameter resolution + validation | `@Body`/`@Params`/`@QueryParam`/… (with a DTO) | 400 `ValidationError` |
| 9 | The handler | Your route method | Whatever it throws or returns |
| 10 | Interceptors | `@Intercept` | — (transforms the handler's return value; runs in reverse declaration order) |
| 11 | Error handlers | `@Catch`, `@Server({ errorHandler })` | Only reached if something above threw |

Each stage only runs if every stage before it passed — a rejected guard never
reaches pipes, an invalid body never reaches the handler, and so on.

## Walking Through It

1. **Route matching.** The router picks the most *specific* matching route
   across the whole controller tree (see
   [Controllers → Route Priority](./controllers.md#route-priority)) —
   declaration order only matters as a tie-breaker.
2. **CORS.** Runs before anything else that could reject the request, so a
   disallowed cross-origin call never even reaches rate limiting or guards.
   A preflight `OPTIONS` request is answered here and never proceeds further.
3. **Rate limiting.** Checked next so that a client already over budget is
   turned away before the (comparatively expensive) sanitizer/guard/DTO work
   runs.
4. **Sanitizers.** Joi-based cleanup/validation of `body`/`query`/`params`/
   `headers`, before anything else reads them.
5. **Guards.** Authentication/authorization. By the time a guard runs, the
   request has already survived CORS, rate limiting, and sanitization — so
   guards can assume clean input.
6. **Pipes.** Transform `body`/`query`/`params`/`headers` in place (trim,
   coerce types, apply defaults) — after guards, so a rejected request never
   pays for the transform.
7. **Middlewares.** General-purpose `(req, res, next)` functions — logging,
   attaching request-scoped data, anything that doesn't fit the more specific
   stages above.
8. **Parameter resolution.** Each `@Body(Dto)`/`@Params(Dto)`/… argument is
   extracted and, if a DTO was given, validated with class-validator —
   *after* pipes, so validation sees the piped/transformed values.
9. **The handler.** Your method runs with the fully resolved arguments.
10. **Interceptors.** Only reached on a **successful** return — see
    [`@Intercept`](../middlewares/intercept.md) for the exact reverse-order
    semantics.
11. **Error handlers.** Anything thrown above — by a guard, a pipe, a
    middleware, param validation, or the handler itself — is caught here.
    Four error codes (`FORBIDDEN`, `NOT_FOUND`, `RATE_LIMIT_EXCEEDED`,
    `UNAUTHORIZED`) resolve straight to their HTTP response and skip
    `@Catch` **unless** the route declares one explicitly — see
    [Error Handling](./error.md).

## Where Inherited Middlewares Fit

A child controller's routes run their **parent's** class-level middlewares
first, then their own — this is how `@Controller({ controllers: [...] })`
nesting composes guards/pipes/middlewares down the tree. Global config from
`@Server({ middlewares, cors, sanitizers, errorHandler })` wraps the whole
tree from the outside.

## Related

- [Controllers](./controllers.md) — route declaration and nesting.
- [Error Handling](./error.md) — the full error-handling model.
- [`@Intercept`](../middlewares/intercept.md) — the one stage that runs
  *after* the handler.
